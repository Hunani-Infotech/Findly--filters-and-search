/**
 * C10 gate: merchant display types (checkbox / dropdown / list / slider / swatch).
 * Usage: node ./scripts/verify-c10.mjs
 */
import "tsx/esm";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { log } from "./terminal-log.mjs";
import { seedFilterConfig } from "./seed-filter-config.mjs";

const SHOP_DOMAIN = "c10-verify.myshopify.com";
const COLLECTION_GID = "gid://shopify/Collection/9707001";
const PRODUCT_GID = "gid://shopify/Product/9707001";

const DISPLAY_TYPES = {
  vendor: "checkbox",
  productType: "dropdown",
  tags: "list",
  price: "slider",
  options: "swatch",
  mf_custom_material: "dropdown",
  mf_custom_weight: "slider",
};

const prisma = new PrismaClient();

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

function findFacet(facets, predicate) {
  return facets.find(predicate);
}

function assertDisplayType(facet, expected, label) {
  if (!facet) {
    fail(`unfiltered payload missing ${label} facet`);
  }
  if (facet.displayType !== expected) {
    fail(
      `${label} displayType expected ${JSON.stringify(expected)}, got ${JSON.stringify(facet.displayType)}`,
    );
  }
}

function assertStaticMarkers() {
  const widgetJs = readRepo(
    "extensions",
    "smart-filter",
    "assets",
    "smart-filter.js",
  );
  if (!widgetJs.includes("dropdown")) {
    fail('smart-filter.js must include "dropdown"');
  }
  if (!widgetJs.includes("swatch-text")) {
    fail('smart-filter.js must include "swatch-text"');
  }
  log.info('smart-filter.js includes "dropdown" and "swatch-text"');

  const collectionsPage = readRepo("app", "routes", "app.collections.$id.tsx");
  if (!collectionsPage.includes("displayTypes")) {
    fail("app/routes/app.collections.$id.tsx must include displayTypes");
  }
  log.info("app.collections.$id.tsx includes displayTypes");
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
    enableProductType: true,
    enableTags: true,
    enablePrice: true,
    enableOptions: true,
    displayTypes: DISPLAY_TYPES,
  });

  await prisma.collection.upsert({
    where: {
      shopId_collectionGid: { shopId: shop.id, collectionGid: COLLECTION_GID },
    },
    create: {
      shopId: shop.id,
      collectionGid: COLLECTION_GID,
      title: "C10 Verify Collection",
      handle: "c10-verify",
    },
    update: { title: "C10 Verify Collection" },
  });

  await prisma.productFacet.upsert({
    where: {
      shopId_productGid: { shopId: shop.id, productGid: PRODUCT_GID },
    },
    create: {
      shopId: shop.id,
      productGid: PRODUCT_GID,
      handle: "c10-tee",
      title: "C10 Tee",
      vendor: "Acme",
      productType: "Apparel",
      tags: ["sale"],
      options: { Color: ["Red", "Blue"] },
      priceMin: 25,
      priceMax: 25,
      available: true,
      status: "ACTIVE",
      metafields: { "custom.material": "Cotton", "custom.weight": "12" },
    },
    update: {
      handle: "c10-tee",
      title: "C10 Tee",
      vendor: "Acme",
      productType: "Apparel",
      tags: ["sale"],
      options: { Color: ["Red", "Blue"] },
      priceMin: 25,
      priceMax: 25,
      available: true,
      status: "ACTIVE",
      metafields: { "custom.material": "Cotton", "custom.weight": "12" },
    },
  });

  await prisma.metafieldMapping.upsert({
    where: {
      shopId_namespace_key_ownerType: {
        shopId: shop.id,
        namespace: "custom",
        key: "material",
        ownerType: "PRODUCT",
      },
    },
    create: {
      shopId: shop.id,
      namespace: "custom",
      key: "material",
      displayLabel: "Material",
      filterType: "LIST",
      enabled: true,
      sortOrder: 0,
    },
    update: {
      displayLabel: "Material",
      filterType: "LIST",
      enabled: true,
    },
  });

  await prisma.metafieldMapping.upsert({
    where: {
      shopId_namespace_key_ownerType: {
        shopId: shop.id,
        namespace: "custom",
        key: "weight",
        ownerType: "PRODUCT",
      },
    },
    create: {
      shopId: shop.id,
      namespace: "custom",
      key: "weight",
      displayLabel: "Weight",
      filterType: "RANGE",
      enabled: true,
      sortOrder: 1,
    },
    update: {
      displayLabel: "Weight",
      filterType: "RANGE",
      enabled: true,
    },
  });

  await prisma.collectionMembership.upsert({
    where: {
      shopId_collectionGid_productGid: {
        shopId: shop.id,
        collectionGid: COLLECTION_GID,
        productGid: PRODUCT_GID,
      },
    },
    create: {
      shopId: shop.id,
      collectionGid: COLLECTION_GID,
      productGid: PRODUCT_GID,
    },
    update: {},
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

  const vendorFacet = findFacet(
    facets,
    (facet) => facet.source === "vendor" || facet.key === "vendor",
  );
  assertDisplayType(vendorFacet, "checkbox", "vendor");
  log.info("vendor displayType=checkbox");

  const productTypeFacet = findFacet(
    facets,
    (facet) => facet.source === "productType" || facet.key === "productType",
  );
  assertDisplayType(productTypeFacet, "dropdown", "productType");
  log.info("productType displayType=dropdown");

  const tagsFacet = findFacet(
    facets,
    (facet) =>
      facet.source === "tag" || facet.key === "tag" || facet.key === "tags",
  );
  assertDisplayType(tagsFacet, "list", "tag/tags");
  log.info("tag/tags displayType=list");

  const priceFacet = findFacet(
    facets,
    (facet) => facet.source === "price" || facet.key === "price",
  );
  assertDisplayType(priceFacet, "slider", "price");
  log.info("price displayType=slider");

  const colorFacet = findFacet(
    facets,
    (facet) =>
      (typeof facet.key === "string" && facet.key.includes("Color")) ||
      facet.label === "Color",
  );
  assertDisplayType(colorFacet, "swatch", "Color option");
  log.info("Color option displayType=swatch");

  const materialFacet = findFacet(
    facets,
    (facet) =>
      facet.key === "mf_custom_material" || facet.label === "Material",
  );
  assertDisplayType(materialFacet, "dropdown", "Material metafield");
  log.info("Material metafield displayType=dropdown");

  const weightFacet = findFacet(
    facets,
    (facet) => facet.key === "mf_custom_weight" || facet.label === "Weight",
  );
  assertDisplayType(weightFacet, "slider", "Weight metafield");
  log.info("Weight metafield displayType=slider");

  const reloadedJoin = await prisma.filterTreeCollection.findFirst({
    where: { shopId: shop.id, collectionGid: COLLECTION_GID },
    include: { tree: true },
  });
  const reloaded = reloadedJoin?.tree;
  const persisted =
    reloaded?.displayTypes &&
    typeof reloaded.displayTypes === "object" &&
    !Array.isArray(reloaded.displayTypes)
      ? reloaded.displayTypes
      : {};
  if (persisted.vendor !== "checkbox") {
    fail(
      `persisted displayTypes.vendor expected "checkbox", got ${JSON.stringify(persisted.vendor)}`,
    );
  }
  log.info("filterConfig.displayTypes.vendor persisted as checkbox");

  log.success("STEPC10_OK merchant display types");
} catch (error) {
  log.error(`STEPC10_FAIL ${error.message}`);
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
