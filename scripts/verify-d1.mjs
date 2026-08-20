/**
 * D1 gate: named filter trees — two collections + dedicated search tree.
 * Usage: npm run verify:d1
 */
import "tsx/esm";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { log } from "./terminal-log.mjs";
import { seedFilterConfig } from "./seed-filter-config.mjs";

const SHOP_DOMAIN = "d1-verify.myshopify.com";
const COL_A = "gid://shopify/Collection/9100001";
const COL_B = "gid://shopify/Collection/9100002";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const prisma = new PrismaClient();

function fail(message) {
  throw new Error(message);
}

function facetKeys(result) {
  return (result.data?.facets ?? []).map((facet) => facet.key);
}

function readRepo(...parts) {
  return readFileSync(join(ROOT, ...parts), "utf8");
}

function assertStaticMarkers() {
  const schema = readRepo("prisma", "schema.prisma");
  if (!schema.includes("model FilterTreeCollection") || !schema.includes("appliesToSearch")) {
    fail("schema missing FilterTreeCollection / appliesToSearch");
  }
  const trees = readRepo("app", "filter-trees.server.ts");
  if (
    !trees.includes("resolveFilterTreeForCollection") ||
    !trees.includes("resolveFilterTreeForSearch") ||
    !trees.includes("duplicateFilterTree")
  ) {
    fail("filter-trees.server.ts missing resolve/duplicate");
  }
  const indexPage = readRepo("app", "routes", "app._index.tsx");
  if (!indexPage.includes("+ Add Filter") || !indexPage.includes("listFilterTrees")) {
    fail("home is missing filter tree list / create");
  }
  const editor = readRepo("app", "routes", "app.filters.$id.tsx");
  if (!editor.includes("appliesToSearch") || !editor.includes("Duplicate")) {
    fail("tree editor missing search flag or duplicate");
  }
  log.info("D1 static markers present");
}

async function cleanup() {
  await prisma.shop.deleteMany({ where: { domain: SHOP_DOMAIN } });
}

async function addProduct(shopId, { gid, handle, title, collectionGid }) {
  await prisma.productFacet.create({
    data: {
      shopId,
      productGid: gid,
      handle,
      title,
      vendor: "Acme",
      productType: "Apparel",
      tags: ["sale"],
      options: {},
      priceMin: 20,
      priceMax: 20,
      available: true,
      status: "ACTIVE",
      imageUrl: null,
      metafields: {},
    },
  });
  await prisma.collectionMembership.create({
    data: {
      shopId,
      collectionGid,
      productGid: gid,
      position: 0,
    },
  });
}

