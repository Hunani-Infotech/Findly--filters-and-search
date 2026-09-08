/**
 * C14 gate: numeric RANGE metafield sliders besides price (+ custom bounds).
 * Usage: npm run verify:c14
 */
import "tsx/esm";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createPrismaClient } from "./prisma-runtime.mjs";
import { log } from "./terminal-log.mjs";
import { seedFilterConfig } from "./seed-filter-config.mjs";

const SHOP_DOMAIN = "c14-verify.myshopify.com";
const COLLECTION_GID = "gid://shopify/Collection/9140014";
const SHORT_GID = "gid://shopify/Product/91400141";
const LONG_GID = "gid://shopify/Product/91400142";
const LENGTH_KEY = "mf_custom_length";

const prisma = createPrismaClient();

function fail(message) {
  throw new Error(message);
}

function readRepo(...relParts) {
  const root = path.dirname(fileURLToPath(import.meta.url));
  return fs.readFileSync(path.join(root, "..", ...relParts), "utf8");
}

function payloadFacets(result) {
  return result.data?.facets ?? [];
}

function handles(result) {
  return (result.data?.products ?? []).map((p) => p.handle).sort();
}

function findFacet(facets, predicate) {
  return facets.find(predicate);
}

function assertStaticMarkers() {
  const widgetJs = readRepo(
    "extensions",
    "smart-filter",
    "assets",
    "smart-filter.js",
  );
  if (!widgetJs.includes("renderPriceFacet")) {
    fail("smart-filter.js must include renderPriceFacet");
  }
  if (!widgetJs.includes('facet.type === "price_range"')) {
    fail("smart-filter.js must chip RANGE metafields as a single range");
  }
  log.info("smart-filter.js reuses price slider UX for RANGE facets");

  const collectionsPage = readRepo("app", "routes", "app.collections.$id.tsx");
  if (!collectionsPage.includes("rangeBounds")) {
    fail("app.collections.$id.tsx must persist rangeBounds");
  }
  if (!collectionsPage.includes("NumericRangeBounds")) {
    fail("app.collections.$id.tsx must include NumericRangeBounds");
  }
  log.info("collection admin includes RANGE slider bounds");
}

async function cleanup() {
  await prisma.shop.deleteMany({ where: { domain: SHOP_DOMAIN } });
}

async function seedShopData() {
  const shop = await prisma.shop.upsert({
    where: { domain: SHOP_DOMAIN },
    create: { domain: SHOP_DOMAIN, plan: "free" },
    update: { uninstalledAt: null, plan: "free" },
  });

  await seedFilterConfig(prisma, shop.id, {
    collectionGid: COLLECTION_GID,
    enabled: true,
    enablePrice: true,
    rangeBounds: {
      [LENGTH_KEY]: { mode: "custom", min: 0, max: 100 },
    },
  });

  await prisma.collection.upsert({
    where: {
      shopId_collectionGid: { shopId: shop.id, collectionGid: COLLECTION_GID },
    },
    create: {
      shopId: shop.id,
      collectionGid: COLLECTION_GID,
      title: "C14 Length Collection",
      handle: "c14-length",
    },
    update: { title: "C14 Length Collection" },
  });

  const products = [
    {
      productGid: SHORT_GID,
      handle: "c14-short-ruler",
      title: "Short ruler",
      length: "12",
      price: 10,
    },
    {
      productGid: LONG_GID,
      handle: "c14-long-ruler",
      title: "Long ruler",
      length: "80",
      price: 40,
    },
  ];

  for (const product of products) {
    await prisma.productFacet.upsert({
      where: {
        shopId_productGid: { shopId: shop.id, productGid: product.productGid },
      },
      create: {
        shopId: shop.id,
        productGid: product.productGid,
        handle: product.handle,
        title: product.title,
        vendor: "Acme",
        productType: "Tools",
        tags: [],
        options: {},
        priceMin: product.price,
        priceMax: product.price,
        available: true,
        status: "ACTIVE",
        metafields: { "custom.length": product.length },
      },
      update: {
        handle: product.handle,
        title: product.title,
        priceMin: product.price,
        priceMax: product.price,
        available: true,
        status: "ACTIVE",
        metafields: { "custom.length": product.length },
      },
    });

    await prisma.collectionMembership.upsert({
      where: {
        shopId_collectionGid_productGid: {
          shopId: shop.id,
          collectionGid: COLLECTION_GID,
          productGid: product.productGid,
        },
      },
      create: {
        shopId: shop.id,
        collectionGid: COLLECTION_GID,
        productGid: product.productGid,
      },
      update: {},
    });
  }

  await prisma.metafieldMapping.upsert({
    where: {
      shopId_namespace_key_ownerType: {
        shopId: shop.id,
        namespace: "custom",
        key: "length",
        ownerType: "PRODUCT",
      },
    },
    create: {
      shopId: shop.id,
      namespace: "custom",
      key: "length",
      displayLabel: "Length",
      filterType: "RANGE",
      enabled: true,
      sortOrder: 0,
    },
    update: {
      displayLabel: "Length",
      filterType: "RANGE",
      enabled: true,
    },
  });

  return shop;
}

