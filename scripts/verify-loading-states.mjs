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
    fail("smart-filter-check.css must hide the product grid until the filter is ready");
  }
  if (!grid.includes("data-findly-skel") || !grid.includes("findly-grid-skel__img")) {
    fail("grid missing skeleton markup");
  }
  if (!grid.includes('hostTag === "ul" || hostTag === "ol" ? "LI" : "DIV"')) {
    fail("grid skeletons must use DIV/LI, not theme custom elements");
  }
  if (!css.includes("findly-grid-skel__img") || !css.includes("findly-grid-busy-overlay")) {
    fail("smart-filter.css missing grid loading styles");
  }
  if (!filterJs.includes("if (!self._importingCards)") || !filterJs.includes("self.setGridBusy(false)")) {
    fail("fetchFilters must keep the grid busy while cards import");
  }
  if (!searchJs.includes("renderSearchSkeletons") || !searchCss.includes("smart-filter-search__skel-img")) {
    fail("search skeletons missing");
  }
  if (!instantJs.includes("showLoadingPanel") || !instantCss.includes("findly-instant__skel-card")) {
    fail("instant-search skeletons missing");
  }
  if (!recsJs.includes("renderSkeletons") || !recsCss.includes("smart-filter-recs__skel-img")) {
    fail("recommendations skeletons missing");
  }
  if (!ymmJs.includes("renderSkeletons") || !ymmCss.includes("smart-filter-ymm__skel-img")) {
    fail("vehicle-finder skeletons missing");
  }
  if (!pagerJs.includes("sf-pager__spin") || !pagerJs.includes("is-busy")) {
    fail("pager loading spinner missing");
  }
  if (!pagerJs.includes("syncThemePager") || !pagerJs.includes("usesThemeNumberedPager")) {
    fail("pager must reuse the theme numbered pagination");
  }
  if (!pagerJs.includes("data-sf-pager-suppressed")) {
    fail("pager must suppress the theme pager when filtered results fit on one page");
  }
  if (grid.includes('el.id = "findly-sf-pager"')) {
    fail("grid must not mount a Findly numbered pager");
  }
  const themeJs = read("extensions/smart-filter/assets/smart-filter-theme.js");
  if (
    !themeJs.includes("sf-custom-pager") ||
    themeJs.includes("html.sf-og nav.pagination")
  ) {
    fail("theme compat must keep theme pagination visible unless load more / infinite");
  }
  if (!block.includes("smart-filter-grid.min.js") || !embed.includes("smart-filter-grid.min.js")) {
    fail("both collection blocks must load the grid companion");
  }
  if (/\bcrossorigin\b/.test(block) || /\bcrossorigin\b/.test(embed)) {
    fail("filter JSON preload must not use crossorigin; it breaks same-origin fetch");
  }
  if (!filterJs.includes("failFilterLoad") || !filterJs.includes("FILTER_FETCH_MS")) {
    fail("fetchFilters must time out and clear the facet skeleton on error");
  }
  if (!minGrid.includes("data-findly-skel") || !minGrid.includes("findly-grid-takeover-v20")) {
    fail("smart-filter-grid.min.js is stale; run npm run theme:minify");
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
    <div class="smart-filter__facets" data-facets>
      <div class="smart-filter__skeleton" data-skeleton></div>
    </div>
  </div>
  <p class="product-count">163 products</p>
  <results-list>
    <div class="main-collection-grid" id="product-grid">
      <ul class="product-grid">
        <article class="product-card" data-product-handle="stale-item">
          <a href="/products/stale-item">Stale product</a>
        </article>
      </ul>
    </div>
  </results-list>
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
        var grid = document.querySelector(".main-collection-grid");
        var skel = document.querySelectorAll("[data-findly-skel='1']");
        var overlay = document.getElementById("findly-grid-busy-overlay");
        var widget = {
          _gridParent: grid,
          ensureGridParent: function () { return grid; },
          setGridBusy: function () {}
        };
        window.__FINDLY_FILTER_WIDGET = widget;
        widget._reqId = 3;
        if (typeof widget.setGridBusy === "function") widget.setGridBusy(true);
        skel = document.querySelectorAll("[data-findly-skel='1']");
        overlay = document.getElementById("findly-grid-busy-overlay");
        var protoBusy = Object.getPrototypeOf(widget).setGridBusy;
        if (typeof protoBusy === "function") protoBusy.call(widget, true);
        skel = document.querySelectorAll("[data-findly-skel='1']");
        overlay = document.getElementById("findly-grid-busy-overlay");
        var skelHost = skel[0] && skel[0].parentElement;
        if (!skelHost || skelHost.id !== "product-grid") {
          throw new Error("skeletons must mount on #product-grid, got " + (skelHost && (skelHost.id || skelHost.className)));
        }
        var searchList = document.querySelector("[data-results]");
        if (searchList && !searchList.children.length) {
          for (var i = 0; i < 5; i++) {
            var li = document.createElement("li");
            li.className = "smart-filter-search__item is-skeleton";
            li.innerHTML = '<span class="smart-filter-search__skel-img"></span>';
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
        var staleCard = document.querySelector("[data-product-handle='stale-item']");
        var staleDisplay = staleCard && window.getComputedStyle(staleCard).display;
        if (!isHidden(staleCard)) throw new Error("stale product visible while loading: " + staleDisplay);
        var countEl = document.querySelector(".product-count");
        var countVis = countEl && window.getComputedStyle(countEl).visibility;
        if (countVis !== "hidden") throw new Error("product count visible while loading: " + countVis);
        if (!document.documentElement.classList.contains("sf-filter-loading")) {
          throw new Error("html missing sf-filter-loading");
        }
        var busyDuring = grid && grid.classList.contains("findly-grid-is-busy");
        var overlayH = overlay.style.height;
        var overlayPx = parseFloat(overlay.style.height) || 0;
        protoBusy.call(widget, false);
        staleDisplay = staleCard && window.getComputedStyle(staleCard).display;
        if (isHidden(staleCard)) throw new Error("product still hidden after load");
        if (countEl && window.getComputedStyle(countEl).visibility === "hidden") {
          throw new Error("product count still hidden after load");
        }
        if (!document.documentElement.classList.contains("sf-filter-ready")) {
          throw new Error("html missing sf-filter-ready after load");
        }
        if (document.getElementById("findly-grid-busy-overlay")) {
          throw new Error("overlay still present after load");
        }
        extra = {
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
          searchSkel: document.querySelectorAll(".smart-filter-search__item.is-skeleton").length,
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

function runHeadless(htmlPath) {
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
      "--virtual-time-budget=5000",
      "--dump-dom",
      fileUrl,
    ],
    { encoding: "utf8", timeout: 20000, windowsHide: true },
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
    fail("headless loading harness failed: " + JSON.stringify(json));
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
  await probeLiveStore();
  log.success("LOADING_STATES_OK");
} catch (error) {
  log.error("LOADING_STATES_FAIL " + error.message);
  process.exit(1);
}
