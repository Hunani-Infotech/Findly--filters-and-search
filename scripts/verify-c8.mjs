/**
 * C8 gate: search by mapped metafields (reuse A7 mappings).
 * Usage: npm run verify:c8
 */
import "tsx/esm";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { log } from "./terminal-log.mjs";

const SHOP_DOMAIN = "c8-verify.myshopify.com";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const prisma = new PrismaClient();

function fail(message) {
  throw new Error(message);
}

function handles(rows) {
  return rows.map((p) => p.handle);
}

function assertStaticMarkers() {
  const appSettings = readFileSync(join(ROOT, "app/app-settings.ts"), "utf8");
  const searchServer = readFileSync(join(ROOT, "app/search.server.ts"), "utf8");
  const settingsPage = readFileSync(
    join(ROOT, "app/routes/app.settings.tsx"),
    "utf8",
  );
  const metafieldsPage = readFileSync(
    join(ROOT, "app/routes/app.metafields.tsx"),
    "utf8",
  );

  if (!appSettings.includes('"metafields"')) {
    fail("SEARCH_FIELD_KEYS must include metafields");
  }
  if (!searchServer.includes("enabledMetafieldPaths")) {
    fail("search.server.ts missing mapped metafield path helper");
  }
  if (!searchServer.includes("metafieldListValues")) {
    fail("search.server.ts must reuse metafieldListValues");
  }
  if (
    !settingsPage.includes("Metafields is ticked") &&
    !settingsPage.includes("Metafields (mapped)")
  ) {
    fail("Settings search fields missing Metafields help / control");
  }
  if (!metafieldsPage.includes("Search fields includes Metafields")) {
    fail("Metafields page should note search reuse (no second island)");
  }
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
      vendor: "Other",
      tags: [],
      skus: [],
      options: {},
      priceMin: 10,
      priceMax: 10,
      available: true,
      status: "ACTIVE",
      imageUrl: null,
      ...product,
    },
    update: {
      handle: product.handle,
      title: product.title,
      metafields: product.metafields,
      status: product.status ?? "ACTIVE",
    },
  });
}

async function seedShopData() {
  const shop = await prisma.shop.upsert({
    where: { domain: SHOP_DOMAIN },
    create: { domain: SHOP_DOMAIN, plan: "free" },
    update: { uninstalledAt: null, plan: "free" },
  });

  await prisma.appSettings.upsert({
    where: { shopId: shop.id },
    create: {
      shopId: shop.id,
      searchFields: ["title", "vendor", "productType", "tags", "metafields"],
    },
    update: {
      searchFields: ["title", "vendor", "productType", "tags", "metafields"],
    },
  });

  await prisma.metafieldMapping.createMany({
    data: [
      {
        shopId: shop.id,
        namespace: "custom",
        key: "material",
        displayLabel: "Material",
        filterType: "LIST",
        enabled: true,
        sortOrder: 0,
      },
      {
        shopId: shop.id,
        namespace: "custom",
        key: "hidden",
        displayLabel: "Hidden",
        filterType: "LIST",
        enabled: false,
        sortOrder: 1,
      },
    ],
  });

  await upsertProduct(shop.id, {
    productGid: "gid://shopify/Product/9808001",
    handle: "c8-mf-cotton",
    title: "Linen Blend Shirt",
    metafields: { "custom.material": "cotton" },
  });
  await upsertProduct(shop.id, {
    productGid: "gid://shopify/Product/9808002",
    handle: "c8-mf-list",
    title: "Other List Item",
    metafields: { "custom.material": '["Cotton Soft"]' },
  });
  await upsertProduct(shop.id, {
    productGid: "gid://shopify/Product/9808003",
    handle: "c8-title-cotton",
    title: "Cotton Candy Tee",
    metafields: {},
  });
  await upsertProduct(shop.id, {
    productGid: "gid://shopify/Product/9808004",
    handle: "c8-disabled-mf",
    title: "Other Disabled",
    metafields: { "custom.hidden": "cotton" },
  });
  await upsertProduct(shop.id, {
    productGid: "gid://shopify/Product/9808005",
    handle: "c8-unmapped-mf",
    title: "Other Unmapped",
    metafields: { "custom.unmapped": "cotton" },
  });
  await upsertProduct(shop.id, {
    productGid: "gid://shopify/Product/9808006",
    handle: "c8-draft-mf",
    title: "Other Draft",
    metafields: { "custom.material": "cotton" },
    status: "DRAFT",
  });

  return shop;
}

