/**
 * C11 gate: per-facet AND vs OR (tags, options, list metafields).
 * Usage: npm run verify:c11
 */
import "tsx/esm";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { log } from "./terminal-log.mjs";
import { seedFilterConfig } from "./seed-filter-config.mjs";

const SHOP_DOMAIN = "c11-verify.myshopify.com";
const COLLECTION_GID = "gid://shopify/Collection/9811001";
const MF_KEY = "mf_custom_material";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const prisma = new PrismaClient();

function fail(message) {
  throw new Error(message);
}

function titles(result) {
  return (result.data?.products ?? []).map((p) => p.title).sort();
}

function findFacet(result, key) {
  return (result.data?.facets ?? []).find((facet) => facet.key === key);
}

function assertStaticMarkers() {
  const collectionPage = readFileSync(
    join(ROOT, "app/routes/app.collections.$id.tsx"),
    "utf8",
  );
  const defaultPage = readFileSync(
    join(ROOT, "app/routes/app.collections.default.tsx"),
    "utf8",
  );
  const filters = readFileSync(join(ROOT, "app/services/filters.server.ts"), "utf8");

  if (!collectionPage.includes("matchModes") || !collectionPage.includes("Use AND condition")) {
    fail("collection config missing AND vs OR / matchModes");
  }
  if (!defaultPage.includes("matchModes") || !defaultPage.includes("Use AND condition")) {
    fail("shop-wide default config missing AND vs OR / matchModes");
  }
  if (!filters.includes("selectedMatchList") || !filters.includes("parseMatchModes")) {
    fail("filters.server.ts missing match mode helpers");
  }
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
    enableTags: true,
    enableOptions: true,
    enableVendor: true,
    enablePrice: false,
    enableAvailability: false,
    enableProductType: false,
    matchModes: {},
  });

  await prisma.metafieldMapping.deleteMany({ where: { shopId: shop.id } });
  await prisma.metafieldMapping.create({
    data: {
      shopId: shop.id,
      namespace: "custom",
      key: "material",
      displayLabel: "Material",
      filterType: "LIST",
      ownerType: "PRODUCT",
      enabled: true,
      sortOrder: 0,
    },
  });

  const products = [
    {
      productGid: "gid://shopify/Product/9811001",
      handle: "c11-dual",
      title: "C11 Dual",
      vendor: "Acme",
      tags: ["Red", "Blue"],
      options: { Color: ["Red", "Blue"] },
      metafields: { "custom.material": JSON.stringify(["cotton", "linen"]) },
    },
    {
      productGid: "gid://shopify/Product/9811002",
      handle: "c11-red-only",
      title: "C11 Red Only",
      vendor: "Northwind",
      tags: ["Red"],
      options: { Color: ["Red"] },
      metafields: { "custom.material": JSON.stringify(["cotton"]) },
    },
    {
      productGid: "gid://shopify/Product/9811003",
      handle: "c11-blue-only",
      title: "C11 Blue Only",
      vendor: "Northwind",
      tags: ["Blue"],
      options: { Color: ["Blue"] },
      metafields: { "custom.material": JSON.stringify(["linen"]) },
    },
  ];

  for (const [index, product] of products.entries()) {
    await prisma.productFacet.upsert({
      where: {
        shopId_productGid: { shopId: shop.id, productGid: product.productGid },
      },
      create: {
        shopId: shop.id,
        productGid: product.productGid,
        handle: product.handle,
        title: product.title,
        vendor: product.vendor,
        productType: "Apparel",
        tags: product.tags,
        options: product.options,
        priceMin: 20,
        priceMax: 20,
        available: true,
        status: "ACTIVE",
        imageUrl: null,
        metafields: product.metafields,
      },
      update: {
        title: product.title,
        vendor: product.vendor,
        tags: product.tags,
        options: product.options,
        metafields: product.metafields,
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
        position: index,
      },
      update: { position: index },
    });
  }

  return shop;
}

