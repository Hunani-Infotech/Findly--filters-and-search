/**
 * D9 gate: theme-owned pagination + proxy page/pageSize/hasNext (server).
 * Findly no longer exposes load_more / infinite admin options — the theme
 * handles paging chrome; Findly only syncs the theme pager when filtered.
 * Usage: npm run verify:d9
 */
import "tsx/esm";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createPrismaClient } from "./prisma-runtime.mjs";
import { log } from "./terminal-log.mjs";
import { seedFilterConfig } from "./seed-filter-config.mjs";

const SHOP_DOMAIN = "d9-verify.myshopify.com";
const COLLECTION_GID = "gid://shopify/Collection/9009009";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const prisma = createPrismaClient();

function fail(message) {
  throw new Error(message);
}

function readRepo(...parts) {
  return readFileSync(join(ROOT, ...parts), "utf8");
}

function assertStaticMarkers() {
  const schema = readRepo("prisma", "schema.prisma");
  if (!schema.includes("paginationStyle")) {
    fail("schema missing paginationStyle (kept for backward compat)");
  }
  const settingsLib = readRepo("app", "utils", "app-settings.ts");
  if (!settingsLib.includes("parsePaginationStyle")) {
    fail("app-settings.ts missing parsePaginationStyle");
  }
  if (!settingsLib.includes('return "pagination"')) {
    fail("parsePaginationStyle must coerce all values to pagination");
  }

  const admin = readRepo("app", "routes", "app.settings.tsx");
  if (admin.includes("Paging style") || admin.includes("PAGING_STYLE_OPTIONS")) {
    fail("Settings must not expose Paging style UI (theme owns paging)");
  }

  const widgetSettings = readRepo("app", "services", "widget-settings.server.ts");
  if (!widgetSettings.includes("paginationStyle")) {
    fail("widget-settings.server.ts missing paginationStyle");
  }

  const proxy = readRepo("app", "services", "proxy.server.ts");
  if (!proxy.includes("hasNext") || !proxy.includes("sliceFilterProducts")) {
    fail("proxy.server.ts missing hasNext / sliceFilterProducts");
  }

  const pager = readRepo(
    "extensions",
    "smart-filter",
    "assets",
    "smart-filter-pager.js",
  );
  if (!pager.includes("syncThemePager") || !pager.includes("bindThemePagerClicks")) {
    fail("pager companion must keep theme pager sync + click bind");
  }
  if (!pager.includes("Unfiltered browse")) {
    fail("syncThemePager must leave theme alone when unfiltered");
  }
  const renderPagerStart = pager.indexOf("proto.renderPager = function");
  const renderPagerEnd = pager.indexOf("};", renderPagerStart);
  if (renderPagerStart < 0) fail("storefront missing renderPager");
  const renderPagerBody = pager.slice(renderPagerStart, renderPagerEnd + 2);
  if (
    renderPagerBody.includes("sf-pager--load-more") ||
    renderPagerBody.includes("sf-pager--infinite") ||
    renderPagerBody.includes("sf-pager-sentinel")
  ) {
    fail("renderPager must not mount Findly load_more / infinite chrome");
  }

  const grid = readRepo(
    "extensions",
    "smart-filter",
    "assets",
    "smart-filter-grid.js",
  );
  if (!grid.includes("stripThemePageParamIfFiltering")) {
    fail("grid must only strip ?page= while filtering");
  }
  if (grid.includes('if (url.searchParams.has("page")) stripThemePageParam()')) {
    fail("MutationObserver must not strip ?page= on every mutation");
  }
  if (grid.includes("root.classList.add(\"sf-og\");\n      stripThemePageParam()")) {
    fail("setOwnsGrid must not strip ?page=");
  }

  const filtersLiq = readRepo(
    "extensions",
    "smart-filter",
    "blocks",
    "collection-filters.liquid",
  );
  const embedLiq = readRepo(
    "extensions",
    "smart-filter",
    "blocks",
    "collection-filters-embed.liquid",
  );
  if (!filtersLiq.includes("smart-filter-pager.min.js")) {
    fail("collection-filters.liquid must load smart-filter-pager.min.js");
  }
  if (!embedLiq.includes("smart-filter-pager.min.js")) {
    fail("collection-filters-embed.liquid must load smart-filter-pager.min.js");
  }

  log.info("D9 static markers present (theme-owned paging)");
}

async function cleanup() {
  await prisma.shop.deleteMany({ where: { domain: SHOP_DOMAIN } });
}

