/**
 * Collection grid takeover extras.
 * Loaded from Liquid via asset_url so it does not count against the 100 KB
 * schema "javascript" cap on smart-filter.min.js.
 *
 * Patches Widget.prototype as soon as window.__FINDLY_FILTER_WIDGET is set.
 */
(function () {
  "use strict";

  var STYLE_ID = "findly-grid-takeover-v19";
  var HOST_ID = "findly-grid-host";
  var CARD_TRAY_ID = "findly-card-tray";
  var EMPTY_ID = "findly-grid-empty";
  var SKEL_ATTR = "data-findly-skel";
  var SKEL_COUNT = 8;
  var PRODUCT_GRID_START_CSS =
    ".sf-collection-layout .main-collection-grid,.sf-og .main-collection-grid," +
    ".sf-collection-layout #product-grid,.sf-og #product-grid," +
    ".sf-collection-layout #ProductGrid,.sf-og #ProductGrid," +
    ".sf-collection-layout ul.product-grid,.sf-og ul.product-grid," +
    ".sf-collection-layout ol.product-grid,.sf-og ol.product-grid," +
    ".sf-collection-layout .product-grid,.sf-og .product-grid," +
    ".sf-collection-layout .sf-app-grid,.sf-og .sf-app-grid," +
    ".sf-collection-layout results-list>.main-collection-grid,.sf-og results-list>.main-collection-grid" +
    "{justify-content:stretch!important;width:100%!important;max-width:100%!important}";
  var GRID_RESULT_HIDE =
    ":not([" +
    SKEL_ATTR +
    "='1']):not(.sf-toolbar):not(.sf-sort-host):not(.sf-collection-search-host):not(.sf-total-count)" +
    ":not(.sf-pager):not(.sf-grid-empty):not(#findly-grid-empty):not(#findly-card-tray):not(.smart-filter)";
  var GRID_BUSY_HOSTS = [
    ".main-collection-grid",
    "#product-grid",
    "#ProductGrid",
    "ul.product-grid",
    "ol.product-grid",
    ".sf-app-grid",
  ];
  function gridLoadingHideCss(prefix) {
    var i;
    var parts = [];
    for (i = 0; i < GRID_BUSY_HOSTS.length; i++) {
      parts.push(prefix + " " + GRID_BUSY_HOSTS[i] + ">" + GRID_RESULT_HIDE);
    }
    return parts.join(",") + "{display:none!important}";
  }
  function gridLoadingMinCss(prefix) {
    var i;
    var parts = [];
    for (i = 0; i < GRID_BUSY_HOSTS.length; i++) {
      parts.push(prefix + " " + GRID_BUSY_HOSTS[i]);
    }
    return parts.join(",") + "{position:relative;min-height:22rem}";
  }
  var GRID_BUSY_CSS =
    "@keyframes sf-grid-spin{to{transform:rotate(360deg)}}" +
    "@keyframes sf-skeleton-pulse{50%{opacity:.55}}" +
    "#findly-grid-busy-overlay{position:fixed;z-index:80;box-sizing:border-box;pointer-events:auto;" +
    "background:rgb(255 255 255 / .28)}" +
    "#findly-grid-busy-overlay::after{content:\"\";position:absolute;top:50%;left:50%;width:2rem;height:2rem;" +
    "margin:-1rem 0 0 -1rem;border:2px solid rgb(0 0 0 / .12);border-top-color:var(--sf-accent,#111);" +
    "border-radius:50%;animation:sf-grid-spin .7s linear infinite}" +
    ".findly-grid-is-busy{position:relative;min-height:22rem;pointer-events:none}" +
    ".findly-grid-is-busy>" +
    GRID_RESULT_HIDE +
    "{display:none!important}" +
    gridLoadingHideCss("html.sf-filter-loading") +
    gridLoadingMinCss("html.sf-filter-loading") +
    "[" + SKEL_ATTR + "='1']{pointer-events:none;list-style:none;min-width:0}" +
    ".findly-grid-skel__img{display:block;width:100%;aspect-ratio:1;border-radius:8px;background:#ececec}" +
    ".findly-grid-skel__line{display:block;height:.7rem;margin-top:.55rem;border-radius:4px;background:#ececec;width:78%}" +
    ".findly-grid-skel__line.is-short{width:42%;margin-top:.4rem}" +
    "[" + SKEL_ATTR + "='1'] .findly-grid-skel__img,[" + SKEL_ATTR + "='1'] .findly-grid-skel__line{" +
    "animation:sf-skeleton-pulse 1.1s ease-in-out infinite}" +
    "#" +
    "findly-grid-empty,.sf-grid-empty{grid-column:1/-1;width:100%;min-height:12rem;display:flex;flex-direction:column;" +
    "align-items:center;justify-content:center;text-align:center;padding:2.5rem 1.5rem;box-sizing:border-box}" +
    ".sf-grid-empty__title{margin:0 0 .4rem;font-size:1.05rem;font-weight:650}" +
    ".sf-grid-empty__copy{margin:0;opacity:.7;font-size:.9rem}";
  var STRICT_CARD_SELECTOR = [
    "product-card",
    "product-item",
    "grid-item",
    "li.grid__item",
    ".product-card",
    ".product-grid__item",
    ".product-item",
    ".grid-product",
    ".grid-view-item",
    ".product-block",
    ".productitem",
    "article.card",
  ].join(", ");
  var THEME_CARD_HOST_SELECTOR = [
    "product-card",
    "product-item",
    "grid-item",
    ".product-card",
    ".product-card-wrapper",
    ".product-card__wrapper",
    ".card-wrapper",
    ".card--product",
    ".card-product",
    "[data-product-handle]",
    "[data-product-id]",
    "[data-product-card]",
    "li.grid__item",
    ".grid__item",
    ".product-grid__item",
    ".product-grid-item",
    ".product-item",
    ".productitem",
    ".product-block",
    ".product-index",
    ".grid-product",
    ".grid-view-item",
    ".collection-product-card",
    ".product__item",
    "article.card",
  ].join(", ");
  var RESULTS_LIST_SELECTOR =
    "results-list, .results-list, #ResultsList, [data-results-list]";
  var PRODUCT_GRID_SELECTOR = [
    "#product-grid",
    "#ProductGrid",
    "ul.product-grid",
    "ol.product-grid",
    "[data-id='product-grid']",
    "[data-product-grid]",
    "[product-grid-view]",
    ".grid.product-grid",
    ".product-grid",
    "ul[id*='product-grid']",
    "ul[class*='product-grid']",
    "#ProductGridContainer",
    "#CollectionProductGrid",
    "#CollectionAjaxContent",
    "#collection-products",
    "#CollectionLoop",
    "#product-loop",
    "#product-list",
    "product-list",
    ".ProductList",
    ".ProductList--grid",
    ".product-list",
    ".product-list__inner",
    ".product-listing",
    ".collection-grid",
    ".main-collection-grid",
    ".collection-products",
    ".grid-uniform",
    ".grid--uniform",
    ".grid--view-items",
    ".grid-products",
    ".products-grid",
    ".products-list",
    "[data-collection-products]",
    "[data-products-grid]",
    "[data-product-list]",
    ".collection__products",
    ".collection-product-list",
    "#main-collection-product-grid",
    ".productgrid--items",
    ".productgrid",
    ".boost-sd-grid",
    ".boost-pfs-filter-products",
    ".sf-grid",
    ".sf-app-grid",
  ].join(", ");

  function describeHost(el) {
    if (!el || el.nodeType !== 1) return String(el);
    var id = el.id ? "#" + el.id : "";
    var cls = String(el.className || "")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 3)
      .join(".");
    return String(el.tagName || "").toLowerCase() + id + (cls ? "." + cls : "");
  }

  function shortStack() {
    try {
      return String(new Error().stack || "")
        .split("\n")
        .slice(2, 7)
        .map(function (line) {
          return String(line).trim();
        });
    } catch (err) {
      return [];
    }
  }

  function findlyLog(kind, data) {
    var row = { t: Date.now(), kind: kind, data: data || {} };
    try {
      window.__FINDLY_LOGS = window.__FINDLY_LOGS || [];
      window.__FINDLY_LOGS.push(row);
      if (window.__FINDLY_LOGS.length > 400) window.__FINDLY_LOGS.shift();
    } catch (err) {
      /* ignore */
    }
    try {
      if (typeof console !== "undefined" && console.info) {
        console.info("[Findly]", kind, data || {});
      }
    } catch (err2) {
      /* ignore */
    }
  }

  try {
    window.__FINDLY_DUMP = function () {
      var logs = window.__FINDLY_LOGS || [];
      if (typeof console !== "undefined" && console.info) {
        console.info("[Findly] dump " + logs.length + " entries", logs);
      }
      return logs;
    };
  } catch (errDump) {
    /* ignore */
  }

  function decodeHashValue(value) {
    try {
      return decodeURIComponent(String(value || ""));
    } catch (err) {
      return String(value || "");
    }
  }

  function applyLooseHash(widget) {
    if (!widget) return false;
    var raw = String(window.location.hash || "").replace(/^#/, "");
    if (!raw) return false;
    var params = new URLSearchParams(raw.indexOf("=") === -1 ? "" : raw);
    var selected = {};
    var sort = "";
    var applied = false;
    params.forEach(function (value, key) {
      if (key === "sf") return;
      if (key === "sort" || key === "sf-sort") {
        sort = decodeHashValue(value);
        applied = true;
        return;
      }
      var facetKey = "";
      if (key.indexOf("sf-") === 0) facetKey = key.slice(3);
      else if (key.indexOf("f.") === 0) facetKey = key.slice(2);
      if (!facetKey) return;
      selected[facetKey] = String(value)
        .split(",")
        .map(decodeHashValue)
        .filter(Boolean);
      applied = true;
    });
    if (!applied) return false;
    if (Object.keys(selected).length) {
      widget.selected = selected;
    }
    if (sort) widget.sortKey = sort;
    return true;
  }

  function bindHashChange() {
    if (window.__findlyHashBound) return;
    window.__findlyHashBound = true;
    window.addEventListener("hashchange", function () {
      var widget = window.__FINDLY_FILTER_WIDGET;
      if (!widget || !widget.fetchFilters) return;
      if (widget.restoreFromHash) widget.restoreFromHash();
      applyLooseHash(widget);
      widget.fetchFilters();
    });
  }

  function injectCss() {
    var oldTakeovers = document.querySelectorAll("[id^='findly-grid-takeover']");
    var ti;
    for (ti = 0; ti < oldTakeovers.length; ti++) {
      if (oldTakeovers[ti].id !== STYLE_ID && oldTakeovers[ti].parentNode) {
        oldTakeovers[ti].parentNode.removeChild(oldTakeovers[ti]);
      }
    }
    injectCatalogCss();
    if (document.getElementById(STYLE_ID)) return;
    var css =
      ".smart-filter .smart-filter__option:not(.smart-filter__swatch):not(.smart-filter__pill) input[type=checkbox]," +
      ".smart-filter .smart-filter__option:not(.smart-filter__swatch):not(.smart-filter__pill) input[type=radio]{" +
      "appearance:none!important;-webkit-appearance:none!important;opacity:1!important;visibility:visible!important;" +
      "position:relative!important;width:18px!important;height:18px!important;min-width:18px!important;margin:0!important;" +
      "border:1.5px solid #c3c3c3!important;background:#fff!important;display:inline-grid!important;place-content:center!important;" +
      "clip:auto!important;transform:none!important;box-shadow:none!important;color:inherit!important}" +
      ".smart-filter .smart-filter__option:not(.smart-filter__swatch):not(.smart-filter__pill) input[type=checkbox]{border-radius:4px!important}" +
      ".smart-filter .smart-filter__option:not(.smart-filter__swatch):not(.smart-filter__pill) input[type=radio]{border-radius:999px!important}" +
      ".smart-filter .smart-filter__option:not(.smart-filter__swatch):not(.smart-filter__pill) input[type=checkbox]::after{" +
      "content:\"\";width:4px;height:8px;border:solid #fff;border-width:0 2px 2px 0;transform:scale(0) rotate(45deg);margin-top:-1px}" +
      ".smart-filter .smart-filter__option:not(.smart-filter__swatch):not(.smart-filter__pill) input[type=radio]::after{" +
      "content:\"\";width:8px;height:8px;border:0;border-radius:50%;background:currentColor;transform:scale(0)}" +
      ".smart-filter .smart-filter__option:not(.smart-filter__swatch):not(.smart-filter__pill) input[type=checkbox]:checked," +
      ".smart-filter .smart-filter__option:not(.smart-filter__swatch):not(.smart-filter__pill) input[type=checkbox]:indeterminate{" +
      "background:currentColor!important;border-color:currentColor!important}" +
      ".smart-filter .smart-filter__option:not(.smart-filter__swatch):not(.smart-filter__pill) input[type=radio]:checked{" +
      "background:#fff!important;border-color:currentColor!important}" +
      ".smart-filter .smart-filter__option:not(.smart-filter__swatch):not(.smart-filter__pill) input[type=checkbox]:checked::after{transform:scale(1) rotate(45deg)}" +
      ".smart-filter .smart-filter__option:not(.smart-filter__swatch):not(.smart-filter__pill) input[type=radio]:checked::after{transform:scale(1)}" +
      ".smart-filter .smart-filter__price{display:grid!important;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr)!important;width:100%!important;min-width:0!important;overflow:visible!important}" +
      ".smart-filter .smart-filter__slider{grid-column:1/-1!important;position:relative!important;display:block!important;width:100%!important;height:1.7rem!important;overflow:visible!important;background:transparent!important}" +
      ".smart-filter .smart-filter__slider-track,.smart-filter .smart-filter__slider-fill{position:absolute!important;left:0!important;top:50%!important;height:2px!important;margin-top:-1px!important;border:0!important;border-radius:999px!important;pointer-events:none!important;display:block!important}" +
      ".smart-filter .smart-filter__slider-track{right:0!important;width:auto!important;background:#dcdcdc!important;z-index:0!important}" +
      ".smart-filter .smart-filter__slider-fill{height:3px!important;margin-top:-1.5px!important;background:var(--sf-accent,#111)!important;z-index:1!important}" +
      ".smart-filter .smart-filter__slider input[type=range]{position:absolute!important;left:0!important;width:100%!important;max-width:none!important;height:1.45rem!important;margin:0!important;padding:0!important;border:0!important;opacity:0!important;background:transparent!important;appearance:none!important;-webkit-appearance:none!important;pointer-events:none!important}" +
      ".smart-filter .smart-filter__slider-thumb{position:absolute!important;top:50%!important;width:16px!important;height:16px!important;margin:0!important;padding:0!important;border:1.5px solid var(--sf-accent,#111)!important;border-radius:999px!important;background:#fff!important;transform:translate(-50%,-50%)!important;z-index:4!important;pointer-events:auto!important;cursor:grab!important;display:block!important;touch-action:none}" +
      "@media(max-width:989px){" +
      ".smart-filter__panel,.smart-filter__panel.sf-drawer-portal{" +
      "width:min(420px,92vw)!important;max-width:92vw!important;box-sizing:border-box!important}" +
      "}" +
      ".smart-filter__panel.sf-drawer-portal{" +
      "width:min(420px,92vw)!important;max-width:92vw!important;box-sizing:border-box!important}" +
      ".smart-filter__sort--toolbar,.sf-sort-host,.sf-sort-trigger{overflow:visible!important;position:relative}" +
      ".sf-sort-trigger{display:block;width:100%}" +
      ".smart-filter__sort-menu{position:absolute;top:calc(100% + 4px);left:auto;right:0;bottom:auto;" +
      "z-index:100060;box-sizing:border-box;min-width:0;width:max-content;max-width:min(18rem,calc(100vw - 24px));margin:0;" +
      "background:var(--sf-surface,#fff);color:inherit;border:1px solid var(--sf-border,#ececec);" +
      "border-radius:8px;padding:6px 0;box-shadow:0 10px 28px rgb(0 0 0 / 14%)}" +
      ".smart-filter__sort-menu.is-ported{position:fixed;top:auto;left:auto;right:auto;min-width:0;width:max-content}" +
      ".smart-filter__sort-menu[hidden]{display:none!important}" +
      ".smart-filter__sort-option{display:block;width:100%;appearance:none;margin:0;" +
      "padding:8px 18px 8px 30px;border:0;background:transparent;color:inherit;font:inherit;" +
      "text-align:left;white-space:nowrap;cursor:pointer}";
    var style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = css;
    (document.head || document.documentElement).appendChild(style);
    var existingBridge = document.getElementById("findly-theme-bridge");
    if (
      existingBridge &&
      existingBridge.textContent &&
      existingBridge.textContent.indexOf("grid-template-columns:280px") < 0
    ) {
      existingBridge.parentNode.removeChild(existingBridge);
      existingBridge = null;
    }
    if (!existingBridge) {
      var bridge = document.createElement("style");
      bridge.id = "findly-theme-bridge";
      bridge.textContent =
        "[data-smart-filter-hidden='true'],[data-findly-theme-hidden='1']{display:none!important}" +
        GRID_BUSY_CSS +
        ".sf-collection-layout{display:block;box-sizing:border-box;width:100%;max-width:100%;min-width:0;margin-inline:0}" +
        ".page-width>.sf-collection-layout,.page-width-desktop>.sf-collection-layout," +
        ".page-width--narrow>.sf-collection-layout,.container>.sf-collection-layout,.Container>.sf-collection-layout" +
        "{width:100%!important;max-width:100%!important;margin-left:0;margin-right:0}" +
        ".sf-collection-layout__aside,.sf-collection-layout__main{box-sizing:border-box;min-width:0}" +
        ".sf-collection-layout__main:not(ul):not(ol):not(results-list):not(.product-grid):not(.main-collection-grid):not(product-list)" +
        "{display:block;flex:1 1 0%;min-width:0;width:auto;max-width:100%}" +
        "ul.product-grid.sf-collection-layout__main,ol.product-grid.sf-collection-layout__main," +
        ".product-grid.sf-collection-layout__main,.main-collection-grid.sf-collection-layout__main," +
        "results-list.sf-collection-layout__main,product-list.sf-collection-layout__main" +
        "{display:grid!important;flex:1 1 0%;min-width:0;width:auto;max-width:100%}" +
        "ul.product-grid>.sf-collection-layout,.product-grid>.sf-collection-layout,ol.product-grid>.sf-collection-layout," +
        "results-list>.sf-collection-layout,.main-collection-grid>.sf-collection-layout,.sf-app-grid>.sf-collection-layout," +
        ".collection-wrapper>.sf-collection-layout,.product-grid-container>.sf-collection-layout" +
        "{grid-column:1/-1!important;width:100%!important;max-width:100%!important}" +
        ".collection-wrapper>.sf-pager,.collection-wrapper>.sf-toolbar,.collection-wrapper>.sf-sort-host," +
        ".product-grid-container>.sf-pager,.product-grid-container>.sf-toolbar" +
        "{grid-column:1/-1!important;width:100%!important;max-width:100%!important}" +
        ".sf-collection-layout__main>.collection-wrapper,.sf-collection-layout .collection-wrapper" +
        "{display:block!important;width:100%;max-width:100%;min-width:0;grid-template-columns:none!important}" +
        ".product-grid>.sf-toolbar,.product-grid>.sf-pager,.product-grid>.sf-sort-host,.product-grid>.sf-collection-search-host," +
        "ul.product-grid>.sf-toolbar,ul.product-grid>.sf-pager,ul.product-grid>.sf-sort-host," +
        ".main-collection-grid>.sf-toolbar,.main-collection-grid>.sf-pager,.main-collection-grid>.sf-sort-host," +
        ".main-collection-grid>.sf-collection-search-host,results-list>.sf-toolbar,results-list>.sf-pager" +
        "{grid-column:1/-1!important;width:100%!important;max-width:100%!important;display:flex}" +
        ".sf-collection-layout>.sf-pager,.sf-collection-layout>.sf-toolbar,.sf-collection-layout>.sf-sort-host," +
        ".sf-collection-layout>:not(.sf-collection-layout__aside):not(.sf-collection-layout__main):not(.smart-filter):not(.shopify-block)" +
        "{flex:1 1 100%;width:100%;max-width:100%;order:20}" +
        ".sf-collection-layout__main .product-grid,.sf-collection-layout__main ul.product-grid," +
        ".sf-collection-layout__main ol.product-grid,.sf-collection-layout__main .main-collection-grid," +
        ".sf-collection-layout__main .sf-app-grid{width:100%!important;min-width:0;max-width:100%!important;justify-content:stretch!important}" +
        ".collection-wrapper:has(.sf-collection-layout),.collection-wrapper:has(.smart-filter)," +
        "results-list:has(.sf-collection-layout),.product-grid-container:has(.sf-collection-layout)" +
        "{display:block!important;grid-template-columns:none!important;width:100%!important;max-width:100%!important;" +
        "--grid-column--desktop:minmax(0,1fr);--grid-column--mobile:minmax(0,1fr);--centered-column-number:1}" +
        ".collection-wrapper.grid:has(.sf-collection-layout),.collection-wrapper.grid:has(.smart-filter)," +
        ".sf-collection-layout .collection-wrapper.grid" +
        "{display:grid!important;grid-template-columns:minmax(0,1fr)!important;" +
        "--grid-column--desktop:minmax(0,1fr)!important;--grid-column--mobile:minmax(0,1fr)!important}" +
        ".collection-wrapper>.main-collection-grid,.collection-wrapper>results-list" +
        "{grid-column:1/-1!important;width:100%!important;max-width:100%!important;min-width:0!important}" +
        ".collection-wrapper:has(.sf-collection-layout)>.sf-collection-layout," +
        ".collection-wrapper:has(.smart-filter)>.sf-collection-layout" +
        "{grid-column:1/-1!important;width:100%!important;max-width:100%!important}" +
        ".collection-wrapper:has(.sf-collection-layout) .main-collection-grid," +
        ".sf-collection-layout .main-collection-grid" +
        "{grid-column:1/-1!important;width:100%!important;max-width:100%!important;min-width:0!important}" +
        ".sf-pager,.sf-pager__nav,.sf-pager__pages{display:flex!important;flex-direction:row!important;flex-wrap:wrap!important;width:100%;max-width:100%}" +
        ".sf-collection-layout .badge,.sf-collection-layout .card__badge,.sf-collection-layout .product-card__badge" +
        "{writing-mode:horizontal-tb!important;white-space:nowrap;max-width:100%}" +
        ".sf-collection-layout nav.pagination,.sf-collection-layout .pagination,.sf-collection-layout .pagination-wrapper" +
        "{display:flex!important;flex-direction:row!important;flex-wrap:wrap!important;width:100%}" +
        "@media(min-width:750px){" +
        ".sf-collection-layout--left{display:grid!important;grid-template-columns:280px minmax(0,1fr)!important;align-items:start;gap:32px;width:100%!important;max-width:100%!important}" +
        ".sf-collection-layout--right{display:grid!important;grid-template-columns:minmax(0,1fr) 280px!important;align-items:start;gap:32px;width:100%!important;max-width:100%!important}" +
        ".sf-collection-layout--left>.sf-collection-layout__aside,.sf-collection-layout--left>.smart-filter," +
        ".sf-collection-layout--left>.shopify-block:has(.smart-filter)" +
        "{grid-column:1!important;width:280px;max-width:280px;min-width:280px}" +
        ".sf-collection-layout--left>.sf-collection-layout__main,.sf-collection-layout--left>.sf-toolbar," +
        ".sf-collection-layout--left>.sf-pager,.sf-collection-layout--left>.sf-sort-host" +
        "{grid-column:2!important;min-width:0!important;width:auto!important;max-width:none!important}" +
        ".sf-collection-layout--right>.sf-collection-layout__aside,.sf-collection-layout--right>.smart-filter," +
        ".sf-collection-layout--right>.shopify-block:has(.smart-filter)" +
        "{grid-column:2!important;width:280px;max-width:280px;min-width:280px}" +
        ".sf-collection-layout--right>.sf-collection-layout__main,.sf-collection-layout--right>.sf-toolbar," +
        ".sf-collection-layout--right>.sf-pager" +
        "{grid-column:1!important;min-width:0!important;max-width:none!important}" +
        ".sf-collection-layout--top{display:flex!important;flex-direction:column;gap:16px;width:100%}" +
        ".sf-collection-layout--top>.sf-collection-layout__aside,.sf-collection-layout--top>.smart-filter," +
        ".sf-collection-layout--top>.shopify-block:has(.smart-filter)" +
        "{flex:0 0 auto!important;width:100%!important;max-width:100%!important;min-width:0!important}" +
        "}" +
        ".sf-toolbar{display:flex;align-items:flex-start;justify-content:space-between;gap:12px 24px;width:100%;max-width:100%;margin:0 0 18px;box-sizing:border-box}" +
        ".sf-toolbar__search{flex:1 1 auto;min-width:0;margin:0;max-width:22rem}" +
        ".sf-toolbar__end{display:flex;flex-direction:column;align-items:flex-end;flex:0 0 auto;gap:0;min-width:0}" +
        ".sf-sort-host{display:flex;justify-content:flex-end;width:auto;margin:0;overflow:visible;position:relative;z-index:6}" +
        ".sf-toolbar .smart-filter__sort--toolbar{display:flex;align-items:flex-start;gap:.7rem;width:auto;margin:0;flex-wrap:nowrap}" +
        ".sf-toolbar .smart-filter__sort-label{font-weight:450;font-size:.9375em;color:inherit;line-height:2.5rem;padding:0;margin:0;white-space:nowrap}" +
        ".sf-sort-control{display:flex;flex-direction:column;align-items:stretch;gap:.35rem;min-width:10.75rem}" +
        ".sf-toolbar .smart-filter__sort-select{width:100%;min-width:10.75rem;max-width:16rem;min-height:2.5rem;padding:.5rem 2rem .5rem .85rem;border:1px solid #111!important;border-radius:8px;background-color:#fff!important;background-image:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath fill='none' stroke='%23111111' stroke-width='1.4' d='M1.2 1.4L6 6.2L10.8 1.4'/%3E%3C/svg%3E\");background-repeat:no-repeat;background-position:right .75rem center;background-size:.7rem;appearance:none!important;-webkit-appearance:none!important}" +
        ".sf-collection-search-host{display:block;width:100%;max-width:100%;margin:0}" +
        ".sf-total-count{margin:0;font-size:.8125em;line-height:1.3;color:#6d6d6d;white-space:nowrap;text-align:right}" +
        ".sf-total-count[hidden],.sf-toolbar__search:not(:has(.smart-filter__collection-search:not([hidden]))){display:none!important}" +
        ".sf-toolbar:not(:has(.sf-toolbar__search:has(.smart-filter__collection-search:not([hidden])))){justify-content:flex-end}" +
        ".sf-sort-host:not(:has(.smart-filter__sort:not([hidden]))){display:none}" +
        ".smart-filter>.smart-filter__collection-search{display:none!important}" +
        ".smart-filter__collection-search--toolbar{display:flex;width:100%;max-width:100%;margin:0}" +
        ".sf-toolbar .smart-filter__collection-search-input{width:100%;max-width:22rem;min-width:0;min-height:2.5rem;padding:.5rem 0!important;border:0!important;border-radius:0!important;background:transparent!important;box-shadow:none!important;outline:none;font:inherit;color:inherit}" +
        ".sf-toolbar .smart-filter__collection-search-input::placeholder{color:#8a8a8a;opacity:1}" +
        ".sf-toolbar input[type=search]::-webkit-search-decoration,.sf-toolbar input[type=search]::-webkit-search-cancel-button{-webkit-appearance:none}" +
        "@media(max-width:749px){.sf-toolbar{flex-wrap:wrap}.sf-toolbar__search{flex:1 1 100%;max-width:none}.sf-toolbar__end{margin-left:auto}}" +
        ".collection-wrapper:has([data-findly-theme-hidden='1']) .main-collection-grid," +
        "results-list:has(> [data-findly-theme-hidden='1']) .main-collection-grid{grid-column:1/-1}" +
        ".sf-collection-layout results-list,.sf-og results-list,.collection-wrapper results-list" +
        "{display:block!important;width:100%;min-width:0}" +
        PRODUCT_GRID_START_CSS +
        ".smart-filter .smart-filter__option input[type=checkbox]," +
        ".smart-filter .smart-filter__option input[type=radio]{" +
        "appearance:none!important;-webkit-appearance:none!important;opacity:1!important;visibility:visible!important;" +
        "position:relative!important;width:16px!important;height:16px!important;min-width:16px!important;margin:2px 0 0!important;" +
        "border:1px solid #cfcfcf!important;display:inline-grid!important;clip:auto!important;transform:none!important}" +
        ".sf-app-grid>.sf-pager,.sf-app-grid>.sf-toolbar,.sf-app-grid>.sf-sort-host,.sf-app-grid>.sf-collection-search-host,.sf-app-grid>.sf-grid-empty{display:block!important;visibility:visible!important}" +
        ".sf-app-grid>:not(.sf-app-card):not(.sf-pager):not(.sf-toolbar):not(.sf-sort-host):not(.sf-collection-search-host):not(.sf-grid-empty){display:none!important}";
      (document.head || document.documentElement).appendChild(bridge);
    }
  }

  function injectCatalogCss() {
    var oldCatalog =
      document.getElementById("findly-catalog-grid-v1") ||
      document.getElementById("findly-catalog-grid-v2") ||
      document.getElementById("findly-catalog-grid-v3") ||
      document.getElementById("findly-catalog-grid-v4") ||
      document.getElementById("findly-catalog-grid-v5") ||
      document.getElementById("findly-catalog-grid-v6") ||
      document.getElementById("findly-catalog-grid-v7");
    if (oldCatalog && oldCatalog.parentNode) oldCatalog.parentNode.removeChild(oldCatalog);
    if (document.getElementById("findly-catalog-grid-v8")) return;
    var catalog = document.createElement("style");
    catalog.id = "findly-catalog-grid-v8";
    catalog.textContent =
      "#" +
      CARD_TRAY_ID +
      "{display:none!important;position:absolute;left:-9999px;width:0;height:0;overflow:hidden}" +
      ".sf-collection-layout results-list,.sf-og results-list,.collection-wrapper results-list" +
      "{display:block!important;width:100%;min-width:0}" +
      PRODUCT_GRID_START_CSS +
      GRID_BUSY_CSS;
    (document.head || document.documentElement).appendChild(catalog);
  }

  function setOwnsGrid(on) {
    var root = document.documentElement;
    if (!root || !root.classList) return;
    if (on) {
      root.classList.add("sf-og");
      stripThemePageParam();
    } else {
      root.classList.remove("sf-og");
    }
  }

  function stripThemePageParam() {
    try {
      var url = new URL(window.location.href);
      if (!url.searchParams.has("page")) return;
      url.searchParams.delete("page");
      history.replaceState(
        history.state,
        "",
        url.pathname + url.search + url.hash,
      );
    } catch (err) {
      /* ignore */
    }
  }

  function fallbackHost() {
    var existing = document.getElementById(HOST_ID);
    if (existing) return existing;
    var main =
      document.querySelector("#MainContent, #main, main, [role='main']") ||
      document.body;
    if (!main) return null;
    var host = document.createElement("div");
    host.id = HOST_ID;
    host.className = "product-grid";
    main.appendChild(host);
    return host;
  }

  function hideEl(node) {
    if (!node || node.nodeType !== 1) return;
    node.hidden = true;
    node.setAttribute("data-smart-filter-hidden", "true");
    node.style.setProperty("display", "none", "important");
  }

  function showEl(node) {
    if (!node || node.nodeType !== 1) return;
    node.hidden = false;
    node.removeAttribute("hidden");
    node.removeAttribute("data-smart-filter-hidden");
    if (node.classList) node.classList.remove("hidden");
    node.style.removeProperty("display");
  }

  function restoreThemeHidden(node) {
    if (!node || node.nodeType !== 1) return;
    if (node.getAttribute("data-findly-theme-hidden") !== "1") return;
    var prev = node.getAttribute("data-findly-theme-display");
    node.removeAttribute("data-findly-theme-hidden");
    node.removeAttribute("data-findly-theme-display");
    node.removeAttribute("hidden");
    if (node.classList) node.classList.remove("hidden");
    node.hidden = false;
    if (prev) node.style.display = prev;
    else node.style.removeProperty("display");
  }

  function countThemeCards(parent) {
    if (!parent || !parent.querySelectorAll) return 0;
    var nodes = parent.querySelectorAll(THEME_CARD_HOST_SELECTOR);
    var count = 0;
    var i;
    for (i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      if (!node || node.nodeType !== 1) continue;
      if (node.classList && node.classList.contains("sf-app-card")) continue;
      if (node.closest && node.closest(".sf-app-card")) continue;
      count++;
    }
    return count;
  }

  function hostVisibility(el) {
    if (!el || el.nodeType !== 1) {
      return { visible: false, w: 0, h: 0, display: "" };
    }
    var hidden =
      Boolean(el.hidden) ||
      el.getAttribute("hidden") != null ||
      el.getAttribute("aria-hidden") === "true";
    var w = 0;
    var h = 0;
    var display = "";
    try {
      var rect = el.getBoundingClientRect();
      w = Math.round(rect.width);
      h = Math.round(rect.height);
    } catch (err) {
      /* ignore */
    }
    try {
      if (typeof window.getComputedStyle === "function") {
        display = String(window.getComputedStyle(el).display || "");
      }
    } catch (err2) {
      /* ignore */
    }
    return {
      visible: !hidden && display !== "none" && w >= 40,
      w: w,
      h: h,
      display: display,
    };
  }

  function findResultsList() {
    var nodes = document.querySelectorAll(RESULTS_LIST_SELECTOR);
    var fallback = null;
    var i;
    for (i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (!el || el.nodeType !== 1) continue;
      if (
        el.closest &&
        el.closest(
          "header, footer, product-recommendations, .related-products, [data-related-products], .recently-viewed, .predictive-search, .quick-add-modal",
        )
      ) {
        continue;
      }
      var vis = hostVisibility(el);
      if (vis.visible) return el;
      if (!fallback) fallback = el;
    }
    return fallback;
  }

  function isResultsListEl(el) {
    if (!el || el.nodeType !== 1) return false;
    var tag = String(el.tagName || "").toLowerCase();
    if (tag === "results-list") return true;
    return Boolean(el.matches && el.matches(RESULTS_LIST_SELECTOR));
  }

  function pickBetterGridHost(parent) {
    var parentVis = hostVisibility(parent);
    var best = parent;
    var bestCount = countThemeCards(parent);
    var bestVis = parentVis.visible;
    var candidates = document.querySelectorAll(PRODUCT_GRID_SELECTOR);
    var i;
    for (i = 0; i < candidates.length; i++) {
      var candidate = candidates[i];
      if (!candidate || candidate.nodeType !== 1) continue;
      if (isResultsListEl(candidate) || isThemeManagedGrid(candidate) && isResultsListEl(candidate)) {
        continue;
      }
      var vis = hostVisibility(candidate);
      var themeCount = countThemeCards(candidate);
      if (vis.visible && !bestVis) {
        best = candidate;
        bestCount = themeCount;
        bestVis = true;
        continue;
      }
      if (vis.visible === bestVis && themeCount > bestCount) {
        best = candidate;
        bestCount = themeCount;
      }
    }
    return best;
  }

  function canMoveNode(parent, child) {
    if (!parent || !child || parent === child) return false;
    if (typeof parent.appendChild !== "function") return false;
    if (child.contains && child.contains(parent)) return false;
    return true;
  }

  var THEME_WIDTH_SELECTOR =
    ".page-width:not(.page-width--full), .page-width-desktop, .page-width--narrow, .page-width--compact, .container:not(.container-fluid), .Container, .wrapper, .page-container";

  function isFullBleedHost(el) {
    if (!el || el.nodeType !== 1) return true;
    if (el === document.body || el === document.documentElement) return true;
    var tag = String(el.tagName || "").toLowerCase();
    if (tag === "main" || tag === "body" || tag === "html") return true;
    var id = String(el.id || "");
    if (
      id === "MainContent" ||
      id === "main" ||
      id === "Main" ||
      id === "PageContainer" ||
      id === "PageContent"
    ) {
      return true;
    }
    if (el.getAttribute && el.getAttribute("role") === "main") return true;
    if (el.classList && el.classList.contains("shopify-section")) return true;
    return false;
  }

  function isProductGridLike(el) {
    if (!el || el.nodeType !== 1) return false;
    if (isListHost(el) || isResultsListEl(el)) return true;
    var tag = String(el.tagName || "").toLowerCase();
    if (
      tag === "results-list" ||
      tag === "product-list" ||
      tag === "grid-list" ||
      tag === "ul" ||
      tag === "ol"
    ) {
      return true;
    }
    if (el.id === "product-grid" || el.id === "ProductGrid") return true;
    var cls = el.classList;
    if (!cls) return false;
    return (
      cls.contains("product-grid") ||
      cls.contains("main-collection-grid") ||
      cls.contains("sf-app-grid") ||
      cls.contains("product-grid-container") ||
      cls.contains("collection-wrapper")
    );
  }

  function isThemeWidthContainer(el) {
    if (!el || el.nodeType !== 1 || isFullBleedHost(el)) return false;
    if (!el.classList) return false;
    if (el.classList.contains("sf-collection-layout")) return false;
    if (isProductGridLike(el)) return false;
    if (el.classList.contains("page-width--full")) return false;
    if (
      el.classList.contains("page-width") ||
      el.classList.contains("page-width-desktop") ||
      el.classList.contains("page-width--narrow") ||
      el.classList.contains("page-width--compact")
    ) {
      return true;
    }
    if (el.classList.contains("container") && !el.classList.contains("container-fluid")) {
      return true;
    }
    return (
      el.classList.contains("Container") || el.classList.contains("page-container")
    );
  }

  function closestThemeWidth(el) {
    var node = el;
    var hops = 0;
    while (node && node.nodeType === 1 && hops < 16) {
      if (isThemeWidthContainer(node)) return node;
      if (isFullBleedHost(node)) break;
      node = node.parentElement;
      hops += 1;
    }
    return null;
  }

  function findThemeWidthNearMain(grid) {
    var fromGrid = closestThemeWidth(grid);
    if (fromGrid) return fromGrid;
    var main = document.querySelector(
      "#MainContent, #main, #Main, main, [role='main']",
    );
    var scope = main || document;
    var nodes = [];
    try {
      nodes = scope.querySelectorAll(THEME_WIDTH_SELECTOR);
    } catch (err) {
      nodes = [];
    }
    var i;
    var fallback = null;
    for (i = 0; i < nodes.length; i++) {
      if (!nodes[i] || isFullBleedHost(nodes[i])) continue;
      if (!fallback) fallback = nodes[i];
      if (
        nodes[i].querySelector &&
        nodes[i].querySelector(
          "#product-grid, #ProductGrid, ul.product-grid, ol.product-grid, .main-collection-grid, .sf-app-grid, results-list",
        )
      ) {
        return nodes[i];
      }
    }
    return fallback;
  }

  function themeWidthChildContaining(pageWidth, grid) {
    if (!pageWidth || !grid || grid === pageWidth) return null;
    if (!pageWidth.contains(grid)) return null;
    if (grid.parentElement === pageWidth) return grid;
    var inner = grid;
    var hops = 0;
    while (inner && inner.parentElement && hops < 16) {
      if (inner.parentElement === pageWidth) return inner;
      inner = inner.parentElement;
      hops += 1;
    }
    return null;
  }

  function needsBlockMainWrap(el) {
    if (!el) return false;
    if (isProductGridLike(el)) return true;
    var display = hostDisplay(el);
    if (display === "contents") return true;
    var cls = " " + String(el.className || "") + " ";
    return / collection-wrapper /.test(cls);
  }

  function ensureBlockMain(host) {
    if (!host || !host.parentNode) return host;
    var parent = host.parentNode;
    if (
      parent.classList &&
      parent.classList.contains("sf-collection-layout__main") &&
      !isProductGridLike(parent)
    ) {
      return parent;
    }
    if (isProductGridLike(host) || hostDisplay(host) === "contents") {
      if (host.classList) host.classList.remove("sf-collection-layout__main");
      var gridWrap = document.createElement("div");
      gridWrap.className = "sf-collection-layout__main";
      parent.insertBefore(gridWrap, host);
      gridWrap.appendChild(host);
      return gridWrap;
    }
    if (host.classList && host.classList.contains("sf-collection-layout__main")) {
      return host;
    }
    if (!needsBlockMainWrap(host)) return host;
    var wrap = document.createElement("div");
    wrap.className = "sf-collection-layout__main";
    parent.insertBefore(wrap, host);
    wrap.appendChild(host);
    return wrap;
  }

  function closestCollectionWrapper(el) {
    var node = el;
    var hops = 0;
    while (node && node.nodeType === 1 && hops < 12) {
      if (node.classList && node.classList.contains("collection-wrapper")) {
        return node;
      }
      node = node.parentElement;
      hops += 1;
    }
    return null;
  }

  function wrapInsidePageWidth(pageWidth) {
    if (!pageWidth || isProductGridLike(pageWidth)) return null;
    var existing = null;
    var i;
    for (i = 0; i < pageWidth.children.length; i++) {
      if (
        pageWidth.children[i].classList &&
        pageWidth.children[i].classList.contains("sf-collection-layout")
      ) {
        existing = pageWidth.children[i];
        break;
      }
    }
    if (existing) {
      return (
        existing.querySelector(".sf-collection-layout__main") || existing
      );
    }
    var nested =
      pageWidth.querySelector && pageWidth.querySelector(".sf-collection-layout");
    if (nested) {
      return nested.querySelector(".sf-collection-layout__main") || nested;
    }
    var main = document.createElement("div");
    main.className = "sf-collection-layout__main";
    while (pageWidth.firstChild) main.appendChild(pageWidth.firstChild);
    pageWidth.appendChild(main);
    return main;
  }

  function constrainHostToThemeContainer(host, grid) {
    if (!host) return host;
    var listingShell =
      closestCollectionWrapper(grid) || closestCollectionWrapper(host);
    if (isProductGridLike(host) && listingShell && listingShell.contains(host)) {
      host = listingShell;
    } else if (isProductGridLike(host)) {
      host = host.parentElement || host;
    }
    var pageWidth =
      closestThemeWidth(grid) ||
      (isThemeWidthContainer(host) ? host : closestThemeWidth(host));
    if (pageWidth && isProductGridLike(pageWidth)) pageWidth = null;
    if (!pageWidth) {
      if (listingShell) return ensureBlockMain(listingShell);
      if (isFullBleedHost(host) && grid && host.contains && host.contains(grid)) {
        return ensureBlockMain(host);
      }
      return ensureBlockMain(host);
    }
    if (
      host === pageWidth ||
      isFullBleedHost(host) ||
      isProductGridLike(host) ||
      (host.contains && host.contains(pageWidth) && host !== pageWidth)
    ) {
      var child = themeWidthChildContaining(pageWidth, grid);
      if (!child) {
        var slot = pageWidth.querySelector(
          "#product-grid, #ProductGrid, ul.product-grid, ol.product-grid, .main-collection-grid, .sf-app-grid, results-list",
        );
        child = themeWidthChildContaining(pageWidth, slot);
      }
      if (child && child !== pageWidth && !isThemeWidthContainer(child)) {
        return ensureBlockMain(child);
      }
      return wrapInsidePageWidth(pageWidth) || ensureBlockMain(host);
    }
    return ensureBlockMain(host);
  }

  function liftLayoutOutOfProductGrid(layout) {
    if (!layout || !layout.parentNode) return;
    var guard = 0;
    while (layout.parentNode && isProductGridLike(layout.parentNode) && guard < 8) {
      var gridHost = layout.parentNode;
      var grand = gridHost.parentNode;
      if (!grand) break;
      grand.insertBefore(layout, gridHost);
      var main = null;
      var ci;
      for (ci = 0; ci < layout.children.length; ci++) {
        if (
          layout.children[ci].classList &&
          layout.children[ci].classList.contains("sf-collection-layout__main")
        ) {
          main = layout.children[ci];
          break;
        }
      }
      if (!main) {
        main = document.createElement("div");
        main.className = "sf-collection-layout__main";
        layout.appendChild(main);
      }
      if (gridHost.parentNode === grand && !main.contains(gridHost)) {
        main.appendChild(gridHost);
      }
      if (main.classList) main.classList.add("sf-collection-layout__main");
      guard += 1;
    }
  }

  function normalizeLayoutShell(layout) {
    if (!layout || !layout.children) return;
    var aside = null;
    var main = null;
    var i;
    for (i = 0; i < layout.children.length; i++) {
      var child = layout.children[i];
      if (!child || !child.classList) continue;
      if (child.classList.contains("sf-collection-layout__aside")) aside = child;
      if (child.classList.contains("sf-collection-layout__main")) main = child;
    }
    if (!main) {
      main = document.createElement("div");
      main.className = "sf-collection-layout__main";
      layout.appendChild(main);
    }
    if (main.classList) {
      main.classList.remove("sf-collection-layout__aside");
      main.classList.add("sf-collection-layout__main");
    }
    var nodes = [];
    for (i = 0; i < layout.childNodes.length; i++) nodes.push(layout.childNodes[i]);
    for (i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      if (node === aside || node === main) continue;
      if (node.nodeType !== 1) {
        main.appendChild(node);
        continue;
      }
      if (node.classList && node.classList.contains("sf-collection-layout__aside")) {
        continue;
      }
      main.appendChild(node);
    }
  }

  function applyImportantStyle(el, prop, value) {
    if (!el || !el.style || typeof el.style.setProperty !== "function") return;
    try {
      if (
        el.style.getPropertyValue(prop) === value &&
        el.style.getPropertyPriority(prop) === "important"
      ) {
        return;
      }
      el.style.setProperty(prop, value, "important");
    } catch (err) {
      /* ignore */
    }
  }

  var repairingLayout = false;

  function flattenHorizonCollectionWrapper(layout) {
    if (!layout) return;
    var wrap =
      (layout.closest && layout.closest(".collection-wrapper")) ||
      layout.querySelector(".collection-wrapper");
    if (
      layout.getAttribute &&
      layout.getAttribute("data-sf-horizon-flat") === "1" &&
      wrap &&
      wrap.style &&
      wrap.style.display === "block"
    ) {
      return;
    }
    applyImportantStyle(layout, "width", "100%");
    applyImportantStyle(layout, "max-width", "100%");
    applyImportantStyle(layout, "min-width", "0");
    applyImportantStyle(layout, "grid-column", "1 / -1");

    var hosts = [];
    if (wrap) hosts.push(wrap);
    var list =
      (layout.closest && layout.closest("results-list")) ||
      (layout.closest && layout.closest(".product-grid-container"));
    if (list && hosts.indexOf(list) < 0) hosts.push(list);

    var i;
    for (i = 0; i < hosts.length; i++) {
      applyImportantStyle(hosts[i], "display", "block");
      applyImportantStyle(hosts[i], "grid-template-columns", "none");
      applyImportantStyle(hosts[i], "width", "100%");
      applyImportantStyle(hosts[i], "max-width", "100%");
      applyImportantStyle(hosts[i], "--grid-column--desktop", "minmax(0, 1fr)");
      applyImportantStyle(hosts[i], "--grid-column--mobile", "minmax(0, 1fr)");
      applyImportantStyle(hosts[i], "--centered-column-number", "1");
      if (hosts[i].classList && hosts[i].classList.contains("grid")) {
        applyImportantStyle(hosts[i], "display", "grid");
        applyImportantStyle(hosts[i], "grid-template-columns", "minmax(0, 1fr)");
      }
    }

    var grids = layout.querySelectorAll
      ? layout.querySelectorAll(
          ".main-collection-grid, ul.product-grid, ol.product-grid, .sf-app-grid",
        )
      : [];
    for (i = 0; i < grids.length; i++) {
      applyImportantStyle(grids[i], "width", "100%");
      applyImportantStyle(grids[i], "max-width", "100%");
      applyImportantStyle(grids[i], "min-width", "0");
      applyImportantStyle(grids[i], "grid-column", "1 / -1");
    }

    var pagers = layout.querySelectorAll
      ? layout.querySelectorAll(
          ".sf-pager, .sf-pager__nav, .sf-pager__pages, nav.pagination, .pagination-wrapper",
        )
      : [];
    for (i = 0; i < pagers.length; i++) {
      applyImportantStyle(pagers[i], "display", "flex");
      applyImportantStyle(pagers[i], "flex-direction", "row");
      applyImportantStyle(pagers[i], "flex-wrap", "wrap");
      applyImportantStyle(pagers[i], "width", "100%");
    }
    if (layout.setAttribute) layout.setAttribute("data-sf-horizon-flat", "1");
  }

  function repairCollectionLayout(widget) {
    if (repairingLayout) return;
    repairingLayout = true;
    if (widget) widget._reapplyingGrid = true;
    try {
      var layout = document.querySelector(".sf-collection-layout");
      if (!layout) return;
      if (layout.getAttribute("data-sf-layout-stable") === "1") {
        flattenHorizonCollectionWrapper(layout);
        return;
      }
      var stamped = layout.querySelectorAll(".sf-collection-layout__main");
      var si;
      for (si = 0; si < stamped.length; si++) {
        if (isProductGridLike(stamped[si]) || isThemeManagedGrid(stamped[si])) {
          stamped[si].classList.remove("sf-collection-layout__main");
          ensureBlockMain(stamped[si]);
        }
      }
      liftLayoutOutOfProductGrid(layout);
      normalizeLayoutShell(layout);
      var pageWidth =
        closestThemeWidth(
          (widget && widget._gridParent) || collectionSearchGridEl(widget),
        ) || findThemeWidthNearMain((widget && widget._gridParent) || null);
      if (
        pageWidth &&
        !isProductGridLike(pageWidth) &&
        layout.parentNode &&
        layout.parentNode !== pageWidth &&
        !pageWidth.contains(layout) &&
        !layout.contains(pageWidth)
      ) {
        var grid =
          (widget && widget._gridParent) || collectionSearchGridEl(widget);
        var child = themeWidthChildContaining(pageWidth, grid);
        if (child && child.parentNode === pageWidth) {
          pageWidth.insertBefore(layout, child);
          var mainCol = layout.querySelector(".sf-collection-layout__main");
          if (mainCol && !mainCol.contains(child)) mainCol.appendChild(child);
        }
      }
      normalizeLayoutShell(layout);
      flattenHorizonCollectionWrapper(layout);
      if (layout.setAttribute) layout.setAttribute("data-sf-layout-stable", "1");
    } catch (err) {
      try {
        if (typeof console !== "undefined" && console.warn) {
          console.warn("[Findly] repairCollectionLayout", err);
        }
      } catch (ignore) {}
    } finally {
      repairingLayout = false;
      if (widget) widget._reapplyingGrid = false;
    }
  }

  function scheduleRepairCollectionLayout(widget) {
    if (!widget) {
      repairCollectionLayout(widget);
      return;
    }
    if (widget._repairScheduled) return;
    widget._repairScheduled = true;
    var run = function () {
      widget._repairScheduled = false;
      repairCollectionLayout(widget);
    };
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(run);
    } else {
      setTimeout(run, 0);
    }
  }

  function placeMountOnExistingLayout(existing, mount, position) {
    if (!existing) return existing;
    var alreadyPlaced =
      mount &&
      mount.parentNode === existing &&
      (position === "right"
        ? existing.lastElementChild === mount
        : existing.firstElementChild === mount);
    if (alreadyPlaced) {
      if (mount.classList) mount.classList.add("sf-collection-layout__aside");
      if (existing.classList) {
        var next = position || "left";
        existing.classList.add("sf-collection-layout");
        existing.classList.remove(
          "sf-collection-layout--left",
          "sf-collection-layout--right",
          "sf-collection-layout--top",
          "sf-collection-layout--offcanvas",
        );
        existing.classList.add("sf-collection-layout--" + next);
      }
      return existing;
    }
    existing = stampLayoutPosition(existing, position) || existing;
    if (mount && mount.classList) {
      mount.classList.add("sf-collection-layout__aside");
    }
    if (!mount) return existing;
    if (existing.contains(mount) && mount.parentNode !== existing) {
      return existing;
    }
    if (position === "right") {
      if (existing.lastChild !== mount) existing.appendChild(mount);
    } else if (existing.firstChild !== mount) {
      existing.insertBefore(mount, existing.firstChild);
    }
    return existing;
  }

  function armFilterReadyFailsafe() {
    if (window.__findlyReadyFailsafe) return;
    window.__findlyReadyFailsafe = window.setTimeout(function () {
      window.__findlyReadyFailsafe = 0;
      try {
        paintGridBusy(null, false);
      } catch (err) {
        setFilterLoading(false);
      }
    }, 2500);
  }

  function fitLayoutIntoThemeContainer(widget) {
    var layout = document.querySelector(".sf-collection-layout");
    if (!layout || !layout.parentNode) return;
    repairCollectionLayout(widget);
    layout = document.querySelector(".sf-collection-layout");
    if (!layout || !layout.parentNode) return;
    var grid =
      (widget && widget._gridParent) || collectionSearchGridEl(widget);
    var pageWidth = closestThemeWidth(grid) || findThemeWidthNearMain(grid);
    if (!pageWidth || isProductGridLike(pageWidth)) return;
    if (pageWidth.contains(layout) && layout !== pageWidth) {
      normalizeLayoutShell(layout);
      return;
    }

    if (layout.contains(pageWidth)) {
      var parent = layout.parentNode;
      if (!parent) return;
      parent.insertBefore(pageWidth, layout);
      if (pageWidth.classList) {
        pageWidth.classList.remove("sf-collection-layout__main");
      }
      var nestedMain = document.createElement("div");
      nestedMain.className = "sf-collection-layout__main";
      while (pageWidth.firstChild) nestedMain.appendChild(pageWidth.firstChild);
      pageWidth.appendChild(layout);
      layout.appendChild(nestedMain);
      var aside =
        layout.querySelector(".sf-collection-layout__aside") ||
        (widget && widget.root);
      if (aside && aside.parentNode === layout && layout.firstChild !== aside) {
        layout.insertBefore(aside, layout.firstChild);
      }
      normalizeLayoutShell(layout);
      return;
    }

    var child = themeWidthChildContaining(pageWidth, grid);
    if (child && child.parentNode === pageWidth && !isThemeWidthContainer(child)) {
      pageWidth.insertBefore(layout, child);
      var mainCol = layout.querySelector(".sf-collection-layout__main");
      if (mainCol && !mainCol.contains(child) && child.parentNode === pageWidth) {
        mainCol.appendChild(child);
      } else if (!mainCol) {
        var wrapped = ensureBlockMain(child);
        if (wrapped.parentNode !== layout) layout.appendChild(wrapped);
      }
      normalizeLayoutShell(layout);
      return;
    }
    var slot = pageWidth.querySelector(
      "#product-grid, #ProductGrid, ul.product-grid, ol.product-grid, .main-collection-grid, .sf-app-grid",
    );
    var before = themeWidthChildContaining(pageWidth, slot) || pageWidth.firstChild;
    if (before && before.parentNode === pageWidth) {
      pageWidth.insertBefore(layout, before);
    } else {
      pageWidth.appendChild(layout);
    }
    if (slot && !layout.contains(slot)) {
      var col = layout.querySelector(".sf-collection-layout__main");
      var move = themeWidthChildContaining(pageWidth, slot) || slot;
      if (col && move && !col.contains(move)) col.appendChild(move);
    }
    liftLayoutOutOfProductGrid(layout);
    normalizeLayoutShell(layout);
  }

  function isLayoutUnsafeHost(el) {
    if (!el || el.nodeType !== 1) return false;
    if (el.classList && el.classList.contains("sf-collection-layout")) {
      return false;
    }
    if (isResultsListEl(el) || isListHost(el) || isThemeManagedGrid(el)) {
      return true;
    }
    var cls = " " + String(el.className || "") + " ";
    return / collection-wrapper | main-collection-grid /.test(cls);
  }

  function liftFragileLayout(el, position) {
    if (!el || !el.parentNode) return el;
    var parent = el.parentNode;
    var pos = position || "left";
    var main;
    if (el.classList) {
      el.classList.remove(
        "sf-collection-layout",
        "sf-collection-layout--left",
        "sf-collection-layout--right",
        "sf-collection-layout--top",
        "sf-collection-layout--offcanvas",
        "sf-collection-layout__main",
      );
    }
    if (parent.classList && parent.classList.contains("sf-collection-layout")) {
      parent.classList.remove(
        "sf-collection-layout--left",
        "sf-collection-layout--right",
        "sf-collection-layout--top",
        "sf-collection-layout--offcanvas",
      );
      parent.classList.add("sf-collection-layout");
      parent.classList.add("sf-collection-layout--" + pos);
      if (isProductGridLike(el) || isThemeManagedGrid(el) || isLayoutUnsafeHost(el)) {
        main = ensureBlockMain(el);
        if (main.parentNode !== parent) parent.appendChild(main);
        return parent;
      }
      el.classList.add("sf-collection-layout__main");
      return parent;
    }
    var wrapper = document.createElement("div");
    parent.insertBefore(wrapper, el);
    main = document.createElement("div");
    main.className = "sf-collection-layout__main";
    wrapper.appendChild(main);
    main.appendChild(el);
    wrapper.classList.add("sf-collection-layout");
    wrapper.classList.add("sf-collection-layout--" + pos);
    return wrapper;
  }

  function stampLayoutPosition(el, position) {
    if (!el || !el.classList) return el;
    if (isLayoutUnsafeHost(el)) {
      return liftFragileLayout(el, position);
    }
    var next = position || "left";
    el.classList.add("sf-collection-layout");
    el.classList.remove(
      "sf-collection-layout--left",
      "sf-collection-layout--right",
      "sf-collection-layout--top",
      "sf-collection-layout--offcanvas",
    );
    el.classList.add("sf-collection-layout--" + next);
    return el;
  }

  function hostDisplay(el) {
    try {
      if (typeof window.getComputedStyle === "function") {
        return String(window.getComputedStyle(el).display || "");
      }
    } catch (err) {
      /* ignore */
    }
    return "";
  }

  function isThemeManagedGrid(el) {
    if (!el) return false;
    if (el.classList && el.classList.contains("sf-collection-layout")) {
      return false;
    }
    if (isResultsListEl(el)) return true;
    var display = hostDisplay(el);
    return (
      display === "contents" ||
      display === "grid" ||
      display === "inline-grid"
    );
  }

  function isSkippedCardRegion(el) {
    if (!el || !el.closest) return false;
    return Boolean(
      el.closest(
        "header, footer, product-recommendations, .related-products, [data-related-products], .recently-viewed, .predictive-search, .quick-add-modal",
      ),
    );
  }

  function gridHasProductLinks(el) {
    if (!el || !el.querySelector) return false;
    return Boolean(el.querySelector('a[href*="/products/"]'));
  }

  function isInnerCardSlice(el) {
    if (!el || el.nodeType !== 1) return false;
    var tag = String(el.tagName || "").toLowerCase();
    if (tag === "a") {
      var aCls = el.classList;
      if (
        aCls &&
        (aCls.contains("product-card") ||
          aCls.contains("card-wrapper") ||
          aCls.contains("grid-view-item") ||
          aCls.contains("product-grid-item") ||
          aCls.contains("product-item"))
      ) {
        return false;
      }
      if (el.querySelector && el.querySelector("img, picture, video")) {
        return false;
      }
      return true;
    }
    if (
      tag === "h1" ||
      tag === "h2" ||
      tag === "h3" ||
      tag === "h4" ||
      tag === "h5" ||
      tag === "h6" ||
      tag === "p" ||
      tag === "span" ||
      tag === "img" ||
      tag === "picture" ||
      tag === "button" ||
      tag === "svg"
    ) {
      return true;
    }
    var cls = " " + String(el.className || "") + " ";
    return (
      / card__inner | card__content | card__media | card__information | card__heading | card-information | full-unstyled-link | media-wrapper | card__text | product-item__info | product-card__image | product-card__content | product-card__info | product-card__title | productitem--info | grid-view-item__link | product-block__image | card__details /.test(
        cls,
      ) &&
      tag !== "product-card" &&
      tag !== "li"
    );
  }

  function isGridHostEl(el) {
    if (!el || el.nodeType !== 1) return false;
    if (isResultsListEl(el)) return true;
    if (el.id === "product-grid" || el.id === "ProductGrid") return true;
    try {
      return Boolean(el.matches && el.matches(PRODUCT_GRID_SELECTOR));
    } catch (err) {
      return false;
    }
  }

  function isGridChrome(el) {
    if (!el || el.nodeType !== 1) return false;
    var tag = String(el.tagName || "").toLowerCase();
    if (
      tag === "nav" ||
      tag === "script" ||
      tag === "style" ||
      tag === "link" ||
      tag === "noscript"
    ) {
      return true;
    }
    if (el.id === CARD_TRAY_ID || el.id === EMPTY_ID) return true;
    if (el.getAttribute && el.getAttribute(SKEL_ATTR) === "1") return true;
    var cls = el.classList;
    if (!cls) return false;
    return (
      cls.contains("sf-toolbar") ||
      cls.contains("sf-sort-host") ||
      cls.contains("sf-collection-search-host") ||
      cls.contains("sf-total-count") ||
      cls.contains("sf-pager") ||
      cls.contains("pagination") ||
      cls.contains("facets-container") ||
      cls.contains("smart-filter") ||
      cls.contains("sf-grid-empty")
    );
  }

  function countStrictDescendantCards(el) {
    if (!el || !el.querySelectorAll) return 0;
    try {
      return el.querySelectorAll(STRICT_CARD_SELECTOR).length;
    } catch (err) {
      return 0;
    }
  }

  function isLayoutShell(el) {
    if (!el || el.nodeType !== 1) return false;
    var tag = String(el.tagName || "").toLowerCase();
    if (
      tag === "results-list" ||
      tag === "collection-wrapper" ||
      tag === "product-list" ||
      tag === "main"
    ) {
      return true;
    }
    var cls = el.classList;
    if (cls) {
      if (cls.contains("collection-wrapper")) return true;
      if (cls.contains("main-collection-grid")) return true;
      if (cls.contains("product-grid-container")) return true;
      if (cls.contains("collection-grid")) return true;
    }
    if (isResultsListEl(el) || isGridHostEl(el)) return true;
    if (
      tag !== "product-card" &&
      tag !== "product-item" &&
      tag !== "grid-item" &&
      tag !== "li" &&
      tag !== "article" &&
      countStrictDescendantCards(el) >= 2
    ) {
      return true;
    }
    return false;
  }

  function isOuterThemeCard(el) {
    if (!el || el.nodeType !== 1) return false;
    if (el.classList && el.classList.contains("sf-app-card")) return true;
    if (isLayoutShell(el)) return false;
    if (isInnerCardSlice(el)) return false;
    var tag = String(el.tagName || "").toLowerCase();
    if (tag === "a") return false;
    if (
      tag === "product-card" ||
      tag === "product-item" ||
      tag === "grid-item"
    ) {
      return true;
    }
    if (el.classList) {
      if (el.classList.contains("product-card")) return true;
      if (el.classList.contains("grid__item")) return true;
      if (el.classList.contains("product-grid__item")) return true;
      if (el.classList.contains("product-item")) return true;
      if (el.classList.contains("grid-product")) return true;
      if (el.classList.contains("grid-view-item")) return true;
      if (el.classList.contains("product-block")) return true;
      if (el.classList.contains("productitem")) return true;
    }
    return false;
  }

  var OUTER_CARD_SEL =
    "product-card, product-item, grid-item, li.grid__item, li.product-grid__item, " +
    ".grid__item, .product-grid__item, .product-card, .product-item, .grid-product, " +
    ".grid-view-item, .product-block, .productitem, .sf-app-card";

  function resolveOuterThemeCard(el) {
    if (!el || el.nodeType !== 1) return null;
    if (isOuterThemeCard(el)) return el;
    if (!el.closest) return null;
    var outer = el.closest(OUTER_CARD_SEL);
    if (outer && isOuterThemeCard(outer)) return outer;
    return null;
  }

  function isOrphanProductNode(el) {
    if (!el || el.nodeType !== 1) return false;
    if (isLayoutShell(el) || isGridChrome(el)) return false;
    if (el.classList && el.classList.contains("sf-app-card")) return false;
    if (isOuterThemeCard(el)) return false;
    return Boolean(handleFromCard(el));
  }

  function promoteToGridHost(el) {
    if (!el || el.nodeType !== 1) return el;
    if (isInnerCardSlice(el) && el.closest) {
      var fromSlice = el.closest(
        RESULTS_LIST_SELECTOR + ", " + PRODUCT_GRID_SELECTOR,
      );
      if (
        fromSlice &&
        gridHasProductLinks(fromSlice) &&
        !isSkippedCardRegion(fromSlice)
      ) {
        return fromSlice;
      }
    }
    if (el.closest) {
      var grid = el.closest(
        RESULTS_LIST_SELECTOR + ", " + PRODUCT_GRID_SELECTOR,
      );
      if (grid && gridHasProductLinks(grid) && !isSkippedCardRegion(grid)) {
        return grid;
      }
    }
    if (isGridHostEl(el) && gridHasProductLinks(el) && !isSkippedCardRegion(el)) {
      return el;
    }
    if (gridHasProductLinks(el) && !isSkippedCardRegion(el) && !isInnerCardSlice(el)) {
      return el;
    }
    return el;
  }

  function findThemeCardParent(hint) {
    var skip =
      "header, footer, product-recommendations, .related-products, [data-related-products], .recently-viewed, .predictive-search, .quick-add-modal";
    if (hint && hint.nodeType === 1) {
      var promoted = promoteToGridHost(hint);
      if (promoted && gridHasProductLinks(promoted) && !isSkippedCardRegion(promoted)) {
        return promoted;
      }
    }

    var cards = document.querySelectorAll(
      "main product-card, main .product-card, main .product-item, main .grid-product, " +
        RESULTS_LIST_SELECTOR +
        " product-card, " +
        RESULTS_LIST_SELECTOR +
        " .product-card, " +
        RESULTS_LIST_SELECTOR +
        " .product-item",
    );
    var i;
    for (i = 0; i < cards.length; i++) {
      var card = cards[i];
      if (!card || card.nodeType !== 1) continue;
      if (card.classList && card.classList.contains("sf-app-card")) continue;
      if (card.closest && card.closest(skip)) continue;
      if (card.parentElement) return promoteToGridHost(card.parentElement);
    }

    var grids = document.querySelectorAll(
      PRODUCT_GRID_SELECTOR + ", " + RESULTS_LIST_SELECTOR,
    );
    var g;
    var fallbackGrid = null;
    for (g = 0; g < grids.length; g++) {
      var grid = grids[g];
      if (!grid || grid.nodeType !== 1) continue;
      if (isSkippedCardRegion(grid)) continue;
      if (!gridHasProductLinks(grid)) continue;
      var vis = hostVisibility(grid);
      if (vis.visible || vis.w >= 40) return grid;
      if (!fallbackGrid) fallbackGrid = grid;
    }
    if (fallbackGrid) return fallbackGrid;

    var link = document.querySelector(
      "main a[href*='/products/'], #MainContent a[href*='/products/'], .product-grid-container a[href*='/products/']",
    );
    if (link && !isSkippedCardRegion(link)) {
      var item =
        (link.closest &&
          link.closest(
            "li.grid__item, li.product-grid__item, product-card, .product-card, .product-item, .grid-product, .grid-view-item, .product-block",
          )) ||
        link.parentElement;
      if (item && item.parentElement && !isSkippedCardRegion(item.parentElement)) {
        return promoteToGridHost(item.parentElement);
      }
    }

    return findResultsList();
  }

  function handleFromHref(href) {
    if (!href) return "";
    try {
      var match = String(href).match(/\/products\/([^/?#]+)/i);
      return match ? decodeURIComponent(match[1]).toLowerCase() : "";
    } catch (err) {
      return "";
    }
  }

  function firstProductLink(root) {
    if (!root) return null;
    var link = root.querySelector && root.querySelector('a[href*="/products/"]');
    if (link) return link;
    if (root.shadowRoot) {
      link = firstProductLink(root.shadowRoot);
      if (link) return link;
    }
    if (!root.querySelectorAll) return null;
    var nodes = root.querySelectorAll("*");
    var i;
    for (i = 0; i < nodes.length; i++) {
      if (nodes[i].shadowRoot) {
        link = firstProductLink(nodes[i].shadowRoot);
        if (link) return link;
      }
    }
    return null;
  }

  function handleFromCard(card) {
    if (!card || card.nodeType !== 1) return "";
    var attrs = [
      "data-product-handle",
      "data-handle",
      "handle",
      "data-sf-card-key",
    ];
    var a;
    for (a = 0; a < attrs.length; a++) {
      var raw = card.getAttribute && card.getAttribute(attrs[a]);
      if (raw) return String(raw).split("::")[0].toLowerCase();
    }
    var link = firstProductLink(card);
    if (link) return handleFromHref(link.getAttribute("href"));
    if (card.tagName && String(card.tagName).toLowerCase() === "a") {
      return handleFromHref(card.getAttribute("href"));
    }
    return "";
  }

  function allowedHandleSet(handles) {
    var set = {};
    if (!handles) return null;
    var i;
    for (i = 0; i < handles.length; i++) {
      var key = String(handles[i] || "").toLowerCase();
      if (!key) continue;
      set[key] = true;
      var base = key.split("::")[0];
      if (base) set[base] = true;
    }
    return set;
  }

  function showCardTree(card) {
    showEl(card);
    restoreThemeHidden(card);
    if (!card || !card.querySelectorAll) return;
    var hidden = card.querySelectorAll(
      "[data-smart-filter-hidden='true'], [data-findly-theme-hidden='1']",
    );
    var i;
    for (i = 0; i < hidden.length; i++) {
      showEl(hidden[i]);
      restoreThemeHidden(hidden[i]);
    }
  }

  function stripAppCards(root) {
    var scope = root || document;
    if (!scope.querySelector || !scope.querySelector(".sf-app-card")) return;
    var nodes = scope.querySelectorAll(".sf-app-card");
    var i;
    for (i = 0; i < nodes.length; i++) {
      if (nodes[i].parentNode) nodes[i].parentNode.removeChild(nodes[i]);
    }
    var grids = scope.querySelectorAll
      ? scope.querySelectorAll(".sf-app-grid")
      : [];
    for (i = 0; i < grids.length; i++) {
      if (grids[i].classList) grids[i].classList.remove("sf-app-grid");
    }
    setOwnsGrid(false);
  }

  function onlyContentShellChild(parent) {
    if (!parent || !parent.children) return null;
    var shells = [];
    var i;
    for (i = 0; i < parent.children.length; i++) {
      var child = parent.children[i];
      if (!child || child.nodeType !== 1) continue;
      if (isGridChrome(child)) continue;
      if (isInnerCardSlice(child) && !handleFromCard(child)) continue;
      if (isLayoutShell(child) && gridHasProductLinks(child)) shells.push(child);
    }
    return shells.length === 1 ? shells[0] : null;
  }

  function resolveCardHost(hint) {
    var start = findThemeCardParent(hint) || hint;
    if (!start || start.nodeType !== 1) return start;
    var selfGrid =
      start.classList && start.classList.contains("main-collection-grid")
        ? start
        : null;
    var nestedGrid =
      (start.querySelector && start.querySelector(".main-collection-grid")) ||
      null;
    var preferred = selfGrid || nestedGrid;
    if (preferred && collectDirectThemeCards(preferred).length) return preferred;

    var nestedProductGrid =
      start.querySelector && start.querySelector(PRODUCT_GRID_SELECTOR);
    if (
      nestedProductGrid &&
      nestedProductGrid !== start &&
      collectDirectThemeCards(nestedProductGrid).length
    ) {
      return nestedProductGrid;
    }

    var guard = 0;
    while (start && guard < 8) {
      guard += 1;
      var cards = collectDirectThemeCards(start);
      var real = 0;
      var i;
      for (i = 0; i < cards.length; i++) {
        if (!cards[i].orphan) real += 1;
      }
      var inner =
        (start.querySelector &&
          (start.querySelector(".main-collection-grid") ||
            start.querySelector(PRODUCT_GRID_SELECTOR) ||
            start.querySelector(RESULTS_LIST_SELECTOR))) ||
        null;
      var only = onlyContentShellChild(start);
      if (isLayoutShell(start) && inner && inner !== start && real < 2) {
        start = inner;
        continue;
      }
      if (real >= 1) return start;
      if (inner && inner !== start && !isOuterThemeCard(inner)) {
        start = inner;
        continue;
      }
      if (only && only !== start) {
        start = only;
        continue;
      }
      break;
    }
    return start;
  }

  function collectDirectThemeCards(parent) {
    var cards = [];
    if (!parent || !parent.children) return cards;
    var i;
    for (i = 0; i < parent.children.length; i++) {
      var child = parent.children[i];
      if (!child || child.nodeType !== 1) continue;
      if (child.id === CARD_TRAY_ID || child.id === EMPTY_ID) continue;
      if (isGridChrome(child)) continue;
      if (isLayoutShell(child)) continue;
      if (isOuterThemeCard(child)) {
        cards.push({ el: child, handle: handleFromCard(child), orphan: false });
        continue;
      }
      if (isOrphanProductNode(child)) {
        cards.push({ el: child, handle: handleFromCard(child), orphan: true });
      }
    }
    return cards;
  }

  function collectThemeCards(parent) {
    parent = resolveCardHost(parent) || parent;
    var cards = collectDirectThemeCards(parent);
    var seen = typeof WeakSet !== "undefined" ? new WeakSet() : null;
    var i;
    function add(el, handle, orphan) {
      if (!el || el.nodeType !== 1) return;
      if (seen) {
        if (seen.has(el)) return;
        seen.add(el);
      } else {
        var d;
        for (d = 0; d < cards.length; d++) if (cards[d].el === el) return;
      }
      cards.push({
        el: el,
        handle: handle || handleFromCard(el),
        orphan: Boolean(orphan),
      });
    }
    for (i = 0; i < cards.length; i++) {
      if (seen) seen.add(cards[i].el);
    }
    var root = parent && parent.parentElement;
    var guard = 0;
    while (root && isLayoutShell(root) && guard < 4) {
      guard += 1;
      var kids = root.children;
      var k;
      for (k = 0; k < kids.length; k++) {
        var child = kids[k];
        if (!child || child === parent || isLayoutShell(child) || isGridChrome(child)) {
          continue;
        }
        if (isOuterThemeCard(child)) add(child, handleFromCard(child), false);
        else if (isOrphanProductNode(child)) add(child, handleFromCard(child), true);
      }
      root = root.parentElement;
    }
    if (cards.length) return cards;
    if (!parent || !parent.querySelector) return cards;
    var inner =
      parent.querySelector(".main-collection-grid") ||
      parent.querySelector(PRODUCT_GRID_SELECTOR) ||
      parent.querySelector(RESULTS_LIST_SELECTOR);
    if (inner && inner !== parent && !isSkippedCardRegion(inner)) {
      cards = collectDirectThemeCards(inner);
    }
    return cards;
  }

  function cardTray() {
    var el = document.getElementById(CARD_TRAY_ID);
    if (el) return el;
    el = document.createElement("div");
    el.id = CARD_TRAY_ID;
    el.hidden = true;
    el.setAttribute("aria-hidden", "true");
    el.style.setProperty("display", "none", "important");
    el.style.setProperty("position", "absolute");
    el.style.setProperty("left", "-9999px");
    (document.body || document.documentElement).appendChild(el);
    return el;
  }

  function collectTrayAndGridCards(parent) {
    var items = collectThemeCards(parent);
    var tray = document.getElementById(CARD_TRAY_ID);
    var seen = typeof WeakSet !== "undefined" ? new WeakSet() : null;
    var out = [];
    var i;
    function add(el, handle, orphan) {
      if (!el || el.nodeType !== 1) return;
      if (seen) {
        if (seen.has(el)) return;
        seen.add(el);
      } else {
        var d;
        for (d = 0; d < out.length; d++) if (out[d].el === el) return;
      }
      out.push({
        el: el,
        handle: handle || handleFromCard(el),
        orphan: Boolean(orphan),
      });
    }
    for (i = 0; i < items.length; i++) {
      add(items[i].el, items[i].handle, items[i].orphan);
    }
    if (tray && tray.children) {
      for (i = 0; i < tray.children.length; i++) {
        var child = tray.children[i];
        add(child, handleFromCard(child), !isOuterThemeCard(child));
      }
    }
    return out;
  }

  function placeCardInGrid(parent, el) {
    if (!parent || !el) return;
    var outer = resolveOuterThemeCard(el);
    if (!outer) {
      if (isOrphanProductNode(el)) {
        var tray = cardTray();
        if (tray && el.parentNode !== tray) tray.appendChild(el);
      }
      return;
    }
    el = outer;
    var chrome = null;
    var kids = parent.children;
    var i;
    for (i = 0; i < kids.length; i++) {
      var kid = kids[i];
      var cls = kid.classList;
      var tag = String(kid.tagName || "").toLowerCase();
      if (
        (cls &&
          (cls.contains("sf-toolbar") ||
            cls.contains("sf-sort-host") ||
            cls.contains("sf-collection-search-host") ||
            cls.contains("sf-total-count") ||
            cls.contains("sf-pager") ||
            cls.contains("pagination"))) ||
        tag === "nav"
      ) {
        chrome = kid;
        break;
      }
    }
    if (el.parentNode === parent) {
      if (chrome && el.nextSibling === chrome) return;
      if (!chrome && el === parent.lastElementChild) return;
    }
    if (chrome && el !== chrome) parent.insertBefore(el, chrome);
    else parent.appendChild(el);
  }

  function attachOrphanToShown(orphanEl, handle, shownCards) {
    if (!orphanEl || !handle || !shownCards) return false;
    var i;
    for (i = 0; i < shownCards.length; i++) {
      var card = shownCards[i];
      if (!card || card.orphan || !card.el || card.el === orphanEl) continue;
      if (card.handle === handle) {
        if (card.el.contains && !card.el.contains(orphanEl)) {
          card.el.appendChild(orphanEl);
        }
        return true;
      }
    }
    return false;
  }

  function sweepHostOrphans(host, shownEls, allowed, tray) {
    if (!host || !host.querySelectorAll || !tray || !allowed) return;
    if (!shownEls || !shownEls.length) return;
    var links = host.querySelectorAll('a[href*="/products/"]');
    var i;
    var s;
    for (i = 0; i < links.length; i++) {
      var link = links[i];
      if (isSkippedCardRegion(link)) continue;
      if (tray.contains && tray.contains(link)) continue;
      var inside = false;
      for (s = 0; s < shownEls.length; s++) {
        if (!shownEls[s]) continue;
        if (shownEls[s] === link) {
          inside = true;
          break;
        }
        if (shownEls[s].contains && shownEls[s].contains(link)) {
          inside = true;
          break;
        }
      }
      if (inside) continue;
      var handle = handleFromHref(link.getAttribute && link.getAttribute("href"));
      if (allowed && handle && allowed[handle]) {
        var attached = false;
        for (s = 0; s < shownEls.length; s++) {
          if (!shownEls[s] || shownEls[s] === link) continue;
          if (handleFromCard(shownEls[s]) === handle) {
            if (shownEls[s].contains && !shownEls[s].contains(link)) {
              shownEls[s].appendChild(link);
            }
            attached = true;
            break;
          }
        }
        if (!attached) tray.appendChild(link);
      } else {
        tray.appendChild(link);
      }
    }
  }

  function isBusyPainted() {
    return Boolean(
      document.getElementById("findly-grid-busy-overlay") ||
        document.querySelector("[" + SKEL_ATTR + "='1']"),
    );
  }

  function discoverBusyHost(hint) {
    var parent =
      hint ||
      document.querySelector(PRODUCT_GRID_SELECTOR) ||
      findResultsList();
    var host = resolveCardHost(parent) || parent;
    if (host && isLayoutShell(host) && host.querySelector) {
      var inner =
        host.querySelector(".main-collection-grid") ||
        host.querySelector("#product-grid") ||
        host.querySelector("#ProductGrid") ||
        host.querySelector("ul.product-grid") ||
        host.querySelector("ol.product-grid");
      if (inner) host = inner;
    }
    return host;
  }

  function clearGridSkeletons(host) {
    var scope = host && host.querySelectorAll ? host : document;
    var nodes = scope.querySelectorAll("[" + SKEL_ATTR + "='1']");
    var i;
    for (i = 0; i < nodes.length; i++) {
      if (nodes[i].parentNode) nodes[i].parentNode.removeChild(nodes[i]);
    }
  }

  function mountGridSkeletons(host, count) {
    if (!host || !host.appendChild) return;
    clearGridSkeletons(host);
    var sample = null;
    var i;
    for (i = 0; i < host.children.length; i++) {
      var kid = host.children[i];
      if (!kid || kid.nodeType !== 1) continue;
      if (isGridChrome(kid) || kid.id === CARD_TRAY_ID) continue;
      if (isOuterThemeCard(kid)) {
        sample = kid;
        break;
      }
    }
    var hostTag = String(host.tagName || "").toLowerCase();
    var tag = hostTag === "ul" || hostTag === "ol" ? "LI" : "DIV";
    var sampleTag = sample ? String(sample.tagName || "") : "";
    var className = "";
    if (
      sample &&
      sample.className &&
      sampleTag.indexOf("-") === -1
    ) {
      className = String(sample.className || "");
    }
    var n = count || SKEL_COUNT;
    for (i = 0; i < n; i++) {
      var el = document.createElement(tag);
      el.setAttribute(SKEL_ATTR, "1");
      el.setAttribute("aria-hidden", "true");
      if (className) el.className = className;
      el.innerHTML =
        '<span class="findly-grid-skel__img"></span>' +
        '<span class="findly-grid-skel__line"></span>' +
        '<span class="findly-grid-skel__line is-short"></span>';
      host.appendChild(el);
    }
  }

  function positionBusyOverlay(host, overlay) {
    if (!host || !overlay || !host.getBoundingClientRect) return;
    var rect = host.getBoundingClientRect();
    var vh = window.innerHeight || 800;
    var top = Math.max(0, rect.top);
    overlay.style.top = top + "px";
    overlay.style.left = Math.max(0, rect.left) + "px";
    overlay.style.width = Math.max(160, rect.width) + "px";
    overlay.style.height =
      Math.max(352, Math.min(rect.height || 0, Math.max(120, vh - top))) + "px";
  }

  function removeBusyOverlay() {
    var overlay = document.getElementById("findly-grid-busy-overlay");
    if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
  }

  var busyLayoutBound = false;
  function bindBusyOverlayLayout() {
    if (busyLayoutBound) return;
    busyLayoutBound = true;
    function relayout() {
      var overlay = document.getElementById("findly-grid-busy-overlay");
      if (!overlay) return;
      var host =
        document.querySelector(".findly-grid-is-busy") || discoverBusyHost();
      positionBusyOverlay(host, overlay);
    }
    window.addEventListener("scroll", relayout, true);
    window.addEventListener("resize", relayout);
  }

  function setFilterLoading(on) {
    var root = document.documentElement;
    if (!root || !root.classList) return;
    if (on) {
      root.classList.add("sf-filter-loading");
      root.classList.remove("sf-filter-ready");
    } else {
      root.classList.remove("sf-filter-loading");
      root.classList.add("sf-filter-ready");
    }
  }

  function paintGridBusy(host, on) {
    host = host || discoverBusyHost();
    if (!on) {
      clearGridSkeletons(host);
      if (!host) clearGridSkeletons(document);
      var busyHosts = document.querySelectorAll(".findly-grid-is-busy");
      var b;
      for (b = 0; b < busyHosts.length; b++) {
        busyHosts[b].classList.remove("findly-grid-is-busy");
        busyHosts[b].removeAttribute("aria-busy");
      }
      setFilterLoading(false);
      removeBusyOverlay();
      return;
    }
    setFilterLoading(true);
    if (!host) return;
    var stale = document.querySelectorAll(".findly-grid-is-busy");
    var s;
    for (s = 0; s < stale.length; s++) {
      if (stale[s] === host) continue;
      stale[s].classList.remove("findly-grid-is-busy");
      stale[s].removeAttribute("aria-busy");
      clearGridSkeletons(stale[s]);
    }
    if (host.classList) host.classList.add("findly-grid-is-busy");
    host.setAttribute("aria-busy", "true");
    mountGridSkeletons(host, SKEL_COUNT);
    var overlay = document.getElementById("findly-grid-busy-overlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "findly-grid-busy-overlay";
      overlay.setAttribute("aria-hidden", "true");
      (document.body || document.documentElement).appendChild(overlay);
    }
    positionBusyOverlay(host, overlay);
    bindBusyOverlayLayout();
  }

  function bootEarlyGridBusy(attempt) {
    if (
      !document.getElementById("smart-filter-root") &&
      !document.getElementById("smart-filter-embed")
    ) {
      return;
    }
    armFilterReadyFailsafe();
    var root = document.documentElement;
    if (
      root &&
      root.classList &&
      root.classList.contains("sf-filter-ready") &&
      !isBusyPainted()
    ) {
      return;
    }
    setFilterLoading(true);
    if (isBusyPainted()) return;
    var widget = window.__FINDLY_FILTER_WIDGET;
    if (widget && widget._reqId > 0) return;
    var host = discoverBusyHost();
    if (host) {
      paintGridBusy(host, true);
      return;
    }
    attempt = attempt || 0;
    if (attempt < 24) {
      window.setTimeout(function () {
        bootEarlyGridBusy(attempt + 1);
      }, 80);
    }
  }

  function mountCachedCards(widget, handles, parent) {
    if (!widget || !widget._cardCache || !parent || !handles) return 0;
    var n = 0;
    var i;
    for (i = 0; i < handles.length; i++) {
      var key = String(handles[i] || "").toLowerCase();
      if (!key) continue;
      var card =
        widget._cardCache[key] || widget._cardCache[key.split("::")[0]];
      if (!card || card.nodeType !== 1) continue;
      card = resolveOuterThemeCard(card);
      if (!card) continue;
      widget._cardCache[key] = card;
      placeCardInGrid(parent, card);
      showCardTree(card);
      n += 1;
    }
    return n;
  }

  function uniqueAllowedCount(handles) {
    if (!handles || !handles.length) return 0;
    var seen = {};
    var n = 0;
    var i;
    for (i = 0; i < handles.length; i++) {
      var base = String(handles[i] || "")
        .split("::")[0]
        .toLowerCase();
      if (!base || seen[base]) continue;
      seen[base] = true;
      n += 1;
    }
    return n;
  }

  function countAllowedInHost(parent, handles) {
    if (!parent || !handles) return 0;
    var allowed = allowedHandleSet(handles);
    if (!allowed) return 0;
    var host = resolveCardHost(parent) || parent;
    var cards = collectThemeCards(host);
    var n = 0;
    var i;
    for (i = 0; i < cards.length; i++) {
      if (cards[i].handle && allowed[cards[i].handle]) n += 1;
    }
    return n;
  }

  function syncGridEmptyState(widget, parent, handles, shownCount) {
    if (isBusyPainted() || (widget && widget._importingCards)) return;
    var emptyEl = document.getElementById(EMPTY_ID);
    var filtering =
      widget && widget.hasActiveFilters && widget.hasActiveFilters();
    var none =
      Boolean(filtering) && Array.isArray(handles) && handles.length === 0;
    if (Array.isArray(handles) && handles.length && shownCount === 0) {
      none = false;
    }
    if (!none) {
      if (emptyEl && emptyEl.parentNode) emptyEl.parentNode.removeChild(emptyEl);
      return;
    }
    if (!parent) return;
    if (!emptyEl) {
      emptyEl = document.createElement("div");
      emptyEl.id = EMPTY_ID;
      emptyEl.className = "sf-grid-empty";
      emptyEl.setAttribute("role", "status");
    }
    var title =
      widget && widget.t
        ? widget.t("no_match", "No matching products.")
        : "No matching products.";
    emptyEl.innerHTML =
      '<p class="sf-grid-empty__title"></p><p class="sf-grid-empty__copy"></p>';
    emptyEl.querySelector(".sf-grid-empty__title").textContent = title;
    emptyEl.querySelector(".sf-grid-empty__copy").textContent =
      "Try another filter or clear all filters.";
    if (emptyEl.parentNode !== parent) parent.appendChild(emptyEl);
    findlyLog("grid.empty", { parent: describeHost(parent) });
  }

  function shouldTakeOverThemeCards(widget) {
    if (!widget) return false;
    if (widget.isAppGridMode && widget.isAppGridMode()) return false;
    if (widget.hasActiveFilters && widget.hasActiveFilters()) return true;
    if (widget.collectionQuery) return true;
    if (widget.searchQuery) return true;
    if (
      widget.sortKey &&
      widget.defaultSort &&
      widget.sortKey !== widget.defaultSort
    ) {
      return true;
    }
    return false;
  }

  function fillMissingFilterCards(widget, handles, parent) {
    if (!widget || widget._importingCards || !handles || !handles.length) return;
    if (!shouldTakeOverThemeCards(widget)) return;
    var reqId = widget._reqId;
    parent = resolveCardHost(parent) || parent;
    if (parent) widget._gridParent = parent;
    if (widget.setGridBusy) widget.setGridBusy(true);
    function stale() {
      return widget._reqId !== reqId;
    }
    function finish() {
      if (stale()) return;
      mountCachedCards(widget, handles, parent);
      applyNativeFilterGrid(handles, parent);
      var shown = countAllowedInHost(parent, handles);
      var needed = uniqueAllowedCount(handles);
      if (
        needed > shown &&
        widget.applyAppGrid &&
        !(widget.isAppGridMode && widget.isAppGridMode())
      ) {
        widget._skipPageSlice = true;
        try {
          widget.applyAppGrid(
            { products: widget._lastProducts || [] },
            handles,
            false,
          );
        } finally {
          widget._skipPageSlice = false;
        }
        shown = countAllowedInHost(parent, handles);
        if (widget._shownHandles && widget._shownHandles.length) {
          shown = Math.max(shown, uniqueAllowedCount(widget._shownHandles));
        }
      }
      if (widget.setGridBusy && widget._reqId === reqId) widget.setGridBusy(false);
      if (widget._reqId === reqId) {
        widget._loadingPage = false;
        widget._appending = false;
        if (widget.renderPager) widget.renderPager();
        mountFindlyPager(widget);
      }
      syncGridEmptyState(widget, parent, handles, shown);
    }
    findlyLog("grid.missing", {
      handles: handles.slice ? handles.slice(0, 8) : handles,
      parent: describeHost(parent),
    });
    widget._importingCards = true;
    widget._reapplyingGrid = true;
    var done = function () {
      widget._importingCards = false;
      try {
        finish();
      } finally {
        widget._reapplyingGrid = false;
      }
    };
    if (widget.ensureCardsForHandles) {
      Promise.resolve(widget.ensureCardsForHandles(handles)).then(done, done);
      return;
    }
    done();
  }

  function applyNativeFilterGrid(handles, hint) {
    if (!Array.isArray(handles)) stripAppCards(document);
    var parent = resolveCardHost(hint);
    if (!parent) return false;
    var allowed = Array.isArray(handles) ? allowedHandleSet(handles) : null;
    var cards = collectTrayAndGridCards(parent);
    var tray = cardTray();
    var shown = [];
    var hidden = [];
    var i;
    for (i = 0; i < cards.length; i++) {
      var item = cards[i];
      if (!allowed) {
        shown.push(item);
        continue;
      }
      if (item.handle && allowed[item.handle]) shown.push(item);
      else hidden.push(item);
    }
    if (allowed && handles && handles.length) {
      var rank = {};
      for (i = 0; i < handles.length; i++) {
        rank[String(handles[i] || "").split("::")[0].toLowerCase()] = i;
      }
      shown.sort(function (a, b) {
        var ia = rank[a.handle];
        var ib = rank[b.handle];
        if (ia == null) ia = 9999;
        if (ib == null) ib = 9999;
        return ia - ib;
      });
    }
    var shownHosts = [];
    var expected = [];
    for (i = 0; i < shown.length; i++) {
      if (shown[i].orphan) continue;
      expected.push(shown[i].el);
      shownHosts.push(shown[i].el);
    }
    var existing = [];
    for (i = 0; i < parent.children.length; i++) {
      var kid = parent.children[i];
      if (!kid || kid.nodeType !== 1) continue;
      if (kid.id === CARD_TRAY_ID || isGridChrome(kid)) continue;
      if (!isOuterThemeCard(kid) && !isOrphanProductNode(kid)) continue;
      existing.push(kid);
    }
    var needMove = expected.length !== existing.length;
    if (!needMove) {
      for (i = 0; i < expected.length; i++) {
        if (expected[i] !== existing[i]) {
          needMove = true;
          break;
        }
      }
    }
    for (i = 0; i < expected.length; i++) {
      if (needMove) placeCardInGrid(parent, expected[i]);
      showCardTree(expected[i]);
    }
    if (needMove) {
      for (i = 0; i < shown.length; i++) {
        if (!shown[i].orphan) continue;
        if (
          !attachOrphanToShown(shown[i].el, shown[i].handle, shown) &&
          !attachOrphanToShown(shown[i].el, shown[i].handle, hidden)
        ) {
          if (shown[i].el.parentNode !== tray) tray.appendChild(shown[i].el);
        }
      }
      for (i = 0; i < hidden.length; i++) {
        if (hidden[i].orphan) {
          if (
            !attachOrphanToShown(hidden[i].el, hidden[i].handle, hidden) &&
            !attachOrphanToShown(hidden[i].el, hidden[i].handle, shown)
          ) {
            if (hidden[i].el.parentNode !== tray) tray.appendChild(hidden[i].el);
          }
          continue;
        }
        showCardTree(hidden[i].el);
        if (hidden[i].el.parentNode !== tray) tray.appendChild(hidden[i].el);
      }
      sweepHostOrphans(parent, shownHosts, allowed, tray);
    }
    findlyLog("grid.apply", {
      parent: describeHost(parent),
      allowed: allowed ? Object.keys(allowed).length : null,
      cards: cards.length,
      shown: shownHosts.length,
      hidden: hidden.length,
      needMove: needMove,
      tray: tray && tray.children ? tray.children.length : 0,
      overlay: Boolean(document.getElementById("findly-grid-busy-overlay")),
      busyHosts: document.querySelectorAll(".sf-grid-busy, [aria-busy='true']").length,
      stack: shortStack(),
    });
    return cards.length > 0;
  }

  function applyNativeAfterGrid(self) {
    if (!self) return;
    if (self._importingCards || isBusyPainted()) return;
    if (self.isAppGridMode && self.isAppGridMode()) {
      var parent = self._gridParent;
      if (parent && self.hideNativeGridCards) self.hideNativeGridCards(parent);
      return;
    }
    if (!shouldTakeOverThemeCards(self)) {
      applyNativeFilterGrid(null, self._gridParent);
      return;
    }
    var handles =
      self._visibleHandles && self._visibleHandles.length
        ? self._visibleHandles
        : self._shownHandles;
    if (!handles || !handles.length) {
      applyNativeFilterGrid(handles || [], self._gridParent);
      return;
    }
    applyNativeFilterGrid(handles, self._gridParent);
  }

  function isMobileDrawer() {
    try {
      return window.matchMedia("(max-width: 989px)").matches;
    } catch (err) {
      return window.innerWidth < 990;
    }
  }

  function isOffcanvasPosition(widget) {
    if (!widget) return false;
    if (widget.position === "offcanvas") return true;
    var root = widget.root;
    if (!root) return false;
    if (root.classList && root.classList.contains("smart-filter--offcanvas")) {
      return true;
    }
    return root.getAttribute && root.getAttribute("data-position") === "offcanvas";
  }

  function shouldPortalDrawer(widget) {
    return isMobileDrawer() || isOffcanvasPosition(widget);
  }

  function copyThemeVarsFrom(source, target) {
    if (!source || !target || !target.style) return;
    var names = [
      "--sf-ink",
      "--sf-muted",
      "--sf-border",
      "--sf-surface",
      "--sf-surface-hover",
      "--sf-accent",
      "--sf-accent-soft",
      "--sf-focus",
      "--sf-radius",
      "--sf-space",
      "--sf-gutter",
      "--sf-check-size",
      "--sf-check-radius",
      "--sf-row-pad",
      "--sf-tree-indent",
      "--sf-shadow",
      "--sf-check",
      "--sf-font-body",
      "--sf-font-heading",
    ];
    var cs;
    try {
      cs = window.getComputedStyle(source);
    } catch (err) {
      cs = null;
    }
    var i;
    var name;
    var value;
    for (i = 0; i < names.length; i++) {
      name = names[i];
      value = cs ? cs.getPropertyValue(name) : "";
      if (!value && source.style) value = source.style.getPropertyValue(name);
      if (value) target.style.setProperty(name, value);
    }
  }

  function copyDrawerThemeVars(widget, target) {
    copyThemeVarsFrom(widget && widget.root, target);
  }

  function useCustomSortMenu() {
    try {
      return window.matchMedia("(min-width: 750px)").matches;
    } catch (err) {
      return window.innerWidth >= 750;
    }
  }

  function sortMenuSelect(wrap) {
    if (!wrap || !wrap.querySelector) return null;
    return (
      wrap.querySelector(".smart-filter__sort-select") ||
      wrap.querySelector("[data-sort]")
    );
  }

  function sortMenuEl(wrap) {
    if (!wrap) return null;
    if (wrap._sfSortMenu && wrap._sfSortMenu.isConnected) return wrap._sfSortMenu;
    return wrap.querySelector(".smart-filter__sort-menu");
  }

  function ensureSortTrigger(wrap, select) {
    var trigger = wrap.querySelector(".sf-sort-trigger");
    var control = wrap.querySelector(".sf-sort-control") || wrap;
    if (!trigger) {
      trigger = document.createElement("div");
      trigger.className = "sf-sort-trigger";
    }
    if (trigger.parentNode !== control) {
      if (select && select.parentNode === control) {
        control.insertBefore(trigger, select);
      } else if (control.firstChild) {
        control.insertBefore(trigger, control.firstChild);
      } else {
        control.appendChild(trigger);
      }
    }
    if (select && select.parentNode !== trigger) trigger.appendChild(select);
    return trigger;
  }

  function resetSortMenuPosition(menu) {
    if (!menu || !menu.style) return;
    menu.style.position = "";
    menu.style.top = "";
    menu.style.left = "";
    menu.style.right = "";
    menu.style.bottom = "";
    menu.style.width = "";
    menu.style.minWidth = "";
    menu.style.maxWidth = "";
    menu.style.margin = "";
    menu.style.zIndex = "";
  }

  function closeSortMenu(wrap) {
    if (!wrap) return;
    wrap.classList.remove("is-sort-open");
    var menu = sortMenuEl(wrap);
    if (!menu) return;
    menu.hidden = true;
    menu.classList.remove("is-open");
    menu.classList.remove("is-ported");
    resetSortMenuPosition(menu);
    var trigger = wrap.querySelector(".sf-sort-trigger") || wrap;
    if (menu.parentNode !== trigger) trigger.appendChild(menu);
  }

  function positionSortMenu(wrap, menu) {
    var select = sortMenuSelect(wrap);
    var trigger = wrap.querySelector(".sf-sort-trigger");
    var anchor = select || trigger || wrap;
    var rect = anchor.getBoundingClientRect();
    var viewportW = Math.max(
      document.documentElement.clientWidth || 0,
      window.innerWidth || 0,
    );
    var viewportH = Math.max(
      document.documentElement.clientHeight || 0,
      window.innerHeight || 0,
    );
    var maxWidth = Math.min(288, Math.max(160, viewportW - 24));
    menu.style.minWidth = "0";
    menu.style.width = "max-content";
    menu.style.maxWidth = maxWidth + "px";
    var contentWidth = Math.ceil(
      (menu.scrollWidth || 0) > (menu.offsetWidth || 0)
        ? menu.scrollWidth
        : menu.getBoundingClientRect().width || menu.offsetWidth || 0,
    );
    var width = Math.min(
      Math.max(rect.width || 0, contentWidth, 1),
      maxWidth,
    );
    var left = rect.right - width;
    if (left < 12) left = 12;
    if (left + width > viewportW - 12) {
      left = Math.max(12, viewportW - 12 - width);
    }
    var gap = 4;
    var top = rect.bottom + gap;
    var height = menu.offsetHeight || 0;
    if (height && top + height > viewportH - 12) {
      var above = rect.top - gap - height;
      if (above >= 12) top = above;
    }
    menu.style.position = "fixed";
    menu.style.top = Math.round(top) + "px";
    menu.style.left = Math.round(left) + "px";
    menu.style.right = "auto";
    menu.style.bottom = "auto";
    menu.style.width = Math.round(width) + "px";
    menu.style.minWidth = "0";
    menu.style.maxWidth = maxWidth + "px";
    menu.style.margin = "0";
    menu.style.zIndex = "100060";
  }

  function openSortMenu(wrap, menu) {
    if (!wrap || !menu) return;
    wrap._sfSortMenu = menu;
    copyThemeVarsFrom(wrap, menu);
    if (menu.parentNode !== document.body) {
      document.body.appendChild(menu);
    }
    menu.classList.add("is-ported");
    menu.classList.add("is-open");
    menu.style.visibility = "hidden";
    menu.hidden = false;
    wrap.classList.add("is-sort-open");
    positionSortMenu(wrap, menu);
    menu.style.visibility = "";
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(function () {
        if (wrap.classList.contains("is-sort-open")) positionSortMenu(wrap, menu);
      });
    }
  }

  function bindSortMenuChrome() {
    if (window.__findlySortMenuDoc) return;
    window.__findlySortMenuDoc = true;
    document.addEventListener("click", function (e) {
      var openWrap = document.querySelector(".smart-filter__sort.is-sort-open");
      if (!openWrap) return;
      var menu = sortMenuEl(openWrap);
      if (openWrap.contains(e.target) || (menu && menu.contains(e.target))) {
        return;
      }
      closeSortMenu(openWrap);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape") return;
      var openWrap = document.querySelector(".smart-filter__sort.is-sort-open");
      if (openWrap) closeSortMenu(openWrap);
    });
    window.addEventListener(
      "scroll",
      function () {
        var openWrap = document.querySelector(".smart-filter__sort.is-sort-open");
        if (!openWrap) return;
        var menu = sortMenuEl(openWrap);
        if (menu) positionSortMenu(openWrap, menu);
      },
      true,
    );
  }

  function enhanceSortMenu(widget) {
    var wrap = widget && widget.sortWrap;
    var select = widget && widget.sortEl;
    if (!wrap || !select || wrap.hidden) {
      if (wrap) closeSortMenu(wrap);
      return;
    }
    copyDrawerThemeVars(widget, wrap);
    var trigger = ensureSortTrigger(wrap, select);
    var menu = sortMenuEl(wrap);
    if (!menu) {
      menu = document.createElement("div");
      menu.className = "smart-filter__sort-menu";
      menu.setAttribute("role", "listbox");
      menu.hidden = true;
    }
    wrap._sfSortMenu = menu;
    if (!wrap.classList.contains("is-sort-open") && menu.parentNode !== trigger) {
      trigger.appendChild(menu);
    }
    menu.innerHTML = "";
    Array.prototype.forEach.call(select.options, function (opt) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "smart-filter__sort-option";
      if (opt.selected) btn.className += " is-selected";
      btn.setAttribute("role", "option");
      btn.setAttribute("aria-selected", opt.selected ? "true" : "false");
      btn.textContent = opt.textContent;
      btn.addEventListener("click", function () {
        if (select.value !== opt.value) {
          select.value = opt.value;
          if (typeof select.dispatchEvent === "function") {
            select.dispatchEvent(new Event("change", { bubbles: true }));
          }
        }
        closeSortMenu(wrap);
      });
      menu.appendChild(btn);
    });
    if (select.getAttribute("data-sf-sort-menu") === "1") return;
    select.setAttribute("data-sf-sort-menu", "1");
    wrap.classList.add("smart-filter__sort--has-menu");
    select.addEventListener("mousedown", function (e) {
      if (!useCustomSortMenu()) return;
      e.preventDefault();
      var live = sortMenuEl(wrap) || menu;
      if (wrap.classList.contains("is-sort-open")) closeSortMenu(wrap);
      else openSortMenu(wrap, live);
      try {
        select.focus();
      } catch (err) {
        /* ignore */
      }
    });
    select.addEventListener("keydown", function (e) {
      if (!useCustomSortMenu()) return;
      if (e.key === "Escape") {
        closeSortMenu(wrap);
        return;
      }
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        openSortMenu(wrap, sortMenuEl(wrap) || menu);
      }
    });
    bindSortMenuChrome();
  }

  function decorateCheckMarks(root) {
    if (!root || !root.querySelectorAll) return;
    var labels = root.querySelectorAll(
      ".smart-filter__option:not(.smart-filter__swatch):not(.smart-filter__pill)",
    );
    var i;
    for (i = 0; i < labels.length; i++) {
      var label = labels[i];
      if (!label || label.querySelector(".smart-filter__check")) continue;
      var input = label.querySelector('input[type="checkbox"], input[type="radio"]');
      if (!input) continue;
      var mark = document.createElement("span");
      mark.className = "smart-filter__check";
      mark.setAttribute("aria-hidden", "true");
      if (input.nextSibling) label.insertBefore(mark, input.nextSibling);
      else label.appendChild(mark);
    }
  }

  function toolbarHost() {
    var toolbar = document.querySelector(".sf-toolbar");
    if (toolbar) return toolbar;
    var host = document.querySelector(".sf-sort-host");
    if (host) return host;
    var main = document.querySelector(".sf-collection-layout__main");
    if (!main) {
      var grid = document.querySelector(PRODUCT_GRID_SELECTOR);
      main = grid && grid.parentElement;
    }
    if (!main) return null;
    toolbar = document.createElement("div");
    toolbar.className = "sf-toolbar";
    if (main.firstChild) main.insertBefore(toolbar, main.firstChild);
    else main.appendChild(toolbar);
    return toolbar;
  }

  function portalMobileDrawer(widget) {
    if (!widget || !widget.root) return;
    var panel =
      widget.panelEl || widget.root.querySelector("[data-drawer-panel]");
    var backdrop =
      widget.backdropEl || widget.root.querySelector("[data-drawer-backdrop]");
    var toggle =
      widget.toggleEl || widget.root.querySelector("[data-drawer-toggle]");
    if (!panel) {
      panel = document.querySelector(".smart-filter__panel.sf-drawer-portal");
    }
    if (!backdrop) {
      backdrop = document.querySelector(".smart-filter__backdrop.sf-drawer-portal");
    }
    if (!toggle) {
      toggle = document.querySelector(".smart-filter__toggle--toolbar");
    }
    if (!panel) return;
    if (shouldPortalDrawer(widget)) {
      if (backdrop && backdrop.parentNode !== document.body) {
        backdrop.classList.add("sf-drawer-portal");
        document.body.appendChild(backdrop);
      }
      if (panel.parentNode !== document.body) {
        panel.classList.add("sf-drawer-portal");
        document.body.appendChild(panel);
      }
      copyDrawerThemeVars(widget, panel);
      panel.style.setProperty("width", "min(400px, 88vw)", "important");
      panel.style.setProperty("max-width", "88vw", "important");
      panel.style.setProperty("box-sizing", "border-box", "important");
      decorateCheckMarks(panel);
      if (isMobileDrawer()) {
        var host = toolbarHost();
        if (toggle && host && toggle.parentNode !== host) {
          toggle.classList.add("smart-filter__toggle--toolbar");
          if (host.firstChild) host.insertBefore(toggle, host.firstChild);
          else host.appendChild(toggle);
        }
      } else if (
        toggle &&
        toggle.classList.contains("smart-filter__toggle--toolbar") &&
        widget.root
      ) {
        toggle.classList.remove("smart-filter__toggle--toolbar");
        widget.root.insertBefore(toggle, widget.root.firstChild);
      }
      if (widget.root && widget.root.classList.contains("is-drawer-open")) {
        panel.classList.add("is-open");
        if (backdrop) {
          backdrop.hidden = false;
          backdrop.classList.add("is-open");
        }
        document.documentElement.classList.add("is-sf-drawer-open");
      }
    } else {
      if (panel.classList.contains("sf-drawer-portal")) {
        panel.classList.remove("sf-drawer-portal", "is-open");
        panel.style.removeProperty("width");
        panel.style.removeProperty("max-width");
        panel.style.removeProperty("box-sizing");
        widget.root.appendChild(panel);
      }
      if (backdrop && backdrop.classList.contains("sf-drawer-portal")) {
        backdrop.classList.remove("sf-drawer-portal", "is-open");
        widget.root.insertBefore(backdrop, panel);
      }
      if (toggle && toggle.classList.contains("smart-filter__toggle--toolbar")) {
        toggle.classList.remove("smart-filter__toggle--toolbar");
        widget.root.insertBefore(toggle, widget.root.firstChild);
      }
      document.documentElement.classList.remove("is-sf-drawer-open");
    }
    widget.panelEl = panel;
    widget.backdropEl = backdrop;
    widget.toggleEl = toggle;
  }

  function moveCardsToHost(from, to) {
    if (!from || !to || from === to || !from.querySelectorAll) return to;
    var cards = from.querySelectorAll(".sf-app-card");
    if (!cards.length) return to;
    if (from.classList) from.classList.remove("sf-app-grid");
    var i;
    for (i = 0; i < cards.length; i++) {
      if (canMoveNode(to, cards[i])) to.appendChild(cards[i]);
    }
    return to;
  }

  function hideNestedThemeCards(parent) {
    if (!parent || !parent.querySelectorAll) return;
    var nested = parent.querySelectorAll(THEME_CARD_HOST_SELECTOR);
    var i;
    for (i = 0; i < nested.length; i++) {
      var node = nested[i];
      if (!node || node.nodeType !== 1) continue;
      if (node.classList && node.classList.contains("sf-app-card")) continue;
      if (node.closest && node.closest(".sf-app-card")) continue;
      hideEl(node);
    }
  }

  function isListHost(el) {
    if (!el || !el.tagName) return false;
    var tag = String(el.tagName).toLowerCase();
    return tag === "ul" || tag === "ol";
  }

  function findFacetValue(values, wanted) {
    var found = null;
    function walk(items) {
      if (found || !items || !items.length) return;
      var i;
      for (i = 0; i < items.length; i++) {
        var item = items[i];
        if (!item) continue;
        if (String(item.value != null ? item.value : "") === wanted) {
          found = item;
          return;
        }
        walk(item.children);
      }
    }
    walk(values);
    return found;
  }

  function applyFindlyInputChange(widget, input) {
    var name = String(input.getAttribute("name") || "");
    if (name.indexOf("sf.") !== 0) return false;
    var key = name.slice(3);
    var value = input.value;
    var checked = Boolean(input.checked);
    if (input.type === "radio") {
      if (
        checked &&
        widget.navigateToCollectionValue &&
        widget.navigateToCollectionValue(value)
      ) {
        return true;
      }
      widget.selected[key] = checked ? [value] : [];
      if (!widget.selected[key].length) delete widget.selected[key];
      widget.commitFilters();
      return true;
    }
    var facets = widget.facets || [];
    var facet = null;
    var f;
    for (f = 0; f < facets.length; f++) {
      if (facets[f] && facets[f].key === key) {
        facet = facets[f];
        break;
      }
    }
    var item = facet ? findFacetValue(facet.values, value) : null;
    var members =
      item && Array.isArray(item.memberValues) ? item.memberValues : [];
    var synthetic =
      Boolean(item && item.synthetic) || String(value).indexOf("path:") === 0;
    if (synthetic && members.length) {
      var next = (widget.selected[key] || []).slice();
      members.forEach(function (member) {
        var index = next.indexOf(member);
        if (checked && index === -1) next.push(member);
        if (!checked && index !== -1) next.splice(index, 1);
      });
      if (!next.length) delete widget.selected[key];
      else widget.selected[key] = next;
      widget.commitFilters();
      return true;
    }
    if (!widget.toggleValue) return false;
    widget.toggleValue(key, value, checked);
    return true;
  }

  function bindFindlyChangeCapture() {
    if (window.__findlyChangeCapture) return;
    window.__findlyChangeCapture = true;
    window.addEventListener(
      "change",
      function (event) {
        var input = event.target;
        if (!input || input.nodeType !== 1 || !input.closest) return;
        if (!input.closest(".smart-filter")) return;
        var type = String(input.type || "").toLowerCase();
        if (type !== "checkbox" && type !== "radio") return;
        if (String(input.getAttribute("name") || "").indexOf("sf.") !== 0) {
          return;
        }
        var widget = window.__FINDLY_FILTER_WIDGET;
        if (!widget || !widget.commitFilters) return;
        event.stopImmediatePropagation();
        applyFindlyInputChange(widget, input);
      },
      true,
    );
  }

  function liftOutOfThemeForm(widget) {
    if (!widget || !widget.root || !widget.root.closest) return;
    var mount =
      widget.root.closest(".shopify-block, .shopify-app-block") || widget.root;
    var form = mount.closest("form");
    if (!form || form === mount || !form.parentNode) return;
    form.parentNode.insertBefore(mount, form);
    widget._gridParent = null;
    widget._liftedForm = true;
    if (widget._trapped && widget.syncCollectionLayout) {
      widget.syncCollectionLayout();
    }
  }

  function mutationIsIgnored(records) {
    if (!records || !records.length) return false;
    var i;
    var j;
    function ignoredNode(node) {
      if (!node) return true;
      if (node.nodeType !== 1) node = node.parentElement;
      if (!node || node.nodeType !== 1) return true;
      if (node.id === "findly-grid-busy-overlay" || node.id === CARD_TRAY_ID) {
        return true;
      }
      if (node.getAttribute && node.getAttribute(SKEL_ATTR) === "1") return true;
      if (node.closest) {
        return Boolean(
          node.closest(
            "#findly-grid-busy-overlay, #" +
              CARD_TRAY_ID +
              ", #" +
              EMPTY_ID +
              ", [" +
              SKEL_ATTR +
              "='1']",
          ),
        );
      }
      return false;
    }
    for (i = 0; i < records.length; i++) {
      var rec = records[i];
      var nodes = [];
      if (rec.addedNodes) {
        for (j = 0; j < rec.addedNodes.length; j++) nodes.push(rec.addedNodes[j]);
      }
      if (rec.removedNodes) {
        for (j = 0; j < rec.removedNodes.length; j++) nodes.push(rec.removedNodes[j]);
      }
      if (!nodes.length && !ignoredNode(rec.target)) return false;
      for (j = 0; j < nodes.length; j++) {
        if (!ignoredNode(nodes[j])) return false;
      }
    }
    return true;
  }

  function ensureFindlyGridObserver(self) {
    if (!self || self._findlyGridObserver) return;
    if (typeof MutationObserver !== "function") return;
    var debounceTimer = null;
    self._findlyObserverCount = 0;
    self._findlyGridObserver = new MutationObserver(function (records) {
      if (repairingLayout || self._reapplyingGrid) return;
      if (mutationIsIgnored(records)) return;
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(function () {
        debounceTimer = null;
        if (repairingLayout || self._reapplyingGrid) return;
        self._findlyObserverCount = (self._findlyObserverCount || 0) + 1;
        if (self._findlyObserverCount > 8) {
          try {
            self._findlyGridObserver.disconnect();
          } catch (err) {
            /* ignore */
          }
          return;
        }
        findlyLog("grid.observer", {
          n: self._findlyObserverCount,
          handles: self._visibleHandles && self._visibleHandles.length,
          busy: Boolean(document.getElementById("findly-grid-busy-overlay")),
        });
        try {
          var url = new URL(window.location.href);
          if (url.searchParams.has("page")) stripThemePageParam();
        } catch (err) {
          /* ignore */
        }
        if (self.appGridTemplate && self.appGridTemplate()) {
          if (!self._appGridActive) return;
          var parent = self._gridParent;
          if (parent && self.hideNativeGridCards) self.hideNativeGridCards(parent);
          return;
        }
        self._reapplyingGrid = true;
        try {
          try {
            self._findlyGridObserver.disconnect();
          } catch (err) {
            /* ignore */
          }
          applyNativeAfterGrid(self);
        } finally {
          self._reapplyingGrid = false;
          if (
            self._findlyObserverCount <= 8 &&
            self._findlyGridObserver &&
            self._findlyObserveRoot
          ) {
            try {
              self._findlyGridObserver.observe(self._findlyObserveRoot, {
                childList: true,
                subtree: true,
              });
            } catch (err) {
              /* ignore */
            }
          }
        }
      }, 80);
    });
    var observeRoot =
      (self._gridParent && self._gridParent.nodeType === 1
        ? self._gridParent
        : null) ||
      document.querySelector(
        ".main-collection-grid, ul.product-grid, ol.product-grid, #product-grid, #ProductGrid",
      ) ||
      document.body;
    self._findlyObserveRoot = observeRoot;
    self._findlyGridObserver.observe(observeRoot, {
      childList: true,
      subtree: true,
    });
  }

  function pageSizeInRange(n) {
    n = Number(n);
    if (!Number.isFinite(n) || n < 8 || n > 48) return 0;
    return Math.floor(n);
  }

  function currentUrlPage() {
    try {
      var n = Number(
        new URL(window.location.href).searchParams.get("page") || "1",
      );
      return n >= 1 ? n : 1;
    } catch (err) {
      return 1;
    }
  }

  function themeShowsNextPage() {
    if (document.querySelector('link[rel="next"], a[rel="next"]')) return true;
    var page = currentUrlPage();
    var links = document.querySelectorAll(
      "nav.pagination a[href], .pagination a[href], .pagination-wrapper a[href], [data-pagination] a[href]",
    );
    var i;
    for (i = 0; i < links.length; i++) {
      var href = links[i].getAttribute("href") || "";
      var match = href.match(/[?&]page=(\d+)/);
      if (match && Number(match[1]) > page) return true;
    }
    return false;
  }

  function pageSizeFromPager() {
    var nodes = document.querySelectorAll(
      "nav.pagination, .pagination, .pagination-wrapper, [data-pagination], .paginate, #pagination",
    );
    var i;
    for (i = 0; i < nodes.length; i++) {
      var text = String(nodes[i].textContent || "").replace(/\s+/g, " ");
      var range = text.match(/(\d+)\s*[-–—]\s*(\d+)/);
      if (range) {
        var span = Number(range[2]) - Number(range[1]) + 1;
        var ok = pageSizeInRange(span);
        if (ok) return ok;
      }
      var per = text.match(/(\d+)\s*(?:per\s*page|\/\s*page)/i);
      if (per) {
        var ok2 = pageSizeInRange(per[1]);
        if (ok2) return ok2;
      }
    }
    return 0;
  }

  function pageSizeFromDataAttrs(grid, root) {
    var nodes = [];
    if (grid) {
      nodes.push(grid);
      if (grid.closest) {
        var section = grid.closest(
          ".shopify-section, [data-section-id], .product-grid-container, .collection, .main-collection-grid",
        );
        if (section) nodes.push(section);
      }
    }
    if (root) nodes.push(root);
    var names = [
      "data-products-per-page",
      "data-products_per_page",
      "data-page-size",
      "data-pagesize",
      "data-limit",
      "data-per-page",
      "data-grid-page-size",
    ];
    var i;
    var j;
    for (i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (!el || !el.getAttribute) continue;
      for (j = 0; j < names.length; j++) {
        var ok = pageSizeInRange(el.getAttribute(names[j]));
        if (ok) return ok;
      }
    }
    return 0;
  }

  function uniqueClassName(raw) {
    var seen = {};
    var out = [];
    String(raw || "")
      .split(/\s+/)
      .forEach(function (name) {
        if (!name || seen[name]) return;
        if (name.indexOf("sf-") === 0 && name !== "sf-app-card") return;
        seen[name] = true;
        out.push(name);
      });
    if (!seen["sf-app-card"]) out.push("sf-app-card");
    return out.join(" ");
  }

  function pagerPageWindow(current, count) {
    var pages = [];
    var start = Math.max(1, current - 2);
    var end = Math.min(count, current + 2);
    var i;
    if (start > 1) {
      pages.push(1);
      if (start > 2) pages.push("ellipsis");
    }
    for (i = start; i <= end; i++) pages.push(i);
    if (end < count) {
      if (end < count - 1) pages.push("ellipsis");
      pages.push(count);
    }
    return pages;
  }

  function filterPageTotal(widget) {
    var data = widget && widget._lastFilterData;
    var total = Number(widget && widget._pageTotal);
    var fromData = data ? Number(data.total) : NaN;
    var fromCount = data ? Number(data.count) : NaN;
    var fromHandles = 0;
    if (data && Array.isArray(data.handles)) fromHandles = data.handles.length;
    if (widget && Array.isArray(widget._allFilterHandles)) {
      fromHandles = Math.max(fromHandles, widget._allFilterHandles.length);
    }
    if (!Number.isFinite(total) || total < 0) total = 0;
    if (Number.isFinite(fromData) && fromData > total) total = fromData;
    if (Number.isFinite(fromCount) && fromCount > total) total = fromCount;
    if (fromHandles > total) total = fromHandles;
    return total;
  }

  function mountFindlyPager(widget) {
    if (!widget) return;
    if (widget.ensurePageSize) widget.ensurePageSize();
    var size = widget.pageSize || 16;
    var total = filterPageTotal(widget);
    widget._pageTotal = total;
    var page = Math.max(1, widget.page || 1);
    widget._hasNext = page * size < total;
    var pageCount = Math.max(1, Math.ceil(total / size) || 1);
    var show = shouldTakeOverThemeCards(widget) && pageCount > 1;
    var el = widget._pagerEl;
    if (!el) {
      el = document.createElement("nav");
      el.className = "sf-pager sf-pager--pagination";
      el.id = "findly-sf-pager";
      el.setAttribute("aria-label", widget.t ? widget.t("pagination", "Pagination") : "Pagination");
      widget._pagerEl = el;
    }
    var layout = document.querySelector(".sf-collection-layout");
    var grid = widget._gridParent;
    var main = findColumnMainContaining(grid);
    if (main && isProductGridLike(main)) main = null;
    var after = null;
    var parent = null;
    if (main) {
      parent = main;
      after = grid && main.contains(grid) ? grid : null;
      if (after && isProductGridLike(after.parentNode) && main.contains(after.parentNode)) {
        after = after.parentNode;
      }
    } else if (layout && !isProductGridLike(layout.parentNode)) {
      parent = layout.parentNode;
      after = layout;
    } else if (grid && grid.parentNode && !isProductGridLike(grid.parentNode)) {
      parent = grid.parentNode;
      after = grid;
    }
    if (parent && el.parentNode !== parent) {
      if (after && after.parentNode === parent && after.nextSibling) {
        parent.insertBefore(el, after.nextSibling);
      } else {
        parent.appendChild(el);
      }
    } else if (parent && after && after.parentNode === parent && el.previousElementSibling !== after && after.nextSibling !== el) {
      if (after.nextSibling) parent.insertBefore(el, after.nextSibling);
      else parent.appendChild(el);
    } else if (!el.parentNode) {
      document.body.appendChild(el);
    }
    if (!show) {
      el.hidden = true;
      el.setAttribute("hidden", "");
      el.innerHTML = "";
      return;
    }
    el.hidden = false;
    el.removeAttribute("hidden");
    el.removeAttribute("data-smart-filter-hidden");
    el.removeAttribute("data-findly-theme-hidden");
    el.style.setProperty("display", "block", "important");
    el.style.setProperty("visibility", "visible", "important");
    el.style.setProperty("opacity", "1", "important");
    el.style.setProperty("position", "relative", "important");
    el.style.setProperty("z-index", "6", "important");
    el.style.setProperty("width", "100%", "important");
    el.style.setProperty("max-width", "100%", "important");
    el.style.setProperty("margin", "16px 0 24px", "important");
    el.innerHTML = "";
    var list = document.createElement("div");
    list.className = "sf-pager__nav";
    function addBtn(className, label, target, disabled) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = className;
      btn.textContent = label;
      btn.disabled = Boolean(disabled || widget._loadingPage);
      btn.addEventListener("click", function () {
        if (widget.goToPage) widget.goToPage(target);
      });
      list.appendChild(btn);
    }
    addBtn(
      "sf-pager__btn sf-pager__btn--prev",
      widget.t ? widget.t("previous", "Previous") : "Previous",
      page - 1,
      page <= 1,
    );
    var pages = document.createElement("div");
    pages.className = "sf-pager__pages";
    pagerPageWindow(page, pageCount).forEach(function (item) {
      if (item === "ellipsis") {
        var dots = document.createElement("span");
        dots.className = "sf-pager__ellipsis";
        dots.textContent = "…";
        pages.appendChild(dots);
        return;
      }
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "sf-pager__page" + (item === page ? " is-current" : "");
      btn.textContent = String(item);
      if (item === page) btn.setAttribute("aria-current", "page");
      btn.disabled = Boolean(widget._loadingPage);
      btn.addEventListener("click", function () {
        if (widget.goToPage) widget.goToPage(item);
      });
      pages.appendChild(btn);
    });
    list.appendChild(pages);
    addBtn(
      "sf-pager__btn sf-pager__btn--next",
      widget.t ? widget.t("next", "Next") : "Next",
      page + 1,
      page >= pageCount,
    );
    el.appendChild(list);
    if (widget.setThemePagerHidden) widget.setThemePagerHidden(true);
  }

  function restyleAppCardsAsThemeItems(parent) {
    if (!parent || !parent.children) return;
    var sample = null;
    var i;
    for (i = 0; i < parent.children.length; i++) {
      var el = parent.children[i];
      if (!el || el.nodeType !== 1) continue;
      if (el.classList && el.classList.contains("sf-app-card")) continue;
      if (isOuterThemeCard(el) || handleFromCard(el)) {
        sample = el;
        break;
      }
    }
    var sampleClass = sample ? String(sample.className || "") : "";
    var cards = parent.querySelectorAll(".sf-app-card");
    for (i = 0; i < cards.length; i++) {
      var card = cards[i];
      if (sampleClass) card.className = uniqueClassName(sampleClass);
      card.style.removeProperty("display");
      card.hidden = false;
      card.removeAttribute("data-smart-filter-hidden");
    }
  }

  function pageSlice(widget, items, append) {
    if (!widget || !items || !items.length) return items;
    if (widget.ensurePageSize) widget.ensurePageSize();
    var size = widget.pageSize || 16;
    if (items.length <= size) return items;
    if (append) return items.slice(0, size);
    var start = (Math.max(1, widget.page || 1) - 1) * size;
    return items.slice(start, start + size);
  }

  function pageSlicePayload(widget, data, handles, append) {
    var products = (data && data.products) || [];
    var nextHandles = pageSlice(widget, handles, append);
    var nextProducts = pageSlice(widget, products, append);
    if (nextProducts === products && nextHandles === handles) {
      return { data: data, handles: handles };
    }
    return {
      data: data ? Object.assign({}, data, { products: nextProducts }) : data,
      handles: nextHandles,
    };
  }

  function sliderPercent(value, min, max) {
    var span = max - min || 1;
    return ((Number(value) - min) / span) * 100;
  }

  function sliderValueFromX(slider, clientX, min, max, step) {
    var rect = slider.getBoundingClientRect();
    var ratio = rect.width ? (clientX - rect.left) / rect.width : 0;
    if (ratio < 0) ratio = 0;
    if (ratio > 1) ratio = 1;
    var next = min + ratio * (max - min);
    var stepNum = Number(step);
    if (stepNum > 0) next = Math.round(next / stepNum) * stepNum;
    if (next < min) next = min;
    if (next > max) next = max;
    return next;
  }

  function emitInput(el) {
    try {
      el.dispatchEvent(new Event("input", { bubbles: true }));
    } catch (err) {
      var ev = document.createEvent("Event");
      ev.initEvent("input", true, true);
      el.dispatchEvent(ev);
    }
  }

  function bindPriceSlider(slider) {
    if (!slider || slider.getAttribute("data-sf-range") === "1") return;
    var inputs = slider.querySelectorAll('input[type="range"]');
    if (inputs.length < 2) return;
    slider.setAttribute("data-sf-range", "1");
    var low = inputs[0];
    var high = inputs[1];
    var fill = slider.querySelector(".smart-filter__slider-fill");
    var min = Number(low.min);
    var max = Number(low.max);
    var step = low.step || "1";
    var thumbLow = slider.querySelector(".smart-filter__slider-thumb--min");
    if (!thumbLow) {
      thumbLow = document.createElement("span");
      thumbLow.className =
        "smart-filter__slider-thumb smart-filter__slider-thumb--min";
      thumbLow.setAttribute("aria-hidden", "true");
      slider.appendChild(thumbLow);
    }
    var thumbHigh = slider.querySelector(".smart-filter__slider-thumb--max");
    if (!thumbHigh) {
      thumbHigh = document.createElement("span");
      thumbHigh.className =
        "smart-filter__slider-thumb smart-filter__slider-thumb--max";
      thumbHigh.setAttribute("aria-hidden", "true");
      slider.appendChild(thumbHigh);
    }

    function syncThumbs() {
      var left = sliderPercent(low.value, min, max);
      var right = sliderPercent(high.value, min, max);
      thumbLow.style.left = left + "%";
      thumbHigh.style.left = right + "%";
      if (fill) {
        fill.style.left = Math.min(left, right) + "%";
        fill.style.width = Math.abs(right - left) + "%";
      }
    }
    syncThumbs();
    low.addEventListener("input", syncThumbs);
    high.addEventListener("input", syncThumbs);

    function startDrag(input, other, isMin, ev) {
      ev.preventDefault();
      ev.stopPropagation();
      (isMin ? thumbLow : thumbHigh).style.zIndex = "5";
      (isMin ? thumbHigh : thumbLow).style.zIndex = "4";
      function move(e) {
        var next = sliderValueFromX(slider, e.clientX, min, max, step);
        var otherVal = Number(other.value);
        if (isMin && next > otherVal) next = otherVal;
        if (!isMin && next < otherVal) next = otherVal;
        input.value = String(next);
        emitInput(input);
      }
      function up() {
        document.removeEventListener("pointermove", move);
        document.removeEventListener("pointerup", up);
        document.removeEventListener("pointercancel", up);
        try {
          input.dispatchEvent(new Event("change", { bubbles: true }));
        } catch (err) {
          /* ignore */
        }
      }
      document.addEventListener("pointermove", move);
      document.addEventListener("pointerup", up);
      document.addEventListener("pointercancel", up);
      move(ev);
    }

    thumbLow.addEventListener("pointerdown", function (ev) {
      startDrag(low, high, true, ev);
    });
    thumbHigh.addEventListener("pointerdown", function (ev) {
      startDrag(high, low, false, ev);
    });
    slider.addEventListener("pointerdown", function (ev) {
      if (ev.target === thumbLow || ev.target === thumbHigh) return;
      var next = sliderValueFromX(slider, ev.clientX, min, max, step);
      var useLow =
        Math.abs(next - Number(low.value)) <= Math.abs(next - Number(high.value));
      startDrag(useLow ? low : high, useLow ? high : low, useLow, ev);
    });
  }

  function enhancePriceSliders(root) {
    if (!root || !root.querySelectorAll) return;
    var sliders = root.querySelectorAll(".smart-filter__slider");
    var i;
    for (i = 0; i < sliders.length; i++) bindPriceSlider(sliders[i]);
  }

  function isFindlyLayoutChrome(el) {
    if (!el || el.nodeType !== 1) return true;
    if (el === document.body || el === document.documentElement) return true;
    var cls = el.classList;
    if (!cls) return false;
    return (
      cls.contains("sf-collection-layout") ||
      cls.contains("sf-collection-layout__aside") ||
      cls.contains("smart-filter")
    );
  }

  function isColumnMain(el) {
    if (!el || el.nodeType !== 1 || !el.classList) return false;
    if (!el.classList.contains("sf-collection-layout__main")) return false;
    if (isProductGridLike(el) || isThemeManagedGrid(el)) return false;
    return true;
  }

  function findColumnMainContaining(grid) {
    var nodes = document.querySelectorAll(".sf-collection-layout__main");
    var i;
    var fallback = null;
    for (i = 0; i < nodes.length; i++) {
      if (!isColumnMain(nodes[i])) continue;
      if (!fallback) fallback = nodes[i];
      if (!grid || nodes[i] === grid || (nodes[i].contains && nodes[i].contains(grid))) {
        return nodes[i];
      }
    }
    return fallback;
  }

  function collectionSearchGridEl(widget) {
    var main = findColumnMainContaining(widget && widget._gridParent);
    var scope =
      main && !isProductGridLike(main) && !isThemeManagedGrid(main)
        ? main
        : document;
    var precise = scope.querySelector(
      "#product-grid, #ProductGrid, ul.product-grid, ol.product-grid, .sf-app-grid, .main-collection-grid",
    );
    if (precise && !isFindlyLayoutChrome(precise)) return precise;
    var grid = widget && widget._gridParent;
    if (
      grid &&
      !isFindlyLayoutChrome(grid) &&
      (!main || main.contains(grid) || grid.contains(main))
    ) {
      return grid;
    }
    try {
      return document.querySelector(
        "#product-grid, #ProductGrid, ul.product-grid, ol.product-grid, .sf-app-grid, .main-collection-grid",
      ) || scope.querySelector(PRODUCT_GRID_SELECTOR);
    } catch (err) {
      return null;
    }
  }

  function ensureCollectionSearchMarkup(widget) {
    if (!widget) return;
    var wrap =
      widget.collectionSearchWrap ||
      document.querySelector("[data-collection-search-wrap]");
    if (!wrap && widget.root) {
      wrap = document.createElement("div");
      wrap.className = "smart-filter__collection-search";
      wrap.setAttribute("data-collection-search-wrap", "");
      wrap.hidden = true;
      var label = document.createElement("label");
      label.className = "smart-filter__collection-search-label";
      label.setAttribute("for", "smart-filter-collection-q");
      label.textContent = widget.t
        ? widget.t("search_submit", "Search")
        : "Search";
      var input = document.createElement("input");
      input.id = "smart-filter-collection-q";
      input.className = "smart-filter__collection-search-input";
      input.type = "search";
      input.setAttribute("data-collection-search", "");
      input.setAttribute("placeholder", "Search products");
      input.setAttribute("autocomplete", "off");
      input.setAttribute("enterkeyhint", "search");
      wrap.appendChild(label);
      wrap.appendChild(input);
      widget.root.appendChild(wrap);
    }
    if (!wrap) return;
    widget.collectionSearchWrap = wrap;
    widget.collectionSearchEl =
      widget.collectionSearchEl ||
      wrap.querySelector("[data-collection-search]");
    if (widget.bindCollectionSearch) widget.bindCollectionSearch();
  }

  function listingToolbarAnchor(widget) {
    var grid = collectionSearchGridEl(widget) || (widget && widget._gridParent);
    var main = findColumnMainContaining(grid);
    if (main && isColumnMain(main)) {
      var before = grid && main.contains(grid) ? grid : null;
      while (before && before.parentNode && before.parentNode !== main) {
        before = before.parentNode;
      }
      if (before && isProductGridLike(before.parentNode) && main.contains(before.parentNode)) {
        before = before.parentNode;
      }
      return { parent: main, before: before || main.firstChild };
    }
    var parent = grid && grid.parentNode ? grid.parentNode : null;
    var beforeEl = grid;
    var hops = 0;
    while (
      parent &&
      parent.nodeType === 1 &&
      hops < 8 &&
      (isProductGridLike(parent) || isThemeManagedGrid(parent))
    ) {
      beforeEl = parent;
      parent = parent.parentNode;
      hops += 1;
    }
    if (!parent || parent.nodeType !== 1 || isFindlyLayoutChrome(parent)) {
      var fallbackGrid = document.querySelector(
        "#product-grid, #ProductGrid, ul.product-grid, ol.product-grid, .sf-app-grid, .main-collection-grid",
      );
      parent =
        (fallbackGrid && fallbackGrid.parentNode) ||
        document.querySelector("#MainContent, #main, main, [role='main']");
      beforeEl = fallbackGrid || null;
      hops = 0;
      while (
        parent &&
        parent.nodeType === 1 &&
        hops < 8 &&
        (isProductGridLike(parent) || isThemeManagedGrid(parent))
      ) {
        beforeEl = parent;
        parent = parent.parentNode;
        hops += 1;
      }
    }
    return { parent: parent, before: beforeEl };
  }

  function placeCollectionSearchOnGrid(widget) {
    if (!widget) return;
    ensureCollectionSearchMarkup(widget);
    var wrap = widget.collectionSearchWrap;
    var loc = listingToolbarAnchor(widget);
    var parent = loc.parent;
    var before = loc.before;
    if (!parent || parent.nodeType !== 1) return;

    var host = document.querySelector(".sf-toolbar");
    if (!host) {
      host = document.createElement("div");
      host.className = "sf-toolbar";
    }
    if (before && before.parentNode === parent) {
      if (host.nextSibling !== before) parent.insertBefore(host, before);
    } else if (host.parentNode !== parent) {
      if (parent.firstChild) parent.insertBefore(host, parent.firstChild);
      else parent.appendChild(host);
    }

    var searchHost =
      host.querySelector(".sf-collection-search-host") ||
      document.querySelector(".sf-collection-search-host");
    if (!searchHost) {
      searchHost = document.createElement("div");
      searchHost.className = "sf-collection-search-host";
    }
    searchHost.classList.add("sf-toolbar__search");
    if (searchHost.parentNode !== host) {
      host.insertBefore(searchHost, host.firstChild);
    }

    var end = host.querySelector(".sf-toolbar__end");
    if (!end) {
      end = document.createElement("div");
      end.className = "sf-toolbar__end";
    }
    if (end.parentNode !== host) host.appendChild(end);

    var sortHost =
      end.querySelector(".sf-sort-host") ||
      document.querySelector(".sf-sort-host");
    if (!sortHost) {
      sortHost = document.createElement("div");
      sortHost.className = "sf-sort-host";
    }
    if (sortHost.parentNode !== end) end.insertBefore(sortHost, end.firstChild);

    var countEl =
      end.querySelector(".sf-total-count") ||
      document.querySelector(".sf-total-count");
    if (!countEl) {
      countEl = document.createElement("div");
      countEl.className = "sf-total-count";
      countEl.setAttribute("data-sf-total-count", "");
    }
    if (countEl.parentNode !== end) end.appendChild(countEl);
    widget.totalCountEl = countEl;
    countEl.hidden = widget.showTotalProductCount === false;

    if (widget.sortWrap && !widget.sortWrap.hidden) {
      widget.sortWrap.classList.add("smart-filter__sort--toolbar");
      if (widget.sortWrap.parentNode !== sortHost) {
        sortHost.appendChild(widget.sortWrap);
      }
      var select =
        widget.sortEl ||
        widget.sortWrap.querySelector("[data-sort], .smart-filter__sort-select");
      var control = widget.sortWrap.querySelector(".sf-sort-control");
      if (!control) {
        control = document.createElement("div");
        control.className = "sf-sort-control";
      }
      var label = widget.sortWrap.querySelector(".smart-filter__sort-label");
      if (control.parentNode !== widget.sortWrap) {
        if (label && label.parentNode === widget.sortWrap) {
          if (label.nextSibling) {
            widget.sortWrap.insertBefore(control, label.nextSibling);
          } else {
            widget.sortWrap.appendChild(control);
          }
        } else {
          widget.sortWrap.appendChild(control);
        }
      }
      if (select && !select.closest(".sf-sort-trigger") && select.parentNode !== control) {
        control.insertBefore(select, control.firstChild);
      }
      if (countEl.parentNode !== control) control.appendChild(countEl);
    } else if (countEl.parentNode !== end) {
      end.appendChild(countEl);
    }

    if (wrap) {
      wrap.classList.add("smart-filter__collection-search--toolbar");
      if (wrap.parentNode !== searchHost) {
        searchHost.appendChild(wrap);
      }
    }
  }

  function patchWidget(widget) {
    if (!widget) return;
    liftOutOfThemeForm(widget);
    var proto = Object.getPrototypeOf(widget);
    if (!proto || proto.__findlyGridPatched) return;
    proto.__findlyGridPatched = true;

    proto.isAppGridMode = function () {
      return Boolean(this.appGridTemplate && this.appGridTemplate());
    };

    proto.ensurePageSize = function () {
      if (this._themePageSize >= 8 && this._themePageSize <= 48) {
        this.pageSize = this._themePageSize;
        return this.pageSize;
      }
      var parent =
        this._gridParent ||
        document.querySelector(PRODUCT_GRID_SELECTOR) ||
        findResultsList();
      var cards = parent ? collectThemeCards(parent) : [];
      var fromCards = themeShowsNextPage()
        ? pageSizeInRange(cards.length)
        : 0;
      var fromPager = pageSizeFromPager();
      var fromAttrs = pageSizeFromDataAttrs(parent, this.root);
      var fromBlock = 0;
      try {
        fromBlock = pageSizeInRange(
          (this.root && this.root.getAttribute("data-page-size")) || "0",
        );
      } catch (err) {
        fromBlock = 0;
      }
      var size = fromCards || fromPager || fromAttrs || fromBlock || 16;
      this._themePageSize = size;
      this.pageSize = size;
      return this.pageSize;
    };

    var origEnsure = proto.ensureGridParent;
    proto.ensureGridParent = function () {
      var parent = origEnsure ? origEnsure.call(this) : null;
      var inAppMode = this.isAppGridMode && this.isAppGridMode();
      var results = findResultsList();

      // Never use results-list as _gridParent. Wrapping that custom element
      // as a collection layout host throws HierarchyRequestError because the
      // filter mount / .sf-collection-layout already lives inside it.
      if (parent && isResultsListEl(parent)) {
        var inner =
          (parent.querySelector && parent.querySelector(PRODUCT_GRID_SELECTOR)) ||
          null;
        parent = inner && inner !== parent ? inner : parent.parentElement || parent;
      }

      if (parent && inAppMode) {
        parent = pickBetterGridHost(parent);
        if (parent && isResultsListEl(parent)) {
          parent = parent.parentElement || parent;
        }
      }

      if (parent) {
        if (this._gridParent && this._gridParent !== parent) {
          moveCardsToHost(this._gridParent, parent);
        }
        this._gridParent = parent;
        placeCollectionSearchOnGrid(this);
        return parent;
      }

      if (!inAppMode) {
        placeCollectionSearchOnGrid(this);
        return null;
      }
      if (results && results.parentElement) {
        this._gridParent = results.parentElement;
        placeCollectionSearchOnGrid(this);
        return this._gridParent;
      }
      this._gridParent = fallbackHost();
      placeCollectionSearchOnGrid(this);
      return this._gridParent;
    };

    var origWrap = proto.wrapHostWithLayout;
    proto.wrapHostWithLayout = function (host, mount, position) {
      try {
        host = constrainHostToThemeContainer(
          host,
          this._gridParent || collectionSearchGridEl(this) || host,
        );
        if (
          host &&
          host.parentElement &&
          (isResultsListEl(host) || isListHost(host)) &&
          !isThemeWidthContainer(host.parentElement) &&
          !isFullBleedHost(host.parentElement)
        ) {
          host = host.parentElement;
        }
        host = constrainHostToThemeContainer(
          host,
          this._gridParent || collectionSearchGridEl(this) || host,
        );
        var existing =
          (mount && mount.closest && mount.closest(".sf-collection-layout")) ||
          (host &&
          host.classList &&
          host.classList.contains("sf-collection-layout")
            ? host
            : null) ||
          (host && host.closest && host.closest(".sf-collection-layout"));
        if (existing && host && (host === existing || existing.contains(host))) {
          existing = placeMountOnExistingLayout(existing, mount, position);
          scheduleRepairCollectionLayout(this);
          return existing;
        }
        if (host && existing && host.contains(existing)) {
          existing = placeMountOnExistingLayout(existing, mount, position);
          if (
            host !== existing &&
            host.classList &&
            !isProductGridLike(host) &&
            !isThemeManagedGrid(host)
          ) {
            host.classList.add("sf-collection-layout__main");
          }
          scheduleRepairCollectionLayout(this);
          return existing;
        }
        if (existing && host && !canMoveNode(existing, host)) {
          existing = placeMountOnExistingLayout(existing, mount, position);
          scheduleRepairCollectionLayout(this);
          return existing;
        }
        var wrapped = origWrap ? origWrap.call(this, host, mount, position) : null;
        scheduleRepairCollectionLayout(this);
        return wrapped;
      } catch (err) {
        scheduleRepairCollectionLayout(this);
        return (
          (mount && mount.closest && mount.closest(".sf-collection-layout")) ||
          null
        );
      }
    };

    var origFindHost = proto.findLayoutHost;
    proto.findLayoutHost = function (grid) {
      var host = origFindHost ? origFindHost.call(this, grid) : grid;
      return constrainHostToThemeContainer(host, grid || this._gridParent);
    };

    var origFallback = proto.placeAtMainFallback;
    proto.placeAtMainFallback = function (mount) {
      if (!mount) {
        return origFallback ? origFallback.call(this, mount) : false;
      }
      var grid =
        this._gridParent ||
        collectionSearchGridEl(this) ||
        document.querySelector(PRODUCT_GRID_SELECTOR);
      var pageWidth = findThemeWidthNearMain(grid);
      if (pageWidth && !this._layoutFallbackDone) {
        var host = constrainHostToThemeContainer(pageWidth, grid || pageWidth);
        if (host && this.wrapHostWithLayout) {
          var wrapped = this.wrapHostWithLayout(
            host,
            mount,
            this.position || "left",
          );
          if (wrapped) {
            this._layoutFallbackDone = true;
            fitLayoutIntoThemeContainer(this);
            return true;
          }
        }
      }
      var placed = origFallback ? origFallback.call(this, mount) : false;
      if (placed) fitLayoutIntoThemeContainer(this);
      return placed;
    };

    var origSync = proto.syncCollectionLayout;
    proto.syncCollectionLayout = function () {
      var layout;
      try {
        layout = origSync ? origSync.apply(this, arguments) : undefined;
      } catch (err) {
        /* ignore */
      }
      if (
        !document.querySelector(
          ".sf-collection-layout[data-sf-layout-stable='1']",
        )
      ) {
        fitLayoutIntoThemeContainer(this);
      }
      portalMobileDrawer(this);
      mountFindlyPager(this);
      placeCollectionSearchOnGrid(this);
      return layout;
    };

    var origHide = proto.hideNativeGridCards;
    proto.hideNativeGridCards = function (parent) {
      if (origHide) origHide.call(this, parent);
      hideNestedThemeCards(parent);
      setOwnsGrid(true);
    };

    var origRestore = proto.restoreNativeGrid;
    proto.restoreNativeGrid = function () {
      stripAppCards(document);
      if (origRestore) origRestore.call(this);
      applyNativeFilterGrid(null, this._gridParent);
      setOwnsGrid(false);
    };

    proto.shouldInterceptPaging = function () {
      if (this.isAppGridMode && this.isAppGridMode()) return true;
      if (this._pagingFallback) return false;
      return shouldTakeOverThemeCards(this);
    };

    var origCount = proto.syncThemeProductCount;
    proto.syncThemeProductCount = function (count) {
      placeCollectionSearchOnGrid(this);
      var el = this.totalCountEl || document.querySelector(".sf-total-count");
      var show = this.showTotalProductCount !== false;
      var n = Number(count);
      if (el) {
        el.hidden = !show;
        if (show && Number.isFinite(n) && n >= 0) {
          el.textContent = this.productCountLabel
            ? this.productCountLabel(n)
            : n === 1
              ? "1 product"
              : n + " products";
        }
      }
      if (this.applyThemeProductCountVisibility) {
        this.applyThemeProductCountVisibility(false);
      }
      if (!shouldTakeOverThemeCards(this)) return;
      if (origCount) origCount.call(this, count);
    };

    var origLegacy = proto.applyThemeGridLegacy;
    proto.applyThemeGridLegacy = function (data, handles) {
      if (!shouldTakeOverThemeCards(this)) {
        applyNativeFilterGrid(null, this._gridParent);
        return;
      }
      if (origLegacy) origLegacy.call(this, data, handles);
    };

    var origApply = proto.applyAppGrid;
    proto.applyAppGrid = function (data, handles, append) {
      var sliced = this._skipPageSlice
        ? { data: data, handles: handles }
        : pageSlicePayload(this, data, handles, append);
      var parent =
        resolveCardHost(
          this._gridParent ||
            (this.ensureGridParent && this.ensureGridParent()),
        ) || this._gridParent;
      if (parent) this._gridParent = parent;
      if (!(this.isAppGridMode && this.isAppGridMode())) {
        mountCachedCards(this, sliced.handles, parent);
        if (shouldTakeOverThemeCards(this)) {
          applyNativeFilterGrid(sliced.handles, parent);
        } else {
          applyNativeFilterGrid(null, parent);
        }
        var shownNative = countAllowedInHost(parent, sliced.handles);
        var neededNative = uniqueAllowedCount(sliced.handles);
        if (neededNative > 0 && shownNative >= neededNative) return true;
        if (!shouldTakeOverThemeCards(this)) return shownNative > 0;
      }
      var ok = origApply
        ? origApply.call(this, sliced.data, sliced.handles, append)
        : false;
      parent = this._gridParent || parent;
      if (parent && isGridHostEl(parent) && parent.classList) {
        restyleAppCardsAsThemeItems(parent);
      }
      setOwnsGrid(true);
      if (this.setThemePagerHidden) this.setThemePagerHidden(true);
      if (this.renderPager) this.renderPager();
      mountFindlyPager(this);
      return ok;
    };

    var origMissing = proto.missingHandles;
    proto.missingHandles = function (handles) {
      var cache = this._cardCache || {};
      var list = handles || [];
      var out = [];
      var seen = {};
      var i;
      for (i = 0; i < list.length; i++) {
        var key = String(list[i] || "").toLowerCase();
        if (!key || seen[key]) continue;
        seen[key] = true;
        var base = key.split("::")[0];
        if (cache[key] || (base && cache[base])) continue;
        out.push(base || key);
      }
      if (out.length || !origMissing) return out;
      return origMissing.call(this, handles);
    };

    var origThemePage = proto.fetchThemePage;
    proto.fetchThemePage = function (page) {
      var self = this;
      if (!origThemePage) return Promise.resolve(false);
      return origThemePage.call(this, page).then(function (ok) {
        if (!self._themeNoMore) return ok;
        var pending = self._visibleHandles || self._shownHandles;
        if (pending && pending.length && self.missingHandles(pending).length) {
          self._themeNoMore = false;
        }
        return ok;
      });
    };

    var origCache = proto.cacheNativeCards;
    proto.cacheNativeCards = function () {
      if (origCache) origCache.call(this);
      var cache = this._cardCache || {};
      var keys = Object.keys(cache);
      var i;
      for (i = 0; i < keys.length; i++) {
        var key = keys[i];
        var outer = resolveOuterThemeCard(cache[key]);
        if (outer) cache[key] = outer;
        else delete cache[key];
      }
    };

    proto.applyInterceptGrid = function (handles, append) {
      var next = pageSlice(this, handles, append);
      var host =
        resolveCardHost(
          this._gridParent ||
            (this.ensureGridParent && this.ensureGridParent()),
        ) || this._gridParent;
      if (host) this._gridParent = host;
      if (!shouldTakeOverThemeCards(this)) {
        applyNativeFilterGrid(null, host);
        return true;
      }
      mountCachedCards(this, next, host);
      applyNativeFilterGrid(next, host);
      return (
        uniqueAllowedCount(next) > 0 &&
        countAllowedInHost(host, next) >= uniqueAllowedCount(next)
      );
    };

    var origFetch = proto.fetchFilters;
    proto.fetchFilters = function () {
      findlyLog("grid.fetch", {
        selected: this.selected,
        price: this.price,
        page: this.page,
        url: this.buildProxyUrl ? this.buildProxyUrl() : "",
        stack: shortStack(),
      });
      var result = origFetch ? origFetch.apply(this, arguments) : undefined;
      var self = this;
      if (result && typeof result.then === "function") {
        return result.then(function (value) {
          var host = resolveCardHost(self._gridParent);
          var handles = self._visibleHandles || self._shownHandles;
          if (
            shouldTakeOverThemeCards(self) &&
            Array.isArray(handles) &&
            handles.length &&
            countAllowedInHost(host, handles) < uniqueAllowedCount(handles)
          ) {
            fillMissingFilterCards(self, handles, host);
          } else if (
            !(self.isAppGridMode && self.isAppGridMode())
          ) {
            applyNativeAfterGrid(self);
          } else if (self._gridParent && self.hideNativeGridCards) {
            self.hideNativeGridCards(self._gridParent);
          }
          mountFindlyPager(self);
          return value;
        });
      }
      return result;
    };

    var origRestoreHash = proto.restoreFromHash;
    proto.restoreFromHash = function () {
      if (origRestoreHash) origRestoreHash.call(this);
      applyLooseHash(this);
    };

    var origRenderSort = proto.renderSortSelect;
    proto.renderSortSelect = function (settings) {
      if (origRenderSort) origRenderSort.call(this, settings);
      enhanceSortMenu(this);
    };

    proto.placeCollectionSearchOnGrid = function () {
      placeCollectionSearchOnGrid(this);
    };

    var origRenderSearch = proto.renderCollectionSearch;
    proto.renderCollectionSearch = function (settings) {
      ensureCollectionSearchMarkup(this);
      if (origRenderSearch) origRenderSearch.call(this, settings);
      placeCollectionSearchOnGrid(this);
    };

    var origPlaceSort = proto.placeSortOnGrid;
    proto.placeSortOnGrid = function () {
      if (this._placingSort) return;
      this._placingSort = true;
      try {
        if (origPlaceSort) origPlaceSort.call(this);
        placeCollectionSearchOnGrid(this);
        enhanceSortMenu(this);
      } finally {
        this._placingSort = false;
      }
    };

    var origInit = proto.init;
    proto.init = function () {
      applyLooseHash(this);
      if (this.ensureGridParent) this.ensureGridParent();
      if (this.ensurePageSize) this.ensurePageSize();
      if (origInit) origInit.apply(this, arguments);
      portalMobileDrawer(this);
    };

    var origBindDrawer = proto.bindDrawer;
    proto.bindDrawer = function () {
      if (origBindDrawer) origBindDrawer.apply(this, arguments);
      var missedToggle = !this.toggleEl;
      var missedClose = !this.closeEl;
      var missedBackdrop = !this.backdropEl;
      if (!this.panelEl) {
        this.panelEl = document.querySelector("[data-drawer-panel]");
      }
      if (!this.backdropEl) {
        this.backdropEl = document.querySelector("[data-drawer-backdrop]");
      }
      if (!this.toggleEl) {
        this.toggleEl = document.querySelector("[data-drawer-toggle]");
      }
      if (!this.closeEl) {
        this.closeEl =
          (this.panelEl && this.panelEl.querySelector("[data-drawer-close]")) ||
          document.querySelector("[data-drawer-close]");
      }
      if (!this.countEl && this.toggleEl) {
        this.countEl = this.toggleEl.querySelector("[data-drawer-count]");
      }
      var self = this;
      if (missedToggle && this.toggleEl) {
        this.toggleEl.addEventListener("click", function () {
          self.openDrawer();
        });
      }
      if (missedClose && this.closeEl) {
        this.closeEl.addEventListener("click", function () {
          self.closeDrawer();
        });
      }
      if (missedBackdrop && this.backdropEl) {
        this.backdropEl.addEventListener("click", function () {
          self.closeDrawer();
        });
      }
    };

    var origOpen = proto.openDrawer;
    proto.openDrawer = function () {
      portalMobileDrawer(this);
      if (origOpen) origOpen.apply(this, arguments);
      if (this.panelEl) this.panelEl.classList.add("is-open");
      if (this.backdropEl) {
        this.backdropEl.hidden = false;
        this.backdropEl.classList.add("is-open");
      }
      document.documentElement.classList.add("is-sf-drawer-open");
    };

    var origClose = proto.closeDrawer;
    proto.closeDrawer = function () {
      if (origClose) origClose.apply(this, arguments);
      if (this.panelEl) this.panelEl.classList.remove("is-open");
      if (this.backdropEl) this.backdropEl.classList.remove("is-open");
      document.documentElement.classList.remove("is-sf-drawer-open");
    };

    var origBusy = proto.setGridBusy;
    proto.setGridBusy = function (busy) {
      var parent =
        this._gridParent ||
        (this.ensureGridParent && this.ensureGridParent());
      var host = discoverBusyHost(parent);
      if (parent && parent.classList) parent.classList.remove("sf-grid-busy");
      if (host && host.classList) host.classList.remove("sf-grid-busy");
      paintGridBusy(host, busy);
      findlyLog("grid.busy", {
        busy: Boolean(busy),
        host: describeHost(host),
        parent: describeHost(parent),
        overlay: Boolean(document.getElementById("findly-grid-busy-overlay")),
        skel: document.querySelectorAll("[" + SKEL_ATTR + "='1']").length,
        stack: shortStack(),
      });
      if (origBusy && origBusy !== proto.setGridBusy && !host) {
        origBusy.call(this, busy);
      }
    };

    proto.syncProductGrid = function (handles) {
      var parent = resolveCardHost(
        this._gridParent ||
          (this.ensureGridParent && this.ensureGridParent()),
      );
      if (parent) this._gridParent = parent;
      if (!shouldTakeOverThemeCards(this)) {
        applyNativeFilterGrid(null, parent);
        syncGridEmptyState(this, parent, null, 0);
        placeCollectionSearchOnGrid(this);
        return;
      }
      mountCachedCards(this, handles, parent);
      var shownBefore = countAllowedInHost(parent, handles);
      if (
        Array.isArray(handles) &&
        handles.length &&
        shownBefore < uniqueAllowedCount(handles)
      ) {
        this.setGridBusy(true);
      }
      applyNativeFilterGrid(handles, parent);
      var shown = countAllowedInHost(parent, handles);
      if (
        Array.isArray(handles) &&
        handles.length &&
        shown < uniqueAllowedCount(handles)
      ) {
        fillMissingFilterCards(this, handles, parent);
      } else {
        syncGridEmptyState(this, parent, handles, shown);
      }
      placeCollectionSearchOnGrid(this);
    };
    proto.watchThemeGrid = function () {
      if (this._gridObserver) {
        try {
          this._gridObserver.disconnect();
        } catch (err) {
          /* ignore */
        }
        this._gridObserver = null;
        this._gridObserveEl = null;
      }
      if (!(this._appGridActive || (this.isAppGridMode && this.isAppGridMode()))) {
        applyNativeAfterGrid(this);
      }
      if (this._findlyGridWatch) return;
      this._findlyGridWatch = true;
      ensureFindlyGridObserver(this);
    };

    var origRenderPrice = proto.renderPriceFacet;
    proto.renderPriceFacet = function () {
      var wrap = origRenderPrice
        ? origRenderPrice.apply(this, arguments)
        : null;
      enhancePriceSliders(wrap);
      return wrap;
    };

    var origPager = proto.renderPager;
    proto.renderPager = function () {
      if (origPager) origPager.apply(this, arguments);
      mountFindlyPager(this);
    };

    var origRenderFacets = proto.renderFacets;
    proto.renderFacets = function () {
      var result = origRenderFacets
        ? origRenderFacets.apply(this, arguments)
        : undefined;
      enhancePriceSliders(this.root);
      decorateCheckMarks(this.panelEl || this.facetsEl || this.root);
      return result;
    };
  }

  function installSetter(held) {
    try {
      Object.defineProperty(window, "__FINDLY_FILTER_WIDGET", {
        configurable: true,
        enumerable: true,
        get: function () {
          return held;
        },
        set: function (next) {
          held = next;
          patchWidget(next);
          applyLooseHash(next);
          if (next && next.root) enhancePriceSliders(next.root);
          enhanceSortMenu(next);
          decorateCheckMarks(
            (next && next.panelEl) || (next && next.facetsEl) || (next && next.root),
          );
        },
      });
    } catch (err) {
      /* ignore */
    }
  }

  function install() {
    injectCss();
    bindFindlyChangeCapture();
    bindHashChange();
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", bootEarlyGridBusy);
    } else {
      bootEarlyGridBusy();
    }
    if (!window.__findlyDrawerResize) {
      window.__findlyDrawerResize = true;
      window.addEventListener("resize", function () {
        var widget = window.__FINDLY_FILTER_WIDGET;
        if (widget) portalMobileDrawer(widget);
        var openWrap = document.querySelector(".smart-filter__sort.is-sort-open");
        if (openWrap) closeSortMenu(openWrap);
      });
    }
    var held = window.__FINDLY_FILTER_WIDGET;
    installSetter(held);
    if (held) {
      patchWidget(held);
      applyLooseHash(held);
      if (held.root) enhancePriceSliders(held.root);
      enhanceSortMenu(held);
      decorateCheckMarks(held.panelEl || held.facetsEl || held.root);
    }
  }

  install();
})();
