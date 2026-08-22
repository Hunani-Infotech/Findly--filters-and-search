/**
 * E1 gate: Instant Search widget payload + keyword hit via getSearchPayload.
 * Usage: npm run verify:e1
 */
import "tsx/esm";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { log } from "./terminal-log.mjs";

const SHOP_DOMAIN = "e1-verify.myshopify.com";
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
    "instant-search.liquid",
  );
  if (!liquid.includes('"target": "body"') || !liquid.includes("findly-instant")) {
    fail("instant-search.liquid must be a body app embed with .findly-instant");
  }
  if (!liquid.includes("instant-search.js") || !liquid.includes("instant-search.css")) {
    fail("instant-search.liquid missing stylesheet/javascript assets");
  }

  const js = readRepo("extensions", "smart-filter", "assets", "instant-search.js");
  if (!js.includes(".smart-filter-search") || !js.includes("widget=1")) {
    fail("instant-search.js must ignore product-search and fetch widget=1");
  }
  if (!js.includes("AbortController") || !js.includes("maxProducts")) {
    fail("instant-search.js missing AbortController or maxProducts limit");
  }

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
  if (!setup.includes("Instant search") || !setup.toLowerCase().includes("app embeds")) {
    fail("Search settings must mention Instant search app embed");
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

  const { getInstantSearchWidgetPayload, getSearchPayload } = await import(
    "../app/proxy.server.ts"
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

  log.success("STEPE1_OK instant widget payload + Shirt search");
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
