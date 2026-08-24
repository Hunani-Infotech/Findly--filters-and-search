/**
 * B5 gate: launch E2E QA (A12 collection filters + search + billing + compliance).
 * Usage: npm run verify:b5
 */
import "tsx/esm";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { log } from "./terminal-log.mjs";
import { seedFilterConfig } from "./seed-filter-config.mjs";

const SHOP_A = "b5-verify.myshopify.com";
const SHOP_B = "b5-other.myshopify.com";
const COL_A = "gid://shopify/Collection/51001";
const COL_B = "gid://shopify/Collection/51002";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const prisma = new PrismaClient();

function fail(message) {
  throw new Error(message);
}

function read(relPath) {
  return readFileSync(join(ROOT, relPath), "utf8");
}

function titles(result) {
  return (result.data?.products ?? []).map((p) => p.title).sort();
}

function assertThemeSeoAndUi() {
  const filterJs = read("extensions/smart-filter/assets/smart-filter.js");
  const filterCss = read("extensions/smart-filter/assets/smart-filter.css");
  const collectionLiquid = read(
    "extensions/smart-filter/blocks/collection-filters.liquid",
  );
  const searchLiquid = read(
    "extensions/smart-filter/blocks/product-search.liquid",
  );
  const searchJs = read("extensions/smart-filter/assets/smart-filter-search.js");
  const searchCss = read(
    "extensions/smart-filter/assets/smart-filter-search.css",
  );
  const toml = read("shopify.app.toml");
  const shopifyServer = read("app/shopify.server.ts");
  const billing = read("app/billing.server.ts");
  const uninstall = read("app/routes/webhooks.app.uninstalled.tsx");
  const dataRequest = read("app/routes/webhooks.customers.data_request.tsx");
  const customerRedact = read("app/routes/webhooks.customers.redact.tsx");
  const shopRedact = read("app/routes/webhooks.shop.redact.tsx");
  const compliance = read("app/compliance.server.ts");

  if (!filterJs.includes('HASH_KEY = "sf"')) {
    fail("smart-filter.js missing HASH_KEY sf");
  }
  if (!filterJs.includes("pathname + url.search")) {
    fail("writeHash must keep pathname+search (hash-only filter state)");
  }
  if (/history\.(push|replace)State[\s\S]{0,200}\?sf=/.test(filterJs)) {
    fail("filter state must not be written as ?sf= query params");
  }
  if (!filterJs.includes("ensureThemeBridgeStyles")) {
    fail("smart-filter.js must inject global theme-bridge CSS for layout + hidden cards");
  }
  if (!filterJs.includes("setCardHidden")) {
    fail("smart-filter.js must hide product cards with inline display:none !important");
  }
  if (!filterJs.includes("bindNativeFacetGuard")) {
    fail("smart-filter.js must neutralize native Dawn/Horizon facet forms");
  }
  if (!filterJs.includes("stripNativeCollectionParams")) {
    fail("smart-filter.js must strip native filter.v.* URL params so Findly AJAX owns the grid");
  }
  if (!filterJs.includes("sorting-filter")) {
    fail("smart-filter.js must hide Horizon .sorting-filter chrome");
  }
  if (!filterJs.includes("isFragileLayoutHost")) {
    fail("smart-filter.js must avoid reparenting Horizon results-list");
  }
  if (!filterJs.includes("hasPersistableHashState")) {
    fail("smart-filter.js must not write #sf=sortmanual when only default sort is set");
  }
  if (!filterJs.includes("watchThemeGrid")) {
    fail("smart-filter.js must re-apply visibility when Horizon/Dawn re-renders the grid");
  }
  if (!filterJs.includes("closestGridHost")) {
    fail("closestProductCard must walk the real product grid, not a fat .product-grid wrapper");
  }
  if (!filterJs.includes("isLikelyProductCard(viaSel)") && !filterJs.includes("isLikelyProductCard(node)")) {
    fail("closestProductCard must reject fat grid wrappers so each product can hide");
  }
  if (!filterJs.includes("sf-sort-host")) {
    fail("Findly sort must mount in an owned host, not theme facet chrome");
  }
  if (!read("app/proxy.server.ts").includes("hmacMessageFromRawQueryEncoded")) {
    fail("app proxy HMAC must also accept encoded query signatures");
  }
  if (!read("app/routes/apps.smart-filter.filters.tsx").includes("private, no-store")) {
    fail("filter proxy responses must not be publicly cached");
  }
  if (!filterJs.includes("facets-form-component")) {
    fail("smart-filter.js must lift/hide Horizon facets-form-component");
  }
  if (!filterJs.includes("facets-form") || !filterJs.includes("facet-filters-form")) {
    fail("smart-filter.js must recognize Horizon/Dawn native facet hosts");
  }
  if (!filterCss.includes("max-width: 280px")) {
    fail("smart-filter.css sidebar must use px (Dawn 10px rem would shrink 18rem to 180px)");
  }
  if (!filterJs.includes("renderChips") || !filterJs.includes("clearFilters")) {
    fail("theme missing chips or clear filters");
  }
  if (!filterCss.includes("min-width: 375px")) {
    fail("smart-filter.css missing 375px mobile breakpoint");
  }
  if (
    !/smart-filter--left/.test(filterCss) ||
    !/smart-filter--right/.test(filterCss) ||
    !/smart-filter--top/.test(filterCss)
  ) {
    fail("CSS missing left|right|top position classes");
  }
  if (!collectionLiquid.includes('templates": ["collection", "search"]')) {
    fail("collection-filters block must enable collection + search templates");
  }
  if (!searchLiquid.includes("data-empty") || !searchJs.includes("data-empty")) {
    fail("product-search empty state markers missing");
  }
  if (!searchCss.includes(".smart-filter-search")) {
    fail("search CSS must be scoped under .smart-filter-search");
  }

  for (const topic of [
    "customers/data_request",
    "customers/redact",
    "shop/redact",
    "app/uninstalled",
  ]) {
    if (!toml.includes(topic)) {
      fail(`shopify.app.toml missing webhook topic ${topic}`);
    }
  }
  if (!toml.includes('api_version = "2026-07"')) {
    fail("shopify.app.toml webhook api_version must be 2026-07");
  }
  if (!shopifyServer.includes("ApiVersion.July26")) {
    fail("shopify.server.ts must use ApiVersion.July26 (2026-07)");
  }
  if (/apiVersion:\s*ApiVersion\.October25/.test(shopifyServer)) {
    fail("shopify.server.ts still targets ApiVersion.October25");
  }
  if (!uninstall.includes("ensureShopPurged")) {
    fail("app/uninstalled handler must ensureShopPurged (queue + inline fallback)");
  }
  if (!shopRedact.includes("ensureShopPurged")) {
    fail("shop/redact must ensureShopPurged (not enqueue-only)");
  }
  if (
    !compliance.includes("ensureShopPurged") ||
    !compliance.includes("running inline purge") ||
    !compliance.includes("inline purge FAILED")
  ) {
    fail("compliance.server.ts must queue cleanup, inline-purge on Redis failure, and rethrow if purge fails");
  }
  if (!dataRequest.includes("logComplianceEvent")) {
    fail("customers/data_request must log compliance (not a stub)");
  }
  if (!customerRedact.includes("logComplianceEvent")) {
    fail("customers/redact must log compliance (not a stub)");
  }
  if (!customerRedact.includes("scrubCustomerData")) {
    fail("customers/redact must scrub stored customer data, not only log");
  }
  if (!compliance.includes("scrubCustomerData")) {
    fail("compliance.server.ts missing scrubCustomerData");
  }
  if (!compliance.includes("purgeShopData")) {
    fail("compliance.server.ts missing purgeShopData");
  }
  if (!billing.includes("appSubscriptionCreate") || !billing.includes("productLimit: 200")) {
    fail("billing.server.ts missing Shopify Billing API / Free caps");
  }
  if (!billing.includes("productLimit: 5000") || !billing.includes("19.99")) {
    fail("billing.server.ts missing Pro caps / price");
  }
}