try {
  assertStaticMarkers();
  await cleanup();
  const shop = await seedShopData();
  log.info(`Seeded shop ${SHOP_DOMAIN} (id=${shop.id})`);

  const { searchProducts, searchProductFacets, productMatchesKeyword } =
    await import("../app/search.server.ts");
  const { saveAppSettings } = await import("../app/settings.server.ts");
  const { getSearchPayload } = await import("../app/proxy.server.ts");

  const defaultHits = await searchProducts(shop.id, "cotton");
  const defaultHandles = handles(defaultHits);
  if (!defaultHandles.includes("c8-mf-cotton")) {
    fail(`"cotton" must find mapped material metafield, got ${JSON.stringify(defaultHandles)}`);
  }
  if (!defaultHandles.includes("c8-mf-list")) {
    fail(`list JSON ["Cotton Soft"] must match cotton, got ${JSON.stringify(defaultHandles)}`);
  }
  if (!defaultHandles.includes("c8-title-cotton")) {
    fail(`title Cotton Candy Tee must still match, got ${JSON.stringify(defaultHandles)}`);
  }
  if (defaultHandles.includes("c8-disabled-mf")) {
    fail("disabled mapping custom.hidden must not be searchable");
  }
  if (defaultHandles.includes("c8-unmapped-mf")) {
    fail("unmapped custom.unmapped must not be searchable");
  }
  if (defaultHandles.includes("c8-draft-mf")) {
    fail("DRAFT metafield cotton must never appear");
  }
  if (defaultHandles[0] !== "c8-title-cotton") {
    fail(
      `title match must rank above metafield-only, got ${JSON.stringify(defaultHandles)}`,
    );
  }
  log.info("cotton matches mapped metafields + title; ranking prefers title");

  const facets = await searchProductFacets(shop.id, "cotton");
  if (!handles(facets).includes("c8-mf-cotton")) {
    fail("searchProductFacets must include metafield cotton hit");
  }

  const proxy = await getSearchPayload({
    shopDomain: SHOP_DOMAIN,
    query: "cotton",
  });
  if ("error" in proxy) {
    fail(`getSearchPayload failed: ${proxy.error}`);
  }
  const proxyHandles = handles(proxy.data.products);
  if (!proxyHandles.includes("c8-mf-cotton")) {
    fail(
      `search proxy must return metafield cotton product, got ${JSON.stringify(proxyHandles)}`,
    );
  }

  await saveAppSettings(shop.id, { searchFields: ["metafields"] });
  const mfOnly = handles(await searchProducts(shop.id, "cotton"));
  if (mfOnly.includes("c8-title-cotton")) {
    fail("metafields-only must not match title Cotton Candy Tee");
  }
  if (
    mfOnly.join(",") !== "c8-mf-cotton,c8-mf-list" &&
    !(mfOnly.includes("c8-mf-cotton") && mfOnly.includes("c8-mf-list") && mfOnly.length === 2)
  ) {
    fail(`metafields-only expected two mapped hits, got ${JSON.stringify(mfOnly)}`);
  }
  log.info("metafields-only search ignores title and unmapped/disabled keys");

  await saveAppSettings(shop.id, { searchFields: ["title"] });
  const titleOnly = handles(await searchProducts(shop.id, "cotton"));
  if (titleOnly.join(",") !== "c8-title-cotton") {
    fail(`title-only expected Candy Tee, got ${JSON.stringify(titleOnly)}`);
  }

  await saveAppSettings(shop.id, { searchFields: ["metafields"] });
  await prisma.metafieldMapping.updateMany({
    where: { shopId: shop.id, key: "material" },
    data: { enabled: false },
  });
  const noneMapped = await searchProducts(shop.id, "cotton");
  if (noneMapped.length !== 0) {
    fail(
      `disabled material mapping must return [], got ${JSON.stringify(handles(noneMapped))}`,
    );
  }

  const listMatch = productMatchesKeyword(
    {
      title: "Other",
      vendor: "",
      productType: "",
      tags: [],
      skus: [],
      options: {},
      metafields: { "custom.material": '["Cotton Soft"]' },
    },
    "cotton",
    ["metafields"],
    ["custom.material"],
  );
  if (!listMatch) {
    fail("productMatchesKeyword must search list metafield values");
  }

  log.success("STEPC8_OK mapped metafield values are searchable");
} catch (error) {
  log.error(`STEPC8_FAIL ${error.message}`);
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
