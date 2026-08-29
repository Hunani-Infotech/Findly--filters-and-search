/**
 * C7 gate: in-collection search bar (not store-wide).
 * Usage: npm run verify:c7
 */
import "tsx/esm";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { log } from "./terminal-log.mjs";
import { seedFilterConfig } from "./seed-filter-config.mjs";

const SHOP_DOMAIN = "c7-verify.myshopify.com";
const COLLECTION_GID = "gid://shopify/Collection/9707001";
const OTHER_COLLECTION_GID = "gid://shopify/Collection/9707002";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const IN_COLLECTION = 50;

const prisma = new PrismaClient();

function fail(message) {
  throw new Error(message);
}

function titles(result) {
  return (result.data?.products ?? []).map((p) => p.title).sort();
}

function assertStaticMarkers() {
  const settingsPage = readFileSync(join(ROOT, "app/routes/app.settings.tsx"), "utf8");
  const appSettings = readFileSync(join(ROOT, "app/utils/app-settings.ts"), "utf8");
  const proxy = readFileSync(join(ROOT, "app/services/proxy.server.ts"), "utf8");
  const filtersRoute = readFileSync(
    join(ROOT, "app/routes/apps.smart-filter.filters.tsx"),
    "utf8",
  );
  const liquid = readFileSync(
    join(ROOT, "extensions/smart-filter/blocks/collection-filters.liquid"),
    "utf8",
  );
  const widgetJs = readFileSync(
    join(ROOT, "extensions/smart-filter/assets/smart-filter.js"),
    "utf8",
  );
  const gridJs = readFileSync(
    join(ROOT, "extensions/smart-filter/assets/smart-filter-grid.js"),
    "utf8",
  );
  const filterCss = readFileSync(
    join(ROOT, "extensions/smart-filter/assets/smart-filter.css"),
    "utf8",
  );

  if (!settingsPage.includes("enableCollectionSearch")) {
    fail("admin settings missing Enable search on collection pages");
  }
  if (!appSettings.includes("enableCollectionSearch")) {
    fail("DEFAULT_APP_SETTINGS missing enableCollectionSearch");
  }
  if (!proxy.includes("productMatchesKeyword") || !proxy.includes("query?:")) {
    fail("getCollectionFilterPayload must accept query and keyword-filter membership");
  }
  if (!filtersRoute.includes("query: searchQuery")) {
    fail("filters route must forward q on collection requests");
  }
  if (!liquid.includes("data-collection-search")) {
    fail("collection-filters.liquid missing in-collection search input");
  }
  if (
    !widgetJs.includes("collectionQuery") ||
    !widgetJs.includes("enableCollectionSearch") ||
    !widgetJs.includes("isCollectionListing")
  ) {
    fail("smart-filter.js missing collection search bar wiring");
  }
  if (
    !gridJs.includes("sf-search-host") ||
    !gridJs.includes("placeCollectionSearchOnGrid") ||
    !gridJs.includes("isLayoutShell")
  ) {
    fail("collection search must mount above the product grid, not in the sidebar");
  }
  if (!filterCss.includes("sf-search-toolbar")) {
    fail("collection search toolbar styles missing");
  }
  if (!filterCss.includes(".smart-filter > .sf-search")) {
    fail("collection search must stay hidden while still in the filter sidebar");
  }
  if (!filterCss.includes(":has(> li:nth-child(6))")) {
    fail("facet option lists must scroll only when they have many values");
  }

  const instantJs = readFileSync(
    join(ROOT, "extensions/smart-filter/assets/instant-search.js"),
    "utf8",
  );
  if (
    !instantJs.includes("function isCollectionSearchInput") ||
    !instantJs.includes("shouldHandleInput") ||
    !instantJs.includes("listing=1") ||
    !instantJs.includes("findly:listing-suggest") ||
    !instantJs.includes("restoreCachedResults")
  ) {
    fail("instant-search.js must attach suggestions to the collection search bar");
  }
  if (!gridJs.includes("findly:listing-suggest")) {
    fail("collection search must publish listing suggestions from the same grid results");
  }
  if (
    !instantJs.includes("function isFacetValueSearchInput") ||
    !instantJs.includes(".sf-facet-search") ||
    !instantJs.includes("sf-facet-search-input")
  ) {
    fail("instant-search.js must ignore per-facet Search values inputs");
  }
  if (!gridJs.includes("data-findly-ignore-instant")) {
    fail("facet Search values inputs must opt out of instant product suggestions");
  }
}

async function cleanup() {
  await prisma.shop.deleteMany({ where: { domain: SHOP_DOMAIN } });
}

async function upsertProduct(shopId, product, extra = {}) {
  await prisma.productFacet.upsert({
    where: {
      shopId_productGid: { shopId, productGid: product.productGid },
    },
    create: {
      shopId,
      productGid: product.productGid,
      handle: product.handle,
      title: product.title,
      vendor: product.vendor,
      productType: "Apparel",
      tags: product.tags ?? [],
      options: {},
      priceMin: 10,
      priceMax: 10,
      available: true,
      status: "ACTIVE",
      imageUrl: null,
      metafields: {},
      ...extra,
    },
    update: {
      handle: product.handle,
      title: product.title,
      vendor: product.vendor,
      tags: product.tags ?? [],
      status: "ACTIVE",
    },
  });
}

