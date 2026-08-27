/**
 * C13 gate: variant metafield filters (product vs variant owner, any-variant match).
 * Usage: npm run verify:c13
 */
import "tsx/esm";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { log } from "./terminal-log.mjs";
import { seedFilterConfig } from "./seed-filter-config.mjs";

const SHOP_DOMAIN = "c13-verify.myshopify.com";
const COLLECTION_GID = "gid://shopify/Collection/9130013";
const HANDLE_A = "c13-slim-tee";
const HANDLE_B = "c13-variant-fit-tee";
const PRODUCT_A_GID = "gid://shopify/Product/91300131";
const PRODUCT_B_GID = "gid://shopify/Product/91300132";

const prisma = new PrismaClient();

function fail(message) {
  throw new Error(message);
}

function readRepo(...relParts) {
  const root = path.dirname(fileURLToPath(import.meta.url));
  return fs.readFileSync(path.join(root, "..", ...relParts), "utf8");
}

function handles(result) {
  return (result.data?.products ?? []).map((p) => p.handle);
}

function extractExport(source, name) {
  const start = source.indexOf(`export const ${name}`);
  if (start < 0) fail(`app/sync/admin-graphql.ts missing ${name}`);
  const next = source.indexOf("export const", start + `export const ${name}`.length);
  return source.slice(start, next < 0 ? source.length : next);
}

