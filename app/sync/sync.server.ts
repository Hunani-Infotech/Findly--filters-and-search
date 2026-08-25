import prisma from "../db.server";
import { enforcePlanLimits } from "../billing.server";
import { bumpCatalogGeneration } from "../catalog-cache.server";
import { log } from "../log.server";
import { ensureShop } from "../shop.server";
import {
  BULK_PRODUCTS_MUTATION,
  BULK_PRODUCTS_QUERY,
  SHOPIFY_BULK_MAX_CONNECTIONS,
  COLLECTION_PRODUCTS_QUERY,
  COLLECTIONS_LIST_QUERY,
  PAGES_LIST_QUERY,
  ARTICLES_LIST_QUERY,
  CURRENT_BULK_OPERATION_QUERY,
  INVENTORY_ITEM_PRODUCT_QUERY,
  INVENTORY_LEVEL_PRODUCT_QUERY,
  PRODUCT_NODE_QUERY,
  PRODUCT_COLLECTIONS_QUERY,
  VARIANT_PRODUCT_QUERY,
  completedBulkIsFresh,
  countBulkQueryConnections,
} from "./graphql";
import {
  syncProductMarketPrices,
  syncShopMarketPrices,
} from "./markets-sync";
import {
  mapProductToFacet,
  parseBulkJsonlProducts,
  shopifyVariantNodes,
  variantsIncludeInventoryLevels,
} from "./product-mapper";
import { enqueueSyncJob } from "../queues.server";

type GraphqlClient = {
  graphql: (
    query: string,
    options?: { variables?: Record<string, unknown> },
  ) => Promise<Response>;
};

async function getAdminForShop(shopDomain: string): Promise<GraphqlClient> {
  const { unauthenticated } = await import("../shopify.server");
  const { admin } = await unauthenticated.admin(shopDomain);
  return admin;
}

async function syncProductMemberships(
  shopId: string,
  productGid: string,
  collectionGids: string[],
): Promise<string[]> {
  const existing = await prisma.collectionMembership.findMany({
    where: { shopId, productGid },
  });
  const previous = existing.map((row) => row.collectionGid);
  if (!collectionGids.length) {
    await prisma.collectionMembership.deleteMany({
      where: { shopId, productGid },
    });
    return previous;
  }
  await prisma.collectionMembership.deleteMany({
    where: {
      shopId,
      productGid,
      collectionGid: { notIn: collectionGids },
    },
  });
  for (const collectionGid of collectionGids) {
    const prev = existing.find((row) => row.collectionGid === collectionGid);
    await prisma.collectionMembership.upsert({
      where: {
        shopId_collectionGid_productGid: {
          shopId,
          collectionGid,
          productGid,
        },
      },
      create: {
        shopId,
        collectionGid,
        productGid,
        position: prev?.position ?? 0,
      },
      update: {},
    });
  }
  return previous;
}

async function fetchProductCollectionGids(
  admin: GraphqlClient,
  productGid: string,
): Promise<string[] | null> {
  const gids: string[] = [];
  let cursor: string | null = null;
  let hasNext = true;
  try {
    while (hasNext) {
      const response = await admin.graphql(PRODUCT_COLLECTIONS_QUERY, {
        variables: { id: productGid, cursor },
      });
      const json = (await response.json()) as {
        data?: {
          product?: {
            collections?: {
              pageInfo?: { hasNextPage?: boolean; endCursor?: string | null };
              edges?: Array<{ node?: { id?: string } }>;
            };
          } | null;
        };
        errors?: unknown;
      };
      if (json.errors) {
        log.error(
          `[sync] product collections query failed ${productGid}: ${JSON.stringify(json.errors)}`,
        );
        return null;
      }
      const product = json.data?.product;
      if (!product) return null;
      const connection = product.collections;
      if (!connection) break;
      for (const edge of connection.edges || []) {
        const id = edge?.node?.id;
        if (id) gids.push(id);
      }
      hasNext = Boolean(connection.pageInfo?.hasNextPage);
      cursor = connection.pageInfo?.endCursor ?? null;
    }
    return [...new Set(gids)];
  } catch (error) {
    log.error(`[sync] product collections fetch failed ${productGid}`, error);
    return null;
  }
}

