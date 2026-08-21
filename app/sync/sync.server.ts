import prisma from "../db.server";
import { enforcePlanLimits } from "../billing.server";
import { log } from "../log.server";
import { ensureShop } from "../shop.server";
import {
  BULK_PRODUCTS_MUTATION,
  BULK_PRODUCTS_QUERY,
  COLLECTION_PRODUCTS_QUERY,
  COLLECTIONS_LIST_QUERY,
  PAGES_LIST_QUERY,
  ARTICLES_LIST_QUERY,
  CURRENT_BULK_OPERATION_QUERY,
  PRODUCT_NODE_QUERY,
} from "./graphql";
import {
  syncProductMarketPrices,
  syncShopMarketPrices,
} from "./markets-sync";
import { mapProductToFacet, parseBulkJsonlProducts } from "./product-mapper";

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
) {
  const existing = await prisma.collectionMembership.findMany({
    where: { shopId, productGid },
  });
  if (!collectionGids.length) {
    await prisma.collectionMembership.deleteMany({
      where: { shopId, productGid },
    });
    return;
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

    log.info("[sync] starting bulk product query (nested variant id)");
    const response = await admin.graphql(BULK_PRODUCTS_MUTATION, {
      variables: { query: BULK_PRODUCTS_QUERY },
    });
    const json = await response.json();
    const payload = json.data?.bulkOperationRunQuery;
    const userErrors = payload?.userErrors ?? [];

    if (userErrors.length || !payload?.bulkOperation?.id) {
      const message =
        userErrors.map((e: { message: string }) => e.message).join("; ") ||
        "Failed to start bulk operation";
      await setSyncStatus(shop.id, { status: "ERROR", errorLog: message });
      throw new Error(message);
    }

    const syncJob = await setSyncStatus(shop.id, {
      status: "SYNCING",
      bulkOperationId: payload.bulkOperation.id,
      errorLog: null,
    });

    return {
      shop,
      syncJob,
      bulkOperationId: payload.bulkOperation.id as string,
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
  const shop = await ensureShop(shopDomain);
  const admin = await getAdminForShop(shopDomain);

  const response = await admin.graphql(CURRENT_BULK_OPERATION_QUERY);
  const json = await response.json();
  const op = json.data?.currentBulkOperation;

  if (!op || (bulkOperationId && op.id !== bulkOperationId)) {
    if (!op?.url) {
      throw new Error("Bulk operation not ready or missing URL");
    }
  }

  if (op.status !== "COMPLETED" || !op.url) {
    throw new Error(`Bulk operation status: ${op.status}`);
  }

  const fileRes = await fetch(op.url);
  const text = await fileRes.text();
  const products = parseBulkJsonlProducts(text.split("\n"));

  const limits = await enforcePlanLimits(shop.id);
  const productLimit = limits.productLimit;
  const truncated = products.length > productLimit;
  const toIngest = truncated ? products.slice(0, productLimit) : products;

  let upserted = 0;
  for (const product of toIngest) {
    const { facet, collectionGids } = mapProductToFacet(shop.id, product);
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
        inventoryLocations: facet.inventoryLocations,
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
    for (const collection of collections) {
      await rebuildCollection(shopDomain, collection.collectionGid);
    }
  } catch (error) {
    log.error("Post-ingest collection order sync failed", error);
  }

  try {
    await syncShopMarketPrices(admin, shop.id);
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

  return { upserted, truncated, productLimit };
}

export async function upsertProduct(shopDomain: string, productGid: string) {
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
  const product = json.data?.product;
  if (!product) {
    await deleteProduct(shopDomain, productGid);
    return;
  }

  const { facet, collectionGids } = mapProductToFacet(shop.id, product);
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
      inventoryLocations: facet.inventoryLocations,
      status: facet.status,
        imageUrl: facet.imageUrl,
        variantImages: facet.variantImages,
        variants: facet.variants,
        metafields: facet.metafields,
        variantMetafields: facet.variantMetafields,
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

  try {
    await syncProductMarketPrices(admin, shop.id, facet.productGid);
  } catch (error) {
    log.error("Incremental market prices sync failed", error);
  }

  await setSyncStatus(shop.id, {
    status: "READY",
    lastIncrementalSyncAt: new Date(),
  });
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
}

export async function rebuildCollection(
  shopDomain: string,
  collectionGid: string,
) {
  const shop = await ensureShop(shopDomain);
  const admin = await getAdminForShop(shopDomain);

  const productGids: string[] = [];
  let cursor: string | null = null;
  let hasNext = true;
  let title = "";
  let handle = "";

  while (hasNext) {
    const response = await admin.graphql(COLLECTION_PRODUCTS_QUERY, {
      variables: { id: collectionGid, cursor },
    });
    const json = await response.json();
    const collection = json.data?.collection;
    if (!collection) {
      // Deleted collection
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
      return { count: 0, deleted: true as const };
    }

    title = collection.title ?? title;
    handle = collection.handle ?? handle;

    for (const edge of collection.products.edges) {
      productGids.push(edge.node.id);
    }
    hasNext = collection.products.pageInfo.hasNextPage;
    cursor = collection.products.pageInfo.endCursor;
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
      await upsertProduct(shopDomain, productGid);
    }
  }

  await setSyncStatus(shop.id, {
    status: "READY",
    lastIncrementalSyncAt: new Date(),
  });

  return { count: productGids.length };
}
