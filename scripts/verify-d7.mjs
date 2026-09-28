/**
 * D7 gate: scoped custom CSS + Liquid snippet editor.
 * Usage: npm run verify:d7
 */
import "tsx/esm";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createPrismaClient } from "./prisma-runtime.mjs";
import { log } from "./terminal-log.mjs";
import { seedFilterConfig } from "./seed-filter-config.mjs";
import {
  sanitizeCustomCss,
  sanitizeProductListLiquid,
  scopeCustomCss,
} from "../app/utils/widget-code.ts";

const SHOP_DOMAIN = "d7-verify.myshopify.com";
const COLLECTION_GID = "gid://shopify/Collection/9707001";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const prisma = createPrismaClient();

function fail(message) {
  throw new Error(message);
}

function readRepo(...parts) {
  return readFileSync(join(ROOT, ...parts), "utf8");
}

function assertStaticMarkers() {
  const widgetCode = readRepo("app", "utils", "widget-code.ts");
  for (const name of [
    "sanitizeCustomCss",
    "scopeCustomCss",
    "sanitizeProductListLiquid",
  ]) {
    if (!widgetCode.includes(`export function ${name}`)) {
      fail(`app/utils/widget-code.ts missing ${name}`);
    }
  }

  const settingsPage = readRepo("app", "routes", "app.settings.tsx");
  if (!settingsPage.includes("Custom CSS") || !settingsPage.includes("customCss")) {
    fail("Settings Filter panel missing Custom CSS editor");
  }
  if (!settingsPage.includes("Product list Liquid")) {
    fail("Settings Filter panel missing Product list Liquid editor");
  }

  const widget = readRepo(
    "extensions",
    "smart-filter",
    "assets",
    "smart-filter.js",
  );
  if (
    !widget.includes("data-findly-custom") ||
    !widget.includes("settings.customCss")
  ) {
    fail("smart-filter.js must inject style[data-findly-custom] from settings.customCss");
  }
  if (widget.includes("document.head") && widget.includes("customCss")) {
    fail("custom CSS must not be written to document.head");
  }

  const widgetSettings = readRepo("app", "services", "widget-settings.server.ts");
  if (
    !widgetSettings.includes("scopeCustomCss") ||
    !widgetSettings.includes("customCss:")
  ) {
    fail(
      "widget-settings.server.ts must send scoped customCss on the storefront settings payload",
    );
  }
  const proxy = readRepo("app", "services", "proxy.server.ts");
  if (!proxy.includes("customCss") && !proxy.includes("settings")) {
    fail("proxy.server.ts must expose settings (including customCss) on filter payload");
  }

  const schema = readRepo("prisma", "schema.prisma");
  if (!schema.includes("customCss") || !schema.includes("productListLiquid")) {
    fail("schema.prisma missing customCss / productListLiquid");
  }

  log.info("D7 static markers present");
}

