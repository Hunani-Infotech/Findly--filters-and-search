/**
 * B1 gate: keyword storefront search via getSearchPayload (Prisma ProductFacet).
 * Usage: npm run verify:b1
 */
import "tsx/esm";
import { PrismaClient } from "@prisma/client";
import { log } from "./terminal-log.mjs";

const SHOP_DOMAIN = "b1-verify.myshopify.com";

const prisma = new PrismaClient();

function fail(message) {
  throw new Error(message);
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
      productGid: "gid://shopify/Product/9101001",
      handle: "b1-cotton-tee",
      title: "B1 Cotton Tee",
      vendor: "Findly Labs",
      productType: "Apparel",
      status: "ACTIVE",
    },
    {
      productGid: "gid://shopify/Product/9101002",
      handle: "b1-trail-jacket",
      title: "B1 Trail Jacket",
      vendor: "Acme",
      productType: "Outerwear",
      status: "ACTIVE",
    },
    {
      productGid: "gid://shopify/Product/9101003",
      handle: "unrelated-lamp",
      title: "Unrelated Lamp",
      vendor: "Northwind",
      productType: "Home",
      status: "ACTIVE",
    },
    {
      productGid: "gid://shopify/Product/9101004",
      handle: "b1-cotton-tee-draft",
      title: "B1 Cotton Tee Draft",
      vendor: "Findly Labs",
      productType: "Apparel",
      status: "DRAFT",
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
        tags: ["b1-verify"],
        options: {},
        priceMin: 19.99,
        priceMax: 19.99,
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
  await cleanup();
  const shop = await seedShopData();
  log.info(`Seeded shop ${SHOP_DOMAIN} (id=${shop.id})`);

  const { getSearchPayload } = await import("../app/proxy.server.ts");
  const { normalizeSearchQuery } = await import("../app/search.server.ts");

  const collapsed = normalizeSearchQuery("  Cotton   Tee  extra");
  if (!collapsed.startsWith("Cotton Tee")) {
    fail(`normalizeSearchQuery should collapse whitespace, got "${collapsed}"`);
  }
  if (normalizeSearchQuery("a".repeat(100)).length !== 80) {
    fail("normalizeSearchQuery should cap length at 80");
  }

  const titleHit = await getSearchPayload({
    shopDomain: SHOP_DOMAIN,
    query: "Cotton Tee",
  });
  if (titleHit.error || titleHit.status !== 200) {
    fail(`title search failed: ${titleHit.error ?? "bad status"}`);
  }
  if (titleHit.data.total !== 1) {
    fail(`Cotton Tee expected 1 product, got ${titleHit.data.total}`);
  }
  const cotton = titleHit.data.products[0];
  if (cotton.title !== "B1 Cotton Tee") {
    fail(`expected B1 Cotton Tee, got ${cotton.title}`);
  }
  if (cotton.url !== "/products/b1-cotton-tee") {
    fail(`expected /products/b1-cotton-tee, got ${cotton.url}`);
  }
  if (titleHit.data.products.some((p) => p.title.includes("Draft"))) {
    fail("DRAFT B1 Cotton Tee Draft must not appear");
  }
  if (titleHit.data.products.some((p) => p.title === "Unrelated Lamp")) {
    fail("Unrelated Lamp must not appear for Cotton Tee");
  }
  log.info(`title search: ${JSON.stringify(titleHit.data.products)}`);

  const vendorHit = await getSearchPayload({
    shopDomain: SHOP_DOMAIN,
    query: "Acme",
  });
  if (vendorHit.data.total !== 1 || vendorHit.data.products[0].title !== "B1 Trail Jacket") {
    fail(
      `vendor Acme expected B1 Trail Jacket, got ${JSON.stringify(vendorHit.data.products)}`,
    );
  }
  log.info("vendor search matched B1 Trail Jacket");

  const typeHit = await getSearchPayload({
    shopDomain: SHOP_DOMAIN,
    query: "Outerwear",
  });
  if (typeHit.data.total !== 1 || typeHit.data.products[0].title !== "B1 Trail Jacket") {
    fail(
      `productType Outerwear expected B1 Trail Jacket, got ${JSON.stringify(typeHit.data.products)}`,
    );
  }
  log.info("productType search matched B1 Trail Jacket");

  for (const emptyQuery of ["", "   ", "\t\n"]) {
    const empty = await getSearchPayload({
      shopDomain: SHOP_DOMAIN,
      query: emptyQuery,
    });
    if (empty.error) {
      fail(`empty query should not 404: ${empty.error}`);
    }
    if (empty.data.total !== 0 || empty.data.products.length !== 0) {
      fail(
        `empty query must return products: [] total 0, got total=${empty.data.total}`,
      );
    }
  }
  log.info("empty / whitespace queries return no catalog dump");

  const missing = await getSearchPayload({
    shopDomain: "missing-b1.myshopify.com",
    query: "Cotton",
  });
  if (missing.status !== 404) {
    fail(`missing shop expected 404, got ${missing.status}`);
  }

  log.success("STEPB1_OK keyword search matches title/vendor; empty query is empty");
} catch (error) {
  log.error(`STEPB1_FAIL ${error.message}`);
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
