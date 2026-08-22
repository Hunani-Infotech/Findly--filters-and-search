/**
 * D12 gate: widget chrome translations (Filter, Apply, Clear, In stock).
 * Usage: npm run verify:d12
 */
import "tsx/esm";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { log } from "./terminal-log.mjs";
import { seedFilterConfig } from "./seed-filter-config.mjs";
import {
  matchWidgetLocale,
  mergeWidgetChrome,
  resolveWidgetChrome,
} from "../app/widget-i18n.ts";

const SHOP_DOMAIN = "d12-verify.myshopify.com";
const COLLECTION_GID = "gid://shopify/Collection/9120012";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const prisma = new PrismaClient();

function fail(message) {
  throw new Error(message);
}

function readRepo(...parts) {
  return readFileSync(join(ROOT, ...parts), "utf8");
}

function assertStaticMarkers() {
  const liquid = readRepo(
    "extensions",
    "smart-filter",
    "blocks",
    "collection-filters.liquid",
  );
  if (!liquid.includes("data-locale")) {
    fail("collection-filters.liquid missing data-locale");
  }
  const searchLiquid = readRepo(
    "extensions",
    "smart-filter",
    "blocks",
    "product-search.liquid",
  );
  if (!searchLiquid.includes("data-locale")) {
    fail("product-search.liquid missing data-locale");
  }
  const widget = readRepo("extensions", "smart-filter", "assets", "smart-filter.js");
  if (!widget.includes('params.set("locale"') || !widget.includes("applyI18n")) {
    fail("smart-filter.js missing locale param or applyI18n");
  }
  const admin = readRepo("app", "routes", "app.translation.tsx");
  if (!admin.includes("saveStrings") || !admin.includes("WIDGET_I18N_KEYS")) {
    fail("translation admin missing saveStrings / WIDGET_I18N_KEYS");
  }
  const proxy = readRepo("app", "proxy.server.ts");
  if (!proxy.includes("resolveWidgetChrome") || !proxy.includes("i18n: chrome")) {
    fail("proxy.server.ts missing i18n chrome on payload");
  }
  log.info("D12 static markers present");
}

async function cleanup() {
  await prisma.shop.deleteMany({ where: { domain: SHOP_DOMAIN } });
}

try {
  await cleanup();
  assertStaticMarkers();

  if (matchWidgetLocale("fr-CA", ["en", "fr"]) !== "fr") {
    fail("fr-CA should resolve to fr");
  }
  if (mergeWidgetChrome({ apply: "Appliquer" }).apply !== "Appliquer") {
    fail("mergeWidgetChrome should override apply");
  }
  if (mergeWidgetChrome({ apply: "Appliquer" }).clear !== "Clear filters") {
    fail("mergeWidgetChrome should keep English defaults for missing keys");
  }
  if (resolveWidgetChrome({ fr: { apply: "Appliquer" } }, "fr").chrome.apply !== "Appliquer") {
    fail("resolveWidgetChrome fr.apply");
  }

  const shop = await prisma.shop.create({
    data: { domain: SHOP_DOMAIN, plan: "free" },
  });
  await prisma.appSettings.create({
    data: {
      shopId: shop.id,
      adminExtras: {
        langs: [
          { code: "en", name: "English", complete: true, isDefault: true },
          { code: "fr", name: "French", complete: true, isDefault: false },
        ],
        i18n: {
          fr: {
            filter: "Filtrer :",
            apply: "Appliquer",
            clear: "Effacer",
            in_stock: "En stock",
            out_of_stock: "Rupture de stock",
          },
        },
      },
    },
  });

  await seedFilterConfig(prisma, shop.id, {
    collectionGid: COLLECTION_GID,
    name: "D12 tree",
    enabled: true,
    enableAvailability: true,
    enablePrice: false,
    enableVendor: false,
    enableProductType: false,
    enableTags: false,
  });

  await prisma.productFacet.create({
    data: {
      shopId: shop.id,
      productGid: "gid://shopify/Product/d12-1",
      handle: "d12-shirt",
      title: "D12 Shirt",
      vendor: "Acme",
      productType: "Apparel",
      tags: [],
      options: {},
      priceMin: 10,
      priceMax: 10,
      available: true,
      status: "ACTIVE",
      imageUrl: null,
      metafields: {},
    },
  });
  await prisma.collectionMembership.create({
    data: {
      shopId: shop.id,
      collectionGid: COLLECTION_GID,
      productGid: "gid://shopify/Product/d12-1",
      position: 1,
    },
  });

  const { getCollectionFilterPayload, getSearchPayload } = await import(
    "../app/proxy.server.ts"
  );

  const french = await getCollectionFilterPayload({
    shopDomain: SHOP_DOMAIN,
    collectionGid: COLLECTION_GID,
    selected: {},
    locale: "fr-CA",
  });
  if ("error" in french && french.error) fail(french.error);
  if (french.data?.i18n?.apply !== "Appliquer") {
    fail(`expected Appliquer, got ${french.data?.i18n?.apply}`);
  }
  if (french.data?.i18n?.in_stock !== "En stock") {
    fail("French in_stock missing on payload.i18n");
  }
  const availability = (french.data?.facets ?? []).find(
    (facet) => facet.source === "availability" || facet.key === "availability",
  );
  const inStock = (availability?.values ?? []).find((item) => item.value === "in_stock");
  if (!inStock || inStock.label !== "En stock") {
    fail(`availability in_stock label expected En stock, got ${inStock?.label}`);
  }

  const english = await getCollectionFilterPayload({
    shopDomain: SHOP_DOMAIN,
    collectionGid: COLLECTION_GID,
    selected: {},
    locale: "en",
  });
  if (english.data?.i18n?.apply !== "Apply") {
    fail(`English apply should stay Apply, got ${english.data?.i18n?.apply}`);
  }

  const search = await getSearchPayload({
    shopDomain: SHOP_DOMAIN,
    query: "",
    locale: "fr",
  });
  if (search.data?.i18n?.apply !== "Appliquer") {
    fail("search payload should include French chrome");
  }

  await cleanup();
  log.info("STEPD12_OK");
} catch (error) {
  await cleanup().catch(() => undefined);
  log.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