async function cleanup() {
  await prisma.shop.deleteMany({
    where: { domain: { in: [SHOP_A, SHOP_B] } },
  });
}

async function upsertProduct(shopId, product) {
  await prisma.productFacet.upsert({
    where: {
      shopId_productGid: { shopId, productGid: product.productGid },
    },
    create: {
      shopId,
      ...product,
    },
    update: {
      handle: product.handle,
      title: product.title,
      vendor: product.vendor,
      productType: product.productType,
      tags: product.tags,
      options: product.options,
      priceMin: product.priceMin,
      priceMax: product.priceMax,
      available: product.available,
      status: product.status,
      metafields: product.metafields,
    },
  });
}

async function seed() {
  const shopA = await prisma.shop.upsert({
    where: { domain: SHOP_A },
    create: { domain: SHOP_A, plan: "free" },
    update: { uninstalledAt: null, plan: "free" },
  });
  const shopB = await prisma.shop.upsert({
    where: { domain: SHOP_B },
    create: { domain: SHOP_B, plan: "free" },
    update: { uninstalledAt: null, plan: "free" },
  });

  const filterFields = {
    enabled: true,
    enablePrice: true,
    enableAvailability: true,
    enableVendor: true,
    enableProductType: true,
    enableTags: true,
    enableOptions: true,
  };

  for (const collectionGid of ["", COL_A]) {
    await seedFilterConfig(prisma, shopA.id, {
      collectionGid,
      ...filterFields,
    });
  }

  await seedFilterConfig(prisma, shopA.id, {
    collectionGid: COL_B,
    ...filterFields,
    enabled: false,
  });

  await prisma.appSettings.upsert({
    where: { shopId: shopA.id },
    create: {
      shopId: shopA.id,
      widgetPosition: "left",
      showProductCounts: true,
      collapseByDefault: true,
      searchFields: ["title", "vendor", "productType", "tags"],
    },
    update: {
      widgetPosition: "left",
      showProductCounts: true,
      collapseByDefault: true,
    },
  });

  await prisma.metafieldMapping.createMany({
    data: [
      {
        shopId: shopA.id,
        namespace: "custom",
        key: "material",
        displayLabel: "Material",
        filterType: "LIST",
        enabled: true,
        sortOrder: 0,
      },
      {
        shopId: shopA.id,
        namespace: "custom",
        key: "length",
        displayLabel: "Length",
        filterType: "RANGE",
        enabled: true,
        sortOrder: 1,
      },
    ],
  });

  const productsA = [
    {
      productGid: "gid://shopify/Product/9505001",
      handle: "blue-tee",
      title: "Blue Tee",
      vendor: "Acme",
      productType: "Apparel",
      tags: ["summer"],
      options: { Size: ["M"], Color: ["Blue"] },
      priceMin: 20,
      priceMax: 20,
      available: true,
      status: "ACTIVE",
      imageUrl: null,
      metafields: { "custom.material": "Cotton", "custom.length": "10" },
    },
    {
      productGid: "gid://shopify/Product/9505002",
      handle: "red-jacket",
      title: "Red Jacket",
      vendor: "Northwind",
      productType: "Outerwear",
      tags: ["winter"],
      options: { Size: ["L"], Color: ["Red"] },
      priceMin: 80,
      priceMax: 80,
      available: false,
      status: "ACTIVE",
      imageUrl: null,
      metafields: { "custom.material": "Wool", "custom.length": "40" },
    },
    {
      productGid: "gid://shopify/Product/9505003",
      handle: "draft-tee",
      title: "Draft Tee",
      vendor: "Acme",
      productType: "Apparel",
      tags: ["summer"],
      options: {},
      priceMin: 10,
      priceMax: 10,
      available: false,
      status: "DRAFT",
      imageUrl: null,
      metafields: {},
    },
  ];

  for (const product of productsA) {
    await upsertProduct(shopA.id, product);
  }

  await prisma.collectionMembership.createMany({
    data: [
      {
        shopId: shopA.id,
        collectionGid: COL_A,
        productGid: "gid://shopify/Product/9505001",
      },
      {
        shopId: shopA.id,
        collectionGid: COL_B,
        productGid: "gid://shopify/Product/9505002",
      },
    ],
  });

  await upsertProduct(shopB.id, {
    productGid: "gid://shopify/Product/9505099",
    handle: "leaked-lamp",
    title: "Leaked Lamp",
    vendor: "Acme",
    productType: "Home",
    tags: ["summer"],
    options: {},
    priceMin: 15,
    priceMax: 15,
    available: true,
    status: "ACTIVE",
    imageUrl: null,
    metafields: {},
  });

  return { shopA, shopB };
}

