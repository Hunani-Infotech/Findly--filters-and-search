/**
 * C5 gate: in-stock on top + sold-out to bottom, composing with C4 sort.
 * Usage: npm run verify:c5
 */
import "tsx/esm";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { log } from "./terminal-log.mjs";
import { seedFilterConfig } from "./seed-filter-config.mjs";

const SHOP_DOMAIN = "c5-verify.myshopify.com";
const COLLECTION_GID = "gid://shopify/Collection/9505001";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const prisma = new PrismaClient();

function fail(message) {
  throw new Error(message);
}

function titles(result) {
  return (result.data?.products ?? []).map((p) => p.title);
}

function assertAdminToggles() {
  const settingsPage = readFileSync(
    join(ROOT, "app/routes/app.settings.tsx"),
    "utf8",
  );
  if (!settingsPage.includes("inStockOnTop") || !settingsPage.includes("soldOutToBottom")) {
    fail("admin settings missing the two C5 stock-pinning toggles");
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
      productGid: "gid://shopify/Product/9505001",
      handle: "oos-cheap",
      title: "OOS Cheap",
      vendor: "Acme",
      priceMin: 10,
      available: false,
    },
    {
      productGid: "gid://shopify/Product/9505002",
      handle: "in-mid",
      title: "In Mid",
      vendor: "Acme",
      priceMin: 40,
      available: true,
    },
    {
      productGid: "gid://shopify/Product/9505003",
      handle: "in-pricey",
      title: "In Pricey",
      vendor: "Acme",
      priceMin: 90,
      available: true,
    },
    {
      productGid: "gid://shopify/Product/9505004",
      handle: "oos-other",
      title: "OOS Other",
      vendor: "Northwind",
      priceMin: 5,
      available: false,
    },
  ];

  for (const [index, product] of products.entries()) {
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
        tags: ["c5-verify"],
        options: {},
        priceMin: product.priceMin,
        priceMax: product.priceMin,
        available: product.available,
        status: "ACTIVE",
        imageUrl: null,
        metafields: {},
      },
      update: {
        title: product.title,
        vendor: product.vendor,
        priceMin: product.priceMin,
        priceMax: product.priceMin,
        available: product.available,
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
        position: index,
      },
      update: { position: index },
    });
  }

  return shop;
}

try {
  await cleanup();
  const shop = await seedShopData();
  log.info(`Seeded shop ${SHOP_DOMAIN}`);
  assertAdminToggles();

  const { getCollectionFilterPayload } = await import("../app/proxy.server.ts");
  const { saveAppSettings, getAppSettings } = await import(
    "../app/settings.server.ts"
  );

  await saveAppSettings(shop.id, {
    hideOutOfStock: "show",
    inStockOnTop: false,
    soldOutToBottom: false,
  });

  const unsorted = await getCollectionFilterPayload({
    shopDomain: SHOP_DOMAIN,
    collectionGid: COLLECTION_GID,
    selected: {},
    sort: "price_asc",
  });
  if (titles(unsorted).join(",") !== "OOS Other,OOS Cheap,In Mid,In Pricey") {
    fail(`plain price_asc expected OOS Other,OOS Cheap,In Mid,In Pricey got ${titles(unsorted)}`);
  }

  await saveAppSettings(shop.id, {
    inStockOnTop: true,
    soldOutToBottom: true,
  });
  const persisted = await getAppSettings(shop.id);
  if (!persisted.inStockOnTop || !persisted.soldOutToBottom) {
    fail(
      `toggles did not persist: inStockOnTop=${persisted.inStockOnTop} soldOutToBottom=${persisted.soldOutToBottom}`,
    );
  }

  const both = await getCollectionFilterPayload({
    shopDomain: SHOP_DOMAIN,
    collectionGid: COLLECTION_GID,
    selected: {},
    sort: "price_asc",
  });
  if (titles(both).join(",") !== "In Mid,In Pricey,OOS Other,OOS Cheap") {
    fail(
      `both on + price_asc expected In Mid,In Pricey,OOS Other,OOS Cheap got ${titles(both)}`,
    );
  }
  if (both.data.settings?.inStockOnTop !== true || both.data.settings?.soldOutToBottom !== true) {
    fail("payload settings must expose both C5 toggles");
  }
  log.info("both on: in-stock first (price order), OOS last (price order)");

  const acme = await getCollectionFilterPayload({
    shopDomain: SHOP_DOMAIN,
    collectionGid: COLLECTION_GID,
    selected: { vendor: ["Acme"] },
    sort: "price_asc",
  });
  if (titles(acme).join(",") !== "In Mid,In Pricey,OOS Cheap") {
    fail(
      `both on + vendor Acme + price_asc expected In Mid,In Pricey,OOS Cheap got ${titles(acme)}`,
    );
  }
  log.info("both on still honors vendor filter");

  log.success("STEPC5_OK in-stock on top + sold-out to bottom compose with C4 sort");
} catch (error) {
  log.error(`STEPC5_FAIL ${error.message}`);
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
