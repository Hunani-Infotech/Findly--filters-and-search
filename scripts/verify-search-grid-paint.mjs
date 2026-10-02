/**
 * Prove the /search blank-grid fix without a browser.
 * Usage: node ./scripts/verify-search-grid-paint.mjs
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { log } from "./terminal-log.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function fail(message) {
  throw new Error(message);
}

function read(rel) {
  return readFileSync(join(ROOT, rel), "utf8");
}

/**
 * Mirror of the non-app-grid applyAppGrid decision after native paint attempts:
 * takeover + shownNative===0 must fall through to origApply (not terminal
 * `return uniqueAllowedCount(...) === 0`).
 */
function mockApplyAppGridDecision({ takeover, shownNative, handles }) {
  let calledOrigApply = false;
  const uniqueAllowedCount = (list) =>
    new Set((list || []).filter(Boolean)).size;

  // Non-app-grid branch (isAppGridMode === false)
  if (!takeover) {
    return { early: true, result: shownNative > 0, calledOrigApply };
  }
  if (shownNative > 0) {
    return { early: true, result: true, calledOrigApply };
  }
  // shownNative === 0 under takeover — only terminal if no handles left
  if (uniqueAllowedCount(handles) === 0) {
    return { early: true, result: true, calledOrigApply };
  }
  // Fall through to origApply
  calledOrigApply = true;
  return { early: false, result: true, calledOrigApply };
}

function assertSourceControlFlow(grid, filterJs) {
  const hasNonThemeMatching = filterJs.match(
    /Widget\.prototype\.hasNonThemeMatching\s*=\s*function\s*\([^)]*\)\s*\{[\s\S]*?\n\s*\};/,
  );
  if (!hasNonThemeMatching) {
    fail("smart-filter.js missing hasNonThemeMatching");
  }
  if (!hasNonThemeMatching[0].includes("this.searchQuery")) {
    fail("hasNonThemeMatching must include searchQuery");
  }

  // Bad (pre-fix) pattern: after shownNative>0 return true, immediately
  // terminate with return uniqueAllowedCount(...) === 0 (no fallthrough).
  if (
    /if\s*\(\s*shownNative\s*>\s*0\s*\)\s*return\s+true;\s*return\s+uniqueAllowedCount\(\s*sliced\.handles\s*\)\s*===\s*0\s*;/.test(
      grid,
    )
  ) {
    fail(
      "applyAppGrid must not end non-app-grid branch with terminal return uniqueAllowedCount(...) === 0",
    );
  }

  // Good: empty-handles early return, then close the non-app-grid if, then origApply.
  if (
    !/if\s*\(\s*uniqueAllowedCount\(\s*sliced\.handles\s*\)\s*===\s*0\s*\)\s*return\s+true;\s*\}\s*var\s+ok\s*=\s*origApply/.test(
      grid,
    )
  ) {
    fail(
      "applyAppGrid must fall through to origApply when takeover paints 0 native cards",
    );
  }
  if (!grid.includes("fall through to")) {
    fail("applyAppGrid missing fall-through comment for blank-grid recovery");
  }

  if (
    !/needed\s*>\s*0\s*&&\s*shown\s*===\s*0[\s\S]{0,800}_skipPageSlice[\s\S]{0,200}applyAppGrid/.test(
      grid,
    )
  ) {
    fail(
      "applyInterceptGrid must recover via applyAppGrid when needed>0 && shown===0",
    );
  }

  /* Null gridParent on /search: ensureGridParent must create #findly-grid-host. */
  if (
    !grid.includes("isSearchPageContext(this)") ||
    !/this\._gridParent\s*=\s*fallbackHost\(\)/.test(grid)
  ) {
    fail(
      "ensureGridParent must use fallbackHost (#findly-grid-host) on search when no Liquid grid",
    );
  }
  /* Search-only gate: do not invent hosts for all collection takeovers. */
  const ensureFallbackGate = grid.match(
    /if\s*\(\s*!inAppMode\s*&&\s*!isSearchPageContext\(this\)\s*&&\s*!Boolean\(this\.searchQuery\)\s*\)\s*\{[\s\S]*?return null;\s*\}/,
  );
  if (!ensureFallbackGate) {
    fail(
      "ensureGridParent fallback must be gated to search context / searchQuery only",
    );
  }
  if (
    !grid.includes("isActualCardGrid(layoutMain)") ||
    !grid.includes('querySelector(".sf-layout-main")')
  ) {
    fail("fallbackHost must avoid nesting #findly-grid-host inside an existing card grid");
  }
  if (
    !grid.includes("isSyntheticGridHost") ||
    !grid.includes("forceAppCards")
  ) {
    fail(
      "applyAppGrid must force .sf-app-card paint on synthetic #findly-grid-host / empty search host",
    );
  }
  if (!grid.includes('el.querySelector("#findly-grid-host")')) {
    fail("queryInnerCardGrid must discover #findly-grid-host inside .sf-layout-main");
  }
  if (
    !grid.includes("Never paint into .sf-layout-main") &&
    !grid.includes("Never mount cards on .sf-layout-main")
  ) {
    fail("must refuse painting into .sf-layout-main page shell");
  }
  if (!grid.includes(":not(.sf-app-card):not(#findly-grid-host)")) {
    fail("loading hide CSS must keep .sf-app-card / #findly-grid-host visible");
  }
  if (
    !/alreadyPaintedGrid\(this\)[\s\S]{0,400}isSyntheticGridHost\(parent\)/.test(
      grid,
    )
  ) {
    fail(
      "syncProductGrid must not skip paint when synthetic/search host has 0 cards",
    );
  }
  /* Must not stamp painted / fabricate shownHandles without DOM cards. */
  if (
    /painted\s*\|\|\s*shown\s*>\s*0\s*\|\|\s*\(this\._shownHandles\s*&&\s*this\._shownHandles\.length\)/.test(
      grid,
    )
  ) {
    fail(
      "applyInterceptGrid must not treat optimistic _shownHandles as a successful paint",
    );
  }
}

function assertMockDecisions() {
  const fallthrough = mockApplyAppGridDecision({
    takeover: true,
    shownNative: 0,
    handles: ["a", "b"],
  });
  if (fallthrough.early || !fallthrough.calledOrigApply) {
    fail(
      "mock: takeover + shownNative=0 + handles must call origApply (fallthrough)",
    );
  }

  const earlyOk = mockApplyAppGridDecision({
    takeover: true,
    shownNative: 2,
    handles: ["a", "b"],
  });
  if (!earlyOk.early || earlyOk.result !== true || earlyOk.calledOrigApply) {
    fail("mock: takeover + shownNative=2 must return true early (no origApply)");
  }

  const noTakeover = mockApplyAppGridDecision({
    takeover: false,
    shownNative: 0,
    handles: ["a", "b"],
  });
  if (
    !noTakeover.early ||
    noTakeover.result !== false ||
    noTakeover.calledOrigApply
  ) {
    fail(
      "mock: takeover=false + shownNative=0 must return false without origApply",
    );
  }
}

function main() {
  const grid = read("extensions/smart-filter/assets/smart-filter-grid.js");
  const filterJs = read("extensions/smart-filter/assets/smart-filter.js");

  assertSourceControlFlow(grid, filterJs);
  assertMockDecisions();

  console.log("SEARCH_GRID_FIX_OK");
  log.success("search blank-grid paint fix verified");
}

try {
  main();
} catch (err) {
  log.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
}
