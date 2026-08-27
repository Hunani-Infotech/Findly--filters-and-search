/**
 * D11 gate: metafield Sort By keys + Shopify collection default product order.
 * Usage: npm run verify:d11
 */
import "tsx/esm";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { log } from "./terminal-log.mjs";
import { seedFilterConfig } from "./seed-filter-config.mjs";

const SHOP_DOMAIN = "d11-verify.myshopify.com";
const COLLECTION_GID = "gid://shopify/Collection/9110011";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MFSORT_KEY = "mfsort_p_custom.release_date";

const prisma = new PrismaClient();

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
  const graphql = readRepo("app", "sync", "graphql.ts");
  if (!graphql.includes("COLLECTION_DEFAULT")) {
    fail("COLLECTION_PRODUCTS_QUERY missing sortKey: COLLECTION_DEFAULT");
  }
  const applies = readRepo("app", "utils", "metafield-applies.ts");
  if (!applies.includes("mappingAppliesToSort")) {
    fail("metafield-applies.ts missing mappingAppliesToSort");
  }
  const proxy = readRepo("app", "services", "proxy.server.ts");
  if (!proxy.includes("metafieldSortOptions")) {
    fail("proxy.server.ts missing metafieldSortOptions");
  }
  const card = readRepo("app", "components", "settings-metafields-card.tsx");
  if (/does not use metafields yet/i.test(card)) {
    fail(
      "settings-metafields-card still says storefront sort does not use metafields yet",
    );
  }
  const widget = readRepo(
    "extensions",
    "smart-filter",
    "assets",
    "smart-filter.js",
  );
  if (!widget.includes("metafieldSortOptions")) {
    fail(
      "smart-filter.js missing metafieldSortOptions (storefront agent has not landed D11 widget wiring yet)",
    );
  }
  log.info("D11 static markers present");
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
    name: "D11 tree",
    enabled: true,
    enableVendor: true,
    enablePrice: true,
  });

  const products = [
    {
      productGid: "gid://shopify/Product/9110011",
      handle: "zeta",
      title: "Zeta",
      position: 2,
      releaseDate: "2024-01-01",
    },
    {
      productGid: "gid://shopify/Product/9110012",
      handle: "alpha",
      title: "Alpha",
      position: 0,
      releaseDate: "2025-06-01",
    },
    {
      productGid: "gid://shopify/Product/9110013",
      handle: "beta",
      title: "Beta",
      position: 1,
      releaseDate: "2025-01-01",
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
        tags: ["d11-verify"],
        options: {},
        priceMin: 10,
        priceMax: 10,
        available: true,
        status: "ACTIVE",
        imageUrl: null,
        metafields: { "custom.release_date": product.releaseDate },
        publishedAt: new Date(product.releaseDate),
      },
      update: {
        handle: product.handle,
        title: product.title,
        metafields: { "custom.release_date": product.releaseDate },
        publishedAt: new Date(product.releaseDate),
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

  await prisma.metafieldMapping.create({
    data: {
      shopId: shop.id,
      namespace: "custom",
      key: "release_date",
      displayLabel: "Release Date",
      filterType: "LIST",
      ownerType: "PRODUCT",
      enabled: false,
      appliesTo: ["display", "sort"],
      sortOrder: 0,
    },
  });

  return shop;
}

try {
  await cleanup();
  assertStaticMarkers();

  const shop = await seedShopData();
  log.info(`Seeded shop ${SHOP_DOMAIN}`);

  const { getCollectionFilterPayload } = await import("../app/services/proxy.server.ts");
  const { saveAppSettings } = await import("../app/services/settings.server.ts");

  await saveAppSettings(shop.id, {
    sortOptionsEnabled: ["manual", "title_asc", "price_asc"],
    defaultSort: "manual",
    hideSortDropdown: false,
  });

  async function payload(sort) {
    return getCollectionFilterPayload({
      shopDomain: SHOP_DOMAIN,
      collectionGid: COLLECTION_GID,
      selected: {},
      sort,
    });
  }

  const featured = await payload("manual");
  if (titles(featured).join(",") !== "Alpha,Beta,Zeta") {
    fail(
      `manual/collection order expected Alpha,Beta,Zeta got ${titles(featured)}`,
    );
  }
  log.info("manual sort follows collection position");

  const byDate = await payload(MFSORT_KEY);
  if (titles(byDate).join(",") !== "Zeta,Beta,Alpha") {
    fail(
      `mfsort release_date expected Zeta,Beta,Alpha (oldest first) got ${titles(byDate)}`,
    );
  }
  const options = byDate.data?.settings?.metafieldSortOptions;
  if (!Array.isArray(options) || options.length !== 1) {
    fail(`expected one metafieldSortOption, got ${JSON.stringify(options)}`);
  }
  if (options[0].key !== MFSORT_KEY || options[0].label !== "Release Date") {
    fail(
      `metafieldSortOptions expected ${MFSORT_KEY} / Release Date, got ${JSON.stringify(options[0])}`,
    );
  }
  if (Array.isArray(byDate.data?.settings?.sortOptionsEnabled)) {
    if (byDate.data.settings.sortOptionsEnabled.includes(MFSORT_KEY)) {
      fail("do not mutate sortOptionsEnabled with metafield keys");
    }
  }
  log.info("metafield sort oldest-first + payload option");

  await prisma.metafieldMapping.updateMany({
    where: { shopId: shop.id, namespace: "custom", key: "release_date" },
    data: { appliesTo: ["display", "filter"] },
  });

  const afterUncheck = await payload(MFSORT_KEY);
  const nextOptions = afterUncheck.data?.settings?.metafieldSortOptions;
  if (Array.isArray(nextOptions) && nextOptions.length > 0) {
    fail(
      `unchecking Sort should empty metafieldSortOptions, got ${JSON.stringify(nextOptions)}`,
    );
  }
  if (titles(afterUncheck).join(",") !== "Alpha,Beta,Zeta") {
    fail(
      `requesting mfsort after uncheck should fall back to manual, got ${titles(afterUncheck)}`,
    );
  }
  log.info("uncheck Sort drops metafield sort key");

  log.success("STEPD11_OK metafield sort + collection default order");
} catch (error) {
  log.error(`STEPD11_FAIL ${error.message}`);
  if (error.stack) console.error(error.stack);
  process.exitCode = 1;
} finally {
  try {
    await cleanup();
    log.info(`Cleaned up shop ${SHOP_DOMAIN}`);
  } catch (cleanupError) {
    log.warn(`Cleanup failed: ${cleanupError.message}`);
  }
  await prisma.$disconnect();
}