try {
  await cleanup();
  const shop = await seedShopData();
  log.info(`Seeded shop ${SHOP_DOMAIN}`);
  assertStaticMarkers();

  const { getCollectionFilterPayload } = await import("../app/services/proxy.server.ts");
  const { saveFilterConfig, getFilterConfig } = await import("../app/services/shop.server.ts"
  );

  async function payload(selected, matchModes) {
    if (matchModes) {
      await saveFilterConfig(shop.id, {
        collectionGid: COLLECTION_GID,
        enableTags: true,
        enableOptions: true,
        enableVendor: true,
        matchModes,
      });
    }
    return getCollectionFilterPayload({
      shopDomain: SHOP_DOMAIN,
      collectionGid: COLLECTION_GID,
      selected,
    });
  }

  const orTags = await payload({ tag: ["Red", "Blue"] }, { tags: "or" });
  if (titles(orTags).join(",") !== "C11 Blue Only,C11 Dual,C11 Red Only") {
    fail(`OR tags Red|Blue expected all three, got ${titles(orTags).join(",")}`);
  }
  if (findFacet(orTags, "tag")?.matchMode !== "or") {
    fail("tag facet matchMode should default to or");
  }
  log.info("Tags Red OR Blue returns Dual + Red Only + Blue Only");

  const andTags = await payload({ tag: ["Red", "Blue"] }, { tags: "and" });
  if (titles(andTags).join(",") !== "C11 Dual") {
    fail(`AND tags Red+Blue expected Dual only, got ${titles(andTags).join(",")}`);
  }
  if (findFacet(andTags, "tag")?.matchMode !== "and") {
    fail("tag facet matchMode should be and");
  }
  log.info("Tags Red AND Blue returns Dual only");

  const orColor = await payload(
    { opt_Color: ["Red", "Blue"] },
    { tags: "or", options: "or" },
  );
  if (titles(orColor).join(",") !== "C11 Blue Only,C11 Dual,C11 Red Only") {
    fail(`OR Color expected all three, got ${titles(orColor).join(",")}`);
  }

  const andColor = await payload(
    { opt_Color: ["Red", "Blue"] },
    { options: "and" },
  );
  if (titles(andColor).join(",") !== "C11 Dual") {
    fail(`AND Color Red+Blue expected Dual only, got ${titles(andColor).join(",")}`);
  }
  if (findFacet(andColor, "opt_Color")?.matchMode !== "and") {
    fail("Color option facet should inherit options AND");
  }
  log.info("Color Red AND Blue returns Dual only");

  const orMf = await payload(
    { [MF_KEY]: ["cotton", "linen"] },
    { [MF_KEY]: "or" },
  );
  if (titles(orMf).join(",") !== "C11 Blue Only,C11 Dual,C11 Red Only") {
    fail(`OR material expected all three, got ${titles(orMf).join(",")}`);
  }

  const andMf = await payload(
    { [MF_KEY]: ["cotton", "linen"] },
    { [MF_KEY]: "and" },
  );
  if (titles(andMf).join(",") !== "C11 Dual") {
    fail(`AND material cotton+linen expected Dual only, got ${titles(andMf).join(",")}`);
  }
  log.info("List metafield cotton AND linen returns Dual only");

  const cross = await payload(
    { vendor: ["Acme"], tag: ["Red"] },
    { tags: "or" },
  );
  if (titles(cross).join(",") !== "C11 Dual") {
    fail(`cross-facet Vendor Acme AND Tag Red expected Dual, got ${titles(cross).join(",")}`);
  }
  log.info("Cross-facet still AND (Vendor and Tags)");

  const persisted = await getFilterConfig(shop.id, COLLECTION_GID);
  const modes =
    persisted?.matchModes &&
    typeof persisted.matchModes === "object" &&
    !Array.isArray(persisted.matchModes)
      ? persisted.matchModes
      : {};
  if (modes.tags === "and") {
    fail("last save used tags OR; persisted tags should not be and");
  }
  await saveFilterConfig(shop.id, {
    collectionGid: COLLECTION_GID,
    enableTags: true,
    enableOptions: true,
    enableVendor: true,
    matchModes: { tags: "and", options: "and", [MF_KEY]: "and" },
  });
  const reloaded = await getFilterConfig(shop.id, COLLECTION_GID);
  const saved = reloaded?.matchModes ?? {};
  if (saved.tags !== "and" || saved.options !== "and" || saved[MF_KEY] !== "and") {
    fail(`matchModes persist failed: ${JSON.stringify(saved)}`);
  }
  log.info("matchModes persist on FilterConfig");

  log.success("STEPC11_OK tags/options/metafields OR vs AND; cross-facet AND");
} catch (error) {
  log.error(`STEPC11_FAIL ${error.message}`);
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
