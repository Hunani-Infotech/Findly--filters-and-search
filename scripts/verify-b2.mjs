/**
 * B2 gate: filters on search results via getSearchFilterPayload.
 * Usage: npm run verify:b2
 */
import "tsx/esm";
import { PrismaClient } from "@prisma/client";
import { log } from "./terminal-log.mjs";

const SHOP_DOMAIN = "b2-verify.myshopify.com";

const prisma = new PrismaClient();

function fail(message) {
  throw new Error(message);
}

function titles(result) {
  return (result.data?.products ?? []).map((p) => p.title).sort();
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

  await prisma.filterConfig.upsert({
    where: {
      shopId_collectionGid: { shopId: shop.id, collectionGid: "" },
    },
    create: {
      shopId: shop.id,
      collectionGid: "",
      enabled: true,
      enablePrice: true,
      enableAvailability: true,
      enableVendor: true,
      enableProductType: true,
      enableTags: true,
      enableOptions: true,
    },
    update: {
      enabled: true,
      enablePrice: true,
      enableAvailability: true,
      enableVendor: true,
      enableProductType: true,
      enableTags: true,
      enableOptions: true,
    },
  });

  const products = [
    {
      productGid: "gid://shopify/Product/9202001",
      handle: "blue-shirt",
      title: "Blue Shirt",
      vendor: "Acme",
      productType: "Apparel",
      status: "ACTIVE",
      priceMin: 20,
      priceMax: 20,
    },
    {
      productGid: "gid://shopify/Product/9202002",
      handle: "red-shirt",
      title: "Red Shirt",
      vendor: "Findly Labs",
      productType: "Apparel",
      status: "ACTIVE",
      priceMin: 80,
      priceMax: 80,
    },
    {
      productGid: "gid://shopify/Product/9202003",
      handle: "blue-jacket",
      title: "Blue Jacket",
      vendor: "Acme",
      productType: "Outerwear",
      status: "ACTIVE",
      priceMin: 30,
      priceMax: 30,
    },
    {
      productGid: "gid://shopify/Product/9202004",
      handle: "draft-shirt",
      title: "Draft Shirt",
      vendor: "Acme",
      productType: "Apparel",
      status: "DRAFT",
      priceMin: 15,
      priceMax: 15,
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
        tags: ["b2-verify"],
        options: {},
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
        priceMin: product.priceMin,
        priceMax: product.priceMax,
      },
    });
  }

  return shop;
}

try {
  await cleanup();
  const shop = await seedShopData();
  log.info(`Seeded shop ${SHOP_DOMAIN} (id=${shop.id})`);

  const { getSearchFilterPayload } = await import("../app/proxy.server.ts");

  const unfiltered = await getSearchFilterPayload({
    shopDomain: SHOP_DOMAIN,
    query: "shirt",
    selected: {},
  });
  if (unfiltered.error || unfiltered.status !== 200) {
    fail(`shirt search failed: ${unfiltered.error ?? "bad status"}`);
  }
  if (!unfiltered.data.enabled) {
    fail("expected filters enabled on search results");
  }
  if (unfiltered.data.query !== "shirt") {
    fail(`expected query "shirt", got ${JSON.stringify(unfiltered.data.query)}`);
  }
  if (unfiltered.data.total !== 2) {
    fail(`shirt expected 2 products, got ${unfiltered.data.total} (${titles(unfiltered)})`);
  }
  const unfilteredTitles = titles(unfiltered);
  if (
    !unfilteredTitles.includes("Blue Shirt") ||
    !unfilteredTitles.includes("Red Shirt")
  ) {
    fail(`expected Blue Shirt and Red Shirt, got ${unfilteredTitles}`);
  }
  if (unfilteredTitles.includes("Blue Jacket")) {
    fail("Blue Jacket must not match query shirt");
  }
  if (unfilteredTitles.includes("Draft Shirt")) {
    fail("DRAFT Draft Shirt must not appear");
  }
  log.info(`shirt (no filters): ${JSON.stringify(unfiltered.data.products)}`);

  const vendorAcme = await getSearchFilterPayload({
    shopDomain: SHOP_DOMAIN,
    query: "shirt",
    selected: { vendor: ["Acme"] },
  });
  if (vendorAcme.data.total !== 1 || titles(vendorAcme)[0] !== "Blue Shirt") {
    fail(
      `vendor Acme expected only Blue Shirt, got ${JSON.stringify(vendorAcme.data.products)}`,
    );
  }
  log.info("vendor Acme filtered to Blue Shirt");

  const priceCap = await getSearchFilterPayload({
    shopDomain: SHOP_DOMAIN,
    query: "shirt",
    selected: { price: ["0", "50"] },
  });
  if (priceCap.data.total !== 1 || titles(priceCap)[0] !== "Blue Shirt") {
    fail(
      `price 0-50 expected only Blue Shirt, got ${JSON.stringify(priceCap.data.products)}`,
    );
  }
  log.info("price 0-50 filtered to Blue Shirt");

  const empty = await getSearchFilterPayload({
    shopDomain: SHOP_DOMAIN,
    query: "",
    selected: {},
  });
  if (empty.error) {
    fail(`empty query should not 404: ${empty.error}`);
  }
  if (empty.data.total !== 0 || empty.data.products.length !== 0) {
    fail(
      `empty query must return products: [] total 0, got total=${empty.data.total}`,
    );
  }
  if (empty.data.facets?.length) {
    fail("empty query must not dump catalog facets");
  }
  log.info("empty query returns no catalog dump");

  const missing = await getSearchFilterPayload({
    shopDomain: "missing-b2.myshopify.com",
    query: "shirt",
    selected: {},
  });
  if (missing.status !== 404) {
    fail(`missing shop expected 404, got ${missing.status}`);
  }

  log.success("STEPB2_OK search results accept vendor/price filters; empty query is empty");
} catch (error) {
  log.error(`STEPB2_FAIL ${error.message}`);
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
