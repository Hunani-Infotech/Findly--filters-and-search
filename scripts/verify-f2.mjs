/**
 * F2 gate: variants as separate collection cards.
 * Usage: npm run verify:f2
 */
import "tsx/esm";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { log } from "./terminal-log.mjs";
import { seedFilterConfig } from "./seed-filter-config.mjs";

const SHOP_DOMAIN = "f2-verify.myshopify.com";
const COLLECTION_GID = "gid://shopify/Collection/9202001";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const prisma = new PrismaClient();

function fail(message) {
  throw new Error(message);
}

function readRepo(...parts) {
  return readFileSync(join(ROOT, ...parts), "utf8");
}

function assertStaticMarkers() {
  const schema = readRepo("prisma", "schema.prisma");
  if (
    !schema.includes("enableVariantsAsProducts") ||
    !schema.includes("variantAsProductOptions")
  ) {
    fail("schema missing enableVariantsAsProducts / variantAsProductOptions");
  }
  if (!/model ProductFacet[\s\S]*variants\s+Json/.test(schema)) {
    fail("ProductFacet missing variants JSON");
  }
  const editor = readRepo("app", "routes", "app.filters.$id.tsx");
  if (
    !editor.includes("Show variants as separate products") ||
    !editor.includes("enableVariantsAsProducts")
  ) {
    fail("filter tree editor missing F2 toggle");
  }
  const widget = readRepo(
    "extensions",
    "smart-filter",
    "assets",
    "smart-filter.js",
  );
  if (
    !widget.includes("cloneVariantCard") ||
    !widget.includes("data-sf-card-key")
  ) {
    fail("smart-filter.js missing variant card cloning");
  }
  log.info("F2 static markers present");
}

async function cleanup() {
  await prisma.shop.deleteMany({ where: { domain: SHOP_DOMAIN } });
}

try {
  await cleanup();
  assertStaticMarkers();

  const { expandProductsAsVariants, variantCardKey } = await import(
    "../app/variants-as-products.ts"
  );
  const threeColor = expandProductsAsVariants(
    [
      {
        productGid: "gid://shopify/Product/1",
        handle: "tee",
        title: "Classic Tee",
        vendor: "Acme",
        productType: "Apparel",
        tags: [],
        options: { Color: ["Red", "Blue", "Green"] },
        priceMin: 10,
        priceMax: 12,
        available: true,
        status: "ACTIVE",
        imageUrl: null,
        metafields: {},
        variants: [
          {
            id: "gid://shopify/ProductVariant/11",
            sku: "R",
            title: "Red",
            options: { Color: "Red" },
            imageUrl: "https://cdn.example/red.jpg",
            available: true,
            price: 10,
          },
          {
            id: "gid://shopify/ProductVariant/12",
            sku: "B",
            title: "Blue",
            options: { Color: "Blue" },
            imageUrl: "https://cdn.example/blue.jpg",
            available: true,
            price: 11,
          },
          {
            id: "gid://shopify/ProductVariant/13",
            sku: "G",
            title: "Green",
            options: { Color: "Green" },
            imageUrl: "https://cdn.example/green.jpg",
            available: false,
            price: 12,
          },
        ],
      },
    ],
    ["Color"],
  );
  if (threeColor.length !== 3) {
    fail(`3-color product should expand to 3 cards, got ${threeColor.length}`);
  }
  if (!threeColor.some((row) => row.title.includes("Blue"))) {
    fail("expanded cards should include the Blue variant title");
  }
  if (variantCardKey("Tee", "gid://shopify/ProductVariant/12") !== "tee::12") {
    fail("variantCardKey should use handle + numeric variant id");
  }

  const shop = await prisma.shop.create({
    data: { domain: SHOP_DOMAIN, plan: "free" },
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
    enableSale: false,
    enableRating: false,
    enableVariantsAsProducts: true,
    variantAsProductOptions: ["Color"],
  });

  await prisma.productFacet.create({
    data: {
      shopId: shop.id,
      productGid: "gid://shopify/Product/92020011",
      handle: "classic-tee",
      title: "Classic Tee",
      vendor: "Acme",
      productType: "Apparel",
      tags: [],
      options: { Color: ["Red", "Blue", "Green"] },
      priceMin: 20,
      priceMax: 20,
      available: true,
      status: "ACTIVE",
      imageUrl: "https://cdn.example/tee.jpg",
      metafields: {},
      variants: [
        {
          id: "gid://shopify/ProductVariant/920200111",
          sku: "TEE-RED",
          title: "Red",
          options: { Color: "Red" },
          imageUrl: "https://cdn.example/red.jpg",
          available: true,
          price: 20,
        },
        {
          id: "gid://shopify/ProductVariant/920200112",
          sku: "TEE-BLUE",
          title: "Blue",
          options: { Color: "Blue" },
          imageUrl: "https://cdn.example/blue.jpg",
          available: true,
          price: 20,
        },
        {
          id: "gid://shopify/ProductVariant/920200113",
          sku: "TEE-GREEN",
          title: "Green",
          options: { Color: "Green" },
          imageUrl: "https://cdn.example/green.jpg",
          available: true,
          price: 20,
        },
      ],
    },
  });
  await prisma.collectionMembership.create({
    data: {
      shopId: shop.id,
      collectionGid: COLLECTION_GID,
      productGid: "gid://shopify/Product/92020011",
      position: 0,
    },
  });

  const { getCollectionFilterPayload } = await import("../app/proxy.server.ts");
  const on = await getCollectionFilterPayload({
    shopDomain: SHOP_DOMAIN,
    collectionGid: COLLECTION_GID,
    selected: {},
  });
  const products = on.data?.products ?? [];
  if (products.length !== 3) {
    fail(`collection payload should return 3 variant cards, got ${products.length}`);
  }
  const keys = products.map((p) => p.cardKey).sort();
  if (!keys[0] || !String(keys[0]).includes("::")) {
    fail(`variant cards need cardKey with ::, got ${keys.join(",")}`);
  }
  if (on.data?.settings?.enableVariantsAsProducts !== true) {
    fail("payload settings.enableVariantsAsProducts should be true");
  }

  const redOnly = await getCollectionFilterPayload({
    shopDomain: SHOP_DOMAIN,
    collectionGid: COLLECTION_GID,
    selected: { opt_Color: ["Red"] },
  });
  const redTitles = (redOnly.data?.products ?? []).map((p) => p.title);
  if (redTitles.length !== 1 || !String(redTitles[0]).includes("Red")) {
    fail(`Color=Red should keep one Red card, got ${redTitles.join(",")}`);
  }

  await prisma.filterConfig.updateMany({
    where: { shopId: shop.id },
    data: { enableVariantsAsProducts: false },
  });
  const off = await getCollectionFilterPayload({
    shopDomain: SHOP_DOMAIN,
    collectionGid: COLLECTION_GID,
    selected: {},
  });
  if ((off.data?.products ?? []).length !== 1) {
    fail(
      `toggle off should return 1 product card, got ${(off.data?.products ?? []).length}`,
    );
  }

  log.info("STEPF2_OK");
} catch (error) {
  log.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  await cleanup();
  await prisma.$disconnect();
}
