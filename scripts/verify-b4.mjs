/**
 * B4 gate: search empty-results payload + Theme App Extension empty-state markers.
 * Usage: npm run verify:b4
 */
import "tsx/esm";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createPrismaClient } from "./prisma-runtime.mjs";
import { log } from "./terminal-log.mjs";

const SHOP_DOMAIN = "b4-verify.myshopify.com";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const prisma = createPrismaClient();

function fail(message) {
  throw new Error(message);
}

function readTheme(relPath) {
  return readFileSync(join(ROOT, relPath), "utf8");
}

function assertThemeMarkers() {
  const liquid = readTheme("extensions/smart-filter/blocks/product-search.liquid");
  const searchJs = readTheme("extensions/smart-filter/assets/smart-filter-search.js");
  const combined = `${liquid}\n${searchJs}`;

  if (!combined.includes("data-empty")) {
    fail("theme files missing data-empty");
  }
  if (!combined.includes("data-clear-query")) {
    fail("theme files missing data-clear-query");
  }

  const emptyCopy = /no products found|no matching products|no results/i;
  if (!emptyCopy.test(combined)) {
    fail('theme files missing "No products found" (or equivalent) empty copy');
  }

  const hasTry = /\btry\b/.test(searchJs);
  const hasCatch = /\bcatch\b/.test(searchJs);
  const jsonNearby =
    /try[\s\S]{0,400}JSON\.(parse|stringify)|JSON\.parse[\s\S]{0,200}catch|try[\s\S]{0,200}\.json\s*\(/m.test(
      searchJs,
    );
  if (!hasTry || !hasCatch || !jsonNearby) {
    fail("smart-filter-search.js missing try/catch around JSON");
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

  await prisma.productFacet.upsert({
    where: {
      shopId_productGid: {
        shopId: shop.id,
        productGid: "gid://shopify/Product/9404001",
      },
    },
    create: {
      shopId: shop.id,
      productGid: "gid://shopify/Product/9404001",
      handle: "b4-cotton-tee",
      title: "B4 Cotton Tee",
      vendor: "Findly Labs",
      productType: "Apparel",
      tags: ["b4-verify"],
      options: {},
      priceMin: 19.99,
      priceMax: 19.99,
      available: true,
      status: "ACTIVE",
      imageUrl: null,
      metafields: {},
    },
    update: {
      handle: "b4-cotton-tee",
      title: "B4 Cotton Tee",
      vendor: "Findly Labs",
      productType: "Apparel",
      status: "ACTIVE",
    },
  });

  return shop;
}

try {
  await cleanup();
  const shop = await seedShopData();
  log.info(`Seeded shop ${SHOP_DOMAIN} (id=${shop.id})`);

  assertThemeMarkers();
  log.info("theme empty-state markers present");

  const { getSearchPayload } = await import("../app/services/proxy.server.ts");

  const garbage = await getSearchPayload({
    shopDomain: SHOP_DOMAIN,
    query: "zzzxqgarbage999",
  });
  if (garbage.error) {
    fail(`garbage query should not throw/error: ${garbage.error}`);
  }
  if (garbage.status !== 200) {
    fail(`garbage query expected 200, got ${garbage.status}`);
  }
  if (!garbage.data || !Array.isArray(garbage.data.products)) {
    fail("garbage query must return products array");
  }
  if (garbage.data.products.length !== 0 || garbage.data.total !== 0) {
    fail(
      `garbage query expected products [] total 0, got total=${garbage.data.total} len=${garbage.data.products.length}`,
    );
  }
  log.info("garbage query returned empty results without throw");

  const control = await getSearchPayload({
    shopDomain: SHOP_DOMAIN,
    query: "Cotton Tee",
  });
  if (control.error || control.status !== 200) {
    fail(`control search failed: ${control.error ?? "bad status"}`);
  }
  if (!control.data.products.length || control.data.total < 1) {
    fail(
      `Cotton Tee expected at least 1 product, got total=${control.data.total}`,
    );
  }
  if (!control.data.products.some((p) => p.title === "B4 Cotton Tee")) {
    fail(
      `control expected B4 Cotton Tee, got ${JSON.stringify(control.data.products)}`,
    );
  }
  log.info("control query matched B4 Cotton Tee");

  log.success("STEPB4_OK empty search returns total 0; theme empty state present");
} catch (error) {
  log.error(`STEPB4_FAIL ${error.message}`);
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
