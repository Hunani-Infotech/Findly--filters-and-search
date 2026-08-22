/**
 * D3 gate: collection membership facet, Collection display-type redirect, nested tree.
 * Usage: npm run verify:d3
 */
import "tsx/esm";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { log } from "./terminal-log.mjs";
import { seedFilterConfig } from "./seed-filter-config.mjs";
import {
  nestCollectionValues,
  collectionStorefrontPath,
} from "../app/collection-facet.ts";

const SHOP_DOMAIN = "d3-verify.myshopify.com";
const ALL_GID = "gid://shopify/Collection/9303000";
const PARENT_GID = "gid://shopify/Collection/9303001";
const CHILD_GID = "gid://shopify/Collection/9303002";
const OTHER_GID = "gid://shopify/Collection/9303003";
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

function collectionFacet(result) {
  return (result.data?.facets ?? []).find(
    (facet) => facet.key === "collection" && facet.source === "collection",
  );
}

function assertStaticMarkers() {
  const filters = readRepo("app", "filters.ts");
  if (
    !filters.includes('source: "collection"') ||
    !filters.includes('"collection"')
  ) {
    fail("filters.ts missing collection facet source / display type");
  }
  const helper = readRepo("app", "collection-facet.ts");
  if (
    !helper.includes("nestCollectionValues") ||
    !helper.includes("collectionStorefrontPath")
  ) {
    fail("collection-facet.ts missing nest / storefront path helpers");
  }
  const widget = readRepo(
    "extensions",
    "smart-filter",
    "assets",
    "smart-filter.js",
  );
  if (
    !widget.includes("renderCollectionFacet") ||
    !widget.includes("window.location.assign")
  ) {
    fail("smart-filter.js missing Collection display-type redirect");
  }
  if (
    !widget.includes("shouldNavigateCollectionFacet") ||
    !widget.includes("isAllProductsCollectionHandle")
  ) {
    fail(
      "smart-filter.js missing collections/all AJAX vs other-collection permalink navigation",
    );
  }
  const liquid = readRepo(
    "extensions",
    "smart-filter",
    "blocks",
    "collection-filters.liquid",
  );
  const embed = readRepo(
    "extensions",
    "smart-filter",
    "blocks",
    "collection-filters-embed.liquid",
  );
  if (
    !liquid.includes("data-collection-handle") ||
    !embed.includes("data-collection-handle")
  ) {
    fail("collection filter blocks missing data-collection-handle");
  }
  if (!widget.includes("smart-filter__tree-children")) {
    fail("smart-filter.js missing nested collection tree markup");
  }
  const editor = readRepo("app", "components", "filter-option-editor.tsx");
  if (
    !editor.includes("Build a collection tree with multi-level sub-collections")
  ) {
    fail("filter option editor missing collection tree checkbox");
  }
  log.info("D3 static markers present");
}

async function cleanup() {
  await prisma.shop.deleteMany({ where: { domain: SHOP_DOMAIN } });
}

async function addCollection(shopId, { gid, title, handle }) {
  await prisma.collection.create({
    data: {
      shopId,
      collectionGid: gid,
      title,
      handle,
    },
  });
}

async function addProduct(shopId, { gid, handle, title, collections }) {
  await prisma.productFacet.create({
    data: {
      shopId,
      productGid: gid,
      handle,
      title,
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
    },
  });
  for (const collectionGid of collections) {
    await prisma.collectionMembership.create({
      data: {
        shopId,
        collectionGid,
        productGid: gid,
        position: 0,
      },
    });
  }
}

