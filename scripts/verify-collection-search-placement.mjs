/**
 * Static + DOM-shape checks for collection search placement and facet scrollers.
 * Usage: node ./scripts/verify-collection-search-placement.mjs
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

function assertStatic() {
  const css = read("extensions/smart-filter/assets/smart-filter.css");
  const gridJs = read("extensions/smart-filter/assets/smart-filter-grid.js");
  const liquid = read("extensions/smart-filter/blocks/collection-filters.liquid");
  const embed = read(
    "extensions/smart-filter/blocks/collection-filters-embed.liquid",
  );
  const preview = read("app/components/widget-preview.tsx");

  if (!liquid.includes("data-collection-search-wrap")) {
    fail("collection-filters.liquid missing search wrap");
  }
  if (!embed.includes("data-collection-search-wrap")) {
    fail("collection-filters-embed.liquid missing search wrap");
  }
  if (!css.includes(".smart-filter > .smart-filter__collection-search")) {
    fail("search must be CSS-hidden while it still lives in the filter block");
  }
  if (!css.includes("sf-collection-search-host")) {
    fail("missing product-grid search host styles");
  }
  if (!css.includes(":has(> li:nth-child(6))")) {
    fail("long facet lists must scroll; short lists must not force a scrollbar");
  }
  if (
    /max-height:\s*260px[\s\S]{0,80}overflow-y:\s*auto/.test(css) &&
    !css.includes(".smart-filter__facet > .smart-filter__options:has(> li:nth-child(6))")
  ) {
    fail("260px scroller must only apply to long option lists");
  }
  if (!gridJs.includes("placeCollectionSearchOnGrid")) {
    fail("grid companion missing placeCollectionSearchOnGrid");
  }
  if (!gridJs.includes("isLayoutShell")) {
    fail("placement must ignore layout/sidebar shells as the product grid");
  }
  if (!gridJs.includes(".smart-filter>.smart-filter__collection-search{display:none!important}")) {
    fail("injected grid CSS must also hide in-sidebar search");
  }
  if (!preview.includes("MiniProductGrid showSearch")) {
    fail("admin preview must put collection search on the product column");
  }
  if (
    /function FilterWidget[\s\S]*enableCollectionSearch \? \(/.test(preview)
  ) {
    fail("admin preview must not render collection search inside the filter widget");
  }
}

function assertPlacementShape() {
  const gridJs = read("extensions/smart-filter/assets/smart-filter-grid.js");
  const start = gridJs.indexOf("function collectionSearchGridEl");
  const end = gridJs.indexOf("function patchWidget", start);
  if (start < 0 || end < 0) fail("could not extract collection search placement");
  const fn = gridJs.slice(start, end);
  if (!fn.includes("#product-grid") || !fn.includes("ul.product-grid")) {
    fail("placement must prefer the real product grid, not the layout column");
  }
  if (!fn.includes("insertBefore(host, before)")) {
    fail("search host must be inserted immediately before the product grid");
  }
  if (fn.includes("insertBefore(host, main")) {
    fail("must not insert the search host as a sibling of the main column");
  }
  if (!fn.includes("isLayoutShell")) {
    fail("placement must ignore layout/sidebar shells as the product grid");
  }
}

assertStatic();
assertPlacementShape();
log.info("collection search placement + facet scroller checks passed");
console.log("STEP_COLLECTION_SEARCH_PLACEMENT_OK");