async function enqueueChangedCollectionRebuilds(
  shopDomain: string,
  previous: string[],
  next: string[],
) {
  const prevSet = new Set(previous);
  const nextSet = new Set(next);
  const changed = new Set<string>();
  for (const gid of nextSet) {
    if (!prevSet.has(gid)) changed.add(gid);
  }
  for (const gid of prevSet) {
    if (!nextSet.has(gid)) changed.add(gid);
  }
  for (const collectionGid of changed) {
    try {
      await enqueueSyncJob(
        "collection.rebuild",
        { shop: shopDomain, collectionGid },
        {
          jobId: `${shopDomain}:collection.rebuild:${collectionGid}`,
          delay: 2000,
        },
      );
    } catch (error) {
      log.error("Failed to enqueue collection rebuild", error);
    }
  }
}

async function setSyncStatus(
  shopId: string,
  data: {
    status: "PENDING" | "SYNCING" | "READY" | "ERROR";
    errorLog?: string | null;
    bulkOperationId?: string | null;
    lastFullSyncAt?: Date;
    lastIncrementalSyncAt?: Date;
  },
) {
  return prisma.syncJob.upsert({
    where: { shopId },
    create: {
      shopId,
      status: data.status,
      errorLog: data.errorLog ?? null,
      bulkOperationId: data.bulkOperationId ?? null,
      lastFullSyncAt: data.lastFullSyncAt,
      lastIncrementalSyncAt: data.lastIncrementalSyncAt,
    },
    update: {
      status: data.status,
      errorLog: data.errorLog === undefined ? undefined : data.errorLog,
      bulkOperationId:
        data.bulkOperationId === undefined ? undefined : data.bulkOperationId,
      lastFullSyncAt: data.lastFullSyncAt,
      lastIncrementalSyncAt: data.lastIncrementalSyncAt,
    },
  });
}

/** Upsert discovered metafield keys for the mapping UI (all metafields, not only selected). */
async function recordDiscoveredMetafields(
  shopId: string,
  metafields: Record<string, string>,
  ownerType: "PRODUCT" | "VARIANT" = "PRODUCT",
) {
  for (const [path, sampleValue] of Object.entries(metafields)) {
    const dot = path.indexOf(".");
    if (dot <= 0) continue;
    const namespace = path.slice(0, dot);
    const key = path.slice(dot + 1);
    if (!namespace || !key) continue;

    await prisma.discoveredMetafield.upsert({
      where: {
        shopId_namespace_key_ownerType: { shopId, namespace, key, ownerType },
      },
      create: {
        shopId,
        namespace,
        key,
        ownerType,
        sampleValue: sampleValue?.slice(0, 500) ?? null,
      },
      update: {
        sampleValue: sampleValue?.slice(0, 500) ?? null,
      },
    });
  }
}

/** Full collection list sync via Admin GraphQL pagination (not REST). */
export async function syncCollectionsList(shopDomain: string) {
  const shop = await ensureShop(shopDomain);
  const admin = await getAdminForShop(shopDomain);

  let cursor: string | null = null;
  let hasNext = true;
  let count = 0;

  while (hasNext) {
    const response = await admin.graphql(COLLECTIONS_LIST_QUERY, {
      variables: { cursor },
    });
    const json = await response.json();
    const connection = json.data?.collections;
    if (!connection) break;

    for (const edge of connection.edges) {
      const node = edge.node as {
        id: string;
        title: string;
        handle?: string;
      };
      await prisma.collection.upsert({
        where: {
          shopId_collectionGid: {
            shopId: shop.id,
            collectionGid: node.id,
          },
        },
        create: {
          shopId: shop.id,
          collectionGid: node.id,
          title: node.title,
          handle: node.handle ?? "",
        },
        update: {
          title: node.title,
          handle: node.handle ?? "",
        },
      });
      count += 1;
    }

    hasNext = connection.pageInfo.hasNextPage;
    cursor = connection.pageInfo.endCursor;
  }

  return { count };
}

