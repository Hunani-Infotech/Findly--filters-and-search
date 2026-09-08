/**
 * F5 gate: Shopify Markets / multi-currency / B2B catalog prices.
 * Usage: npm run verify:f5
 */
import "tsx/esm";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createPrismaClient } from "./prisma-runtime.mjs";
import { log } from "./terminal-log.mjs";
import { seedFilterConfig } from "./seed-filter-config.mjs";
import {
  applyMarketPricesToRow,
  buildProductContextualPricesQuery,
  catalogKey,
  mergeProductMarketPrices,
  parseMarketContext,
  parseMarketCountryCodes,
  resolveMarketPrice,
} from "../app/services/markets.server.ts";

const SHOP_DOMAIN = "f5-verify.myshopify.com";
const COLLECTION_GID = "gid://shopify/Collection/9505001";
const PRODUCT_GID = "gid://shopify/Product/95050011";
const COMPANY_LOCATION = "gid://shopify/CompanyLocation/9505";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const prisma = createPrismaClient();

function fail(message) {
  throw new Error(message);
}

function titles(result) {
  return (result.data?.products ?? []).map((p) => p.title);
}

function readRepo(...parts) {
  return readFileSync(join(ROOT, ...parts), "utf8");
}

function assertStaticMarkers() {
  const schema = readRepo("prisma", "schema.prisma");
  if (!schema.includes("marketPrices") || !schema.includes("enableMarkets")) {
    fail("schema.prisma missing marketPrices / enableMarkets");
  }

  const markets = readRepo("app", "services", "markets.server.ts");
  for (const name of [
    "contextualPricing",
    "parseMarketContext",
    "resolveMarketPrice",
    "applyMarketPricesToRow",
    "MARKETS_LIST_QUERY",
    "COMPANY_LOCATIONS_QUERY",
    "companyLocationId",
  ]) {
    if (!markets.includes(name)) fail(`app/services/markets.server.ts missing ${name}`);
  }
  if (markets.includes('currency: "USD"') || markets.includes("currency: 'USD'")) {
    fail("markets.server.ts must not hardcode USD");
  }

  const sync = readRepo("app", "sync", "markets-sync.ts");
  if (
    !sync.includes("syncShopMarketPrices") ||
    !sync.includes("syncProductMarketPrices") ||
    !sync.includes("listMarketContexts")
  ) {
    fail("markets-sync.ts missing shop/product market price sync");
  }

  const ingest = readRepo("app", "sync", "sync.server.ts");
  if (
    !ingest.includes("syncShopMarketPrices") ||
    !ingest.includes("syncProductMarketPrices")
  ) {
    fail("sync.server.ts must call market price sync after ingest and upsert");
  }

  const proxy = readRepo("app", "services", "proxy.server.ts");
  if (
    !proxy.includes("applyMarketPricesToRow") ||
    !proxy.includes("parseMarketContext")
  ) {
    fail("proxy.server.ts must apply market prices before filtering");
  }

  const filtersRoute = readRepo("app", "routes", "apps.smart-filter.filters.tsx");
  if (
    !filtersRoute.includes("country") ||
    !filtersRoute.includes("company_location")
  ) {
    fail("filters proxy route must read country / company_location");
  }

  const widget = readRepo(
    "extensions",
    "smart-filter",
    "assets",
    "smart-filter.js",
  );
  if (
    !widget.includes('params.set("country"') ||
    !widget.includes("data-country") ||
    !widget.includes("company_location")
  ) {
    fail("smart-filter.js must send country / company_location");
  }
  if (widget.includes('currency: "USD"') || widget.includes("currency: 'USD'")) {
    fail("smart-filter.js must not hardcode USD");
  }

  const liquid = readRepo(
    "extensions",
    "smart-filter",
    "blocks",
    "collection-filters.liquid",
  );
  if (
    !liquid.includes("data-country") ||
    !liquid.includes("localization.country.iso_code") ||
    !liquid.includes("data-company-location")
  ) {
    fail("collection-filters.liquid missing market data attributes");
  }

  const settingsPage = readRepo("app", "routes", "app.settings.tsx");
  if (!settingsPage.includes("Enable Shopify Markets")) {
    fail("Settings missing Markets / multi-currency checkbox");
  }

  const toml = readRepo("shopify.app.toml");
  if (!toml.includes("read_markets")) {
    fail("shopify.app.toml missing read_markets");
  }

  log.info("F5 static markers present");
}

