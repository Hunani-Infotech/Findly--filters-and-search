/**
 * Collection grid takeover extras.
 * Loaded from Liquid via asset_url so it does not count against the 100 KB
 * schema "javascript" cap on smart-filter.min.js.
 *
 * Patches Widget.prototype as soon as window.__FINDLY_FILTER_WIDGET is set.
 */
(function () {
  "use strict";

  var STYLE_ID = "findly-grid-takeover-v36";
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
    "{justify-content:start!important;width:100%!important;max-width:100%!important}";
  var RESULTS_LIST_BLOCK_CSS =
    ".sf-collection-layout results-list:not(.product-grid):not(.main-collection-grid):not([product-grid-view])," +
    ".sf-og results-list:not(.product-grid):not(.main-collection-grid):not([product-grid-view])," +
    ".collection-wrapper results-list:not(.product-grid):not(.main-collection-grid):not([product-grid-view])" +
    "{display:block!important;width:100%;min-width:0}";
  var PRODUCT_GRID_KEEP_CSS =
    ".sf-collection-layout .product-grid,.sf-og .product-grid," +
    ".sf-collection-layout ul.product-grid,.sf-og ul.product-grid," +
    ".sf-collection-layout ol.product-grid,.sf-og ol.product-grid," +
    ".sf-collection-layout .main-collection-grid,.sf-og .main-collection-grid," +
    ".sf-collection-layout #product-grid,.sf-og #product-grid," +
    ".sf-collection-layout #ProductGrid,.sf-og #ProductGrid" +
    "{width:100%!important;max-width:100%!important;min-width:0!important}";
  var GRID_RESULT_HIDE =
    ":not([" +
    SKEL_ATTR +
    "='1']):not([data-findly-skel-host='1']):not(.sf-toolbar):not(.sf-page-chips):not(.sf-sort-host):not(.sf-search-host):not(.sf-total-count)" +
    ":not(.sf-pager):not(.sf-grid-empty):not(#findly-grid-empty):not(#findly-card-tray):not(.smart-filter)" +
    ":not(.sf-collection-layout):not(.sf-layout-aside):not(#smart-filter-root):not(#smart-filter-embed)";
  var GRID_BUSY_HOSTS = [
    ".main-collection-grid",
    "#product-grid",
    "#ProductGrid",
    "ul.product-grid",
    "ol.product-grid",
    ".product-grid",
    ".sf-app-grid",
  ];
  var GRID_COUNT_HIDE =
    "html.sf-filter-loading .product-count," +
    "html.sf-filter-loading .product-count__text," +
    "html.sf-filter-loading #ProductCount," +
    "html.sf-filter-loading #ProductCountDesktop," +
    "html.sf-filter-loading [data-product-count]," +
    "html.sf-filter-loading .collection-product-count," +
    "html.sf-filter-loading .facets__product-count," +
    "html.sf-filter-loading .products-count-wrapper," +
    "html.sf-filter-loading [data-testid='products-count']," +
    "html.sf-filter-loading .product-count-vertical," +
    "html.sf-filter-loading .filter-count-bubble__text," +
    "html.sf-filter-loading .collection-count," +
    "html.sf-filter-loading .js-product-count," +
    "html.sf-filter-loading [data-collection-count]," +
    "html.sf-filter-loading .toolbar__product-count," +
    "html.sf-filter-loading .product-count-text," +
    "html.sf-filter-loading .filters-toolbar__product-count" +
    "{visibility:hidden!important}";
  var TOOLBAR_LOADING_CSS =
    "html.sf-filter-loading .sf-total-count{" +
    "visibility:visible!important;color:transparent!important;position:relative;" +
    "min-width:5.75rem;min-height:.85em;pointer-events:none}" +
    "html.sf-filter-loading .sf-total-count::after{" +
    "content:\"\";position:absolute;right:0;top:50%;width:5.5rem;height:.7em;margin-top:-.35em;" +
    "border-radius:4px;background:#ececec;animation:sf-skeleton-pulse 1.1s ease-in-out infinite}";
  var GRID_PAGER_HIDE =
    "html.sf-filter-loading nav.pagination," +
    "html.sf-filter-loading .pagination-wrapper," +
    "html.sf-filter-loading .pagination," +
    "html.sf-filter-loading [data-pagination]," +
    "html.sf-filter-loading .paginate," +
    "html.sf-filter-loading #pagination," +
    "html.sf-filter-loading .Pagination," +
    "html.sf-filter-loading #AjaxinatePagination," +
    "html.sf-filter-loading .ajaxinate-pagination," +
    "html.sf-filter-loading .sf-pager" +
    "{visibility:hidden!important;pointer-events:none!important}";
  var FEW_RESULTS_PAGER_CSS =
    "html.sf-few-results nav.pagination," +
    "html.sf-few-results .pagination-wrapper," +
    "html.sf-few-results .pagination," +
    "html.sf-few-results [data-pagination]," +
    "html.sf-few-results .paginate," +
    "html.sf-few-results #pagination," +
    "html.sf-few-results .Pagination," +
    "html.sf-few-results #AjaxinatePagination," +
    "html.sf-few-results .ajaxinate-pagination," +
    "html.sf-pager-unneeded nav.pagination," +
    "html.sf-pager-unneeded .pagination-wrapper," +
    "html.sf-pager-unneeded .pagination," +
    "html.sf-pager-unneeded [data-pagination]," +
    "html.sf-pager-unneeded .paginate," +
    "html.sf-pager-unneeded #pagination," +
    "html.sf-pager-unneeded .Pagination," +
    "html.sf-pager-unneeded #AjaxinatePagination," +
    "html.sf-pager-unneeded .ajaxinate-pagination" +
    "{display:none!important}";
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
  var BUSY_NESTED_CARD =
    ":is(product-card,product-item,grid-item,li.grid__item,.grid__item,.product-card,.product-grid__item,.product-item,.grid-product,.grid-view-item,.product-block,.productitem,article.card,.sf-app-card,.card-wrapper,.card--product,.card-product,[data-product-card],.collection-product-card,.product-card-wrapper):not([" +
    SKEL_ATTR +
    "='1'])";
  function gridBusyNestedHideCss() {
    var i;
    var parts = [".findly-grid-is-busy " + BUSY_NESTED_CARD];
    for (i = 0; i < GRID_BUSY_HOSTS.length; i++) {
      parts.push(
        "html.sf-filter-loading " + GRID_BUSY_HOSTS[i] + " " + BUSY_NESTED_CARD,
      );
    }
    return parts.join(",") + "{display:none!important}";
  }
  var GRID_BUSY_CSS =
    "@keyframes sf-grid-spin{to{transform:rotate(360deg)}}" +
    "@keyframes sf-skeleton-pulse{50%{opacity:.55}}" +
    "#findly-grid-busy-overlay{position:fixed;z-index:80;box-sizing:border-box;pointer-events:auto;" +
    "background:#fff}" +
    "#findly-grid-busy-overlay::after{content:\"\";position:absolute;top:50%;left:50%;width:2rem;height:2rem;" +
    "margin:-1rem 0 0 -1rem;border:2px solid rgb(0 0 0 / .12);border-top-color:var(--sf-accent,#111);" +
    "border-radius:50%;animation:sf-grid-spin .7s linear infinite}" +
    ".findly-grid-is-busy{position:relative;min-height:22rem;pointer-events:none}" +
    ".findly-grid-is-busy .sf-toolbar,.findly-grid-is-busy .sf-page-chips," +
    ".findly-grid-is-busy .sf-sort-host," +
    ".findly-grid-is-busy .sf-search-host,.findly-grid-is-busy .sf-pager," +
    ".findly-grid-is-busy nav.pagination,.findly-grid-is-busy .pagination," +
    ".findly-grid-is-busy .pagination-wrapper,.findly-grid-is-busy [data-pagination]," +
    ".findly-grid-is-busy .paginate,.findly-grid-is-busy #pagination," +
    ".findly-grid-is-busy .Pagination,.findly-grid-is-busy #AjaxinatePagination," +
    ".findly-grid-is-busy .ajaxinate-pagination," +
    ".findly-grid-is-busy .sf-sort{pointer-events:auto}" +
    ".findly-grid-is-busy>" +
    GRID_RESULT_HIDE +
    "{display:none!important}" +
    gridBusyNestedHideCss() +
    ".findly-grid-is-busy[" +
    SKEL_ATTR +
    "='1'],.findly-grid-is-busy [" +
    SKEL_ATTR +
    "='1'],html.sf-filter-loading [" +
    SKEL_ATTR +
    "='1']{opacity:1!important;visibility:visible!important;position:relative;z-index:81}" +
    gridLoadingHideCss("html.sf-filter-loading") +
    gridLoadingMinCss("html.sf-filter-loading") +
    GRID_COUNT_HIDE +
    TOOLBAR_LOADING_CSS +
    GRID_PAGER_HIDE +
    "[" + SKEL_ATTR + "='1']{pointer-events:none;list-style:none;min-width:0}" +
    ".findly-grid-skel-img{display:block;width:100%;aspect-ratio:1;border-radius:8px;background:#ececec}" +
    ".findly-grid-skel-line{display:block;height:.7rem;margin-top:.55rem;border-radius:4px;background:#ececec;width:78%}" +
    ".findly-grid-skel-line.is-short{width:42%;margin-top:.4rem}" +
    "[" + SKEL_ATTR + "='1'] .findly-grid-skel-img,[" + SKEL_ATTR + "='1'] .findly-grid-skel-line{" +
    "animation:sf-skeleton-pulse 1.1s ease-in-out infinite}" +
    "#" +
    "findly-grid-empty,.sf-grid-empty{grid-column:1/-1;width:100%;min-height:12rem;display:flex;flex-direction:column;" +
    "align-items:center;justify-content:center;text-align:center;padding:2.5rem 1.5rem;box-sizing:border-box}" +
    ".sf-grid-empty-title{margin:0 0 .4rem;font-size:1.05rem;font-weight:650}" +
    ".sf-grid-empty-text{margin:0;opacity:.7;font-size:.9rem}";
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
      var raw = String(window.location.hash || "").replace(/^#/, "");
      if (!raw) {
        resetWidgetFilterState(widget);
        widget._sfPaged = false;
        prepareNativeListingRestore(widget);
        widget.fetchFilters();
        return;
      }
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
      ".smart-filter .sf-option:not(.sf-swatch):not(.sf-pill) input[type=checkbox]," +
      ".smart-filter .sf-option:not(.sf-swatch):not(.sf-pill) input[type=radio]," +
      ".sf-panel.sf-drawer-portal .sf-option:not(.sf-swatch):not(.sf-pill) input[type=checkbox]," +
      ".sf-panel.sf-drawer-portal .sf-option:not(.sf-swatch):not(.sf-pill) input[type=radio]{" +
      "appearance:none!important;-webkit-appearance:none!important;opacity:1!important;visibility:visible!important;" +
      "position:relative!important;width:18px!important;height:18px!important;min-width:18px!important;margin:0!important;" +
      "border:1.5px solid #c3c3c3!important;background:#fff!important;display:inline-grid!important;place-content:center!important;" +
      "clip:auto!important;transform:none!important;box-shadow:none!important;color:inherit!important}" +
      ".smart-filter .sf-option:not(.sf-swatch):not(.sf-pill) input[type=checkbox]," +
      ".sf-panel.sf-drawer-portal .sf-option:not(.sf-swatch):not(.sf-pill) input[type=checkbox]{border-radius:4px!important}" +
      ".smart-filter .sf-option:not(.sf-swatch):not(.sf-pill) input[type=radio]," +
      ".sf-panel.sf-drawer-portal .sf-option:not(.sf-swatch):not(.sf-pill) input[type=radio]{border-radius:999px!important}" +
      ".smart-filter .sf-option:not(.sf-swatch):not(.sf-pill) input[type=checkbox]::after," +
      ".sf-panel.sf-drawer-portal .sf-option:not(.sf-swatch):not(.sf-pill) input[type=checkbox]::after{" +
      "content:\"\";width:4px;height:8px;border:solid #fff;border-width:0 2px 2px 0;transform:scale(0) rotate(45deg);margin-top:-1px}" +
      ".smart-filter .sf-option:not(.sf-swatch):not(.sf-pill) input[type=radio]::after," +
      ".sf-panel.sf-drawer-portal .sf-option:not(.sf-swatch):not(.sf-pill) input[type=radio]::after{" +
      "content:\"\";width:8px;height:8px;border:0;border-radius:50%;background:currentColor;transform:scale(0)}" +
      ".smart-filter .sf-option:not(.sf-swatch):not(.sf-pill) input[type=checkbox]:checked," +
      ".smart-filter .sf-option:not(.sf-swatch):not(.sf-pill) input[type=checkbox]:indeterminate," +
      ".sf-panel.sf-drawer-portal .sf-option:not(.sf-swatch):not(.sf-pill) input[type=checkbox]:checked," +
      ".sf-panel.sf-drawer-portal .sf-option:not(.sf-swatch):not(.sf-pill) input[type=checkbox]:indeterminate{" +
      "background:currentColor!important;border-color:currentColor!important}" +
      ".smart-filter .sf-option:not(.sf-swatch):not(.sf-pill) input[type=radio]:checked," +
      ".sf-panel.sf-drawer-portal .sf-option:not(.sf-swatch):not(.sf-pill) input[type=radio]:checked{" +
      "background:#fff!important;border-color:currentColor!important}" +
      ".smart-filter .sf-option:not(.sf-swatch):not(.sf-pill) input[type=checkbox]:checked::after," +
      ".sf-panel.sf-drawer-portal .sf-option:not(.sf-swatch):not(.sf-pill) input[type=checkbox]:checked::after{transform:scale(1) rotate(45deg)}" +
      ".smart-filter .sf-option:not(.sf-swatch):not(.sf-pill) input[type=radio]:checked::after," +
      ".sf-panel.sf-drawer-portal .sf-option:not(.sf-swatch):not(.sf-pill) input[type=radio]:checked::after{transform:scale(1)}" +
      ".smart-filter .sf-price,.sf-panel.sf-drawer-portal .sf-price{display:grid!important;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr)!important;width:100%!important;min-width:0!important;overflow:visible!important}" +
      ".smart-filter .sf-facet.is-collapsed>.sf-options,.smart-filter .sf-facet.is-collapsed>.sf-price,.smart-filter .sf-facet.is-collapsed>.sf-dropdown-wrap,.smart-filter .sf-facet.is-collapsed>.sf-facet-search,.sf-panel.sf-drawer-portal .sf-facet.is-collapsed>.sf-options,.sf-panel.sf-drawer-portal .sf-facet.is-collapsed>.sf-price,.sf-panel.sf-drawer-portal .sf-facet.is-collapsed>.sf-dropdown-wrap,.sf-panel.sf-drawer-portal .sf-facet.is-collapsed>.sf-facet-search{display:none!important}" +
      ".smart-filter .sf-slider,.sf-panel.sf-drawer-portal .sf-slider{grid-column:1/-1!important;position:relative!important;display:block!important;width:100%!important;height:27px!important;overflow:visible!important;background:transparent!important}" +
      ".smart-filter .sf-slider-track,.sf-panel.sf-drawer-portal .sf-slider-track{position:absolute!important;left:0!important;right:0!important;top:50%!important;width:auto!important;height:2px!important;margin-top:-1px!important;border:0!important;border-radius:999px!important;pointer-events:none!important;display:block!important;background:#dcdcdc!important;z-index:0!important}" +
      ".smart-filter .sf-slider-fill,.sf-panel.sf-drawer-portal .sf-slider-fill{position:absolute!important;top:50%!important;height:3px!important;margin-top:-1.5px!important;border:0!important;border-radius:999px!important;pointer-events:none!important;display:block!important;background:var(--sf-accent,#111)!important;z-index:1!important}" +
      ".smart-filter .sf-slider input[type=range],.sf-panel.sf-drawer-portal .sf-slider input[type=range]{position:absolute!important;left:0!important;width:100%!important;max-width:none!important;height:23px!important;margin:0!important;padding:0!important;border:0!important;opacity:0!important;background:transparent!important;appearance:none!important;-webkit-appearance:none!important;pointer-events:none!important}" +
      ".smart-filter .sf-slider-thumb,.sf-panel.sf-drawer-portal .sf-slider-thumb{position:absolute!important;top:50%!important;width:16px!important;height:16px!important;margin:0!important;padding:0!important;border:1.5px solid var(--sf-accent,#111)!important;border-radius:999px!important;background:#fff!important;transform:translate(-50%,-50%)!important;z-index:4!important;pointer-events:auto!important;cursor:grab!important;display:block!important;touch-action:none}" +
      "@media(max-width:989px){" +
      ".sf-panel,.sf-panel.sf-drawer-portal{" +
      "display:flex!important;flex-direction:column!important;width:min(420px,92vw)!important;" +
      "max-width:92vw!important;box-sizing:border-box!important;padding:0!important;overflow:hidden!important}" +
      ".sf-header{position:sticky;top:0;z-index:3;flex:0 0 auto;background:#fff}" +
      ".sf-facets{flex:1 1 auto;min-height:0;overflow:auto}" +
      "}" +
      ".sf-panel.sf-drawer-portal{" +
      "display:flex!important;flex-direction:column!important;width:min(420px,92vw)!important;" +
      "max-width:92vw!important;box-sizing:border-box!important;padding:0!important;overflow:hidden!important}" +
      ".sf-panel.sf-drawer-portal .sf-header{position:sticky;top:0;z-index:3;flex:0 0 auto;background:#fff}" +
      ".sf-panel.sf-drawer-portal .sf-facets{flex:1 1 auto;min-height:50vh;overflow:auto;color:#111;visibility:visible;display:flex;flex-direction:column}" +
      ".sf-panel.sf-drawer-portal .sf-facet,.sf-panel.sf-drawer-portal .sf-facet-label{visibility:visible!important;opacity:1!important}" +
      ".sf-panel.sf-drawer-portal .sf-facet{display:block!important}" +
      ".sf-panel.sf-drawer-portal .sf-facet-label{display:flex!important}" +
      ".sf-panel.sf-drawer-portal .sf-facet:not(.is-collapsed)>.sf-options:not(.sf-options-swatches):not(.sf-options-pills){display:flex!important;flex-direction:column!important;align-items:stretch!important;visibility:visible!important}" +
      ".sf-panel.sf-drawer-portal .sf-facet:not(.is-collapsed)>.sf-options-swatches:not(.sf-options-swatch-text),.sf-panel.sf-drawer-portal .sf-facet:not(.is-collapsed)>.sf-options-pills{display:flex!important;flex-direction:row!important;flex-wrap:wrap!important;align-items:flex-start!important;align-content:flex-start!important;visibility:visible!important}" +
      ".sf-panel.sf-drawer-portal .sf-options-swatches:not(.sf-options-swatch-text)>li,.sf-panel.sf-drawer-portal .sf-options-pills>li{flex:0 0 auto!important;width:auto!important}" +
      ".sf-panel.sf-drawer-portal .sf-options:not(.sf-options-swatches):not(.sf-options-pills)>li{flex:0 0 auto!important;width:100%!important;height:auto!important}" +
      ".sf-panel.sf-drawer-portal .sf-facet.is-collapsed>.sf-options,.sf-panel.sf-drawer-portal .sf-facet.is-collapsed>.sf-price,.sf-panel.sf-drawer-portal .sf-facet.is-collapsed>.sf-dropdown-wrap,.sf-panel.sf-drawer-portal .sf-facet.is-collapsed>.sf-facet-search{display:none!important}" +
      ".sf-panel.sf-drawer-portal{color:#111!important;background:#fff!important}" +
      "html.is-sf-drawer-open .sf-panel.sf-drawer-portal,.sf-panel.sf-drawer-portal.is-open{display:flex!important;visibility:visible!important;opacity:1!important}" +
      ".sf-sort-toolbar,.sf-sort-host,.sf-sort-trigger,.sf-sort-row{overflow:visible!important;position:relative}" +
      ".sf-sort-row{display:flex!important;align-items:center!important;gap:.7rem;width:auto}" +
      ".sf-sort-row .sf-sort-trigger{flex:0 0 auto;width:auto;min-width:10.75rem}" +
      ".sf-sort-trigger{display:block;width:100%;pointer-events:auto}" +
      ".sf-sort-btn{display:inline-flex!important;position:relative;box-sizing:border-box;align-items:center;justify-content:space-between;gap:.5rem;" +
      "width:100%;min-width:10.75rem;max-width:16rem;min-height:2.5rem;margin:0;padding:.5rem 2.35rem .5rem .9rem;" +
      "border:1px solid #e2e2e2!important;border-radius:10px!important;background:#fff!important;color:inherit!important;" +
      "font:inherit!important;font-weight:500!important;line-height:1.25;text-align:left;text-transform:none!important;" +
      "letter-spacing:normal!important;cursor:pointer;appearance:none!important;-webkit-appearance:none!important;" +
      "box-shadow:none!important;outline:none!important}" +
      ".sf-sort-btn:hover{border-color:#cfcfcf!important;background:#fafafa!important}" +
      ".sf-sort-btn:focus-visible,.sf-sort.is-sort-open .sf-sort-btn{" +
      "border-color:#111!important;box-shadow:0 0 0 3px rgb(17 17 17 / 10%)!important}" +
      ".sf-sort-btn-value{display:block;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}" +
      ".sf-sort-btn-chevron{position:absolute;right:.9rem;top:50%;width:.42rem;height:.42rem;margin-top:-.28rem;" +
      "border-right:1.5px solid currentColor;border-bottom:1.5px solid currentColor;transform:rotate(45deg);" +
      "opacity:.55;pointer-events:none;transition:transform .16s ease,margin-top .16s ease}" +
      ".sf-sort.is-sort-open .sf-sort-btn-chevron{margin-top:-.08rem;transform:rotate(225deg)}" +
      "@media(max-width:749px){.sf-sort-btn{display:none!important}}" +
      "@media(min-width:750px){" +
      ".sf-sort-trigger:has(.sf-sort-btn) .sf-sort-select," +
      ".sf-sort:has(.sf-sort-btn) .sf-sort-select{display:none!important;position:absolute!important;width:1px!important;height:1px!important;" +
      "padding:0!important;margin:-1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;" +
      "white-space:nowrap!important;border:0!important;opacity:0!important;pointer-events:none!important;" +
      "appearance:none!important;-webkit-appearance:none!important;background:none!important}" +
      "}" +
      ".sf-sort-menu{position:absolute;top:calc(100% + 6px);left:auto;right:0;bottom:auto;" +
      "z-index:100060;box-sizing:border-box;min-width:0;width:max-content;max-width:min(18rem,calc(100vw - 24px));margin:0;" +
      "background:var(--sf-surface,#fff);color:inherit;border:1px solid #ececec;" +
      "border-radius:12px;padding:6px;box-shadow:0 4px 16px rgb(0 0 0 / 8%),0 1px 2px rgb(0 0 0 / 4%)}" +
      ".sf-sort-menu.is-ported{position:fixed;top:auto;left:auto;right:auto;min-width:0;width:max-content}" +
      ".sf-sort-menu[hidden]{display:none!important}" +
      ".sf-sort-option{position:relative;display:block;width:100%;appearance:none!important;-webkit-appearance:none!important;margin:0;" +
      "padding:8px 12px!important;border:0!important;border-radius:8px;background:transparent!important;color:#5c5c5c!important;font:inherit!important;" +
      "font-weight:450!important;font-size:.9375em!important;text-align:left!important;text-transform:none!important;letter-spacing:normal!important;" +
      "white-space:nowrap;cursor:pointer;box-shadow:none!important;outline:none!important}" +
      ".sf-sort-option:hover,.sf-sort-option:focus{background:#f6f6f6!important;color:#111!important;outline:none}" +
      ".sf-sort-option.is-selected{font-weight:600!important;color:#111!important;background:#f3f3f3!important}";
    var style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = css;
    (document.head || document.documentElement).appendChild(style);
    var existingBridge =
      document.getElementById("findly-theme-bridge-v14") ||
      document.getElementById("findly-theme-bridge-v13") ||
      document.getElementById("findly-theme-bridge-v12") ||
      document.getElementById("findly-theme-bridge-v11") ||
      document.getElementById("findly-theme-bridge-v10") ||
      document.getElementById("findly-theme-bridge-v9") ||
      document.getElementById("findly-theme-bridge-v8") ||
      document.getElementById("findly-theme-bridge-v7") ||
      document.getElementById("findly-theme-bridge-v6") ||
      document.getElementById("findly-theme-bridge-v5") ||
      document.getElementById("findly-theme-bridge-v4") ||
      document.getElementById("findly-theme-bridge-v3") ||
      document.getElementById("findly-theme-bridge-v2") ||
      document.getElementById("findly-theme-bridge");
    if (existingBridge && existingBridge.id !== "findly-theme-bridge-v14") {
      if (existingBridge.parentNode) existingBridge.parentNode.removeChild(existingBridge);
      existingBridge = null;
    }
    if (!existingBridge) {
      var bridge = document.createElement("style");
      bridge.id = "findly-theme-bridge-v14";
      bridge.textContent =
        "[data-smart-filter-hidden='true'],[data-findly-theme-hidden='1']{display:none!important}" +
        GRID_BUSY_CSS +
        ".sf-collection-layout{display:block;box-sizing:border-box;width:100%;max-width:100%;min-width:0;margin-inline:0}" +
        ".page-width>.sf-collection-layout,.page-width-desktop>.sf-collection-layout," +
        ".page-width--narrow>.sf-collection-layout,.container>.sf-collection-layout,.Container>.sf-collection-layout" +
        "{width:100%!important;max-width:100%!important;margin-left:0;margin-right:0}" +
        ".sf-layout-aside,.sf-layout-main{box-sizing:border-box;min-width:0}" +
        ".sf-layout-main:not(ul):not(ol):not(results-list):not(.product-grid):not(.main-collection-grid):not(product-list)" +
        "{display:block;flex:1 1 0%;min-width:0;width:auto;max-width:100%}" +
        "ul.product-grid.sf-layout-main,ol.product-grid.sf-layout-main," +
        ".product-grid.sf-layout-main,.main-collection-grid.sf-layout-main," +
        "results-list.sf-layout-main,product-list.sf-layout-main" +
        "{flex:1 1 0%;min-width:0;width:auto;max-width:100%}" +
        "ul.product-grid>.sf-collection-layout,.product-grid>.sf-collection-layout,ol.product-grid>.sf-collection-layout," +
        "results-list>.sf-collection-layout,.main-collection-grid>.sf-collection-layout,.sf-app-grid>.sf-collection-layout," +
        ".product-grid-container>.sf-collection-layout" +
        "{grid-column:1/-1!important;width:100%!important;max-width:100%!important}" +
        ".collection-wrapper>.sf-pager,.collection-wrapper>.sf-toolbar,.collection-wrapper>.sf-page-chips," +
        ".collection-wrapper>.sf-sort-host," +
        ".product-grid-container>.sf-pager,.product-grid-container>.sf-toolbar," +
        ".product-grid-container>.sf-page-chips" +
        "{grid-column:1/-1!important;width:100%!important;max-width:100%!important}" +
        ".sf-layout-main>.collection-wrapper,.sf-collection-layout .collection-wrapper" +
        "{width:100%;max-width:100%;min-width:0}" +
        ".product-grid>.sf-toolbar,.product-grid>.sf-pager,.product-grid>.sf-sort-host,.product-grid>.sf-search-host," +
        "ul.product-grid>.sf-toolbar,ul.product-grid>.sf-pager,ul.product-grid>.sf-sort-host," +
        ".main-collection-grid>.sf-toolbar,.main-collection-grid>.sf-pager,.main-collection-grid>.sf-sort-host," +
        ".main-collection-grid>.sf-search-host,results-list>.sf-toolbar,results-list>.sf-pager" +
        "{grid-column:1/-1!important;width:100%!important;max-width:100%!important;display:flex}" +
        ".product-grid>.sf-page-chips,ul.product-grid>.sf-page-chips," +
        ".main-collection-grid>.sf-page-chips,results-list>.sf-page-chips," +
        ".sf-layout-main>.sf-page-chips,.collection-wrapper>.sf-page-chips" +
        "{grid-column:1/-1!important;width:100%!important;max-width:100%!important}" +
        ".sf-collection-layout>.sf-pager,.sf-collection-layout>.sf-toolbar,.sf-collection-layout>.sf-page-chips," +
        ".sf-collection-layout>.sf-sort-host," +
        ".sf-collection-layout>:not(.sf-layout-aside):not(.sf-layout-main):not(.smart-filter):not(.shopify-block)" +
        "{flex:1 1 100%;width:100%;max-width:100%;order:20}" +
        ".sf-layout-main .product-grid,.sf-layout-main ul.product-grid," +
        ".sf-layout-main ol.product-grid,.sf-layout-main .main-collection-grid," +
        ".sf-layout-main .sf-app-grid{width:100%!important;min-width:0;max-width:100%!important;justify-content:stretch!important}" +
        "results-list:has(.sf-collection-layout):not(.product-grid):not(.main-collection-grid)," +
        ".product-grid-container:has(.sf-collection-layout):not(.product-grid):not(.main-collection-grid)" +
        "{display:block!important;grid-template-columns:none!important;width:100%!important;max-width:100%!important}" +
        ".collection-wrapper>.sf-collection-layout" +
        "{grid-column:var(--centered,2 / -2)!important;width:auto!important;max-width:none!important;min-width:0!important}" +
        ".collection-wrapper--grid-full-width>.sf-collection-layout," +
        ".collection-wrapper:has(.collection-wrapper--full-width)>.sf-collection-layout" +
        "{grid-column:var(--full-width,1 / -1)!important}" +
        ".sf-collection-layout .main-collection-grid" +
        "{width:100%!important;max-width:100%!important;min-width:0!important}" +
        ".sf-collection-layout .badge,.sf-collection-layout .card__badge,.sf-collection-layout .product-card__badge" +
        "{writing-mode:horizontal-tb!important;white-space:nowrap;max-width:100%}" +
        "#findly-sf-pager,.sf-pager--pagination,.sf-pager--load-more,.sf-pager--infinite,[data-sf-pager-suppressed='1']," +
        ".sf-collection-layout[data-sf-single-page='1'] nav.pagination," +
        ".sf-collection-layout[data-sf-single-page='1'] .pagination," +
        ".sf-collection-layout[data-sf-single-page='1'] .pagination-wrapper," +
        ".sf-collection-layout[data-sf-single-page='1'] [data-pagination]," +
        ".sf-collection-layout[data-sf-single-page='1'] .paginate," +
        ".sf-collection-layout[data-sf-single-page='1'] #pagination," +
        ".sf-collection-layout[data-sf-single-page='1'] .Pagination" +
        "{display:none!important}" +
        FEW_RESULTS_PAGER_CSS +
        "html:not(.sf-few-results):not(.sf-pager-unneeded):not(.sf-filter-loading):has(.smart-filter) nav.pagination:not(.sf-pager):not([data-sf-pager-suppressed='1']):not([hidden])," +
        "html:not(.sf-few-results):not(.sf-pager-unneeded):not(.sf-filter-loading):has(.smart-filter) .pagination-wrapper:not([data-sf-pager-suppressed='1']):not([hidden])," +
        "html:not(.sf-few-results):not(.sf-pager-unneeded):not(.sf-filter-loading):has(.smart-filter) .pagination:not(.sf-pager):not([data-sf-pager-suppressed='1']):not([hidden])," +
        "html:not(.sf-few-results):not(.sf-pager-unneeded):not(.sf-filter-loading):has(.smart-filter) [data-pagination]:not(.sf-pager):not([data-sf-pager-suppressed='1']):not([hidden])," +
        "html:not(.sf-few-results):not(.sf-pager-unneeded):not(.sf-filter-loading):has(.smart-filter) .paginate:not([data-sf-pager-suppressed='1']):not([hidden])," +
        "html:not(.sf-few-results):not(.sf-pager-unneeded):not(.sf-filter-loading):has(.smart-filter) #pagination:not([data-sf-pager-suppressed='1']):not([hidden])," +
        "html:not(.sf-few-results):not(.sf-pager-unneeded):not(.sf-filter-loading):has(.smart-filter) .Pagination:not([data-sf-pager-suppressed='1']):not([hidden])," +
        "html:not(.sf-few-results):not(.sf-pager-unneeded):not(.sf-filter-loading):has(.smart-filter) #AjaxinatePagination:not([data-sf-pager-suppressed='1']):not([hidden])," +
        "html:not(.sf-few-results):not(.sf-pager-unneeded):not(.sf-filter-loading):has(.smart-filter) .ajaxinate-pagination:not([data-sf-pager-suppressed='1']):not([hidden])" +
        "{display:flex!important;flex-direction:row!important;flex-wrap:wrap!important;justify-content:center!important;align-items:center;grid-column:1/-1!important;width:100%!important;max-width:100%!important;visibility:visible!important}" +
        "@media(max-width:989px){" +
        ".sf-collection-layout--left,.sf-collection-layout--right," +
        ".sf-collection-layout--top,.sf-collection-layout--offcanvas{" +
        "display:block!important;grid-template-columns:none!important;gap:0!important}" +
        ".sf-collection-layout>.sf-layout-aside:not(:has([data-drawer-toggle])):not(:has([data-drawer-panel]))," +
        ".sf-collection-layout>.shopify-block.sf-layout-aside:not(:has([data-drawer-toggle])):not(:has([data-drawer-panel]))" +
        "{display:none!important}" +
        "}" +
        ".sf-collection-layout--offcanvas>.sf-layout-aside:not(:has([data-drawer-toggle])):not(:has([data-drawer-panel]))," +
        ".sf-collection-layout--offcanvas>.shopify-block.sf-layout-aside:not(:has([data-drawer-toggle])):not(:has([data-drawer-panel]))" +
        "{display:none!important}" +
        ".sf-collection-layout--offcanvas>.sf-layout-aside," +
        ".sf-collection-layout--offcanvas>.shopify-block.sf-layout-aside" +
        "{padding:0!important;margin:0!important;min-height:0!important}" +
        "@media(min-width:990px){" +
        ".sf-collection-layout--left{display:grid!important;grid-template-columns:320px minmax(0,1fr)!important;align-items:start;gap:32px;width:100%!important;max-width:100%!important}" +
        ".sf-collection-layout--right{display:grid!important;grid-template-columns:minmax(0,1fr) 320px!important;align-items:start;gap:32px;width:100%!important;max-width:100%!important}" +
        ".sf-collection-layout--left>.sf-layout-aside,.sf-collection-layout--left>.smart-filter," +
        ".sf-collection-layout--left>.shopify-block:has(.smart-filter)" +
        "{grid-column:1!important;width:320px;max-width:320px;min-width:320px}" +
        ".sf-collection-layout--left>.sf-layout-main,.sf-collection-layout--left>.sf-toolbar," +
        ".sf-collection-layout--left>.sf-pager,.sf-collection-layout--left>.sf-sort-host" +
        "{grid-column:2!important;min-width:0!important;width:auto!important;max-width:none!important}" +
        ".sf-collection-layout--right>.sf-layout-aside,.sf-collection-layout--right>.smart-filter," +
        ".sf-collection-layout--right>.shopify-block:has(.smart-filter)" +
        "{grid-column:2!important;width:320px;max-width:320px;min-width:320px}" +
        ".sf-collection-layout--right>.sf-layout-main,.sf-collection-layout--right>.sf-toolbar," +
        ".sf-collection-layout--right>.sf-pager" +
        "{grid-column:1!important;min-width:0!important;max-width:none!important}" +
        ".sf-collection-layout--top{display:flex!important;flex-direction:column;gap:16px;width:100%}" +
        ".sf-collection-layout--top>.sf-layout-aside,.sf-collection-layout--top>.smart-filter," +
        ".sf-collection-layout--top>.shopify-block:has(.smart-filter)" +
        "{flex:0 0 auto!important;width:100%!important;max-width:100%!important;min-width:0!important}" +
        ".sf-toggle,.sf-sort-host .sf-toggle-toolbar{display:none!important}" +
        ".smart-filter--offcanvas .sf-toggle," +
        ".sf-collection-layout--offcanvas .sf-toggle," +
        ".sf-collection-layout--offcanvas .sf-toggle-toolbar," +
        ".sf-collection-layout--offcanvas .sf-toolbar .sf-toggle" +
        "{display:inline-flex!important;align-items:center;justify-content:center;gap:.45rem;width:auto;min-width:7.5rem;min-height:2.5rem;margin:0;padding:.5rem 1rem;border:0!important;border-radius:999px!important;background:#111!important;color:#fff!important;font:inherit!important;font-weight:600;cursor:pointer;box-shadow:none!important}" +
        "}" +
        ".sf-toolbar{display:flex;align-items:flex-start;justify-content:space-between;gap:12px 24px;width:100%;max-width:100%;margin:0 0 18px;box-sizing:border-box}" +
        ".sf-toolbar-search,.sf-search-host.sf-toolbar-search{flex:1 1 16rem;min-width:0;width:min(22rem,100%);max-width:22rem;margin:0}" +
        ".sf-toolbar-end{display:flex;flex-direction:column;align-items:flex-end;flex:0 0 auto;gap:0;min-width:0}" +
        ".sf-toolbar-actions{display:flex;align-items:center;justify-content:flex-end;gap:.65rem;min-width:0}" +
        ".sf-sort-host{display:flex;justify-content:flex-end;width:auto;margin:0;overflow:visible;position:relative;z-index:6}" +
        ".sf-toolbar .sf-sort-toolbar{display:flex;align-items:flex-end;gap:0;width:auto;margin:0;flex-wrap:nowrap}" +
        ".sf-sort-control{display:flex;flex-direction:column;align-items:stretch;gap:.35rem;min-width:0}" +
        ".sf-sort-row{display:flex!important;align-items:center!important;gap:.7rem;width:auto;overflow:visible}" +
        ".sf-sort-row .sf-sort-trigger{flex:0 0 auto;width:auto;min-width:10.75rem}" +
        ".sf-toolbar .sf-sort-label,.sf-sort-row .sf-sort-label{display:block!important;flex:0 0 auto;align-self:center!important;box-sizing:border-box;height:auto!important;min-height:0!important;font-weight:500;font-size:.875em;color:#6d6d6d;line-height:1.25!important;padding:0!important;margin:0!important;white-space:nowrap}" +
        ".sf-toolbar .sf-sort-select{width:100%;min-width:10.75rem;max-width:16rem;min-height:2.5rem;padding:.5rem 2rem .5rem .85rem;border:1px solid #e2e2e2!important;border-radius:10px;background-color:#fff!important;background-image:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath fill='none' stroke='%235c5c5c' stroke-width='1.4' d='M1.2 1.4L6 6.2L10.8 1.4'/%3E%3C/svg%3E\");background-repeat:no-repeat;background-position:right .75rem center;background-size:.7rem;appearance:none!important;-webkit-appearance:none!important;outline:none}" +
        ".sf-toolbar .sf-sort-select:focus,.sf-toolbar .sf-sort-select:focus-visible{border-color:#111!important;box-shadow:0 0 0 3px rgb(17 17 17 / 10%)}" +
        ".sf-search-host{display:block;width:auto;max-width:22rem;margin:0}" +
        ".sf-total-count{margin:0;font-size:.8125em;line-height:1.3;color:#6d6d6d;white-space:nowrap;text-align:right}" +
        ".sf-total-count[hidden],.sf-toolbar-search:not(:has(.sf-search:not([hidden]))){display:none!important}" +
        ".sf-toolbar:not(:has(.sf-toolbar-search:has(.sf-search:not([hidden])))){justify-content:flex-end}" +
        ".sf-sort-host:not(:has(.sf-sort:not([hidden]))){display:none}" +
        ".smart-filter>.sf-search{display:none!important}" +
        ".sf-search-toolbar{display:block;width:100%;max-width:22rem;margin:0}" +
        ".sf-search-field{display:flex;align-items:center;gap:.65rem;box-sizing:border-box;width:100%;min-height:2.5rem;padding:0 .4rem 0 .9rem;border:1px solid #e2e2e2;border-radius:10px;background:#fff}" +
        ".sf-search-field:hover{border-color:#cfcfcf}" +
        ".sf-search-field:focus-within{border-color:#111;box-shadow:0 0 0 3px rgb(17 17 17 / 10%)}" +
        ".sf-search-icon{display:flex;align-items:center;justify-content:center;flex:0 0 18px;width:18px;height:18px;color:#6d6d6d;opacity:1;pointer-events:none}" +
        ".sf-search-icon svg{display:block;width:18px;height:18px}" +
        ".sf-toolbar .sf-search-input,.sf-search-toolbar .sf-search-input{width:100%;max-width:none;min-width:0;min-height:2.4rem;padding:.45rem 0!important;border:0!important;border-radius:0!important;background:transparent!important;box-shadow:none!important;outline:none;font:inherit;color:inherit;appearance:none;-webkit-appearance:none}" +
        ".sf-toolbar .sf-search-input::placeholder{color:#8a8a8a;opacity:1}" +
        ".sf-search-input::-webkit-search-decoration,.sf-search-input::-webkit-search-cancel-button{-webkit-appearance:none;appearance:none}" +
        ".sf-search-clear{appearance:none;-webkit-appearance:none;display:inline-flex;align-items:center;justify-content:center;flex:0 0 1.75rem;width:1.75rem;height:1.75rem;margin:0;padding:0;border:0;border-radius:999px;background:#f0f0f0;color:#5c5c5c;cursor:pointer;opacity:1}" +
        ".sf-search-clear svg{display:block;width:11px;height:11px}" +
        ".sf-search-clear:hover,.sf-search-clear:focus-visible{background:#e4e4e4;color:#111;outline:none}" +
        ".sf-search-clear[hidden]{display:none!important}" +
        "@media(max-width:989px){" +
        ".sf-toolbar{display:flex;flex-wrap:wrap;flex-direction:column;align-items:stretch;gap:.65rem}" +
        ".sf-toolbar:has(>.sf-toggle){display:grid;grid-template-columns:1fr 1fr;grid-template-areas:\"search search\" \"filter end\";align-items:stretch;column-gap:.55rem;row-gap:.65rem}" +
        ".sf-toolbar-search,.sf-search-host.sf-toolbar-search{flex:1 1 100%;order:1;min-width:0;max-width:none;width:100%}" +
        ".sf-toolbar:has(>.sf-toggle) .sf-toolbar-search,.sf-toolbar:has(>.sf-toggle) .sf-search-host.sf-toolbar-search{grid-area:search;flex:none;width:100%;max-width:none}" +
        ".sf-search-toolbar{max-width:none;width:100%}" +
        ".smart-filter:not(.sf-panel):not(:has([data-drawer-toggle])):not(.is-drawer-open){display:none}" +
        ".sf-panel.sf-drawer-portal,html.is-sf-drawer-open .sf-panel.sf-drawer-portal,.sf-panel.sf-drawer-portal.is-open{display:flex!important;visibility:visible!important}" +
        ".sf-toolbar>.sf-toggle,.sf-toolbar>.sf-toggle-toolbar{grid-area:filter;width:100%;max-width:none;margin:0}" +
        ".sf-toolbar-end{order:2;flex:1 1 100%;margin:0;align-items:stretch;min-width:0;width:100%}" +
        ".sf-toolbar:has(>.sf-toggle) .sf-toolbar-end{grid-area:end;flex:none;width:100%;min-width:0;align-items:stretch}" +
        ".sf-toolbar:has(>.sf-toggle) .sf-sort-host,.sf-toolbar:has(>.sf-toggle) .sf-sort-toolbar,.sf-toolbar:has(>.sf-toggle) .sf-sort-row,.sf-toolbar:has(>.sf-toggle) .sf-sort-control,.sf-toolbar:has(>.sf-toggle) .sf-sort-trigger{width:100%;max-width:none;min-width:0}" +
        ".sf-toolbar-actions{width:100%}" +
        ".sf-toolbar-actions:has(.sf-toggle){display:grid;grid-template-columns:1fr 1fr;align-items:stretch;gap:.55rem}" +
        ".sf-toolbar .sf-sort-label{display:none!important}" +
        ".sf-toolbar .sf-sort-host,.sf-toolbar .sf-sort-toolbar,.sf-toolbar .sf-sort-row,.sf-toolbar .sf-sort-control,.sf-toolbar .sf-sort-trigger{width:100%;max-width:none;min-width:0}" +
        ".sf-toolbar .sf-sort-select,.sf-toolbar .sf-sort-btn{width:100%;min-width:0;max-width:none;min-height:2.75rem;padding:.5rem 2.25rem .5rem .9rem;border-radius:999px;background-color:#fff!important;background-image:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath fill='none' stroke='%235c5c5c' stroke-width='1.4' d='M1.2 1.4L6 6.2L10.8 1.4'/%3E%3C/svg%3E\")!important;background-repeat:no-repeat!important;background-position:right .9rem center!important;background-size:.7rem!important;appearance:none!important;-webkit-appearance:none!important;border:1px solid #e2e2e2!important}" +
        ".sf-toolbar .sf-sort-btn{background-image:none!important}" +
        ".sf-toolbar .sf-search-field,.sf-toolbar .sf-search-input{min-width:0;width:100%;max-width:none}" +
        ".sf-toggle,.sf-toolbar .sf-toggle,.sf-toggle-toolbar{display:inline-flex!important;align-items:center;justify-content:center;gap:.45rem;width:100%;min-height:2.75rem;margin:0;padding:.55rem 1rem;border:0!important;border-radius:999px!important;background:#111!important;color:#fff!important;font:inherit!important;font-size:15px!important;font-weight:600;box-shadow:none!important;white-space:nowrap}" +
        ".sf-icon,.sf-icon svg{display:block!important;width:15px!important;height:15px!important}" +
        ".sf-btn-label{font-size:15px!important}" +
        ".sf-toolbar .sf-badge,.sf-toggle-toolbar .sf-badge{background:#fff;color:#111}" +
        ".sf-badge[hidden],.sf-badge:empty{display:none!important}" +
        "}" +
        ".collection-wrapper:has([data-findly-theme-hidden='1']) .main-collection-grid," +
        "results-list:has(> [data-findly-theme-hidden='1']) .main-collection-grid{grid-column:1/-1}" +
        RESULTS_LIST_BLOCK_CSS +
        PRODUCT_GRID_KEEP_CSS +
        PRODUCT_GRID_START_CSS +
        ".smart-filter .sf-option input[type=checkbox]," +
        ".smart-filter .sf-option input[type=radio]{" +
        "appearance:none!important;-webkit-appearance:none!important;opacity:1!important;visibility:visible!important;" +
        "position:relative!important;width:16px!important;height:16px!important;min-width:16px!important;margin:2px 0 0!important;" +
        "border:1px solid #cfcfcf!important;display:inline-grid!important;clip:auto!important;transform:none!important}" +
        ".sf-app-grid>.sf-pager:not(.sf-pager--pagination),.sf-app-grid>.sf-toolbar,.sf-app-grid>.sf-page-chips,.sf-app-grid>.sf-sort-host,.sf-app-grid>.sf-search-host,.sf-app-grid>.sf-grid-empty{display:block!important;visibility:visible!important}" +
        ".sf-app-grid>:not(.sf-app-card):not(.sf-pager):not(.sf-toolbar):not(.sf-page-chips):not(.sf-sort-host):not(.sf-search-host):not(.sf-grid-empty){display:none!important}";
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
      document.getElementById("findly-catalog-grid-v7") ||
      document.getElementById("findly-catalog-grid-v8") ||
      document.getElementById("findly-catalog-grid-v9") ||
      document.getElementById("findly-catalog-grid-v10") ||
      document.getElementById("findly-catalog-grid-v11") ||
      document.getElementById("findly-catalog-grid-v12") ||
      document.getElementById("findly-catalog-grid-v13") ||
      document.getElementById("findly-catalog-grid-v14") ||
      document.getElementById("findly-catalog-grid-v15");
    if (oldCatalog && oldCatalog.parentNode) oldCatalog.parentNode.removeChild(oldCatalog);
    if (document.getElementById("findly-catalog-grid-v16")) return;
    var catalog = document.createElement("style");
    catalog.id = "findly-catalog-grid-v16";
    catalog.textContent =
      "#" +
      CARD_TRAY_ID +
      "{display:none!important;position:absolute;left:-9999px;width:0;height:0;overflow:hidden}" +
      RESULTS_LIST_BLOCK_CSS +
      PRODUCT_GRID_KEEP_CSS +
      PRODUCT_GRID_START_CSS +
      GRID_BUSY_CSS +
      ".sf-fill-card{display:flex;flex-direction:column;gap:.45rem;min-width:0;height:100%;color:inherit;text-decoration:none}" +
      ".sf-fill-card img{display:block;width:100%;max-width:100%;aspect-ratio:1;object-fit:cover;background:#f3f3f3;border-radius:8px}" +
      ".sf-fill-card-title{margin:0;font:inherit;font-weight:450;line-height:1.3}" +
      ".sf-fill-card-price{margin:0;font:inherit}";
    (document.head || document.documentElement).appendChild(catalog);
  }

  function setOwnsGrid(on) {
    var root = document.documentElement;
    if (!root || !root.classList) return;
    if (on) root.classList.add("sf-og");
    else root.classList.remove("sf-og");
  }

  /** Only while filters/search/sort own the grid — never on unfiltered theme browse. */
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

  function stripThemePageParamIfFiltering(widget) {
    if (!shouldTakeOverThemeCards(widget)) return;
    stripThemePageParam();
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
    if (
      node.hidden &&
      node.getAttribute("data-smart-filter-hidden") === "true"
    ) {
      return;
    }
    node.hidden = true;
    node.setAttribute("data-smart-filter-hidden", "true");
    node.style.setProperty("display", "none", "important");
  }

  function forceCardVisible(node) {
    if (!node || !node.style) return;
    node.style.removeProperty("opacity");
    node.style.removeProperty("visibility");
    node.style.setProperty("opacity", "1");
    node.style.setProperty("visibility", "visible");
  }

  function showEl(node) {
    if (!node || node.nodeType !== 1) return;
    if (
      !node.hidden &&
      !node.hasAttribute("data-smart-filter-hidden") &&
      !(node.classList && node.classList.contains("hidden"))
    ) {
      /* Still clear display:none if we set it earlier. */
      if (!node.style || !node.style.getPropertyValue("display")) {
        forceCardVisible(node);
        return;
      }
    }
    node.hidden = false;
    node.removeAttribute("hidden");
    node.removeAttribute("data-smart-filter-hidden");
    if (node.classList) node.classList.remove("hidden");
    node.style.removeProperty("display");
    forceCardVisible(node);
  }

  function restoreThemeHidden(node) {
    if (!node || node.nodeType !== 1) return;
    if (node.getAttribute("data-findly-theme-hidden") !== "1") return;
    var prev = node.getAttribute("data-findly-theme-display");
    node.removeAttribute("data-findly-theme-hidden");
    node.removeAttribute("data-findly-theme-display");
    node.removeAttribute("data-findly-native-chrome");
    node.removeAttribute("hidden");
    if (node.classList) node.classList.remove("hidden");
    node.hidden = false;
    if (prev) node.style.display = prev;
    else node.style.removeProperty("display");
  }

  function restoreFindlyPanelChrome(panel) {
    if (!panel || !panel.querySelectorAll) return;
    if (panel.getAttribute("data-findly-theme-hidden") === "1") {
      restoreThemeHidden(panel);
    }
    panel.removeAttribute("data-findly-native-chrome");
    var nodes = panel.querySelectorAll(
      "[data-findly-theme-hidden='1'], [data-findly-native-chrome='1']",
    );
    var i;
    for (i = 0; i < nodes.length; i++) {
      restoreThemeHidden(nodes[i]);
      nodes[i].removeAttribute("data-findly-native-chrome");
      nodes[i].removeAttribute("hidden");
      nodes[i].hidden = false;
      if (nodes[i].classList) nodes[i].classList.remove("hidden");
      if (nodes[i].style) nodes[i].style.removeProperty("display");
    }
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
    ".page-width:not(.page-width--full), .page-width-desktop, .page-width--narrow, .page-width--compact, .container:not(.container-fluid), .Container, .wrapper, .page-container, .collection-wrapper";

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
      cls.contains("sf-app-grid")
    );
  }

  function queryInnerCardGrid(el) {
    if (!el || !el.querySelector) return null;
    return (
      el.querySelector("ul#product-grid") ||
      el.querySelector("#product-grid") ||
      el.querySelector("#ProductGrid") ||
      el.querySelector("ul.product-grid") ||
      el.querySelector("ol.product-grid") ||
      el.querySelector("[product-grid-view]") ||
      el.querySelector(".product-grid.main-collection-grid") ||
      el.querySelector(".main-collection-grid") ||
      el.querySelector(".ProductList--grid") ||
      el.querySelector(".productgrid--items") ||
      el.querySelector(".grid--view-items") ||
      el.querySelector(".ProductList") ||
      el.querySelector("[data-product-grid]")
    );
  }

  function isPageShellHost(el) {
    if (!el || el.nodeType !== 1) return false;
    var id = String(el.id || "");
    if (id === "ProductGridContainer" || id === "CollectionProductGrid") {
      return true;
    }
    var cls = el.classList;
    if (cls) {
      if (cls.contains("collection-wrapper")) return true;
      if (cls.contains("product-grid-container") && !cls.contains("product-grid")) {
        return true;
      }
      if (cls.contains("sf-collection-layout")) return true;
      if (
        cls.contains("sf-layout-main") &&
        !cls.contains("product-grid") &&
        !cls.contains("main-collection-grid") &&
        !cls.contains("ProductList") &&
        !cls.contains("productgrid--items")
      ) {
        return true;
      }
    }
    return Boolean(isResultsListEl(el) && queryInnerCardGrid(el));
  }

  function isActualCardGrid(el) {
    if (!el || el.nodeType !== 1 || isPageShellHost(el)) return false;
    if (el.getAttribute && el.getAttribute("product-grid-view") != null) {
      return true;
    }
    if (el.id === "product-grid" || el.id === "ProductGrid") return true;
    var cls = el.classList;
    if (cls) {
      if (cls.contains("product-grid") || cls.contains("main-collection-grid")) {
        return true;
      }
      if (cls.contains("ProductList") || cls.contains("productgrid--items")) {
        return true;
      }
      if (cls.contains("grid--view-items") || cls.contains("products-grid")) {
        return true;
      }
    }
    var kids = collectDirectThemeCards(el);
    return Boolean(kids && kids.length >= 1);
  }

  function preferProductCardGrid(el) {
    if (!el || el.nodeType !== 1) return el;
    if (isActualCardGrid(el)) {
      captureThemeGridLayout(el);
      return el;
    }
    var inner = queryInnerCardGrid(el);
    if (inner && inner !== el) {
      captureThemeGridLayout(inner);
      return inner;
    }
    return el;
  }

  var themeGridSnaps = typeof WeakMap !== "undefined" ? new WeakMap() : null;

  function hostLayoutWidth(host) {
    if (!host || typeof host.getBoundingClientRect !== "function") return 0;
    try {
      return host.getBoundingClientRect().width || 0;
    } catch (err) {
      return 0;
    }
  }

  function tracksLookUsable(value) {
    var text = String(value || "").trim();
    if (!text || text === "none" || text === "normal" || text === "auto") {
      return false;
    }
    if (/^0px(\s+0px)*$/.test(text)) return false;
    return true;
  }

  function readCachedGridSnap(host) {
    if (!host) return null;
    if (themeGridSnaps && themeGridSnaps.has(host)) return themeGridSnaps.get(host);
    return host._sfGridSnap || null;
  }

  function storeGridSnap(host, snap) {
    if (!host || !snap) return;
    if (themeGridSnaps) themeGridSnaps.set(host, snap);
    else host._sfGridSnap = snap;
  }

  function captureThemeGridLayout(host) {
    if (!host || host.nodeType !== 1) return null;
    var existing = readCachedGridSnap(host);
    if (existing && (existing.horizonCols || tracksLookUsable(existing.gridTemplateColumns))) {
      return existing;
    }
    if (hostLayoutWidth(host) < 80) return existing;
    var snap = null;
    try {
      if (typeof window.getComputedStyle !== "function") return existing;
      var cs = window.getComputedStyle(host);
      snap = {
        display: String(cs.display || "").toLowerCase(),
        gridTemplateColumns: String(cs.gridTemplateColumns || "").trim(),
        flexWrap: String(cs.flexWrap || "").trim(),
        gap: String(cs.gap || "").trim(),
        columnGap: String(cs.columnGap || "").trim(),
        rowGap: String(cs.rowGap || "").trim(),
        horizonCols: String(
          cs.getPropertyValue("--product-grid-columns-desktop") || "",
        ).trim(),
      };
    } catch (err) {
      snap = null;
    }
    if (!snap) return existing;
    if (
      !snap.horizonCols &&
      snap.display.indexOf("grid") !== -1 &&
      !tracksLookUsable(snap.gridTemplateColumns)
    ) {
      return existing;
    }
    storeGridSnap(host, snap);
    return snap;
  }

  function ensureFallbackProductGridTracks(host) {
    if (!host || !host.style || typeof host.style.setProperty !== "function") {
      return;
    }
    if (isResultsListEl(host) || isPageShellHost(host)) return;
    var id = host.id || "";
    var looksLikeGrid =
      isProductGridLike(host) ||
      (host.classList && host.classList.contains("sf-app-grid")) ||
      id === "product-grid" ||
      id === "ProductGrid" ||
      id === "findly-grid-host";
    if (!looksLikeGrid) return;
    try {
      if (typeof window.getComputedStyle !== "function") {
        host.style.setProperty(
          "grid-template-columns",
          "repeat(auto-fill, minmax(min(100%, 14rem), 1fr))",
        );
        return;
      }
      var cs = window.getComputedStyle(host);
      if (tracksLookUsable(cs.gridTemplateColumns)) return;
      if (String(cs.getPropertyValue("--product-grid-columns-desktop") || "").trim()) {
        return;
      }
      if (String(cs.display || "").indexOf("grid") === -1) {
        host.style.setProperty("display", "grid");
      }
      host.style.setProperty(
        "grid-template-columns",
        "repeat(auto-fill, minmax(min(100%, 14rem), 1fr))",
      );
    } catch (err) {
      /* ignore */
    }
  }

  function lockThemeGridTracks(host) {
    host = preferProductCardGrid(host) || host;
    if (!host || !host.style || typeof host.style.setProperty !== "function") {
      return;
    }
    try {
      host.style.removeProperty("grid-template-columns");
      host.style.removeProperty("grid-template-rows");
    } catch (err) {
      /* ignore */
    }
    var snap = captureThemeGridLayout(host);
    if (!snap) {
      ensureFallbackProductGridTracks(host);
      return;
    }
    var display = String(snap.display || "");
    if (display.indexOf("flex") !== -1) {
      if (snap.flexWrap) host.style.setProperty("flex-wrap", snap.flexWrap);
      return;
    }
    if (display.indexOf("grid") === -1) {
      ensureFallbackProductGridTracks(host);
      return;
    }
    if (snap.horizonCols) {
      host.style.setProperty("--product-grid-columns-desktop", snap.horizonCols);
    }
    if (tracksLookUsable(snap.gridTemplateColumns)) {
      host.style.setProperty("grid-template-columns", snap.gridTemplateColumns);
    } else if (!snap.horizonCols) {
      ensureFallbackProductGridTracks(host);
    }
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
    if (el.classList.contains("collection-wrapper")) {
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
    var searchWidth = ensureSearchThemeWidthShell(grid);
    if (searchWidth) return searchWidth;
    if (!grid || !grid.nodeType) return null;
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
    for (i = 0; i < nodes.length; i++) {
      if (!nodes[i] || isFullBleedHost(nodes[i])) continue;
      /* Never return a header-only .page-width that does not contain the grid
         (Dawn search: title lives in .page-width, #product-grid is a sibling). */
      if (nodes[i].contains && nodes[i].contains(grid)) return nodes[i];
    }
    return null;
  }

  function isSearchPageContext(widget) {
    /* Search TEMPLATE only — never treat collection in-grid search as /search. */
    try {
      var path = String((window.location && window.location.pathname) || "");
      if (/\/search\/?$/i.test(path) || /^\/search\//i.test(path)) return true;
      if (
        document.querySelector(
          ".template-search, #main-search, .main-search, #SearchPage, .search-page," +
            "[data-section-type='search'], [data-section-type='search-template']," +
            "[data-section-type='search-results'], #shopify-section-main-search," +
            ".shopify-section--main-search, [data-template='search']",
        )
      ) {
        return true;
      }
      /* Liquid stamps data-search-query only on search templates. */
      if (document.querySelector(".smart-filter[data-search-query]")) return true;
      var body = document.body;
      if (body && body.classList && body.classList.contains("template-search")) {
        return true;
      }
      if (widget && widget.root && widget.root.getAttribute) {
        if (widget.root.getAttribute("data-search-query") != null) return true;
      }
    } catch (err) {
      /* ignore */
    }
    return false;
  }

  function isSearchShellEl(node) {
    if (!node || node.nodeType !== 1) return false;
    if (node.classList) {
      if (node.classList.contains("sf-search-width")) return true;
      if (node.classList.contains("template-search")) return true;
      if (node.classList.contains("main-search")) return true;
      if (node.classList.contains("search-page")) return true;
      if (node.classList.contains("shopify-section--main-search")) return true;
    }
    var id = String(node.id || "").toLowerCase();
    if (
      id === "main-search" ||
      id === "searchpage" ||
      id === "search-page" ||
      id === "shopify-section-main-search" ||
      (id.indexOf("main-search") !== -1 && id.indexOf("predictive") === -1)
    ) {
      return true;
    }
    if (node.getAttribute) {
      var sectionType = String(node.getAttribute("data-section-type") || "");
      if (
        sectionType === "search" ||
        sectionType === "search-template" ||
        sectionType === "search-results"
      ) {
        return true;
      }
      if (String(node.getAttribute("data-template") || "") === "search") {
        return true;
      }
    }
    return false;
  }

  function closestSearchShell(el) {
    var node = el;
    var hops = 0;
    while (node && node.nodeType === 1 && hops < 16) {
      if (isSearchShellEl(node)) return node;
      if (isFullBleedHost(node) && node !== el && !isSearchShellEl(node)) {
        /* Keep walking through main/section only if it looks like search. */
        var sid = String(node.id || "").toLowerCase();
        if (
          node.classList &&
          (node.classList.contains("shopify-section") || isFullBleedHost(node)) &&
          sid.indexOf("search") !== -1 &&
          sid.indexOf("predictive") === -1
        ) {
          return node;
        }
        if (!node.classList || !node.classList.contains("shopify-section")) break;
      }
      node = node.parentElement;
      hops += 1;
    }
    try {
      return document.querySelector(
        ".template-search, #main-search, .main-search, #SearchPage, .search-page," +
          "#shopify-section-main-search, .shopify-section--main-search," +
          "[data-section-type='search'], [data-section-type='search-template']," +
          "[data-section-type='search-results'], [data-template='search']",
      );
    } catch (err) {
      return null;
    }
  }

  function pickSearchWidthClassName(shell) {
    var sample =
      (shell &&
        shell.querySelector &&
        shell.querySelector(
          ".page-width:not(.page-width--full), .page-width-desktop, .page-width--narrow," +
            ".container:not(.container-fluid), .Container, .page-container, .wrapper",
        )) ||
      document.querySelector(THEME_WIDTH_SELECTOR);
    if (sample && sample.classList) {
      if (sample.classList.contains("page-width-desktop")) {
        return "page-width-desktop sf-search-width";
      }
      if (sample.classList.contains("page-width--narrow")) {
        return "page-width page-width--narrow sf-search-width";
      }
      if (sample.classList.contains("page-width")) {
        return "page-width sf-search-width";
      }
      if (sample.classList.contains("container") && !sample.classList.contains("container-fluid")) {
        return "container sf-search-width";
      }
      if (sample.classList.contains("Container")) return "Container sf-search-width";
      if (sample.classList.contains("page-container")) {
        return "page-container sf-search-width";
      }
      if (sample.classList.contains("wrapper")) return "wrapper sf-search-width";
    }
    return "page-width sf-search-width";
  }

  /* Search pages only: title/form often sit in a theme width box while the
     product grid is a sibling. Wrap both in one shell so Vertical layout
     matches collections. No-op on collection templates. */
  function ensureSearchThemeWidthShell(grid) {
    if (!grid || !isSearchPageContext()) return null;
    if (closestThemeWidth(grid)) return null;
    var existing =
      (grid.closest && grid.closest(".sf-search-width")) ||
      document.querySelector(".sf-search-width");
    if (existing && existing.contains && existing.contains(grid)) {
      return existing;
    }
    var shell = closestSearchShell(grid);
    if (!shell || isThemeWidthContainer(shell)) return null;
    if (shell.classList && shell.classList.contains("sf-search-width")) {
      return shell;
    }
    var already =
      shell.querySelector &&
      shell.querySelector(
        ":scope > .sf-search-width, :scope > .page-width.sf-search-width, :scope > .container.sf-search-width",
      );
    if (already && already.contains(grid)) return already;
    /* Only wrap when the shell actually contains the results grid. */
    if (!shell.contains(grid)) return null;
    var width = document.createElement("div");
    width.className = pickSearchWidthClassName(shell);
    while (shell.firstChild) width.appendChild(shell.firstChild);
    shell.appendChild(width);
    return width;
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
      parent.classList.contains("sf-layout-main") &&
      !isProductGridLike(parent)
    ) {
      return parent;
    }
    if (isProductGridLike(host) || hostDisplay(host) === "contents") {
      if (host.classList) host.classList.remove("sf-layout-main");
      var gridWrap = document.createElement("div");
      gridWrap.className = "sf-layout-main";
      parent.insertBefore(gridWrap, host);
      gridWrap.appendChild(host);
      return gridWrap;
    }
    if (host.classList && host.classList.contains("sf-layout-main")) {
      return host;
    }
    if (!needsBlockMainWrap(host)) return host;
    var wrap = document.createElement("div");
    wrap.className = "sf-layout-main";
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
        existing.querySelector(".sf-layout-main") || existing
      );
    }
    var nested =
      pageWidth.querySelector && pageWidth.querySelector(".sf-collection-layout");
    if (nested) {
      return nested.querySelector(".sf-layout-main") || nested;
    }
    var main = document.createElement("div");
    main.className = "sf-layout-main";
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
      pageWidth = ensureSearchThemeWidthShell(grid || host);
    }
    if (!pageWidth) {
      pageWidth = findThemeWidthNearMain(grid || host);
    }
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
        /* Search: keep title/form + results together in one main column. */
        if (
          pageWidth.classList &&
          pageWidth.classList.contains("sf-search-width")
        ) {
          return wrapInsidePageWidth(pageWidth) || ensureBlockMain(child);
        }
        return ensureBlockMain(child);
      }
      return wrapInsidePageWidth(pageWidth) || ensureBlockMain(host);
    }
    return ensureBlockMain(host);
  }

  function liftLayoutOutOfProductGrid(layout) {
    if (!layout || !layout.parentNode) return;
    var guard = 0;
    while (
      layout.parentNode &&
      isProductGridLike(layout.parentNode) &&
      !isPageShellHost(layout.parentNode) &&
      !isThemeWidthContainer(layout.parentNode) &&
      guard < 8
    ) {
      var gridHost = layout.parentNode;
      var grand = gridHost.parentNode;
      if (!grand) break;
      grand.insertBefore(layout, gridHost);
      var main = null;
      var ci;
      for (ci = 0; ci < layout.children.length; ci++) {
        if (
          layout.children[ci].classList &&
          layout.children[ci].classList.contains("sf-layout-main")
        ) {
          main = layout.children[ci];
          break;
        }
      }
      if (!main) {
        main = document.createElement("div");
        main.className = "sf-layout-main";
        layout.appendChild(main);
      }
      if (gridHost.parentNode === grand && !main.contains(gridHost)) {
        main.appendChild(gridHost);
      }
      if (main.classList) main.classList.add("sf-layout-main");
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
      if (child.classList.contains("sf-layout-aside")) aside = child;
      if (child.classList.contains("sf-layout-main")) main = child;
    }
    if (!main) {
      main = document.createElement("div");
      main.className = "sf-layout-main";
      layout.appendChild(main);
    }
    if (main.classList) {
      main.classList.remove("sf-layout-aside");
      main.classList.add("sf-layout-main");
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
      if (node.classList && node.classList.contains("sf-layout-aside")) {
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

  function horizonLayoutColumn(wrap) {
    if (
      wrap &&
      wrap.classList &&
      (wrap.classList.contains("collection-wrapper--grid-full-width") ||
        (wrap.querySelector && wrap.querySelector(".collection-wrapper--full-width")))
    ) {
      return "var(--full-width, 1 / -1)";
    }
    return "var(--centered, 2 / -2)";
  }

  function flattenHorizonCollectionWrapper(layout) {
    if (!layout) return;
    var wrap =
      (layout.closest && layout.closest(".collection-wrapper")) ||
      layout.querySelector(".collection-wrapper");
    if (wrap && layout.parentNode === wrap) {
      applyImportantStyle(layout, "grid-column", horizonLayoutColumn(wrap));
    }
    if (
      layout.getAttribute &&
      layout.getAttribute("data-sf-horizon-flat") === "1"
    ) {
      return;
    }
    applyImportantStyle(layout, "width", "100%");
    applyImportantStyle(layout, "max-width", "100%");
    applyImportantStyle(layout, "min-width", "0");

    var list =
      (layout.closest && layout.closest("results-list")) ||
      (layout.closest && layout.closest(".product-grid-container"));
    if (list && !isActualCardGrid(list) && list !== wrap) {
      applyImportantStyle(list, "display", "block");
      applyImportantStyle(list, "width", "100%");
      applyImportantStyle(list, "max-width", "100%");
    }

    var grids = layout.querySelectorAll
      ? layout.querySelectorAll(
          ".main-collection-grid, ul.product-grid, ol.product-grid, .sf-app-grid",
        )
      : [];
    var i;
    for (i = 0; i < grids.length; i++) {
      applyImportantStyle(grids[i], "width", "100%");
      applyImportantStyle(grids[i], "max-width", "100%");
      applyImportantStyle(grids[i], "min-width", "0");
    }

    var pagers = layout.querySelectorAll
      ? layout.querySelectorAll(".sf-pager-nav, .sf-pager-pages")
      : [];
    for (i = 0; i < pagers.length; i++) {
      if (
        pagers[i].getAttribute &&
        pagers[i].getAttribute("data-sf-pager-suppressed") === "1"
      ) {
        continue;
      }
      if (pagers[i].hidden || (pagers[i].hasAttribute && pagers[i].hasAttribute("hidden"))) {
        continue;
      }
      applyImportantStyle(pagers[i], "display", "flex");
      applyImportantStyle(pagers[i], "flex-direction", "row");
      applyImportantStyle(pagers[i], "flex-wrap", "wrap");
      applyImportantStyle(pagers[i], "justify-content", "center");
      applyImportantStyle(pagers[i], "align-items", "center");
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
      var stamped = layout.querySelectorAll(".sf-layout-main");
      var si;
      for (si = 0; si < stamped.length; si++) {
        if (isProductGridLike(stamped[si]) || isThemeManagedGrid(stamped[si])) {
          stamped[si].classList.remove("sf-layout-main");
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
          var mainCol = layout.querySelector(".sf-layout-main");
          if (mainCol && !mainCol.contains(child)) mainCol.appendChild(child);
        }
      }
      normalizeLayoutShell(layout);
      flattenHorizonCollectionWrapper(layout);
      if (layout.setAttribute) layout.setAttribute("data-sf-layout-stable", "1");
    } catch (err) {
      /* ignore layout repair failures */
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
      if (mount.classList) mount.classList.add("sf-layout-aside");
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
      mount.classList.add("sf-layout-aside");
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
        removeBusyOverlay();
      } catch (overlayErr) {
        /* overlay may already be gone */
      }
      try {
        paintGridBusy(null, false);
      } catch (err) {
        try {
          removeBusyOverlay();
        } catch (overlayErr2) {
          /* overlay may already be gone */
        }
        try {
          setFilterLoading(false);
        } catch (loadErr) {
          /* loading flag is best-effort */
        }
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
    var pageWidth =
      closestThemeWidth(grid) ||
      ensureSearchThemeWidthShell(grid) ||
      findThemeWidthNearMain(grid);
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
        pageWidth.classList.remove("sf-layout-main");
      }
      var nestedMain = document.createElement("div");
      nestedMain.className = "sf-layout-main";
      while (pageWidth.firstChild) nestedMain.appendChild(pageWidth.firstChild);
      pageWidth.appendChild(layout);
      layout.appendChild(nestedMain);
      var aside =
        layout.querySelector(".sf-layout-aside") ||
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
      var mainCol = layout.querySelector(".sf-layout-main");
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
      var col = layout.querySelector(".sf-layout-main");
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
        "sf-layout-main",
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
      el.classList.add("sf-layout-main");
      return parent;
    }
    var wrapper = document.createElement("div");
    parent.insertBefore(wrapper, el);
    main = document.createElement("div");
    main.className = "sf-layout-main";
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
      cls.contains("sf-page-chips") ||
      cls.contains("sf-sort-host") ||
      cls.contains("sf-search-host") ||
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
    if (el.closest) {
      var item = el.closest("li.product-grid__item, li.grid__item");
      if (item) return item;
    }
    if (
      el.parentElement &&
      String(el.parentElement.tagName || "").toLowerCase() === "li" &&
      isOuterThemeCard(el.parentElement)
    ) {
      return el.parentElement;
    }
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
        return preferProductCardGrid(grid);
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
        return preferProductCardGrid(promoted);
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
      "product-handle",
      "data-sf-card-key",
    ];
    var a;
    for (a = 0; a < attrs.length; a++) {
      var raw = card.getAttribute && card.getAttribute(attrs[a]);
      if (raw) {
        var fromAttr = handleFromHref(raw) || String(raw).split("::")[0].toLowerCase();
        if (fromAttr && fromAttr.indexOf("/") === -1) return fromAttr;
      }
    }
    var urlAttrs = ["data-product-url", "data-url", "data-product-href"];
    for (a = 0; a < urlAttrs.length; a++) {
      var fromUrl = handleFromHref(card.getAttribute && card.getAttribute(urlAttrs[a]));
      if (fromUrl) return fromUrl;
    }
    var link = firstProductLink(card);
    if (link) return handleFromHref(link.getAttribute("href"));
    if (card.tagName && String(card.tagName).toLowerCase() === "a") {
      return handleFromHref(card.getAttribute("href"));
    }
    if (card.querySelector) {
      var nested = card.querySelector("product-card, product-item, [data-product-handle]");
      if (nested && nested !== card) {
        var nestedLink = firstProductLink(nested);
        if (nestedLink) return handleFromHref(nestedLink.getAttribute("href"));
        var nestedHandle = nested.getAttribute && nested.getAttribute("data-product-handle");
        if (nestedHandle) return String(nestedHandle).split("::")[0].toLowerCase();
      }
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
    if (!card || card.nodeType !== 1) return;
    var alreadyShown =
      !card.hidden &&
      card.getAttribute("data-smart-filter-hidden") !== "true" &&
      card.getAttribute("data-findly-theme-hidden") !== "1";
    showEl(card);
    restoreThemeHidden(card);
    forceCardVisible(card);
    if (!card.querySelectorAll) return;
    /* Skip descendant walk when the card was already visible and has no Findly hides. */
    if (
      alreadyShown &&
      !card.querySelector(
        "[data-smart-filter-hidden='true'], [data-findly-theme-hidden='1']",
      )
    ) {
      return;
    }
    var hidden = card.querySelectorAll(
      "[data-smart-filter-hidden='true'], [data-findly-theme-hidden='1']",
    );
    var i;
    for (i = 0; i < hidden.length; i++) {
      var node = hidden[i];
      var tag = String((node && node.tagName) || "").toLowerCase();
      if (tag === "slideshow-slide" || tag === "slideshow-component") continue;
      if (node && node.hasAttribute && node.hasAttribute("variant-image")) {
        continue;
      }
      showEl(node);
      restoreThemeHidden(node);
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
    var start = preferProductCardGrid(findThemeCardParent(hint) || hint);
    if (!start || start.nodeType !== 1) return start;
    if (isActualCardGrid(start)) return start;
    var selfGrid =
      start.classList && start.classList.contains("main-collection-grid")
        ? start
        : null;
    var nestedGrid =
      (start.querySelector && start.querySelector(".main-collection-grid")) ||
      null;
    var preferred = selfGrid || nestedGrid || queryInnerCardGrid(start);
    if (preferred) return preferProductCardGrid(preferred);

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
    parent = preferProductCardGrid(parent) || parent;
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
    if (
      isListHost(parent) &&
      String(el.tagName || "").toLowerCase() !== "li"
    ) {
      var sampleLi = null;
      var si;
      for (si = 0; si < parent.children.length; si++) {
        if (String(parent.children[si].tagName || "").toLowerCase() === "li") {
          sampleLi = parent.children[si];
          break;
        }
      }
      if (!sampleLi) {
        var traySample = document.getElementById(CARD_TRAY_ID);
        if (traySample && traySample.children) {
          for (si = 0; si < traySample.children.length; si++) {
            if (String(traySample.children[si].tagName || "").toLowerCase() === "li") {
              sampleLi = traySample.children[si];
              break;
            }
          }
        }
      }
      var holder = document.createElement("li");
      holder.className = listItemClassForGrid(parent, sampleLi);
      if (el.classList && el.classList.contains("sf-app-card")) {
        holder.className = holder.className + " sf-app-card";
      }
      if (el.parentNode === parent) parent.insertBefore(holder, el);
      holder.appendChild(el);
      el = holder;
    }
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
            cls.contains("sf-page-chips") ||
            cls.contains("sf-sort-host") ||
            cls.contains("sf-search-host") ||
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
    if (!host || !host.children || !tray) return;
    var i;
    for (i = host.children.length - 1; i >= 0; i--) {
      var kid = host.children[i];
      if (!kid || kid.nodeType !== 1) continue;
      if (kid.id === CARD_TRAY_ID || kid.id === EMPTY_ID) continue;
      if (isGridChrome(kid)) continue;
      if (kid.getAttribute && kid.getAttribute(SKEL_ATTR) === "1") continue;
      if (isOuterThemeCard(kid)) continue;
      if (resolveOuterThemeCard(kid) && resolveOuterThemeCard(kid) !== kid) continue;
      if (!isOrphanProductNode(kid)) continue;
      var handle = handleFromCard(kid);
      if (allowed && handle && allowed[handle]) {
        if (attachOrphanToShown(kid, handle, shownEls || [])) continue;
      }
      if (kid.parentNode !== tray) tray.appendChild(kid);
    }
  }

  function matchesBusyHost(el) {
    if (!el || el.nodeType !== 1 || !el.matches) return false;
    var i;
    for (i = 0; i < GRID_BUSY_HOSTS.length; i++) {
      try {
        if (el.matches(GRID_BUSY_HOSTS[i])) return true;
      } catch (err) {
        /* ignore invalid selector */
      }
    }
    return false;
  }

  function isTooWideBusyHost(el) {
    if (!el || el.nodeType !== 1) return true;
    var tag = String(el.tagName || "").toLowerCase();
    if (tag === "html" || tag === "body" || tag === "main") return true;
    if (el.id === "smart-filter-root" || el.id === "smart-filter-embed") {
      return true;
    }
    if (el.classList && el.classList.contains("sf-collection-layout")) {
      return true;
    }
    if (!el.querySelector) return false;
    return Boolean(
      el.querySelector(
        "#smart-filter-root, #smart-filter-embed, .sf-collection-layout",
      ),
    );
  }

  function skeletonMountHost(el) {
    var node = el;
    var found =
      el && matchesBusyHost(el) && !isTooWideBusyHost(el) ? el : null;
    var hops = 0;
    while (node && hops < 12) {
      node = node.parentElement;
      hops += 1;
      if (!node || isTooWideBusyHost(node)) break;
      if (matchesBusyHost(node)) found = node;
    }
    if (found) return found;
    if (el && !isTooWideBusyHost(el)) return el;
    return null;
  }

  function isBusyPainted() {
    var skels = document.querySelectorAll("[" + SKEL_ATTR + "='1']");
    var i;
    for (i = 0; i < skels.length; i++) {
      var parent = skels[i].parentElement;
      if (
        parent &&
        matchesBusyHost(parent) &&
        !isTooWideBusyHost(parent)
      ) {
        return true;
      }
    }
    return false;
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
        host.querySelector("ol.product-grid") ||
        host.querySelector(".product-grid") ||
        queryInnerCardGrid(host);
      if (inner && !isTooWideBusyHost(inner)) host = inner;
    }
    return skeletonMountHost(host);
  }

  function clearGridSkeletons(host) {
    var scope = host && host.querySelectorAll ? host : document;
    var nodes = scope.querySelectorAll("[" + SKEL_ATTR + "='1']");
    var i;
    for (i = 0; i < nodes.length; i++) {
      if (nodes[i].parentNode) nodes[i].parentNode.removeChild(nodes[i]);
    }
    if (host && host.removeAttribute) host.removeAttribute("data-findly-skel-host");
  }

  function hostHasSkeletons(host) {
    if (!host || !host.children) return false;
    var i;
    for (i = 0; i < host.children.length; i++) {
      if (
        host.children[i].getAttribute &&
        host.children[i].getAttribute(SKEL_ATTR) === "1"
      ) {
        return true;
      }
    }
    return false;
  }

  function mountGridSkeletons(host, count) {
    if (!host || !host.appendChild) return;
    if (host.setAttribute) host.setAttribute("data-findly-skel-host", "1");
    if (hostHasSkeletons(host)) return;
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
        '<span class="findly-grid-skel-img"></span>' +
        '<span class="findly-grid-skel-line"></span>' +
        '<span class="findly-grid-skel-line is-short"></span>';
      host.appendChild(el);
    }
  }

  function positionBusyOverlay(host, overlay) {
    if (!overlay) return;
    var vh = window.innerHeight || 800;
    var vw = window.innerWidth || 1200;
    var rect = host && host.getBoundingClientRect ? host.getBoundingClientRect() : null;
    if (!rect || rect.width < 40) {
      var filter =
        document.getElementById("smart-filter-root") ||
        document.getElementById("smart-filter-embed");
      if (filter && filter.getBoundingClientRect) {
        var fr = filter.getBoundingClientRect();
        if (fr.width < vw * 0.48 && fr.left < vw * 0.42) {
          overlay.style.top = Math.max(0, fr.top) + "px";
          overlay.style.left = Math.max(0, fr.right) + "px";
          overlay.style.width = Math.max(160, vw - Math.max(0, fr.right)) + "px";
          overlay.style.height = Math.max(352, vh - Math.max(0, fr.top)) + "px";
          return;
        }
      }
      if (!rect) return;
    }
    var top = Math.max(0, rect.top);
    var chrome =
      (host && host.querySelector && host.querySelector(".sf-toolbar")) ||
      document.querySelector(".sf-toolbar");
    if (chrome && chrome.getBoundingClientRect) {
      var chromeRect = chrome.getBoundingClientRect();
      if (chromeRect.bottom > top && chromeRect.top < rect.bottom) {
        top = Math.max(top, chromeRect.bottom);
      }
    }
    overlay.style.top = top + "px";
    overlay.style.left = Math.max(0, rect.left) + "px";
    overlay.style.width = Math.max(160, rect.width) + "px";
    overlay.style.height =
      Math.max(
        352,
        Math.min(Math.max(rect.bottom - top, 0), Math.max(120, vh - top)),
      ) + "px";
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

  function isFilterLoading() {
    return Boolean(
      document.documentElement &&
        document.documentElement.classList &&
        document.documentElement.classList.contains("sf-filter-loading"),
    );
  }

  function syncToolbarLoading(on) {
    if (on == null) on = isFilterLoading();
    var count = document.querySelector(".sf-total-count");
    var toolbar = document.querySelector(".sf-toolbar");
    if (count) {
      if (on) count.setAttribute("aria-busy", "true");
      else count.removeAttribute("aria-busy");
    }
    if (toolbar) {
      if (on) toolbar.setAttribute("data-sf-toolbar-loading", "1");
      else toolbar.removeAttribute("data-sf-toolbar-loading");
    }
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
    syncToolbarLoading(on);
  }

  function restoreVisibleCardsOpaque(root) {
    var scope = root && root.querySelectorAll ? root : document;
    var cards = scope.querySelectorAll(
      "product-card, product-item, grid-item, li.grid__item, .product-card, .product-grid__item, .product-item, .grid-product, .grid-view-item, .product-block, .sf-app-card, .card-wrapper, [data-product-card]",
    );
    var i;
    for (i = 0; i < cards.length; i++) {
      var el = cards[i];
      if (!el || el.getAttribute("data-smart-filter-hidden") === "true") continue;
      if (el.getAttribute("data-findly-theme-hidden") === "1") continue;
      if (el.getAttribute(SKEL_ATTR) === "1") continue;
      if (el.hidden || (el.classList && el.classList.contains("hidden"))) continue;
      forceCardVisible(el);
    }
  }

  function paintGridBusy(host, on) {
    if (!on) {
      removeBusyOverlay();
      setFilterLoading(false);
      try {
        host = skeletonMountHost(host || discoverBusyHost());
      } catch (err) {
        host = host || null;
      }
      try {
        clearGridSkeletons(host);
        if (!host) clearGridSkeletons(document);
      } catch (skelErr) {
        /* skeleton nodes may already be gone */
      }
      var busyHosts = document.querySelectorAll(".findly-grid-is-busy");
      var b;
      for (b = 0; b < busyHosts.length; b++) {
        busyHosts[b].classList.remove("findly-grid-is-busy");
        busyHosts[b].removeAttribute("aria-busy");
        busyHosts[b].removeAttribute("data-findly-skel-host");
      }
      var marked = document.querySelectorAll("[data-findly-skel-host='1']");
      for (b = 0; b < marked.length; b++) {
        marked[b].removeAttribute("data-findly-skel-host");
      }
      removeBusyOverlay();
      try {
        restoreVisibleCardsOpaque(host || document);
      } catch (visErr) {
        /* cards may already be restored */
      }
      return;
    }
    host = skeletonMountHost(host || discoverBusyHost());
    if (!host) {
      setFilterLoading(true);
      return;
    }
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
    host.setAttribute("data-findly-skel-host", "1");
    if (!hostHasSkeletons(host)) mountGridSkeletons(host, SKEL_COUNT);
    setFilterLoading(true);
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
    var host = discoverBusyHost();
    if (host) {
      paintGridBusy(host, true);
      return;
    }
    if (isBusyPainted()) {
      setFilterLoading(true);
      return;
    }
    attempt = attempt || 0;
    if (attempt < 24) {
      window.setTimeout(function () {
        bootEarlyGridBusy(attempt + 1);
      }, 80);
    }
  }

  function cardCacheUsable(card) {
    return Boolean(
      card &&
        card.nodeType === 1 &&
        !(card.isConnected === false && card._sfMounted),
    );
  }

  function productLookupFromWidget(widget) {
    var products = (widget && widget._lastProducts) || [];
    if (
      widget &&
      widget._lastFilterData &&
      widget._lastFilterData.products &&
      widget._lastFilterData.products.length > products.length
    ) {
      products = widget._lastFilterData.products;
    }
    var byKey = {};
    var p;
    for (p = 0; p < products.length; p++) {
      var item = products[p];
      if (!item) continue;
      if (item.cardKey) byKey[String(item.cardKey).toLowerCase()] = item;
      if (item.handle) byKey[String(item.handle).toLowerCase()] = item;
    }
    return byKey;
  }

  function mountCachedCards(widget, handles, parent) {
    if (!widget || !widget._cardCache || !parent || !handles) return 0;
    var byKey = productLookupFromWidget(widget);
    var n = 0;
    var i;
    for (i = 0; i < handles.length; i++) {
      var key = String(handles[i] || "").toLowerCase();
      if (!key) continue;
      var base = key.split("::")[0];
      var card =
        widget._cardCache[key] || (base && widget._cardCache[base]);
      if (!cardCacheUsable(card)) {
        if (widget._cardCache[key] && !cardCacheUsable(widget._cardCache[key])) {
          delete widget._cardCache[key];
        }
        continue;
      }
      card = resolveOuterThemeCard(card);
      if (!card) continue;
      if (!cardCacheUsable(card)) {
        delete widget._cardCache[key];
        continue;
      }
      var product = byKey[key] || (base && byKey[base]);
      if (product) applyProductDataToThemeCard(card, product, widget);
      widget._cardCache[key] = card;
      if (
        card.isConnected &&
        card.parentNode === parent &&
        !card.hidden &&
        card.getAttribute("data-smart-filter-hidden") !== "true"
      ) {
        card._sfMounted = true;
        n += 1;
        continue;
      }
      placeCardInGrid(parent, card);
      showCardTree(card);
      card._sfMounted = true;
      if (card.isConnected === false) {
        delete widget._cardCache[key];
        continue;
      }
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
      '<p class="sf-grid-empty-title"></p><p class="sf-grid-empty-text"></p>';
    emptyEl.querySelector(".sf-grid-empty-title").textContent = title;
    emptyEl.querySelector(".sf-grid-empty-text").textContent =
      "Try another filter or clear all filters.";
    if (emptyEl.parentNode !== parent) parent.appendChild(emptyEl);
  }

  // keep-theme-cards: on first unfiltered load (and after Clear All / removing
  // the last filter with default sort), leave native Liquid cards alone. After
  // the shopper filters/searches/sorts, keep rendering API results until the
  // listing returns to that native state.
  function shopifyImageKey(url) {
    if (!url) return "";
    var path = String(url).split("?")[0];
    try {
      path = new URL(url, window.location.origin).pathname;
    } catch (err) {
      /* keep path */
    }
    return path.replace(
      /_(?:pico|icon|thumb|small|compact|medium|large|grande|original|master|\d+x\d+)(?:@\d+x)?(?=\.[a-z]+$)/i,
      "",
    );
  }

  function shopifyImageWithWidth(url, width) {
    if (!url) return url;
    try {
      var parsed = new URL(url, window.location.origin);
      if (width) parsed.searchParams.set("width", String(width));
      return parsed.toString();
    } catch (err) {
      return url;
    }
  }

  function paintThemeCardImage(img, nextUrl) {
    if (!img || !nextUrl) return;
    var cur = img.getAttribute("src") || "";
    var orig = img.getAttribute("data-sf-orig-src") || cur;
    var origSet =
      img.getAttribute("data-sf-orig-srcset") || img.getAttribute("srcset") || "";
    if (!img.getAttribute("data-sf-orig-src")) {
      img.setAttribute("data-sf-orig-src", orig);
      img.setAttribute("data-sf-orig-srcset", origSet);
    }
    var nextKey = shopifyImageKey(nextUrl);
    if (
      nextKey &&
      (nextKey === shopifyImageKey(cur) || nextKey === shopifyImageKey(orig))
    ) {
      if (origSet && !img.getAttribute("srcset")) img.setAttribute("srcset", origSet);
      return;
    }
    img.setAttribute("src", shopifyImageWithWidth(nextUrl, img.getAttribute("width")));
    if (!origSet) return;
    img.setAttribute(
      "srcset",
      origSet
        .split(",")
        .map(function (part) {
          var bits = part.trim().split(/\s+/);
          var desc = bits.slice(1).join(" ");
          var wide = desc.match(/(\d+)w/);
          return (
            shopifyImageWithWidth(nextUrl, wide ? wide[1] : "") +
            (desc ? " " + desc : "")
          );
        })
        .join(", "),
    );
  }

  function firstThemeCardSample(widget, parent) {
    function pick(el) {
      var outer = resolveOuterThemeCard(el) || el;
      if (!outer || outer.nodeType !== 1) return null;
      if (outer.classList && outer.classList.contains("sf-app-card")) return null;
      if (!isOuterThemeCard(outer)) return null;
      return outer;
    }
    var cache = widget && widget._cardCache;
    var key;
    if (cache) {
      for (key in cache) {
        if (!Object.prototype.hasOwnProperty.call(cache, key)) continue;
        var fromCache = pick(cache[key]);
        if (fromCache) return fromCache;
      }
    }
    var i;
    if (parent && parent.children) {
      for (i = 0; i < parent.children.length; i++) {
        var fromParent = pick(parent.children[i]);
        if (fromParent) return fromParent;
      }
    }
    var tray = document.getElementById(CARD_TRAY_ID);
    if (tray && tray.children) {
      for (i = 0; i < tray.children.length; i++) {
        var fromTray = pick(tray.children[i]);
        if (fromTray) return fromTray;
      }
    }
    return null;
  }

  function normalizeCardTitleText(text) {
    return String(text || "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function extractThemeCardTitle(card) {
    if (!card || !card.querySelector) return "";
    var nodes = card.querySelectorAll(
      ".card__heading a, .card__heading, .card__title a, .card__title, .product-card-title, .product-card__title, .product__title, a.full-unstyled-link, .sf-fill-card-title, h3 a, h3, h2 a, h2, h4 a, h4",
    );
    var i;
    for (i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      if (node.closest && node.closest(".price, .badge, .card__badge, .product-badges")) {
        continue;
      }
      if (
        node.querySelector &&
        node.querySelector("img") &&
        !normalizeCardTitleText(node.textContent)
      ) {
        continue;
      }
      var text = normalizeCardTitleText(node.textContent);
      if (text) return text;
    }
    return "";
  }

  function replaceThemeCardTitleText(card, fromTitle, toTitle) {
    if (!card || !fromTitle || !toTitle || fromTitle === toTitle) return false;
    if (!card.ownerDocument || !card.ownerDocument.createTreeWalker) return false;
    var changed = false;
    var walker = card.ownerDocument.createTreeWalker(
      card,
      NodeFilter.SHOW_TEXT,
      null,
    );
    var node;
    while ((node = walker.nextNode())) {
      var value = node.nodeValue;
      if (!value || value.indexOf(fromTitle) === -1) continue;
      if (node.parentElement && node.parentElement.closest) {
        if (node.parentElement.closest(".price, .badge, .card__badge")) continue;
      }
      node.nodeValue = value.split(fromTitle).join(toTitle);
      changed = true;
    }
    return changed;
  }

  function setThemeCardTitle(card, title) {
    if (!card || !card.querySelector || !title) return false;
    var prevTitle =
      card.getAttribute("data-sf-card-title") || extractThemeCardTitle(card);
    var updated = false;
    var selectors = [
      ".card__heading a",
      ".card__title a",
      "a.full-unstyled-link",
      ".product-card-title",
      ".product-card__title",
      ".product__title",
      ".sf-fill-card-title",
      ".card__heading",
      ".card__title",
      "h3 a",
      "h2 a",
      "h4 a",
      "h3",
      "h2",
      "h4",
    ];
    var s;
    for (s = 0; s < selectors.length; s++) {
      var nodes = card.querySelectorAll(selectors[s]);
      var i;
      for (i = 0; i < nodes.length; i++) {
        var node = nodes[i];
        if (node.closest && node.closest(".price, .badge, .card__badge")) continue;
        if (
          node.querySelector &&
          node.querySelector("img") &&
          !normalizeCardTitleText(node.textContent)
        ) {
          continue;
        }
        /* Prefer leaf title links; skip wrappers that still contain a child title link. */
        if (
          node.querySelector &&
          node.querySelector("a") &&
          String(node.tagName || "").toLowerCase() !== "a"
        ) {
          continue;
        }
        var text = normalizeCardTitleText(node.textContent);
        if (!text && String(node.tagName || "").toLowerCase() !== "a") continue;
        node.textContent = title;
        updated = true;
      }
      if (updated) break;
    }
    if (prevTitle) replaceThemeCardTitleText(card, prevTitle, title);
    card.setAttribute("data-sf-card-title", title);
    return updated || Boolean(prevTitle);
  }

  function setThemeCardPrice(card, product, widget) {
    if (!card || !card.querySelector || !product) return;
    var priceText = formatFillPrice(product, widget);
    if (!priceText) return;
    var nodes = card.querySelectorAll(
      ".price-item--sale, .price-item--regular, .price-item, .price .money, [data-product-price], .sf-fill-card-price, .price__regular .price-item, .price__sale .price-item",
    );
    var i;
    if (!nodes.length) {
      var priceRoot = card.querySelector(".price, .product-price, .card-information .price");
      if (priceRoot) priceRoot.textContent = priceText;
      return;
    }
    for (i = 0; i < nodes.length; i++) nodes[i].textContent = priceText;
    var compare = card.querySelectorAll(
      "s.price-item, .price__compare, .price-item--compare, .price--compare",
    );
    for (i = 0; i < compare.length; i++) {
      compare[i].setAttribute("hidden", "");
      if (compare[i].style) compare[i].style.display = "none";
    }
  }

  function applyProductDataToThemeCard(card, product, widget) {
    if (!card || !product) return card;
    var handle = String(product.handle || "").toLowerCase();
    var key = String(product.cardKey || handle).toLowerCase();
    /* Capture sample/old title BEFORE href/image changes so we can replace every copy. */
    if (!card.getAttribute("data-sf-card-title")) {
      var existingTitle = extractThemeCardTitle(card);
      if (existingTitle) card.setAttribute("data-sf-card-title", existingTitle);
    }
    if (key) card.setAttribute("data-sf-card-key", key);
    if (handle) card.setAttribute("data-product-handle", handle);
    card.removeAttribute("data-smart-filter-hidden");
    card.hidden = false;
    if (card.style) card.style.removeProperty("display");
    var url =
      product.url ||
      (handle
        ? "/products/" +
          handle +
          (product.variantId ? "?variant=" + product.variantId : "")
        : "");
    var i;
    if (url && card.querySelectorAll) {
      var links = card.querySelectorAll('a[href*="/products/"]');
      for (i = 0; i < links.length; i++) links[i].setAttribute("href", url);
    }
    var imgUrl = product.variantImageUrl || product.imageUrl || "";
    if (card.querySelector) {
      paintThemeCardImage(card.querySelector("img"), imgUrl);
      var imgs = card.querySelectorAll("img");
      for (i = 0; i < imgs.length; i++) {
        if (imgUrl && i > 0) paintThemeCardImage(imgs[i], imgUrl);
        if (product.title) imgs[i].setAttribute("alt", product.title);
        if (!imgs[i].getAttribute("loading")) imgs[i].setAttribute("loading", "lazy");
        if (!imgs[i].getAttribute("decoding")) imgs[i].setAttribute("decoding", "async");
      }
    }
    var title = product.title || handle;
    if (title) setThemeCardTitle(card, title);
    setThemeCardPrice(card, product, widget);
    if (card.querySelectorAll) {
      var slides = card.querySelectorAll("slideshow-slide");
      for (i = 1; i < slides.length; i++) {
        slides[i].setAttribute("hidden", "");
        slides[i].setAttribute("aria-hidden", "true");
      }
      var badges = card.querySelectorAll(
        ".badge, .product-badge, .card__badge, .product-badges",
      );
      for (i = 0; i < badges.length; i++) badges[i].setAttribute("hidden", "");
    }
    return card;
  }

  function cloneThemeProductCard(sample, product, widget) {
    if (!sample || !product) return null;
    var clone;
    try {
      clone = sample.cloneNode(true);
    } catch (err) {
      return null;
    }
    return applyProductDataToThemeCard(clone, product, widget);
  }

  function isFragileThemeCard(el) {
    if (!el || el.nodeType !== 1) return false;
    var tag = String(el.tagName || "").toLowerCase();
    if (tag === "product-card" || tag === "product-item" || tag === "grid-item") {
      return true;
    }
    return Boolean(
      el.querySelector && el.querySelector("product-card, product-item, grid-item"),
    );
  }

  function cardIsInHost(el, parent) {
    if (!el || !parent) return false;
    if (el.parentNode === parent) return true;
    return Boolean(parent.contains && parent.contains(el));
  }

  function cardHasVisibleMedia(el) {
    if (!el || !el.querySelector) return false;
    return Boolean(el.querySelector("img, svg, [style*='background']"));
  }

  function formatFillPrice(product, widget) {
    if (!product) return "";
    var raw = product.priceMin != null ? product.priceMin : product.price;
    if (raw == null || raw === "") return "";
    if (typeof raw === "string" && /[^\d.]/.test(raw)) return raw;
    var n = Number(raw);
    if (!Number.isFinite(n)) return "";
    var code =
      (widget && widget.currency) ||
      (window.Shopify && window.Shopify.currency && window.Shopify.currency.active) ||
      "USD";
    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: String(code),
      }).format(n);
    } catch (err) {
      return "$" + n.toFixed(2);
    }
  }

  function buildThemeListCard(parent, product, sample, widget) {
    if (!product) return null;
    var handle = String(product.handle || "").toLowerCase();
    var key = String(product.cardKey || handle).toLowerCase();
    var li = document.createElement("li");
    li.className = listItemClassForGrid(parent, sample);
    li.setAttribute("data-sf-fill-card", "1");
    if (key) li.setAttribute("data-sf-card-key", key);
    if (handle) li.setAttribute("data-product-handle", handle);
    var url =
      product.url ||
      (handle
        ? "/products/" + handle + (product.variantId ? "?variant=" + product.variantId : "")
        : "#");
    var a = document.createElement("a");
    a.setAttribute("href", url);
    a.className = "sf-fill-card";
    var imgUrl = product.variantImageUrl || product.imageUrl || "";
    if (imgUrl) {
      var img = document.createElement("img");
      img.src = imgUrl;
      img.alt = product.title || "";
      img.setAttribute("loading", "lazy");
      img.setAttribute("decoding", "async");
      a.appendChild(img);
    }
    var title = document.createElement("p");
    title.className = "sf-fill-card-title";
    title.textContent = product.title || handle;
    a.appendChild(title);
    var priceText = formatFillPrice(product, widget);
    if (priceText) {
      var price = document.createElement("p");
      price.className = "sf-fill-card-price";
      price.textContent = priceText;
      a.appendChild(price);
    }
    li.appendChild(a);
    return li;
  }

  function pageHandlesForGrid(widget, handles, append) {
    if (widget && widget.ensurePageSize) widget.ensurePageSize();
    var size = (widget && widget.pageSize) || 16;
    if (handles && handles.length && handles.length <= size) {
      return handles;
    }
    var source = handles;
    if (
      widget &&
      widget._allFilterHandles &&
      widget._allFilterHandles.length >
        (handles && handles.length ? handles.length : 0)
    ) {
      source = widget._allFilterHandles;
    }
    if (
      (!source || !source.length) &&
      widget &&
      widget._allFilterHandles &&
      widget._allFilterHandles.length
    ) {
      source = widget._allFilterHandles;
    }
    return pageSlice(widget, source, append);
  }

  function fillGapsWithThemeClones(widget, handles, parent) {
    if (!widget || !handles || !handles.length || !parent) return;
    if (widget.isAppGridMode && widget.isAppGridMode()) return;
    handles = pageHandlesForGrid(widget, handles, false);
    if (countAllowedInHost(parent, handles) >= uniqueAllowedCount(handles)) {
      return;
    }
    if (widget.cacheNativeCards) widget.cacheNativeCards();
    var cache = widget._cardCache || {};
    widget._cardCache = cache;
    var byKey = productLookupFromWidget(widget);
    var sample = firstThemeCardSample(widget, parent);
    var i;
    for (i = 0; i < handles.length; i++) {
      var key = String(handles[i] || "").toLowerCase();
      if (!key) continue;
      var base = key.split("::")[0];
      var product = byKey[key] || byKey[base];
      /* Never clone a sample card without API product data — that leaves the sample title/price. */
      if (!product || !(product.title || product.handle)) continue;
      var cached = cache[key] || (base && cache[base]);
      if (cached && !cardCacheUsable(cached)) {
        if (cache[key] && !cardCacheUsable(cache[key])) delete cache[key];
        cached = null;
      }
      var existing = cached ? resolveOuterThemeCard(cached) || cached : null;
      if (existing && !cardCacheUsable(existing)) {
        existing = null;
      }
      if (existing && !cardIsInHost(existing, parent)) {
        applyProductDataToThemeCard(existing, product, widget);
        placeCardInGrid(parent, existing);
        showCardTree(existing);
        existing._sfMounted = true;
        continue;
      }
      if (existing && cardIsInHost(existing, parent) && !isFragileThemeCard(existing)) {
        applyProductDataToThemeCard(existing, product, widget);
        showCardTree(existing);
        existing._sfMounted = true;
        continue;
      }
      if (
        existing &&
        cardIsInHost(existing, parent) &&
        existing.getAttribute &&
        existing.getAttribute("data-sf-fill-card") === "1"
      ) {
        applyProductDataToThemeCard(existing, product, widget);
        showCardTree(existing);
        existing._sfMounted = true;
        continue;
      }
      /* Avoid sync layout (offsetHeight) per card — use structural fragility only. */
      if (existing && cardIsInHost(existing, parent) && isFragileThemeCard(existing)) {
        hideEl(existing);
      }
      var clone = null;
      if (sample && !isFragileThemeCard(sample)) {
        clone = cloneThemeProductCard(sample, product, widget);
      }
      if (!clone || isFragileThemeCard(clone) || !cardHasVisibleMedia(clone)) {
        clone = buildThemeListCard(parent, product, sample, widget) || clone;
      }
      if (!clone) continue;
      applyProductDataToThemeCard(clone, product, widget);
      cache[key] = clone;
      /* Do not alias cache[base] to a variant card — that remounts the wrong product. */
      if (base && key === base && !cache[base]) cache[base] = clone;
      placeCardInGrid(parent, clone);
      showCardTree(clone);
      clone._sfMounted = true;
    }
  }

  function markGridTakeover(widget) {
    if (widget) widget._keepThemeCards = false;
  }

  /** Idle default browse (ignores page / variant payload). */
  function isIdleUnfilteredListing(widget) {
    if (!widget) return false;
    if (widget.isAppGridMode && widget.isAppGridMode()) return false;
    if (widget.hasActiveFilters && widget.hasActiveFilters()) return false;
    if (widget.collectionQuery) return false;
    if (widget.searchQuery) return false;
    if (
      widget.sortKey &&
      widget.defaultSort &&
      widget.sortKey !== widget.defaultSort
    ) {
      return false;
    }
    return true;
  }

  function isNativeThemeGridState(widget) {
    if (!widget) return false;
    /* Page 2+ must use Findly handles — Liquid only rendered page 1 cards.
       Do not treat API variantId rows as non-native: that blocked Liquid
       restore after paging and re-painted API page-1 order. */
    if (Math.max(1, Number(widget.page) || 1) > 1) return false;
    return isIdleUnfilteredListing(widget);
  }

  function restoreNativeThemeGridState(widget) {
    if (!widget) return;
    delete widget._keepThemeCards;
    if (widget.restoreThemePaging) widget.restoreThemePaging();
    if (widget.removeImportedCards) widget.removeImportedCards();
    restoreNativeGridOrder(widget);
  }

  function isNativeSnapshotCard(widget, el) {
    var list = widget && widget._nativeGridOrder;
    if (!list || !list.length || !el) return false;
    var outer = resolveOuterThemeCard(el) || el;
    var i;
    for (i = 0; i < list.length; i++) {
      var snap = list[i];
      if (!snap) continue;
      if (snap === el || snap === outer) return true;
      if (snap.contains && (snap.contains(el) || snap.contains(outer))) {
        return true;
      }
      if (outer.contains && outer.contains(snap)) return true;
    }
    return false;
  }

  function resetWidgetFilterState(widget) {
    if (!widget) return;
    widget.selected = {};
    widget.price = { min: "", max: "" };
    widget.collectionQuery = "";
    widget.sortKey = widget.defaultSort || "manual";
    if (widget.sortEl) widget.sortEl.value = widget.sortKey;
    if (widget.collectionSearchEl) widget.collectionSearchEl.value = "";
  }

  function prepareNativeListingRestore(widget) {
    if (!widget) return;
    /* Keep _sfPaged so the numbered pager stays Findly-driven after
       returning to Liquid page 1. Clear All / empty hash still clear it. */
    widget.page = 1;
    if (!isNativeThemeGridState(widget)) return;
    widget._sfNativeListing = true;
    restoreNativeThemeGridState(widget);
  }

  function snapshotNativeGridOrder(widget, parent) {
    if (!widget || widget._nativeGridOrder) return;
    parent = preferProductCardGrid(resolveCardHost(parent) || parent);
    if (!parent || !parent.children || !parent.children.length) return;
    var snapshot = [];
    var i;
    for (i = 0; i < parent.children.length; i++) {
      snapshot.push(parent.children[i]);
    }
    if (!snapshot.length) return;
    widget._nativeGridOrder = snapshot;
    widget._nativeGridParent = parent;
  }

  function restoreNativeGridOrder(widget) {
    if (!widget || !widget._nativeGridOrder) return;
    var parent = widget._nativeGridParent;
    if (!parent || !parent.isConnected) {
      parent = preferProductCardGrid(
        resolveCardHost(widget._gridParent) ||
          (widget.ensureGridParent && widget.ensureGridParent()),
      );
      if (!parent) return;
      widget._nativeGridParent = parent;
    }
    var snapshot = widget._nativeGridOrder;
    var i;
    for (i = 0; i < snapshot.length; i++) {
      var el = snapshot[i];
      if (!el || el.nodeType !== 1) continue;
      parent.appendChild(el);
    }
  }

  function shouldTakeOverThemeCards(widget) {
    if (!widget) return false;
    if (widget.isAppGridMode && widget.isAppGridMode()) return false;
    if (isNativeThemeGridState(widget)) {
      delete widget._keepThemeCards;
      return false;
    }
    /* Only page 2+ forces takeover. Page 1 default browse restores Liquid
       cards so Product A matches the first paint after reload. */
    if (Math.max(1, Number(widget.page) || 1) > 1) {
      markGridTakeover(widget);
      return true;
    }
    if (widget.hasActiveFilters && widget.hasActiveFilters()) {
      markGridTakeover(widget);
      return true;
    }
    if (widget.collectionQuery) {
      markGridTakeover(widget);
      return true;
    }
    if (widget.searchQuery) {
      markGridTakeover(widget);
      return true;
    }
    if (
      widget.sortKey &&
      widget.defaultSort &&
      widget.sortKey !== widget.defaultSort
    ) {
      markGridTakeover(widget);
      return true;
    }
    return widget._keepThemeCards === false;
  }

  function fillMissingFilterCards(widget, handles, parent) {
    if (!widget || widget._importingCards || !handles || !handles.length) return;
    if (!shouldTakeOverThemeCards(widget)) return;
    var reqId = widget._reqId;
    parent = preferProductCardGrid(resolveCardHost(parent) || parent);
    if (parent && !isPageShellHost(parent)) widget._gridParent = parent;
    lockThemeGridTracks(parent);
    var needFetch =
      widget.missingHandles && widget.missingHandles(handles).length > 0;
    /* Avoid a second long busy crawl when cache already has cards (DOM gaps only). */
    if (needFetch && widget.setGridBusy) widget.setGridBusy(true);
    function stale() {
      return widget._reqId !== reqId;
    }
    function finish() {
      if (stale()) return;
      try {
        mountCachedCards(widget, handles, parent);
        applyNativeFilterGrid(handles, parent);
        fillGapsWithThemeClones(widget, handles, parent);
        var shown = countAllowedInHost(parent, handles);
        var needed = uniqueAllowedCount(handles);
        if (needed > shown) {
          fillGapsWithThemeClones(widget, handles, parent);
          shown = countAllowedInHost(parent, handles);
        }
        if (
          needed > shown &&
          shown === 0 &&
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
        syncGridEmptyState(widget, parent, handles, shown);
        markGridPainted(widget);
      } finally {
        if (widget.setGridBusy && widget._reqId === reqId) widget.setGridBusy(false);
        if (widget._reqId === reqId) {
          widget._loadingPage = false;
          if (widget.renderPager) widget.renderPager();
          mountFindlyPager(widget);
        }
      }
    }
    widget._importingCards = true;
    widget._reapplyingGrid = true;
    /* If card import hangs, never leave busy overlay / dead pager forever. */
    if (widget._importBusyTimer) {
      window.clearTimeout(widget._importBusyTimer);
      widget._importBusyTimer = 0;
    }
    widget._importBusyTimer = window.setTimeout(function () {
      widget._importBusyTimer = 0;
      if (widget._reqId !== reqId) return;
      widget._importingCards = false;
      widget._reapplyingGrid = false;
      widget._loadingPage = false;
      if (widget.setGridBusy) widget.setGridBusy(false);
      if (widget.renderPager) widget.renderPager();
    }, 12000);
    var done = function () {
      if (widget._importBusyTimer) {
        window.clearTimeout(widget._importBusyTimer);
        widget._importBusyTimer = 0;
      }
      if (widget._reqId === reqId) widget._importingCards = false;
      try {
        finish();
      } finally {
        if (widget._reqId === reqId) widget._reapplyingGrid = false;
      }
    };
    if (needFetch && widget.ensureCardsForHandles) {
      Promise.resolve(widget.ensureCardsForHandles(handles)).then(done, done);
      return;
    }
    done();
  }

  function findGridChromeChild(parent) {
    if (!parent || !parent.children) return null;
    var kids = parent.children;
    var i;
    for (i = 0; i < kids.length; i++) {
      var kid = kids[i];
      var cls = kid.classList;
      var tag = String(kid.tagName || "").toLowerCase();
      if (
        (cls &&
          (cls.contains("sf-toolbar") ||
            cls.contains("sf-page-chips") ||
            cls.contains("sf-sort-host") ||
            cls.contains("sf-search-host") ||
            cls.contains("sf-total-count") ||
            cls.contains("sf-pager") ||
            cls.contains("pagination"))) ||
        tag === "nav"
      ) {
        return kid;
      }
    }
    return null;
  }

  /**
   * Reorder shown cards with minimal moves (same final order as append-before-chrome).
   * Skips insert when nextSibling is already the correct neighbor.
   */
  function reorderShownHosts(parent, shownHosts) {
    if (!parent || !shownHosts || !shownHosts.length) return;
    var chrome = findGridChromeChild(parent);
    var reference = chrome;
    var i;
    for (i = shownHosts.length - 1; i >= 0; i--) {
      var el = shownHosts[i];
      if (!el || el.nodeType !== 1) continue;
      if (el.parentNode === parent && el.nextSibling === reference) {
        reference = el;
        continue;
      }
      parent.insertBefore(el, reference || null);
      reference = el;
    }
  }

  function applyNativeFilterGrid(handles, hint) {
    var parent = preferProductCardGrid(resolveCardHost(hint) || hint);
    stripAppCards(parent || document);
    if (!parent) return false;
    var widget = window.__FINDLY_FILTER_WIDGET;
    if (widget && !widget._nativeGridOrder) {
      snapshotNativeGridOrder(widget, parent);
    }
    lockThemeGridTracks(parent);
    var allowed = Array.isArray(handles) ? allowedHandleSet(handles) : null;
    var restrictNative = false;
    if (!allowed && widget && widget._nativeGridOrder) {
      restoreNativeGridOrder(widget);
      /* Native restore must not leave page 2/3 clones visible. */
      restrictNative = true;
      if (widget.removeImportedCards) widget.removeImportedCards();
    }
    var cards = collectTrayAndGridCards(parent);
    var tray = cardTray();
    var shown = [];
    var hidden = [];
    var i;
    for (i = 0; i < cards.length; i++) {
      var item = cards[i];
      if (!allowed) {
        if (restrictNative && !isNativeSnapshotCard(widget, item.el)) {
          hidden.push(item);
        } else {
          shown.push(item);
        }
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
    for (i = 0; i < shown.length; i++) {
      if (shown[i].orphan) {
        if (
          !attachOrphanToShown(shown[i].el, shown[i].handle, shown) &&
          !attachOrphanToShown(shown[i].el, shown[i].handle, hidden)
        ) {
          if (shown[i].el.parentNode !== tray) tray.appendChild(shown[i].el);
        }
        continue;
      }
      if (shown[i].el.parentNode === tray) placeCardInGrid(parent, shown[i].el);
      showCardTree(shown[i].el);
      shownHosts.push(shown[i].el);
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
      if (hidden[i].el.parentNode === tray) placeCardInGrid(parent, hidden[i].el);
      hideEl(hidden[i].el);
    }
    if (allowed) {
      reorderShownHosts(parent, shownHosts);
    } else if (widget && widget._nativeGridOrder) {
      restoreNativeGridOrder(widget);
    } else {
      reorderShownHosts(parent, shownHosts);
    }
    sweepHostOrphans(parent, shownHosts, allowed, tray);
    return cards.length > 0;
  }

  function markGridPainted(widget) {
    if (widget) widget._sfPaintedReq = widget._reqId;
  }

  function alreadyPaintedGrid(widget) {
    return Boolean(widget && widget._sfPaintedReq === widget._reqId);
  }

  /**
   * Patch facet counts / checked state in place when the facet key set is unchanged.
   * Avoids full facetsEl.innerHTML rebuild on every filter click (major applyMs cost).
   */
  function tryPatchFacetDom(widget) {
    if (!widget || !widget.facetsEl) return false;
    var root = widget.facetsEl;
    var facets = widget.facets || [];
    if (!facets.length) return false;
    var existing = root.querySelectorAll(".sf-facet[data-facet-key]");
    if (!existing.length) return false;

    var hideSingle = widget.hideSingleValueFacets;
    var visible = [];
    var i;
    for (i = 0; i < facets.length; i++) {
      var facet = facets[i];
      if (!facet || !facet.key) continue;
      var isPrice =
        facet.type === "price_range" || facet.displayType === "slider";
      var selectedCount = widget.selectedCount
        ? widget.selectedCount(facet)
        : 0;
      if (
        hideSingle &&
        !isPrice &&
        (facet.values || []).length <= 1 &&
        selectedCount === 0
      ) {
        continue;
      }
      visible.push(facet);
    }
    if (visible.length !== existing.length) return false;

    var byKey = {};
    for (i = 0; i < existing.length; i++) {
      byKey[existing[i].getAttribute("data-facet-key")] = existing[i];
    }

    for (i = 0; i < visible.length; i++) {
      facet = visible[i];
      var node = byKey[facet.key];
      if (!node) return false;
      isPrice =
        facet.type === "price_range" || facet.displayType === "slider";
      if (isPrice) continue;

      var values = facet.values || [];
      var selected = (widget.selected && widget.selected[facet.key]) || [];
      var valueMap = {};
      var v;
      for (v = 0; v < values.length; v++) {
        var item = values[v];
        if (!item) continue;
        var val = String(
          item.value != null
            ? item.value
            : item.handle != null
              ? item.handle
              : item.label || "",
        );
        if (val) valueMap[val] = item;
      }

      var inputs = node.querySelectorAll("input[type='checkbox'], input[type='radio']");
      if (!inputs.length && values.length) return false;
      var seen = 0;
      for (v = 0; v < inputs.length; v++) {
        var input = inputs[v];
        var inputVal = String(input.value || "");
        var meta = valueMap[inputVal];
        if (!meta) return false;
        seen += 1;
        var checked = selected.indexOf(inputVal) !== -1;
        if (input.checked !== checked) input.checked = checked;
        var count = meta.count;
        var empty = typeof count === "number" && count === 0;
        var isAvailability =
          facet.source === "availability" || facet.key === "availability";
        if (isAvailability || facet.type === "boolean") {
          input.disabled = empty && !checked;
        }
        var countEl = input.parentNode
          ? input.parentNode.querySelector(".sf-option-count")
          : null;
        if (countEl && typeof count === "number") {
          countEl.textContent = String(count);
        }
        var label = input.closest ? input.closest("label") : input.parentNode;
        if (label && label.title != null) {
          var textEl = label.querySelector(".sf-option-text");
          var labelText = textEl ? textEl.textContent : inputVal;
          label.title =
            labelText +
            (typeof count === "number" ? " (" + count + ")" : "");
        }
      }
      if (seen !== Object.keys(valueMap).length) return false;
    }

    /* Refresh chips without wiping facet trees. */
    var chipsHost = root.querySelector(".sf-chips");
    if (widget.renderChips) {
      var nextChips = widget.renderChips();
      if (chipsHost && chipsHost.parentNode) {
        if (nextChips) chipsHost.parentNode.replaceChild(nextChips, chipsHost);
        else chipsHost.parentNode.removeChild(chipsHost);
      } else if (nextChips && root.firstChild) {
        root.insertBefore(nextChips, root.firstChild);
      } else if (nextChips) {
        root.appendChild(nextChips);
      }
    }
    if (widget.syncClearAll) widget.syncClearAll();
    if (widget.renderApplyBar) widget.renderApplyBar();
    return true;
  }

  function applyNativeAfterGrid(self) {
    if (!self) return;
    if (self._importingCards) return;
    if (self._loadingPage || self._inflight) return;
    /* Same filter cycle already painted — skip a second full hide/show/reorder pass. */
    if (alreadyPaintedGrid(self) && shouldTakeOverThemeCards(self)) return;
    if (self.isAppGridMode && self.isAppGridMode()) {
      var parent = self._gridParent;
      if (parent && self.hideNativeGridCards) self.hideNativeGridCards(parent);
      return;
    }
    if (!shouldTakeOverThemeCards(self)) {
      applyNativeFilterGrid(null, self._gridParent);
      markGridPainted(self);
      return;
    }
    var handles =
      self._visibleHandles && self._visibleHandles.length
        ? self._visibleHandles
        : self._shownHandles;
    if (!handles || !handles.length) {
      applyNativeFilterGrid(handles || [], self._gridParent);
      markGridPainted(self);
      return;
    }
    applyNativeFilterGrid(handles, self._gridParent);
    markGridPainted(self);
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

  function customSortMenuEnabled() {
    try {
      return window.matchMedia("(min-width: 750px)").matches;
    } catch (err) {
      return window.innerWidth >= 750;
    }
  }

  function sortMenuSelect(wrap) {
    if (!wrap || !wrap.querySelector) return null;
    return (
      wrap.querySelector(".sf-sort-select") ||
      wrap.querySelector("[data-sort]")
    );
  }

  function sortMenuEl(wrap) {
    if (!wrap) return null;
    if (wrap._sfSortMenu && wrap._sfSortMenu.isConnected) return wrap._sfSortMenu;
    return wrap.querySelector(".sf-sort-menu");
  }

  function sortButtonEl(wrap) {
    return wrap && wrap.querySelector ? wrap.querySelector(".sf-sort-btn") : null;
  }

  function selectedSortLabel(select) {
    if (!select || !select.options) return "";
    var opt = select.options[select.selectedIndex];
    return opt ? String(opt.textContent || "").trim() : "";
  }

  function syncSortButton(wrap, select) {
    var btn = sortButtonEl(wrap);
    if (!btn) return;
    var valueEl = btn.querySelector(".sf-sort-btn-value");
    var labelText = selectedSortLabel(select);
    if (valueEl) valueEl.textContent = labelText;
    btn.disabled = Boolean(select && select.disabled);
    btn.setAttribute(
      "aria-expanded",
      wrap && wrap.classList && wrap.classList.contains("is-sort-open")
        ? "true"
        : "false",
    );
    var label = wrap && wrap.querySelector
      ? wrap.querySelector(".sf-sort-label")
      : null;
    var prefix = label ? String(label.textContent || "").trim() : "Sort by";
    btn.setAttribute("aria-label", prefix + (labelText ? ": " + labelText : ""));
  }

  function syncSortA11y(wrap, select, btn) {
    if (!select) return;
    var label = wrap && wrap.querySelector
      ? wrap.querySelector(".sf-sort-label")
      : null;
    if (customSortMenuEnabled()) {
      select.setAttribute("tabindex", "-1");
      select.setAttribute("aria-hidden", "true");
      if (label && btn && btn.id) label.htmlFor = btn.id;
    } else {
      select.removeAttribute("tabindex");
      select.removeAttribute("aria-hidden");
      if (label && select.id) label.htmlFor = select.id;
    }
  }

  function ensureSortButton(wrap, select) {
    var trigger = ensureSortTrigger(wrap, select);
    var btn = sortButtonEl(wrap);
    if (!btn) {
      btn = document.createElement("button");
      btn.type = "button";
      btn.className = "sf-sort-btn";
      btn.setAttribute("aria-haspopup", "listbox");
      btn.setAttribute("aria-expanded", "false");
      var value = document.createElement("span");
      value.className = "sf-sort-btn-value";
      btn.appendChild(value);
      var chevron = document.createElement("span");
      chevron.className = "sf-sort-btn-chevron";
      chevron.setAttribute("aria-hidden", "true");
      btn.appendChild(chevron);
      if (select && select.parentNode === trigger) {
        trigger.insertBefore(btn, select);
      } else {
        trigger.insertBefore(btn, trigger.firstChild);
      }
    } else if (btn.parentNode !== trigger) {
      if (select && select.parentNode === trigger) trigger.insertBefore(btn, select);
      else trigger.insertBefore(btn, trigger.firstChild);
    }
    var baseId = (select && select.id) || "smart-filter-sort";
    if (!btn.id) btn.id = baseId + "-btn";
    syncSortButton(wrap, select);
    syncSortA11y(wrap, select, btn);
    return btn;
  }

  function sortMenuAnchor(wrap) {
    var btn = sortButtonEl(wrap);
    if (btn && customSortMenuEnabled()) return btn;
    return (
      sortMenuSelect(wrap) ||
      (wrap && wrap.querySelector && wrap.querySelector(".sf-sort-trigger")) ||
      wrap
    );
  }

  function ensureSortTrigger(wrap, select) {
    var trigger = wrap.querySelector(".sf-sort-trigger");
    var control = wrap.querySelector(".sf-sort-control") || wrap;
    var row = wrap.querySelector(".sf-sort-row");
    if (!trigger) {
      trigger = document.createElement("div");
      trigger.className = "sf-sort-trigger";
    }
    if (trigger.parentNode !== control && trigger.parentNode !== row) {
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

  function ensureSortRow(wrap, select) {
    var control = wrap.querySelector(".sf-sort-control") || wrap;
    var trigger = ensureSortTrigger(wrap, select);
    var label = wrap.querySelector(".sf-sort-label");
    var row = wrap.querySelector(".sf-sort-row");
    if (!row) {
      row = document.createElement("div");
      row.className = "sf-sort-row";
    }
    if (row.parentNode !== control) {
      var count = control.querySelector(".sf-total-count");
      if (count && count.parentNode === control) control.insertBefore(row, count);
      else if (control.firstChild) control.insertBefore(row, control.firstChild);
      else control.appendChild(row);
    }
    if (label && label.parentNode !== row) row.appendChild(label);
    if (trigger.parentNode !== row) row.appendChild(trigger);
    return row;
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
    menu.style.visibility = "";
  }

  var sortMenuIgnoreClick = false;

  function reparentSortMenu(wrap, menu) {
    if (!wrap || !menu) return;
    var trigger = wrap.querySelector(".sf-sort-trigger") || wrap;
    if (menu.parentNode !== trigger) trigger.appendChild(menu);
  }

  function hideSortMenuEl(wrap, menu) {
    if (!menu) return;
    menu.hidden = true;
    menu.classList.remove("is-open");
    menu.classList.remove("is-ported");
    resetSortMenuPosition(menu);
    reparentSortMenu(wrap, menu);
  }

  function closeSortMenu(wrap) {
    if (!wrap) return;
    wrap.classList.remove("is-sort-open");
    var menu = sortMenuEl(wrap) || wrap._sfSortMenu;
    hideSortMenuEl(wrap, menu);
    var ported = document.querySelectorAll("body > .sf-sort-menu");
    var i;
    for (i = 0; i < ported.length; i++) {
      if (ported[i] === menu || ported[i] === wrap._sfSortMenu) {
        hideSortMenuEl(wrap, ported[i]);
      }
    }
    syncSortButton(wrap, sortMenuSelect(wrap));
  }

  function toggleSortMenu(wrap) {
    if (!wrap) return;
    if (wrap.classList.contains("is-sort-open")) closeSortMenu(wrap);
    else openSortMenu(wrap, sortMenuEl(wrap));
  }

  function positionSortMenu(wrap, menu) {
    var anchor = sortMenuAnchor(wrap);
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
    var gap = 6;
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
    syncSortButton(wrap, sortMenuSelect(wrap));
    positionSortMenu(wrap, menu);
    menu.style.visibility = "";
    sortMenuIgnoreClick = true;
    window.setTimeout(function () {
      sortMenuIgnoreClick = false;
    }, 0);
    var selected = menu.querySelector(".sf-sort-option.is-selected");
    try {
      if (selected) selected.focus();
    } catch (err) {
      /* ignore */
    }
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
      if (sortMenuIgnoreClick) return;
      var openWrap = document.querySelector(".sf-sort.is-sort-open");
      if (!openWrap) return;
      var menu = sortMenuEl(openWrap);
      if (openWrap.contains(e.target) || (menu && menu.contains(e.target))) {
        return;
      }
      closeSortMenu(openWrap);
    });
    document.addEventListener("keydown", function (e) {
      var openWrap = document.querySelector(".sf-sort.is-sort-open");
      if (!openWrap) return;
      var menu = sortMenuEl(openWrap);
      if (e.key === "Escape") {
        closeSortMenu(openWrap);
        var btn = sortButtonEl(openWrap);
        try {
          if (btn && customSortMenuEnabled()) btn.focus();
        } catch (err) {
          /* ignore */
        }
        return;
      }
      if (!menu) return;
      if (
        e.key !== "ArrowDown" &&
        e.key !== "ArrowUp" &&
        e.key !== "Home" &&
        e.key !== "End"
      ) {
        return;
      }
      var options = menu.querySelectorAll(".sf-sort-option");
      if (!options.length) return;
      e.preventDefault();
      var i;
      var idx = -1;
      for (i = 0; i < options.length; i++) {
        if (options[i] === document.activeElement) idx = i;
      }
      if (idx < 0) {
        for (i = 0; i < options.length; i++) {
          if (options[i].classList.contains("is-selected")) idx = i;
        }
      }
      if (e.key === "Home") idx = 0;
      else if (e.key === "End") idx = options.length - 1;
      else if (e.key === "ArrowDown") idx = Math.min(options.length - 1, idx + 1);
      else idx = Math.max(0, idx - 1);
      try {
        options[idx].focus();
      } catch (err) {
        /* ignore */
      }
    });
    window.addEventListener(
      "scroll",
      function () {
        var openWrap = document.querySelector(".sf-sort.is-sort-open");
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
    var sortBtn = ensureSortButton(wrap, select);
    ensureSortRow(wrap, select);
    closeSortMenu(wrap);
    var menu = sortMenuEl(wrap);
    if (!menu) {
      menu = document.createElement("div");
      menu.className = "sf-sort-menu";
      menu.setAttribute("role", "listbox");
      menu.hidden = true;
    }
    if (!menu.id) menu.id = ((select && select.id) || "smart-filter-sort") + "-menu";
    wrap._sfSortMenu = menu;
    if (sortBtn) sortBtn.setAttribute("aria-controls", menu.id);
    if (menu.parentNode !== trigger) trigger.appendChild(menu);
    menu.innerHTML = "";
    Array.prototype.forEach.call(select.options, function (opt) {
      var optionBtn = document.createElement("button");
      optionBtn.type = "button";
      optionBtn.className = "sf-sort-option";
      if (opt.selected) optionBtn.className += " is-selected";
      optionBtn.setAttribute("role", "option");
      optionBtn.setAttribute("aria-selected", opt.selected ? "true" : "false");
      optionBtn.textContent = opt.textContent;
      optionBtn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        var next = opt.value;
        closeSortMenu(wrap);
        if (select.value !== next) {
          select.value = next;
          syncSortButton(wrap, select);
          if (typeof select.dispatchEvent === "function") {
            select.dispatchEvent(new Event("change", { bubbles: true }));
          }
        } else {
          syncSortButton(wrap, select);
        }
      });
      menu.appendChild(optionBtn);
    });
    wrap.classList.add("sf-sort-has-menu");
    syncSortButton(wrap, select);
    if (!select._sfSortBtnSync) {
      select._sfSortBtnSync = true;
      select.addEventListener("change", function () {
        syncSortButton(wrap, select);
      });
    }
    if (!wrap._sfSortMenuBound) {
      wrap._sfSortMenuBound = true;
      wrap.addEventListener("click", function (e) {
        if (!customSortMenuEnabled()) return;
        if (!e.target || !e.target.closest) return;
        if (e.target.closest(".sf-sort-option")) return;
        if (e.target.closest(".sf-sort-btn")) {
          e.preventDefault();
          e.stopPropagation();
          toggleSortMenu(wrap);
          return;
        }
        if (
          e.target.closest(".sf-sort-trigger") ||
          e.target === sortMenuSelect(wrap)
        ) {
          e.stopPropagation();
        }
      });
      wrap.addEventListener("mousedown", function (e) {
        if (!customSortMenuEnabled()) return;
        if (!e.target || !e.target.closest) return;
        if (e.target.closest(".sf-sort-option")) return;
        if (e.target.closest(".sf-sort-menu")) return;
        if (e.target.closest(".sf-sort-btn")) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        if (
          !e.target.closest(".sf-sort-trigger") &&
          e.target !== sortMenuSelect(wrap)
        ) {
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        toggleSortMenu(wrap);
      });
      wrap.addEventListener("keydown", function (e) {
        if (!customSortMenuEnabled()) return;
        var liveBtn = sortButtonEl(wrap);
        var liveSelect = sortMenuSelect(wrap);
        var onTrigger =
          e.target === liveBtn ||
          (liveBtn && liveBtn.contains && liveBtn.contains(e.target)) ||
          e.target === liveSelect;
        if (!onTrigger) return;
        if (e.key === "Escape") {
          closeSortMenu(wrap);
          return;
        }
        if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
          e.preventDefault();
          openSortMenu(wrap, sortMenuEl(wrap));
        }
      });
    }
    bindSortMenuChrome();
  }

  function decorateCheckMarks(root) {
    if (!root || !root.querySelectorAll) return;
    var labels = root.querySelectorAll(
      ".sf-option:not(.sf-swatch):not(.sf-pill)",
    );
    var i;
    for (i = 0; i < labels.length; i++) {
      var label = labels[i];
      if (!label || label.querySelector(".sf-check")) continue;
      var input = label.querySelector('input[type="checkbox"], input[type="radio"]');
      if (!input) continue;
      var mark = document.createElement("span");
      mark.className = "sf-check";
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
    var main = document.querySelector(".sf-layout-main");
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

  function findDrawerToggle(widget) {
    return (
      (widget && widget.toggleEl) ||
      (widget &&
        widget.root &&
        widget.root.querySelector("[data-drawer-toggle]")) ||
      document.querySelector(".sf-toolbar [data-drawer-toggle]") ||
      document.querySelector("[data-drawer-toggle]")
    );
  }

  function placeMobileToolbarToggle(widget) {
    var toggle = findDrawerToggle(widget);
    if (!toggle) return null;
    /* Off-canvas always uses the toolbar Filter button (desktop + mobile).
       Vertical/Horizontal only move the toggle into the toolbar below 990px. */
    var useToolbar = isMobileDrawer() || isOffcanvasPosition(widget);
    if (!useToolbar) {
      if (
        toggle.classList.contains("sf-toggle-toolbar") &&
        widget &&
        widget.root
      ) {
        toggle.classList.remove("sf-toggle-toolbar");
        widget.root.insertBefore(toggle, widget.root.firstChild);
      }
      if (widget) widget.toggleEl = toggle;
      return toggle;
    }
    var host = document.querySelector(".sf-toolbar") || toolbarHost();
    if (!host || host.className.indexOf("sf-toolbar") === -1) {
      if (widget) widget.toggleEl = toggle;
      return toggle;
    }
    toggle.classList.add("sf-toggle-toolbar");
    var end = host.querySelector(".sf-toolbar-end");
    if (!end) {
      end = document.createElement("div");
      end.className = "sf-toolbar-end";
      host.appendChild(end);
    }
    var actions = end.querySelector(".sf-toolbar-actions");
    if (!actions) {
      actions = document.createElement("div");
      actions.className = "sf-toolbar-actions";
      end.insertBefore(actions, end.firstChild);
    }
    if (toggle.parentNode !== actions) {
      actions.insertBefore(toggle, actions.firstChild);
    }
    if (widget) widget.toggleEl = toggle;
    return toggle;
  }

  function placeDrawerChips(widget) {
    if (!widget) return;
    var panel =
      widget.panelEl ||
      (widget.root && widget.root.querySelector("[data-drawer-panel]")) ||
      document.querySelector("[data-drawer-panel]");
    var head = panel && panel.querySelector(".sf-header");
    if (!head) return;
    var slot = head.querySelector("[data-filter-chips]");
    if (!slot) {
      slot = document.createElement("div");
      slot.className = "sf-chips-slot";
      slot.setAttribute("data-filter-chips", "");
      head.appendChild(slot);
    }
    var facets = widget.facetsEl;
    var chips = null;
    if (facets && facets.firstElementChild) {
      var first = facets.firstElementChild;
      if (first.classList && first.classList.contains("sf-chips")) {
        chips = first;
      }
    }
    while (slot.firstChild) slot.removeChild(slot.firstChild);
    if (chips) {
      slot.appendChild(chips);
      slot.hidden = false;
    } else {
      slot.hidden = true;
    }
  }

  function clearPageChipsSlot(slot) {
    if (!slot) return;
    while (slot.firstChild) slot.removeChild(slot.firstChild);
    slot.hidden = true;
  }

  function ensurePageChipsSlot() {
    var slot = document.querySelector("[data-page-filter-chips]");
    var toolbar = document.querySelector(".sf-toolbar");
    if (slot) {
      if (
        toolbar &&
        toolbar.parentNode &&
        (slot.parentNode !== toolbar.parentNode || slot.previousSibling !== toolbar)
      ) {
        if (toolbar.nextSibling) {
          toolbar.parentNode.insertBefore(slot, toolbar.nextSibling);
        } else {
          toolbar.parentNode.appendChild(slot);
        }
      }
      return slot;
    }
    slot = document.createElement("div");
    slot.className = "sf-page-chips";
    slot.setAttribute("data-page-filter-chips", "");
    slot.hidden = true;
    if (toolbar && toolbar.parentNode) {
      if (toolbar.nextSibling) {
        toolbar.parentNode.insertBefore(slot, toolbar.nextSibling);
      } else {
        toolbar.parentNode.appendChild(slot);
      }
      return slot;
    }
    var main = document.querySelector(".sf-layout-main");
    if (main) {
      if (main.firstChild) main.insertBefore(slot, main.firstChild);
      else main.appendChild(slot);
      return slot;
    }
    return null;
  }

  function isShopifyGidLabel(value) {
    return /^gid:\/\/shopify\//i.test(String(value == null ? "" : value).trim());
  }

  function chipLabelKey(key, value) {
    return String(key) + "\0" + String(value == null ? "" : value);
  }

  function humanChipItemLabel(item) {
    if (!item) return "";
    var label = item.label != null ? String(item.label).trim() : "";
    if (label && !isShopifyGidLabel(label)) return label;
    var handle = item.handle != null ? String(item.handle).trim() : "";
    if (handle) return handle;
    return "";
  }

  function rememberChipLabel(widget, key, value, label) {
    if (!widget) return;
    if (!widget._valueLabels) widget._valueLabels = {};
    var text = String(label == null ? "" : label).trim();
    if (!key || value == null || value === "" || !text || isShopifyGidLabel(text)) {
      return;
    }
    widget._valueLabels[chipLabelKey(key, value)] = text;
  }

  function rememberFacetChipLabels(widget, facets) {
    if (!widget) return;
    if (!widget._valueLabels) widget._valueLabels = {};
    function walk(key, items) {
      (items || []).forEach(function (item) {
        if (!item) return;
        var value = item.value != null ? item.value : item.label;
        var label = humanChipItemLabel(item);
        if (value != null && value !== "" && label) {
          rememberChipLabel(widget, key, value, label);
        }
        if (item.handle && label) {
          rememberChipLabel(widget, key, item.handle, label);
        }
        if (item.children && item.children.length) walk(key, item.children);
      });
    }
    (facets || []).forEach(function (facet) {
      if (!facet || !facet.key) return;
      walk(facet.key, facet.values);
    });
  }

  function resolveChipLabel(widget, key, value) {
    if (!widget) return "";
    if (!widget._valueLabels) widget._valueLabels = {};
    var cacheKey = chipLabelKey(key, value);
    var cached = widget._valueLabels[cacheKey];
    if (cached && !isShopifyGidLabel(cached)) return String(cached);
    rememberFacetChipLabels(widget, widget.facets);
    cached = widget._valueLabels[cacheKey];
    if (cached && !isShopifyGidLabel(cached)) return String(cached);
    // Match GID / numeric collection ids across facet values.
    var wantedId = String(value == null ? "" : value).match(/\/Collection\/(\d+)/i);
    wantedId = wantedId ? wantedId[1] : /^\d+$/.test(String(value || "")) ? String(value) : "";
    if (wantedId) {
      var keys = Object.keys(widget._valueLabels);
      for (var i = 0; i < keys.length; i++) {
        if (keys[i].indexOf(String(key) + "\0") !== 0) continue;
        var rawVal = keys[i].slice(String(key).length + 1);
        var idMatch = String(rawVal).match(/\/Collection\/(\d+)/i);
        var id = idMatch ? idMatch[1] : /^\d+$/.test(rawVal) ? rawVal : "";
        if (id && id === wantedId && !isShopifyGidLabel(widget._valueLabels[keys[i]])) {
          return String(widget._valueLabels[keys[i]]);
        }
      }
    }
    return cached && !isShopifyGidLabel(cached) ? String(cached) : "";
  }

  /** Mobile-only applied chips on the collection page (outside the drawer). */
  function placeMobilePageChips(widget) {
    if (!widget) return;
    var slot =
      (widget._pageChipsSlot &&
        widget._pageChipsSlot.isConnected !== false &&
        widget._pageChipsSlot) ||
      document.querySelector("[data-page-filter-chips]");

    if (!isMobileDrawer() || widget.showRefineBy === false) {
      if (slot) clearPageChipsSlot(slot);
      return;
    }

    slot = ensurePageChipsSlot();
    if (!slot) return;
    widget._pageChipsSlot = slot;

    clearPageChipsSlot(slot);
    if (typeof widget.renderChips !== "function") return;

    rememberFacetChipLabels(widget, widget.facets);
    var chips = widget.renderChips();
    if (chips) {
      slot.appendChild(chips);
      slot.hidden = false;
    } else {
      slot.hidden = true;
    }
  }

  function liveDrawerPanel(widget) {
    if (
      widget &&
      widget.panelEl &&
      widget.panelEl.isConnected !== false &&
      widget.panelEl.matches &&
      widget.panelEl.matches("[data-drawer-panel], .sf-panel")
    ) {
      return widget.panelEl;
    }
    if (widget && widget.root) {
      var nested = widget.root.querySelector("[data-drawer-panel]");
      if (nested) return nested;
    }
    return (
      document.querySelector(".sf-panel.sf-drawer-portal[data-drawer-panel]") ||
      document.querySelector(".sf-panel.sf-drawer-portal") ||
      document.querySelector("[data-drawer-panel]")
    );
  }

  function liveDrawerBackdrop(widget) {
    if (
      widget &&
      widget.backdropEl &&
      widget.backdropEl.isConnected !== false
    ) {
      return widget.backdropEl;
    }
    if (widget && widget.root) {
      var nested = widget.root.querySelector("[data-drawer-backdrop]");
      if (nested) return nested;
    }
    return (
      document.querySelector(".sf-backdrop.sf-drawer-portal") ||
      document.querySelector("[data-drawer-backdrop]")
    );
  }

  function syncDrawerPanelRefs(widget, panel) {
    if (!widget || !panel) return;
    widget.panelEl = panel;
    var facets = panel.querySelector("[data-facets]");
    if (facets) widget.facetsEl = facets;
    var status = panel.querySelector("[data-status]");
    if (status) widget.statusEl = status;
    var close = panel.querySelector("[data-drawer-close]");
    if (close) widget.closeEl = close;
    var clear = panel.querySelector("[data-clear-all]");
    if (clear) widget.clearAllEl = clear;
  }

  function ensurePortaledFacetsPainted(widget, panel) {
    if (!widget || !panel) return;
    syncDrawerPanelRefs(widget, panel);
    restoreFindlyPanelChrome(panel);
    var facets = widget.facetsEl;
    if (!facets) return;
    var hasFacet = facets.querySelector(".sf-facet, [data-skeleton]");
    if (hasFacet) return;
    if (
      Array.isArray(widget.facets) &&
      widget.facets.length &&
      widget.renderFacets
    ) {
      widget.renderFacets();
      return;
    }
    // Keep a visible loading skeleton so the drawer is never a blank white sheet.
    if (!facets.childElementCount) {
      facets.innerHTML =
        '<div class="sf-skeleton" data-skeleton aria-hidden="true">' +
        '<div class="sf-skeleton-facet"><span class="sf-skeleton-label"></span>' +
        '<span class="sf-skeleton-line"></span><span class="sf-skeleton-line"></span>' +
        '<span class="sf-skeleton-line is-short"></span></div>' +
        '<div class="sf-skeleton-facet"><span class="sf-skeleton-label"></span>' +
        '<span class="sf-skeleton-line"></span>' +
        '<span class="sf-skeleton-line is-short"></span></div>' +
        '<div class="sf-skeleton-facet"><span class="sf-skeleton-label"></span>' +
        '<span class="sf-skeleton-line"></span><span class="sf-skeleton-line"></span>' +
        '<span class="sf-skeleton-line is-short"></span></div></div>';
    }
  }

  function applyPortaledPanelLayout(panel, widget) {
    if (!panel || !panel.style) return;
    var right =
      (widget &&
        widget.root &&
        widget.root.classList &&
        widget.root.classList.contains("smart-filter--right")) ||
      (widget && widget.position === "right");
    panel.style.setProperty("position", "fixed", "important");
    panel.style.setProperty("top", "0", "important");
    panel.style.setProperty("bottom", "0", "important");
    if (right) {
      panel.style.setProperty("left", "auto", "important");
      panel.style.setProperty("right", "0", "important");
    } else {
      panel.style.setProperty("left", "0", "important");
      panel.style.setProperty("right", "auto", "important");
    }
    panel.style.setProperty("z-index", "100050", "important");
    panel.style.setProperty("display", "flex", "important");
    panel.style.setProperty("flex-direction", "column", "important");
    panel.style.setProperty("width", "min(400px, 88vw)", "important");
    panel.style.setProperty("max-width", "88vw", "important");
    panel.style.setProperty("box-sizing", "border-box", "important");
    panel.style.setProperty("padding", "0", "important");
    panel.style.setProperty("overflow", "hidden", "important");
    panel.style.setProperty("color", "#111", "important");
    panel.style.setProperty("background", "#fff", "important");
    var facets = panel.querySelector("[data-facets], .sf-facets");
    if (facets && facets.style) {
      facets.style.setProperty("flex", "1 1 auto", "important");
      facets.style.setProperty("min-height", "50vh", "important");
      facets.style.setProperty("overflow", "auto", "important");
      facets.style.setProperty("visibility", "visible", "important");
      facets.style.setProperty("opacity", "1", "important");
      facets.style.setProperty("color", "#111", "important");
      facets.style.setProperty("display", "flex", "important");
      facets.style.setProperty("flex-direction", "column", "important");
    }
  }

  function clearPortaledPanelLayout(panel) {
    if (!panel || !panel.style) return;
    [
      "position",
      "top",
      "bottom",
      "left",
      "right",
      "z-index",
      "display",
      "flex-direction",
      "width",
      "max-width",
      "box-sizing",
      "padding",
      "overflow",
      "color",
      "background",
    ].forEach(function (prop) {
      panel.style.removeProperty(prop);
    });
    var facets = panel.querySelector("[data-facets], .sf-facets");
    if (facets && facets.style) {
      [
        "flex",
        "min-height",
        "overflow",
        "visibility",
        "opacity",
        "color",
        "display",
        "flex-direction",
      ].forEach(function (prop) {
        facets.style.removeProperty(prop);
      });
    }
  }

  function portalMobileDrawer(widget) {
    if (!widget || !widget.root) return;
    var panel = liveDrawerPanel(widget);
    var backdrop = liveDrawerBackdrop(widget);
    var toggle =
      widget.toggleEl ||
      widget.root.querySelector("[data-drawer-toggle]") ||
      document.querySelector(".sf-toggle-toolbar") ||
      document.querySelector("[data-drawer-toggle]");
    if (!panel) return;
    if (shouldPortalDrawer(widget)) {
      if (backdrop && backdrop.parentNode !== document.body) {
        backdrop.classList.add("sf-drawer-portal");
        document.body.appendChild(backdrop);
      }
      if (panel.parentNode !== document.body) {
        panel.classList.add("sf-drawer-portal");
        document.body.appendChild(panel);
      } else {
        panel.classList.add("sf-drawer-portal");
      }
      copyDrawerThemeVars(widget, panel);
      applyPortaledPanelLayout(panel, widget);
      syncDrawerPanelRefs(widget, panel);
      restoreFindlyPanelChrome(panel);
      ensurePortaledFacetsPainted(widget, panel);
      decorateCheckMarks(panel);
      enhancePriceSliders(panel);
      placeMobileToolbarToggle(widget);
      if (widget && widget.toggleEl) toggle = widget.toggleEl;
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
        clearPortaledPanelLayout(panel);
        widget.root.appendChild(panel);
      }
      if (backdrop && backdrop.classList.contains("sf-drawer-portal")) {
        backdrop.classList.remove("sf-drawer-portal", "is-open");
        widget.root.insertBefore(backdrop, panel);
      }
      if (toggle && toggle.classList.contains("sf-toggle-toolbar")) {
        toggle.classList.remove("sf-toggle-toolbar");
        widget.root.insertBefore(toggle, widget.root.firstChild);
      }
      document.documentElement.classList.remove("is-sf-drawer-open");
    }
    syncDrawerPanelRefs(widget, panel);
    widget.backdropEl = backdrop;
    widget.toggleEl = toggle;
    placeMobilePageChips(widget);
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

  function listItemClassForGrid(parent, sample) {
    if (sample && sample.classList) {
      if (sample.classList.contains("grid__item")) return "grid__item";
      if (sample.classList.contains("product-grid__item")) return "product-grid__item";
      if (sample.classList.contains("grid-view-item")) return "grid-view-item";
    }
    if (parent) {
      if (parent.id === "product-grid" || parent.id === "ProductGrid") return "grid__item";
      if (parent.classList && parent.classList.contains("main-collection-grid")) {
        return "product-grid__item";
      }
      if (parent.classList && parent.classList.contains("grid")) return "grid__item";
    }
    return "product-grid__item";
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
        if (self._loadingPage || self._inflight) return;
        self._findlyObserverCount = (self._findlyObserverCount || 0) + 1;
        if (self._findlyObserverCount > 8) {
          try {
            self._findlyGridObserver.disconnect();
          } catch (err) {
            /* ignore */
          }
          return;
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

  function mountFindlyPager(widget) {
    if (!widget) return;
    if (widget.hideFindlyPagerEl) widget.hideFindlyPagerEl();
    if (widget.syncThemePager) widget.syncThemePager();
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
    if (!sample) {
      var tray = document.getElementById(CARD_TRAY_ID);
      if (tray && tray.children) {
        for (i = 0; i < tray.children.length; i++) {
          if (String(tray.children[i].tagName || "").toLowerCase() === "li") {
            sample = tray.children[i];
            break;
          }
        }
      }
    }
    var cards = parent.querySelectorAll(".sf-app-card");
    for (i = 0; i < cards.length; i++) {
      var card = cards[i];
      card.style.removeProperty("display");
      card.hidden = false;
      card.removeAttribute("data-smart-filter-hidden");
      if (
        isListHost(parent) &&
        String(card.tagName || "").toLowerCase() !== "li"
      ) {
        var holder = document.createElement("li");
        holder.className = listItemClassForGrid(parent, sample) + " sf-app-card";
        var names = ["data-sf-card-key", "data-product-handle", "data-product-id"];
        var n;
        for (n = 0; n < names.length; n++) {
          var val = card.getAttribute(names[n]);
          if (val) holder.setAttribute(names[n], val);
        }
        if (card.parentNode === parent) parent.insertBefore(holder, card);
        while (card.firstChild) holder.appendChild(card.firstChild);
        if (card.parentNode) card.parentNode.removeChild(card);
      }
    }
  }

  function pageSlice(widget, items, append) {
    if (!widget || !items || !items.length) return items;
    if (widget.ensurePageSize) widget.ensurePageSize();
    var size = widget.pageSize || 16;
    if (items.length <= size) return items;
    if (append) return items.slice(0, size);
    var start = (Math.max(1, widget.page || 1) - 1) * size;
    if (start >= items.length) return items;
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
    var fill = slider.querySelector(".sf-slider-fill");
    var min = Number(low.min);
    var max = Number(low.max);
    var step = low.step || "1";
    var thumbLow = slider.querySelector(".sf-slider-thumb-min");
    if (!thumbLow) {
      thumbLow = document.createElement("span");
      thumbLow.className =
        "sf-slider-thumb sf-slider-thumb-min";
      thumbLow.setAttribute("aria-hidden", "true");
      slider.appendChild(thumbLow);
    }
    var thumbHigh = slider.querySelector(".sf-slider-thumb-max");
    if (!thumbHigh) {
      thumbHigh = document.createElement("span");
      thumbHigh.className =
        "sf-slider-thumb sf-slider-thumb-max";
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

  function applyFacetValueQuery(wrap, query) {
    var q = String(query || "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
    var list =
      wrap.querySelector(".sf-options") ||
      wrap.querySelector("select.sf-dropdown");
    if (!list) return;
    if (list.tagName === "SELECT") {
      var opts = list.options;
      var i;
      for (i = 0; i < opts.length; i++) {
        if (!opts[i].value) {
          opts[i].hidden = false;
          continue;
        }
        var optText = String(opts[i].textContent || "").toLowerCase();
        opts[i].hidden = Boolean(q) && optText.indexOf(q) === -1;
      }
      return;
    }
    function visit(li) {
      var label = "";
      var textEl = li.querySelector(".sf-option-text, .sf-collection-link");
      if (textEl) label = String(textEl.textContent || "").toLowerCase();
      var childList = null;
      var kids = li.children;
      var c;
      for (c = 0; c < kids.length; c++) {
        if (
          kids[c].classList &&
          kids[c].classList.contains("sf-tree-children")
        ) {
          childList = kids[c];
          break;
        }
      }
      var childHit = false;
      if (childList) {
        var nested = childList.children;
        for (c = 0; c < nested.length; c++) {
          if (nested[c].nodeType === 1 && visit(nested[c])) childHit = true;
        }
      }
      var input = li.querySelector("input");
      var checked = Boolean(input && input.checked);
      var hit = !q || label.indexOf(q) !== -1 || childHit || checked;
      li.hidden = !hit;
      return hit;
    }
    var top = list.children;
    var t;
    for (t = 0; t < top.length; t++) {
      if (top[t].nodeType === 1) visit(top[t]);
    }
  }

  function buildFacetValueSearch(wrap, widget) {
    var box = document.createElement("div");
    box.className = "sf-facet-search";
    var input = document.createElement("input");
    input.type = "search";
    input.className = "sf-facet-search-input";
    input.autocomplete = "off";
    input.setAttribute("data-findly-ignore-instant", "");
    input.setAttribute("role", "textbox");
    input.placeholder =
      widget && widget.t
        ? widget.t("search_values", "Search values")
        : "Search values";
    input.setAttribute("aria-label", input.placeholder);
    input.addEventListener("click", function (event) {
      event.stopPropagation();
    });
    input.addEventListener("keydown", function (event) {
      if (event.key === "Enter") event.preventDefault();
    });
    input.addEventListener("input", function () {
      applyFacetValueQuery(wrap, input.value);
    });
    box.appendChild(input);
    return box;
  }

  function mountFacetValueSearch(widget) {
    if (!widget) return;
    var root = widget.panelEl || widget.facetsEl || widget.root;
    if (!root || !root.querySelectorAll) return;
    var wanted = {};
    var facets = widget.facets || [];
    var i;
    for (i = 0; i < facets.length; i++) {
      if (
        facets[i] &&
        facets[i].enableValueSearch &&
        facets[i].type !== "price_range" &&
        facets[i].displayType !== "slider"
      ) {
        var facetKey = String(facets[i].key);
        wanted[facetKey] = true;
        if (facetKey === "tag") wanted.tags = true;
        if (facetKey === "tags") wanted.tag = true;
      }
    }
    var nodes = root.querySelectorAll(".sf-facet[data-facet-key]");
    for (i = 0; i < nodes.length; i++) {
      var wrap = nodes[i];
      var key = wrap.getAttribute("data-facet-key");
      if (!wanted[key]) continue;
      if (wrap.querySelector(".sf-facet-search")) continue;
      if (wrap.querySelector(".sf-price")) continue;
      var after =
        wrap.querySelector(".sf-options") ||
        wrap.querySelector(".sf-dropdown-wrap");
      if (!after) continue;
      wrap.insertBefore(buildFacetValueSearch(wrap, widget), after);
    }
  }

  function enhancePriceSliders(root) {
    if (!root || !root.querySelectorAll) return;
    var sliders = root.querySelectorAll(".sf-slider");
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
      cls.contains("sf-layout-aside") ||
      cls.contains("smart-filter")
    );
  }

  function isColumnMain(el) {
    if (!el || el.nodeType !== 1 || !el.classList) return false;
    if (!el.classList.contains("sf-layout-main")) return false;
    if (isProductGridLike(el) || isThemeManagedGrid(el)) return false;
    return true;
  }

  function findColumnMainContaining(grid) {
    var nodes = document.querySelectorAll(".sf-layout-main");
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

  var COLLECTION_SEARCH_ICON =
    '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true"><circle cx="8" cy="8" r="5.1" stroke="currentColor" stroke-width="1.5"/><path d="M11.8 11.8L15.4 15.4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
  var COLLECTION_SEARCH_CLEAR_ICON =
    '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M2.5 2.5l7 7M9.5 2.5l-7 7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';

  function decorateCollectionSearchField(wrap) {
    if (!wrap) return;
    var input = wrap.querySelector("[data-collection-search]");
    if (!input) return;
    var field = wrap.querySelector(".sf-search-field");
    if (!field) {
      field = document.createElement("div");
      field.className = "sf-search-field";
      var icon = document.createElement("span");
      icon.className = "sf-search-icon";
      icon.setAttribute("aria-hidden", "true");
      icon.innerHTML = COLLECTION_SEARCH_ICON;
      input.parentNode.insertBefore(field, input);
      field.appendChild(icon);
      field.appendChild(input);
    } else if (!field.querySelector(".sf-search-icon")) {
      var missing = document.createElement("span");
      missing.className = "sf-search-icon";
      missing.setAttribute("aria-hidden", "true");
      missing.innerHTML = COLLECTION_SEARCH_ICON;
      field.insertBefore(missing, field.firstChild);
    }
    var clear = field.querySelector("[data-collection-search-clear], .sf-search-clear");
    if (!clear) {
      clear = document.createElement("button");
      clear.type = "button";
      clear.className = "sf-search-clear";
      clear.setAttribute("data-collection-search-clear", "");
      clear.setAttribute(
        "aria-label",
        wrap.getAttribute("data-clear-search-label") || "Clear search",
      );
      clear.hidden = true;
      field.appendChild(clear);
    }
    if (!clear.querySelector("svg")) {
      clear.textContent = "";
      clear.innerHTML = COLLECTION_SEARCH_CLEAR_ICON;
    }
    if (clear.getAttribute("data-sf-bound") === "1") {
      clear.hidden = !(input.value || "").length;
      return;
    }
    clear.setAttribute("data-sf-bound", "1");
    function syncClear() {
      clear.hidden = !(input.value || "").length;
    }
    input.addEventListener("input", syncClear);
    clear.addEventListener("click", function () {
      input.value = "";
      syncClear();
      try {
        input.dispatchEvent(new Event("input", { bubbles: true }));
      } catch (err) {
        var ev = document.createEvent("Event");
        ev.initEvent("input", true, true);
        input.dispatchEvent(ev);
      }
      input.focus();
    });
    syncClear();
  }

  function ensureCollectionSearchMarkup(widget) {
    if (!widget) return;
    var wrap =
      widget.collectionSearchWrap ||
      document.querySelector("[data-collection-search-wrap]");
    if (!wrap && widget.root) {
      wrap = document.createElement("div");
      wrap.className = "sf-search";
      wrap.setAttribute("data-collection-search-wrap", "");
      wrap.setAttribute(
        "data-clear-search-label",
        widget.root.getAttribute("data-i18n-clear-search") || "Clear search",
      );
      wrap.hidden = true;
      var label = document.createElement("label");
      label.className = "sf-search-label";
      label.setAttribute("for", "smart-filter-collection-q");
      label.textContent = widget.t
        ? widget.t("search_submit", "Search")
        : "Search";
      var input = document.createElement("input");
      input.id = "smart-filter-collection-q";
      input.className = "sf-search-input";
      input.type = "search";
      input.setAttribute("data-collection-search", "");
      input.setAttribute(
        "placeholder",
        widget.root.getAttribute("data-i18n-search-placeholder") ||
          "Search products",
      );
      input.setAttribute("autocomplete", "off");
      input.setAttribute("enterkeyhint", "search");
      wrap.appendChild(label);
      wrap.appendChild(input);
      widget.root.appendChild(wrap);
    }
    if (!wrap) return;
    decorateCollectionSearchField(wrap);
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

  function scrubToolbarCountDupes(widget) {
    var toolbar = document.querySelector(".sf-toolbar");
    if (!toolbar || !toolbar.querySelectorAll) return;
    var keep = (widget && widget.totalCountEl) || toolbar.querySelector(".sf-total-count");
    var nodes = toolbar.querySelectorAll("p, span, small, div");
    var countRe = /^\s*\d+\s*(items?|products?|results?)\s*$/i;
    var i;
    for (i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      if (!node || node === keep) continue;
      if (keep && keep.contains && keep.contains(node)) continue;
      if (node.classList && node.classList.contains("sf-total-count")) continue;
      if (node.children && node.children.length > 1) continue;
      if (!countRe.test(String(node.textContent || "").trim())) continue;
      node.setAttribute("data-findly-count-hidden", "1");
      node.setAttribute("hidden", "");
      node.hidden = true;
      if (node.style) node.style.setProperty("display", "none", "important");
    }
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
      host.querySelector(".sf-search-host") ||
      document.querySelector(".sf-search-host");
    if (!searchHost) {
      searchHost = document.createElement("div");
      searchHost.className = "sf-search-host";
    }
    searchHost.classList.add("sf-toolbar-search");
    if (searchHost.parentNode !== host) {
      host.insertBefore(searchHost, host.firstChild);
    }

    var end = host.querySelector(".sf-toolbar-end");
    if (!end) {
      end = document.createElement("div");
      end.className = "sf-toolbar-end";
    }
    if (end.parentNode !== host) host.appendChild(end);

    var actions = end.querySelector(".sf-toolbar-actions");
    if (!actions) {
      actions = document.createElement("div");
      actions.className = "sf-toolbar-actions";
    }
    if (actions.parentNode !== end) end.insertBefore(actions, end.firstChild);

    var sortHost =
      actions.querySelector(".sf-sort-host") ||
      end.querySelector(".sf-sort-host") ||
      document.querySelector(".sf-sort-host");
    if (!sortHost) {
      sortHost = document.createElement("div");
      sortHost.className = "sf-sort-host";
    }
    if (sortHost.parentNode !== actions) actions.appendChild(sortHost);

    placeMobileToolbarToggle(widget);

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
      widget.sortWrap.classList.add("sf-sort-toolbar");
      if (widget.sortWrap.parentNode !== sortHost) {
        sortHost.appendChild(widget.sortWrap);
      }
      var select =
        widget.sortEl ||
        widget.sortWrap.querySelector("[data-sort], .sf-sort-select");
      var control = widget.sortWrap.querySelector(".sf-sort-control");
      if (!control) {
        control = document.createElement("div");
        control.className = "sf-sort-control";
      }
      var label = widget.sortWrap.querySelector(".sf-sort-label");
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
      ensureSortRow(widget.sortWrap, select);
    } else if (countEl.parentNode !== end) {
      end.appendChild(countEl);
    }

    if (wrap) {
      wrap.classList.add("sf-search-toolbar");
      if (wrap.parentNode !== searchHost) {
        searchHost.appendChild(wrap);
      }
      decorateCollectionSearchField(wrap);
    }
    scrubToolbarCountDupes(widget);
    syncToolbarLoading();
    placeMobilePageChips(widget);
  }

  var THEME_PAGER_SEL_GRID =
    "nav.pagination, .pagination-wrapper, .pagination, [data-pagination], .paginate, #pagination, .Pagination, #AjaxinatePagination, .ajaxinate-pagination";

  function applyPagerByDisplayedCount(widget, count) {
    if (widget && widget.applyPagerByProductCount) {
      widget.applyPagerByProductCount(count);
      return;
    }
    if (widget && widget.ensurePageSize) widget.ensurePageSize();
    var size = (widget && widget.pageSize) || 16;
    var n = Number(count);
    if (!Number.isFinite(n) || n < 0) return;
    var hide = n <= size;
    var root = document.documentElement;
    if (root && root.classList) {
      if (hide) {
        root.classList.add("sf-few-results");
        root.classList.add("sf-pager-unneeded");
      } else {
        root.classList.remove("sf-few-results");
        root.classList.remove("sf-pager-unneeded");
      }
    }
    var layout = document.querySelector(".sf-collection-layout");
    if (layout && layout.setAttribute) {
      if (hide) layout.setAttribute("data-sf-single-page", "1");
      else layout.removeAttribute("data-sf-single-page");
    }
    var nodes = document.querySelectorAll(THEME_PAGER_SEL_GRID);
    var i;
    for (i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (!el) continue;
      if (el.closest && el.closest(".sf-pager, .smart-filter")) continue;
      if (el.id === "findly-sf-pager") continue;
      if (hide) {
        el.setAttribute("data-sf-pager-suppressed", "1");
        el.hidden = true;
        el.setAttribute("hidden", "");
        el.style.setProperty("display", "none", "important");
      } else {
        el.hidden = false;
        el.removeAttribute("hidden");
        el.removeAttribute("data-sf-pager-suppressed");
        el.style.removeProperty("display");
      }
    }
  }

  function publishListingSuggestions(widget) {
    if (!widget) return;
    var data = widget._lastFilterData || {};
    var products = Array.isArray(data.products) ? data.products : [];
    var query = String(widget.collectionQuery || "").trim();
    var currency =
      (data.settings && data.settings.currency) ||
      (widget.currency ? String(widget.currency) : "");
    try {
      document.dispatchEvent(
        new CustomEvent("findly:listing-suggest", {
          bubbles: true,
          detail: {
            query: query,
            products: products,
            total: data.total != null ? data.total : products.length,
            currency: currency,
          },
        }),
      );
    } catch (err) {
      /* ignore */
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
          queryInnerCardGrid(parent) ||
          (parent.querySelector && parent.querySelector(PRODUCT_GRID_SELECTOR)) ||
          null;
        parent = inner && inner !== parent ? inner : parent.parentElement || parent;
      }

      parent = preferProductCardGrid(parent);

      if (parent && inAppMode) {
        parent = preferProductCardGrid(pickBetterGridHost(parent));
        if (parent && isResultsListEl(parent)) {
          parent = preferProductCardGrid(parent.parentElement || parent);
        }
      }

      if (parent && isPageShellHost(parent)) {
        var fromShell = queryInnerCardGrid(parent);
        if (fromShell) parent = fromShell;
      }

      if (parent) {
        if (
          this._gridParent &&
          this._gridParent !== parent &&
          !isPageShellHost(parent)
        ) {
          moveCardsToHost(this._gridParent, parent);
        }
        this._gridParent = parent;
        lockThemeGridTracks(parent);
        placeCollectionSearchOnGrid(this);
        return parent;
      }

      if (!inAppMode) {
        placeCollectionSearchOnGrid(this);
        return null;
      }
      if (results) {
        this._gridParent =
          preferProductCardGrid(results) || results.parentElement;
        lockThemeGridTracks(this._gridParent);
        placeCollectionSearchOnGrid(this);
        return this._gridParent;
      }
      this._gridParent = fallbackHost();
      lockThemeGridTracks(this._gridParent);
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
            host.classList.add("sf-layout-main");
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
      if (Math.max(1, Number(this.page) || 1) > 1) return true;
      /* Clear All / page 1 default browse — use native Liquid grid, not API order. */
      if (this._sfNativeListing && isNativeThemeGridState(this)) return false;
      if (isNativeThemeGridState(this)) return false;
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
      if (shouldTakeOverThemeCards(this) && origCount) origCount.call(this, count);
      scrubToolbarCountDupes(this);
      if (Number.isFinite(n) && n >= 0) this._statusProductCount = n;
      if (this.syncThemePager) this.syncThemePager();
      else if (shouldTakeOverThemeCards(this)) applyPagerByDisplayedCount(this, n);
    };

    var origLegacy = proto.applyThemeGridLegacy;
    proto.applyThemeGridLegacy = function (data, handles) {
      if (
        !shouldTakeOverThemeCards(this) &&
        Math.max(1, Number(this.page) || 1) <= 1 &&
        !this._loadingPage
      ) {
        applyNativeFilterGrid(null, this._gridParent);
        return;
      }
      if (origLegacy) origLegacy.call(this, data, handles);
    };

    var origApply = proto.applyAppGrid;
    proto.applyAppGrid = function (data, handles, append) {
      var sliced = this._skipPageSlice
        ? { data: data, handles: pageHandlesForGrid(this, handles, append) }
        : pageSlicePayload(this, data, handles, append);
      if (
        this._allFilterHandles &&
        this._allFilterHandles.length >
          (sliced.handles && sliced.handles.length ? sliced.handles.length : 0)
      ) {
        sliced.handles = pageHandlesForGrid(this, sliced.handles, append);
      }
      var parent = preferProductCardGrid(
        resolveCardHost(
          this._gridParent ||
            (this.ensureGridParent && this.ensureGridParent()),
        ) || this._gridParent,
      );
      if (parent && !isPageShellHost(parent)) this._gridParent = parent;
      if (!(this.isAppGridMode && this.isAppGridMode())) {
        mountCachedCards(this, sliced.handles, parent);
        if (shouldTakeOverThemeCards(this) || Math.max(1, Number(this.page) || 1) > 1) {
          applyNativeFilterGrid(sliced.handles, parent);
        } else {
          applyNativeFilterGrid(null, parent);
        }
        var shownNative = countAllowedInHost(parent, sliced.handles);
        var neededNative = uniqueAllowedCount(sliced.handles);
        if (neededNative > 0 && shownNative >= neededNative) return true;
        fillGapsWithThemeClones(this, sliced.handles, parent);
        shownNative = countAllowedInHost(parent, sliced.handles);
        if (!shouldTakeOverThemeCards(this)) return shownNative > 0;
        if (shownNative > 0) return true;
        fillGapsWithThemeClones(this, sliced.handles, parent);
        shownNative = countAllowedInHost(parent, sliced.handles);
        if (shownNative > 0) return true;
        return uniqueAllowedCount(sliced.handles) === 0;
      }
      var ok = origApply
        ? origApply.call(this, sliced.data, sliced.handles, append)
        : false;
      parent = this._gridParent || parent;
      if (parent && isGridHostEl(parent) && parent.classList) {
        restyleAppCardsAsThemeItems(parent);
      }
      setOwnsGrid(true);
      if (this.renderPager) this.renderPager();
      else if (this.setThemePagerHidden) this.setThemePagerHidden(true);
      mountFindlyPager(this);
      return ok;
    };

    var origRemoveImported = proto.removeImportedCards;
    proto.removeImportedCards = function () {
      if (origRemoveImported) origRemoveImported.call(this);
      var native = this._nativeHandles || {};
      var cache = this._cardCache || {};
      Object.keys(cache).forEach(function (handle) {
        if (native[handle]) return;
        var card = cache[handle];
        if (card && card.parentNode) {
          card.parentNode.removeChild(card);
        }
        delete cache[handle];
      });
      this._importedHandles = {};
      this._themePagesCached = {};
      this._themeNoMore = false;
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
        var cachedCard = cache[key] || (base && cache[base]);
        if (cardCacheUsable(cachedCard)) continue;
        if (cache[key] && !cardCacheUsable(cache[key])) delete cache[key];
        out.push(base || key);
      }
      if (out.length || !origMissing) return out;
      return origMissing.call(this, handles);
    };

    var origThemePage = proto.fetchThemePage;
    proto.fetchThemePage = function (page) {
      var self = this;
      if (!origThemePage) return Promise.resolve(false);
      var pending =
        self._ensureHandles ||
        self._visibleHandles ||
        self._shownHandles;
      if (
        self._themePagesCached &&
        self._themePagesCached[page] &&
        Number(page) > 1 &&
        pending &&
        pending.length &&
        self.missingHandles(pending).length
      ) {
        delete self._themePagesCached[page];
      }
      return origThemePage.call(this, page).then(function (ok) {
        if (!self._themeNoMore) return ok;
        if (pending && pending.length && self.missingHandles(pending).length) {
          self._themeNoMore = false;
        }
        return ok;
      });
    };

    /**
     * Prefer API product clones over theme HTML crawling when the payload already
     * has product rows for missing handles. Theme page order ≠ filter sort, so
     * Clear/filter often hunted 8–12 Liquid pages for a 16-product page slice.
     */
    var THEME_PAGE_BATCH = 4;
    var THEME_PAGE_FETCH_MAX_GRID = 40;
    var THEME_PAGE_FETCH_CAP_WITH_PRODUCTS = 4;
    var origEnsureCards = proto.ensureCardsForHandles;
    proto.ensureCardsForHandles = function (handles) {
      var self = this;
      var reqId = this._reqId;
      if (this.cacheNativeCards) this.cacheNativeCards();
      if (!this._gridParent) {
        return origEnsureCards
          ? origEnsureCards.apply(this, arguments)
          : Promise.resolve(false);
      }
      if (this._sfNativeListing && isNativeThemeGridState(this) && !this._loadingPage) {
        return Promise.resolve(true);
      }
      if (!this.missingHandles(handles).length) return Promise.resolve(true);

      self._ensureHandles = handles;

      function stale() {
        return self._reqId !== reqId;
      }

      function hasAnyRequested() {
        var list = handles || [];
        var i;
        for (i = 0; i < list.length; i++) {
          var key = String(list[i] || "").toLowerCase();
          if (!key) continue;
          var base = key.split("::")[0];
          var cache = self._cardCache || {};
          if (cardCacheUsable(cache[key]) || (base && cardCacheUsable(cache[base]))) {
            return true;
          }
        }
        return false;
      }

      function missingLeft() {
        return self.missingHandles(handles).length;
      }

      function clearEnsureHandles() {
        if (self._ensureHandles === handles) self._ensureHandles = null;
      }

      function productsForSeed() {
        var products = self._lastProducts || [];
        if (
          self._lastFilterData &&
          self._lastFilterData.products &&
          self._lastFilterData.products.length > products.length
        ) {
          products = self._lastFilterData.products;
        }
        return products;
      }

      function seedFromProductPayload() {
        var parent = preferProductCardGrid(
          resolveCardHost(self._gridParent) || self._gridParent,
        );
        if (!parent || !productsForSeed().length) return false;
        var missing = self.missingHandles(handles);
        if (!missing.length) {
          mountCachedCards(self, handles, parent);
          return countAllowedInHost(parent, handles) > 0;
        }
        mountCachedCards(self, missing, parent);
        missing = self.missingHandles(handles);
        if (!missing.length) {
          return countAllowedInHost(parent, handles) > 0;
        }
        /* Only clone gaps — same end state, less DOM work. */
        fillGapsWithThemeClones(self, missing, parent);
        if (missingLeft() !== 0) return false;
        return countAllowedInHost(parent, handles) > 0;
      }

      /* Clone-first: skip theme crawl when API products cover the page slice. */
      if (seedFromProductPayload()) {
        clearEnsureHandles();
        return Promise.resolve(true);
      }

      var wantPage = Math.max(1, Math.floor(Number(self.page) || 1));
      var pageCap = productsForSeed().length
        ? THEME_PAGE_FETCH_CAP_WITH_PRODUCTS
        : THEME_PAGE_FETCH_MAX_GRID;
      if (wantPage > 1) {
        pageCap = Math.max(pageCap, wantPage, THEME_PAGE_FETCH_MAX_GRID);
      }
      var wrapToFirst = wantPage > 1;

      function fetchBatch(startPage) {
        var jobs = [];
        var i;
        for (i = 0; i < THEME_PAGE_BATCH; i++) {
          var page = startPage + i;
          if (page > pageCap) break;
          jobs.push(self.fetchThemePage(page));
        }
        if (!jobs.length) return Promise.resolve([]);
        return Promise.all(jobs);
      }

      function anyOk(results) {
        var i;
        for (i = 0; i < results.length; i++) {
          if (results[i]) return true;
        }
        return false;
      }

      function step(startPage) {
        if (stale()) {
          clearEnsureHandles();
          return Promise.resolve(false);
        }
        if (!missingLeft()) {
          clearEnsureHandles();
          return Promise.resolve(true);
        }
        if (startPage > pageCap) {
          if (wrapToFirst) {
            wrapToFirst = false;
            return step(1);
          }
          seedFromProductPayload();
          clearEnsureHandles();
          return Promise.resolve(hasAnyRequested() || !missingLeft());
        }
        if (self._themeNoMore && missingLeft() > 0) {
          /* With product payload, stop crawling empty theme pages and clone. */
          if (productsForSeed().length) {
            seedFromProductPayload();
            clearEnsureHandles();
            return Promise.resolve(hasAnyRequested() || !missingLeft());
          }
          self._themeNoMore = false;
        }
        if (self._themeNoMore) {
          clearEnsureHandles();
          return Promise.resolve(hasAnyRequested());
        }
        return fetchBatch(startPage).then(function (results) {
          if (stale()) {
            clearEnsureHandles();
            return false;
          }
          if (!missingLeft()) {
            clearEnsureHandles();
            return true;
          }
          /* After each wave, try clones before more theme HTML. */
          if (productsForSeed().length && seedFromProductPayload()) {
            clearEnsureHandles();
            return true;
          }
          if (!anyOk(results)) {
            if (productsForSeed().length && seedFromProductPayload()) {
              clearEnsureHandles();
              return true;
            }
            if (wrapToFirst && startPage >= wantPage) {
              wrapToFirst = false;
              return step(1);
            }
            seedFromProductPayload();
            clearEnsureHandles();
            return hasAnyRequested() || !missingLeft();
          }
          return step(startPage + THEME_PAGE_BATCH);
        });
      }

      return step(wantPage > 1 ? wantPage : 1);
    };

    var origImport = proto.importCardsFromDocument;
    proto.importCardsFromDocument = function (doc) {
      var added = origImport ? origImport.call(this, doc) : 0;
      if (!doc || !doc.querySelectorAll) return added;
      var cache = this._cardCache || (this._cardCache = {});
      var nodes = doc.querySelectorAll(
        "li.product-grid__item, li.grid__item, product-card, .product-grid__item, .grid__item",
      );
      var i;
      for (i = 0; i < nodes.length; i++) {
        var node = nodes[i];
        var handle = handleFromCard(node);
        if (!handle || cardCacheUsable(cache[handle])) continue;
        try {
          var imported = document.importNode(node, true);
          cache[handle] = imported;
          this._importedHandles = this._importedHandles || {};
          this._importedHandles[handle] = true;
          added += 1;
        } catch (err) {
          /* skip */
        }
      }
      return added;
    };

    var origCache = proto.cacheNativeCards;
    proto.cacheNativeCards = function () {
      if (origCache) origCache.call(this);
      var cache = this._cardCache || {};
      var parent =
        this._gridParent ||
        (this.ensureGridParent && this.ensureGridParent());
      var collected = collectTrayAndGridCards(parent);
      var i;
      for (i = 0; i < collected.length; i++) {
        var handle = collected[i].handle;
        if (!handle) continue;
        var outerCard = resolveOuterThemeCard(collected[i].el) || collected[i].el;
        if (!cache[handle]) cache[handle] = outerCard;
      }
      var keys = Object.keys(cache);
      for (i = 0; i < keys.length; i++) {
        var outer = resolveOuterThemeCard(cache[keys[i]]);
        if (outer) cache[keys[i]] = outer;
      }
    };

    proto.applyInterceptGrid = function (handles, append) {
      var host = preferProductCardGrid(
        resolveCardHost(
          this._gridParent ||
            (this.ensureGridParent && this.ensureGridParent()),
        ) || this._gridParent,
      );
      if (host && !isPageShellHost(host)) this._gridParent = host;
      if (
        !shouldTakeOverThemeCards(this) &&
        Math.max(1, Number(this.page) || 1) <= 1 &&
        !this._loadingPage
      ) {
        applyNativeFilterGrid(null, host);
        markGridPainted(this);
        return true;
      }
      var size = this.pageSize || 16;
      var source = Array.isArray(handles) ? handles : [];
      if (
        !source.length &&
        this._allFilterHandles &&
        this._allFilterHandles.length
      ) {
        source = this._allFilterHandles;
      }
      var next =
        source.length && source.length <= size
          ? source
          : pageSlice(this, source, append);
      if ((!next || !next.length) && source.length) next = source;
      mountCachedCards(this, next, host);
      applyNativeFilterGrid(next, host);
      var shown = countAllowedInHost(host, next);
      var needed = uniqueAllowedCount(next);
      if (needed > shown) {
        fillGapsWithThemeClones(this, next, host);
        shown = countAllowedInHost(host, next);
      }
      if (needed > 0 && shown === 0) {
        this._shownHandles = [];
        return false;
      }
      this._shownHandles = shown > 0 ? next.slice() : this._shownHandles || [];
      markGridPainted(this);
      /* Drop busy as soon as the page of cards is on screen — same cards, earlier paint feel. */
      if (
        shown >= needed &&
        this.setGridBusy &&
        !this._importingCards
      ) {
        this.setGridBusy(false);
      }
      return shown > 0 || needed === 0;
    };

    var origFetch = proto.fetchFilters;
    proto.fetchFilters = function () {
      var opts = arguments[0] || {};
      if (!opts.append) {
        this._importingCards = false;
        this._sfPaintedReq = -1;
        this._sfChromeHiddenReq = -1;
        /* opts.page is applied inside origFetch — peek so page 2+ is not
           treated as a native Liquid restore before this.page updates. */
        var requestedPage =
          opts.page != null
            ? Math.max(1, Math.floor(Number(opts.page) || 1))
            : Math.max(1, Number(this.page) || 1);
        if (requestedPage > 1) {
          this._sfPaged = true;
          this._sfNativeListing = false;
          markGridTakeover(this);
        } else if (isIdleUnfilteredListing(this)) {
          /* Back on page 1 (or first load): restore Liquid Product A order.
             Keep _sfPaged so numbered pager clicks stay on Findly. */
          delete this._keepThemeCards;
          this.page = 1;
          prepareNativeListingRestore(this);
        } else {
          this._sfNativeListing = false;
        }
        stripThemePageParamIfFiltering(this);
      }
      var result = origFetch ? origFetch.apply(this, arguments) : undefined;
      var self = this;
      var reqId = this._reqId;
      if (result && typeof result.then === "function") {
        return result.then(
          function (value) {
            if (self._reqId !== reqId) return value;
            var host = preferProductCardGrid(resolveCardHost(self._gridParent));
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
            if (!self._importingCards && self.setGridBusy) self.setGridBusy(false);
            mountFindlyPager(self);
            if (!opts.append) {
              /* Suggestions are observational — defer off the filter paint path. */
              var publish = publishListingSuggestions;
              window.setTimeout(function () {
                publish(self);
              }, 0);
            }
            if (!opts.append) self._sfNativeListing = false;
            return value;
          },
          function (err) {
            if (self._reqId !== reqId) return Promise.reject(err);
            if (!opts.append) {
              self._sfNativeListing = false;
              self._importingCards = false;
              self._loadingPage = false;
              if (self.setGridBusy) self.setGridBusy(false);
              publishListingSuggestions(self);
            }
            return Promise.reject(err);
          },
        );
      }
      return result;
    };

    var origClear = proto.clearFilters;
    proto.clearFilters = function () {
      this._importingCards = false;
      this._sfPaged = false;
      this.page = 1;
      delete this._keepThemeCards;
      if (origClear) origClear.apply(this, arguments);
      /* After facets reset — restore Liquid page 1 before/with the refetch. */
      prepareNativeListingRestore(this);
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
      var input = this.collectionSearchEl;
      var live =
        input && document.activeElement === input ? input.value : null;
      if (origRenderSearch) origRenderSearch.call(this, settings);
      if (
        live != null &&
        this.collectionSearchEl &&
        document.activeElement === this.collectionSearchEl
      ) {
        this.collectionSearchEl.value = live;
      }
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
      snapshotNativeGridOrder(this, this._gridParent);
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
      var panel = liveDrawerPanel(this);
      if (panel) {
        syncDrawerPanelRefs(this, panel);
        applyPortaledPanelLayout(panel, this);
        ensurePortaledFacetsPainted(this, panel);
      }
      if (origOpen) origOpen.apply(this, arguments);
      panel = liveDrawerPanel(this) || this.panelEl;
      if (panel) {
        panel.classList.add("is-open");
        syncDrawerPanelRefs(this, panel);
        applyPortaledPanelLayout(panel, this);
        restoreFindlyPanelChrome(panel);
        ensurePortaledFacetsPainted(this, panel);
        enhancePriceSliders(panel);
        decorateCheckMarks(panel);
      }
      if (this.backdropEl) {
        this.backdropEl.hidden = false;
        this.backdropEl.classList.add("is-open");
      }
      document.documentElement.classList.add("is-sf-drawer-open");
    };

    var origClose = proto.closeDrawer;
    proto.closeDrawer = function () {
      if (origClose) origClose.apply(this, arguments);
      var panel = liveDrawerPanel(this) || this.panelEl;
      if (panel) panel.classList.remove("is-open");
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
      if (
        !shouldTakeOverThemeCards(this) &&
        Math.max(1, Number(this.page) || 1) <= 1 &&
        !this._loadingPage
      ) {
        applyNativeFilterGrid(null, parent);
        markGridPainted(this);
        syncGridEmptyState(this, parent, null, 0);
        placeCollectionSearchOnGrid(this);
        return;
      }
      /* afterGrid often re-enters here after applyInterceptGrid already painted. */
      if (alreadyPaintedGrid(this) && !this._importingCards) {
        var shownFast = countAllowedInHost(parent, handles);
        syncGridEmptyState(this, parent, handles, shownFast);
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
        markGridPainted(this);
        syncGridEmptyState(this, parent, handles, shown);
      }
      placeCollectionSearchOnGrid(this);
    };
    proto.watchThemeGrid = function () {
      /* Keep the observer alive across filter cycles — do not disconnect then bail. */
      if (!(this._appGridActive || (this.isAppGridMode && this.isAppGridMode()))) {
        applyNativeAfterGrid(this);
      }
      if (this._findlyGridWatch) return;
      this._findlyGridWatch = true;
      ensureFindlyGridObserver(this);
    };

    var origApplySettings = proto.applySettings;
    proto.applySettings = function (settings) {
      var stamp = "";
      try {
        stamp = JSON.stringify(settings || {});
      } catch (err) {
        stamp = "";
      }
      if (
        stamp &&
        this._sfSettingsStamp === stamp &&
        this._sfSettingsApplied
      ) {
        /* Same settings payload as last apply — skip sort/search/chrome rebuild. */
        return;
      }
      if (stamp) {
        this._sfSettingsStamp = stamp;
        this._sfSettingsApplied = true;
      }
      if (origApplySettings) return origApplySettings.apply(this, arguments);
    };

    var origHideChrome = proto.hideThemeDuplicateChrome;
    proto.hideThemeDuplicateChrome = function () {
      if (this._sfChromeHiddenReq === this._reqId && this._reqId) return;
      this._sfChromeHiddenReq = this._reqId;
      if (origHideChrome) return origHideChrome.apply(this, arguments);
    };

    var origQuickview = proto.ensureQuickviewButtons;
    proto.ensureQuickviewButtons = function () {
      var self = this;
      var args = arguments;
      if (!origQuickview) return;
      /* Non-paint work — defer so filter→grid settle is not blocked. */
      if (self._sfQvTimer) window.clearTimeout(self._sfQvTimer);
      self._sfQvTimer = window.setTimeout(function () {
        self._sfQvTimer = 0;
        origQuickview.apply(self, args);
      }, 0);
    };

    var origRenderPrice = proto.renderPriceFacet;
    proto.renderPriceFacet = function (facet) {
      var wrap = origRenderPrice
        ? origRenderPrice.apply(this, arguments)
        : null;
      if (wrap && facet && !facet.isProductPrice && facet.key !== "price") {
        var boundSpans = wrap.querySelectorAll(".sf-price-bounds span");
        if (boundSpans && boundSpans.length >= 2) {
          var low = Number(facet.min);
          var high = Number(facet.max);
          var isSale = facet.key === "sale" || facet.source === "sale";
          if (Number.isFinite(low)) {
            boundSpans[0].textContent = isSale
              ? Math.round(low) + "%"
              : String(Math.round(low));
          }
          if (Number.isFinite(high)) {
            boundSpans[1].textContent = isSale
              ? Math.round(high) + "%"
              : String(Math.round(high));
          }
        }
      }
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
      rememberFacetChipLabels(this, this.facets);
      var panel = liveDrawerPanel(this);
      if (panel) syncDrawerPanelRefs(this, panel);
      if (tryPatchFacetDom(this)) {
        if (panel) restoreFindlyPanelChrome(panel);
        placeDrawerChips(this);
        placeMobilePageChips(this);
        enhancePriceSliders(this.panelEl || this.facetsEl || this.root);
        decorateCheckMarks(this.panelEl || this.facetsEl || this.root);
        return;
      }
      var result = origRenderFacets
        ? origRenderFacets.apply(this, arguments)
        : undefined;
      if (panel) restoreFindlyPanelChrome(panel);
      placeDrawerChips(this);
      placeMobilePageChips(this);
      // Panel is moved to document.body on mobile — never search only this.root.
      enhancePriceSliders(this.panelEl || this.facetsEl || this.root);
      decorateCheckMarks(this.panelEl || this.facetsEl || this.root);
      mountFacetValueSearch(this);
      return result;
    };

    var origToggleValue = proto.toggleValue;
    proto.toggleValue = function (key, value, checked) {
      if (checked) {
        rememberChipLabel(this, key, value, resolveChipLabel(this, key, value));
      }
      return origToggleValue
        ? origToggleValue.apply(this, arguments)
        : undefined;
    };

    var origRenderChips = proto.renderChips;
    proto.renderChips = function () {
      rememberFacetChipLabels(this, this.facets);
      if (!origRenderChips) return null;
      var self = this;
      var prevFacets = this.facets;
      var facets = (prevFacets || []).slice();
      var byKey = {};
      facets.forEach(function (facet, index) {
        if (facet && facet.key) byKey[facet.key] = index;
      });

      Object.keys(this.selected || {}).forEach(function (key) {
        (self.selected[key] || []).forEach(function (value) {
          var label = resolveChipLabel(self, key, value);
          if (!label || isShopifyGidLabel(label)) return;
          var index = byKey[key];
          var facet =
            index != null
              ? facets[index]
              : { key: key, label: key, type: "list", values: [] };
          if (index == null) {
            byKey[key] = facets.length;
            facets.push(facet);
          }
          var values = (facet.values || []).slice();
          var found = false;
          values = values.map(function (item) {
            if (!item) return item;
            var itemValue = item.value != null ? item.value : item.label;
            if (String(itemValue) !== String(value)) return item;
            found = true;
            if (isShopifyGidLabel(item.label) || !item.label) {
              return Object.assign({}, item, { label: label });
            }
            return item;
          });
          if (!found) values.push({ value: value, label: label });
          facets[byKey[key]] = Object.assign({}, facet, { values: values });
        });
      });

      this.facets = facets;
      var chips = null;
      try {
        chips = origRenderChips.call(this);
      } finally {
        this.facets = prevFacets;
      }
      return chips;
    };

    var origFail = proto.failFilterLoad;
    proto.failFilterLoad = function () {
      var panel = liveDrawerPanel(this);
      if (panel) syncDrawerPanelRefs(this, panel);
      if (origFail) origFail.apply(this, arguments);
      panel = liveDrawerPanel(this) || this.panelEl;
      if (panel) {
        syncDrawerPanelRefs(this, panel);
        var status =
          (this.statusEl && this.statusEl.isConnected !== false && this.statusEl) ||
          panel.querySelector("[data-status]");
        if (status && !String(status.textContent || "").trim()) {
          status.textContent = "Filters could not be loaded. Please try again.";
          status.setAttribute("data-error", "true");
        }
      }
    };
  }

  function installSetter(held) {
    var desc = Object.getOwnPropertyDescriptor(
      window,
      "__FINDLY_FILTER_WIDGET",
    );
    var prevSet = desc && desc.set;
    var prevGet = desc && desc.get;
    if (prevGet && held == null) {
      try {
        held = prevGet();
      } catch (err) {
        /* ignore */
      }
    }
    try {
      Object.defineProperty(window, "__FINDLY_FILTER_WIDGET", {
        configurable: true,
        enumerable: true,
        get: function () {
          return prevGet ? prevGet() : held;
        },
        set: function (next) {
          if (prevSet) prevSet.call(window, next);
          else held = next;
          patchWidget(next);
          applyLooseHash(next);
          if (next && next.root) {
            enhancePriceSliders(
              next.panelEl || next.facetsEl || next.root,
            );
          }
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
    bootEarlyGridBusy();
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", bootEarlyGridBusy);
    }
    if (!window.__findlyDrawerResize) {
      window.__findlyDrawerResize = true;
      window.addEventListener("resize", function () {
        var widget = window.__FINDLY_FILTER_WIDGET;
        if (widget) portalMobileDrawer(widget);
        var openWrap = document.querySelector(".sf-sort.is-sort-open");
        if (openWrap) closeSortMenu(openWrap);
        if (widget && widget.sortWrap) {
          syncSortA11y(
            widget.sortWrap,
            widget.sortEl,
            sortButtonEl(widget.sortWrap),
          );
        }
      });
    }
    var held = window.__FINDLY_FILTER_WIDGET;
    installSetter(held);
    if (held) {
      patchWidget(held);
      applyLooseHash(held);
      if (held.root) {
        enhancePriceSliders(held.panelEl || held.facetsEl || held.root);
      }
      enhanceSortMenu(held);
      decorateCheckMarks(held.panelEl || held.facetsEl || held.root);
    }
  }

  install();
})();
