/**
 * F3 gate: storefront recommendation Theme App Extension block.
 * Usage: npm run verify:f3
 */
import "tsx/esm";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { log } from "./terminal-log.mjs";
import { REC_WIDGET_IDS } from "../app/utils/recommendations.ts";

const SHOP_DOMAIN = "f3-verify.myshopify.com";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const prisma = new PrismaClient();

function fail(message) {
  throw new Error(message);
}

function readRepo(...parts) {
  return readFileSync(join(ROOT, ...parts), "utf8");
}

function assertStaticMarkers() {
  const liquid = readRepo(
    "extensions",
    "smart-filter",
    "blocks",
    "product-recommendations.liquid",
  );
  for (const marker of [
    'class="smart-filter-recs"',
    'data-proxy-base="/apps/smart-filter"',
    'data-type="{{ block.settings.widget_type }}"',
    "data-heading=",
    "data-product-handle=",
    "data-locale=",
    'data-count-mobile="{{ block.settings.count_mobile }}"',
    '"javascript": "product-recommendations.js"',
    '"stylesheet": "product-recommendations.css"',
    '"target": "section"',
    '"new-products"',
  ]) {
    if (!liquid.includes(marker)) {
      fail(`product-recommendations.liquid missing ${marker}`);
    }
  }
  for (const template of ["index", "product", "collection", "cart", "page", "search"]) {
    if (!liquid.includes(`"${template}"`)) {
      fail(`product-recommendations.liquid missing enabled_on template ${template}`);
    }
  }
  for (const type of REC_WIDGET_IDS) {
    if (!liquid.includes(`"${type}"`)) {
      fail(`product-recommendations.liquid missing widget type ${type}`);
    }
  }

  const widget = readRepo(
    "extensions",
    "smart-filter",
    "assets",
    "product-recommendations.js",
  );
  for (const marker of [
    "findly:recently-viewed",
    "/recs?",
    "data-count-",
    "innerWidth",
    "--recs-cols",
    "enabled === false",
  ]) {
    if (!widget.includes(marker)) {
      fail(`product-recommendations.js missing ${marker}`);
    }
  }

  const css = readRepo(
    "extensions",
    "smart-filter",
    "assets",
    "product-recommendations.css",
  );
  if (!css.includes(".smart-filter-recs") || !css.includes("grid-template-columns")) {
    fail("product-recommendations.css missing scoped grid");
  }

  const locale = readRepo("extensions", "smart-filter", "locales", "en.default.json");
  const schemaLocale = readRepo(
    "extensions",
    "smart-filter",
    "locales",
    "en.default.schema.json",
  );
  if (!locale.includes('"product_recommendations"')) {
    fail("en.default.json missing product_recommendations");
  }
  if (!schemaLocale.includes('"product_recommendations"')) {
    fail("en.default.schema.json missing product_recommendations");
  }

  readRepo("app", "routes", "apps.smart-filter.recs.tsx");
  log.info("F3 static markers present");
}

async function seedProduct(shopId, { gid, handle, title, publishedAt }) {
  await prisma.productFacet.create({
    data: {
      shopId,
      productGid: gid,
      handle,
      title,
      vendor: "Findly",
      productType: "Recs",
      tags: [],
      options: {},
      priceMin: 10,
      priceMax: 10,
      available: true,
      status: "ACTIVE",
      imageUrl: "https://cdn.example/img.jpg",
      publishedAt,
    },
  });
}

async function cleanup() {
  await prisma.shop.deleteMany({ where: { domain: SHOP_DOMAIN } });
}

try {
  await cleanup();
  assertStaticMarkers();

  const shop = await prisma.shop.create({
    data: { domain: SHOP_DOMAIN, plan: "free" },
  });
  await prisma.appSettings.create({
    data: {
      shopId: shop.id,
      adminExtras: {
        recs: {
          on: {
            "new-products": true,
            "hand-picked-related-products": true,
          },
          counts: { mobile: 2, tablet: 3, desktop: 4 },
          related: {
            "current-handle": ["related-alpha", "related-beta"],
          },
        },
      },
    },
  });

  await seedProduct(shop.id, {
    gid: "gid://shopify/Product/f3-current",
    handle: "current-handle",
    title: "Current Product",
    publishedAt: new Date("2026-08-01T00:00:00.000Z"),
  });
  await seedProduct(shop.id, {
    gid: "gid://shopify/Product/f3-new",
    handle: "newest-item",
    title: "Newest Item",
    publishedAt: new Date("2026-08-19T00:00:00.000Z"),
  });
  await seedProduct(shop.id, {
    gid: "gid://shopify/Product/f3-alpha",
    handle: "related-alpha",
    title: "Related Alpha",
    publishedAt: new Date("2026-07-01T00:00:00.000Z"),
  });
  await seedProduct(shop.id, {
    gid: "gid://shopify/Product/f3-beta",
    handle: "related-beta",
    title: "Related Beta",
    publishedAt: new Date("2026-07-02T00:00:00.000Z"),
  });

  const { recsPayload } = await import("../app/services/recommendations.server.ts");

  const disabled = await recsPayload({
    shopDomain: SHOP_DOMAIN,
    type: "best-sellers",
  });
  if ("error" in disabled && disabled.error) fail(disabled.error);
  if (disabled.data?.enabled !== false) {
    fail("best-sellers should be disabled when recs.on is false");
  }

  const newest = await recsPayload({
    shopDomain: SHOP_DOMAIN,
    type: "new-products",
    productHandle: "current-handle",
    limit: 4,
  });
  if ("error" in newest && newest.error) fail(newest.error);
  if (newest.data?.enabled !== true) fail("new-products should be enabled");
  const newestHandles = (newest.data?.products ?? []).map((row) => row.handle);
  if (!newestHandles.includes("newest-item")) {
    fail(`new-products expected newest-item, got ${JSON.stringify(newestHandles)}`);
  }
  if (newestHandles.includes("current-handle")) {
    fail("new-products should exclude the current product handle");
  }

  const picked = await recsPayload({
    shopDomain: SHOP_DOMAIN,
    type: "hand-picked-related-products",
    productHandle: "current-handle",
    limit: 4,
  });
  if ("error" in picked && picked.error) fail(picked.error);
  if (picked.data?.enabled !== true) fail("hand-picked-related-products should be enabled");
  const pickedHandles = (picked.data?.products ?? []).map((row) => row.handle);
  if (pickedHandles[0] !== "related-alpha" || pickedHandles[1] !== "related-beta") {
    fail(
      `hand-picked-related-products expected related-alpha, related-beta, got ${JSON.stringify(pickedHandles)}`,
    );
  }

  const homeNewest = await recsPayload({
    shopDomain: SHOP_DOMAIN,
    type: "new-products",
    limit: 4,
  });
  if ("error" in homeNewest && homeNewest.error) fail(homeNewest.error);
  if (!homeNewest.data?.products?.length) {
    fail("new-products on home (no product handle) should return products");
  }

  await cleanup();
  log.info("STEPF3_OK");
} catch (error) {
  await cleanup().catch(() => undefined);
  log.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
