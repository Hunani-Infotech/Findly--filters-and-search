/**
 * C5 gate: "Show at the end" pins sold-out products after in-stock, composing with C4 sort.
 * Usage: npm run verify:c5
 */
import "tsx/esm";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createPrismaClient } from "./prisma-runtime.mjs";
import { log } from "./terminal-log.mjs";
import { seedFilterConfig } from "./seed-filter-config.mjs";

const SHOP_DOMAIN = "c5-verify.myshopify.com";
const COLLECTION_GID = "gid://shopify/Collection/9505001";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const prisma = createPrismaClient();

function fail(message) {
  throw new Error(message);
}

function titles(result) {
  return (result.data?.products ?? []).map((p) => p.title);
}

function assertAdminOption() {
  const settingsPage = readFileSync(
    join(ROOT, "app/routes/app.settings.tsx"),
    "utf8",
  );
  if (
    settingsPage.includes("Display in-stock products on top") ||
    settingsPage.includes("Move sold-out products to the bottom")
  ) {
    fail("admin settings still has the removed stock-pinning checkboxes");
  }
  const appSettings = readFileSync(
    join(ROOT, "app/utils/app-settings.ts"),
    "utf8",
  );
  if (!appSettings.includes('value: "end"')) {
    fail("out-of-stock options missing Show at the end (end)");
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

  await prisma.productFacet.upsert({
    where: {
      shopId_productGid: {
        shopId: shop.id,
        productGid: "gid://shopify/Product/9505099",
      },
    },
    create: {
      shopId: shop.id,
      productGid: "gid://shopify/Product/9505099",
      handle: "draft-hidden",
      title: "Draft Hidden",
      vendor: "Acme",
      productType: "Apparel",
      tags: ["c5-verify"],
      options: {},
      priceMin: 1,
      priceMax: 1,
      available: true,
      status: "DRAFT",
      imageUrl: null,
      metafields: {},
    },
    update: {
      title: "Draft Hidden",
      status: "DRAFT",
      available: true,
    },
  });
  await prisma.collectionMembership.upsert({
    where: {
      shopId_collectionGid_productGid: {
        shopId: shop.id,
        collectionGid: COLLECTION_GID,
        productGid: "gid://shopify/Product/9505099",
      },
    },
    create: {
      shopId: shop.id,
      collectionGid: COLLECTION_GID,
      productGid: "gid://shopify/Product/9505099",
      position: 99,
    },
    update: { position: 99 },
  });

  return shop;
}

try {
  await cleanup();
  const shop = await seedShopData();
  log.info(`Seeded shop ${SHOP_DOMAIN}`);
  assertAdminOption();

  const { getCollectionFilterPayload, clearFilterPayloadCache } = await import("../app/services/proxy.server.ts");
  const { saveAppSettings, getAppSettings } = await import("../app/services/settings.server.ts"
  );

  await saveAppSettings(shop.id, {
    hideOutOfStock: "show",
  });
  clearFilterPayloadCache();

  const unsorted = await getCollectionFilterPayload({
    shopDomain: SHOP_DOMAIN,
    collectionGid: COLLECTION_GID,
    selected: {},
    sort: "price_asc",
  });
  if (titles(unsorted).join(",") !== "OOS Other,OOS Cheap,In Mid,In Pricey") {
    fail(`plain price_asc expected OOS Other,OOS Cheap,In Mid,In Pricey got ${titles(unsorted)}`);
  }
  if (titles(unsorted).includes("Draft Hidden")) {
    fail("DRAFT products must not appear in storefront filter payloads");
  }

  await saveAppSettings(shop.id, {
    hideOutOfStock: "end",
  });
  clearFilterPayloadCache();
  const persisted = await getAppSettings(shop.id);
  if (persisted.hideOutOfStock !== "end" || !persisted.soldOutToBottom) {
    fail(
      `end mode did not persist: hideOutOfStock=${persisted.hideOutOfStock} soldOutToBottom=${persisted.soldOutToBottom}`,
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
      `show at the end + price_asc expected In Mid,In Pricey,OOS Other,OOS Cheap got ${titles(both)}`,
    );
  }
  if (both.data.settings?.hideOutOfStock !== "end") {
    fail("payload settings must expose hideOutOfStock=end");
  }
  log.info("show at the end: in-stock first (price order), OOS last (price order)");

  const acme = await getCollectionFilterPayload({
    shopDomain: SHOP_DOMAIN,
    collectionGid: COLLECTION_GID,
    selected: { vendor: ["Acme"] },
    sort: "price_asc",
  });
  if (titles(acme).join(",") !== "In Mid,In Pricey,OOS Cheap") {
    fail(
      `show at the end + vendor Acme + price_asc expected In Mid,In Pricey,OOS Cheap got ${titles(acme)}`,
    );
  }
  log.info("show at the end still honors vendor filter");

  log.success("STEPC5_OK show at the end composes with C4 sort");
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
