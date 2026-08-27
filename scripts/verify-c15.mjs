/**
 * C15 gate: compare-at in sync + % Sale off sort + optional sale % facet.
 * Usage: npm run verify:c15
 */
import "tsx/esm";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { log } from "./terminal-log.mjs";
import { seedFilterConfig } from "./seed-filter-config.mjs";

const SHOP_DOMAIN = "c15-verify.myshopify.com";
const COLLECTION_GID = "gid://shopify/Collection/9415001";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const prisma = new PrismaClient();

function fail(message) {
  throw new Error(message);
}

function titles(result) {
  return (result.data?.products ?? []).map((p) => p.title);
}

function handles(result) {
  return (result.data?.products ?? []).map((p) => p.handle);
}

function readRepo(...relParts) {
  return readFileSync(join(ROOT, ...relParts), "utf8");
}

function assertStaticMarkers() {
  const graphql = readRepo("app", "sync", "graphql.ts");
  const compareAtHits = (graphql.match(/compareAtPrice/g) || []).length;
  if (compareAtHits < 2) {
    fail("PRODUCT_NODE_QUERY and bulk products query must both select compareAtPrice");
  }
  if (!graphql.includes("PRODUCT_NODE_QUERY") || !graphql.includes("BULK_PRODUCTS_MUTATION")) {
    fail("sync graphql missing product query documents");
  }

  const mapper = readRepo("app", "sync", "product-mapper.ts");
  if (!mapper.includes("compareAtAndSaleFromVariants") || !mapper.includes("variantSalePercent")) {
    fail("product-mapper must compute variant-level sale % (not min-price vs max-compare-at)");
  }

  const schema = readRepo("prisma", "schema.prisma");
  if (
    !schema.includes("compareAtMin") ||
    !schema.includes("compareAtMax") ||
    !schema.includes("salePct") ||
    !schema.includes("enableSale")
  ) {
    fail("ProductFacet compare-at/salePct and FilterConfig.enableSale missing from schema");
  }

  const settings = readRepo("app", "utils", "app-settings.ts");
  if (!settings.includes('"sale_pct_desc"')) {
    fail("SORT_OPTION_KEYS must include sale_pct_desc");
  }
  if (settings.includes('"best_selling"')) {
    fail("do not add best-selling sort in C15");
  }

  const sort = readRepo("app", "services", "sort.server.ts");
  if (!sort.includes("sale_pct_desc") || !sort.includes("salePct")) {
    fail("sort.server.ts must order by salePct for % Sale off");
  }

  const webhook = readRepo("app", "routes", "webhooks.products.update.tsx");
  const webhookServer = readRepo("app", "services", "webhooks.server.ts");
  if (!webhook.includes("handleWebhookTopic") && !webhookServer.includes("product.upsert")) {
    fail("product update webhook must enqueue product upsert");
  }
  if (!webhookServer.includes("product.upsert")) {
    fail("webhooks.server.ts must enqueue product.upsert so compare-at stays current");
  }

  const widgetJs = readRepo("extensions", "smart-filter", "assets", "smart-filter.js");
  if (!widgetJs.includes("sale_pct_desc") || !widgetJs.includes("% Sale off")) {
    fail("theme sort dropdown missing % Sale off label");
  }

  const collectionsPage = readRepo("app", "routes", "app.collections.$id.tsx");
  if (!collectionsPage.includes("enableSale")) {
    fail("collection admin missing % Sale off toggle");
  }

  log.info("C15 static markers present");
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

  await seedFilterConfig(prisma, shop.id, {
    collectionGid: COLLECTION_GID,
    enabled: true,
    enableVendor: false,
    enablePrice: true,
    enableSale: true,
  });

  const products = [
    {
      productGid: "gid://shopify/Product/9415001",
      handle: "on-sale-30",
      title: "On Sale 30",
      priceMin: 70,
      priceMax: 70,
      compareAtMin: 100,
      compareAtMax: 100,
      salePct: 30,
      position: 0,
    },
    {
      productGid: "gid://shopify/Product/9415002",
      handle: "on-sale-50",
      title: "On Sale 50",
      priceMin: 50,
      priceMax: 50,
      compareAtMin: 100,
      compareAtMax: 100,
      salePct: 50,
      position: 1,
    },
    {
      productGid: "gid://shopify/Product/9415003",
      handle: "full-price",
      title: "Full Price",
      priceMin: 40,
      priceMax: 40,
      compareAtMin: null,
      compareAtMax: null,
      salePct: 0,
      position: 2,
    },
    {
      productGid: "gid://shopify/Product/9415004",
      handle: "mixed-variants",
      title: "Mixed Variants",
      priceMin: 10,
      priceMax: 90,
      compareAtMin: 100,
      compareAtMax: 100,
      salePct: 10,
      position: 3,
    },
  ];

  for (const product of products) {
    await prisma.productFacet.upsert({
      where: {
        shopId_productGid: { shopId: shop.id, productGid: product.productGid },
      },
      create: {
        shopId: shop.id,
        productGid: product.productGid,
        handle: product.handle,
        title: product.title,
        vendor: "Acme",
        productType: "Apparel",
        tags: ["c15-verify"],
        options: {},
        priceMin: product.priceMin,
        priceMax: product.priceMax,
        compareAtMin: product.compareAtMin,
        compareAtMax: product.compareAtMax,
        salePct: product.salePct,
        available: true,
        status: "ACTIVE",
        imageUrl: null,
        metafields: {},
      },
      update: {
        handle: product.handle,
        title: product.title,
        priceMin: product.priceMin,
        priceMax: product.priceMax,
        compareAtMin: product.compareAtMin,
        compareAtMax: product.compareAtMax,
        salePct: product.salePct,
        status: "ACTIVE",
      },
    });
    await prisma.collectionMembership.upsert({
      where: {
        shopId_collectionGid_productGid: {
          shopId: shop.id,
          collectionGid: COLLECTION_GID,
          productGid: product.productGid,
        },
      },
      create: {
        shopId: shop.id,
        collectionGid: COLLECTION_GID,
        productGid: product.productGid,
        position: product.position,
      },
      update: { position: product.position },
    });
  }

  return shop;
}