try {
  assertStaticMarkers();

  const nested = nestCollectionValues(
    [
      { value: PARENT_GID, label: "Parent", count: 2, handle: "parent", url: "/collections/parent" },
      { value: CHILD_GID, label: "Child", count: 1, handle: "child", url: "/collections/child" },
    ],
    { [CHILD_GID]: PARENT_GID },
  );
  if (nested.length !== 1 || nested[0].value !== PARENT_GID) {
    fail("nestCollectionValues should keep Parent as the only root");
  }
  if (!nested[0].children?.some((child) => child.value === CHILD_GID)) {
    fail("nestCollectionValues should nest Child under Parent");
  }
  if (collectionStorefrontPath("child") !== "/collections/child") {
    fail(`storefront path expected /collections/child, got ${collectionStorefrontPath("child")}`);
  }

  await cleanup();
  const shop = await prisma.shop.create({
    data: { domain: SHOP_DOMAIN, plan: "free" },
  });

  await addCollection(shop.id, {
    gid: ALL_GID,
    title: "All",
    handle: "all",
  });
  await addCollection(shop.id, {
    gid: PARENT_GID,
    title: "Parent",
    handle: "parent",
  });
  await addCollection(shop.id, {
    gid: CHILD_GID,
    title: "Child",
    handle: "child",
  });
  await addCollection(shop.id, {
    gid: OTHER_GID,
    title: "Other",
    handle: "other",
  });

  await seedFilterConfig(prisma, shop.id, {
    collectionGid: PARENT_GID,
    enabled: true,
    enablePrice: false,
    enableAvailability: false,
    enableVendor: false,
    enableProductType: false,
    enableTags: false,
    enableOptions: false,
    enableSale: false,
    enableRating: false,
    displayOrder: ["collection"],
    displayTypes: { collection: "checkbox" },
    facetSettings: {
      collection: {
        collectionTree: true,
        collectionParents: { [CHILD_GID]: PARENT_GID },
      },
    },
  });

  await addProduct(shop.id, {
    gid: "gid://shopify/Product/93030011",
    handle: "alpha",
    title: "Alpha",
    collections: [ALL_GID, PARENT_GID, CHILD_GID],
  });
  await addProduct(shop.id, {
    gid: "gid://shopify/Product/93030012",
    handle: "beta",
    title: "Beta",
    collections: [ALL_GID, PARENT_GID],
  });
  await addProduct(shop.id, {
    gid: "gid://shopify/Product/93030013",
    handle: "gamma",
    title: "Gamma",
    collections: [ALL_GID, OTHER_GID],
  });

  const { clearFilterPayloadCache, getCollectionFilterPayload } = await import(
    "../app/proxy.server.ts"
  );
  const { invalidateFilterTreeResolveCache } = await import(
    "../app/filter-trees.server.ts"
  );

  const unfiltered = await getCollectionFilterPayload({
    shopDomain: SHOP_DOMAIN,
    collectionGid: PARENT_GID,
    selected: {},
  });
  if (titles(unfiltered).join(",") !== "Alpha,Beta") {
    fail(`parent collection should show Alpha+Beta, got ${titles(unfiltered)}`);
  }
  const checkboxFacet = collectionFacet(unfiltered);
  if (!checkboxFacet) fail("collection facet missing in checkbox mode");
  if (checkboxFacet.displayType !== "checkbox") {
    fail(`expected checkbox displayType, got ${checkboxFacet.displayType}`);
  }
  const nestedChild = (checkboxFacet.values ?? []).find(
    (item) => item.value === PARENT_GID,
  );
  if (!nestedChild?.children?.some((child) => child.value === CHILD_GID)) {
    fail("nested parent/child collections did not render on the payload");
  }

  const inPlace = await getCollectionFilterPayload({
    shopDomain: SHOP_DOMAIN,
    collectionGid: PARENT_GID,
    selected: { collection: [CHILD_GID] },
  });
  if (titles(inPlace).join(",") !== "Alpha") {
    fail(
      `checkbox mode should keep products in Child (Alpha), got ${titles(inPlace)}`,
    );
  }

  await seedFilterConfig(prisma, shop.id, {
    collectionGid: PARENT_GID,
    displayTypes: { collection: "collection" },
    displayOrder: ["collection"],
    enablePrice: false,
    enableAvailability: false,
    enableVendor: false,
    enableProductType: false,
    enableTags: false,
    enableOptions: false,
    enableSale: false,
    enableRating: false,
    facetSettings: {
      collection: {
        collectionTree: true,
        collectionParents: { [CHILD_GID]: PARENT_GID },
      },
    },
  });
  await seedFilterConfig(prisma, shop.id, {
    collectionGid: ALL_GID,
    displayTypes: { collection: "collection" },
    displayOrder: ["collection"],
    enablePrice: false,
    enableAvailability: false,
    enableVendor: false,
    enableProductType: false,
    enableTags: false,
    enableOptions: false,
    enableSale: false,
    enableRating: false,
  });
  invalidateFilterTreeResolveCache(shop.id);
  clearFilterPayloadCache();

  const redirectMode = await getCollectionFilterPayload({
    shopDomain: SHOP_DOMAIN,
    collectionGid: PARENT_GID,
    selected: {},
  });
  const navFacet = collectionFacet(redirectMode);
  if (!navFacet) fail("collection facet missing in Collection display type");
  if (navFacet.displayType !== "collection") {
    fail(`expected collection displayType, got ${navFacet.displayType}`);
  }
  const other = (navFacet.values ?? []).find((item) => item.value === OTHER_GID);
  if (!other) fail("Collection display type should list all store collections");
  if (other.handle !== "other" || other.url !== "/collections/other") {
    fail(
      `Collection value should include handle+url, got handle=${other.handle} url=${other.url}`,
    );
  }
  const stillOnPage = titles(redirectMode).join(",");
  if (stillOnPage !== "Alpha,Beta") {
    fail(
      `Collection display type must not filter in place, got ${stillOnPage}`,
    );
  }

  const catalogAjax = await getCollectionFilterPayload({
    shopDomain: SHOP_DOMAIN,
    collectionGid: ALL_GID,
    selected: { collection: [CHILD_GID] },
  });
  if (titles(catalogAjax).join(",") !== "Alpha") {
    fail(
      `collections/all AJAX should filter by collection membership, got ${titles(catalogAjax)}`,
    );
  }

  log.info("Checkbox mode filters in place by collection membership");
  log.info("Collection display type lists all collections with redirect URLs");
  log.info("collections/all AJAX still applies collection membership");
  log.info("Nested parent/child collections render");
  log.info("STEPD3_OK");
} catch (error) {
  log.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  await cleanup().catch(() => {});
  await prisma.$disconnect();
}
