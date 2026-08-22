/**
 * D8 gate: App Embed product-grid / template settings + interpolator + app-card CSS.
 * Usage: npm run verify:d8
 * Static checks only (no database / no browser).
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { log } from "./terminal-log.mjs";
import {
  assertInterpolatorSourceLocked,
  escapeHtml,
  extractConstArrowOrFn,
  extractNamedFunction,
  extractPrototypeMethod,
  interpolateTemplate,
} from "./lib/embed-template.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const EMBED_SETTING_IDS = [
  "product_grid_selector",
  "use_quickview_template",
  "custom_javascript",
  "custom_css",
  "product_template",
  "tree_template",
  "sort_template",
  "search_template",
  "variables",
];

const EMBED_CONFIG_KEYS = [
  "productGridSelector",
  "useQuickviewTemplate",
  "customCss",
  "customJavascript",
  "productTemplate",
  "treeTemplate",
  "sortTemplate",
  "searchTemplate",
  "variables",
  "themeId",
];

const EMBED_DATA_ATTRS = [
  'data-embed="true"',
  "data-embed-config",
  "data-product-grid-selector",
  "data-use-quickview",
];

const CSS_CLASSES = [
  ".sf-app-grid",
  ".sf-app-card",
  ".sf-quickview",
  ".sf-quickview-btn",
];

function fail(message) {
  throw new Error(message);
}

function readRepo(...parts) {
  return readFileSync(join(ROOT, ...parts), "utf8");
}

function includesAny(haystack, needles) {
  return needles.some((needle) => haystack.includes(needle));
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function assertEmbedLiquid() {
  const liquid = readRepo(
    "extensions",
    "smart-filter",
    "blocks",
    "collection-filters-embed.liquid",
  );
  assert(
    liquid.includes('id="findly-embed-config"'),
    'embed liquid missing id "findly-embed-config"',
  );
  assert(
    liquid.includes("findly-embed-css"),
    "embed liquid missing findly-embed-css",
  );
  assert(
    liquid.includes('"target": "body"') || liquid.includes('"target":"body"'),
    "embed schema must still target body",
  );
  for (const id of EMBED_SETTING_IDS) {
    assert(
      liquid.includes(`"id": "${id}"`) || liquid.includes(`"id":"${id}"`),
      `embed liquid missing setting id ${id}`,
    );
  }
  for (const key of EMBED_CONFIG_KEYS) {
    assert(
      liquid.includes(`"${key}"`),
      `embed JSON config missing key ${key}`,
    );
  }
  assert(
    liquid.includes("block.settings.product_grid_selector"),
    "embed config must bind productGridSelector to product_grid_selector",
  );
  assert(
    liquid.includes("block.settings.use_quickview_template"),
    "embed config must bind useQuickviewTemplate",
  );
  assert(
    liquid.includes("block.settings.product_template"),
    "embed config must bind productTemplate",
  );
  assert(
    liquid.includes("theme.id"),
    "embed config must expose {{ theme.id }} as themeId",
  );
  assert(
    liquid.includes("block.settings.variables"),
    "embed config must bind variables",
  );
  for (const attr of EMBED_DATA_ATTRS) {
    assert(liquid.includes(attr), `embed liquid missing ${attr}`);
  }
  assert(
    liquid.includes("window.__findlyEmbedJsRan = true"),
    "liquid custom JS must set __findlyEmbedJsRan so widget does not double-run",
  );
  assert(
    /"type":\s*"liquid"[\s\S]{0,80}"id":\s*"variables"/.test(liquid) ||
      /"id":\s*"variables"[\s\S]{0,80}"type":\s*"liquid"/.test(liquid),
    'variables setting must be type "liquid"',
  );
  log.info("D8 embed liquid config keys + data attributes present");
}

function assertEmbedLocales() {
  const schemaLocales = readRepo(
    "extensions",
    "smart-filter",
    "locales",
    "en.default.schema.json",
  );
  const storefrontLocales = readRepo(
    "extensions",
    "smart-filter",
    "locales",
    "en.default.json",
  );
  for (const id of EMBED_SETTING_IDS) {
    assert(
      schemaLocales.includes(id),
      `en.default.schema.json missing label key for ${id}`,
    );
    assert(
      storeFrontIncludes(storefrontLocales, id),
      `en.default.json missing label key for ${id}`,
    );
  }
  assert(
    schemaLocales.includes("{{product.title}}") &&
      schemaLocales.includes("{{product.vendor}}") &&
      schemaLocales.includes("{{variables}}"),
    "schema locale product_template/variables info must document placeholders",
  );
  log.info("D8 embed locale labels present");
}

function storeFrontIncludes(haystack, id) {
  return haystack.includes(`"${id}"`);
}

function assertWidgetCallChains(widget) {
  const ensureGrid = extractPrototypeMethod(widget, "ensureGridParent");
  assert(
    ensureGrid.includes("gridFromSelector("),
    "ensureGridParent must call gridFromSelector",
  );
  assert(
    ensureGrid.includes("productGridSelector"),
    "ensureGridParent must pass productGridSelector into gridFromSelector",
  );

  extractNamedFunction(widget, "gridFromSelector");

  const fetchFilters = extractPrototypeMethod(widget, "fetchFilters");
  assert(
    fetchFilters.includes("this.isAppGridMode()"),
    "fetchFilters must branch on isAppGridMode",
  );
  assert(
    fetchFilters.includes("this.applyAppGrid("),
    "fetchFilters must call applyAppGrid in app-grid mode",
  );
  assert(
    fetchFilters.includes("ensureQuickviewButtons()"),
    "fetchFilters must call ensureQuickviewButtons after grid apply",
  );

  const applyAppGrid = extractPrototypeMethod(widget, "applyAppGrid");
  assert(
    applyAppGrid.includes("this.ensureGridParent()"),
    "applyAppGrid must use ensureGridParent",
  );
  assert(
    applyAppGrid.includes("sf-app-grid") && applyAppGrid.includes("sf-app-card"),
    "applyAppGrid must mark .sf-app-grid / render .sf-app-card",
  );

  const qv = extractPrototypeMethod(widget, "ensureQuickviewButtons");
  assert(
    qv.includes("useQuickviewTemplate"),
    "ensureQuickviewButtons must gate on useQuickviewTemplate",
  );
  assert(
    qv.includes("sf-quickview-btn"),
    "ensureQuickviewButtons must inject .sf-quickview-btn",
  );

  const maybeJs = extractNamedFunction(widget, "maybeRunEmbedJs");
  assert(
    maybeJs.includes("__findlyEmbedJsRan"),
    "maybeRunEmbedJs must check/set window.__findlyEmbedJsRan",
  );
  assert(
    /if\s*\(\s*window\.__findlyEmbedJsRan\s*\)\s*return/.test(maybeJs),
    "maybeRunEmbedJs must return early when __findlyEmbedJsRan is set",
  );

  const chrome = extractPrototypeMethod(widget, "applyEmbedChrome");
  assert(
    chrome.includes("this.applyTreeTemplate(") &&
      chrome.includes("this.applySortTemplate(") &&
      chrome.includes("this.applySearchTemplate("),
    "applyEmbedChrome must call applyTreeTemplate / applySortTemplate / applySearchTemplate",
  );
  extractPrototypeMethod(widget, "applyTreeTemplate");
  extractPrototypeMethod(widget, "applySortTemplate");
  extractPrototypeMethod(widget, "applySearchTemplate");
  extractPrototypeMethod(widget, "isAppGridMode");

  const ctx = extractNamedFunction(widget, "productTemplateContext");
  assert(
    ctx.includes("vendor:") && ctx.includes("item.vendor"),
    "productTemplateContext must expose product.vendor",
  );

  log.info("D8 widget call chains present");
}

function assertWidgetJs() {
  const widget = readRepo(
    "extensions",
    "smart-filter",
    "assets",
    "smart-filter.js",
  );
  assert(
    includesAny(widget, ["findly-embed-config", "readEmbedConfig"]),
    "smart-filter.js missing findly-embed-config or readEmbedConfig",
  );
  const readCfg = extractNamedFunction(widget, "readEmbedConfig");
  for (const key of EMBED_CONFIG_KEYS) {
    assert(
      readCfg.includes(key),
      `readEmbedConfig missing ${key}`,
    );
  }
  assert(
    includesAny(widget, [
      "productGridSelector",
      "product_grid_selector",
      "data-product-grid-selector",
    ]),
    "smart-filter.js missing productGridSelector / product_grid_selector / data-product-grid-selector",
  );
  assert(
    includesAny(widget, ["sf-app-card", "productTemplate"]),
    "smart-filter.js missing sf-app-card or productTemplate",
  );
  assert(
    includesAny(widget, [
      "sf-quickview",
      "useQuickviewTemplate",
      "data-findly-quickview",
    ]),
    "smart-filter.js missing sf-quickview / useQuickviewTemplate / data-findly-quickview",
  );

  const interpolator = extractNamedFunction(widget, "interpolateTemplate");
  assert(
    interpolator.includes("{{#") || interpolator.includes("\\{\\{#"),
    "interpolateTemplate must support {{#section}} blocks",
  );
  assert(
    interpolator.includes("raw"),
    "interpolateTemplate must support | raw",
  );
  assert(
    interpolator.includes("escapeHtml"),
    "interpolateTemplate must HTML-escape unpiped values",
  );

  assertCustomCssNotOnDocumentHead(widget);
  assertWidgetCallChains(widget);
  log.info("D8 widget JS markers present");
  return widget;
}

function assertCustomCssNotOnDocumentHead(widget) {
  const idx = widget.indexOf("var customCss");
  assert(idx !== -1, "smart-filter.js missing var customCss injection");
  const block = widget.slice(idx, idx + 900);
  assert(
    !block.includes("document.head"),
    "custom CSS must not be written to document.head",
  );
  assert(
    block.includes("this.root.appendChild") ||
      block.includes("this.root.querySelector"),
    "custom CSS must be injected on the widget root, not <head>",
  );
  if (widget.includes("document.head") && widget.includes("customCss")) {
    fail("custom CSS must not be written to document.head");
  }
  log.info("D8 custom CSS is not written to document.head");
}

function assertCss() {
  const css = readRepo(
    "extensions",
    "smart-filter",
    "assets",
    "smart-filter.css",
  );
  for (const cls of CSS_CLASSES) {
    assert(css.includes(cls), `smart-filter.css missing ${cls}`);
  }
  log.info("D8 app-grid / quickview CSS present");
}

function assertProxyProductCard() {
  const proxy = readRepo("app", "proxy.server.ts");
  const card = extractConstArrowOrFn(proxy, "productCard");
  assert(
    /vendor:\s*product\.vendor/.test(card),
    "proxy.server.ts productCard must include vendor: product.vendor",
  );
  assert(
    /productType:\s*product\.productType/.test(card),
    "proxy.server.ts productCard must include productType: product.productType",
  );
  log.info("D8 proxy productCard includes vendor and productType");
}

function assertInterpolator(widget) {
  assertInterpolatorSourceLocked(widget, fail);

  const escaped = interpolateTemplate("{{product.title}}", {
    product: { title: 'Sale <b>50%</b> & "WOAH"' },
  });
  assert(
    escaped === escapeHtml('Sale <b>50%</b> & "WOAH"'),
    `{{product.title}} must be HTML-escaped, got ${JSON.stringify(escaped)}`,
  );
  assert(
    !escaped.includes("<b>") && escaped.includes("&lt;b&gt;"),
    "{{product.title}} must escape tags",
  );

  const raw = interpolateTemplate("{{product.title | raw}}", {
    product: { title: "<em>ok</em>" },
  });
  assert(raw === "<em>ok</em>", "| raw must skip HTML escaping");

  const rawSpaced = interpolateTemplate("{{  product.title  |  raw  }}", {
    product: { title: "<i>x</i>" },
  });
  assert(rawSpaced === "<i>x</i>", "| raw must allow whitespace around the filter");

  const shown = interpolateTemplate(
    "{{#product.available}}IN STOCK{{/product.available}}",
    { product: { available: true } },
  );
  assert(shown === "IN STOCK", "{{#product.available}} true must render inner");

  const hidden = interpolateTemplate(
    "{{#product.available}}IN STOCK{{/product.available}}",
    { product: { available: false } },
  );
  assert(hidden === "", "{{#product.available}} false must omit inner");

  const zero = interpolateTemplate("{{#product.available}}X{{/product.available}}", {
    product: { available: 0 },
  });
  assert(zero === "", "{{#product.available}} 0 must be falsy");

  const theme = interpolateTemplate("theme={{theme.id}}", {
    theme: { id: "gid://shopify/OnlineStoreTheme/9" },
  });
  assert(
    theme === "theme=gid://shopify/OnlineStoreTheme/9",
    "{{theme.id}} must interpolate nested theme id",
  );

  const vars = interpolateTemplate("v={{variables}}", {
    variables: "shop-x",
  });
  assert(vars === "v=shop-x", "{{variables}} must interpolate");

  const varsEscaped = interpolateTemplate("{{variables}}", {
    variables: "<script>alert(1)</script>",
  });
  assert(
    varsEscaped === escapeHtml("<script>alert(1)</script>"),
    "{{variables}} without raw must be escaped",
  );

  log.info("D8 interpolator rules locked");
}

try {
  assertEmbedLiquid();
  assertEmbedLocales();
  const widget = assertWidgetJs();
  assertCss();
  assertProxyProductCard();
  assertInterpolator(widget);
  log.success("STEPD8_OK app embed settings + app-grid / quick view CSS");
} catch (error) {
  log.error(`STEPD8_FAIL ${error instanceof Error ? error.message : String(error)}`);
  if (error instanceof Error && error.stack) console.error(error.stack);
  process.exitCode = 1;
}
