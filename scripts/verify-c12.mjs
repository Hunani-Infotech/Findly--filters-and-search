/**
 * C12 gate: facet value order (auto / alphabetical / manual).
 * Usage: npm run verify:c12
 */
import "tsx/esm";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createPrismaClient } from "./prisma-runtime.mjs";
import { log } from "./terminal-log.mjs";
import { seedFilterConfig } from "./seed-filter-config.mjs";

const SHOP_DOMAIN = "c12-verify.myshopify.com";
const COLLECTION_GID = "gid://shopify/Collection/9812001";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const prisma = createPrismaClient();

function fail(message) {
  throw new Error(message);
}

function facetValues(result, key) {
  const facet = (result.data?.facets ?? []).find((item) => item.key === key);
  return (facet?.values ?? []).map((item) => item.value);
}

function assertStaticMarkers() {
  const schema = readFileSync(join(ROOT, "prisma/schema.prisma"), "utf8");
  const collections = readFileSync(
    join(ROOT, "app/routes/app.collections.$id.tsx"),
    "utf8",
  );
  const widget = readFileSync(
    join(ROOT, "extensions/smart-filter/assets/smart-filter.js"),
    "utf8",
  );
  if (!schema.includes("valueSort")) {
    fail("FilterConfig missing valueSort JSON");
  }
  if (!collections.includes("Filter value order") || !collections.includes("valueSort")) {
    fail("collection admin missing Filter value order / valueSort save");
  }
  if (!widget.includes("valueSortMode")) {
    fail("widget must honor valueSortMode and skip size heuristic when overridden");
  }
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
    enableVendor: true,
    enableOptions: true,
    enablePrice: false,
    enableAvailability: false,
    enableProductType: false,
    enableTags: false,
  });

  const products = [
    {
      productGid: "gid://shopify/Product/9812001",
      handle: "p-zebra",
      title: "Zebra Tee",
      vendor: "Zebra",
      options: { Size: ["XL"] },
    },
    {
      productGid: "gid://shopify/Product/9812002",
      handle: "p-acme",
      title: "Acme Tee",
      vendor: "Acme",
      options: { Size: ["S"] },
    },
    {
      productGid: "gid://shopify/Product/9812003",
      handle: "p-midland",
      title: "Midland Tee",
      vendor: "Midland",
      options: { Size: ["M"] },
    },
  ];

  let position = 0;
  for (const product of products) {
    await prisma.productFacet.upsert({
      where: {
        shopId_productGid: { shopId: shop.id, productGid: product.productGid },
      },
      create: {
        shopId: shop.id,
        ...product,
        productType: "Apparel",
        tags: [],
        skus: [],
        priceMin: 10,
        priceMax: 10,
        available: true,
        status: "ACTIVE",
        imageUrl: null,
        metafields: {},
      },
      update: {
        handle: product.handle,
        title: product.title,
        vendor: product.vendor,
        options: product.options,
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
        position: position++,
      },
      update: { position: position - 1 },
    });
  }

  return shop;
}

try {
  assertStaticMarkers();
  await cleanup();
  const shop = await seedShopData();
  log.info(`Seeded shop ${SHOP_DOMAIN}`);

  const { getCollectionFilterPayload } = await import("../app/services/proxy.server.ts");
  const { saveFilterConfig } = await import("../app/services/shop.server.ts");
  const { parseValueSort } = await import("../app/services/filters.server.ts");

  const autoPayload = await getCollectionFilterPayload({
    shopDomain: SHOP_DOMAIN,
    collectionGid: COLLECTION_GID,
    selected: {},
  });
  if ("error" in autoPayload) fail(autoPayload.error);
  const autoVendors = facetValues(autoPayload, "vendor");
  if (autoVendors.join(",") !== "Acme,Midland,Zebra") {
    fail(`auto vendor expected A–Z, got ${JSON.stringify(autoVendors)}`);
  }
  const autoSize = facetValues(autoPayload, "opt_Size");
  if (autoSize.join(",") !== "S,M,XL") {
    fail(`auto Size expected S,M,XL heuristic, got ${JSON.stringify(autoSize)}`);
  }
  log.info("auto: vendors A–Z, Size uses size heuristic");

  await saveFilterConfig(shop.id, {
    collectionGid: COLLECTION_GID,
    enableVendor: true,
    enableOptions: true,
    valueSort: parseValueSort({
      vendor: { mode: "manual", values: ["Zebra", "Acme", "Midland"] },
      opt_Size: { mode: "alpha" },
    }),
  });

  const manualPayload = await getCollectionFilterPayload({
    shopDomain: SHOP_DOMAIN,
    collectionGid: COLLECTION_GID,
    selected: {},
  });
  if ("error" in manualPayload) fail(manualPayload.error);
  const manualVendors = facetValues(manualPayload, "vendor");
  if (manualVendors.join(",") !== "Zebra,Acme,Midland") {
    fail(`manual vendor order expected Zebra,Acme,Midland, got ${JSON.stringify(manualVendors)}`);
  }
  const vendorFacet = (manualPayload.data?.facets ?? []).find((f) => f.key === "vendor");
  if (vendorFacet?.valueSortMode !== "manual") {
    fail(`vendor valueSortMode expected manual, got ${vendorFacet?.valueSortMode}`);
  }
  const alphaSize = facetValues(manualPayload, "opt_Size");
  if (alphaSize.join(",") !== "M,S,XL") {
    fail(`alpha Size expected M,S,XL, got ${JSON.stringify(alphaSize)}`);
  }
  log.info("manual vendor order persisted; Size alpha overrides heuristic");

  log.success("STEPC12_OK facet value sort auto/alpha/manual");
} catch (error) {
  log.error(`STEPC12_FAIL ${error.message}`);
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
