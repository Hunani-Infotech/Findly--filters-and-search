/**
 * C9 gate: empty-query + no-result pinned suggestions (not AI / synonyms).
 * Usage: npm run verify:c9
 */
import "tsx/esm";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createPrismaClient } from "./prisma-runtime.mjs";
import { log } from "./terminal-log.mjs";

const SHOP_DOMAIN = "c9-verify.myshopify.com";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const GARBAGE_Q = "zzzz-no-match-c9-xxxx";

const prisma = createPrismaClient();

function fail(message) {
  throw new Error(message);
}

function suggestionTitles(payload) {
  return (payload.data?.suggestions ?? []).map((row) => row.title);
}

function collectionHandles(payload) {
  return (payload.data?.collections ?? []).map((row) => row.handle);
}

function suggestionsEmpty(payload) {
  const list = payload.data?.suggestions;
  return !list || list.length === 0;
}

function assertStaticMarkers() {
  const appSettings = readFileSync(join(ROOT, "app/utils/app-settings.ts"), "utf8");
  const settingsPage = readFileSync(
    join(ROOT, "app/routes/app.settings.tsx"),
    "utf8",
  );
  const searchPage = readFileSync(
    join(ROOT, "app/routes/app.search._index.tsx"),
    "utf8",
  );
  const searchUi = `${settingsPage}\n${searchPage}`;
  const liquid = readFileSync(
    join(ROOT, "extensions/smart-filter/blocks/product-search.liquid"),
    "utf8",
  );
  const searchJs = readFileSync(
    join(ROOT, "extensions/smart-filter/assets/smart-filter-search.js"),
    "utf8",
  );
  const proxy = readFileSync(join(ROOT, "app/services/proxy.server.ts"), "utf8");
  const searchServer = readFileSync(join(ROOT, "app/services/search.server.ts"), "utf8");

  if (!appSettings.includes("SUGGESTION_LIST_MAX")) {
    fail("app-settings.ts missing SUGGESTION_LIST_MAX");
  }
  if (!appSettings.includes("normalizeHandleList")) {
    fail("app-settings.ts missing normalizeHandleList");
  }
  if (!searchUi.includes("showSuggestionsOnEmptyQuery")) {
    fail("Search settings missing showSuggestionsOnEmptyQuery");
  }
  if (!searchUi.includes("showSuggestionsOnNoResults")) {
    fail("Search settings missing showSuggestionsOnNoResults");
  }
  if (!searchUi.includes("suggestionProductHandles")) {
    fail("Search settings missing suggestionProductHandles");
  }
  if (!liquid.includes("data-suggestions")) {
    fail("product-search.liquid missing data-suggestions");
  }
  if (!searchJs.includes("data-suggestions")) {
    fail("smart-filter-search.js missing data-suggestions");
  }
  const emptyQueryFetch =
    /fetchSearch\(\s*["']["']\s*\)/.test(searchJs) ||
    /!\s*query[\s\S]{0,250}fetchSearch\s*\(/.test(searchJs) ||
    /query\s*===\s*["']["'][\s\S]{0,200}fetchSearch\s*\(/.test(searchJs) ||
    /trim\(\)[\s\S]{0,120}fetchSearch\s*\(\s*query\s*\)/.test(searchJs);
  if (!emptyQueryFetch) {
    fail(
      'smart-filter-search.js must call fetchSearch on empty query (e.g. fetchSearch(""))',
    );
  }
  if (!searchJs.includes("data-empty")) {
    fail("smart-filter-search.js missing data-empty (B4)");
  }
  const hasTry = /\btry\b/.test(searchJs);
  const hasCatch = /\bcatch\b/.test(searchJs);
  const jsonNearby =
    /try[\s\S]{0,400}JSON\.(parse|stringify)|JSON\.parse[\s\S]{0,200}catch|try[\s\S]{0,200}\.json\s*\(/m.test(
      searchJs,
    );
  if (!hasTry || !hasCatch || !jsonNearby) {
    fail("smart-filter-search.js missing try/catch around JSON.parse (B4)");
  }

  const backend = `${proxy}\n${searchServer}`;
  if (
    !backend.includes("getPinnedSearchSuggestions") &&
    !backend.includes("suggestions")
  ) {
    fail(
      "proxy.server.ts or search.server.ts must include getPinnedSearchSuggestions or suggestions",
    );
  }
}

async function cleanup() {
  await prisma.shop.deleteMany({ where: { domain: SHOP_DOMAIN } });
}

async function upsertProduct(shopId, product) {
  await prisma.productFacet.upsert({
    where: {
      shopId_productGid: { shopId, productGid: product.productGid },
    },
    create: {
      shopId,
      productType: "Apparel",
      vendor: "Findly Labs",
      tags: [],
      skus: [],
      options: {},
      priceMin: 19.99,
      priceMax: 19.99,
      available: true,
      status: "ACTIVE",
      imageUrl: null,
      metafields: {},
      ...product,
    },
    update: {
      handle: product.handle,
      title: product.title,
      status: product.status ?? "ACTIVE",
    },
  });
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
      showSuggestionsOnEmptyQuery: true,
      showSuggestionsOnNoResults: true,
      suggestionProductHandles: [
        "c9-cotton-tee",
        "not-a-real-handle",
        "c9-draft-tee",
      ],
      suggestionCollectionHandles: ["c9-summer"],
    },
    update: {
      showSuggestionsOnEmptyQuery: true,
      showSuggestionsOnNoResults: true,
      suggestionProductHandles: [
        "c9-cotton-tee",
        "not-a-real-handle",
        "c9-draft-tee",
      ],
      suggestionCollectionHandles: ["c9-summer"],
    },
  });

  await prisma.collection.create({
    data: {
      shopId: shop.id,
      collectionGid: "gid://shopify/Collection/9909001",
      handle: "c9-summer",
      title: "C9 Summer",
    },
  });

  await upsertProduct(shop.id, {
    productGid: "gid://shopify/Product/9909001",
    handle: "c9-cotton-tee",
    title: "C9 Cotton Tee",
    status: "ACTIVE",
  });
  await upsertProduct(shop.id, {
    productGid: "gid://shopify/Product/9909002",
    handle: "c9-trail-jacket",
    title: "C9 Trail Jacket",
    status: "ACTIVE",
  });
  await upsertProduct(shop.id, {
    productGid: "gid://shopify/Product/9909003",
    handle: "c9-draft-tee",
    title: "C9 Draft Tee",
    status: "DRAFT",
  });

  return shop;
}

try {
  assertStaticMarkers();
  await cleanup();
  const shop = await seedShopData();
  log.info(`Seeded shop ${SHOP_DOMAIN} (id=${shop.id})`);

  const { getSearchPayload } = await import("../app/services/proxy.server.ts");
  const { saveAppSettings, getAppSettings } = await import("../app/services/settings.server.ts"
  );
  const { normalizeHandleList, SUGGESTION_LIST_MAX } = await import("../app/utils/app-settings.ts"
  );

  const empty = await getSearchPayload({ shopDomain: SHOP_DOMAIN, query: "" });
  if (empty.error) {
    fail(`empty query should not error: ${empty.error}`);
  }
  if (!empty.data || !Array.isArray(empty.data.products)) {
    fail("empty query must return products array");
  }
  if (empty.data.products.length !== 0 || empty.data.total !== 0) {
    fail(
      `empty q expected products [] total 0 (B1), got total=${empty.data.total} len=${empty.data.products.length}`,
    );
  }
  const emptyTitles = suggestionTitles(empty);
  if (!emptyTitles.includes("C9 Cotton Tee")) {
    fail(
      `empty q suggestions must include C9 Cotton Tee, got ${JSON.stringify(emptyTitles)}`,
    );
  }
  if (emptyTitles.some((title) => /draft/i.test(title))) {
    fail(`empty q suggestions must not include draft, got ${JSON.stringify(emptyTitles)}`);
  }
  if (!collectionHandles(empty).includes("c9-summer")) {
    fail(
      `empty q collections must include c9-summer, got ${JSON.stringify(collectionHandles(empty))}`,
    );
  }
  log.info("empty q: no products, pinned ACTIVE tee + summer collection");

  let garbage;
  try {
    garbage = await getSearchPayload({
      shopDomain: SHOP_DOMAIN,
      query: GARBAGE_Q,
    });
  } catch (err) {
    fail(`garbage query must not throw: ${err.message}`);
  }
  if (garbage.error) {
    fail(`garbage query should not error: ${garbage.error}`);
  }
  if (!garbage.data || garbage.data.products.length !== 0) {
    fail(
      `garbage q expected products [], got ${JSON.stringify(garbage.data?.products)}`,
    );
  }
  if (!suggestionTitles(garbage).includes("C9 Cotton Tee")) {
    fail(
      `garbage q suggestions must include C9 Cotton Tee, got ${JSON.stringify(suggestionTitles(garbage))}`,
    );
  }
  log.info("garbage q: empty products + suggestions, no throw");

  await saveAppSettings(shop.id, {
    showSuggestionsOnEmptyQuery: false,
    showSuggestionsOnNoResults: true,
  });
  const emptyOff = await getSearchPayload({
    shopDomain: SHOP_DOMAIN,
    query: "",
  });
  if (!suggestionsEmpty(emptyOff)) {
    fail(
      `empty q with empty-toggle off must have no suggestions, got ${JSON.stringify(suggestionTitles(emptyOff))}`,
    );
  }
  const garbageOn = await getSearchPayload({
    shopDomain: SHOP_DOMAIN,
    query: GARBAGE_Q,
  });
  if (!suggestionTitles(garbageOn).includes("C9 Cotton Tee")) {
    fail("garbage q with no-results on must still have suggestions");
  }
  log.info("empty toggle off: empty q silent; garbage still suggests");

  await saveAppSettings(shop.id, {
    showSuggestionsOnEmptyQuery: false,
    showSuggestionsOnNoResults: false,
  });
  const bothEmpty = await getSearchPayload({
    shopDomain: SHOP_DOMAIN,
    query: "",
  });
  const bothGarbage = await getSearchPayload({
    shopDomain: SHOP_DOMAIN,
    query: GARBAGE_Q,
  });
  if (!suggestionsEmpty(bothEmpty) || !suggestionsEmpty(bothGarbage)) {
    fail("both toggles off must yield no suggestions for empty and garbage q");
  }
  log.info("both toggles off: no suggestions");

  const nineHandles = [
    "c9-h1",
    "c9-h2",
    "c9-h3",
    "c9-h4",
    "c9-h5",
    "c9-h6",
    "c9-h7",
    "c9-h8",
    "c9-h9",
  ];
  const normalizedNine = normalizeHandleList(nineHandles);
  if (normalizedNine.length !== 8) {
    fail(
      `normalizeHandleList of 9 items expected length ${SUGGESTION_LIST_MAX}=8, got ${normalizedNine.length}`,
    );
  }
  await saveAppSettings(shop.id, { suggestionProductHandles: nineHandles });
  const capped = await getAppSettings(shop.id);
  if (capped.suggestionProductHandles.length !== 8) {
    fail(
      `saveAppSettings must keep only 8 handles (SUGGESTION_LIST_MAX), got ${capped.suggestionProductHandles.length}`,
    );
  }
  log.info("SUGGESTION_LIST_MAX caps pin list at 8");

  const fromUrl = normalizeHandleList(["/products/C9-Cotton-Tee"]);
  if (fromUrl.length !== 1 || fromUrl[0] !== "c9-cotton-tee") {
    fail(
      `URL handle must normalize to c9-cotton-tee, got ${JSON.stringify(fromUrl)}`,
    );
  }
  log.info("normalizeHandleList strips /products/ URLs");

  log.success("STEPC9_OK empty + no-result suggestions");
} catch (error) {
  log.error(`STEPC9_FAIL ${error.message}`);
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