async function addMembership(shopId, collectionGid, productGid, position) {
  await prisma.collectionMembership.upsert({
    where: {
      shopId_collectionGid_productGid: {
        shopId,
        collectionGid,
        productGid,
      },
    },
    create: { shopId, collectionGid, productGid, position },
    update: { position },
  });
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

  for (let i = 1; i <= IN_COLLECTION; i++) {
    const n = String(i).padStart(2, "0");
    const isNeedle = i <= 3;
    const productGid = `gid://shopify/Product/97070${String(i).padStart(2, "0")}`;
    await upsertProduct(shop.id, {
      productGid,
      handle: isNeedle ? `needle-shirt-${n}` : `catalog-item-${n}`,
      title: isNeedle ? `Needle Shirt ${n}` : `Catalog Item ${n}`,
      vendor: i % 2 === 0 ? "Acme" : "Northwind",
    });
    await addMembership(shop.id, COLLECTION_GID, productGid, i);
  }

  const outsiders = [
    {
      productGid: "gid://shopify/Product/9707991",
      handle: "needle-outsider-a",
      title: "Needle Outsider A",
      vendor: "Acme",
    },
    {
      productGid: "gid://shopify/Product/9707992",
      handle: "needle-outsider-b",
      title: "Needle Outsider B",
      vendor: "Acme",
    },
  ];
  for (const product of outsiders) {
    await upsertProduct(shop.id, product);
    await addMembership(shop.id, OTHER_COLLECTION_GID, product.productGid, 0);
  }

  return shop;
}

try {
  await cleanup();
  const shop = await seedShopData();
  log.info(`Seeded shop ${SHOP_DOMAIN} with ${IN_COLLECTION} collection products`);
  assertStaticMarkers();

  const { getCollectionFilterPayload, getSearchPayload } = await import("../app/services/proxy.server.ts"
  );
  const { saveAppSettings, getAppSettings } = await import("../app/services/settings.server.ts"
  );

  async function collectionPayload(query, selected = {}) {
    return getCollectionFilterPayload({
      shopDomain: SHOP_DOMAIN,
      collectionGid: COLLECTION_GID,
      selected,
      query,
    });
  }

  await saveAppSettings(shop.id, { enableCollectionSearch: true });
  const persisted = await getAppSettings(shop.id);
  if (!persisted.enableCollectionSearch) {
    fail("enableCollectionSearch did not persist");
  }

  const allInCollection = await collectionPayload("");
  if (allInCollection.data.total !== IN_COLLECTION) {
    fail(`empty query should keep ${IN_COLLECTION} products, got ${allInCollection.data.total}`);
  }
  if (allInCollection.data.settings?.enableCollectionSearch !== true) {
    fail("payload must expose enableCollectionSearch true");
  }
  log.info("empty collection query returns the full collection");

  const needle = await collectionPayload("Needle");
  const needleTitles = titles(needle);
  if (needleTitles.join(",") !== "Needle Shirt 01,Needle Shirt 02,Needle Shirt 03") {
    fail(`in-collection Needle expected 3 shirts, got ${needleTitles.join(",")}`);
  }
  if (needleTitles.some((title) => title.includes("Outsider"))) {
    fail("collection search leaked store-wide Needle products");
  }
  if (needle.data.total !== 3) {
    fail(`Needle in a 50-product collection should be 3, got ${needle.data.total}`);
  }
  log.info("Needle search stays inside the 50-product collection");

  const needleAcme = await collectionPayload("Needle", { vendor: ["Acme"] });
  if (titles(needleAcme).join(",") !== "Needle Shirt 02") {
    fail(
      `Needle + vendor Acme expected Needle Shirt 02, got ${titles(needleAcme).join(",")}`,
    );
  }
  log.info("in-collection search still honors current facets");

  const storeWide = await getSearchPayload({
    shopDomain: SHOP_DOMAIN,
    query: "Needle",
  });
  const storeTitles = (storeWide.data?.products ?? []).map((p) => p.title);
  if (!storeTitles.includes("Needle Outsider A")) {
    fail("store-wide search should still find products outside the collection");
  }
  log.info("store-wide search still finds outsiders (C7 does not change B1)");

  await saveAppSettings(shop.id, { enableCollectionSearch: false });
  const disabled = await collectionPayload("Needle");
  if (disabled.data.total !== IN_COLLECTION) {
    fail(
      `disabled collection search must ignore q and keep ${IN_COLLECTION}, got ${disabled.data.total}`,
    );
  }
  if (disabled.data.settings?.enableCollectionSearch !== false) {
    fail("payload must expose enableCollectionSearch false");
  }
  log.info("merchant can turn the collection search bar off");

  log.success("STEPC7_OK in-collection search; not store-wide; toggle persists");
} catch (error) {
  log.error(`STEPC7_FAIL ${error.message}`);
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
