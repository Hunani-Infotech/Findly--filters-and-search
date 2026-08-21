/**
 * D10 gate: hide products by tag; hide total product count.
 * Usage: npm run verify:d10
 */
import "tsx/esm";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { log } from "./terminal-log.mjs";
import { seedFilterConfig } from "./seed-filter-config.mjs";

const SHOP_DOMAIN = "d10-verify.myshopify.com";
const COLLECTION_GID = "gid://shopify/Collection/9101001";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const prisma = new PrismaClient();

function fail(message) {
  throw new Error(message);
}

function handles(result) {
  return (result.data?.products ?? []).map((p) => p.handle).sort();
}

function readRepo(...parts) {
  return readFileSync(join(ROOT, ...parts), "utf8");
}

function assertStaticMarkers() {
  const schema = readRepo("prisma", "schema.prisma");
  if (
    !schema.includes("hideProductTags") ||
    !schema.includes("showTotalProductCount")
  ) {
    fail("schema missing hideProductTags / showTotalProductCount");
  }
  const settingsPage = readRepo("app", "routes", "app.settings.tsx");
  if (
    !settingsPage.includes("Hide products by tags") ||
    !settingsPage.includes("Show the number of total products")
  ) {
    fail("Settings General/Product visibility missing D10 fields");
  }
  const filters = readRepo("app", "filters.ts");
  if (!filters.includes("excludeHiddenTaggedProducts")) {
    fail("filters.ts missing excludeHiddenTaggedProducts");
  }
  const widget = readRepo("extensions", "smart-filter", "assets", "smart-filter.js");
  if (
    !widget.includes("showTotalProductCount") ||
    !widget.includes("applyThemeProductCountVisibility")
  ) {
    fail("smart-filter.js missing total-count hide path");
  }
  log.info("D10 static markers present");
}

async function cleanup() {
  await prisma.shop.deleteMany({ where: { domain: SHOP_DOMAIN } });
}

try {
  await cleanup();
  assertStaticMarkers();

  const { excludeHiddenTaggedProducts } = await import("../app/filters.ts");
  const { normalizeHideProductTags } = await import("../app/app-settings.ts");
  const mixed = excludeHiddenTaggedProducts(
    [
      { handle: "keep", tags: ["sale"] },
      { handle: "drop", tags: ["Hidden-Product"] },
      { handle: "also-keep", tags: [] },
    ],
    normalizeHideProductTags("hidden-product"),
  );
  if (mixed.map((row) => row.handle).join(",") !== "keep,also-keep") {
    fail("case-insensitive hide-tag filter should drop Hidden-Product");
  }

  const shop = await prisma.shop.create({
    data: { domain: SHOP_DOMAIN, plan: "free" },
  });

  await seedFilterConfig(prisma, shop.id, {
    collectionGid: COLLECTION_GID,
    enabled: true,
    enableVendor: true,
    enablePrice: false,
    enableAvailability: false,
    enableProductType: false,
    enableTags: false,
    enableOptions: false,
    enableSale: false,
    enableRating: false,
  });

  const products = [
    {
      gid: "gid://shopify/Product/91010011",
      handle: "visible-shirt",
      title: "Visible Shirt",
      vendor: "Acme",
      tags: ["sale"],
    },
    {
      gid: "gid://shopify/Product/91010012",
      handle: "hidden-hoodie",
      title: "Hidden Hoodie",
      vendor: "HiddenCo",
      tags: ["hidden-product"],
    },
    {
      gid: "gid://shopify/Product/91010013",
      handle: "visible-pants",
      title: "Visible Pants",
      vendor: "Acme",
      tags: [],
    },
  ];

  for (const product of products) {
    await prisma.productFacet.create({
      data: {
        shopId: shop.id,
        productGid: product.gid,
        handle: product.handle,
        title: product.title,
        vendor: product.vendor,
        productType: "Apparel",
        tags: product.tags,
        options: {},
        priceMin: 20,
        priceMax: 20,
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
        productGid: product.gid,
        position: 0,
      },
    });
  }

  const { saveAppSettings, getAppSettings } = await import(
    "../app/settings.server.ts"
  );
  await saveAppSettings(shop.id, {
    hideProductTags: ["hidden-product"],
    showTotalProductCount: false,
  });
  const stored = await getAppSettings(shop.id);
  if (stored.hideProductTags.join(",") !== "hidden-product") {
    fail(`hideProductTags did not persist, got ${stored.hideProductTags}`);
  }
  if (stored.showTotalProductCount !== false) {
    fail("showTotalProductCount false did not persist");
  }

  const { getCollectionFilterPayload, getSearchPayload } = await import(
    "../app/proxy.server.ts"
  );

  const collection = await getCollectionFilterPayload({
    shopDomain: SHOP_DOMAIN,
    collectionGid: COLLECTION_GID,
    selected: {},
  });
  const collectionHandles = handles(collection);
  if (collectionHandles.join(",") !== "visible-pants,visible-shirt") {
    fail(
      `collection should omit hidden-hoodie, got ${collectionHandles.join(",")}`,
    );
  }
  if (collection.data?.total !== 2) {
    fail(`collection total should be 2, got ${collection.data?.total}`);
  }
  if (collection.data?.settings?.showTotalProductCount !== false) {
    fail("payload settings.showTotalProductCount should be false");
  }
  const vendorFacet = (collection.data?.facets ?? []).find(
    (facet) => facet.key === "vendor",
  );
  const vendorValues = (vendorFacet?.values ?? []).map((item) => item.value);
  if (vendorValues.includes("HiddenCo")) {
    fail("facet aggregations should not include a fully hidden vendor");
  }

  const search = await getSearchPayload({
    shopDomain: SHOP_DOMAIN,
    query: "hoodie",
  });
  const searchHandles = (search.data?.products ?? []).map((p) => p.handle);
  if (searchHandles.includes("hidden-hoodie")) {
    fail("search/instant payload still returned the hidden-product tagged item");
  }

  const searchVisible = await getSearchPayload({
    shopDomain: SHOP_DOMAIN,
    query: "visible",
  });
  const visibleSearch = (searchVisible.data?.products ?? [])
    .map((p) => p.handle)
    .sort();
  if (visibleSearch.join(",") !== "visible-pants,visible-shirt") {
    fail(`search for visible should return two products, got ${visibleSearch}`);
  }

  log.info("STEPD10_OK");
} catch (error) {
  log.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  await cleanup();
  await prisma.$disconnect();
}
