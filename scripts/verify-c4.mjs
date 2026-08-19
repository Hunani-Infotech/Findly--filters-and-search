/**
 * C4 gate: sort dropdown with filters (price + collection order + hide UI).
 * Usage: npm run verify:c4
 */
import "tsx/esm";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { log } from "./terminal-log.mjs";
import { seedFilterConfig } from "./seed-filter-config.mjs";

const SHOP_DOMAIN = "c4-verify.myshopify.com";
const COLLECTION_GID = "gid://shopify/Collection/9404001";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const prisma = new PrismaClient();

function fail(message) {
  throw new Error(message);
}

function titles(result) {
  return (result.data?.products ?? []).map((p) => p.title);
}

function assertStaticMarkers() {
  const settingsPage = readFileSync(join(ROOT, "app/routes/app.settings.tsx"), "utf8");
  const appSettings = readFileSync(join(ROOT, "app/app-settings.ts"), "utf8");
  const liquid = readFileSync(
    join(ROOT, "extensions/smart-filter/blocks/collection-filters.liquid"),
    "utf8",
  );
  const widgetJs = readFileSync(
    join(ROOT, "extensions/smart-filter/assets/smart-filter.js"),
    "utf8",
  );

  if (!settingsPage.includes("sortOptionsEnabled") || !settingsPage.includes("hideSortDropdown")) {
    fail("admin settings missing Sort By controls");
  }
  if (/best.?sell/i.test(appSettings) && /SORT_OPTION_KEYS[\s\S]*best/i.test(appSettings)) {
    fail("do not add best-selling sort keys without sales data");
  }
  if (appSettings.includes('"best_selling"')) {
    fail("best-selling sort keys must stay omitted until sales data exists");
  }
  if (!liquid.includes("data-sort") || !liquid.includes("data-sort-wrap")) {
    fail("collection-filters.liquid missing sort dropdown");
  }
  if (!widgetJs.includes("applyProductOrder") || !widgetJs.includes('params.set("sort"')) {
    fail("smart-filter.js missing sort reorder / proxy sort param");
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
    enablePrice: true,
  });

  const products = [
    {
      productGid: "gid://shopify/Product/9404001",
      handle: "zeta-cheap",
      title: "Zeta Cheap",
      vendor: "Acme",
      priceMin: 10,
      priceMax: 10,
      position: 2,
      publishedAt: new Date("2024-01-01"),
    },
    {
      productGid: "gid://shopify/Product/9404002",
      handle: "alpha-mid",
      title: "Alpha Mid",
      vendor: "Acme",
      priceMin: 40,
      priceMax: 40,
      position: 0,
      publishedAt: new Date("2025-06-01"),
    },
    {
      productGid: "gid://shopify/Product/9404003",
      handle: "beta-pricey",
      title: "Beta Pricey",
      vendor: "Northwind",
      priceMin: 90,
      priceMax: 90,
      position: 1,
      publishedAt: new Date("2025-01-01"),
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
        vendor: product.vendor,
        productType: "Apparel",
        tags: ["c4-verify"],
        options: {},
        priceMin: product.priceMin,
        priceMax: product.priceMax,
        available: true,
        status: "ACTIVE",
        imageUrl: null,
        metafields: {},
        publishedAt: product.publishedAt,
      },
      update: {
        handle: product.handle,
        title: product.title,
        vendor: product.vendor,
        priceMin: product.priceMin,
        priceMax: product.priceMax,
        publishedAt: product.publishedAt,
        status: "ACTIVE",
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
        position: product.position,
      },
      update: { position: product.position },
    });
  }

  return shop;
}

try {
  await cleanup();
  const shop = await seedShopData();
  log.info(`Seeded shop ${SHOP_DOMAIN}`);
  assertStaticMarkers();

  const { getCollectionFilterPayload } = await import("../app/proxy.server.ts");
  const { saveAppSettings, getAppSettings } = await import(
    "../app/settings.server.ts"
  );

  async function payload(sort, selected = {}) {
    return getCollectionFilterPayload({
      shopDomain: SHOP_DOMAIN,
      collectionGid: COLLECTION_GID,
      selected,
      sort,
    });
  }

  await saveAppSettings(shop.id, {
    sortOptionsEnabled: [
      "manual",
      "title_asc",
      "price_asc",
      "price_desc",
      "date_desc",
    ],
    defaultSort: "manual",
    hideSortDropdown: false,
  });
  const persisted = await getAppSettings(shop.id);
  if (persisted.defaultSort !== "manual") {
    fail(`defaultSort persist failed: ${persisted.defaultSort}`);
  }
  if (persisted.sortOptionsEnabled.includes("best_selling")) {
    fail("best-selling sort must stay omitted until sales data exists");
  }

  const featured = await payload("manual");
  if (titles(featured).join(",") !== "Alpha Mid,Beta Pricey,Zeta Cheap") {
    fail(`manual/collection order expected Alpha,Beta,Zeta got ${titles(featured)}`);
  }
  if (featured.data.settings?.hideSortDropdown !== false) {
    fail("hideSortDropdown should be false");
  }
  log.info("manual sort follows collection position");

  const priceLow = await payload("price_asc", { vendor: ["Acme"] });
  if (titles(priceLow).join(",") !== "Zeta Cheap,Alpha Mid") {
    fail(
      `price low-high on Acme filter expected Zeta Cheap,Alpha Mid got ${titles(priceLow)}`,
    );
  }
  if (titles(priceLow).includes("Beta Pricey")) {
    fail("price sort must still honor vendor filter");
  }
  if (priceLow.data.sort !== "price_asc") {
    fail(`expected sort price_asc, got ${priceLow.data.sort}`);
  }
  log.info("price low-high on filtered collection is correct");

  const priceHigh = await payload("price_desc");
  if (titles(priceHigh)[0] !== "Beta Pricey") {
    fail(`price high-low expected Beta first, got ${titles(priceHigh)}`);
  }

  const az = await payload("title_asc");
  if (titles(az)[0] !== "Alpha Mid") {
    fail(`A-Z expected Alpha first, got ${titles(az)}`);
  }

  const newest = await payload("date_desc");
  if (titles(newest)[0] !== "Alpha Mid") {
    fail(`date new-old expected Alpha first, got ${titles(newest)}`);
  }

  await saveAppSettings(shop.id, {
    hideSortDropdown: true,
    defaultSort: "price_asc",
    sortOptionsEnabled: ["manual", "price_asc"],
  });
  const hidden = await getAppSettings(shop.id);
  if (!hidden.hideSortDropdown) fail("hideSortDropdown did not persist");
  const hiddenPayload = await payload(null);
  if (hiddenPayload.data.settings?.hideSortDropdown !== true) {
    fail("payload must expose hideSortDropdown true");
  }
  if (titles(hiddenPayload).join(",") !== "Zeta Cheap,Alpha Mid,Beta Pricey") {
    fail(
      `hidden dropdown still applies default price_asc, got ${titles(hiddenPayload)}`,
    );
  }
  log.info("merchant can hide Sort By dropdown; default sort still applies");

  log.success("STEPC4_OK sort + filters; hide dropdown; collection default order");
} catch (error) {
  log.error(`STEPC4_FAIL ${error.message}`);
  if (error.stack) console.error(error.stack);
  process.exitCode = 1;
} finally {
  try {
    await cleanup();
    log.info(`Cleaned up shop ${SHOP_DOMAIN}`);
  } catch (cleanupError) {
    log.warn(`Cleanup failed: ${cleanupError.message}`);
  }
  await prisma.$disconnect();
}