try {
  await cleanup();
  const shop = await seedShopData();
  log.info(`Seeded shop ${SHOP_DOMAIN} (id=${shop.id})`);

  assertStaticMarkers();

  const { getCollectionFilterPayload } = await import("../app/services/proxy.server.ts");

  const unfiltered = await getCollectionFilterPayload({
    shopDomain: SHOP_DOMAIN,
    collectionGid: COLLECTION_GID,
    selected: {},
  });
  if (unfiltered.error || !unfiltered.data?.enabled) {
    fail(
      `getCollectionFilterPayload failed: ${unfiltered.error ?? "filters disabled or empty payload"}`,
    );
  }

  const facets = payloadFacets(unfiltered);

  const priceFacet = findFacet(
    facets,
    (facet) => facet.source === "price" || facet.key === "price",
  );
  if (!priceFacet) fail("payload missing price facet");
  if (priceFacet.type !== "range" && priceFacet.displayType !== "slider") {
    fail(
      `price facet should be a slider, got type=${priceFacet.type} displayType=${priceFacet.displayType}`,
    );
  }
  log.info("price slider present");

  const lengthFacet = findFacet(
    facets,
    (facet) => facet.key === LENGTH_KEY || facet.label === "Length",
  );
  if (!lengthFacet) fail("payload missing Length RANGE facet");
  if (lengthFacet.type !== "range") {
    fail(`Length type expected range, got ${JSON.stringify(lengthFacet.type)}`);
  }
  if (lengthFacet.displayType !== "slider") {
    fail(
      `Length displayType expected slider, got ${JSON.stringify(lengthFacet.displayType)}`,
    );
  }
  if (lengthFacet.range?.min !== 0 || lengthFacet.range?.max !== 100) {
    fail(
      `Length custom bounds expected 0–100, got ${JSON.stringify(lengthFacet.range)}`,
    );
  }
  log.info("Length slider uses custom merchant bounds 0–100");

  const filtered = await getCollectionFilterPayload({
    shopDomain: SHOP_DOMAIN,
    collectionGid: COLLECTION_GID,
    selected: { [LENGTH_KEY]: ["0", "20"] },
  });
  const filteredHandles = handles(filtered);
  if (!filteredHandles.includes("c14-short-ruler")) {
    fail("length 0–20 should keep the short ruler");
  }
  if (filteredHandles.includes("c14-long-ruler")) {
    fail("length 0–20 should exclude the long ruler (80)");
  }
  log.info("Length slider filters products");

  const persistedJoin = await prisma.filterTreeCollection.findFirst({
    where: { shopId: shop.id, collectionGid: COLLECTION_GID },
    include: { tree: true },
  });
  const persisted = persistedJoin?.tree;
  const bounds =
    persisted?.rangeBounds &&
    typeof persisted.rangeBounds === "object" &&
    !Array.isArray(persisted.rangeBounds)
      ? persisted.rangeBounds
      : {};
  const lengthBounds = bounds[LENGTH_KEY];
  if (!lengthBounds || lengthBounds.mode !== "custom") {
    fail(
      `persisted rangeBounds.${LENGTH_KEY}.mode expected custom, got ${JSON.stringify(lengthBounds)}`,
    );
  }
  log.info("filterConfig.rangeBounds persisted");

  log.success("STEPC14_OK numeric range sliders besides price");
} catch (error) {
  log.error(`STEPC14_FAIL ${error.message}`);
  if (error.stack) console.error(error.stack);
  process.exitCode = 1;
} finally {
  try {
    await cleanup();
    log.info(`Cleaned up shop ${SHOP_DOMAIN}`);
  } catch (cleanupError) {
    log.warn(`Cleanup failed for ${SHOP_DOMAIN}: ${cleanupError.message}`);
  }
  await prisma.$disconnect();
}
