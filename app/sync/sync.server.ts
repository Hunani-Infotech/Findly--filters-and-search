import prisma from "../db.server";
import { enforcePlanLimits } from "../billing.server";
import { purgeShopData } from "../compliance.server";
import { log } from "../log.server";
import { ensureShop } from "../shop.server";
import {
  BULK_PRODUCTS_MUTATION,
  COLLECTION_PRODUCTS_QUERY,
  COLLECTIONS_LIST_QUERY,
  CURRENT_BULK_OPERATION_QUERY,
  PRODUCT_NODE_QUERY,
} from "./graphql";
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
) {
  for (const [path, sampleValue] of Object.entries(metafields)) {
    const dot = path.indexOf(".");
    if (dot <= 0) continue;
    const namespace = path.slice(0, dot);
    const key = path.slice(dot + 1);
    if (!namespace || !key) continue;

    await prisma.discoveredMetafield.upsert({
      where: {
        shopId_namespace_key: { shopId, namespace, key },
      },
      create: {
        shopId,
        namespace,
        key,
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

    const response = await admin.graphql(BULK_PRODUCTS_MUTATION);
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
        options: facet.options as object,
        priceMin: facet.priceMin,
        priceMax: facet.priceMax,
        available: facet.available,
        imageUrl: facet.imageUrl,
        metafields: facet.metafields as object,
      },
    });

    await recordDiscoveredMetafields(
      shop.id,
      (facet.metafields as Record<string, string>) || {},
    );

    await prisma.collectionMembership.deleteMany({
      where: { shopId: shop.id, productGid: facet.productGid },
    });
    if (collectionGids.length) {
      await prisma.collectionMembership.createMany({
        data: collectionGids.map((collectionGid) => ({
          shopId: shop.id,
          collectionGid,
          productGid: facet.productGid,
        })),
        skipDuplicates: true,
      });
    }
    upserted += 1;
  }

  try {
    await syncCollectionsList(shopDomain);
  } catch (error) {
    log.error("Post-ingest collection sync failed", error);
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
      options: facet.options,
      priceMin: facet.priceMin,
      priceMax: facet.priceMax,
      available: facet.available,
      imageUrl: facet.imageUrl,
      metafields: facet.metafields,
    },
  });

  await recordDiscoveredMetafields(
    shop.id,
    (facet.metafields as Record<string, string>) || {},
  );

  await prisma.collectionMembership.deleteMany({
    where: { shopId: shop.id, productGid: facet.productGid },
  });
  if (collectionGids.length) {
    await prisma.collectionMembership.createMany({
      data: collectionGids.map((collectionGid) => ({
        shopId: shop.id,
        collectionGid,
        productGid: facet.productGid,
      })),
      skipDuplicates: true,
    });
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
      data: productGids.map((productGid) => ({
        shopId: shop.id,
        collectionGid,
        productGid,
      })),
      skipDuplicates: true,
    });
  }

  await setSyncStatus(shop.id, {
    status: "READY",
    lastIncrementalSyncAt: new Date(),
  });

  return { count: productGids.length };
}
