/**
 * C1 gate: BOOLEAN metafield dedicated Yes/No UI + filtering.
 * Usage: node ./scripts/verify-c1.mjs
 */
import "tsx/esm";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { log } from "./terminal-log.mjs";

const SHOP_DOMAIN = "c1-verify.myshopify.com";
const COLLECTION_GID = "gid://shopify/Collection/9303001";
const WATERPROOF_FACET_KEY = "mf_custom_waterproof";
const PRODUCT_JACKET = "gid://shopify/Product/9303001";
const PRODUCT_TEE = "gid://shopify/Product/9303002";
const PRODUCT_TRUTHY = "gid://shopify/Product/9303003";

const prisma = new PrismaClient();

function fail(message) {
  throw new Error(message);
}

function titles(result) {
  return (result.data?.products ?? []).map((p) => p.title).sort();
}

function findWaterproofFacet(facets) {
  return (facets ?? []).find(
    (facet) =>
      typeof facet.key === "string" && facet.key.includes("waterproof"),
  );
}

function assertThemeBooleanPath() {
  const root = path.dirname(fileURLToPath(import.meta.url));
  const widgetPath = path.join(
    root,
    "..",
    "extensions",
    "smart-filter",
    "assets",
    "smart-filter.js",
  );
  const widgetJs = fs.readFileSync(widgetPath, "utf8");
  if (
    !widgetJs.includes('type === "boolean"') &&
    !widgetJs.includes("type === 'boolean'") &&
    !widgetJs.includes('facet.type === "boolean"') &&
    !widgetJs.includes("facet.type === 'boolean'")
  ) {
    fail(
      'storefront smart-filter.js missing dedicated boolean render path (type === "boolean")',
    );
  }
  log.info("storefront smart-filter.js has boolean render path");
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

  await prisma.filterConfig.upsert({
    where: {
      shopId_collectionGid: { shopId: shop.id, collectionGid: COLLECTION_GID },
    },
    create: {
      shopId: shop.id,
      collectionGid: COLLECTION_GID,
      enabled: true,
      enablePrice: false,
      enableAvailability: false,
      enableVendor: false,
      enableProductType: false,
      enableTags: false,
      enableOptions: false,
    },
    update: {
      enabled: true,
      enablePrice: false,
      enableAvailability: false,
      enableVendor: false,
      enableProductType: false,
      enableTags: false,
      enableOptions: false,
    },
  });

  await prisma.collection.upsert({
    where: {
      shopId_collectionGid: { shopId: shop.id, collectionGid: COLLECTION_GID },
    },
    create: {
      shopId: shop.id,
      collectionGid: COLLECTION_GID,
      title: "C1 Verify Collection",
      handle: "c1-verify",
    },
    update: { title: "C1 Verify Collection" },
  });

  const products = [
    {
      productGid: PRODUCT_JACKET,
      handle: "c1-waterproof-jacket",
      title: "C1 Waterproof Jacket",
      metafields: { "custom.waterproof": "true" },
    },
    {
      productGid: PRODUCT_TEE,
      handle: "c1-cotton-tee",
      title: "C1 Cotton Tee",
      metafields: { "custom.waterproof": "false" },
    },
    {
      productGid: PRODUCT_TRUTHY,
      handle: "c1-truthy-shell",
      title: "C1 Truthy Shell",
      metafields: { "custom.waterproof": "1" },
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
        vendor: "C1 Labs",
        productType: "Apparel",
        tags: ["c1-verify"],
        options: {},
        priceMin: 29.99,
        priceMax: 29.99,
        available: true,
        status: "ACTIVE",
        metafields: product.metafields,
      },
      update: {
        handle: product.handle,
        title: product.title,
        status: "ACTIVE",
        metafields: product.metafields,
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
          key: "waterproof",
          ownerType: "PRODUCT",
        },
    },
    create: {
      shopId: shop.id,
      namespace: "custom",
      key: "waterproof",
      displayLabel: "Waterproof",
      filterType: "BOOLEAN",
      enabled: true,
      sortOrder: 0,
    },
    update: {
      displayLabel: "Waterproof",
      filterType: "BOOLEAN",
      enabled: true,
      sortOrder: 0,
    },
  });

  return shop;
}

