/**
 * E1 gate: SearchExtras widget payload + keyword hit via getSearchPayload.
 * Instant search app embed was removed; storefront gates for instant-search.*
 * are intentionally skipped. Keeps proxy/admin payload checks for SearchExtras.
 * Usage: npm run verify:e1
 */
import "tsx/esm";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createPrismaClient } from "./prisma-runtime.mjs";
import { log } from "./terminal-log.mjs";

const SHOP_DOMAIN = "e1-verify.myshopify.com";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const prisma = createPrismaClient();

function fail(message) {
  throw new Error(message);
}

function readRepo(...parts) {
  return readFileSync(join(ROOT, ...parts), "utf8");
}

function assertStaticMarkers() {
  // Instant search app embed retired — do not require instant-search.liquid/js.
  const searchBlock = readRepo(
    "extensions",
    "smart-filter",
    "blocks",
    "product-search.liquid",
  );
  if (!searchBlock.includes("smart-filter-search") || !searchBlock.includes("data-search-input")) {
    fail("product-search.liquid must keep working");
  }

  const setup = readRepo("app", "routes", "app.search._index.tsx");
  if (!setup.includes("Pinnings") || !setup.includes("Synonyms")) {
    fail("Search settings must keep pinnings / synonyms preferences");
  }

  log.info("E1 static markers present");
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

  const products = [
    {
      productGid: "gid://shopify/Product/9102001",
      handle: "e1-red-shirt",
      title: "E1 Red Shirt",
      vendor: "Findly Labs",
      productType: "Apparel",
      status: "ACTIVE",
    },
    {
      productGid: "gid://shopify/Product/9102002",
      handle: "e1-blue-pants",
      title: "E1 Blue Pants",
      vendor: "Acme",
      productType: "Apparel",
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
        tags: ["e1-verify"],
        options: {},
        priceMin: 29.0,
        priceMax: 29.0,
        available: true,
        imageUrl: null,
        metafields: {},
      },
      update: {
        handle: product.handle,
        title: product.title,
        vendor: product.vendor,
        productType: product.productType,
        status: product.status,
      },
    });
  }

  return shop;
}

try {
  assertStaticMarkers();
  await cleanup();
  const shop = await seedShopData();
  log.info(`Seeded shop ${SHOP_DOMAIN} (id=${shop.id})`);

  const { getInstantSearchWidgetPayload, getSearchPayload } = await import("../app/services/proxy.server.ts"
  );

  const disabled = await getInstantSearchWidgetPayload({ shopDomain: SHOP_DOMAIN });
  if (disabled.error || disabled.status !== 200) {
    fail(`widget payload failed: ${disabled.error ?? "bad status"}`);
  }
  if (disabled.data.instant.enabled !== false) {
    fail(`default instant.enabled should be false, got ${disabled.data.instant.enabled}`);
  }
  log.info("default instant.enabled is false");

  await prisma.appSettings.upsert({
    where: { shopId: shop.id },
    create: {
      shopId: shop.id,
      searchExtras: { instant: { enabled: true } },
    },
    update: {
      searchExtras: { instant: { enabled: true } },
    },
  });

  const enabled = await getInstantSearchWidgetPayload({ shopDomain: SHOP_DOMAIN });
  if (enabled.data.instant.enabled !== true) {
    fail(`after save, instant.enabled should be true, got ${enabled.data.instant.enabled}`);
  }
  log.info("searchExtras.instant.enabled true → widget payload enabled");

  const shirt = await getSearchPayload({
    shopDomain: SHOP_DOMAIN,
    query: "Shirt",
  });
  if (shirt.error || shirt.status !== 200) {
    fail(`Shirt search failed: ${shirt.error ?? "bad status"}`);
  }
  if (!shirt.data.products.some((p) => p.title === "E1 Red Shirt")) {
    fail(`q=Shirt expected E1 Red Shirt, got ${JSON.stringify(shirt.data.products)}`);
  }
  log.info("q=Shirt returned E1 Red Shirt");

  const empty = await getSearchPayload({
    shopDomain: SHOP_DOMAIN,
    query: "",
  });
  if (empty.error) fail(`empty query should not error: ${empty.error}`);
  if (empty.data.total !== 0 || empty.data.products.length !== 0) {
    fail(`empty query must return total 0, got total=${empty.data.total}`);
  }
  log.info("empty query total 0");

  log.success("STEPE1_OK searchExtras widget payload + Shirt search");
} catch (error) {
  log.error(`STEPE1_FAIL ${error.message}`);
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
