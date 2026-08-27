/**
 * B3 gate: merchant search fields + weighted ranking (title/vendor/type/tags/sku/options).
 * Usage: npm run verify:b3
 */
import "tsx/esm";
import { PrismaClient } from "@prisma/client";
import { log } from "./terminal-log.mjs";

const SHOP_DOMAIN = "b3-verify.myshopify.com";

const prisma = new PrismaClient();

function fail(message) {
  throw new Error(message);
}

function handles(rows) {
  return rows.map((p) => p.handle);
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

  await prisma.appSettings.upsert({
    where: { shopId: shop.id },
    create: {
      shopId: shop.id,
      searchFields: ["title", "vendor", "productType", "tags"],
    },
    update: {
      searchFields: ["title", "vendor", "productType", "tags"],
    },
  });

  const products = [
    {
      productGid: "gid://shopify/Product/9303001",
      handle: "b3-a-title",
      title: "Alpha UniqueTitle",
      vendor: "Other",
      tags: [],
      skus: [],
      options: {},
      status: "ACTIVE",
    },
    {
      productGid: "gid://shopify/Product/9303002",
      handle: "b3-b-vendor",
      title: "Other",
      vendor: "Alpha UniqueTitle",
      tags: [],
      skus: [],
      options: {},
      status: "ACTIVE",
    },
    {
      productGid: "gid://shopify/Product/9303003",
      handle: "b3-c-tags-sku",
      title: "Other",
      vendor: "Other",
      tags: ["summer-sale"],
      skus: ["SKU-999"],
      options: {},
      status: "ACTIVE",
    },
    {
      productGid: "gid://shopify/Product/9303004",
      handle: "b3-d-options",
      title: "Other",
      vendor: "Other",
      tags: [],
      skus: [],
      options: { Size: ["XL-UNIQUE"] },
      status: "ACTIVE",
    },
    {
      productGid: "gid://shopify/Product/9303005",
      handle: "b3-e-draft",
      title: "Alpha UniqueTitle",
      vendor: "Other",
      tags: [],
      skus: [],
      options: {},
      status: "DRAFT",
    },
  ];

  for (const product of products) {
    await prisma.productFacet.upsert({
      where: {
        shopId_productGid: { shopId: shop.id, productGid: product.productGid },
      },
      create: {
        shopId: shop.id,
        ...product,
        productType: "Apparel",
        priceMin: 10,
        priceMax: 10,
        available: product.status === "ACTIVE",
        imageUrl: null,
        metafields: {},
      },
      update: {
        handle: product.handle,
        title: product.title,
        vendor: product.vendor,
        tags: product.tags,
        skus: product.skus,
        options: product.options,
        status: product.status,
      },
    });
  }

  return shop;
}

try {
  await cleanup();
  const shop = await seedShopData();
  log.info(`Seeded shop ${SHOP_DOMAIN} (id=${shop.id})`);

  const { searchProducts, searchProductFacets, normalizeSearchQuery } =
    await import("../app/services/search.server.ts");
  const { saveAppSettings, getAppSettings } = await import("../app/services/settings.server.ts"
  );

  if (normalizeSearchQuery("")) {
    fail("empty query must stay empty after normalize");
  }

  const defaultHits = await searchProducts(shop.id, "Alpha UniqueTitle");
  if (handles(defaultHits).includes("b3-e-draft")) {
    fail("DRAFT titled Alpha UniqueTitle must never appear");
  }
  if (handles(defaultHits).join(",") !== "b3-a-title,b3-b-vendor") {
    fail(
      `default fields expected A then B, got ${JSON.stringify(handles(defaultHits))}`,
    );
  }
  log.info("default fields: A (title) ranks before B (vendor)");

  const defaultFacets = await searchProductFacets(shop.id, "Alpha UniqueTitle");
  if (handles(defaultFacets).join(",") !== "b3-a-title,b3-b-vendor") {
    fail(
      `searchProductFacets expected A then B, got ${JSON.stringify(handles(defaultFacets))}`,
    );
  }

  await saveAppSettings(shop.id, { searchFields: ["vendor"] });
  const vendorOnly = await searchProducts(shop.id, "Alpha UniqueTitle");
  if (handles(vendorOnly).join(",") !== "b3-b-vendor") {
    fail(
      `vendor-only expected ONLY B, got ${JSON.stringify(handles(vendorOnly))}`,
    );
  }
  log.info("title-only match A stopped after toggling title off");

  await saveAppSettings(shop.id, { searchFields: ["title", "vendor"] });
  const titleFirst = await searchProducts(shop.id, "Alpha UniqueTitle");
  if (handles(titleFirst).join(",") !== "b3-a-title,b3-b-vendor") {
    fail(
      `["title","vendor"] expected A then B, got ${JSON.stringify(handles(titleFirst))}`,
    );
  }

  await saveAppSettings(shop.id, { searchFields: ["vendor", "title"] });
  const vendorFirst = await searchProducts(shop.id, "Alpha UniqueTitle");
  if (handles(vendorFirst).join(",") !== "b3-b-vendor,b3-a-title") {
    fail(
      `["vendor","title"] expected B then A, got ${JSON.stringify(handles(vendorFirst))}`,
    );
  }
  log.info("field order flips relevance (title-first vs vendor-first)");

  await saveAppSettings(shop.id, { searchFields: ["tags"] });
  const tagSummer = await searchProducts(shop.id, "summer");
  if (handles(tagSummer).join(",") !== "b3-c-tags-sku") {
    fail(`tags "summer" expected C, got ${JSON.stringify(handles(tagSummer))}`);
  }
  const tagMiss = await searchProducts(shop.id, "Alpha UniqueTitle");
  if (tagMiss.length !== 0) {
    fail(
      `tags-only + title query should match nobody, got ${JSON.stringify(handles(tagMiss))}`,
    );
  }
  log.info("tags substring matched summer-sale; title query matched nobody");

  await saveAppSettings(shop.id, { searchFields: ["sku"] });
  const skuHit = await searchProducts(shop.id, "SKU-999");
  if (handles(skuHit).join(",") !== "b3-c-tags-sku") {
    fail(`sku SKU-999 expected C, got ${JSON.stringify(handles(skuHit))}`);
  }
  log.info("sku field matched SKU-999");

  await saveAppSettings(shop.id, { searchFields: ["options"] });
  const optionHit = await searchProducts(shop.id, "XL-UNIQUE");
  if (handles(optionHit).join(",") !== "b3-d-options") {
    fail(
      `options XL-UNIQUE expected D, got ${JSON.stringify(handles(optionHit))}`,
    );
  }
  log.info("options field matched XL-UNIQUE");

  await saveAppSettings(shop.id, { searchFields: [] });
  const none = await searchProducts(shop.id, "Alpha UniqueTitle");
  if (none.length !== 0) {
    fail(`no enabled fields must return [], got ${JSON.stringify(handles(none))}`);
  }
  const persisted = await getAppSettings(shop.id);
  if (persisted.searchFields.length !== 0) {
    fail(
      `empty searchFields must persist, got ${JSON.stringify(persisted.searchFields)}`,
    );
  }

  const emptyQuery = await searchProducts(shop.id, "   ");
  if (emptyQuery.length !== 0) {
    fail("empty query must return []");
  }

  log.success("STEPB3_OK search fields persist and change ranking/matches");
} catch (error) {
  log.error(`STEPB3_FAIL ${error.message}`);
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
