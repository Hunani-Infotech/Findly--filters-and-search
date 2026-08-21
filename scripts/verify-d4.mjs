/**
 * D4 gate: filter by inventory locations (available qty > 0 at selected location).
 * Usage: npm run verify:d4
 */
import "tsx/esm";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { log } from "./terminal-log.mjs";
import { seedFilterConfig } from "./seed-filter-config.mjs";

const SHOP_DOMAIN = "d4-verify.myshopify.com";
const COLLECTION_GID = "gid://shopify/Collection/9404001";
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
  const schema = readRepo("prisma", "schema.prisma");
  if (!schema.includes("enableLocation") || !schema.includes("inventoryLocations")) {
    fail("schema missing enableLocation / inventoryLocations");
  }
  const graphql = readRepo("app", "sync", "graphql.ts");
  if (
    !graphql.includes("inventoryLevels") ||
    !graphql.includes('quantities(names: ["available"])') ||
    !graphql.includes("location {")
  ) {
    fail("sync GraphQL must fetch inventoryLevels / available quantities / location");
  }
  const mapper = readRepo("app", "sync", "product-mapper.ts");
  if (
    !mapper.includes("availableLocationNamesFromVariants") ||
    !mapper.includes("inventoryLocations")
  ) {
    fail("product-mapper.ts missing availableLocationNamesFromVariants / inventoryLocations");
  }
  const filters = readRepo("app", "filters.ts");
  if (!filters.includes('source: "location"') || !filters.includes("enableLocation")) {
    fail("filters.ts missing location facet / enableLocation");
  }
  const editor = readRepo("app", "routes", "app.filters.$id.tsx");
  if (!editor.includes("enableLocation")) {
    fail("filter tree editor missing Inventory locations toggle");
  }
  const toml = readRepo("shopify.app.toml");
  if (!toml.includes("read_inventory") || !toml.includes("read_locations")) {
    fail("shopify.app.toml missing read_inventory / read_locations");
  }
  log.info("D4 static markers present");
}

async function cleanup() {
  await prisma.shop.deleteMany({ where: { domain: SHOP_DOMAIN } });
}

try {
  await cleanup();
  assertStaticMarkers();

  const { availableLocationNamesFromVariants } = await import(
    "../app/sync/product-mapper.ts"
  );
  const names = availableLocationNamesFromVariants([
    {
      inventoryItem: {
        id: "gid://shopify/InventoryItem/1",
        inventoryLevels: {
          edges: [
            {
              node: {
                quantities: [{ name: "available", quantity: 4 }],
                location: { name: "Warehouse A", isActive: true },
              },
            },
            {
              node: {
                quantities: [{ name: "available", quantity: 0 }],
                location: { name: "Warehouse B", isActive: true },
              },
            },
          ],
        },
      },
    },
  ]);
  if (names.join(",") !== "Warehouse A") {
    fail(`expected only Warehouse A, got ${names}`);
  }

  const shop = await prisma.shop.create({
    data: { domain: SHOP_DOMAIN, plan: "free" },
  });

  await seedFilterConfig(prisma, shop.id, {
    collectionGid: COLLECTION_GID,
    enabled: true,
    enableLocation: true,
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
      gid: "gid://shopify/Product/94040011",
      handle: "only-a",
      title: "Only A",
      inventoryLocations: ["Warehouse A"],
    },
    {
      gid: "gid://shopify/Product/94040012",
      handle: "only-b",
      title: "Only B",
      inventoryLocations: ["Warehouse B"],
    },
    {
      gid: "gid://shopify/Product/94040013",
      handle: "both-ab",
      title: "Both",
      inventoryLocations: ["Warehouse A", "Warehouse B"],
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
        metafields: {},
        inventoryLocations: product.inventoryLocations,
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
  const locationFacet = (all.data?.facets ?? []).find(
    (facet) => facet.source === "location",
  );
  if (!locationFacet) fail("location facet missing when enableLocation is true");
  if (locationFacet.source !== "location") {
    fail(`location facet source expected "location", got ${locationFacet.source}`);
  }
  const locationValues = new Set(
    (locationFacet.values ?? []).map((item) => item.value),
  );
  if (!locationValues.has("Warehouse A") || !locationValues.has("Warehouse B")) {
    fail(
      `location values should include Warehouse A and Warehouse B, got ${[...locationValues]}`,
    );
  }

  const onlyA = await getCollectionFilterPayload({
    shopDomain: SHOP_DOMAIN,
    collectionGid: COLLECTION_GID,
    selected: { location: ["Warehouse A"] },
  });
  if (titles(onlyA).join(",") !== "Both,Only A") {
    fail(`filtering Warehouse A expected Both,Only A, got ${titles(onlyA)}`);
  }

  const onlyB = await getCollectionFilterPayload({
    shopDomain: SHOP_DOMAIN,
    collectionGid: COLLECTION_GID,
    selected: { location: ["Warehouse B"] },
  });
  if (titles(onlyB).join(",") !== "Both,Only B") {
    fail(`filtering Warehouse B expected Both,Only B, got ${titles(onlyB)}`);
  }

  log.info("two locations, filter shows products available at location A only");
  log.info("STEPD4_OK");
} catch (error) {
  log.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  await cleanup().catch(() => {});
  await prisma.$disconnect();
}
