/**
 * D5 gate: review rating stars from reviews.rating metafields.
 * Usage: npm run verify:d5
 */
import "tsx/esm";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { log } from "./terminal-log.mjs";
import { seedFilterConfig } from "./seed-filter-config.mjs";

const SHOP_DOMAIN = "d5-verify.myshopify.com";
const COLLECTION_GID = "gid://shopify/Collection/9505001";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const prisma = new PrismaClient();

function fail(message) {
  throw new Error(message);
}

function titles(result) {
  return (result.data?.products ?? []).map((p) => p.title).sort();
}

function readRepo(...parts) {
  return readFileSync(join(ROOT, ...parts), "utf8");
}

function assertStaticMarkers() {
  const graphql = readRepo("app", "sync", "graphql.ts");
  if (!graphql.includes('namespace: "reviews"') || !graphql.includes('key: "rating"')) {
    fail("sync GraphQL must fetch reviews.rating metafield");
  }
  const filters = readRepo("app", "filters.ts");
  if (!filters.includes("parseReviewRating") || !filters.includes('source: "rating"')) {
    fail("filters.ts missing rating facet / parseReviewRating");
  }
  const widget = readRepo("extensions", "smart-filter", "assets", "smart-filter.js");
  if (!widget.includes("smart-filter__stars") || !widget.includes('source === "rating"')) {
    fail("smart-filter.js missing star render path");
  }
  const editor = readRepo("app", "routes", "app.filters.$id.tsx");
  if (!editor.includes("enableRating")) {
    fail("filter tree editor missing Rating stars toggle");
  }
  log.info("D5 static markers present");
}

async function cleanup() {
  await prisma.shop.deleteMany({ where: { domain: SHOP_DOMAIN } });
}

try {
  await cleanup();
  assertStaticMarkers();

  const { parseReviewRating, productReviewRating } = await import(
    "../app/filters.ts"
  );
  const jsonFive = parseReviewRating(
    '{"value":"5.0","scale_min":"1.0","scale_max":"5.0"}',
  );
  if (jsonFive !== 5) {
    fail(`parseReviewRating JSON 5.0 expected 5, got ${jsonFive}`);
  }
  if (parseReviewRating("4.7") !== 4.7) {
    fail("parseReviewRating should accept a plain average");
  }
  if (parseReviewRating("<div class='jdgm-widget'>badge</div>") != null) {
    fail("judgeme.badge HTML must not parse as a rating");
  }
  if (
    productReviewRating({
      metafields: { "loox.avg_rating": "5" },
    }) !== 5
  ) {
    fail("Loox avg_rating should be read when reviews.rating is missing");
  }

  const shop = await prisma.shop.create({
    data: { domain: SHOP_DOMAIN, plan: "free" },
  });

  await seedFilterConfig(prisma, shop.id, {
    collectionGid: COLLECTION_GID,
    enabled: true,
    enableRating: true,
    enablePrice: false,
    enableAvailability: false,
    enableVendor: false,
    enableProductType: false,
    enableTags: false,
    enableOptions: false,
    enableSale: false,
  });

  const products = [
    {
      gid: "gid://shopify/Product/95050011",
      handle: "five-star",
      title: "Five Star",
      metafields: {
        "reviews.rating": '{"value":"5.0","scale_min":"1.0","scale_max":"5.0"}',
      },
    },
    {
      gid: "gid://shopify/Product/95050012",
      handle: "almost-five",
      title: "Almost Five",
      metafields: {
        "reviews.rating": '{"value":"4.7","scale_min":"1.0","scale_max":"5.0"}',
      },
    },
    {
      gid: "gid://shopify/Product/95050013",
      handle: "three-star",
      title: "Three Star",
      metafields: { "reviews.rating": "3" },
    },
    {
      gid: "gid://shopify/Product/95050014",
      handle: "unrated",
      title: "Unrated",
      metafields: {},
    },
  ];

  for (const product of products) {
    await prisma.productFacet.create({
      data: {
        shopId: shop.id,
        productGid: product.gid,
        handle: product.handle,
        title: product.title,
        vendor: "Acme",
        productType: "Apparel",
        tags: [],
        options: {},
        priceMin: 20,
        priceMax: 20,
        available: true,
        status: "ACTIVE",
        imageUrl: null,
        metafields: product.metafields,
      },
    });
    await prisma.collectionMembership.create({
      data: {
        shopId: shop.id,
        collectionGid: COLLECTION_GID,
        productGid: product.gid,
        position: 0,
      },
    });
  }

  const { getCollectionFilterPayload } = await import("../app/proxy.server.ts");

  const all = await getCollectionFilterPayload({
    shopDomain: SHOP_DOMAIN,
    collectionGid: COLLECTION_GID,
    selected: {},
  });
  const ratingFacet = (all.data?.facets ?? []).find(
    (facet) => facet.key === "rating" && facet.source === "rating",
  );
  if (!ratingFacet) fail("rating facet missing when enableRating is true");
  const starValues = (ratingFacet.values ?? []).map((item) => item.value).join(",");
  if (starValues !== "5,4,3,2,1") {
    fail(`expected star values 5–1, got ${starValues}`);
  }
  const fiveLabel = (ratingFacet.values ?? []).find((item) => item.value === "5")?.label ?? "";
  if (!fiveLabel.includes("★") || !fiveLabel.toLowerCase().includes("up")) {
    fail(`5-star label should show stars and “and up”, got ${fiveLabel}`);
  }

  const onlyFive = await getCollectionFilterPayload({
    shopDomain: SHOP_DOMAIN,
    collectionGid: COLLECTION_GID,
    selected: { rating: ["5"] },
  });
  if (titles(onlyFive).join(",") !== "Five Star") {
    fail(`filtering 5 stars should keep Five Star only, got ${titles(onlyFive)}`);
  }

  const fourUp = await getCollectionFilterPayload({
    shopDomain: SHOP_DOMAIN,
    collectionGid: COLLECTION_GID,
    selected: { rating: ["4"] },
  });
  if (titles(fourUp).join(",") !== "Almost Five,Five Star") {
    fail(`4 stars and up expected Almost Five + Five Star, got ${titles(fourUp)}`);
  }

  log.info("5-star products remain when filtering 5 stars");
  log.info("STEPD5_OK");
} catch (error) {
  log.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  await cleanup().catch(() => {});
  await prisma.$disconnect();
}