try {
  await cleanup();
  const shop = await seedShopData();
  log.info(`Seeded shop ${SHOP_DOMAIN} (id=${shop.id})`);

  assertThemeBooleanPath();

  const { getCollectionFilterPayload } = await import("../app/proxy.server.ts");

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

  const waterproofFacet = findWaterproofFacet(unfiltered.data.facets);
  if (!waterproofFacet) {
    fail("filter payload missing waterproof metafield facet");
  }
  if (waterproofFacet.key !== WATERPROOF_FACET_KEY) {
    fail(
      `waterproof facet key expected ${WATERPROOF_FACET_KEY}, got ${waterproofFacet.key}`,
    );
  }
  if (waterproofFacet.type !== "boolean") {
    fail(
      `waterproof facet type expected boolean (not checkbox), got ${waterproofFacet.type}`,
    );
  }

  const facetValues = waterproofFacet.values ?? [];
  const valueStrings = facetValues.map((item) => item.value).sort();
  if (valueStrings.join(",") !== "false,true") {
    fail(
      `boolean facet values expected exactly true and false, got ${JSON.stringify(facetValues)}`,
    );
  }

  const trueOpt = facetValues.find((item) => item.value === "true");
  const falseOpt = facetValues.find((item) => item.value === "false");
  if (!trueOpt || trueOpt.label !== "Yes") {
    fail(
      `true option label expected Yes, got ${JSON.stringify(trueOpt)}`,
    );
  }
  if (!falseOpt || falseOpt.label !== "No") {
    fail(
      `false option label expected No, got ${JSON.stringify(falseOpt)}`,
    );
  }
  if (trueOpt == null || falseOpt == null) {
    fail("both Yes and No options must be present even if counts differ");
  }
  log.info(`waterproof boolean facet: ${JSON.stringify(waterproofFacet)}`);

  const selectedTrue = await getCollectionFilterPayload({
    shopDomain: SHOP_DOMAIN,
    collectionGid: COLLECTION_GID,
    selected: { [WATERPROOF_FACET_KEY]: ["true"] },
  });
  const trueTitles = titles(selectedTrue);
  const unexpectedTrue = trueTitles.filter(
    (title) => title !== "C1 Waterproof Jacket" && title !== "C1 Truthy Shell",
  );
  if (
    !trueTitles.includes("C1 Waterproof Jacket") ||
    !trueTitles.includes("C1 Truthy Shell") ||
    unexpectedTrue.length ||
    trueTitles.includes("C1 Cotton Tee")
  ) {
    fail(
      `selected true expected jacket + truthy shell, got ${JSON.stringify(selectedTrue.data?.products)}`,
    );
  }
  log.info(`selected true: ${JSON.stringify(trueTitles)}`);

  const selectedFalse = await getCollectionFilterPayload({
    shopDomain: SHOP_DOMAIN,
    collectionGid: COLLECTION_GID,
    selected: { [WATERPROOF_FACET_KEY]: ["false"] },
  });
  const falseTitles = titles(selectedFalse);
  if (falseTitles.length !== 1 || falseTitles[0] !== "C1 Cotton Tee") {
    fail(
      `selected false expected only C1 Cotton Tee, got ${JSON.stringify(selectedFalse.data?.products)}`,
    );
  }
  log.info("selected false filtered to C1 Cotton Tee");

  const selectedBoth = await getCollectionFilterPayload({
    shopDomain: SHOP_DOMAIN,
    collectionGid: COLLECTION_GID,
    selected: { [WATERPROOF_FACET_KEY]: ["true", "false"] },
  });
  const bothTitles = titles(selectedBoth);
  if (
    !bothTitles.includes("C1 Waterproof Jacket") ||
    !bothTitles.includes("C1 Cotton Tee") ||
    !bothTitles.includes("C1 Truthy Shell")
  ) {
    fail(
      `selected true+false (OR within facet) expected all three products, got ${JSON.stringify(selectedBoth.data?.products)}`,
    );
  }
  log.info(`selected true+false: ${JSON.stringify(bothTitles)}`);

  log.success("STEPC1_OK BOOLEAN metafield Yes/No UI and filtering");
} catch (error) {
  log.error(`STEPC1_FAIL ${error.message}`);
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