try {
  await cleanup();
  assertStaticMarkers();

  const shop = await prisma.shop.create({
    data: { domain: SHOP_DOMAIN, plan: "free" },
  });

  await prisma.collection.createMany({
    data: [
      {
        shopId: shop.id,
        collectionGid: COL_A,
        title: "Collection A",
        handle: "col-a",
      },
      {
        shopId: shop.id,
        collectionGid: COL_B,
        title: "Collection B",
        handle: "col-b",
      },
    ],
  });

  await addProduct(shop.id, {
    gid: "gid://shopify/Product/91000011",
    handle: "alpha",
    title: "Alpha",
    collectionGid: COL_A,
  });
  await addProduct(shop.id, {
    gid: "gid://shopify/Product/91000012",
    handle: "beta",
    title: "Beta",
    collectionGid: COL_B,
  });

  const defaultTree = await seedFilterConfig(prisma, shop.id, {
    collectionGid: "",
    name: "Default",
    enabled: true,
    enableVendor: true,
    enableTags: true,
    enablePrice: true,
  });

  const treeA = await prisma.filterConfig.create({
    data: {
      shopId: shop.id,
      name: "Tree A",
      collectionGid: COL_A,
      enabled: true,
      enableVendor: true,
      enableTags: false,
      enablePrice: true,
    },
  });
  await prisma.filterTreeCollection.create({
    data: { shopId: shop.id, treeId: treeA.id, collectionGid: COL_A },
  });

  const treeB = await prisma.filterConfig.create({
    data: {
      shopId: shop.id,
      name: "Tree B",
      collectionGid: COL_B,
      enabled: true,
      enableVendor: false,
      enableTags: true,
      enablePrice: true,
    },
  });
  await prisma.filterTreeCollection.create({
    data: { shopId: shop.id, treeId: treeB.id, collectionGid: COL_B },
  });

  const searchTree = await prisma.filterConfig.create({
    data: {
      shopId: shop.id,
      name: "Search tree",
      collectionGid: "",
      appliesToSearch: true,
      enabled: true,
      enableVendor: false,
      enableTags: true,
      enablePrice: false,
    },
  });

  const newerOnA = await prisma.filterConfig.create({
    data: {
      shopId: shop.id,
      name: "Tree A newer",
      collectionGid: COL_A,
      enabled: true,
      enableVendor: false,
      enableTags: true,
      enablePrice: true,
    },
  });
  await prisma.filterTreeCollection.create({
    data: { shopId: shop.id, treeId: newerOnA.id, collectionGid: COL_A },
  });

  if (!defaultTree?.appliesToSearch) {
    fail("empty-GID seed should mark the default tree for search fallback");
  }

  const { getCollectionFilterPayload, getSearchFilterPayload } = await import(
    "../app/proxy.server.ts"
  );

  const payloadA = await getCollectionFilterPayload({
    shopDomain: SHOP_DOMAIN,
    collectionGid: COL_A,
    selected: {},
  });
  const keysA = facetKeys(payloadA);
  if (keysA.includes("vendor")) {
    fail(`collection A should use newest tree (no vendor); got ${keysA}`);
  }
  if (!keysA.includes("tag") && !keysA.includes("tags")) {
    fail(`collection A newest tree should include tags; got ${keysA}`);
  }

  const payloadB = await getCollectionFilterPayload({
    shopDomain: SHOP_DOMAIN,
    collectionGid: COL_B,
    selected: {},
  });
  const keysB = facetKeys(payloadB);
  if (keysB.includes("vendor")) {
    fail(`collection B tree disables vendor; got ${keysB}`);
  }
  if (!keysB.includes("tag") && !keysB.includes("tags")) {
    fail(`collection B should include tags; got ${keysB}`);
  }

  const search = await getSearchFilterPayload({
    shopDomain: SHOP_DOMAIN,
    query: "Alpha",
    selected: {},
  });
  const keysSearch = facetKeys(search);
  if (keysSearch.includes("price")) {
    fail(`search tree disables price; got ${keysSearch}`);
  }
  if (keysSearch.includes("vendor")) {
    fail(`search tree disables vendor; got ${keysSearch}`);
  }

  const { duplicateFilterTree, resolveFilterTreeForCollection, resolveFilterTreeForSearch } =
    await import("../app/filter-trees.server.ts");
  const copy = await duplicateFilterTree(shop.id, treeB.id);
  if (!copy || copy.name !== "Copy of Tree B") {
    fail("duplicateFilterTree should copy name and settings");
  }
  const resolvedA = await resolveFilterTreeForCollection(shop.id, COL_A);
  if (resolvedA?.name !== "Tree A newer") {
    fail(`last-created should win on A, got ${resolvedA?.name}`);
  }
  const resolvedSearch = await resolveFilterTreeForSearch(shop.id);
  if (resolvedSearch?.id !== searchTree.id) {
    fail(`search should use dedicated tree, got ${resolvedSearch?.name}`);
  }

  log.info("two collections use different trees; search uses dedicated tree");
  log.info("STEPD1_OK");
} catch (error) {
  log.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  await cleanup().catch(() => {});
  await prisma.$disconnect();
}
