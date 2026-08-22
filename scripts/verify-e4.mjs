/**
 * E4 gate: typo tolerance, stop words, fallback search, Did you mean.
 * Usage: npm run verify:e4
 */
import "tsx/esm";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { log } from "./terminal-log.mjs";

const SHOP_DOMAIN = "e4-verify.myshopify.com";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const prisma = new PrismaClient();

function fail(message) {
  throw new Error(message);
}

function readRepo(...parts) {
  return readFileSync(join(ROOT, ...parts), "utf8");
}

function productTitles(payload) {
  return (payload.data?.products ?? []).map((row) => row.title);
}

function assertStaticMarkers() {
  const queryPath = join(ROOT, "app", "search-query.ts");
  const querySrc = existsSync(queryPath)
    ? readRepo("app", "search-query.ts")
    : readRepo("app", "search.server.ts");
  if (
    !querySrc.includes("maxTypoDistance") ||
    !querySrc.includes("prepareSearchTokens") ||
    !querySrc.includes("DEFAULT_STOP_WORDS")
  ) {
    fail(
      "search-query.ts (or search.server.ts) must include maxTypoDistance, prepareSearchTokens, and DEFAULT_STOP_WORDS",
    );
  }

  const searchServer = readRepo("app", "search.server.ts");
  if (
    !searchServer.includes("searchProductsWithMeta") &&
    !searchServer.includes("prepareSearchTokens")
  ) {
    fail("search.server.ts must include searchProductsWithMeta or prepareSearchTokens");
  }

  const instant = readRepo("app", "instant-search.ts");
  if (
    !instant.includes("spellCheck") ||
    !instant.includes("fallbackSearch") ||
    !instant.includes("stopWords")
  ) {
    fail("instant-search.ts must include spellCheck, fallbackSearch, and stopWords");
  }

  const admin = readRepo("app", "routes", "app.search._index.tsx");
  if (!admin.includes("Stop words") && !admin.includes("stopWords")) {
    fail('Search settings must mention "Stop words" or stopWords');
  }

  const widget = readRepo(
    "extensions",
    "smart-filter",
    "assets",
    "instant-search.js",
  );
  if (!widget.includes("didYouMean")) {
    fail("instant-search.js must include didYouMean");
  }

  log.info("E4 static markers present");
}

async function loadQueryHelpers() {
  const queryPath = join(ROOT, "app", "search-query.ts");
  const mod = existsSync(queryPath)
    ? await import("../app/search-query.ts")
    : await import("../app/search.server.ts");
  return mod;
}

function assertHelpers(mod) {
  if (typeof mod.maxTypoDistance !== "function") {
    fail("maxTypoDistance is not exported");
  }
  if (typeof mod.editDistance !== "function") {
    fail("editDistance is not exported");
  }
  if (typeof mod.prepareSearchTokens !== "function") {
    fail("prepareSearchTokens is not exported");
  }
  if (mod.maxTypoDistance(3) !== 0) {
    fail(`maxTypoDistance(3) expected 0, got ${mod.maxTypoDistance(3)}`);
  }
  if (mod.maxTypoDistance(4) !== 1) {
    fail(`maxTypoDistance(4) expected 1, got ${mod.maxTypoDistance(4)}`);
  }
  if (mod.maxTypoDistance(6) !== 2) {
    fail(`maxTypoDistance(6) expected 2, got ${mod.maxTypoDistance(6)}`);
  }
  if (mod.editDistance("shrt", "shirt") !== 1) {
    fail(
      `editDistance("shrt","shirt") expected 1, got ${mod.editDistance("shrt", "shirt")}`,
    );
  }
  const tokens = mod.prepareSearchTokens("the red shirt");
  if (tokens.join(" ") !== "red shirt") {
    fail(
      `prepareSearchTokens("the red shirt") expected "red shirt", got ${JSON.stringify(tokens)}`,
    );
  }
  log.info("E4 query helpers unit-checked");
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

  await prisma.appSettings.upsert({
    where: { shopId: shop.id },
    create: {
      shopId: shop.id,
      searchFields: ["title"],
      searchExtras: {
        fuzzyTextSearch: true,
        spellCheck: true,
        fallbackSearch: true,
      },
    },
    update: {
      searchFields: ["title"],
      searchExtras: {
        fuzzyTextSearch: true,
        spellCheck: true,
        fallbackSearch: true,
      },
    },
  });

  const products = [
    {
      productGid: "gid://shopify/Product/9404001",
      handle: "blue-shirt",
      title: "Blue Shirt",
    },
    {
      productGid: "gid://shopify/Product/9404002",
      handle: "red-shirt",
      title: "Red Shirt",
    },
    {
      productGid: "gid://shopify/Product/9404003",
      handle: "green-pants",
      title: "Green Pants",
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
        vendor: "Acme",
        productType: "Apparel",
        tags: [],
        options: {},
        priceMin: 20,
        priceMax: 20,
        available: true,
        status: "ACTIVE",
        imageUrl: null,
        metafields: {},
      },
      update: {
        handle: product.handle,
        title: product.title,
        vendor: "Acme",
        productType: "Apparel",
        tags: [],
        status: "ACTIVE",
        available: true,
        priceMin: 20,
        priceMax: 20,
      },
    });
  }

  return shop;
}

try {
  assertStaticMarkers();
  const helpers = await loadQueryHelpers();
  assertHelpers(helpers);

  await cleanup();
  const shop = await seedShopData();
  log.info(`Seeded shop ${SHOP_DOMAIN} (id=${shop.id})`);

  const { getSearchPayload } = await import("../app/proxy.server.ts");

  const shrt = await getSearchPayload({
    shopDomain: SHOP_DOMAIN,
    query: "shrt",
  });
  if (shrt.error || shrt.status !== 200) {
    fail(`shrt search failed: ${shrt.error ?? "bad status"}`);
  }
  const shrtTitles = productTitles(shrt);
  if (!shrtTitles.includes("Blue Shirt") || !shrtTitles.includes("Red Shirt")) {
    fail(`q=shrt expected Blue Shirt and Red Shirt, got ${JSON.stringify(shrtTitles)}`);
  }
  if (shrtTitles.includes("Green Pants")) {
    fail(`q=shrt must not include Green Pants, got ${JSON.stringify(shrtTitles)}`);
  }

  if (String(shrt.data?.didYouMean || "").toLowerCase() !== "shirt") {
    fail(`didYouMean expected shirt, got ${JSON.stringify(shrt.data?.didYouMean)}`);
  }

  const red = await getSearchPayload({
    shopDomain: SHOP_DOMAIN,
    query: "the red shirt",
  });
  if (red.error || red.status !== 200) {
    fail(`the red shirt search failed: ${red.error ?? "bad status"}`);
  }
  const redTitles = productTitles(red);
  if (redTitles.length === 1 && redTitles[0] === "Red Shirt") {
    log.info("q=the red shirt returned exactly Red Shirt");
  } else if (
    redTitles.includes("Red Shirt") &&
    !redTitles.includes("Green Pants")
  ) {
    log.info(
      `q=the red shirt includes Red Shirt (not Green Pants): ${JSON.stringify(redTitles)}`,
    );
  } else {
    fail(
      `q=the red shirt expected Red Shirt (not Green Pants), got ${JSON.stringify(redTitles)}`,
    );
  }

  log.info("shrt finds shirt; the red shirt ignores the");
  log.info("STEPE4_OK");
} catch (error) {
  log.error(`STEPE4_FAIL ${error.message}`);
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