function assertResolvers() {
  const map = {
    US: { min: 10, max: 12, currency: "USD" },
    CA: { min: 20, max: 24, currency: "CAD" },
    [catalogKey(COMPANY_LOCATION)]: { min: 5, max: 5, currency: "USD" },
  };
  const shop = { min: 10, max: 12 };

  const us = resolveMarketPrice(map, shop, parseMarketContext({ country: "US" }));
  if (us.min !== 10 || us.currency !== "USD") {
    fail(`US market price expected 10 USD, got ${us.min} ${us.currency}`);
  }
  const ca = resolveMarketPrice(map, shop, parseMarketContext({ country: "ca" }));
  if (ca.min !== 20 || ca.currency !== "CAD") {
    fail(`CA market price expected 20 CAD, got ${ca.min} ${ca.currency}`);
  }
  const b2b = resolveMarketPrice(
    map,
    shop,
    parseMarketContext({
      country: "CA",
      companyLocationId: COMPANY_LOCATION,
    }),
  );
  if (b2b.min !== 5) {
    fail(`B2B catalog should win over country price, got ${b2b.min}`);
  }

  const codes = parseMarketCountryCodes({
    data: {
      markets: {
        nodes: [
          {
            status: "ACTIVE",
            conditions: {
              regionsCondition: {
                regions: { nodes: [{ code: "US" }, { code: "CA" }] },
              },
            },
          },
          { status: "DRAFT", conditions: { regionsCondition: { regions: { nodes: [{ code: "GB" }] } } } },
        ],
      },
    },
  });
  if (!codes.includes("US") || !codes.includes("CA") || codes.includes("GB")) {
    fail(`parseMarketCountryCodes expected US+CA, got ${codes}`);
  }

  const { query, aliases } = buildProductContextualPricesQuery(
    [PRODUCT_GID],
    ["US", "CA"],
    [COMPANY_LOCATION],
  );
  if (
    !query.includes("contextualPricing") ||
    !query.includes("country: US") ||
    !query.includes("country: CA") ||
    !query.includes(COMPANY_LOCATION)
  ) {
    fail("contextual pricing query must include US/CA/companyLocationId");
  }
  if (!aliases.includes("p0")) fail("contextual query missing p0 alias");

  const merged = mergeProductMarketPrices(
    {
      id: PRODUCT_GID,
      cUS: {
        minVariantPricing: { price: { amount: "10.00", currencyCode: "USD" } },
        maxVariantPricing: { price: { amount: "12.00", currencyCode: "USD" } },
      },
      cCA: {
        minVariantPricing: { price: { amount: "20.00", currencyCode: "CAD" } },
        maxVariantPricing: { price: { amount: "24.00", currencyCode: "CAD" } },
      },
      loc0: {
        minVariantPricing: { price: { amount: "5.00", currencyCode: "USD" } },
        maxVariantPricing: { price: { amount: "5.00", currencyCode: "USD" } },
      },
    },
    [COMPANY_LOCATION],
  );
  if (merged.US?.min !== 10 || merged.CA?.min !== 20) {
    fail(`mergeProductMarketPrices country bands wrong: ${JSON.stringify(merged)}`);
  }
  if (merged[catalogKey(COMPANY_LOCATION)]?.min !== 5) {
    fail("mergeProductMarketPrices missing B2B catalog band");
  }

  const applied = applyMarketPricesToRow(
    { priceMin: 10, priceMax: 12 },
    map,
    parseMarketContext({ country: "CA" }),
    true,
  );
  if (applied.priceMin !== 20) fail("applyMarketPricesToRow should rewrite CA price");
  const off = applyMarketPricesToRow(
    { priceMin: 10, priceMax: 12 },
    map,
    parseMarketContext({ country: "CA" }),
    false,
  );
  if (off.priceMin !== 10) fail("enableMarkets=false must keep shop default price");

  log.info("F5 price resolvers OK");
}

async function cleanup() {
  await prisma.shop.deleteMany({ where: { domain: SHOP_DOMAIN } });
}

