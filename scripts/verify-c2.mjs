/**
 * C2 gate: hide out-of-stock merchant setting (show / hide / hide_after_filter).
 * Usage: npm run verify:c2
 */
import "tsx/esm";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { log } from "./terminal-log.mjs";

const SHOP_DOMAIN = "c2-verify.myshopify.com";
const COLLECTION_GID = "gid://shopify/Collection/9202001";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const prisma = new PrismaClient();

function fail(message) {
  throw new Error(message);
}

function titles(result) {
  return (result.data?.products ?? []).map((p) => p.title).sort();
}

function hasAvailabilityFacet(result) {
  return (result.data?.facets ?? []).some((facet) => facet.key === "availability");
}

function assertAdminSelect() {
  const settingsPage = readFileSync(
    join(ROOT, "app/routes/app.settings.tsx"),
    "utf8",
  );
  if (!settingsPage.includes("HIDE_OUT_OF_STOCK_OPTIONS")) {
    fail("admin settings missing out-of-stock Select");
  }
  if (!settingsPage.includes("hideOutOfStock")) {
    fail("admin settings missing hideOutOfStock field");
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

  await prisma.filterConfig.upsert({
    where: {
      shopId_collectionGid: { shopId: shop.id, collectionGid: COLLECTION_GID },
    },
    create: {
      shopId: shop.id,
      collectionGid: COLLECTION_GID,
      enabled: true,
      enablePrice: true,
      enableAvailability: true,
      enableVendor: true,
      enableProductType: true,
      enableTags: true,
      enableOptions: false,
    },
    update: {
      enabled: true,
      enableAvailability: true,
      enableVendor: true,
    },
  });

  const products = [
    {
      productGid: "gid://shopify/Product/9202001",
      handle: "in-stock-tee",
      title: "In Stock Tee",
      vendor: "Acme",
      available: true,
      status: "ACTIVE",
    },
    {
      productGid: "gid://shopify/Product/9202002",
      handle: "oos-tee",
      title: "OOS Tee",
      vendor: "Acme",
      available: false,
      status: "ACTIVE",
    },
    {
      productGid: "gid://shopify/Product/9202003",
      handle: "in-stock-jacket",
      title: "In Stock Jacket",
      vendor: "Northwind",
      available: true,
      status: "ACTIVE",
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
        tags: ["c2-verify"],
        options: {},
        priceMin: 20,
        priceMax: 20,
        imageUrl: null,
        metafields: {},
      },
      update: {
        handle: product.handle,
        title: product.title,
        vendor: product.vendor,
        available: product.available,
        status: product.status,
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

  return shop;
}

try {
  await cleanup();
  const shop = await seedShopData();
  log.info(`Seeded shop ${SHOP_DOMAIN} (id=${shop.id})`);
  assertAdminSelect();

  const { getCollectionFilterPayload } = await import("../app/proxy.server.ts");
  const { saveAppSettings, getAppSettings } = await import(
    "../app/settings.server.ts"
  );

  async function payload(selected = {}) {
    return getCollectionFilterPayload({
      shopDomain: SHOP_DOMAIN,
      collectionGid: COLLECTION_GID,
      selected,
    });
  }

  await saveAppSettings(shop.id, { hideOutOfStock: "show" });
  const shown = await getAppSettings(shop.id);
  if (shown.hideOutOfStock !== "show") {
    fail(`expected persisted show, got ${shown.hideOutOfStock}`);
  }
  const showAll = await payload();
  if (titles(showAll).join(",") !== "In Stock Jacket,In Stock Tee,OOS Tee") {
    fail(`show all expected 3 products, got ${titles(showAll)}`);
  }
  if (!hasAvailabilityFacet(showAll)) {
    fail("availability facet must remain with show-all mode");
  }
  if (showAll.data.settings?.hideOutOfStock !== "show") {
    fail("payload settings.hideOutOfStock should be show");
  }
  log.info("show: mixed stock all visible");

  await saveAppSettings(shop.id, { hideOutOfStock: "hide" });
  const hiddenPersisted = await getAppSettings(shop.id);
  if (hiddenPersisted.hideOutOfStock !== "hide") {
    fail(`expected persisted hide, got ${hiddenPersisted.hideOutOfStock}`);
  }
  const hideAlways = await payload();
  if (titles(hideAlways).join(",") !== "In Stock Jacket,In Stock Tee") {
    fail(`hide always expected in-stock only, got ${titles(hideAlways)}`);
  }
  if (titles(hideAlways).includes("OOS Tee")) {
    fail("hide always must not list OOS Tee");
  }
  if (!hasAvailabilityFacet(hideAlways)) {
    fail("availability facet must remain when hiding OOS");
  }

  const hideVendor = await payload({ vendor: ["Acme"] });
  if (titles(hideVendor).join(",") !== "In Stock Tee") {
    fail(`hide + vendor Acme expected In Stock Tee, got ${titles(hideVendor)}`);
  }

  const hideOosFacet = await payload({ availability: ["out_of_stock"] });
  if (titles(hideOosFacet).join(",") !== "OOS Tee") {
    fail(
      `hide + availability out_of_stock expected OOS Tee, got ${titles(hideOosFacet)}`,
    );
  }
  log.info("hide: OOS stripped unless shopper picks Out of stock");

  await saveAppSettings(shop.id, { hideOutOfStock: "hide_after_filter" });
  const afterPersisted = await getAppSettings(shop.id);
  if (afterPersisted.hideOutOfStock !== "hide_after_filter") {
    fail(`expected persisted hide_after_filter, got ${afterPersisted.hideOutOfStock}`);
  }
  const afterNone = await payload({});
  if (titles(afterNone).join(",") !== "In Stock Jacket,In Stock Tee,OOS Tee") {
    fail(
      `hide_after_filter with no filters expected all 3, got ${titles(afterNone)}`,
    );
  }
  const afterVendor = await payload({ vendor: ["Acme"] });
  if (titles(afterVendor).join(",") !== "In Stock Tee") {
    fail(
      `hide_after_filter + vendor Acme expected In Stock Tee (OOS hidden), got ${titles(afterVendor)}`,
    );
  }
  const afterOos = await payload({ availability: ["out_of_stock"] });
  if (titles(afterOos).join(",") !== "OOS Tee") {
    fail(
      `hide_after_filter + out_of_stock expected OOS Tee, got ${titles(afterOos)}`,
    );
  }
  log.info("hide_after_filter: all until a filter, then OOS hidden");

  log.success("STEPC2_OK hide-OOS 3 modes persist and change storefront products");
} catch (error) {
  log.error(`STEPC2_FAIL ${error.message}`);
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