try {
  await cleanup();
  const shop = await seedShopData();
  log.info(`Seeded shop ${SHOP_DOMAIN}`);
  assertStaticMarkers();

  const { mapProductToFacet, variantSalePercent } = await import(
    "../app/sync/product-mapper.ts"
  );

  if (Math.abs(variantSalePercent(70, 100) - 30) > 0.01) {
    fail(`expected 30% off for price 70 / compare-at 100, got ${variantSalePercent(70, 100)}`);
  }
  if (variantSalePercent(10, 100) === 90) {
    // allowed for a single variant; the mixed product must not invent this
  }
  const mixed = mapProductToFacet("shop", {
    id: "gid://shopify/Product/mixed",
    handle: "mixed",
    title: "Mixed",
    variants: {
      edges: [
        { node: { price: "10", compareAtPrice: null } },
        { node: { price: "90", compareAtPrice: "100" } },
      ],
    },
  });
  if (Number(mixed.facet.salePct) !== 10) {
    fail(
      `mixed variants must use max real variant % off (10), not fake min-price/max-compare-at; got ${mixed.facet.salePct}`,
    );
  }
  if (Number(mixed.facet.compareAtMin) !== 100 || Number(mixed.facet.compareAtMax) !== 100) {
    fail("compare-at min/max should come from variants that have compare-at");
  }
  log.info("mapper uses variant-level % off, not fake discount math");

  const { getCollectionFilterPayload } = await import("../app/services/proxy.server.ts");
  const { saveAppSettings, getAppSettings } = await import("../app/services/settings.server.ts"
  );

  await saveAppSettings(shop.id, {
    sortOptionsEnabled: [
      "manual",
      "price_asc",
      "sale_pct_desc",
    ],
    defaultSort: "sale_pct_desc",
    hideSortDropdown: false,
  });
  const persisted = await getAppSettings(shop.id);
  if (!persisted.sortOptionsEnabled.includes("sale_pct_desc")) {
    fail("sale_pct_desc did not persist in AppSettings");
  }
  if (persisted.defaultSort !== "sale_pct_desc") {
    fail(`defaultSort persist failed: ${persisted.defaultSort}`);
  }

  async function payload(sort, selected = {}) {
    return getCollectionFilterPayload({
      shopDomain: SHOP_DOMAIN,
      collectionGid: COLLECTION_GID,
      selected,
      sort,
    });
  }

  const bySale = await payload("sale_pct_desc");
  if (titles(bySale).join(",") !== "On Sale 50,On Sale 30,Mixed Variants,Full Price") {
    fail(`% off sort expected 50, 30, mixed(10), full(0) got ${titles(bySale)}`);
  }
  if (bySale.data.sort !== "sale_pct_desc") {
    fail(`expected sort sale_pct_desc, got ${bySale.data.sort}`);
  }
  log.info("compare-at 100 / price 70 sorts by 30% off among catalog");

  const saleFacet = (bySale.data?.facets ?? []).find((facet) => facet.key === "sale");
  if (!saleFacet || saleFacet.source !== "sale") {
    fail("sale facet missing when enableSale is true");
  }
  if (saleFacet.range?.min !== 0 || saleFacet.range?.max < 50) {
    fail(`sale facet bounds expected 0–≥50, got ${JSON.stringify(saleFacet.range)}`);
  }

  const filtered = await payload("sale_pct_desc", { sale: ["25", "35"] });
  if (handles(filtered).join(",") !== "on-sale-30") {
    fail(`sale 25–35% should only include 30% product, got ${handles(filtered)}`);
  }
  log.info("sale % facet matches the compare-at 100 / price 70 product");

  log.info("STEPC15_OK");
} catch (error) {
  log.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  await cleanup().catch(() => {});
  await prisma.$disconnect();
}
