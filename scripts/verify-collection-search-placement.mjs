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
  if (!css.includes(".smart-filter > .smart-filter__search")) {
    fail("search must be CSS-hidden while it still lives in the filter block");
  }
  if (!css.includes("sf-search-host")) {
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
  if (!gridJs.includes(".smart-filter>.smart-filter__search{display:none!important}")) {
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
  if (!fn.includes("sf-toolbar") || !fn.includes("sf-total-count")) {
    fail("listing toolbar must include search, sort, and total count");
  }
  if (fn.includes("insertBefore(host, main")) {
    fail("must not insert the search host as a sibling of the main column");
  }
  if (!fn.includes("findColumnMainContaining")) {
    fail("toolbar must anchor to a dedicated column main, not the product grid");
  }
  if (!fn.includes("isFindlyLayoutChrome")) {
    fail("placement must ignore Findly layout chrome as the product grid");
  }
}

function assertThemeContainerFit() {
  const gridJs = read("extensions/smart-filter/assets/smart-filter-grid.js");
  if (!gridJs.includes("constrainHostToThemeContainer")) {
    fail("layout host must be constrained to the theme page-width container");
  }
  if (!gridJs.includes("fitLayoutIntoThemeContainer")) {
    fail("layout must be moved inside the theme container when it wraps outside");
  }
  if (!gridJs.includes(".page-width")) {
    fail("theme container detection must include .page-width");
  }
  if (!gridJs.includes("liftLayoutOutOfProductGrid")) {
    fail("layout must be lifted out of the product CSS grid");
  }
  if (!gridJs.includes("function isProductGridLike")) {
    fail("theme page-width detection must not treat the product grid as the container");
  }
  if (!gridJs.includes("flex-wrap:wrap!important")) {
    fail("filter+grid row must wrap pager/title instead of squeezing them into extra columns");
  }
  if (
    /sf-collection-layout--left,.sf-collection-layout--right\{[^}]*flex-wrap:nowrap/.test(
      gridJs.replace(/\s+/g, ""),
    )
  ) {
    fail("left/right collection layout must not use flex-wrap:nowrap");
  }
  if (!gridJs.includes("closestCollectionWrapper")) {
    fail("layout host must wrap Horizon collection-wrapper, not the inner product grid");
  }
  if (!gridJs.includes("flattenHorizonCollectionWrapper")) {
    fail("Horizon collection-wrapper must be flattened so products are not trapped in one grid track");
  }
  if (!gridJs.includes("data-sf-layout-stable")) {
    fail("layout repair must stop after the first stable pass");
  }
  if (!gridJs.includes("_findlyObserverCount > 8")) {
    fail("grid MutationObserver must disconnect after a few passes to avoid hanging the tab");
  }
  if (!gridJs.includes("repairingLayout")) {
    fail("layout repair must be re-entrant so wrap/unwrap cannot hang the tab");
  }
  if (!gridJs.includes("existing.contains(host)")) {
    fail("wrapHostWithLayout must not re-wrap a host already inside the collection layout");
  }
  if (
    !/function isLayoutUnsafeHost[\s\S]{0,280}contains\("sf-collection-layout"\)[\s\S]{0,40}return false/.test(
      gridJs,
    )
  ) {
    fail("Findly layout shells must not be treated as unsafe theme grids");
  }
  if (!gridJs.includes("alreadyPlaced")) {
    fail("placeMountOnExistingLayout must skip lift when the mount is already placed");
  }
  if ((gridJs.match(/var origPlaceSort/g) || []).length !== 1) {
    fail(
      "placeSortOnGrid must be wrapped once; duplicate var origPlaceSort self-recurses",
    );
  }
  if (!gridJs.includes("this._placingSort")) {
    fail("placeSortOnGrid must guard against re-entrant wraps");
  }
  if (!gridJs.includes("armFilterReadyFailsafe")) {
    fail("filter loading CSS must not hide products forever if layout init stalls");
  }
  if (!gridJs.includes("grid-template-columns:280px minmax(0,1fr)")) {
    fail("left collection layout must use a 280px + remaining-width CSS grid");
  }
  if (!gridJs.includes("--grid-column--desktop:minmax(0,1fr)")) {
    fail("Horizon --grid-column--desktop must be a single minmax track, not 250px 1fr");
  }
  const themeJs = read("extensions/smart-filter/assets/smart-filter-theme.js");
  if (
    /sf-collection-layout--left,.sf-collection-layout--right\{[^}]*display:flex!important/.test(
      themeJs.replace(/\s+/g, ""),
    )
  ) {
    fail("theme compat CSS must not force flex on left/right collection layout");
  }
  const css = read("extensions/smart-filter/assets/smart-filter.css");
  if (!css.includes(".collection-wrapper > .sf-collection-layout")) {
    fail("Horizon collection-wrapper must span Findly layout across all grid columns");
  }
  if (!css.includes(".page-width > .sf-collection-layout")) {
    fail("collection layout must fill the theme page-width, not sit outside it");
  }
}

assertStatic();
assertPlacementShape();
assertThemeContainerFit();
log.info("collection search placement + facet scroller checks passed");
console.log("STEP_COLLECTION_SEARCH_PLACEMENT_OK");
