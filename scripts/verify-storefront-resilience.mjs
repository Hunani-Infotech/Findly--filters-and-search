/**
 * Regression markers for intermittent storefront filter leave-native / fetch races.
 * Run: node ./scripts/verify-storefront-resilience.mjs
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  return readFileSync(join(root, rel), "utf8");
}

function fail(msg) {
  console.error("FAIL:", msg);
  process.exitCode = 1;
}

function ok(msg) {
  console.log("OK:", msg);
}

const fetchJs = read("extensions/smart-filter/assets/smart-filter-fetch.js");
const gridJs = read("extensions/smart-filter/assets/smart-filter-grid.js");
const themeJs = read("extensions/smart-filter/assets/smart-filter-theme.js");
const coreJs = read("extensions/smart-filter/assets/smart-filter.js");
const facetsJs = read("extensions/smart-filter/assets/smart-filter-facets.js");
const block = read("extensions/smart-filter/blocks/collection-filters.liquid");
const embed = read("extensions/smart-filter/blocks/collection-filters-embed.liquid");

if (!fetchJs.includes("budgetMs: 6000")) {
  fail("fetch retry must enforce ~6s overall budget");
} else {
  ok("fetch has 6s budget");
}

if (!/ms:\s*4000/.test(fetchJs)) {
  fail("fetch first-attempt timeout must be ≥4s (ms: 4000)");
} else {
  ok("fetch first attempt is ≥4s");
}

if (!fetchJs.includes("function backoff") || !fetchJs.includes("Math.random()")) {
  fail("fetch retry must use exponential backoff with jitter");
} else {
  ok("fetch uses exponential backoff with jitter");
}

if (!/max:\s*2/.test(fetchJs)) {
  fail("fetch retry max must be 2 (3 attempts total)");
} else {
  ok("fetch max retries is 2");
}

if (!fetchJs.includes("self._reqId !== reqId") && !fetchJs.includes("self._reqId === reqId")) {
  fail("fetch retry must gate on _reqId");
} else {
  ok("fetch gates retries on _reqId");
}

if (!fetchJs.includes("Request failed \\((429|502|503|504)\\)")) {
  fail("fetch retry must include transient HTTP statuses");
} else {
  ok("fetch retries transient HTTP statuses");
}

if (!fetchJs.includes("err instanceof SyntaxError")) {
  fail("fetch retry must include JSON/SyntaxError");
} else {
  ok("fetch retries JSON parse failures");
}

if (!fetchJs.includes("restoreFacetChrome") || !fetchJs.includes("_hydratedFromCache")) {
  fail("failFilterLoad must preserve hydrated/cached facet chrome");
} else {
  ok("failFilterLoad preserves facet chrome after error");
}

if (!fetchJs.includes("__FINDLY_RECORD_LEAVE") || !fetchJs.includes("findly_debug=1")) {
  fail("leave telemetry must be debug-gated");
} else {
  ok("leave telemetry is debug-gated");
}

if (!facetsJs.includes("__FINDLY_FACET_UTILS") || !facetsJs.includes("nestPathLabels")) {
  fail("facet helpers companion missing");
} else {
  ok("facet helpers companion present");
}

{
  const delegated = [
    "nestPathLabels",
    "valuesHaveChildren",
    "applyFacetSwatch",
    "isColorFacet",
    "chipDisplayLabel",
    "isSizeFacet",
    "sortSizeValues",
    "looksLikeCssColor",
    "looksLikeFontFamily",
  ];
  const missingExport = delegated.filter(
    (name) => !new RegExp(`${name}\\s*:`).test(facetsJs),
  );
  if (missingExport.length) {
    fail(
      "facets __FINDLY_FACET_UTILS missing exports: " + missingExport.join(", "),
    );
  } else {
    ok("every core-delegated facet helper is exported");
  }
  const missingFallback = delegated.filter(
    (name) => !new RegExp(`${name}\\s*:`).test(fetchJs),
  );
  if (missingFallback.length) {
    fail("FACET_FALLBACK missing: " + missingFallback.join(", "));
  } else {
    ok("FACET_FALLBACK covers every core-delegated helper");
  }
  if (
    !/function\s+valuesHaveChildren\s*\(/.test(coreJs) ||
    !coreJs.includes("api.valuesHaveChildren")
  ) {
    fail("core must define valuesHaveChildren delegate via facetUtils()");
  } else {
    ok("core defines valuesHaveChildren delegate");
  }
  /* Bare free call without a local function declaration must fail the gate. */
  const stripped = coreJs.replace(
    /function\s+valuesHaveChildren\s*\([\s\S]*?\n\s*\}/,
    "",
  );
  if (!/\bvaluesHaveChildren\s*\(/.test(stripped)) {
    fail(
      "undefined-identifier check needs a valuesHaveChildren call site after stripping the delegate",
    );
  } else if (/function\s+valuesHaveChildren\s*\(/.test(stripped)) {
    fail("failed to strip valuesHaveChildren delegate for undef check");
  } else {
    ok("undefined-identifier check: bare valuesHaveChildren would fail without delegate");
  }
}

if (
  !block.includes("smart-filter-facets.min.js") ||
  !embed.includes("smart-filter-facets.min.js")
) {
  fail("Liquid must load smart-filter-facets.min.js");
} else {
  ok("Liquid loads facets companion");
}

if (!coreJs.includes("__FINDLY_FACET_UTILS") || !coreJs.includes("_fetchMs")) {
  fail("core must delegate facet utils and honor _fetchMs");
} else {
  ok("core uses facet companion + _fetchMs");
}

if (
  !coreJs.includes("__FINDLY_ENSURE_FACET_UTILS") ||
  !coreJs.includes('FINDLY_EXT_V = "8"')
) {
  fail("core must call __FINDLY_ENSURE_FACET_UTILS and set FINDLY_EXT_V");
} else {
  ok("core uses ensure helper + FINDLY_EXT_V");
}

if (
  !fetchJs.includes("FACET_FALLBACK") ||
  !fetchJs.includes("armFacetCompanionRetry") ||
  !fetchJs.includes("__FINDLY_ENSURE_FACET_UTILS")
) {
  fail("fetch companion must own facet fallback + load retry");
} else {
  ok("fetch owns facet fallback / retry");
}

if (
  !facetsJs.includes('FINDLY_EXT_V = "8"') ||
  !facetsJs.includes("__version: FINDLY_EXT_V") ||
  !fetchJs.includes('FINDLY_EXT_V = "8"')
) {
  fail("companions must share FINDLY_EXT_V=8");
} else {
  ok("shared FINDLY_EXT_V=8 on facets + fetch");
}

if (/smart-filter-facets\.min\.js[^>]*\basync\b/.test(block + embed)) {
  fail("facets companion must not use async");
} else {
  ok("facets companion is defer-only (no async)");
}

{
  /* Liquid uses {{ 'file.min.js' | asset_url }} inside <script defer>. */
  const scriptRe =
    /<script\s+src="\{\{\s*'(smart-filter(?:-[a-z0-9.]+)?\.min\.js)'\s*\|\s*asset_url\s*\}\}"\s*defer>/g;
  const embedScripts = [...embed.matchAll(scriptRe)].map((m) => m[1]);
  const need = [
    "smart-filter-facets.min.js",
    "smart-filter-fetch.min.js",
    "smart-filter-theme.min.js",
    "smart-filter.min.js",
  ];
  let prev = -1;
  let orderOk = true;
  for (const name of need) {
    const i = embedScripts.indexOf(name);
    if (i < 0 || i < prev) orderOk = false;
    prev = i;
  }
  if (!orderOk) {
    fail(
      "embed script order must be facets → fetch → … → theme → core; got " +
        embedScripts.join(", "),
    );
  } else {
    ok("embed script order places facets before core");
  }
  const blockScripts = [...block.matchAll(scriptRe)].map((m) => m[1]);
  if (
    blockScripts.indexOf("smart-filter-facets.min.js") < 0 ||
    blockScripts.indexOf("smart-filter-facets.min.js") >
      blockScripts.indexOf("smart-filter-fetch.min.js")
  ) {
    fail("section block must load facets before fetch (defer)");
  } else {
    ok("section block loads facets before fetch");
  }
}

if (
  /widget\._sfMapMiss = true;\s*widget\._sfLeaveNative = true;\s*widget\._visibleHandles = null;\s*showLeaveNativeStatus/.test(
    gridJs,
  )
) {
  fail("map_miss must not immediately leave-native + show applyError");
} else {
  ok("map_miss defers leave-native for app-grid recovery");
}

if (!gridJs.includes("__findlySoftThemePage") || !gridJs.includes("__findlyPagingRecover")) {
  fail("grid must soft-recover theme-page bail and paging fallback");
} else {
  ok("theme-page / paging fallback recovery hooks present");
}

{
  const stuckFn = gridJs.indexOf("function scheduleGridStuckCheck");
  const stuckEnd = gridJs.indexOf("function gridHasAppCard", stuckFn);
  const stuckSlice =
    stuckFn >= 0
      ? gridJs.slice(stuckFn, stuckEnd > stuckFn ? stuckEnd : stuckFn + 5000)
      : "";
  if (
    !stuckSlice.includes("findlyMetric") ||
    !stuckSlice.includes('"grid_stuck"') ||
    !stuckSlice.includes("clearAllGridHiding()") ||
    /showLeaveNativeStatus\s*\(/.test(stuckSlice)
  ) {
    fail("grid_stuck must clear hiding without showLeaveNativeStatus");
  } else {
    ok("grid_stuck clears hiding without applyError");
  }
}

if (
  !themeJs.includes("current.destroy") ||
  !themeJs.includes("__FINDLY_FILTER_WIDGET = null")
) {
  fail("section unload must destroy widget and clear global ref");
} else {
  ok("section unload destroys widget");
}

if (!coreJs.includes("_findlyHttpStatus")) {
  fail("core fetch must tag HTTP status on errors");
} else {
  ok("core tags _findlyHttpStatus on non-OK responses");
}

const sandbox = {
  window: { location: { search: "" } },
  console,
  setTimeout,
  Error,
  TypeError,
  SyntaxError,
  Math,
  Date,
  Object,
  Number,
  String,
  Boolean,
  Array,
  Promise,
};
vm.createContext(sandbox);
vm.runInContext(fetchJs, sandbox);
const api = sandbox.window.__FINDLY_FILTER_FETCH;
if (!api || typeof api.retry !== "function" || typeof api.backoff !== "function") {
  fail("fetch API.retry/backoff not exported");
} else {
  const cases = [
    [Object.assign(new Error("Request failed (503)"), { _findlyHttpStatus: 503 }), false, true],
    [Object.assign(new Error("Request failed (502)"), {}), false, true],
    [Object.assign(new Error("Request failed (401)"), { _findlyHttpStatus: 401 }), false, false],
    [new SyntaxError("Unexpected token <"), false, true],
    [new TypeError("Failed to fetch"), false, true],
    [Object.assign(new Error("aborted"), { name: "AbortError" }), false, false],
    [Object.assign(new Error("aborted"), { name: "AbortError", _findlyTimedOut: 1 }), true, true],
  ];
  for (const [err, timedOut, expect] of cases) {
    const got = api.retry(err, timedOut);
    if (got !== expect) {
      fail(
        "retry(" +
          err.message +
          ", timedOut=" +
          timedOut +
          ") => " +
          got +
          " expected " +
          expect,
      );
    }
  }
  const d0 = api.backoff(0);
  const d1 = api.backoff(1);
  if (!(d0 >= api.waitBase && d0 <= api.waitCap * 1.5)) {
    fail("backoff(0) out of range: " + d0);
  }
  if (!(d1 >= d0 * 0.5)) {
    fail("backoff should grow with attempt");
  }
  if (!process.exitCode) ok("retry/backoff matrix passed");
}

sandbox.window.location.search = "?findly_debug=1";
const logs = [];
sandbox.console.info = function () {
  logs.push(Array.prototype.slice.call(arguments));
};
sandbox.window.__FINDLY_RECORD_LEAVE("map_miss");
if (!logs.length || String(logs[0][0]) !== "[findly-leave]") {
  fail("recordLeave should console.info in debug mode");
} else {
  ok("recordLeave logs in debug mode");
}
logs.length = 0;
sandbox.window.location.search = "";
sandbox.window.__FINDLY_RECORD_LEAVE("map_miss");
if (logs.length) {
  fail("recordLeave must be silent without findly_debug=1");
} else {
  ok("recordLeave silent without debug flag");
}

/* Nested-facet path with companion present AND missing (fallback). */
function runNestedFacetVm(withCompanion) {
  const product = {
    style: { display: "block" },
    hidden: false,
  };
  const logs = [];
  const ctx = {
    window: {
      location: { search: "?findly_debug=1" },
      __FINDLY_FACET_UTILS: undefined,
      __FINDLY_FILTER_WIDGET: {
        facets: [{ key: "vendor", values: [{ value: "A" }] }],
        renderFacets: function () {
          ctx.window.__rendered = true;
        },
      },
    },
    document: {
      readyState: "complete",
      addEventListener: function () {},
      querySelector: function (sel) {
        return String(sel).indexOf("product") >= 0 ? product : null;
      },
    },
    console: {
      info: function () {
        logs.push(Array.prototype.slice.call(arguments));
      },
      error: function () {},
    },
    setTimeout: function (fn) {
      try {
        fn();
      } catch (err) {
        ctx.__thrown = err;
      }
      return 0;
    },
    Error: Error,
    TypeError: TypeError,
    SyntaxError: SyntaxError,
    String: String,
    Boolean: Boolean,
    Array: Array,
    Math: Math,
    Date: Date,
    Object: Object,
    Number: Number,
    Promise: Promise,
    RegExp: RegExp,
  };
  vm.createContext(ctx);
  if (withCompanion) {
    vm.runInContext(facetsJs, ctx);
  }
  vm.runInContext(fetchJs, ctx);
  const api = ctx.window.__FINDLY_ENSURE_FACET_UTILS();
  const pathVals = [
    { label: "Men > Shoes > Boots", value: "boots", count: 2 },
    { label: "Men > Shoes > Sneakers", value: "sneakers", count: 1 },
  ];
  const nested = api.nestPathLabels(pathVals);
  const hasKids = api.valuesHaveChildren
    ? api.valuesHaveChildren(nested)
    : false;
  const chip = api.chipDisplayLabel([], "k", "gid://shopify/Product/1");
  const css = api.looksLikeCssColor("#abc");
  return {
    fallback: !!(api && api.__findlyFallback),
    nested: nested,
    hasKids: hasKids,
    chip: chip,
    css: css,
    productDisplay: product.style.display,
    productHidden: product.hidden,
    thrown: ctx.__thrown,
    logs: logs,
  };
}

{
  try {
    const present = runNestedFacetVm(true);
    if (present.thrown) {
      fail("companion-present nested path threw: " + present.thrown);
    } else if (present.fallback) {
      fail("companion present must not leave FACET_FALLBACK active");
    } else if (!Array.isArray(present.nested) || !present.nested.length) {
      fail("companion nestPathLabels returned empty");
    } else if (!present.hasKids) {
      fail("valuesHaveChildren must detect nested path roots when companion present");
    } else if (present.productDisplay !== "block" || present.productHidden) {
      fail("products must stay visible with companion present");
    } else {
      ok("nested-facet VM path works with facets companion present");
    }
  } catch (err) {
    fail("companion-present nested VM threw: " + err);
  }

  try {
    const miss = runNestedFacetVm(false);
    if (miss.thrown) {
      fail("missing-companion nested path threw: " + miss.thrown);
    } else if (!miss.fallback) {
      fail("missing companion must install FACET_FALLBACK");
    } else if (miss.productDisplay !== "block" || miss.productHidden) {
      fail("products must remain visible when facets companion is missing");
    } else if (!Array.isArray(miss.nested) || miss.chip !== "" || miss.css !== true) {
      fail("fallback helpers returned unexpected values: " + JSON.stringify(miss));
    } else if (typeof miss.hasKids !== "boolean") {
      fail("fallback must expose valuesHaveChildren");
    } else if (
      !miss.logs.some(function (row) {
        return row[0] === "[findly-ext]" && row[1] === "facets-missing";
      })
    ) {
      fail("missing companion should log [findly-ext] facets-missing in debug mode");
    } else {
      ok("missing facets companion: no throw, fallback active, products visible");
    }
  } catch (err) {
    fail("missing-companion nested VM threw: " + err);
  }
}

if (!process.exitCode) {
  console.log("STEP_STOREFRONT_RESILIENCE_OK");
}