try {
  await cleanup();
  assertStaticMarkers();

  const { parsePaginationStyle } = await import("../app/utils/app-settings.ts");
  if (parsePaginationStyle("infinite") !== "pagination") {
    fail("parsePaginationStyle must coerce infinite → pagination");
  }
  if (parsePaginationStyle("load_more") !== "pagination") {
    fail("parsePaginationStyle must coerce load_more → pagination");
  }
  if (parsePaginationStyle("nope") !== "pagination") {
    fail("parsePaginationStyle should default to pagination");
  }

  const shop = await prisma.shop.create({
    data: { domain: SHOP_DOMAIN, plan: "free" },
  });

  await seedFilterConfig(prisma, shop.id, {
    collectionGid: COLLECTION_GID,
    name: "D9 tree",
    enabled: true,
    appliesToSearch: true,
    enablePrice: false,
    enableAvailability: false,
    enableVendor: false,
    enableProductType: false,
    enableTags: false,
    enableOptions: false,
  });

  for (let i = 1; i <= 5; i += 1) {
    const gid = `gid://shopify/Product/d9-${i}`;
    await prisma.productFacet.create({
      data: {
        shopId: shop.id,
        productGid: gid,
        handle: `d9-item-${i}`,
        title: `D9 Item ${i}`,
        vendor: "Acme",
        productType: "Apparel",
        tags: [],
        options: {},
        priceMin: 10 * i,
        priceMax: 10 * i,
        available: true,
        status: "ACTIVE",
        imageUrl: null,
        metafields: {},
      },
    });
    await prisma.collectionMembership.create({
      data: {
        shopId: shop.id,
        collectionGid: COLLECTION_GID,
        productGid: gid,
        position: i,
      },
    });
  }

  const { saveAppSettings, getAppSettings } = await import(
    "../app/services/settings.server.ts"
  );
  await saveAppSettings(shop.id, { paginationStyle: "infinite" });
  const persisted = await getAppSettings(shop.id);
  if (persisted.paginationStyle !== "pagination") {
    fail(
      `expected coerced pagination, got ${persisted.paginationStyle}`,
    );
  }

  await saveAppSettings(shop.id, { hideOutOfStock: "show" });
  const stillPagination = await getAppSettings(shop.id);
  if (stillPagination.paginationStyle !== "pagination") {
    fail("unrelated saveAppSettings wiped paginationStyle");
  }

  const { getCollectionFilterPayload, getSearchFilterPayload } = await import(
    "../app/services/proxy.server.ts"
  );

  const all = await getCollectionFilterPayload({
    shopDomain: SHOP_DOMAIN,
    collectionGid: COLLECTION_GID,
    selected: {},
  });
  if ("error" in all && all.error) fail(all.error);
  if ((all.data?.products ?? []).length !== 5) {
    fail(`without pageSize expected 5 products, got ${all.data?.products?.length}`);
  }
  if (all.data?.total !== 5) fail(`expected total 5, got ${all.data?.total}`);
  if (all.data?.settings?.paginationStyle !== "pagination") {
    fail(
      `settings.paginationStyle expected pagination, got ${all.data?.settings?.paginationStyle}`,
    );
  }
  if (all.data?.pageSize != null) {
    fail("omitted pageSize should not include pageSize on payload");
  }

  const page1 = await getCollectionFilterPayload({
    shopDomain: SHOP_DOMAIN,
    collectionGid: COLLECTION_GID,
    selected: {},
    page: 1,
    pageSize: 2,
  });
  if ((page1.data?.products ?? []).length !== 2) {
    fail(`page 1 pageSize 2 expected 2 products, got ${page1.data?.products?.length}`);
  }
  if (page1.data?.total !== 5) fail("paged payload total must stay 5");
  if (page1.data?.page !== 1 || page1.data?.pageSize !== 2) {
    fail("page/pageSize missing on paged payload");
  }
  if (page1.data?.hasNext !== true) fail("page 1 of 3 should have hasNext true");
  if ((page1.data?.facets ?? []).length !== (all.data?.facets ?? []).length) {
    fail("facets must be computed on the full filtered set, not the page");
  }

  const page3 = await getCollectionFilterPayload({
    shopDomain: SHOP_DOMAIN,
    collectionGid: COLLECTION_GID,
    selected: {},
    page: 3,
    pageSize: 2,
  });
  if ((page3.data?.products ?? []).length !== 1) {
    fail(`page 3 pageSize 2 expected 1 product, got ${page3.data?.products?.length}`);
  }
  if (page3.data?.hasNext !== false) fail("last page should have hasNext false");
  if (page3.data?.total !== 5) fail("last page total must stay 5");

  const searchAll = await getSearchFilterPayload({
    shopDomain: SHOP_DOMAIN,
    query: "D9 Item",
    selected: {},
  });
  if ((searchAll.data?.products ?? []).length !== 5) {
    fail(
      `search without pageSize expected 5, got ${searchAll.data?.products?.length}`,
    );
  }
  const searchPage = await getSearchFilterPayload({
    shopDomain: SHOP_DOMAIN,
    query: "D9 Item",
    selected: {},
    page: 1,
    pageSize: 2,
  });
  if ((searchPage.data?.products ?? []).length !== 2 || searchPage.data?.total !== 5) {
    fail("getSearchFilterPayload must honor page/pageSize like collection");
  }
  if (searchPage.data?.hasNext !== true) {
    fail("search page 1 should have hasNext true");
  }

  await cleanup();
  log.info("STEPD9_OK");
} catch (error) {
  await cleanup().catch(() => undefined);
  log.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