try {
  await cleanup();
  const { shopA } = await seed();
  log.info(`Seeded ${SHOP_A} / ${SHOP_B}`);

  assertThemeSeoAndUi();
  log.info("theme SEO hash, empty state, billing, and compliance markers present");

  const { getCollectionFilterPayload, getSearchFilterPayload, getSearchPayload } =
    await import("../app/proxy.server.ts");
  const { PLANS } = await import("../app/billing.server.ts");
  const { purgeShopData, logComplianceEvent, scrubCustomerData, customerRedactTokens } =
    await import("../app/compliance.server.ts");
  const { webhookGraphqlId, webhookInventoryItemGid } = await import(
    "../app/webhooks.server.ts"
  );

  const toml = read("shopify.app.toml");
  const processors = read("app/workers/processors.ts");
  const syncServer = read("app/sync/sync.server.ts");
  const syncPage = read("app/routes/app.sync.tsx");
  const proxy = read("app/proxy.server.ts");
  if (!toml.includes("inventory_levels/update") || !toml.includes("products/update")) {
    fail(
      "shopify.app.toml must subscribe to inventory_levels/update and products/update (metafield value topics were removed in Admin API 2026-07)",
    );
  }
  if (!processors.includes("inventory.sync") || !processors.includes("variant.sync")) {
    fail("worker must process inventory.sync and variant.sync");
  }
  if (!syncServer.includes("bumpCatalogGeneration") || !syncServer.includes("syncInventoryItem")) {
    fail("sync.server.ts must bump catalog generation and resolve inventory items");
  }
  if (!proxy.includes("getCatalogGeneration")) {
    fail("proxy.server.ts must key filter cache by catalog generation");
  }
  if (!syncPage.includes("Re-sync catalog") || !syncPage.includes("Automatic updates")) {
    fail("Sync page must present automatic updates with Re-sync as recovery");
  }
  const inventoryFromLevel = webhookInventoryItemGid({
    inventory_item_id: 271878346596884000,
    admin_graphql_api_id:
      "gid://shopify/InventoryLevel/523463154?inventory_item_id=271878346596884015",
  });
  if (inventoryFromLevel !== "gid://shopify/InventoryItem/271878346596884015") {
    fail(
      `inventory_levels webhook must parse item id from GID, got ${inventoryFromLevel}`,
    );
  }

  const productGid = webhookGraphqlId(
    {
      id: 788032119674574782,
      admin_graphql_api_id: "gid://shopify/Product/788032119674574782",
    },
    "Product",
  );
  if (productGid !== "gid://shopify/Product/788032119674574782") {
    fail(`2026-07 product webhook GID parse failed: ${productGid}`);
  }
  const productGidFromId = webhookGraphqlId({ id: 42 }, "Product");
  if (productGidFromId !== "gid://shopify/Product/42") {
    fail(`id-only product webhook GID parse failed: ${productGidFromId}`);
  }
  const collectionGid = webhookGraphqlId(
    { id: 841564295, admin_graphql_api_id: "gid://shopify/Collection/841564295" },
    "Collection",
  );
  if (collectionGid !== "gid://shopify/Collection/841564295") {
    fail(`2026-07 collection webhook GID parse failed: ${collectionGid}`);
  }
  const tokens = customerRedactTokens({
    shop_id: 954889,
    shop_domain: "snowdevil.myshopify.com",
    customer: {
      id: 191167,
      email: "john@example.com",
      phone: "555-625-1199",
    },
    orders_to_redact: [299938, 280263, 220458],
  });
  if (!tokens.includes("john@example.com") || !tokens.includes("5556251199")) {
    fail(`2026-07 customers/redact payload tokens missing: ${tokens.join(",")}`);
  }
  log.info("2026-07 webhook payload parse (product/collection/GDPR) ok");

  if (PLANS.free.productLimit !== 200 || PLANS.free.filterLimit !== 5) {
    fail("Free plan caps drifted");
  }
  if (PLANS.pro.productLimit !== 5000 || PLANS.pro.filterLimit !== 25) {
    fail("Pro plan caps drifted");
  }
  if (PLANS.pro.amount !== 19.99) {
    fail("Pro price drifted");
  }

  const collectionA = await getCollectionFilterPayload({
    shopDomain: SHOP_A,
    collectionGid: COL_A,
    selected: {},
  });
  if (collectionA.error || collectionA.status !== 200) {
    fail(`collection A failed: ${collectionA.error ?? "bad status"}`);
  }
  if (!collectionA.data.enabled) fail("collection A should be enabled");
  if (titles(collectionA).join(",") !== "Blue Tee") {
    fail(`collection A must only include Blue Tee, got ${titles(collectionA)}`);
  }
  log.info("collection A membership does not leak Red Jacket");

  const vendorOnCollection = await getCollectionFilterPayload({
    shopDomain: SHOP_A,
    collectionGid: COL_A,
    selected: { vendor: ["Northwind"] },
  });
  if (vendorOnCollection.data.total !== 0) {
    fail("Northwind must not leak into collection A via vendor filter");
  }

  const disabledB = await getCollectionFilterPayload({
    shopDomain: SHOP_A,
    collectionGid: COL_B,
    selected: {},
  });
  if (disabledB.data.enabled !== false || disabledB.data.total !== 0) {
    fail("disabled collection B must return enabled:false and no products");
  }
  log.info("disabled collection short-circuits");

  const price = await getCollectionFilterPayload({
    shopDomain: SHOP_A,
    collectionGid: COL_A,
    selected: { price: ["0", "50"] },
  });
  if (titles(price).join(",") !== "Blue Tee") {
    fail(`price 0-50 expected Blue Tee, got ${titles(price)}`);
  }

  const availability = await getCollectionFilterPayload({
    shopDomain: SHOP_A,
    collectionGid: COL_A,
    selected: { availability: ["in_stock"] },
  });
  if (titles(availability).join(",") !== "Blue Tee") {
    fail(`in_stock expected Blue Tee, got ${titles(availability)}`);
  }

  const vendor = await getCollectionFilterPayload({
    shopDomain: SHOP_A,
    collectionGid: COL_A,
    selected: { vendor: ["Acme"] },
  });
  if (titles(vendor).join(",") !== "Blue Tee") {
    fail(`vendor Acme expected Blue Tee, got ${titles(vendor)}`);
  }

  const typeHit = await getCollectionFilterPayload({
    shopDomain: SHOP_A,
    collectionGid: COL_A,
    selected: { productType: ["Apparel"] },
  });
  if (titles(typeHit).join(",") !== "Blue Tee") {
    fail(`type Apparel expected Blue Tee, got ${titles(typeHit)}`);
  }

  const tagHit = await getCollectionFilterPayload({
    shopDomain: SHOP_A,
    collectionGid: COL_A,
    selected: { tag: ["summer"] },
  });
  if (titles(tagHit).join(",") !== "Blue Tee") {
    fail(`tag summer expected Blue Tee, got ${titles(tagHit)}`);
  }

  const optionHit = await getCollectionFilterPayload({
    shopDomain: SHOP_A,
    collectionGid: COL_A,
    selected: { opt_Size: ["M"] },
  });
  if (optionHit.error) fail(`option filter error: ${optionHit.error}`);
  if (titles(optionHit).join(",") !== "Blue Tee") {
    fail(`Size M expected Blue Tee, got ${titles(optionHit)}`);
  }

  const listMf = await getCollectionFilterPayload({
    shopDomain: SHOP_A,
    collectionGid: COL_A,
    selected: { mf_custom_material: ["Cotton"] },
  });
  if (titles(listMf).join(",") !== "Blue Tee") {
    fail(`material Cotton expected Blue Tee, got ${titles(listMf)}`);
  }

  const rangeMf = await getCollectionFilterPayload({
    shopDomain: SHOP_A,
    collectionGid: COL_A,
    selected: { mf_custom_length: ["0", "15"] },
  });
  if (titles(rangeMf).join(",") !== "Blue Tee") {
    fail(`length 0-15 expected Blue Tee, got ${titles(rangeMf)}`);
  }

  const facets = collectionA.data.facets ?? [];
  const vendorFacet = facets.find((f) => f.key === "vendor");
  if (!vendorFacet?.values?.some((v) => v.count >= 1)) {
    fail("expected product counts on vendor facet");
  }
  if (collectionA.data.settings?.collapseByDefault !== true) {
    fail("collapseByDefault should persist on payload");
  }
  if (collectionA.data.settings?.widgetPosition !== "left") {
    fail("widgetPosition should persist on payload");
  }
  if (collectionA.data.settings?.showProductCounts !== true) {
    fail("showProductCounts should persist on payload");
  }
  log.info("A12 facets (price/availability/vendor/type/tags/options/LIST/RANGE) pass");

  const searchQ = await getSearchPayload({
    shopDomain: SHOP_A,
    query: "Blue Tee",
  });
  if (searchQ.error || searchQ.data.total !== 1 || titles(searchQ)[0] !== "Blue Tee") {
    fail(`search Blue Tee failed: ${JSON.stringify(searchQ.data?.products)}`);
  }
  if (titles(searchQ).includes("Leaked Lamp") || titles(searchQ).includes("Draft Tee")) {
    fail("search leaked other-shop or DRAFT product");
  }

  const emptySearch = await getSearchPayload({
    shopDomain: SHOP_A,
    query: "",
  });
  if (emptySearch.data.total !== 0 || emptySearch.data.products.length !== 0) {
    fail("empty search must not dump catalog");
  }

  const garbage = await getSearchPayload({
    shopDomain: SHOP_A,
    query: "zzzxqgarbage999",
  });
  if (garbage.error || garbage.status !== 200 || garbage.data.total !== 0) {
    fail("garbage query must return empty 200, not throw");
  }

  const combined = await getSearchFilterPayload({
    shopDomain: SHOP_A,
    query: "Tee",
    selected: { vendor: ["Acme"], price: ["0", "50"] },
  });
  if (combined.error || combined.status !== 200) {
    fail(`search+vendor+price failed: ${combined.error ?? "bad status"}`);
  }
  if (titles(combined).join(",") !== "Blue Tee") {
    fail(
      `search Tee + vendor Acme + price 0-50 expected Blue Tee, got ${titles(combined)}`,
    );
  }
  if (titles(combined).includes("Red Jacket")) {
    fail("Red Jacket must not appear on search+filters for Tee");
  }
  log.info("search query, empty/garbage, and vendor+price together pass");

  const otherShop = await getSearchPayload({
    shopDomain: SHOP_B,
    query: "Blue",
  });
  if (titles(otherShop).includes("Blue Tee")) {
    fail("shop B search must not leak shop A products");
  }

  const logged = await logComplianceEvent(SHOP_A, "customers/data_request", {
    requestId: "verify-b5-data-request",
    status: "acknowledged",
  });
  if (!logged?.id) fail("logComplianceEvent must persist a row");
  if (!logged.requestId || logged.requestId !== "verify-b5-data-request") {
    fail("compliance row must store requestId, not a customer payload");
  }
  if ("payload" in logged) {
    fail("ComplianceRequest must not include a payload field");
  }
  const stored = JSON.stringify(logged);
  if (
    stored.includes('"payload"') ||
    stored.includes('"email"') ||
    stored.includes('"phone"')
  ) {
    fail("compliance row must not contain customer payload fields");
  }
  const allowed = ["id", "shopDomain", "requestId", "topic", "status", "createdAt"];
  const extra = Object.keys(logged).filter((key) => !allowed.includes(key));
  if (extra.length) {
    fail(`compliance row has unexpected fields: ${extra.join(",")}`);
  }

  await prisma.analyticsEvent.createMany({
    data: [
      {
        shopId: shopA.id,
        kind: "search",
        query: "john@example.com",
        combo: "",
        handle: "",
        visitor: "keep-anonymous",
        device: "desktop",
        resultCount: 0,
      },
      {
        shopId: shopA.id,
        kind: "search",
        query: "blue tee",
        combo: "",
        handle: "",
        visitor: "keep-anonymous",
        device: "desktop",
        resultCount: 1,
      },
    ],
  });
  const scrubbed = await scrubCustomerData(SHOP_A, {
    customer: {
      id: 191167,
      email: "john@example.com",
      phone: "555-625-1199",
    },
  });
  if (scrubbed.analyticsDeleted < 1) {
    fail("customers/redact must delete analytics that contain the customer email");
  }
  const emailLeft = await prisma.analyticsEvent.count({
    where: { shopId: shopA.id, query: "john@example.com" },
  });
  if (emailLeft !== 0) fail("customer email query must be gone after redact");
  const kept = await prisma.analyticsEvent.count({
    where: { shopId: shopA.id, query: "blue tee" },
  });
  if (kept !== 1) fail("unrelated analytics must survive customers/redact");
  log.info("customers/redact scrubbed matching analytics only");

  const purged = await purgeShopData(SHOP_A);
  if (!purged.deleted) fail("purgeShopData should delete shop A");
  const gone = await prisma.shop.findUnique({ where: { domain: SHOP_A } });
  if (gone) fail("shop A still present after purge");
  const leftoverFacets = await prisma.productFacet.count({
    where: { shopId: shopA.id },
  });
  if (leftoverFacets !== 0) fail("product facets leaked after purge");
  log.info("compliance purge removed tenant data");

  log.success("STEPB5_OK launch E2E: filters + search isolation + billing + compliance");
} catch (error) {
  log.error(`STEPB5_FAIL ${error.message}`);
  if (error.stack) console.error(error.stack);
  process.exitCode = 1;
} finally {
  try {
    await cleanup();
    log.info(`Cleaned up ${SHOP_A} / ${SHOP_B}`);
  } catch (cleanupError) {
    log.warn(`Cleanup failed: ${cleanupError.message}`);
  }
  await prisma.$disconnect();
}
