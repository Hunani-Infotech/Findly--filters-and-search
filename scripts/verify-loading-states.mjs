/**
 * Functional loading-state checks for storefront widgets.
 * Usage: node ./scripts/verify-loading-states.mjs
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { log } from "./terminal-log.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function fail(message) {
  throw new Error(message);
}

function read(rel) {
  return readFileSync(join(ROOT, rel), "utf8");
}

function assertSourceMarkers() {
  const grid = read("extensions/smart-filter/assets/smart-filter-grid.js");
  const css = read("extensions/smart-filter/assets/smart-filter.css");
  const filterJs = read("extensions/smart-filter/assets/smart-filter.js");
  const searchJs = read("extensions/smart-filter/assets/smart-filter-search.js");
  const searchCss = read("extensions/smart-filter/assets/smart-filter-search.css");
  const instantJs = read("extensions/smart-filter/assets/instant-search.js");
  const instantCss = read("extensions/smart-filter/assets/instant-search.css");
  const recsJs = read("extensions/smart-filter/assets/product-recommendations.js");
  const recsCss = read("extensions/smart-filter/assets/product-recommendations.css");
  const ymmJs = read("extensions/smart-filter/assets/vehicle-finder.js");
  const ymmCss = read("extensions/smart-filter/assets/vehicle-finder.css");
  const pagerJs = read("extensions/smart-filter/assets/smart-filter-pager.js");
  const block = read("extensions/smart-filter/blocks/collection-filters.liquid");
  const embed = read("extensions/smart-filter/blocks/collection-filters-embed.liquid");
  const minGrid = read("extensions/smart-filter/assets/smart-filter-grid.min.js");

  if (!grid.includes("bootEarlyGridBusy") || !grid.includes("paintGridBusy")) {
    fail("grid missing early/busy painters");
  }
  if (!grid.includes("skeletonMountHost") || !grid.includes("matchesBusyHost")) {
    fail("grid must mount skeletons on the CSS-targeted product host");
  }
  if (grid.includes("if (widget && widget._reqId > 0) return")) {
    fail("bootEarlyGridBusy must not skip skeleton paint when a fetch is in flight");
  }
  if (!grid.includes("setFilterLoading") || !grid.includes("sf-filter-ready")) {
    fail("grid missing filter ready/loading flags");
  }
  if (!grid.includes("syncToolbarLoading") || !grid.includes("data-sf-toolbar-loading")) {
    fail("grid missing toolbar loading sync for search/sort/count");
  }
  if (grid.includes("setControlBusy(search, on)") || grid.includes("setControlBusy(select, on)")) {
    fail("search and sort must stay enabled while the product grid loads");
  }
  if (/html\.sf-filter-loading\s+\.sf-search-input[\s\S]{0,120}visibility:\s*hidden/.test(css)) {
    fail("search input must stay visible while the product grid loads");
  }
  if (/html\.sf-filter-loading\s+\.sf-sort-btn-value[\s\S]{0,80}visibility:\s*hidden/.test(css)) {
    fail("sort value must stay visible while the product grid loads");
  }
  if (!css.includes("html.sf-filter-loading .sf-total-count::after")) {
    fail("smart-filter.css must skeleton total count while loading");
  }
  if (!grid.includes("sf-sort-btn") || !css.includes(".sf-sort-btn") || !grid.includes("ensureSortButton(wrap, select)")) {
    fail("sort dropdown must mount a custom desktop trigger instead of hiding the native select");
  }
  if (!grid.includes("findly-grid-is-busy>") || !css.includes("findly-grid-is-busy")) {
    fail("busy grid must hide product children while loading");
  }
  if (!css.includes("html.sf-filter-loading") || !css.includes("display: none !important")) {
    fail("smart-filter.css must hide product results while loading");
  }
  if (!css.includes(".product-count") || !css.includes("visibility: hidden")) {
    fail("smart-filter.css must hide product counts while the grid is loading");
  }
  const checkCss = read("extensions/smart-filter/assets/smart-filter-check.css");
  if (!checkCss.includes("sf-filter-ready") || !checkCss.includes("sf-filter-loading")) {
    fail("smart-filter-check.css must define sf-filter-ready and sf-filter-loading");
  }
  if (/html\.sf-filter-loading\s+\.sf-search-input[\s\S]{0,120}visibility:\s*hidden/.test(checkCss)) {
    fail("smart-filter-check.css must not hide search while the product grid loads");
  }
  if (/html\.sf-filter-loading\s+\.sf-sort-btn-value[\s\S]{0,80}visibility:\s*hidden/.test(checkCss)) {
    fail("smart-filter-check.css must not hide sort while the product grid loads");
  }
  if (!grid.includes("data-findly-skel") || !grid.includes("findly-grid-skel-img")) {
    fail("grid missing skeleton markup");
  }
  if (!grid.includes('hostTag === "ul" || hostTag === "ol" ? "LI" : "DIV"')) {
    fail("grid skeletons must use DIV/LI, not theme custom elements");
  }
  if (!css.includes("findly-grid-skel-img") || !css.includes("findly-grid-busy-overlay")) {
    fail("smart-filter.css missing grid loading styles");
  }
  if (!filterJs.includes("if (!self._importingCards)") || !filterJs.includes("self.setGridBusy(false)")) {
    fail("fetchFilters must keep the grid busy while cards import");
  }
  if (!searchJs.includes("renderSearchSkeletons") || !searchCss.includes("sf-search-skel-img")) {
    fail("search skeletons missing");
  }
  if (!instantJs.includes("showLoadingPanel") || !instantCss.includes("findly-instant-skel-card")) {
    fail("instant-search skeletons missing");
  }
  if (!recsJs.includes("renderSkeletons") || !recsCss.includes("sf-recs-skel-img")) {
    fail("recommendations skeletons missing");
  }
  if (!ymmJs.includes("renderSkeletons") || !ymmCss.includes("sf-ymm-skel-img")) {
    fail("vehicle-finder skeletons missing");
  }
  if (!pagerJs.includes("_keepThemeCards = false")) {
    fail("unfiltered pager clicks must take over the grid instead of a full page reload");
  }
  if (pagerJs.includes("Only hijack while filters/search/sort are active")) {
    fail("pager must intercept pagination even when no filters are selected");
  }
  if (!pagerJs.includes("syncThemePager") || !pagerJs.includes("usesThemeNumberedPager")) {
    fail("pager must reuse the theme numbered pagination");
  }
  if (!pagerJs.includes("_loadingPage") || !pagerJs.includes("goToPage")) {
    fail("pager loading / goToPage missing");
  }
  if (!pagerJs.includes("data-sf-pager-suppressed")) {
    fail("pager must suppress the theme pager when filtered results fit on one page");
  }
  if (!pagerJs.includes("sf-pager-unneeded") || !pagerJs.includes("resultsFitOnePage")) {
    fail("pager must hide theme pagination when filtered results fit on one page");
  }
  if (pagerJs.includes("Math.max.apply(null, candidates)")) {
    fail("filteredTotal must not max leftover unfiltered counts with the latest payload");
  }
  if (!pagerJs.includes("Latest filter payload wins")) {
    fail("filteredTotal must prefer the latest filter payload over stale status counts");
  }
  if (!pagerJs.includes("__findlyThemePagerDirty")) {
    fail("pager must replay theme pager sync after the loading lock");
  }
  if (!grid.includes("prevSet.call(window, next)")) {
    fail("grid must chain __FINDLY_FILTER_WIDGET setter so the pager can patch");
  }
  if (!css.includes("data-sf-single-page")) {
    fail("smart-filter.css must hide theme pagination when results fit on one page");
  }
  if (!css.includes("html.sf-few-results nav.pagination") || !pagerJs.includes("sf-few-results")) {
    fail("few-results class must hide theme pagination outside the collection layout");
  }
  if (!pagerJs.includes("else unhideThemePagers()")) {
    fail("pager must unhide theme pagination when filtered results span multiple pages");
  }
  if (
    pagerJs.includes("[FindlyPager]") ||
    pagerJs.includes("__FINDLY_PAGER_DUMP") ||
    pagerJs.includes("pagerLog(") ||
    grid.includes("[FindlyPager]")
  ) {
    fail("pager debug logs must not ship in storefront assets");
  }
  if (!pagerJs.includes("forceSimplePager") || !pagerJs.includes("data-sf-pager-driven")) {
    fail("pager must rewrite theme page numbers from the filtered total");
  }
  if (!pagerJs.includes("PAGER_CHROME_SKIP")) {
    fail("pager must skip header/footer pagers");
  }
  if (
    !pagerJs.includes("#AjaxinatePagination") ||
    !pagerJs.includes(".paginate") ||
    !pagerJs.includes(".Pagination")
  ) {
    fail("pager must match Ajaxinate, Debut .paginate, and Impulse .Pagination");
  }
  if (pagerJs.includes("#ResultsList .product-grid")) {
    fail("pager rewrite must use generic product-grid selectors, not Horizon-only");
  }
  if (
    !css.includes(":has(.smart-filter)") ||
    !css.includes(".paginate") ||
    !css.includes(".Pagination")
  ) {
    fail("smart-filter.css SHOW/hide pager area must cover generic theme pagers");
  }
  if (css.includes("#ResultsList nav.pagination")) {
    fail("css must not require Horizon hosts for showing pagers");
  }
  if (grid.includes('el.id = "findly-sf-pager"')) {
    fail("grid must not mount a Findly numbered pager");
  }
  const themeJs = read("extensions/smart-filter/assets/smart-filter-theme.js");
  if (themeJs.includes("html.sf-og nav.pagination")) {
    fail("theme compat must keep theme pagination visible unless load more / infinite");
  }
  if (!themeJs.includes("findly-theme-compat-v10")) {
    fail("theme compat STYLE bump must be findly-theme-compat-v10");
  }
  if (!themeJs.includes("#AjaxinatePagination:not([hidden]):not([data-sf-pager-suppressed='1'])")) {
    fail("theme compat SHOW CSS must include Ajaxinate pagination");
  }
  if (!checkCss.includes("#AjaxinatePagination:not([hidden]):not([data-sf-pager-suppressed=\"1\"])")) {
    fail("smart-filter-check.css SHOW CSS must include Ajaxinate pagination");
  }
  if (!filterJs.includes(".Pagination") || !filterJs.includes("#AjaxinatePagination")) {
    fail("smart-filter.js THEME_PAGER_SELECTOR must cover Prestige and Ajaxinate");
  }
  if (
    !pagerJs.includes("clearCustomPagerClass") ||
    !pagerJs.includes("usesThemeNumberedPager") ||
    !pagerJs.includes("suppressThemePagers()")
  ) {
    fail("pager must clear sf-custom-pager and suppress theme numbered pagination when needed");
  }
  if (!pagerJs.includes("__findlyThemePagerIgnoreMutations")) {
    fail("pager must ignore MutationObserver while rewriting theme pagers");
  }
  if (!pagerJs.includes("var roots = findThemePagers()")) {
    fail("suppress/unhide must use findThemePagers so footer decoys are left alone");
  }
  if (!grid.includes("findly-theme-bridge-v12")) {
    fail("grid theme bridge must be findly-theme-bridge-v12");
  }
  if (!grid.includes("THEME_PAGER_SEL_GRID") || !grid.includes("#AjaxinatePagination")) {
    fail("THEME_PAGER_SEL_GRID must include Ajaxinate pagination");
  }
  if (!block.includes("smart-filter-boot.min.js") || !embed.includes("smart-filter-boot.min.js")) {
    fail("both collection blocks must load the first-paint boot script");
  }
  if (
    !block.includes(`src="{{ 'smart-filter-boot.min.js' | asset_url }}" defer`) ||
    !embed.includes(`src="{{ 'smart-filter-boot.min.js' | asset_url }}" defer`)
  ) {
    fail("boot script must use defer so Theme Check ParserBlockingScript passes");
  }
  if (
    !block.includes('classList.add("sf-filter-ready")') ||
    !embed.includes('classList.add("sf-filter-ready")')
  ) {
    fail("collection blocks must mark sf-filter-ready inline (LCP-safe, products visible)");
  }
  if (
    block.includes('classList.add("sf-filter-loading")') ||
    embed.includes('classList.add("sf-filter-loading")')
  ) {
    fail("collection blocks must not set sf-filter-loading on first paint (hides LCP images)");
  }
  if (block.includes('rel="preload"') || embed.includes('rel="preload"')) {
    fail("collection blocks must not preload /apps/smart-filter/filters (competes with LCP)");
  }
  if (!block.includes("sf-layout-stub") || !embed.includes("sf-layout-stub")) {
    fail("filter roots must use sf-layout-stub for CLS-safe reserved space");
  }
  if (!block.includes("smart-filter-grid.min.js") || !embed.includes("smart-filter-grid.min.js")) {
    fail("both collection blocks must load the grid companion");
  }
  const boot = read("extensions/smart-filter/assets/smart-filter-boot.js");
  if (boot.includes("findly-grid-skel-img") || boot.includes("mountSkeletons")) {
    fail("boot script must not mount grid skeletons on first paint (LCP-safe stub only)");
  }
  if (!boot.includes("sf-filter-ready") || !boot.includes("__findlyGridBoot")) {
    fail("boot script must mark sf-filter-ready without hiding products");
  }
  if (!filterJs.includes("scheduleBoot") || !filterJs.includes("requestIdleCallback")) {
    fail("smart-filter.js must idle-defer Widget boot (requestIdleCallback)");
  }
  if (!filterJs.includes("_deferGridBusy")) {
    fail("smart-filter.js must skip setGridBusy on first fetch when hash has no filters");
  }
  if (!checkCss.includes("findly-grid-skel-img") || !checkCss.includes("products-count-wrapper")) {
    fail("smart-filter-check.css must paint grid skeletons and hide Horizon product counts");
  }
  if (!checkCss.includes("findly-grid-busy-overlay") || !checkCss.includes("sf-grid-spin")) {
    fail("smart-filter-check.css must style the centered first-paint overlay");
  }
  if (!checkCss.includes("html.sf-filter-loading nav.pagination")) {
    fail("smart-filter-check.css must hide theme pagination while loading");
  }
  if (!css.includes("html.sf-filter-loading nav.pagination")) {
    fail("smart-filter.css must hide theme pagination while loading");
  }
  if (!css.includes("products-count-wrapper")) {
    fail("smart-filter.css must hide Horizon .products-count-wrapper while loading");
  }
  if (!css.includes("sf-layout-stub") || !css.includes("min-height: 11.5rem")) {
    fail("smart-filter.css must reserve facet stub height for CLS");
  }
  if (/\bcrossorigin\b/.test(block) || /\bcrossorigin\b/.test(embed)) {
    fail("filter assets must not use crossorigin on same-origin fetches");
  }
  if (!filterJs.includes("failFilterLoad") || !filterJs.includes("FILTER_FETCH_MS")) {
    fail("fetchFilters must time out and clear the facet skeleton on error");
  }
  if (!filterJs.includes("this._statusProductCount = this._pageTotal")) {
    fail("readPagingMeta must align status count with the latest filtered total");
  }
  if (!minGrid.includes("data-findly-skel") || !minGrid.includes("findly-grid-takeover-v34")) {
    fail("smart-filter-grid.min.js is stale; run npm run theme:minify");
  }
  const minBoot = read("extensions/smart-filter/assets/smart-filter-boot.min.js");
  if (minBoot.includes("findly-grid-skel-img") || minBoot.includes("findly-grid-busy-overlay")) {
    fail("smart-filter-boot.min.js is stale; run npm run theme:minify (LCP-safe boot)");
  }
  if (!minBoot.includes("sf-filter-ready")) {
    fail("smart-filter-boot.min.js must set sf-filter-ready");
  }
  if (!/#findly-grid-busy-overlay[\s\S]{0,220}pointer-events:\s*auto/.test(css)) {
    fail("smart-filter.css overlay must capture clicks while loading");
  }
  if (!grid.includes("pointer-events:auto")) {
    fail("grid busy overlay must capture clicks while loading");
  }
  log.info("source markers for all loading surfaces present");
}

function chromePath() {
  const candidates = [
    "C:\\\\Program Files\\\\Google\\\\Chrome\\\\Application\\\\chrome.exe",
    "C:\\\\Program Files (x86)\\\\Microsoft\\\\Edge\\\\Application\\\\msedge.exe",
    join(process.env.ProgramFiles || "", "Google/Chrome/Application/chrome.exe"),
    join(process.env["ProgramFiles(x86)"] || "", "Microsoft/Edge/Application/msedge.exe"),
    join(process.env.LOCALAPPDATA || "", "Google/Chrome/Application/chrome.exe"),
  ];
  for (const p of candidates) {
    if (p && existsSync(p)) return p;
  }
  return null;
}

function writeHarness() {
  const dir = mkdtempSync(join(tmpdir(), "findly-load-"));
  const bootUrl = pathToFileURL(
    join(ROOT, "extensions/smart-filter/assets/smart-filter-boot.js"),
  ).href;
  const gridUrl = pathToFileURL(
    join(ROOT, "extensions/smart-filter/assets/smart-filter-grid.js"),
  ).href;
  const searchUrl = pathToFileURL(
    join(ROOT, "extensions/smart-filter/assets/smart-filter-search.js"),
  ).href;
  const instantUrl = pathToFileURL(
    join(ROOT, "extensions/smart-filter/assets/instant-search.js"),
  ).href;
  const recsUrl = pathToFileURL(
    join(ROOT, "extensions/smart-filter/assets/product-recommendations.js"),
  ).href;
  const ymmUrl = pathToFileURL(
    join(ROOT, "extensions/smart-filter/assets/vehicle-finder.js"),
  ).href;
  const html = `<!doctype html>
<html>
<body>
  <div id="smart-filter-root" class="smart-filter">
    <div class="sf-facets" data-facets>
      <div class="sf-skeleton" data-skeleton></div>
    </div>
  </div>
  <p class="product-count">163 products</p>
  <div class="products-count-wrapper" data-testid="products-count">163 products</div>
  <div class="sf-toolbar">
    <div class="sf-search-host sf-toolbar-search">
      <div class="sf-search" data-collection-search-wrap>
        <div class="sf-search-field">
          <input data-collection-search class="sf-search-input" placeholder="Search products" />
        </div>
      </div>
    </div>
    <div class="sf-toolbar-end">
      <div class="sf-sort-host">
        <div data-sort-wrap class="sf-sort">
          <label class="sf-sort-label">Sort by</label>
          <div class="sf-sort-control">
            <select data-sort class="sf-sort-select"><option>Featured</option></select>
          </div>
        </div>
      </div>
      <div class="sf-total-count">163 products</div>
    </div>
  </div>
  <results-list>
    <div class="main-collection-grid" id="product-grid">
      <ul class="product-grid">
        <article class="product-card" data-product-handle="stale-item">
          <a href="/products/stale-item">Stale product</a>
        </article>
      </ul>
    </div>
  </results-list>
  <nav class="pagination" aria-label="Pagination"><a href="#">1</a><a href="#">2</a></nav>
  <div class="smart-filter-search">
    <div data-status></div>
    <ul data-results></ul>
  </div>
  <div class="findly-instant" hidden></div>
  <div class="smart-filter-recs">
    <div data-recs-status></div>
    <ul data-recs-results></ul>
  </div>
  <div class="smart-filter-ymm" data-proxy-base="/apps/smart-filter">
    <div data-ymm-status></div>
    <ul data-ymm-results></ul>
  </div>
  <script src="${bootUrl}"></script>
  <script src="${gridUrl}"></script>
  <script src="${searchUrl}"></script>
  <script src="${instantUrl}"></script>
  <script src="${recsUrl}"></script>
  <script src="${ymmUrl}"></script>
  <script>
    function report(ok, extra) {
      document.documentElement.setAttribute("data-load-ok", ok ? "1" : "0");
      document.documentElement.setAttribute("data-load-json", JSON.stringify(extra || {}));
    }
    window.addEventListener("load", function () {
      try {
        var bootSkel = document.querySelectorAll("[data-findly-skel='1']").length;
        if (bootSkel > 0) throw new Error("LCP-safe boot must not mount grid skeletons: " + bootSkel);
        if (document.documentElement.classList.contains("sf-filter-loading")) {
          throw new Error("LCP-safe boot must not set sf-filter-loading");
        }
        if (!document.documentElement.classList.contains("sf-filter-ready")) {
          throw new Error("boot missing sf-filter-ready");
        }
        if (document.getElementById("findly-grid-busy-overlay")) {
          throw new Error("LCP-safe boot must not mount busy overlay");
        }
        var grid = document.querySelector(".main-collection-grid");
        var staleCard = document.querySelector("[data-product-handle='stale-item']");
        if (!staleCard) throw new Error("fixture product missing");
        if (window.getComputedStyle(staleCard).display === "none") {
          throw new Error("Liquid product must stay visible before interactive load");
        }
        var widget = {
          _gridParent: grid,
          ensureGridParent: function () { return grid; }
        };
        window.__FINDLY_FILTER_WIDGET = widget;
        widget._reqId = 3;
        if (typeof widget.setGridBusy !== "function") {
          throw new Error("grid companion did not patch setGridBusy onto widget");
        }
        widget.setGridBusy(true);
        var skel = document.querySelectorAll("[data-findly-skel='1']");
        var overlay = document.getElementById("findly-grid-busy-overlay");
        var skelHost = skel[0] && skel[0].parentElement;
        if (!skelHost || skelHost.id !== "product-grid") {
          throw new Error("skeletons must mount on #product-grid, got " + (skelHost && (skelHost.id || skelHost.className)));
        }
        var searchList = document.querySelector("[data-results]");
        if (searchList && !searchList.children.length) {
          for (var i = 0; i < 5; i++) {
            var li = document.createElement("li");
            li.className = "sf-search-item is-skeleton";
            li.innerHTML = '<span class="sf-search-skel-img"></span>';
            searchList.appendChild(li);
          }
        }
        var recs = document.querySelector("[data-recs-results]");
        var ymm = document.querySelector("[data-ymm-results]");
        if (skel.length < 4) throw new Error("grid skeletons missing: " + skel.length);
        if (!overlay) throw new Error("busy overlay missing");
        if (skel[0] && skel[0].tagName === "PRODUCT-CARD") throw new Error("used product-card custom element");
        var skelDisplay = skel[0] && window.getComputedStyle(skel[0]).display;
        if (skelDisplay === "none") throw new Error("grid skeletons hidden while loading");
        function isHidden(el) {
          while (el && el !== document.documentElement) {
            var cs = window.getComputedStyle(el);
            if (cs.display === "none" || cs.visibility === "hidden") return true;
            el = el.parentElement;
          }
          return false;
        }
        staleCard = document.querySelector("[data-product-handle='stale-item']");
        var staleDisplay = staleCard && window.getComputedStyle(staleCard).display;
        if (!isHidden(staleCard)) throw new Error("stale product visible while loading: " + staleDisplay);
        var countEl = document.querySelector(".product-count");
        var countVis = countEl && window.getComputedStyle(countEl).visibility;
        if (countVis !== "hidden") throw new Error("product count visible while loading: " + countVis);
        var searchEl = document.querySelector("[data-collection-search]");
        var sortEl = document.querySelector(".sf-sort-select");
        var findlyCount = document.querySelector(".sf-total-count");
        if (searchEl) searchEl.value = "blue shirt";
        if (!searchEl) throw new Error("search input missing");
        if (searchEl.disabled) throw new Error("search input disabled while loading");
        if (searchEl.getAttribute("aria-busy") === "true") throw new Error("search should not be aria-busy while grid loads");
        if (window.getComputedStyle(searchEl).visibility === "hidden") throw new Error("search input hidden while loading");
        if (searchEl.value !== "blue shirt") throw new Error("search value lost while loading");
        if (!sortEl) throw new Error("sort select missing");
        if (sortEl.disabled) throw new Error("sort select disabled while loading");
        if (window.getComputedStyle(sortEl).visibility === "hidden") throw new Error("sort hidden while loading");
        if (!findlyCount || findlyCount.getAttribute("aria-busy") !== "true") throw new Error("findly count missing aria-busy");
        if (!document.documentElement.classList.contains("sf-filter-loading")) {
          throw new Error("html missing sf-filter-loading");
        }
        var pager = document.querySelector("nav.pagination");
        var pagerVis = pager && window.getComputedStyle(pager).visibility;
        if (pagerVis !== "hidden") throw new Error("theme pagination visible while loading: " + pagerVis);
        var busyDuring = grid && grid.classList.contains("findly-grid-is-busy");
        var overlayH = overlay.style.height;
        var overlayPx = parseFloat(overlay.style.height) || 0;
        widget.setGridBusy(false);
        staleDisplay = staleCard && window.getComputedStyle(staleCard).display;
        if (isHidden(staleCard)) throw new Error("product still hidden after load");
        if (countEl && window.getComputedStyle(countEl).visibility === "hidden") {
          throw new Error("product count still hidden after load");
        }
        if (searchEl && searchEl.value !== "blue shirt") throw new Error("search value lost after load");
        if (searchEl && searchEl.disabled) throw new Error("search still disabled after load");
        if (sortEl && sortEl.disabled) throw new Error("sort still disabled after load");
        if (findlyCount && findlyCount.getAttribute("aria-busy") === "true") {
          throw new Error("findly count still aria-busy after load");
        }
        if (!document.documentElement.classList.contains("sf-filter-ready")) {
          throw new Error("html missing sf-filter-ready after load");
        }
        if (document.getElementById("findly-grid-busy-overlay")) {
          throw new Error("overlay still present after load");
        }
        if (pager && window.getComputedStyle(pager).visibility === "hidden") {
          throw new Error("theme pagination still hidden after load");
        }
        extra = {
          bootSkel: bootSkel,
          earlySkel: skel.length,
          overlay: true,
          overlayH: overlayH,
          overlayPx: overlayPx,
          viewH: window.innerHeight || 0,
          busyClass: busyDuring,
          productShown: staleDisplay !== "none",
          ready: document.documentElement.classList.contains("sf-filter-ready"),
          skelTag: skel[0] ? skel[0].tagName : "",
          skelHost: skelHost ? skelHost.id : "",
          searchSkel: document.querySelectorAll(".sf-search-item.is-skeleton").length,
          recsReady: Boolean(recs),
          ymmReady: Boolean(ymm)
        };
        if (extra.overlayPx > extra.viewH + 40) throw new Error("overlay taller than viewport: " + extra.overlayPx);
        report(true, extra);
      } catch (err) {
        report(false, { error: String(err && err.message || err) });
      }
    });
  </script>
</body>
</html>`;
  const htmlPath = join(dir, "index.html");
  writeFileSync(htmlPath, html);
  return htmlPath;
}

function writePagerHarness() {
  const dir = mkdtempSync(join(tmpdir(), "findly-pager-"));
  const pagerUrl = pathToFileURL(
    join(ROOT, "extensions/smart-filter/assets/smart-filter-pager.js"),
  ).href;
  const html = `<!doctype html>
<html>
<head>
  <style>
    html.sf-few-results nav.pagination,
    html.sf-pager-unneeded nav.pagination,
    [data-sf-pager-suppressed="1"] { display: none !important; }
    html:not(.sf-few-results):not(.sf-pager-unneeded):has(.smart-filter)
      nav.pagination:not([hidden]):not([data-sf-pager-suppressed="1"]) {
      display: flex !important;
    }
  </style>
</head>
<body>
  <div class="smart-filter"></div>
  <nav class="pagination" aria-label="Pagination">
    <ul class="pagination__list">
      <li><a href="?page=1">1</a></li>
      <li><a href="?page=2">2</a></li>
      <li><a href="?page=3">3</a></li>
      <li><span>…</span></li>
      <li><a href="?page=11">11</a></li>
      <li><a rel="next" href="?page=2">&gt;</a></li>
    </ul>
  </nav>
  <script src="${pagerUrl}"></script>
  <script>
    function report(ok, extra) {
      document.documentElement.setAttribute("data-load-ok", ok ? "1" : "0");
      document.documentElement.setAttribute("data-load-json", JSON.stringify(extra || {}));
    }
    function pagerEl() {
      return document.querySelector("nav.pagination");
    }
    function pagerIsHidden(el) {
      if (!el) return true;
      if (el.hasAttribute("hidden") || el.hidden) return true;
      if (el.getAttribute("data-sf-pager-suppressed") === "1") return true;
      var cs = window.getComputedStyle(el);
      if (cs && cs.display === "none") return true;
      if (document.documentElement.classList.contains("sf-few-results")) return true;
      return false;
    }
    function visiblePageNums(root) {
      var nums = [];
      if (!root) return nums;
      var nodes = root.querySelectorAll("a, button, span");
      var i;
      for (i = 0; i < nodes.length; i++) {
        var cs = window.getComputedStyle(nodes[i]);
        if (cs && (cs.display === "none" || cs.visibility === "hidden")) continue;
        var t = String(nodes[i].textContent || "").replace(/\\s+/g, " ").trim();
        if (/^\\d+$/.test(t)) nums.push(Number(t));
      }
      return nums;
    }
    window.addEventListener("load", function () {
      try {
        function Widget() {}
        Widget.prototype.ensurePageSize = function () { this.pageSize = 16; return 16; };
        Widget.prototype.hasActiveFilters = function () { return true; };
        Widget.prototype.goToPage = function (p) { this._went = p; };
        var widget = new Widget();
        widget.pageSize = 16;
        widget.page = 1;
        widget.paginationStyle = "pagination";
        window.__FINDLY_FILTER_WIDGET = widget;
        if (typeof widget.syncThemePager !== "function") {
          throw new Error("syncThemePager not patched onto Widget");
        }
        widget._lastFilterData = { total: 6, handles: [1, 2, 3, 4, 5, 6] };
        widget._statusProductCount = 6;
        widget.syncThemePager();
        var pager = pagerEl();
        if (!pagerIsHidden(pager)) throw new Error("pager still visible for 6 results");
        widget._lastFilterData = { total: 2, handles: ["a", "b"] };
        widget._allFilterHandles = ["a", "b"];
        widget._pageTotal = 2;
        widget._statusProductCount = 50;
        window.__findlyThemePagerSyncing = false;
        widget.syncThemePager();
        pager = pagerEl();
        if (!pagerIsHidden(pager)) {
          throw new Error("pager still visible on first filter apply with stale status count");
        }
        widget._lastFilterData = { total: 31, handles: new Array(31).fill("x") };
        widget._statusProductCount = 31;
        widget._pageTotal = 31;
        window.__findlyThemePagerSyncing = false;
        widget.syncThemePager();
        pager = pagerEl();
        if (pagerIsHidden(pager)) throw new Error("pager hidden for 31 results");
        if (document.documentElement.classList.contains("sf-few-results")) {
          throw new Error("html has sf-few-results with multi-page results");
        }
        var nums = visiblePageNums(pager);
        if (nums.indexOf(1) === -1 || nums.indexOf(2) === -1) {
          throw new Error("visible pages missing 1 or 2: " + JSON.stringify(nums));
        }
        if (nums.indexOf(11) !== -1) {
          throw new Error("visible pages still include 11: " + JSON.stringify(nums));
        }
        var page2Link = null;
        var links = pager.querySelectorAll("a");
        var i;
        for (i = 0; i < links.length; i++) {
          var label = String(links[i].textContent || "").replace(/\\s+/g, " ").trim();
          if (label === "2") {
            page2Link = links[i];
            break;
          }
        }
        if (!page2Link) throw new Error("page 2 link missing after rewrite");
        page2Link.click();
        if (widget._went !== 2) throw new Error("goToPage not called with 2: " + widget._went);
        widget.paginationStyle = "infinite";
        widget.page = 1;
        widget._went = undefined;
        window.__findlyThemePagerSyncing = false;
        widget.syncThemePager();
        pager = pagerEl();
        if (pagerIsHidden(pager)) {
          throw new Error("infinite+filters should still drive theme numbered pager");
        }
        var infiniteNums = visiblePageNums(pager);
        if (infiniteNums.indexOf(11) !== -1) {
          throw new Error("infinite+filters still shows unfiltered 11: " + JSON.stringify(infiniteNums));
        }
        if (infiniteNums.indexOf(1) === -1 || infiniteNums.indexOf(2) === -1) {
          throw new Error("infinite+filters missing 1/2: " + JSON.stringify(infiniteNums));
        }
        report(true, {
          fewHidden: true,
          multiVisible: true,
          pages: nums,
          infinitePages: infiniteNums,
          went: widget._went
        });
      } catch (err) {
        report(false, { error: String(err && err.message || err) });
      }
    });
  </script>
</body>
</html>`;
  const htmlPath = join(dir, "index.html");
  writeFileSync(htmlPath, html);
  return htmlPath;
}

function writeDawnPagerHarness() {
  const dir = mkdtempSync(join(tmpdir(), "findly-dawn-pager-"));
  const pagerUrl = pathToFileURL(
    join(ROOT, "extensions/smart-filter/assets/smart-filter-pager.js"),
  ).href;
  const html = `<!doctype html>
<html>
<head>
  <style>
    html.sf-few-results nav.pagination,
    html.sf-few-results .pagination-wrapper,
    html.sf-few-results [data-pagination],
    html.sf-pager-unneeded nav.pagination,
    html.sf-pager-unneeded .pagination-wrapper,
    html.sf-pager-unneeded [data-pagination],
    [data-sf-pager-suppressed="1"] { display: none !important; }
    html:not(.sf-few-results):not(.sf-pager-unneeded):has(.smart-filter)
      nav.pagination:not([hidden]):not([data-sf-pager-suppressed="1"]),
    html:not(.sf-few-results):not(.sf-pager-unneeded):has(.smart-filter)
      .pagination-wrapper:not([hidden]):not([data-sf-pager-suppressed="1"]),
    html:not(.sf-few-results):not(.sf-pager-unneeded):has(.smart-filter)
      [data-pagination]:not([hidden]):not([data-sf-pager-suppressed="1"]) {
      display: flex !important;
    }
  </style>
</head>
<body>
  <div class="smart-filter"></div>
  <main>
    <div id="product-grid"></div>
    <div class="pagination-wrapper" data-theme="dawn">
      <nav class="pagination">
        <a href="?page=1">1</a>
        <a href="?page=2">2</a>
        <a href="?page=3">3</a>
        <span>…</span>
        <a href="?page=11">11</a>
      </nav>
    </div>
    <div class="paginate" data-theme="debut"><a href="?page=1">1</a><a href="?page=9">9</a></div>
    <div data-pagination class="pagination" data-theme="impulse">
      <a href="?page=1">1</a><a href="?page=8">8</a>
    </div>
    <div class="Pagination" data-theme="prestige"><a href="?page=1">1</a><a href="?page=7">7</a></div>
    <div id="AjaxinatePagination" data-theme="ajaxinate"><a href="?page=1">1</a><a href="?page=6">6</a></div>
    <nav class="pagination" data-theme="horizon"><a href="?page=1">1</a><a href="?page=11">11</a></nav>
  </main>
  <footer>
    <nav class="pagination" data-theme="footer"><a>99</a></nav>
  </footer>
  <script src="${pagerUrl}"></script>
  <script>
    function report(ok, extra) {
      document.documentElement.setAttribute("data-load-ok", ok ? "1" : "0");
      document.documentElement.setAttribute("data-load-json", JSON.stringify(extra || {}));
    }
    function pagerEl() {
      return document.querySelector('[data-theme="dawn"]') || document.querySelector(".pagination-wrapper");
    }
    function pagerIsHidden(el) {
      if (!el) return true;
      if (el.hasAttribute("hidden") || el.hidden) return true;
      if (el.getAttribute("data-sf-pager-suppressed") === "1") return true;
      var cs = window.getComputedStyle(el);
      if (cs && cs.display === "none") return true;
      if (document.documentElement.classList.contains("sf-few-results")) return true;
      return false;
    }
    function visiblePageNums(root) {
      var nums = [];
      if (!root) return nums;
      var nodes = root.querySelectorAll("a, button, span");
      var i;
      for (i = 0; i < nodes.length; i++) {
        var cs = window.getComputedStyle(nodes[i]);
        if (cs && (cs.display === "none" || cs.visibility === "hidden")) continue;
        var t = String(nodes[i].textContent || "").replace(/\\s+/g, " ").trim();
        if (/^\\d+$/.test(t)) nums.push(Number(t));
      }
      return nums;
    }
    window.addEventListener("load", function () {
      try {
        function Widget() {}
        Widget.prototype.ensurePageSize = function () { this.pageSize = 16; return 16; };
        Widget.prototype.hasActiveFilters = function () { return true; };
        Widget.prototype.goToPage = function (p) { this._went = p; };
        var widget = new Widget();
        widget.pageSize = 16;
        widget.page = 1;
        widget.paginationStyle = "pagination";
        window.__FINDLY_FILTER_WIDGET = widget;
        if (typeof widget.syncThemePager !== "function") {
          throw new Error("syncThemePager not patched onto Widget");
        }
        widget._lastFilterData = { total: 6, handles: [1, 2, 3, 4, 5, 6] };
        widget._statusProductCount = 6;
        widget.syncThemePager();
        var pager = pagerEl();
        if (!pagerIsHidden(pager)) throw new Error("Dawn pager still visible for 6 results");
        widget._lastFilterData = { total: 2, handles: ["a", "b"] };
        widget._allFilterHandles = ["a", "b"];
        widget._pageTotal = 2;
        widget._statusProductCount = 50;
        window.__findlyThemePagerSyncing = false;
        widget.syncThemePager();
        pager = pagerEl();
        if (!pagerIsHidden(pager)) {
          throw new Error("Dawn pager still visible on first filter apply with stale status count");
        }
        widget._lastFilterData = { total: 31, handles: new Array(31).fill("x") };
        widget._statusProductCount = 31;
        widget._pageTotal = 31;
        window.__findlyThemePagerSyncing = false;
        widget.syncThemePager();
        pager = pagerEl();
        if (pagerIsHidden(pager)) throw new Error("Dawn pager hidden for 31 results");
        if (document.documentElement.classList.contains("sf-few-results")) {
          throw new Error("html has sf-few-results with multi-page results");
        }
        var nums = visiblePageNums(pager);
        if (nums.indexOf(1) === -1 || nums.indexOf(2) === -1) {
          throw new Error("Dawn visible pages missing 1 or 2: " + JSON.stringify(nums));
        }
        if (nums.indexOf(11) !== -1) {
          throw new Error("Dawn visible pages still include 11: " + JSON.stringify(nums));
        }
        function assertTheme(name) {
          var el = document.querySelector('[data-theme="' + name + '"]');
          if (!el) throw new Error(name + " missing");
          if (el.getAttribute("data-sf-pager-driven") !== "1") throw new Error(name + " not driven");
          var themeNums = visiblePageNums(el);
          if (themeNums.indexOf(1) === -1 || themeNums.indexOf(2) === -1) {
            throw new Error(name + " missing 1/2: " + JSON.stringify(themeNums));
          }
          if (themeNums.some(function (n) { return n > 2; })) {
            throw new Error(name + " still unfiltered: " + JSON.stringify(themeNums));
          }
          return themeNums;
        }
        var debutNums = assertTheme("debut");
        var impulseNums = assertTheme("impulse");
        var prestigeNums = assertTheme("prestige");
        var ajaxNums = assertTheme("ajaxinate");
        var horizonNums = assertTheme("horizon");
        var footerPager = document.querySelector('[data-theme="footer"]');
        if (footerPager && footerPager.getAttribute("data-sf-pager-driven") === "1") {
          throw new Error("footer pager was rewritten");
        }
        var footerNums = visiblePageNums(footerPager);
        if (footerNums.indexOf(99) === -1) {
          throw new Error("footer decoy pager lost 99: " + JSON.stringify(footerNums));
        }
        var footerWent = widget._went;
        var footerLink = footerPager && footerPager.querySelector("a");
        if (footerLink) footerLink.click();
        if (widget._went !== footerWent) {
          throw new Error("footer pager click intercepted goToPage: " + widget._went);
        }
        var page2Link = null;
        var links = pager.querySelectorAll("a");
        var i;
        for (i = 0; i < links.length; i++) {
          var label = String(links[i].textContent || "").replace(/\\s+/g, " ").trim();
          if (label === "2") {
            page2Link = links[i];
            break;
          }
        }
        if (!page2Link) throw new Error("Dawn page 2 link missing after rewrite");
        page2Link.click();
        if (widget._went !== 2) throw new Error("goToPage not called with 2: " + widget._went);
        widget.hasActiveFilters = function () { return false; };
        widget._keepThemeCards = undefined;
        widget._went = undefined;
        widget.page = 1;
        window.__findlyThemePagerSyncing = false;
        widget.syncThemePager();
        var idlePager = pagerEl();
        var idleLink = null;
        var idleLinks = idlePager ? idlePager.querySelectorAll("a") : [];
        for (i = 0; i < idleLinks.length; i++) {
          var idleLabel = String(idleLinks[i].textContent || "").replace(/\\s+/g, " ").trim();
          if (idleLabel === "2") {
            idleLink = idleLinks[i];
            break;
          }
        }
        if (!idleLink) throw new Error("unfiltered page 2 link missing");
        idleLink.click();
        if (widget._went !== 2) {
          throw new Error("unfiltered pager click did not goToPage: " + widget._went);
        }
        if (widget._keepThemeCards !== false) {
          throw new Error("unfiltered pager click did not take over the grid");
        }
        report(true, {
          fewHidden: true,
          multiVisible: true,
          pages: nums,
          debutPages: debutNums,
          impulsePages: impulseNums,
          prestigePages: prestigeNums,
          ajaxinatePages: ajaxNums,
          horizonPages: horizonNums,
          footerPages: footerNums,
          went: widget._went
        });
      } catch (err) {
        report(false, { error: String(err && err.message || err) });
      }
    });
  </script>
</body>
</html>`;
  const htmlPath = join(dir, "index.html");
  writeFileSync(htmlPath, html);
  return htmlPath;
}

function runHeadless(htmlPath, failMessage) {
  const bin = chromePath();
  if (!bin) {
    log.info("no Chrome/Edge found; skipped headless DOM run");
    return null;
  }
  const fileUrl = pathToFileURL(htmlPath).href;
  const result = spawnSync(
    bin,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-first-run",
      "--no-default-browser-check",
      "--allow-file-access-from-files",
      "--virtual-time-budget=12000",
      "--dump-dom",
      fileUrl,
    ],
    { encoding: "utf8", timeout: 45000, windowsHide: true },
  );
  const out = String(result.stdout || "") + String(result.stderr || "");
  const match = out.match(/data-load-ok="([^"]*)"/);
  const jsonMatch = out.match(/data-load-json="([^"]*)"/);
  let json = {};
  if (jsonMatch) {
    try {
      json = JSON.parse(jsonMatch[1].replace(/&quot;/g, '"').replace(/&amp;/g, "&"));
    } catch {
      json = { raw: jsonMatch[1] };
    }
  }
  if (!match) {
    fail("headless dump missing data-load-ok. " + out.slice(-400));
  }
  if (match[1] !== "1") {
    fail((failMessage || "headless loading harness failed") + ": " + JSON.stringify(json));
  }
  log.info("headless DOM: " + JSON.stringify(json));
  return json;
}

async function probeLiveStore() {
  const url = "https://findly-test-store.myshopify.com/collections/all";
  try {
    const res = await fetch(url, {
      headers: { Accept: "text/html", "User-Agent": "FindlyLoadingVerify/1.0" },
      redirect: "follow",
    });
    const html = await res.text();
    const hasBlock = html.includes("smart-filter-root") || html.includes("smart-filter-grid");
    const hasSkelCss = html.includes("findly-grid-skel") || html.includes("data-findly-skel");
    const hasGridJs = /smart-filter-grid[^"']*\.js/.test(html);
    log.info(
      "live store " +
        res.status +
        " block=" +
        hasBlock +
        " gridJs=" +
        hasGridJs +
        " skelInHtml=" +
        hasSkelCss,
    );
    return { status: res.status, hasBlock, hasGridJs, hasSkelCss };
  } catch (err) {
    log.info("live store fetch skipped: " + (err && err.message));
    return null;
  }
}

try {
  assertSourceMarkers();
  const htmlPath = writeHarness();
  runHeadless(htmlPath);
  runHeadless(writePagerHarness(), "headless pager harness failed");
  runHeadless(writeDawnPagerHarness(), "headless Dawn/all-themes pager harness failed");
  await probeLiveStore();
  log.success("LOADING_STATES_OK");
} catch (error) {
  log.error("LOADING_STATES_FAIL " + error.message);
  process.exit(1);
}