export async function syncShopContent(shopDomain: string) {
  const shop = await ensureShop(shopDomain);
  const admin = await getAdminForShop(shopDomain);
  const seenPages = new Set<string>();
  const seenArticles = new Set<string>();

  let cursor: string | null = null;
  let hasNext = true;
  while (hasNext) {
    const response = await admin.graphql(PAGES_LIST_QUERY, {
      variables: { cursor },
    });
    const json = await response.json();
    const connection = json.data?.pages;
    if (!connection) break;
    const pageNodes = connection.nodes ??
      (connection.edges ?? []).map((edge: { node: unknown }) => edge.node);
    for (const node of pageNodes) {
      const page = node as {
        id?: string;
        title?: string;
        handle?: string;
        isPublished?: boolean;
      };
      if (!page.id) continue;
      seenPages.add(page.id);
      await prisma.shopPage.upsert({
        where: { shopId_pageGid: { shopId: shop.id, pageGid: page.id } },
        create: {
          shopId: shop.id,
          pageGid: page.id,
          title: page.title || "",
          handle: page.handle ?? "",
          published: page.isPublished !== false,
        },
        update: {
          title: page.title || "",
          handle: page.handle ?? "",
          published: page.isPublished !== false,
        },
      });
    }
    hasNext = Boolean(connection.pageInfo?.hasNextPage);
    cursor = connection.pageInfo?.endCursor ?? null;
  }

  cursor = null;
  hasNext = true;
  while (hasNext) {
    const response = await admin.graphql(ARTICLES_LIST_QUERY, {
      variables: { cursor },
    });
    const json = await response.json();
    const connection = json.data?.articles;
    if (!connection) break;
    const articleNodes = connection.nodes ??
      (connection.edges ?? []).map((edge: { node: unknown }) => edge.node);
    for (const node of articleNodes) {
      const article = node as {
        id?: string;
        title?: string;
        handle?: string;
        blog?: { handle?: string } | null;
      };
      if (!article.id) continue;
      seenArticles.add(article.id);
      await prisma.shopArticle.upsert({
        where: { shopId_articleGid: { shopId: shop.id, articleGid: article.id } },
        create: {
          shopId: shop.id,
          articleGid: article.id,
          title: article.title || "",
          handle: article.handle ?? "",
          blogHandle: article.blog?.handle ?? "",
          published: true,
        },
        update: {
          title: article.title || "",
          handle: article.handle ?? "",
          blogHandle: article.blog?.handle ?? "",
          published: true,
        },
      });
    }
    hasNext = Boolean(connection.pageInfo?.hasNextPage);
    cursor = connection.pageInfo?.endCursor ?? null;
  }

  if (seenPages.size) {
    await prisma.shopPage.deleteMany({
      where: { shopId: shop.id, pageGid: { notIn: [...seenPages] } },
    });
  }
  if (seenArticles.size) {
    await prisma.shopArticle.deleteMany({
      where: { shopId: shop.id, articleGid: { notIn: [...seenArticles] } },
    });
  }

  return { pages: seenPages.size, articles: seenArticles.size };
}

type BulkOperationSnapshot = {
  id?: string;
  status?: string;
  url?: string | null;
  completedAt?: string | null;
};

function bulkAlreadyInProgress(message: string) {
  return /already in progress|already running/i.test(message);
}

function bulkGraphqlMessage(json: {
  errors?: unknown;
  data?: {
    bulkOperationRunQuery?: {
      userErrors?: Array<{ message?: string }>;
    };
  };
}) {
  const userErrors = json.data?.bulkOperationRunQuery?.userErrors ?? [];
  const fromUsers = userErrors
    .map((error) => error.message)
    .filter((message): message is string => Boolean(message))
    .join("; ");
  if (fromUsers) return fromUsers;
  return graphqlErrors(json);
}

async function readCurrentBulkOperation(
  admin: GraphqlClient,
): Promise<BulkOperationSnapshot | null> {
  const response = await admin.graphql(CURRENT_BULK_OPERATION_QUERY);
  const json = (await response.json()) as {
    data?: { currentBulkOperation?: BulkOperationSnapshot | null };
  };
  return json.data?.currentBulkOperation ?? null;
}

async function reuseCurrentBulkOperation(
  shopId: string,
  shopDomain: string,
  op: BulkOperationSnapshot | null,
) {
  const id = op?.id;
  if (!id) return null;
  const status = (op.status || "").toUpperCase();

  if (status === "CREATED" || status === "RUNNING") {
    const syncJob = await setSyncStatus(shopId, {
      status: "SYNCING",
      bulkOperationId: id,
      errorLog: null,
    });
    log.info(`[sync] bulk already running ${id}; waiting for finish webhook`);
    return { syncJob, bulkOperationId: id, reused: true as const };
  }

  if (status === "COMPLETED" && op.url) {
    if (!completedBulkIsFresh(op)) {
      log.info(
        `[sync] completed bulk ${id} is stale; starting a new product query`,
      );
      return null;
    }
    const syncJob = await setSyncStatus(shopId, {
      status: "SYNCING",
      bulkOperationId: id,
      errorLog: null,
    });
    try {
      await enqueueSyncJob(
        "shop.ingestBulk",
        { shop: shopDomain, bulkOperationId: id },
        { jobId: `${shopDomain}:shop.ingestBulk:${id}` },
      );
    } catch (error) {
      log.warn("[sync] ingest enqueue failed after completed bulk", error);
    }
    log.info(`[sync] bulk ${id} already completed; queued ingest`);
    return { syncJob, bulkOperationId: id, reused: true as const };
  }

  return null;
}

