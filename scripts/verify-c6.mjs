/**
 * C6 gate: matching variant image after Color/Size filter.
 * Usage: node ./scripts/verify-c6.mjs
 */
import "tsx/esm";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { log } from "./terminal-log.mjs";
import { seedFilterConfig } from "./seed-filter-config.mjs";

const SHOP_DOMAIN = "c6-verify.myshopify.com";
const COLLECTION_GID = "gid://shopify/Collection/9606001";
const PRODUCT_GID = "gid://shopify/Product/9606001";
const FEATURED_IMAGE = "https://cdn.example.com/default.jpg";
const RED_PREFIX = "https://cdn.example.com/red";
const BLUE_S_IMAGE = "https://cdn.example.com/blue-s.jpg";

const prisma = new PrismaClient();

function fail(message) {
  throw new Error(message);
}

function readRepo(...relParts) {
  const root = path.dirname(fileURLToPath(import.meta.url));
  return fs.readFileSync(path.join(root, "..", ...relParts), "utf8");
}

function isEmptyVariantImage(url) {
  return url == null || url === "";
}

function findC6Product(result) {
  const products = result.data?.products ?? [];
  return products.find(
    (product) =>
      product.productGid === PRODUCT_GID ||
      product.handle === "c6-color-tee" ||
      product.title === "C6 Color Tee",
  );
}

function assertGraphqlVariantImages() {
  const graphql = readRepo("app", "sync", "graphql.ts");
  if (!graphql.includes("selectedOptions")) {
    fail("app/sync/graphql.ts must include selectedOptions on variants");
  }
  if (!graphql.includes("image")) {
    fail("app/sync/graphql.ts must include image on variants");
  }
  if (!graphql.includes("url")) {
    fail("app/sync/graphql.ts must include image { url } on variants");
  }
  log.info("graphql.ts includes selectedOptions and image { url } on variants");
}

function assertThemeApplyVariantImages() {
  const widgetJs = readRepo(
    "extensions",
    "smart-filter",
    "assets",
    "smart-filter.js",
  );
  if (!widgetJs.includes("applyVariantImages")) {
    fail("storefront smart-filter.js missing applyVariantImages");
  }
  log.info("storefront smart-filter.js has applyVariantImages");
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
    enableAvailability: true,
    enableVendor: true,
    enableProductType: true,
    enableTags: true,
    enableOptions: true,
  });

  await prisma.collection.upsert({
    where: {
      shopId_collectionGid: { shopId: shop.id, collectionGid: COLLECTION_GID },
    },
    create: {
      shopId: shop.id,
      collectionGid: COLLECTION_GID,
      title: "C6 Verify Collection",
      handle: "c6-verify",
    },
    update: { title: "C6 Verify Collection" },
  });

  const variantImages = [
    {
      options: { Color: "Red", Size: "S" },
      imageUrl: "https://cdn.example.com/red-s.jpg",
    },
    {
      options: { Color: "Red", Size: "M" },
      imageUrl: "https://cdn.example.com/red-m.jpg",
    },
    {
      options: { Color: "Blue", Size: "S" },
      imageUrl: "https://cdn.example.com/blue-s.jpg",
    },
  ];

  await prisma.productFacet.upsert({
    where: {
      shopId_productGid: { shopId: shop.id, productGid: PRODUCT_GID },
    },
    create: {
      shopId: shop.id,
      productGid: PRODUCT_GID,
      handle: "c6-color-tee",
      title: "C6 Color Tee",
      vendor: "C6 Labs",
      productType: "Apparel",
      tags: ["c6-verify"],
      options: { Color: ["Red", "Blue"], Size: ["S", "M"] },
      priceMin: 20,
      priceMax: 20,
      available: true,
      status: "ACTIVE",
      imageUrl: FEATURED_IMAGE,
      variantImages,
      metafields: {},
    },
    update: {
      handle: "c6-color-tee",
      title: "C6 Color Tee",
      options: { Color: ["Red", "Blue"], Size: ["S", "M"] },
      priceMin: 20,
      priceMax: 20,
      available: true,
      status: "ACTIVE",
      imageUrl: FEATURED_IMAGE,
      variantImages,
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

  assertGraphqlVariantImages();
  assertThemeApplyVariantImages();

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

  const featured = findC6Product(unfiltered);
  if (!featured) {
    fail("unfiltered payload missing C6 Color Tee");
  }
  if (featured.imageUrl !== FEATURED_IMAGE) {
    fail(
      `unfiltered imageUrl expected ${FEATURED_IMAGE}, got ${JSON.stringify(featured.imageUrl)}`,
    );
  }
  if (!isEmptyVariantImage(featured.variantImageUrl)) {
    fail(
      `unfiltered variantImageUrl expected empty, got ${JSON.stringify(featured.variantImageUrl)}`,
    );
  }
  log.info("unfiltered: featured default.jpg, no variantImageUrl");

  const selectedRed = await getCollectionFilterPayload({
    shopDomain: SHOP_DOMAIN,
    collectionGid: COLLECTION_GID,
    selected: { opt_Color: ["Red"] },
  });
  const redProduct = findC6Product(selectedRed);
  if (!redProduct) {
    fail("Color=Red payload missing C6 Color Tee");
  }
  const redUrl = redProduct.variantImageUrl;
  if (typeof redUrl !== "string" || !redUrl.startsWith(RED_PREFIX)) {
    fail(
      `Color=Red variantImageUrl expected to start with ${RED_PREFIX}, got ${JSON.stringify(redUrl)}`,
    );
  }
  log.info(`Color=Red variantImageUrl: ${redUrl}`);

  const selectedBlue = await getCollectionFilterPayload({
    shopDomain: SHOP_DOMAIN,
    collectionGid: COLLECTION_GID,
    selected: { opt_Color: ["Blue"] },
  });
  const blueProduct = findC6Product(selectedBlue);
  if (!blueProduct) {
    fail("Color=Blue payload missing C6 Color Tee");
  }
  if (blueProduct.variantImageUrl !== BLUE_S_IMAGE) {
    fail(
      `Color=Blue variantImageUrl expected ${BLUE_S_IMAGE}, got ${JSON.stringify(blueProduct.variantImageUrl)}`,
    );
  }
  log.info("Color=Blue variantImageUrl: blue-s.jpg");

  log.success("STEPC6_OK matching variant image after Color/Size filter");
} catch (error) {
  log.error(`STEPC6_FAIL ${error.message}`);
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