function variantsBlockIncludesMetafields(chunk, label) {
  const idx = chunk.search(/\bvariants\s*[\({]/);
  if (idx < 0) fail(`${label} must include variants`);
  const open = chunk.indexOf("{", idx);
  if (open < 0) fail(`${label} variants block is malformed`);
  let depth = 0;
  let end = -1;
  for (let i = open; i < chunk.length; i += 1) {
    const ch = chunk[i];
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end < 0) fail(`${label} variants block is unclosed`);
  const block = chunk.slice(open, end + 1);
  if (!/\bmetafields\b/.test(block)) {
    fail(`${label} must include metafields under variants (Admin GraphQL, not REST)`);
  }
}

function assertStaticMarkers() {
  const graphql = readRepo("app", "sync", "admin-graphql.ts");
  variantsBlockIncludesMetafields(
    extractExport(graphql, "PRODUCT_NODE_QUERY"),
    "PRODUCT_NODE_QUERY",
  );
  variantsBlockIncludesMetafields(
    extractExport(graphql, "BULK_PRODUCTS_MUTATION"),
    "BULK_PRODUCTS_MUTATION",
  );
  if (/\bfetch\s*\(/.test(graphql) || /Admin REST/.test(graphql)) {
    fail("admin-graphql.ts must stay Admin GraphQL only (no fetch( or Admin REST)");
  }
  log.info("admin-graphql.ts: variant metafields on PRODUCT_NODE_QUERY + BULK; no REST");

  const mapper = readRepo("app", "sync", "product-mapper.ts");
  if (!mapper.includes("variantMetafields")) {
    fail("app/sync/product-mapper.ts missing variantMetafields");
  }
  log.info("product-mapper.ts includes variantMetafields");

  const metafieldsPage = readRepo("app", "routes", "app.metafields.tsx");
  if (!metafieldsPage.includes("ownerType")) {
    fail("app/routes/app.metafields.tsx missing ownerType");
  }
  if (!metafieldsPage.includes("Variant")) {
    fail('app/routes/app.metafields.tsx missing "Variant" owner option');
  }
  log.info("metafields admin page includes ownerType and Variant");

  const filters = readRepo("app", "services", "filters.server.ts");
  if (!filters.includes("metafieldOwner") && !filters.includes("variantMetafields")) {
    fail("app/services/filters.server.ts must include metafieldOwner or variantMetafields");
  }
  log.info("filters.server.ts includes metafieldOwner / variantMetafields");

  const schema = readRepo("prisma", "schema.prisma");
  if (!schema.includes("ownerType")) {
    fail("prisma/schema.prisma missing ownerType");
  }
  if (!schema.includes("variantMetafields")) {
    fail("prisma/schema.prisma missing variantMetafields");
  }
  log.info("schema.prisma includes ownerType and variantMetafields");
}

function resolveFacetKeys(filtersMod) {
  let productKey = "mf_custom_material";
  let variantKey = "mf_v_custom_fit";
  if (typeof filtersMod.metafieldFacetKey === "function") {
    productKey = filtersMod.metafieldFacetKey("custom", "material", "PRODUCT");
    variantKey = filtersMod.metafieldFacetKey("custom", "fit", "VARIANT");
  } else if (typeof filtersMod.facetsFromConfig === "function") {
    const defs = filtersMod.facetsFromConfig(null, [
      {
        enabled: true,
        namespace: "custom",
        key: "material",
        ownerType: "PRODUCT",
        filterType: "LIST",
        displayLabel: "Material",
        sortOrder: 0,
      },
      {
        enabled: true,
        namespace: "custom",
        key: "fit",
        ownerType: "VARIANT",
        filterType: "LIST",
        displayLabel: "Fit",
        sortOrder: 1,
      },
    ]);
    const material = defs.find(
      (facet) =>
        facet.metafieldKey === "material" ||
        facet.label === "Material" ||
        /material/.test(facet.key),
    );
    const fit = defs.find(
      (facet) =>
        facet.metafieldKey === "fit" ||
        facet.label === "Fit" ||
        /fit/.test(facet.key),
    );
    if (material?.key) productKey = material.key;
    if (fit?.key && fit.key !== productKey) variantKey = fit.key;
  }
  return { productKey, variantKey };
}

async function cleanup() {
  await prisma.shop.deleteMany({ where: { domain: SHOP_DOMAIN } });
}

async function upsertProduct(shopId, product) {
  await prisma.productFacet.upsert({
    where: {
      shopId_productGid: { shopId, productGid: product.productGid },
    },
    create: {
      shopId,
      productType: "Apparel",
      vendor: "C13 Labs",
      tags: ["c13-verify"],
      skus: [],
      options: {},
      priceMin: 20,
      priceMax: 20,
      available: true,
      status: "ACTIVE",
      imageUrl: null,
      ...product,
    },
    update: {
      handle: product.handle,
      title: product.title,
      metafields: product.metafields,
      variantMetafields: product.variantMetafields,
      status: product.status ?? "ACTIVE",
    },
  });

  await prisma.collectionMembership.upsert({
    where: {
      shopId_collectionGid_productGid: {
        shopId,
        collectionGid: COLLECTION_GID,
        productGid: product.productGid,
      },
    },
    create: {
      shopId,
      collectionGid: COLLECTION_GID,
      productGid: product.productGid,
    },
    update: {},
  });
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
    enablePrice: true,
    enableAvailability: true,
    enableVendor: true,
    enableProductType: true,
    enableTags: true,
    enableOptions: true,
  });

  await prisma.collection.upsert({
    where: {
      shopId_collectionGid: { shopId: shop.id, collectionGid: COLLECTION_GID },
    },
    create: {
      shopId: shop.id,
      collectionGid: COLLECTION_GID,
      title: "C13 Verify Collection",
      handle: "c13-verify",
    },
    update: { title: "C13 Verify Collection" },
  });

  await prisma.metafieldMapping.createMany({
    data: [
      {
        shopId: shop.id,
        namespace: "custom",
        key: "material",
        displayLabel: "Material",
        filterType: "LIST",
        ownerType: "PRODUCT",
        enabled: true,
        sortOrder: 0,
      },
      {
        shopId: shop.id,
        namespace: "custom",
        key: "fit",
        displayLabel: "Fit",
        filterType: "LIST",
        ownerType: "VARIANT",
        enabled: true,
        sortOrder: 1,
      },
    ],
  });

  await upsertProduct(shop.id, {
    productGid: PRODUCT_A_GID,
    handle: HANDLE_A,
    title: "C13 Slim Tee",
    metafields: { "custom.material": "linen" },
    variantMetafields: {},
  });
  await upsertProduct(shop.id, {
    productGid: PRODUCT_B_GID,
    handle: HANDLE_B,
    title: "C13 Variant Fit Tee",
    metafields: {},
    variantMetafields: { "custom.fit": "slim" },
  });

  return shop;
}

function assertJsonlVariantMetafields(parseBulkJsonlProducts, mapProductToFacet) {
  const productGid = "gid://shopify/Product/1";
  const variantGid = "gid://shopify/ProductVariant/2";
  const lines = [
    JSON.stringify({
      id: productGid,
      handle: "c13-jsonl",
      title: "C13 JSONL",
      vendor: "C13 Labs",
      productType: "Apparel",
      tags: [],
      status: "ACTIVE",
    }),
    JSON.stringify({
      id: variantGid,
      __parentId: productGid,
      sku: "C13-V",
      price: "10.00",
      availableForSale: true,
    }),
    JSON.stringify({
      id: "gid://shopify/Metafield/3",
      __parentId: variantGid,
      namespace: "custom",
      key: "fit",
      value: "slim",
    }),
  ];

  const products = parseBulkJsonlProducts(lines);
  if (!products?.length) {
    fail("parseBulkJsonlProducts returned no products for JSONL fixture");
  }
  const { facet } = mapProductToFacet("c13-jsonl-shop", products[0]);
  const variantBag = facet.variantMetafields ?? {};
  const productBag = facet.metafields ?? {};
  const variantFit = variantBag["custom.fit"];
  if (variantFit !== "slim" && !String(variantFit || "").includes("slim")) {
    fail(
      `mapProductToFacet must put slim on variantMetafields["custom.fit"], got ${JSON.stringify(variantBag)}`,
    );
  }
  if (productBag["custom.fit"] != null && productBag["custom.fit"] !== "") {
    fail(
      `variant metafield custom.fit must not land on product metafields, got ${JSON.stringify(productBag)}`,
    );
  }
  log.info("JSONL variant metafield nested under variantMetafields, not product metafields");
}

try {
  assertStaticMarkers();
  await cleanup();
  const shop = await seedShopData();
  log.info(`Seeded shop ${SHOP_DOMAIN} (id=${shop.id})`);

  const filtersMod = await import("../app/services/filters.server.ts");
  const { productKey, variantKey } = resolveFacetKeys(filtersMod);
  log.info(`Facet keys: product=${productKey} variant=${variantKey}`);

  const { parseBulkJsonlProducts, mapProductToFacet } = await import(
    "../app/sync/product-mapper.ts"
  );
  assertJsonlVariantMetafields(parseBulkJsonlProducts, mapProductToFacet);

  const { getCollectionFilterPayload } = await import("../app/services/proxy.server.ts");

  const unfiltered = await getCollectionFilterPayload({
    shopDomain: SHOP_DOMAIN,
    collectionGid: COLLECTION_GID,
    selected: {},
  });
  if (unfiltered.error || !unfiltered.data?.enabled) {
    fail(
      `getCollectionFilterPayload failed: ${unfiltered.error ?? "filters disabled or empty payload"}`,
    );
  }

  const selectedFit = await getCollectionFilterPayload({
    shopDomain: SHOP_DOMAIN,
    collectionGid: COLLECTION_GID,
    selected: { [variantKey]: ["slim"] },
  });
  const fitHandles = handles(selectedFit);
  if (!fitHandles.includes(HANDLE_B)) {
    fail(`variant fit=slim must return ${HANDLE_B}, got ${JSON.stringify(fitHandles)}`);
  }
  if (fitHandles.includes(HANDLE_A)) {
    fail(`variant fit=slim must not return ${HANDLE_A}, got ${JSON.stringify(fitHandles)}`);
  }
  log.info("variant metafield custom.fit=slim matches product B only");

  const selectedMaterial = await getCollectionFilterPayload({
    shopDomain: SHOP_DOMAIN,
    collectionGid: COLLECTION_GID,
    selected: { [productKey]: ["linen"] },
  });
  const materialHandles = handles(selectedMaterial);
  if (!materialHandles.includes(HANDLE_A)) {
    fail(
      `product material=linen must return ${HANDLE_A}, got ${JSON.stringify(materialHandles)}`,
    );
  }
  if (materialHandles.includes(HANDLE_B)) {
    fail(
      `product material=linen must not return ${HANDLE_B}, got ${JSON.stringify(materialHandles)}`,
    );
  }
  log.info("product metafield custom.material=linen matches product A only");

  const productFitKey =
    typeof filtersMod.metafieldFacetKey === "function"
      ? filtersMod.metafieldFacetKey("custom", "fit", "PRODUCT")
      : "mf_custom_fit";
  const selectedProductFit = await getCollectionFilterPayload({
    shopDomain: SHOP_DOMAIN,
    collectionGid: COLLECTION_GID,
    selected: { [productFitKey]: ["slim"] },
  });
  const productFitHandles = handles(selectedProductFit);
  if (productFitHandles.includes(HANDLE_B) && !productFitHandles.includes(HANDLE_A)) {
    fail(
      "variant-only custom.fit must not match as product-level custom.fit (no PRODUCT mapping)",
    );
  }
  log.info("no product-level custom.fit mapping; B is not matched that way");

  log.success("STEPC13_OK variant metafield filters (product vs variant owner)");
} catch (error) {
  log.error(`STEPC13_FAIL ${error.message}`);
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