export async function startFullSync(shopDomain: string) {
  const shop = await ensureShop(shopDomain);

  try {
    const admin = await getAdminForShop(shopDomain);

    await setSyncStatus(shop.id, { status: "SYNCING", errorLog: null });

    // Collections list in parallel path (paginated GraphQL — collections are fewer than products)
    try {
      await syncCollectionsList(shopDomain);
    } catch (error) {
      log.error("Collection list sync failed", error);
    }

    try {
      await syncShopContent(shopDomain);
    } catch (error) {
      log.error("Pages/articles sync failed", error);
    }

    let current: BulkOperationSnapshot | null = null;
    try {
      current = await readCurrentBulkOperation(admin);
    } catch (error) {
      log.warn("[sync] current bulk lookup failed", error);
    }
    const reused = await reuseCurrentBulkOperation(shop.id, shopDomain, current);
    if (reused) {
      return { shop, ...reused };
    }

    const bulkConnections = countBulkQueryConnections(BULK_PRODUCTS_QUERY);
    if (bulkConnections > SHOPIFY_BULK_MAX_CONNECTIONS) {
      const message = `Bulk query has ${bulkConnections} connections; Shopify allows ${SHOPIFY_BULK_MAX_CONNECTIONS}`;
      await setSyncStatus(shop.id, { status: "ERROR", errorLog: message });
      throw new Error(message);
    }

    log.info("[sync] starting bulk product query");
    const response = await admin.graphql(BULK_PRODUCTS_MUTATION, {
      variables: { query: BULK_PRODUCTS_QUERY },
    });
    const json = await response.json();
    const payload = json.data?.bulkOperationRunQuery;
    const bulkId = payload?.bulkOperation?.id as string | undefined;
    const message =
      bulkGraphqlMessage(json) || "Failed to start bulk operation";

    if (!bulkId) {
      if (bulkAlreadyInProgress(message)) {
        const latest = await readCurrentBulkOperation(admin);
        const recovered = await reuseCurrentBulkOperation(
          shop.id,
          shopDomain,
          latest,
        );
        if (recovered) {
          return { shop, ...recovered };
        }
      }
      await setSyncStatus(shop.id, { status: "ERROR", errorLog: message });
      throw new Error(message);
    }

    const syncJob = await setSyncStatus(shop.id, {
      status: "SYNCING",
      bulkOperationId: bulkId,
      errorLog: null,
    });

    return {
      shop,
      syncJob,
      bulkOperationId: bulkId,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await setSyncStatus(shop.id, { status: "ERROR", errorLog: message });
    throw error;
  }
}

export async function ingestBulkOperation(
  shopDomain: string,
  bulkOperationId?: string,
) {
  try {
    return await ingestCompletedBulkOperation(shopDomain, bulkOperationId);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (
      /not ready|missing URL|status: (RUNNING|CREATED|CANCELING)/i.test(
        message,
      )
    ) {
      throw error;
    }
    try {
      const shop = await ensureShop(shopDomain);
      await setSyncStatus(shop.id, { status: "ERROR", errorLog: message });
    } catch (statusError) {
      log.error("Failed to record ingest error status", statusError);
    }
    throw error;
  }
}

async function ingestCompletedBulkOperation(
  shopDomain: string,
  bulkOperationId?: string,
) {
  const shop = await ensureShop(shopDomain);
  const admin = await getAdminForShop(shopDomain);

  const response = await admin.graphql(CURRENT_BULK_OPERATION_QUERY);
  const json = await response.json();
  const op = json.data?.currentBulkOperation;

  if (!op) {
    throw new Error("Bulk operation not ready or missing URL");
  }
  if (bulkOperationId && op.id !== bulkOperationId) {
    throw new Error(
      `Bulk operation mismatch: expected ${bulkOperationId}, got ${op.id}`,
    );
  }

  if (op.status === "FAILED" || op.status === "CANCELED") {
    await setSyncStatus(shop.id, {
      status: "ERROR",
      errorLog: `Bulk operation status: ${op.status}`,
    });
    throw new Error(`Bulk operation status: ${op.status}`);
  }

  if (op.status !== "COMPLETED" || !op.url) {
    throw new Error(`Bulk operation status: ${op.status}`);
  }
  if (!completedBulkIsFresh(op)) {
    throw new Error("Bulk operation snapshot is stale; start a new full sync");
  }

  const fileRes = await fetch(op.url);
  const text = await fileRes.text();
  const products = parseBulkJsonlProducts(text.split("\n"));

  const limits = await enforcePlanLimits(shop.id);
  const productLimit = limits.productLimit;
  const truncated = products.length > productLimit;
  const toIngest = truncated ? products.slice(0, productLimit) : products;

  let upserted = 0;
  log.info(`[sync] ingesting ${toIngest.length} products (limit ${productLimit})`);
  for (const product of toIngest) {
    const { facet, collectionGids } = mapProductToFacet(shop.id, product);
    const writeInventoryLocations = variantsIncludeInventoryLevels(
      shopifyVariantNodes(product),
    );
    await prisma.productFacet.upsert({
      where: {
        shopId_productGid: { shopId: shop.id, productGid: facet.productGid },
      },
      create: facet,
      update: {
        handle: facet.handle,
        title: facet.title,
        vendor: facet.vendor,
        productType: facet.productType,
        tags: facet.tags,
        skus: facet.skus,
        options: facet.options as object,
        priceMin: facet.priceMin,
        priceMax: facet.priceMax,
        compareAtMin: facet.compareAtMin,
        compareAtMax: facet.compareAtMax,
        salePct: facet.salePct,
        available: facet.available,
        ...(writeInventoryLocations
          ? { inventoryLocations: facet.inventoryLocations }
          : {}),
        status: facet.status,
        imageUrl: facet.imageUrl,
        variantImages: facet.variantImages as object,
        variants: facet.variants as object,
        metafields: facet.metafields as object,
        variantMetafields: facet.variantMetafields as object,
        publishedAt: facet.publishedAt,
      },
    });

    await recordDiscoveredMetafields(
      shop.id,
      (facet.metafields as Record<string, string>) || {},
      "PRODUCT",
    );
    await recordDiscoveredMetafields(
      shop.id,
      (facet.variantMetafields as Record<string, string>) || {},
      "VARIANT",
    );

    await syncProductMemberships(shop.id, facet.productGid, collectionGids);
    upserted += 1;
    if (upserted === 1 || upserted % 25 === 0 || upserted === toIngest.length) {
      log.info(`[sync] upserted ${upserted}/${toIngest.length}`);
    }
  }

  let pruned = 0;
  if (!truncated && toIngest.length > 0) {
    const keepGids = toIngest.map((product) => product.id);
    const removed = await prisma.productFacet.deleteMany({
      where: { shopId: shop.id, productGid: { notIn: keepGids } },
    });
    await prisma.collectionMembership.deleteMany({
      where: { shopId: shop.id, productGid: { notIn: keepGids } },
    });
    pruned = removed.count;
    if (pruned) {
      log.info(`[sync] pruned ${pruned} products missing from bulk catalog`);
    }
  }

  try {
    await syncCollectionsList(shopDomain);
  } catch (error) {
    log.error("Post-ingest collection sync failed", error);
  }

  try {
    await syncShopContent(shopDomain);
  } catch (error) {
    log.error("Post-ingest pages/articles sync failed", error);
  }

  try {
    const collections = await prisma.collection.findMany({
      where: { shopId: shop.id },
      select: { collectionGid: true },
    });
    log.info(`[sync] rebuilding ${collections.length} collections`);
    let rebuilt = 0;
    for (const collection of collections) {
      try {
        await rebuildCollection(shopDomain, collection.collectionGid);
      } catch (error) {
        log.error(
          `[sync] rebuild failed ${collection.collectionGid}`,
          error,
        );
        continue;
      }
      rebuilt += 1;
      if (rebuilt === 1 || rebuilt % 10 === 0 || rebuilt === collections.length) {
        log.info(`[sync] rebuilt collections ${rebuilt}/${collections.length}`);
      }
    }
  } catch (error) {
    log.error("Post-ingest collection order sync failed", error);
  }

  try {
    log.info("[sync] syncing market prices");
    await syncShopMarketPrices(admin, shop.id);
    log.info("[sync] market prices done");
  } catch (error) {
    log.error("Post-ingest market prices sync failed", error);
  }

  const errorLog = truncated
    ? `Product limit reached (${productLimit} for ${limits.plan} plan). Indexed first ${productLimit} of ${products.length} products; upgrade to Pro for a higher limit.`
    : null;

  await setSyncStatus(shop.id, {
    status: "READY",
    lastFullSyncAt: new Date(),
    errorLog,
    bulkOperationId: op.id,
  });

  await bumpCatalogGeneration(shopDomain);
  return { upserted, truncated, pruned, productLimit };
}

export async function upsertProduct(
  shopDomain: string,
  productGid: string,
  opts?: { skipCollectionRebuild?: boolean },
) {
  const shop = await ensureShop(shopDomain);
  const admin = await getAdminForShop(shopDomain);

  const limits = await enforcePlanLimits(shop.id);
  const existingCount = await prisma.productFacet.count({
    where: { shopId: shop.id },
  });
  const alreadyIndexed = await prisma.productFacet.findUnique({
    where: {
      shopId_productGid: { shopId: shop.id, productGid },
    },
  });
  if (
    !alreadyIndexed &&
    existingCount >= limits.productLimit
  ) {
    await setSyncStatus(shop.id, {
      status: "READY",
      lastIncrementalSyncAt: new Date(),
      errorLog: `Product limit reached (${limits.productLimit} for ${limits.plan} plan). Skipped upsert for ${productGid}.`,
    });
    return { skipped: true as const };
  }

  const response = await admin.graphql(PRODUCT_NODE_QUERY, {
    variables: { id: productGid },
  });
  const json = await response.json();
  const lookupError = graphqlErrors(json);
  const product = json.data?.product;
  if (!product) {
    if (lookupError) {
      log.error(`[sync] product fetch failed ${productGid}: ${lookupError}`);
      throw new Error(`Product fetch failed for ${productGid}`);
    }
    await deleteProduct(shopDomain, productGid);
    return;
  }
  if (lookupError) {
    log.warn(`[sync] product fetch partial errors ${productGid}: ${lookupError}`);
  }

  const { facet, collectionGids: mappedGids } = mapProductToFacet(shop.id, product);
  const pagedGids = await fetchProductCollectionGids(admin, productGid);
  const collectionGids =
    pagedGids ?? (mappedGids.length ? mappedGids : null);
  const writeInventoryLocations = variantsIncludeInventoryLevels(
    shopifyVariantNodes(product),
  );

  await prisma.productFacet.upsert({
    where: {
      shopId_productGid: { shopId: shop.id, productGid: facet.productGid },
    },
    create: facet,
    update: {
      handle: facet.handle,
      title: facet.title,
      vendor: facet.vendor,
      productType: facet.productType,
      tags: facet.tags,
      skus: facet.skus,
      options: facet.options,
      priceMin: facet.priceMin,
      priceMax: facet.priceMax,
      compareAtMin: facet.compareAtMin,
      compareAtMax: facet.compareAtMax,
      salePct: facet.salePct,
      available: facet.available,
      ...(writeInventoryLocations
        ? { inventoryLocations: facet.inventoryLocations }
        : {}),
      status: facet.status,
        imageUrl: facet.imageUrl,
        variantImages: facet.variantImages,
        variants: facet.variants,
        metafields: facet.metafields,
        variantMetafields: facet.variantMetafields,
        publishedAt: facet.publishedAt,
      },
    });

  await bumpCatalogGeneration(shopDomain);

  await recordDiscoveredMetafields(
    shop.id,
    (facet.metafields as Record<string, string>) || {},
    "PRODUCT",
  );
  await recordDiscoveredMetafields(
    shop.id,
    (facet.variantMetafields as Record<string, string>) || {},
    "VARIANT",
  );

  if (collectionGids !== null) {
    const previous = await syncProductMemberships(
      shop.id,
      facet.productGid,
      collectionGids,
    );
    if (!opts?.skipCollectionRebuild) {
      await enqueueChangedCollectionRebuilds(
        shopDomain,
        previous,
        collectionGids,
      );
    }
  }

  try {
    await syncProductMarketPrices(admin, shop.id, facet.productGid);
  } catch (error) {
    log.error("Incremental market prices sync failed", error);
  }

  await setSyncStatus(shop.id, {
    status: "READY",
    lastIncrementalSyncAt: new Date(),
  });

  await bumpCatalogGeneration(shopDomain);
}

export async function deleteProduct(shopDomain: string, productGid: string) {
  const shop = await prisma.shop.findUnique({ where: { domain: shopDomain } });
  if (!shop) return;

  await prisma.collectionMembership.deleteMany({
    where: { shopId: shop.id, productGid },
  });
  await prisma.productFacet.deleteMany({
    where: { shopId: shop.id, productGid },
  });

  await setSyncStatus(shop.id, {
    status: "READY",
    lastIncrementalSyncAt: new Date(),
  });

  await bumpCatalogGeneration(shopDomain);
}

type CollectionProductSortKey = "COLLECTION_DEFAULT" | "ID";

type CollectionProductsFetch = {
  deleted: boolean;
  title: string;
  handle: string;
  productGids: string[];
  expectedCount: number | null;
  exactCount: boolean;
};

function uniqueAppend(primary: string[], extra: string[]): string[] {
  const seen = new Set(primary);
  const out = [...primary];
  for (const id of extra) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

async function fetchCollectionProductGids(
  admin: GraphqlClient,
  collectionGid: string,
  sortKey: CollectionProductSortKey,
): Promise<CollectionProductsFetch> {
  const productGids: string[] = [];
  let cursor: string | null = null;
  let hasNext = true;
  let title = "";
  let handle = "";
  let expectedCount: number | null = null;
  let exactCount = false;
  let pages = 0;

  while (hasNext) {
    pages += 1;
    if (pages > 80) {
      throw new Error(
        `Collection products pagination exceeded 80 pages for ${collectionGid}`,
      );
    }
    const response = await admin.graphql(COLLECTION_PRODUCTS_QUERY, {
      variables: { id: collectionGid, cursor, sortKey },
    });
    const json = (await response.json()) as {
      data?: {
        collection?: {
          title?: string;
          handle?: string;
          productsCount?: { count?: number; precision?: string } | null;
          products?: {
            pageInfo?: { hasNextPage?: boolean; endCursor?: string | null };
            edges?: Array<{ node?: { id?: string } }>;
          };
        } | null;
      };
      errors?: unknown;
    };
    const gqlError = graphqlErrors(json);
    if (gqlError) {
      throw new Error(
        `Collection products query failed ${collectionGid}: ${gqlError}`,
      );
    }
    const collection = json.data?.collection;
    if (!collection) {
      return {
        deleted: true,
        title: "",
        handle: "",
        productGids: [],
        expectedCount: null,
        exactCount: false,
      };
    }
    if (!collection.products) {
      throw new Error(
        `Collection products connection missing for ${collectionGid}`,
      );
    }

    title = collection.title ?? title;
    handle = collection.handle ?? handle;
    const count = collection.productsCount?.count;
    if (typeof count === "number" && Number.isFinite(count)) {
      expectedCount = count;
      exactCount = collection.productsCount?.precision === "EXACT";
    }
    for (const edge of collection.products.edges || []) {
      const id = edge?.node?.id;
      if (id) productGids.push(id);
    }
    hasNext = Boolean(collection.products.pageInfo?.hasNextPage);
    cursor = collection.products.pageInfo?.endCursor ?? null;
  }

  return {
    deleted: false,
    title,
    handle,
    productGids: uniqueAppend([], productGids),
    expectedCount,
    exactCount,
  };
}

export async function rebuildCollection(
  shopDomain: string,
  collectionGid: string,
) {
  const shop = await ensureShop(shopDomain);
  const admin = await getAdminForShop(shopDomain);

  const primary = await fetchCollectionProductGids(
    admin,
    collectionGid,
    "COLLECTION_DEFAULT",
  );
  if (primary.deleted) {
    await prisma.collectionMembership.deleteMany({
      where: { shopId: shop.id, collectionGid },
    });
    await prisma.collection.deleteMany({
      where: { shopId: shop.id, collectionGid },
    });
    await setSyncStatus(shop.id, {
      status: "READY",
      lastIncrementalSyncAt: new Date(),
    });
    await bumpCatalogGeneration(shopDomain);
    return { count: 0, deleted: true as const };
  }

  let productGids = primary.productGids;
  let title = primary.title;
  let handle = primary.handle;
  const expectedCount = primary.expectedCount;
  const exactCount = primary.exactCount;
  const incomplete =
    exactCount &&
    expectedCount != null &&
    productGids.length < expectedCount;

  if (incomplete) {
    log.warn(
      `[sync] ${collectionGid} COLLECTION_DEFAULT returned ${productGids.length}/${expectedCount}; retrying with ID sort`,
    );
    const fallback = await fetchCollectionProductGids(
      admin,
      collectionGid,
      "ID",
    );
    if (fallback.deleted) {
      throw new Error(
        `Collection ${collectionGid} disappeared during product pagination`,
      );
    }
    title = fallback.title || title;
    handle = fallback.handle || handle;
    productGids = uniqueAppend(productGids, fallback.productGids);
  }

  if (
    exactCount &&
    expectedCount != null &&
    productGids.length < expectedCount
  ) {
    throw new Error(
      `Incomplete collection products for ${collectionGid}: got ${productGids.length}, Shopify reports ${expectedCount}`,
    );
  }

  await prisma.collection.upsert({
    where: {
      shopId_collectionGid: { shopId: shop.id, collectionGid },
    },
    create: {
      shopId: shop.id,
      collectionGid,
      title: title || collectionGid,
      handle,
    },
    update: {
      title: title || collectionGid,
      handle,
    },
  });

  await prisma.collectionMembership.deleteMany({
    where: { shopId: shop.id, collectionGid },
  });
  if (productGids.length) {
    await prisma.collectionMembership.createMany({
      data: productGids.map((productGid, index) => ({
        shopId: shop.id,
        collectionGid,
        productGid,
        position: index,
      })),
      skipDuplicates: true,
    });
  }

  if (productGids.length) {
    const existingFacets = await prisma.productFacet.findMany({
      where: { shopId: shop.id, productGid: { in: productGids } },
      select: { productGid: true },
    });
    const existingGids = new Set(existingFacets.map((f) => f.productGid));
    const missingGids = productGids.filter((gid) => !existingGids.has(gid));
    for (const productGid of missingGids) {
      await upsertProduct(shopDomain, productGid, {
        skipCollectionRebuild: true,
      });
    }
  }

  await setSyncStatus(shop.id, {
    status: "READY",
    lastIncrementalSyncAt: new Date(),
  });

  await bumpCatalogGeneration(shopDomain);
  return { count: productGids.length };
}

function graphqlErrors(json: { errors?: unknown }): string | null {
  const errors = json.errors;
  if (!Array.isArray(errors) || errors.length === 0) return null;
  return JSON.stringify(errors);
}

function productGidFromInventoryItem(item: {
  variant?: { product?: { id?: string } | null } | null;
  variants?: {
    nodes?: Array<{ product?: { id?: string } | null }>;
    edges?: Array<{ node?: { product?: { id?: string } | null } }>;
  } | null;
} | null | undefined): string | undefined {
  return (
    item?.variant?.product?.id ??
    item?.variants?.nodes?.[0]?.product?.id ??
    item?.variants?.edges?.[0]?.node?.product?.id
  );
}

export async function syncInventoryItem(
  shopDomain: string,
  inventoryItemGid: string,
) {
  const admin = await getAdminForShop(shopDomain);
  const isLevel = inventoryItemGid.includes("/InventoryLevel/");
  const response = await admin.graphql(
    isLevel ? INVENTORY_LEVEL_PRODUCT_QUERY : INVENTORY_ITEM_PRODUCT_QUERY,
    { variables: { id: inventoryItemGid } },
  );
  const json = await response.json();
  const lookupError = graphqlErrors(json);
  if (lookupError) {
    log.error(
      `[sync] inventory lookup failed ${inventoryItemGid}: ${lookupError}`,
    );
  }
  const item = isLevel
    ? json.data?.inventoryLevel?.item
    : json.data?.inventoryItem;
  const productGid = productGidFromInventoryItem(item);
  if (!productGid) {
    if (lookupError || item) {
      throw new Error(`Inventory lookup failed ${inventoryItemGid}`);
    }
    log.warn(`[sync] inventory item ${inventoryItemGid} has no product`);
    return;
  }
  return upsertProduct(shopDomain, productGid);
}

export async function syncVariant(shopDomain: string, variantGid: string) {
  const admin = await getAdminForShop(shopDomain);
  const response = await admin.graphql(VARIANT_PRODUCT_QUERY, {
    variables: { id: variantGid },
  });
  const json = await response.json();
  const lookupError = graphqlErrors(json);
  if (lookupError) {
    log.error(`[sync] variant lookup failed ${variantGid}: ${lookupError}`);
  }
  const productGid = json.data?.productVariant?.product?.id;
  if (!productGid) return;
  return upsertProduct(shopDomain, productGid);
}