function assertSanitizer() {
  if (sanitizeCustomCss("@import url('https://evil.example/x.css'); .a{color:red}")
    .toLowerCase()
    .includes("@import")) {
    fail("@import must be stripped");
  }
  if (sanitizeCustomCss("a{background:url(javascript:alert(1))}").includes("javascript")) {
    fail("javascript: urls must be stripped");
  }

  const scopedHeader = scopeCustomCss("header { color: red }");
  if (/\bheader\s*\{/.test(scopedHeader) && !scopedHeader.includes(".smart-filter")) {
    fail("header { } must not leak as a top-level header rule");
  }
  if (!scopedHeader.includes(".smart-filter")) {
    fail("scoped CSS must include .smart-filter");
  }

  const accent = scopeCustomCss("--sf-accent: #c00;");
  if (!accent.includes("--sf-accent") || !accent.includes(".smart-filter")) {
    fail("bare --sf-accent must apply inside .smart-filter");
  }

  const already = scopeCustomCss(".smart-filter .title { color: blue }");
  if (already.includes(".smart-filter .smart-filter")) {
    fail("must not double-prefix .smart-filter selectors");
  }

  const bodyOwned = scopeCustomCss("body .smart-filter { padding: 0 }");
  if (bodyOwned.includes(":is(") && bodyOwned.includes(") .smart-filter")) {
    fail("body .smart-filter must collapse to owned .smart-filter, not nest under :is(...)");
  }
  if (!bodyOwned.trim().startsWith(".smart-filter")) {
    fail("body .smart-filter must become .smart-filter { … }");
  }

  const appCard = scopeCustomCss(".sf-app-card { outline: 1px solid red }");
  if (appCard.includes(".smart-filter .sf-app-card")) {
    fail(".sf-app-card must not become .smart-filter .sf-app-card");
  }
  if (!appCard.trim().startsWith(".sf-app-card")) {
    fail(".sf-app-card owned-root selector must be left unprefixed");
  }

  const gridHost = scopeCustomCss("#findly-grid-host .x { color: red }");
  if (/\.smart-filter\s+#findly-grid-host\b/.test(gridHost)) {
    fail("#findly-grid-host must not become .smart-filter #findly-grid-host");
  }
  if (!gridHost.trim().startsWith("#findly-grid-host")) {
    fail("#findly-grid-host owned-root selector must be left unprefixed");
  }

  const generic = scopeCustomCss(".foo { color: red }");
  if (
    !generic.includes(":is(") ||
    !generic.includes("#findly-grid-host") ||
    !generic.includes(".sf-drawer-portal") ||
    !generic.includes(".smart-filter")
  ) {
    fail("generic .foo must match under expanded :is(...) including grid/drawer hosts");
  }

  const liquid = sanitizeProductListLiquid(
    "<script>alert(1)</script>{% javascript %}bad{% endjavascript %}{{ content_for_header }}<div>{{ product.title }}</div>",
  );
  if (
    /<script/i.test(liquid) ||
    /javascript/i.test(liquid) ||
    /content_for_header/i.test(liquid)
  ) {
    fail("Liquid sanitizer must strip script / javascript / content_for_header");
  }
  if (!liquid.includes("product.title")) {
    fail("Liquid sanitizer should keep product.title");
  }

  log.info("D7 sanitizer / scoper tests passed");
}

async function cleanup() {
  await prisma.shop.deleteMany({ where: { domain: SHOP_DOMAIN } });
}

try {
  assertStaticMarkers();
  assertSanitizer();
  await cleanup();

  const shop = await prisma.shop.create({
    data: { domain: SHOP_DOMAIN, plan: "free" },
  });
  await prisma.appSettings.create({
    data: {
      shopId: shop.id,
      customCss: "header { color: red } --sf-accent: #c00;",
      productListLiquid: "<script>x</script><div>{{ product.title }}</div>",
    },
  });
  await seedFilterConfig(prisma, shop.id, {
    collectionGid: COLLECTION_GID,
    enabled: true,
  });
  await prisma.productFacet.create({
    data: {
      shopId: shop.id,
      productGid: "gid://shopify/Product/d7-1",
      handle: "d7-tee",
      title: "D7 Tee",
      vendor: "Findly",
      productType: "Apparel",
      tags: [],
      options: {},
      priceMin: 10,
      priceMax: 10,
      available: true,
      status: "ACTIVE",
      imageUrl: null,
    },
  });
  await prisma.collectionMembership.create({
    data: {
      shopId: shop.id,
      collectionGid: COLLECTION_GID,
      productGid: "gid://shopify/Product/d7-1",
      position: 1,
    },
  });

  const { saveAppSettings, getAppSettings } = await import("../app/services/settings.server.ts"
  );
  const { getCollectionFilterPayload } = await import("../app/services/proxy.server.ts");

  await saveAppSettings(shop.id, {
    customCss:
      "@import url('https://evil.example/x.css');\nheader { color: red }\n--sf-accent: #c00;",
    productListLiquid:
      "<script>alert(1)</script>{{ content_for_header }}<div>{{ product.title }}</div>",
  });
  const stored = await getAppSettings(shop.id);
  if (stored.customCss.toLowerCase().includes("@import")) {
    fail("saved customCss still contains @import");
  }
  if (!stored.customCss.includes("--sf-accent")) {
    fail("saved customCss dropped --sf-accent");
  }
  if (/<script/i.test(stored.productListLiquid)) {
    fail("saved Liquid still contains script");
  }

  const payload = await getCollectionFilterPayload({
    shopDomain: SHOP_DOMAIN,
    collectionGid: COLLECTION_GID,
    selected: {},
  });
  if ("error" in payload && payload.error) fail(payload.error);
  const css = payload.data?.settings?.customCss || "";
  if (!css.includes(".smart-filter")) {
    fail(`payload customCss must be scoped, got ${JSON.stringify(css)}`);
  }
  if (!css.includes("--sf-accent")) {
    fail("payload customCss missing --sf-accent");
  }
  if (/^\s*header\s*\{/m.test(css)) {
    fail("payload customCss leaked a top-level header rule");
  }

  log.success("STEPD7_OK custom CSS is scoped to the filter widget");
} catch (error) {
  log.error(`STEPD7_FAIL ${error instanceof Error ? error.message : String(error)}`);
  if (error instanceof Error && error.stack) console.error(error.stack);
  process.exitCode = 1;
} finally {
  try {
    await cleanup();
    log.info(`Cleaned up shop ${SHOP_DOMAIN}`);
  } catch (cleanupError) {
    log.warn(
      `Cleanup failed for ${SHOP_DOMAIN}: ${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}`,
    );
  }
  await prisma.$disconnect();
}