try {
  await cleanup();
  assertStaticMarkers();
  assertResolvers();

  const shop = await prisma.shop.create({
    data: { domain: SHOP_DOMAIN, plan: "free" },
  });

  await prisma.appSettings.upsert({
    where: { shopId: shop.id },
    create: { shopId: shop.id, enableMarkets: true },
    update: { enableMarkets: true },
  });

  await seedFilterConfig(prisma, shop.id, {
    collectionGid: COLLECTION_GID,
    enabled: true,
    enablePrice: true,
    enableAvailability: false,
    enableVendor: false,
    enableProductType: false,
    enableTags: false,
    enableOptions: false,
    enableSale: false,
  });

  await prisma.productFacet.create({
    data: {
      shopId: shop.id,
      productGid: PRODUCT_GID,
      handle: "market-tee",
      title: "Market Tee",
      vendor: "Acme",
      productType: "Apparel",
      tags: [],
      options: {},
      priceMin: 10,
      priceMax: 12,
      available: true,
      status: "ACTIVE",
      imageUrl: null,
      metafields: {},
      marketPrices: {
        US: { min: 10, max: 12, currency: "USD" },
        CA: { min: 20, max: 24, currency: "CAD" },
        [catalogKey(COMPANY_LOCATION)]: { min: 5, max: 5, currency: "USD" },
      },
    },
  });
  await prisma.collectionMembership.create({
    data: {
      shopId: shop.id,
      collectionGid: COLLECTION_GID,
      productGid: PRODUCT_GID,
      position: 0,
    },
  });

  const { getCollectionFilterPayload } = await import("../app/services/proxy.server.ts");

  const usCheap = await getCollectionFilterPayload({
    shopDomain: SHOP_DOMAIN,
    collectionGid: COLLECTION_GID,
    selected: { price: ["0", "12"] },
    country: "US",
    currency: "USD",
  });
  if (!titles(usCheap).includes("Market Tee")) {
    fail("US market $10 product must match price 0–12");
  }
  if (usCheap.data?.settings?.currency !== "USD") {
    fail(`US payload currency should be USD, got ${usCheap.data?.settings?.currency}`);
  }

  const caCheap = await getCollectionFilterPayload({
    shopDomain: SHOP_DOMAIN,
    collectionGid: COLLECTION_GID,
    selected: { price: ["0", "12"] },
    country: "CA",
    currency: "CAD",
  });
  if (titles(caCheap).includes("Market Tee")) {
    fail("CA market $20 product must NOT match price 0–12");
  }

  const caFull = await getCollectionFilterPayload({
    shopDomain: SHOP_DOMAIN,
    collectionGid: COLLECTION_GID,
    selected: { price: ["0", "30"] },
    country: "CA",
    currency: "CAD",
  });
  if (!titles(caFull).includes("Market Tee")) {
    fail("CA market $20 product must match price 0–30");
  }
  const caPrice = caFull.data?.products?.[0]?.priceMin;
  if (Number(caPrice) !== 20) {
    fail(`CA product priceMin should be 20, got ${caPrice}`);
  }
  if (caFull.data?.settings?.currency !== "CAD") {
    fail(`CA payload currency should be CAD, got ${caFull.data?.settings?.currency}`);
  }

  const b2b = await getCollectionFilterPayload({
    shopDomain: SHOP_DOMAIN,
    collectionGid: COLLECTION_GID,
    selected: { price: ["0", "12"] },
    country: "CA",
    currency: "CAD",
    companyLocationId: COMPANY_LOCATION,
  });
  if (!titles(b2b).includes("Market Tee")) {
    fail("B2B catalog $5 must match price 0–12 even when country is CA");
  }

  await prisma.appSettings.update({
    where: { shopId: shop.id },
    data: { enableMarkets: false },
  });
  const off = await getCollectionFilterPayload({
    shopDomain: SHOP_DOMAIN,
    collectionGid: COLLECTION_GID,
    selected: { price: ["0", "12"] },
    country: "CA",
    currency: "CAD",
  });
  if (!titles(off).includes("Market Tee")) {
    fail("enableMarkets=false must use shop default $10 and match 0–12");
  }

  await cleanup();
  log.success("STEPF5_OK price filter uses market / B2B catalog prices");
} catch (error) {
  await cleanup().catch(() => {});
  log.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
