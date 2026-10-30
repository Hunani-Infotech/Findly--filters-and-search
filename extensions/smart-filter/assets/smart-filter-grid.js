/**
 * Collection grid takeover extras.
 * Loaded from Liquid via asset_url so it does not count against the 100 KB
 * schema "javascript" cap on smart-filter.min.js.
 *
 * Patches Widget.prototype as soon as window.__FINDLY_FILTER_WIDGET is set.
 */
(function () {
  "use strict";
  window.__FINDLY_GRID_JS = true;

  var STYLE_ID = "findly-grid-takeover-v49";
  /* Marks product cards whose widths Findly set — only those get cleared. */
  var COL_LOCK_ATTR = "data-sf-col-lock";
  var BRIDGE_STYLE_ID = "findly-theme-bridge-v21";
  /* Used only when the theme has no Dawn/Horizon column signal. */
  var FINDLY_DEFAULT_DESKTOP_COLS = 3;
  /*
   * Product-grid column !important locks (CSS + JS) use this desktop floor.
   * Sidebar layout still switches at 990; between 990–1040 the main column is
   * narrow and Findly desktop N-col !important was fighting theme CSS.
   */
  var PRODUCT_GRID_DESKTOP_LOCK_MIN = 1041;
  var HOST_ID = "findly-grid-host";
  var CARD_TRAY_ID = "findly-card-tray";
  var EMPTY_ID = "findly-grid-empty";
  var SKEL_ATTR = "data-findly-skel";
  var SKEL_COUNT = 8;
  /* Card grids only — never target Dawn search DIV#product-grid shell here. */
  var PRODUCT_GRID_START_CSS =
    ".sf-collection-layout .main-collection-grid,.sf-og .main-collection-grid," +
    ".sf-collection-layout ul#product-grid,.sf-og ul#product-grid," +
    ".sf-collection-layout ol#product-grid,.sf-og ol#product-grid," +
    ".sf-collection-layout ul#ProductGrid,.sf-og ul#ProductGrid," +
    ".sf-collection-layout ol#ProductGrid,.sf-og ol#ProductGrid," +
    ".sf-collection-layout ul.product-grid,.sf-og ul.product-grid," +
    ".sf-collection-layout ol.product-grid,.sf-og ol.product-grid," +
    ".sf-collection-layout .sf-app-grid,.sf-og .sf-app-grid," +
    ".sf-collection-layout results-list>.main-collection-grid,.sf-og results-list>.main-collection-grid" +
    "{justify-content:start!important;width:100%!important;max-width:100%!important}";
  var RESULTS_LIST_BLOCK_CSS =
    ".sf-collection-layout results-list:not(.product-grid):not(.main-collection-grid):not([product-grid-view])," +
    ".sf-og results-list:not(.product-grid):not(.main-collection-grid):not([product-grid-view])," +
    ".collection-wrapper results-list:not(.product-grid):not(.main-collection-grid):not([product-grid-view])" +
    "{display:block!important;width:100%;min-width:0}";
  var PRODUCT_GRID_KEEP_CSS =
    ".sf-collection-layout ul.product-grid,.sf-og ul.product-grid," +
    ".sf-collection-layout ol.product-grid,.sf-og ol.product-grid," +
    ".sf-collection-layout .main-collection-grid,.sf-og .main-collection-grid," +
    ".sf-collection-layout ul#product-grid,.sf-og ul#product-grid," +
    ".sf-collection-layout ol#product-grid,.sf-og ol#product-grid," +
    ".sf-collection-layout ul#ProductGrid,.sf-og ul#ProductGrid," +
    ".sf-collection-layout ol#ProductGrid,.sf-og ol#ProductGrid," +
    ".sf-collection-layout .sf-app-grid,.sf-og .sf-app-grid" +
    "{width:100%!important;max-width:100%!important;min-width:0!important}";
  /* Listing shells (Dawn search DIV#product-grid) fill the main column only. */
  var PRODUCT_GRID_SHELL_CSS =
    ".sf-collection-layout .sf-layout-main{width:100%!important;max-width:none!important;min-width:0!important}" +
    ".sf-layout-main>#product-grid,.sf-layout-main>#ProductGrid," +
    ".sf-layout-main>.product-grid-container,.sf-layout-main>[data-findly-grid-shell='1']," +
    ".sf-layout-main>.template-search__results," +
    ".sf-collection-layout .sf-layout-main>#product-grid," +
    ".sf-collection-layout .sf-layout-main>#ProductGridContainer," +
    ".sf-collection-layout .sf-layout-main>[data-findly-grid-shell='1']" +
    "{display:block!important;width:100%!important;max-width:none!important;min-width:0;box-sizing:border-box}" +
    ".sf-collection-layout .sf-layout-main ul.product-grid," +
    ".sf-collection-layout .sf-layout-main ol.product-grid," +
    ".sf-collection-layout .sf-layout-main .sf-app-grid," +
    ".sf-collection-layout .sf-layout-main .main-collection-grid" +
    "{width:100%!important;max-width:none!important;min-width:0;box-sizing:border-box}";
  /* Exclude theme pagers — Dawn search nests nav.pagination inside div#product-grid. */
  var GRID_RESULT_HIDE =
    ":not([" +
    SKEL_ATTR +
    "='1']):not([data-findly-skel-host='1']):not(.sf-toolbar):not(.sf-page-chips):not(.sf-sort-host):not(.sf-search-host):not(.sf-total-count)" +
    ":not(.sf-pager):not(.sf-grid-empty):not(#findly-grid-empty):not(#findly-card-tray):not(.smart-filter)" +
    ":not(.sf-collection-layout):not(.sf-layout-aside):not(#smart-filter-root):not(#smart-filter-embed)" +
    ":not(nav.pagination):not(.pagination):not(.pagination-wrapper):not([data-pagination])" +
    ":not(.paginate):not(#pagination):not(.Pagination):not(#AjaxinatePagination):not(.ajaxinate-pagination)";
  /* Card / list grids only (not shell wrappers like #ProductGridContainer —
     hiding a shell's children would also hide an inner skeleton host). */
  var GRID_BUSY_HOSTS = [
    ".main-collection-grid",
    "#product-grid",
    "#ProductGrid",
    "ul.product-grid",
    "ol.product-grid",
    ".product-grid",
    ".sf-app-grid",
    "#main-collection-product-grid",
    "#collection-products",
    "#product-loop",
    "#product-list",
    "#CollectionLoop",
    ".collection-grid",
    ".collection-products",
    ".collection-product-list",
    ".collection__products",
    ".product-list",
    ".product-list__inner",
    ".product-listing",
    ".ProductList",
    ".ProductList--grid",
    ".products-grid",
    ".products-list",
    ".productgrid--items",
    ".productgrid",
    ".grid--view-items",
    ".grid-products",
    ".grid-uniform",
    ".grid--uniform",
    "product-list",
    "[data-product-grid]",
    "[data-products-grid]",
    "[data-collection-products]",
    "[data-product-list]",
    "[product-grid-view]",
    "[data-id='product-grid']",
    ".boost-pfs-filter-products",
    ".boost-sd-grid",
    ".sf-grid",
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
      parts.push(prefix + ":not(.sf-storefront-v2) " + GRID_BUSY_HOSTS[i] + ">" + GRID_RESULT_HIDE);
    }
    var v2 = [];
    for (i = 0; i < GRID_BUSY_HOSTS.length; i++) {
      v2.push(prefix + ".sf-storefront-v2 " + GRID_BUSY_HOSTS[i] + ">" + GRID_RESULT_HIDE);
    }
    return (
      parts.join(",") +
      "{display:none!important}" +
      v2.join(",") +
      "{opacity:0;animation:findly-loading-reveal 0s linear 3s forwards}"
    );
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
    return ".findly-grid-is-busy " + BUSY_NESTED_CARD + "{display:none!important}";
  }
  function gridLoadingNestedCss() {
    var i;
    var parts = [];
    for (i = 0; i < GRID_BUSY_HOSTS.length; i++) {
      parts.push(
        "html.sf-filter-loading:not(.sf-storefront-v2) " +
          GRID_BUSY_HOSTS[i] +
          " " +
          BUSY_NESTED_CARD,
      );
    }
    var v2 = [];
    for (i = 0; i < GRID_BUSY_HOSTS.length; i++) {
      v2.push(
        "html.sf-filter-loading.sf-storefront-v2 " +
          GRID_BUSY_HOSTS[i] +
          " " +
          BUSY_NESTED_CARD,
      );
    }
    return (
      parts.join(",") +
      "{display:none!important}" +
      v2.join(",") +
      "{opacity:0;animation:findly-loading-reveal 0s linear 3s forwards}"
    );
  }
  var GRID_BUSY_CSS =
    "@keyframes sf-grid-spin{to{transform:rotate(360deg)}}" +
    "@keyframes sf-skeleton-pulse{50%{opacity:.55}}" +
    "@keyframes findly-loading-reveal{to{opacity:1}}" +
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
    "html.sf-filter-loading [data-findly-skel-host='1']>" +
    GRID_RESULT_HIDE +
    "{opacity:0;animation:findly-loading-reveal 0s linear 3s forwards}" +
    gridBusyNestedHideCss() +
    gridLoadingNestedCss() +
    "html.sf-filter-loading [data-findly-skel-host='1'] " +
    BUSY_NESTED_CARD +
    "{opacity:0;animation:findly-loading-reveal 0s linear 3s forwards}" +
    ".findly-grid-is-busy[" +
    SKEL_ATTR +
    "='1'],.findly-grid-is-busy [" +
    SKEL_ATTR +
    "='1'],html.sf-filter-loading [" +
    SKEL_ATTR +
    "='1']{opacity:1!important;visibility:visible!important;position:relative;z-index:81}" +
    gridLoadingHideCss("html.sf-filter-loading") +
    gridLoadingMinCss("html.sf-filter-loading") +
    "html.sf-filter-loading [data-findly-skel-host='1']{position:relative;min-height:22rem}" +
    GRID_COUNT_HIDE +
    TOOLBAR_LOADING_CSS +
    GRID_PAGER_HIDE +
    "[" + SKEL_ATTR + "='1']{pointer-events:none;list-style:none;min-width:0}" +
    ".findly-grid-skel-img{display:block;width:100%;aspect-ratio:1;border-radius:8px;background:#ececec}" +
    ".findly-grid-skel-line{display:block;height:.7rem;margin-top:.55rem;border-radius:4px;background:#ececec;width:78%}" +
    ".findly-grid-skel-line.is-short{width:42%;margin-top:.4rem}" +
    "[" + SKEL_ATTR + "='1'] .findly-grid-skel-img,[" + SKEL_ATTR + "='1'] .findly-grid-skel-line{" +
    "animation:sf-skeleton-pulse 1.1s ease-in-out infinite}" +
    /* Theme-native loader (Dawn/Horizon .loading-overlay) — keep merchant default UX. */
    "[data-findly-theme-loader='1']{display:flex!important;visibility:visible!important;opacity:1!important;" +
    "pointer-events:none;z-index:2}" +
    "[data-findly-theme-loading='1']{position:relative}" +
    "#" +
    "findly-grid-empty,.sf-grid-empty{grid-column:1/-1;width:100%;min-height:12rem;display:flex;flex-direction:column;" +
    "align-items:center;justify-content:center;text-align:center;padding:2.5rem 1.5rem;box-sizing:border-box}" +
    ".sf-grid-empty-title{margin:0 0 .4rem;font-size:1.05rem;font-weight:650}" +
    ".sf-grid-empty-text{margin:0;opacity:.7;font-size:.9rem}" +
    /* Empty filter results: hide listing cards (incl. .sf-app-card, which the
       normal .sf-app-grid child rule deliberately leaves visible). */
    ".sf-app-grid.sf-grid-is-empty>.sf-app-card," +
    ".sf-app-grid.sf-grid-is-empty>.grid__item," +
    ".sf-app-grid.sf-grid-is-empty>.product-grid__item," +
    ".sf-app-grid.sf-grid-is-empty>[data-product-handle]," +
    ".sf-app-grid.sf-grid-is-empty>product-card," +
    ".sf-app-grid.sf-grid-is-empty>product-item," +
    ".sf-grid-is-empty>.sf-app-card," +
    ".sf-grid-is-empty>.grid__item:not(.sf-grid-empty)," +
    ".sf-grid-is-empty>[data-product-handle]{display:none!important;visibility:hidden!important}" +
    ".sf-app-grid.sf-grid-is-empty>.sf-grid-empty," +
    ".sf-grid-is-empty>.sf-grid-empty,#findly-grid-empty{display:flex!important;visibility:visible!important}";
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
    "article.pcard",
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
    "ul#product-grid",
    "ol#product-grid",
    "ul.product-grid",
    "ol.product-grid",
    ".grid.product-grid",
    "[data-id='product-grid']",
    "[data-product-grid]",
    "[product-grid-view]",
    "#product-grid",
    "#ProductGrid",
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
      ".sf-facet-pop .sf-price{display:grid!important;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr)!important;width:100%!important;min-width:0!important;overflow:visible!important;padding-inline:10px!important;box-sizing:border-box!important}" +
      ".smart-filter .sf-facet.is-collapsed>.sf-options,.smart-filter .sf-facet.is-collapsed>.sf-price,.smart-filter .sf-facet.is-collapsed>.sf-dropdown-wrap,.smart-filter .sf-facet.is-collapsed>.sf-facet-search,.sf-panel.sf-drawer-portal .sf-facet.is-collapsed>.sf-options,.sf-panel.sf-drawer-portal .sf-facet.is-collapsed>.sf-price,.sf-panel.sf-drawer-portal .sf-facet.is-collapsed>.sf-dropdown-wrap,.sf-panel.sf-drawer-portal .sf-facet.is-collapsed>.sf-facet-search{display:none!important}" +
      ".smart-filter .sf-slider,.sf-panel.sf-drawer-portal .sf-slider,.sf-facet-pop .sf-slider{grid-column:1/-1!important;position:relative!important;display:block!important;width:100%!important;height:27px!important;overflow:visible!important;background:transparent!important}" +
      ".smart-filter .sf-slider-track,.sf-panel.sf-drawer-portal .sf-slider-track,.sf-facet-pop .sf-slider-track{position:absolute!important;left:0!important;right:0!important;top:50%!important;width:auto!important;height:2px!important;margin-top:-1px!important;border:0!important;border-radius:999px!important;pointer-events:none!important;display:block!important;background:#dcdcdc!important;z-index:0!important}" +
      ".smart-filter .sf-slider-fill,.sf-panel.sf-drawer-portal .sf-slider-fill,.sf-facet-pop .sf-slider-fill{position:absolute!important;top:50%!important;height:3px!important;margin-top:-1.5px!important;border:0!important;border-radius:999px!important;pointer-events:none!important;display:block!important;background:var(--sf-accent,#111)!important;z-index:1!important}" +
      ".smart-filter .sf-slider input[type=range],.sf-panel.sf-drawer-portal .sf-slider input[type=range],.sf-facet-pop .sf-slider input[type=range]{position:absolute!important;left:0!important;width:100%!important;max-width:none!important;height:23px!important;margin:0!important;padding:0!important;border:0!important;opacity:0!important;background:transparent!important;appearance:none!important;-webkit-appearance:none!important;pointer-events:none!important}" +
      ".smart-filter .sf-slider-thumb,.sf-panel.sf-drawer-portal .sf-slider-thumb,.sf-facet-pop .sf-slider-thumb{position:absolute!important;top:50%!important;width:16px!important;height:16px!important;margin:0!important;padding:0!important;border:1.5px solid var(--sf-accent,#111)!important;border-radius:999px!important;background:#fff!important;transform:translate(-50%,-50%)!important;z-index:4!important;pointer-events:auto!important;cursor:grab!important;display:block!important;touch-action:none}" +
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
      document.getElementById(BRIDGE_STYLE_ID) ||
      document.getElementById("findly-theme-bridge-v20") ||
      document.getElementById("findly-theme-bridge-v19") ||
      document.getElementById("findly-theme-bridge-v18") ||
      document.getElementById("findly-theme-bridge-v17") ||
      document.getElementById("findly-theme-bridge-v16") ||
      document.getElementById("findly-theme-bridge-v15") ||
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
    if (existingBridge && existingBridge.id !== BRIDGE_STYLE_ID) {
      if (existingBridge.parentNode) existingBridge.parentNode.removeChild(existingBridge);
      existingBridge = null;
    }
    if (!existingBridge) {
      var bridge = document.createElement("style");
      bridge.id = BRIDGE_STYLE_ID;
      bridge.textContent =
        "[data-smart-filter-hidden='true'],[data-findly-theme-hidden='1']{display:none!important}" +
        GRID_BUSY_CSS +
        ".sf-collection-layout{display:block;box-sizing:border-box;width:100%;max-width:100%;min-width:0;margin-inline:0}" +
        ".page-width>.sf-collection-layout,.page-width-desktop>.sf-collection-layout," +
        ".page-width--narrow>.sf-collection-layout,.container>.sf-collection-layout,.Container>.sf-collection-layout," +
        ".sf-theme-width>.sf-collection-layout,.sf-search-width>.sf-collection-layout" +
        "{width:100%!important;max-width:100%!important;margin-left:0;margin-right:0}" +
        ".sf-theme-width.page-width,.sf-theme-width.page-width-desktop," +
        ".sf-theme-width.page-width--narrow,.sf-theme-width.container" +
        "{width:100%;box-sizing:border-box}" +
        PRODUCT_GRID_SHELL_CSS +
        ".sf-layout-aside,.sf-layout-main{box-sizing:border-box;min-width:0}" +
        ".sf-layout-main:not(ul):not(ol):not(results-list):not(.product-grid):not(.main-collection-grid):not(product-list)" +
        "{display:flex;flex-direction:column;flex:1 1 0%;min-width:0;width:auto;max-width:100%}" +
        ".sf-layout-main>.sf-toolbar{order:-1;flex:0 0 auto;width:100%}" +
        ".sf-layout-main>.sf-pager{order:20}" +
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
        /* Search parity with collection: keep theme product section shells full-width. */
        ".sf-layout-main>#ProductGridContainer,.sf-layout-main>#CollectionProductGrid," +
        ".sf-layout-main>#CollectionAjaxContent,.sf-layout-main>.product-grid-container," +
        ".sf-layout-main>.collection:not(.sf-collection-layout)," +
        ".sf-layout-main>[data-findly-grid-shell='1']" +
        "{display:block;width:100%!important;max-width:100%!important;min-width:0;box-sizing:border-box}" +
        ".sf-layout-main .collection:not(.sf-collection-layout)" +
        "{width:100%!important;max-width:100%!important;min-width:0}" +
        ".product-grid>.sf-toolbar,.product-grid>.sf-pager,.product-grid>.sf-sort-host,.product-grid>.sf-search-host," +
        "ul.product-grid>.sf-toolbar,ul.product-grid>.sf-pager,ul.product-grid>.sf-sort-host," +
        ".main-collection-grid>.sf-toolbar,.main-collection-grid>.sf-pager,.main-collection-grid>.sf-sort-host," +
        ".main-collection-grid>.sf-search-host,results-list>.sf-toolbar,results-list>.sf-pager" +
        "{grid-column:1/-1!important;width:100%!important;max-width:100%!important;display:flex}" +
        ".product-grid>.sf-page-chips,ul.product-grid>.sf-page-chips," +
        ".main-collection-grid>.sf-page-chips,results-list>.sf-page-chips," +
        ".sf-layout-main>.sf-page-chips,.collection-wrapper>.sf-page-chips" +
        "{grid-column:1/-1!important;width:100%!important;max-width:100%!important}" +
        /* Pager only at the bottom — never push toolbar/sort below products
           (off-canvas is display:flex/block; order:20 on sort was a common bug). */
        ".sf-collection-layout>.sf-pager," +
        ".sf-collection-layout>:not(.sf-layout-aside):not(.sf-layout-main):not(.smart-filter):not(.shopify-block):not(.sf-toolbar):not(.sf-sort-host):not(.sf-search-host):not(.sf-page-chips):not(.sf-total-count)" +
        "{flex:1 1 100%;width:100%;max-width:100%;order:20}" +
        ".sf-collection-layout>.sf-toolbar,.sf-collection-layout>.sf-sort-host," +
        ".sf-collection-layout>.sf-search-host,.sf-collection-layout>.sf-page-chips," +
        ".sf-collection-layout>.sf-total-count" +
        "{flex:0 0 auto;width:100%;max-width:100%;order:-1}" +
        ".sf-collection-layout--offcanvas{display:flex!important;flex-direction:column;gap:0;width:100%}" +
        ".sf-collection-layout--offcanvas>.sf-layout-aside," +
        ".sf-collection-layout--offcanvas>.shopify-block.sf-layout-aside," +
        ".sf-collection-layout--offcanvas>.smart-filter," +
        ".sf-collection-layout--offcanvas>.shopify-block:has(.smart-filter)" +
        "{order:-2}" +
        ".sf-collection-layout--offcanvas>.sf-toolbar," +
        ".sf-collection-layout--offcanvas>.sf-sort-host," +
        ".sf-collection-layout--offcanvas>.sf-search-host," +
        ".sf-collection-layout--offcanvas>.sf-page-chips" +
        "{order:-1}" +
        ".sf-collection-layout--offcanvas>.sf-layout-main{order:1;width:100%;max-width:100%}" +
        ".sf-collection-layout--offcanvas>.sf-pager{order:20}" +
        ".sf-layout-main .product-grid,.sf-layout-main ul.product-grid," +
        ".sf-layout-main ol.product-grid,.sf-layout-main .main-collection-grid," +
        ".sf-layout-main .sf-app-grid{width:100%!important;min-width:0;max-width:100%!important;justify-content:flex-start!important}" +
        /* Column width !important: desktop from 1041px (not 990). 990–1040 = theme CSS. */
        "@media screen and (min-width:1041px){" +
        ".sf-collection-layout .sf-layout-main .grid--2-col-desktop>.grid__item," +
        ".sf-collection-layout .sf-layout-main .grid--2-col-desktop>li" +
        "{width:calc(50% - var(--grid-desktop-horizontal-spacing,8px)/2)!important;" +
        "max-width:calc(50% - var(--grid-desktop-horizontal-spacing,8px)/2)!important;" +
        "flex:0 0 auto!important;box-sizing:border-box!important}" +
        ".sf-collection-layout .sf-layout-main .grid--3-col-desktop>.grid__item," +
        ".sf-collection-layout .sf-layout-main .grid--3-col-desktop>li" +
        "{width:calc(33.33% - var(--grid-desktop-horizontal-spacing,8px)*2/3)!important;" +
        "max-width:calc(33.33% - var(--grid-desktop-horizontal-spacing,8px)*2/3)!important;" +
        "flex:0 0 auto!important;box-sizing:border-box!important}" +
        ".sf-collection-layout .sf-layout-main .grid--4-col-desktop>.grid__item," +
        ".sf-collection-layout .sf-layout-main .grid--4-col-desktop>li" +
        "{width:calc(25% - var(--grid-desktop-horizontal-spacing,8px)*3/4)!important;" +
        "max-width:calc(25% - var(--grid-desktop-horizontal-spacing,8px)*3/4)!important;" +
        "flex:0 0 auto!important;box-sizing:border-box!important}" +
        ".sf-collection-layout .sf-layout-main .grid--5-col-desktop>.grid__item," +
        ".sf-collection-layout .sf-layout-main .grid--5-col-desktop>li" +
        "{width:calc(20% - var(--grid-desktop-horizontal-spacing,8px)*4/5)!important;" +
        "max-width:calc(20% - var(--grid-desktop-horizontal-spacing,8px)*4/5)!important;" +
        "flex:0 0 auto!important;box-sizing:border-box!important}" +
        ".sf-collection-layout .sf-layout-main .grid--6-col-desktop>.grid__item," +
        ".sf-collection-layout .sf-layout-main .grid--6-col-desktop>li" +
        "{width:calc(16.66% - var(--grid-desktop-horizontal-spacing,8px)*5/6)!important;" +
        "max-width:calc(16.66% - var(--grid-desktop-horizontal-spacing,8px)*5/6)!important;" +
        "flex:0 0 auto!important;box-sizing:border-box!important}}" +
        "@media screen and (min-width:750px) and (max-width:989px){" +
        ".sf-collection-layout .sf-layout-main .grid--2-col-tablet-down>.grid__item," +
        ".sf-collection-layout .sf-layout-main .grid--2-col-tablet-down>li" +
        "{width:calc(50% - var(--grid-desktop-horizontal-spacing,8px)/2)!important;" +
        "max-width:calc(50% - var(--grid-desktop-horizontal-spacing,8px)/2)!important;" +
        "flex:0 0 auto!important;box-sizing:border-box!important}}" +
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
        "display:flex!important;flex-direction:column;grid-template-columns:none!important;gap:0!important}" +
        ".sf-collection-layout--left>.sf-toolbar,.sf-collection-layout--left>.sf-sort-host," +
        ".sf-collection-layout--left>.sf-search-host,.sf-collection-layout--left>.sf-page-chips," +
        ".sf-collection-layout--left>.sf-total-count," +
        ".sf-collection-layout--right>.sf-toolbar,.sf-collection-layout--right>.sf-sort-host," +
        ".sf-collection-layout--right>.sf-search-host,.sf-collection-layout--right>.sf-page-chips," +
        ".sf-collection-layout--right>.sf-total-count," +
        ".sf-collection-layout--top>.sf-toolbar,.sf-collection-layout--top>.sf-sort-host," +
        ".sf-collection-layout--top>.sf-search-host,.sf-collection-layout--top>.sf-page-chips," +
        ".sf-collection-layout--top>.sf-total-count{order:-1}" +
        ".sf-collection-layout--left>.sf-layout-main,.sf-collection-layout--right>.sf-layout-main," +
        ".sf-collection-layout--top>.sf-layout-main{order:1}" +
        ".sf-collection-layout--left>.sf-pager,.sf-collection-layout--right>.sf-pager," +
        ".sf-collection-layout--top>.sf-pager{order:20}" +
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
        ".sf-collection-layout--left>.sf-pager,.sf-collection-layout--left>.sf-sort-host," +
        ".sf-collection-layout--left>.sf-search-host,.sf-collection-layout--left>.sf-total-count," +
        ".sf-collection-layout--left>.sf-page-chips" +
        "{grid-column:2!important;min-width:0!important;max-width:none!important}" +
        ".sf-collection-layout--left>.sf-layout-main," +
        ".sf-collection-layout--left>.sf-pager,.sf-collection-layout--left>.sf-sort-host," +
        ".sf-collection-layout--left>.sf-search-host,.sf-collection-layout--left>.sf-total-count," +
        ".sf-collection-layout--left>.sf-page-chips" +
        "{width:auto!important}" +
        ".sf-collection-layout--left>.sf-toolbar,.sf-collection-layout--right>.sf-toolbar," +
        ".sf-collection-layout>.sf-toolbar,.sf-layout-main>.sf-toolbar" +
        "{width:100%!important;max-width:100%!important;justify-self:stretch!important}" +
        ".sf-collection-layout--right>.sf-layout-aside,.sf-collection-layout--right>.smart-filter," +
        ".sf-collection-layout--right>.shopify-block:has(.smart-filter)" +
        "{grid-column:2!important;width:320px;max-width:320px;min-width:320px}" +
        ".sf-collection-layout--right>.sf-layout-main,.sf-collection-layout--right>.sf-toolbar," +
        ".sf-collection-layout--right>.sf-pager,.sf-collection-layout--right>.sf-sort-host," +
        ".sf-collection-layout--right>.sf-search-host,.sf-collection-layout--right>.sf-total-count," +
        ".sf-collection-layout--right>.sf-page-chips" +
        "{grid-column:1!important;min-width:0!important;max-width:none!important}" +
        ".sf-collection-layout--top{display:flex!important;flex-direction:column;gap:16px;width:100%}" +
        ".sf-collection-layout--top>.sf-layout-aside,.sf-collection-layout--top>.smart-filter," +
        ".sf-collection-layout--top>.shopify-block:has(.smart-filter)" +
        "{flex:0 0 auto!important;width:100%!important;max-width:100%!important;min-width:0!important;order:-2}" +
        ".sf-collection-layout--top>.sf-toolbar,.sf-collection-layout--top>.sf-sort-host," +
        ".sf-collection-layout--top>.sf-search-host,.sf-collection-layout--top>.sf-page-chips," +
        ".sf-collection-layout--top>.sf-total-count{order:-1}" +
        ".sf-collection-layout--top>.sf-layout-main{order:1}" +
        ".sf-collection-layout--top>.sf-pager{order:20}" +
        ".sf-toggle,.sf-sort-host .sf-toggle-toolbar{display:none!important}" +
        ".smart-filter--offcanvas .sf-toggle," +
        ".sf-collection-layout--offcanvas .sf-toggle," +
        ".sf-collection-layout--offcanvas .sf-toggle-toolbar," +
        ".sf-collection-layout--offcanvas .sf-toolbar .sf-toggle" +
        "{display:inline-flex!important;align-items:center;justify-content:center;gap:.45rem;width:auto;min-width:7.5rem;min-height:2.5rem;margin:0;padding:.5rem 1rem;border:0!important;border-radius:999px!important;background:#111!important;color:#fff!important;font:inherit!important;font-weight:600;cursor:pointer;box-shadow:none!important}" +
        "}" +
        ".sf-toolbar{display:flex;align-items:flex-start;justify-content:space-between;gap:12px 24px;width:100%!important;max-width:100%!important;margin:0 0 18px;box-sizing:border-box;justify-self:stretch!important}" +
        ".sf-toolbar-search,.sf-search-host.sf-toolbar-search{flex:1 1 16rem;min-width:0;width:min(22rem,100%);max-width:22rem;margin:0}" +
        ".sf-toolbar-end{display:flex;flex-direction:column;align-items:flex-end;flex:0 0 auto;gap:0;min-width:0;margin-left:auto!important;margin-right:0!important}" +
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
        ".sf-toolbar:not(:has(.sf-toolbar-search:has(.sf-search:not([hidden])))){justify-content:flex-end!important}" +
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
        ".sf-toolbar-end{order:2;flex:1 1 100%;margin:0!important;align-items:stretch;min-width:0;width:100%}" +
        ".sf-toolbar:has(>.sf-toggle) .sf-toolbar-end{grid-area:end;flex:none;width:100%;min-width:0;align-items:stretch}" +
        ".sf-toolbar:has(>.sf-toggle) .sf-sort-host,.sf-toolbar:has(>.sf-toggle) .sf-sort-toolbar,.sf-toolbar:has(>.sf-toggle) .sf-sort-row,.sf-toolbar:has(>.sf-toggle) .sf-sort-control,.sf-toolbar:has(>.sf-toggle) .sf-sort-trigger{width:100%;max-width:none;min-width:0}" +
        ".sf-toolbar-actions{width:100%}" +
        ".sf-toolbar-actions:has(.sf-toggle){display:grid;grid-template-columns:1fr 1fr;align-items:stretch;gap:.55rem}" +
        ".sf-toolbar .sf-sort-label,.sf-toolbar .sf-sort-toolbar .sf-sort-label,.sf-toolbar .sf-sort-row .sf-sort-label{display:none!important}" +
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
        PRODUCT_GRID_SHELL_CSS +
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
      document.getElementById("findly-catalog-grid-v15") ||
      document.getElementById("findly-catalog-grid-v16");
    if (oldCatalog && oldCatalog.parentNode) oldCatalog.parentNode.removeChild(oldCatalog);
    if (document.getElementById("findly-catalog-grid-v17")) return;
    var catalog = document.createElement("style");
    catalog.id = "findly-catalog-grid-v17";
    catalog.textContent =
      "#" +
      CARD_TRAY_ID +
      "{display:none!important;position:absolute;left:-9999px;width:0;height:0;overflow:hidden}" +
      RESULTS_LIST_BLOCK_CSS +
      PRODUCT_GRID_SHELL_CSS +
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

  /**
   * Keep ?page= in sync with Findly AJAX paging (collection + search).
   * Old behavior deleted page on every search takeover and broke deep links /
   * theme pager hrefs on /search.
   */
  function syncThemePageParam(widget) {
    if (!shouldTakeOverThemeCards(widget)) return;
    try {
      var url = new URL(window.location.href);
      var page = Math.max(1, Number(widget && widget.page) || 1);
      var cur = url.searchParams.get("page");
      if (page <= 1) {
        if (!cur) return;
        url.searchParams.delete("page");
      } else {
        if (String(cur || "") === String(page)) return;
        url.searchParams.set("page", String(page));
      }
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
    syncThemePageParam(widget);
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

  /**
   * Dawn search: #product-grid is often a DIV.template-search__results.page-width
   * wrapping an anonymous ul.grid.product-grid. Collection pages put the id on the UL.
   * Treating the DIV as the card grid breaks tracks, width host detection, and layout.
   */
  function isProductGridIdShell(el) {
    if (!el || el.nodeType !== 1) return false;
    var id = String(el.id || "");
    if (id !== "product-grid" && id !== "ProductGrid") return false;
    var tag = String(el.tagName || "").toLowerCase();
    if (tag === "ul" || tag === "ol") return false;
    if (el.querySelector) {
      if (
        el.querySelector(
          "ul.product-grid, ol.product-grid, ul.grid.product-grid, ol.grid.product-grid, .grid.product-grid",
        )
      ) {
        return true;
      }
    }
    var cls = el.classList;
    if (!cls) return tag !== "ul" && tag !== "ol";
    return (
      cls.contains("page-width") ||
      cls.contains("page-width-desktop") ||
      cls.contains("template-search__results") ||
      cls.contains("collection") ||
      cls.contains("product-grid-container")
    );
  }

  function isProductGridLike(el) {
    if (!el || el.nodeType !== 1) return false;
    if (isProductGridIdShell(el)) return false;
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
    /* Prefer real list grids before bare #product-grid (Dawn search shell DIV). */
    return (
      el.querySelector("ul#product-grid") ||
      el.querySelector("ol#product-grid") ||
      el.querySelector("ul.product-grid") ||
      el.querySelector("ol.product-grid") ||
      el.querySelector("ul.grid.product-grid, ol.grid.product-grid") ||
      el.querySelector(".grid.product-grid") ||
      el.querySelector("[product-grid-view]") ||
      el.querySelector(".product-grid.main-collection-grid") ||
      el.querySelector(".main-collection-grid") ||
      el.querySelector(".ProductList--grid") ||
      el.querySelector(".productgrid--items") ||
      el.querySelector(".grid--view-items") ||
      el.querySelector(".ProductList") ||
      el.querySelector("[data-product-grid]") ||
      (function () {
        var byId = el.querySelector("#product-grid, #ProductGrid");
        if (byId && byId !== el && !isProductGridIdShell(byId)) return byId;
        return null;
      })()
    );
  }

  function isPageShellHost(el) {
    if (!el || el.nodeType !== 1) return false;
    if (isProductGridIdShell(el)) return true;
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
      if (cls.contains("template-search__results") && !isProductGridLike(el)) {
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
    if (isProductGridIdShell(el)) return false;
    if (el.getAttribute && el.getAttribute("product-grid-view") != null) {
      return true;
    }
    var tag = String(el.tagName || "").toLowerCase();
    if (el.id === "product-grid" || el.id === "ProductGrid") {
      /* Id on UL/OL = collection Dawn. Id on DIV shell = search — not a card grid. */
      return tag === "ul" || tag === "ol";
    }
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
    if (isProductGridIdShell(el) || isPageShellHost(el)) {
      var fromShell = queryInnerCardGrid(el);
      if (fromShell && fromShell !== el) {
        captureThemeGridLayout(fromShell);
        return fromShell;
      }
    }
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
    if (isResultsListEl(host) || isPageShellHost(host) || isProductGridIdShell(host)) {
      return;
    }
    var id = host.id || "";
    var looksLikeGrid =
      isProductGridLike(host) ||
      (host.classList && host.classList.contains("sf-app-grid")) ||
      ((id === "product-grid" || id === "ProductGrid") &&
        (String(host.tagName || "").toLowerCase() === "ul" ||
          String(host.tagName || "").toLowerCase() === "ol")) ||
      id === "findly-grid-host";
    if (!looksLikeGrid) return;
    /* Prefer Dawn class column counts over generic auto-fill so search matches collection. */
    if (dawnFlexColumnCount(host) >= 2) {
      ensureDawnFlexColumnWidths(host, true);
      return;
    }
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

  function clampThemeCols(n) {
    n = Number(n) || 0;
    if (n < 2 || n > 8) return 0;
    return n | 0;
  }

  /**
   * Parse a column count from theme tokens: plain ints, repeat(N, …), or
   * fixed track lists. Returns 0 for auto-fill/fit / unknown.
   */
  function parseColumnCountToken(raw) {
    var text = String(raw == null ? "" : raw).trim();
    if (!text) return 0;
    if (/^\d+(\.\d+)?$/.test(text)) return clampThemeCols(parseInt(text, 10));
    if (/auto-fill|auto-fit/i.test(text)) return 0;
    var rep = text.match(/repeat\(\s*(\d+)\s*,/i);
    if (rep) return clampThemeCols(parseInt(rep[1], 10));
    var stripped = text
      .replace(/minmax\([^)]*\)/gi, "X")
      .replace(/min\([^)]*\)/gi, "X")
      .replace(/max\([^)]*\)/gi, "X")
      .replace(/clamp\([^)]*\)/gi, "X")
      .replace(/\[[^\]]*]/g, " ");
    if (/auto-fill|auto-fit/i.test(stripped)) return 0;
    var parts = stripped.split(/\s+/).filter(function (p) {
      return p && p !== "/";
    });
    if (parts.length >= 2 && parts.length <= 8) return clampThemeCols(parts.length);
    return 0;
  }

  function readColumnCountFromClassName(className) {
    var cls = String(className || "");
    if (!cls) return 0;
    var patterns = [
      /\bgrid--(\d+)-col-desktop\b/i,
      /\bgrid--(\d+)-col\b/i,
      /\bgrid-cols-(\d+)\b/i,
      /\b(?:md|lg|xl|2xl):grid-cols-(\d+)\b/i,
      /\bcolumns?-(\d+)(?:-desktop)?\b/i,
      /\bcols?-(\d+)(?:-desktop)?\b/i,
      /\bproducts?-per-row-(\d+)\b/i,
      /\bper-row-(\d+)\b/i,
      /\blarge-block-grid-(\d+)\b/i,
      /\bmedium-block-grid-(\d+)\b/i,
      /\bsmall-block-grid-(\d+)\b/i,
    ];
    var i;
    for (i = 0; i < patterns.length; i++) {
      var m = cls.match(patterns[i]);
      if (m) {
        var n = clampThemeCols(parseInt(m[1], 10));
        if (n) return n;
      }
    }
    return 0;
  }

  /** Debut / Brooklyn / Foundation-style width utilities on cards. */
  function readColumnCountFromFoundationChild(host) {
    if (!host || !host.children) return 0;
    var FRACTIONS = {
      "one-half": 2,
      "one-third": 3,
      "one-quarter": 4,
      "one-fifth": 5,
      "one-sixth": 6,
    };
    var i;
    var limit = Math.min(host.children.length, 8);
    for (i = 0; i < limit; i++) {
      var kid = host.children[i];
      if (!kid || kid.nodeType !== 1) continue;
      if (typeof isGridChrome === "function" && isGridChrome(kid)) continue;
      var cls = String(kid.className || "");
      var m = cls.match(
        /\b(?:medium-up|large-up|large|medium|widescreen)--(one-(?:half|third|quarter|fifth|sixth))\b/i,
      );
      if (!m) m = cls.match(/\b(one-(?:half|third|quarter|fifth|sixth))\b/i);
      if (m && FRACTIONS[m[1]]) return FRACTIONS[m[1]];
    }
    return 0;
  }

  function readColumnCountFromDataAttrs(el) {
    if (!el || !el.getAttribute) return 0;
    var keys = [
      "data-columns",
      "data-cols",
      "data-grid-columns",
      "data-desktop-columns",
      "data-products-per-row",
      "data-per-row",
      "data-column-count",
      "data-columns-desktop",
      "columns",
    ];
    var i;
    for (i = 0; i < keys.length; i++) {
      var n = parseColumnCountToken(el.getAttribute(keys[i]));
      if (n) return n;
    }
    return 0;
  }

  function readColumnCountFromCssVars(host) {
    if (!host || typeof window.getComputedStyle !== "function") return 0;
    var vars = [
      "--product-grid-columns-desktop",
      "--product-grid-columns",
      "--columns-desktop",
      "--grid-columns-desktop",
      "--grid-columns",
      "--columns",
      "--cols",
      "--product-list-columns",
      "--collection-columns",
      "--products-per-row",
      "--column-count",
      "--grid-column-count",
    ];
    try {
      var cs = window.getComputedStyle(host);
      var i;
      for (i = 0; i < vars.length; i++) {
        var n = parseColumnCountToken(cs.getPropertyValue(vars[i]));
        if (n) return n;
      }
    } catch (err) {
      return 0;
    }
    return 0;
  }

  function readColumnCountFromComputedTracks(host) {
    if (!host || typeof window.getComputedStyle !== "function") return 0;
    try {
      var cs = window.getComputedStyle(host);
      if (String(cs.display || "").indexOf("grid") === -1) return 0;
      return parseColumnCountToken(cs.gridTemplateColumns);
    } catch (err) {
      return 0;
    }
  }

  /**
   * Theme-agnostic desktop column count. Prefer explicit theme signals over
   * Findly defaults. Works for Dawn, Horizon, and most OS 2.0 / legacy themes.
   */
  function resolveThemeDesktopColumnCount(host) {
    if (!host) return 0;
    var n = readColumnCountFromClassName(host.className);
    if (n) return n;
    n = readColumnCountFromDataAttrs(host);
    if (n) return n;
    if (host.parentElement) {
      n = readColumnCountFromDataAttrs(host.parentElement);
      if (n) return n;
      n = readColumnCountFromClassName(host.parentElement.className);
      if (n) return n;
    }
    n = readColumnCountFromCssVars(host);
    if (n) return n;
    if (host.parentElement) {
      n = readColumnCountFromCssVars(host.parentElement);
      if (n) return n;
    }
    n = readColumnCountFromFoundationChild(host);
    if (n) return n;
    n = readColumnCountFromComputedTracks(host);
    if (n) return n;
    return 0;
  }

  /** @deprecated name kept — now delegates to theme-agnostic resolver on desktop. */
  function readHorizonDesktopColCount(host) {
    return resolveThemeDesktopColumnCount(host);
  }

  /** True when Findly must not apply desktop product-grid column !important locks. */
  function isProductGridNarrowDesktopBand() {
    try {
      if (typeof window.matchMedia !== "function") return false;
      return window.matchMedia(
        "(min-width: 990px) and (max-width: " +
          (PRODUCT_GRID_DESKTOP_LOCK_MIN - 1) +
          "px)",
      ).matches;
    } catch (err) {
      return false;
    }
  }

  function dawnFlexColumnCount(host) {
    if (!host || !host.classList) return 0;
    var cls = String(host.className || "");
    var desk = cls.match(/\bgrid--(\d+)-col-desktop\b/);
    var tablet = cls.match(/\bgrid--(\d+)-col-tablet(?:-down)?\b/);
    var mobile = cls.match(/\bgrid--(\d+)-col-mobile\b/);
    var deskN = desk ? Math.max(1, Number(desk[1]) || 0) : 0;
    var tabletN = tablet ? Math.max(1, Number(tablet[1]) || 0) : 0;
    var mobileN = mobile ? Math.max(1, Number(mobile[1]) || 0) : 0;
    var themeN = 0;
    try {
      if (
        typeof window.matchMedia === "function" &&
        window.matchMedia(
          "(min-width: " + PRODUCT_GRID_DESKTOP_LOCK_MIN + "px)",
        ).matches
      ) {
        /* Wide desktop (≥1041): any theme column signal first. */
        if (deskN) return deskN;
        themeN = resolveThemeDesktopColumnCount(host);
        if (themeN) return themeN;
        if (tabletN) return tabletN;
        if (mobileN) return mobileN;
        return 0;
      }
      if (
        typeof window.matchMedia === "function" &&
        window.matchMedia("(min-width: 750px)").matches
      ) {
        /*
         * Tablet + narrow desktop band (750–1040): tablet-down first.
         * 990–1040 intentionally skips desktop N so Findly !important locks
         * do not fight theme CSS while the sidebar layout is already on.
         */
        if (tabletN) return tabletN;
        if (mobileN) return mobileN;
        /* In 990–1040 do not fall through to desktop col count for locks. */
        if (isProductGridNarrowDesktopBand()) return 0;
        if (deskN) return deskN;
        return 0;
      }
    } catch (err) {
      /* ignore */
    }
    /*
     * Phone (<750): never use desktop col count (that locked 3-col inline
     * widths on mobile). Prefer mobile, else tablet-down (Dawn's intended
     * narrow breakpoint). Return 0 when unmarked — do not invent columns.
     */
    if (mobileN) return mobileN;
    if (tabletN) return tabletN;
    return 0;
  }

  function syncDawnDesktopColClass(host, cols) {
    if (!host || !host.classList || cols < 2) return;
    /* Dawn ships 2–6 desktop col classes; clamp Findly-applied sync only. */
    cols = Math.max(2, Math.min(6, cols | 0));
    var n;
    for (n = 2; n <= 6; n++) {
      var name = "grid--" + n + "-col-desktop";
      if (n === cols) host.classList.add(name);
      else host.classList.remove(name);
    }
  }

  /** True for Findly %/calc column locks (incl. older builds without data-sf-col-lock). */
  function looksLikeFindlyPercentColLock(kid) {
    if (!kid || !kid.style) return false;
    if (kid.getAttribute && kid.getAttribute(COL_LOCK_ATTR) === "1") return true;
    try {
      var w = String(
        kid.style.getPropertyValue("width") || kid.style.width || "",
      ).trim();
      if (!w) return false;
      if (/calc\s*\(\s*\d+(\.\d+)?%\s*-/i.test(w)) return true;
      if (!/^\d+(\.\d+)?%$/.test(w)) return false;
      var flex = String(
        kid.style.getPropertyValue("flex") || kid.style.flex || "",
      ).trim();
      return flex.indexOf("0 0") === 0;
    } catch (err) {
      return false;
    }
  }

  /** Remove only Findly-applied flex column locks; leave theme/inline alone. */
  function clearDawnFlexColumnWidths(host) {
    if (!host || !host.children) return;
    var i;
    for (i = 0; i < host.children.length; i++) {
      var kid = host.children[i];
      if (!kid || !kid.style || typeof kid.style.removeProperty !== "function") {
        continue;
      }
      if (typeof isGridChrome === "function" && isGridChrome(kid)) continue;
      if (!looksLikeFindlyPercentColLock(kid)) continue;
      try {
        kid.style.removeProperty("width");
        kid.style.removeProperty("max-width");
        kid.style.removeProperty("flex");
        kid.style.removeProperty("flex-grow");
        kid.style.removeProperty("flex-shrink");
        kid.style.removeProperty("flex-basis");
        if (kid.removeAttribute) kid.removeAttribute(COL_LOCK_ATTR);
      } catch (err) {
        /* ignore */
      }
    }
  }

  function isVisibleProductCard(el) {
    if (!el || el.nodeType !== 1) return false;
    if (el.hidden || (el.hasAttribute && el.hasAttribute("hidden"))) return false;
    if (el.getAttribute && el.getAttribute("aria-hidden") === "true") return false;
    if (el.getAttribute && el.getAttribute("data-smart-filter-hidden") === "true") {
      return false;
    }
    if (el.getAttribute && el.getAttribute("data-findly-theme-hidden") === "1") {
      return false;
    }
    if (el.getAttribute && el.getAttribute(SKEL_ATTR) === "1") return false;
    try {
      if (typeof window.getComputedStyle === "function") {
        var cs = window.getComputedStyle(el);
        if (cs.display === "none" || cs.visibility === "hidden") return false;
      }
    } catch (err) {
      /* ignore */
    }
    return true;
  }

  /**
   * Prefer any theme's column count when present. Never downgrade N → 3.
   *
   * Preserved behavior:
   * - Crush prevention / flex width locks still run via ensureDawnFlexColumnWidths
   *   using whatever N the theme (or Findly fallback) provides.
   * - Search pages with no theme column signal still get Findly's default 3-col
   *   + tablet-down (same as before when !desk on search).
   * - Collection pages without a column signal are left alone so CSS-grid /
   *   non-Dawn themes are not forced onto Dawn flex classes.
   */
  function alignProductGridToCollection(host) {
    host = resolveListingCardGrid(host) || preferProductCardGrid(host) || host;
    if (!host || !host.classList) return host;
    if (!host.closest || !host.closest(".sf-collection-layout .sf-layout-main")) {
      return host;
    }
    var themeCols = resolveThemeDesktopColumnCount(host);

    if (themeCols >= 2) {
      /* Theme already declared N — keep it; do not invent/swap Dawn classes. */
      host.setAttribute("data-sf-aligned-cols", String(themeCols));
      return host;
    }

    /*
     * No theme column signal. Only apply Findly's default on search pages
     * (historical path: !desk && isSearchPageContext). Do not mutate
     * collection CSS-grid hosts that intentionally omit column classes.
     */
    if (isSearchPageContext()) {
      syncDawnDesktopColClass(host, FINDLY_DEFAULT_DESKTOP_COLS);
      if (!host.classList.contains("grid--2-col-tablet-down")) {
        host.classList.add("grid--2-col-tablet-down");
      }
      host.setAttribute(
        "data-sf-aligned-cols",
        String(FINDLY_DEFAULT_DESKTOP_COLS),
      );
    }
    return host;
  }

  function normalizeCardMediaRatio(host) {
    host = resolveListingCardGrid(host) || host;
    if (!host || !host.querySelectorAll) return;
    if (!host.closest || !host.closest(".sf-collection-layout .sf-layout-main")) {
      return;
    }
    /*
     * Collection: fixed ~248×310 (125%). Search Dawn often uses adapt-to-image
     * inline --ratio-percent (console: 139 / 224 / 248). Force collection frame.
     */
    var TARGET = "125%";
    var forceSearch =
      isSearchPageContext() ||
      Boolean(
        host.closest &&
          host.closest(
            ".template-search__results, .template-search, [data-sf-search-grid]",
          ),
      );
    var inners = host.querySelectorAll(".card__inner.ratio, .card__inner");
    var i;
    for (i = 0; i < inners.length; i++) {
      var inner = inners[i];
      if (!inner || !inner.style) continue;
      if (!inner.classList.contains("ratio")) inner.classList.add("ratio");
      var media = inner.querySelector(".card__media, .media");
      var mediaH = 0;
      var mediaW = 0;
      try {
        if (media) {
          var mb = media.getBoundingClientRect();
          mediaH = mb.height || 0;
          mediaW = mb.width || 0;
        }
      } catch (err2) {
        mediaH = 0;
        mediaW = 0;
      }
      var collapsed = mediaW > 0 && mediaH > 0 && mediaH / mediaW < 1.05;
      if (forceSearch || collapsed || !inner.style.getPropertyValue("--ratio-percent")) {
        inner.style.setProperty("--ratio-percent", TARGET);
        inner.style.setProperty("--ratio", "0.8");
      }
    }
  }

  /**
   * Dawn product ULs are display:flex; column classes size .grid__item with %.
   * After search remount, those % widths can fail and cards crush (~159px).
   * Only intervene when items are clearly too narrow vs the column class.
   */
  function ensureDawnFlexColumnWidths(host, force) {
    if (!host || !host.children) return false;
    if (isPageShellHost(host) || isProductGridIdShell(host)) return false;
    /*
     * 990–1040: clear any prior Findly card width !important and let theme CSS
     * own the grid. Sidebar layout at 990 is unchanged.
     */
    if (isProductGridNarrowDesktopBand()) {
      clearDawnFlexColumnWidths(host);
      return false;
    }
    var cols = dawnFlexColumnCount(host);
    /* <2 cols: clear Findly multi-col locks only; theme styles stay. */
    if (cols < 2) {
      clearDawnFlexColumnWidths(host);
      return false;
    }
    var hostW = hostLayoutWidth(host);
    if (hostW < 120) return false;
    var items = [];
    var visible = [];
    var i;
    for (i = 0; i < host.children.length; i++) {
      var kid = host.children[i];
      if (!kid || kid.nodeType !== 1) continue;
      if (typeof isGridChrome === "function" && isGridChrome(kid)) continue;
      if (kid.getAttribute && kid.getAttribute(SKEL_ATTR) === "1") continue;
      if (kid.id === CARD_TRAY_ID || kid.id === EMPTY_ID) continue;
      items.push(kid);
      if (isVisibleProductCard(kid)) visible.push(kid);
    }
    if (!visible.length) return false;
    /*
     * Lone / partial rows often stretch (live search: 1 card → 100% width).
     * Always re-lock when fewer visible cards than columns inside Findly layout.
     */
    if (
      !force &&
      visible.length < cols &&
      host.closest &&
      host.closest(".sf-collection-layout .sf-layout-main")
    ) {
      force = true;
    }
    if (!force) {
      var sampleW = 0;
      try {
        sampleW = visible[0].getBoundingClientRect().width || 0;
      } catch (err) {
        sampleW = 0;
      }
      var expected = hostW / cols;
      /* Healthy = near one column. Too narrow OR too wide both need a fix. */
      if (sampleW >= expected * 0.55 && sampleW <= expected * 1.35) return false;
    }
    var gap = 0;
    try {
      if (typeof window.getComputedStyle === "function") {
        var cs = window.getComputedStyle(host);
        gap = parseFloat(cs.columnGap || cs.gap) || 0;
      }
    } catch (gapErr) {
      gap = 0;
    }
    /*
     * Always size by the theme/aligned column count (Dawn/Horizon, else
     * Findly default), never by visible card count — 1 result must stay one
     * column wide, not full-bleed.
     */
    var frac = 100 / cols;
    var spacingShare = gap > 0 ? (gap * (cols - 1)) / cols : 0;
    var widthExpr =
      spacingShare > 0
        ? "calc(" + frac + "% - " + spacingShare + "px)"
        : frac + "%";
    try {
      host.style.setProperty("width", "100%", "important");
      host.style.setProperty("max-width", "100%", "important");
      host.style.setProperty("box-sizing", "border-box");
      host.style.setProperty("display", "flex", "important");
      host.style.setProperty("flex-wrap", "wrap");
      host.style.setProperty("justify-content", "flex-start");
      host.style.setProperty("column-gap", gap > 0 ? gap + "px" : "8px");
      host.style.setProperty("row-gap", gap > 0 ? gap + "px" : "8px");
    } catch (hostStyleErr) {
      /* ignore */
    }
    for (i = 0; i < items.length; i++) {
      if (!items[i].style || typeof items[i].style.setProperty !== "function") {
        continue;
      }
      if (!isVisibleProductCard(items[i])) continue;
      /* flex-grow 0 so a lone card cannot stretch to fill the row. */
      items[i].style.setProperty("width", widthExpr, "important");
      items[i].style.setProperty("max-width", widthExpr, "important");
      items[i].style.setProperty("flex", "0 0 auto", "important");
      items[i].style.setProperty("flex-grow", "0", "important");
      items[i].style.setProperty("flex-shrink", "0", "important");
      items[i].style.setProperty("flex-basis", "auto", "important");
      items[i].style.setProperty("box-sizing", "border-box");
      try {
        items[i].setAttribute(COL_LOCK_ATTR, "1");
      } catch (attrErr) {
        /* ignore */
      }
    }
    normalizeCardMediaRatio(host);
    return true;
  }

  function clearThemeGridSnap(host) {
    if (!host) return;
    try {
      if (themeGridSnaps && typeof themeGridSnaps.delete === "function") {
        themeGridSnaps.delete(host);
      }
    } catch (err) {
      /* ignore */
    }
    try {
      if (host._sfGridSnap) host._sfGridSnap = null;
    } catch (err2) {
      /* ignore */
    }
  }

  function tracksLookLikeAbsolutePixels(value) {
    var text = String(value || "").trim();
    if (!text || !/px/i.test(text)) return false;
    if (/fr|%|minmax|auto|repeat/i.test(text)) return false;
    return true;
  }

  function lockThemeGridTracks(host) {
    host = resolveListingCardGrid(host) || preferProductCardGrid(host) || host;
    if (!host || !host.style || typeof host.style.setProperty !== "function") {
      return;
    }
    if (isProductGridIdShell(host) || (isPageShellHost(host) && !isActualCardGrid(host))) {
      return;
    }
    host = alignProductGridToCollection(host) || host;
    try {
      host.style.removeProperty("grid-template-columns");
      host.style.removeProperty("grid-template-rows");
    } catch (err) {
      /* ignore */
    }
    var snap = captureThemeGridLayout(host);
    if (!snap) {
      if (dawnFlexColumnCount(host) >= 2) {
        ensureDawnFlexColumnWidths(host, true);
      } else {
        ensureFallbackProductGridTracks(host);
      }
      normalizeCardMediaRatio(host);
      return;
    }
    var display = String(snap.display || "");
    if (display.indexOf("flex") !== -1) {
      if (snap.flexWrap) host.style.setProperty("flex-wrap", snap.flexWrap);
      /* Inside filter layout, always recompute so partial search rows fill width. */
      var inFilterMain =
        host.closest && host.closest(".sf-collection-layout .sf-layout-main");
      ensureDawnFlexColumnWidths(host, Boolean(inFilterMain));
      normalizeCardMediaRatio(host);
      return;
    }
    if (display.indexOf("grid") === -1) {
      if (dawnFlexColumnCount(host) >= 2) {
        ensureDawnFlexColumnWidths(host, true);
      } else {
        ensureFallbackProductGridTracks(host);
      }
      normalizeCardMediaRatio(host);
      return;
    }
    if (snap.horizonCols) {
      host.style.setProperty("--product-grid-columns-desktop", snap.horizonCols);
    }
    var dawnCols = dawnFlexColumnCount(host);
    /*
     * CSS-grid themes (Horizon and many OS 2.0 themes): keep grid layout.
     * Never force Dawn-style flex width locks onto an actual CSS grid host —
     * that broke non-Dawn themes once column detection improved.
     */
    if (
      tracksLookLikeAbsolutePixels(snap.gridTemplateColumns) &&
      dawnCols >= 2
    ) {
      /* Stale full-bleed px snaps after sidebar narrows — rebuild as grid. */
      clearThemeGridSnap(host);
      host.style.setProperty("width", "100%", "important");
      host.style.setProperty("max-width", "100%", "important");
      host.style.setProperty(
        "grid-template-columns",
        "repeat(" + dawnCols + ", minmax(0, 1fr))",
      );
      normalizeCardMediaRatio(host);
      return;
    }
    if (tracksLookUsable(snap.gridTemplateColumns)) {
      host.style.setProperty("width", "100%", "important");
      host.style.setProperty("max-width", "100%", "important");
      host.style.setProperty("grid-template-columns", snap.gridTemplateColumns);
      normalizeCardMediaRatio(host);
      return;
    }
    if (dawnCols >= 2) {
      host.style.setProperty("width", "100%", "important");
      host.style.setProperty("max-width", "100%", "important");
      host.style.setProperty(
        "grid-template-columns",
        "repeat(" + dawnCols + ", minmax(0, 1fr))",
      );
      normalizeCardMediaRatio(host);
      return;
    }
    if (!snap.horizonCols) {
      ensureFallbackProductGridTracks(host);
    }
    normalizeCardMediaRatio(host);
  }

  function scheduleRelockProductGridTracks(widget) {
    if (!widget) return;
    if (widget._relockTracksScheduled) return;
    widget._relockTracksScheduled = true;
    var run = function () {
      widget._relockTracksScheduled = false;
      ensureToolbarInColumnMain(widget);
      var host =
        resolveListingCardGrid(widget._gridParent) ||
        resolveListingCardGrid(collectionSearchGridEl(widget)) ||
        resolveListingCardGrid(
          liveProductGridIn(document.querySelector(".sf-collection-layout")),
        );
      if (!host) return;
      widget._gridParent = host;
      /* Drop only full-bleed px snaps taken before the sidebar narrowed. */
      var snap = readCachedGridSnap(host);
      if (snap && tracksLookLikeAbsolutePixels(snap.gridTemplateColumns)) {
        clearThemeGridSnap(host);
      }
      lockThemeGridTracks(host);
      /*
       * Flex themes (Dawn etc.): re-lock % widths after sidebar layout.
       * CSS-grid themes: lockThemeGridTracks already preserved/rebuilt tracks —
       * do not force Dawn flex locks onto them.
       */
      if (host.closest && host.closest(".sf-collection-layout .sf-layout-main")) {
        var relockFlex = false;
        try {
          if (typeof window.getComputedStyle === "function") {
            relockFlex =
              String(window.getComputedStyle(host).display || "").indexOf(
                "flex",
              ) !== -1;
          }
        } catch (relockErr) {
          relockFlex = false;
        }
        if (relockFlex) ensureDawnFlexColumnWidths(host, true);
      }
    };
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(function () {
        requestAnimationFrame(run);
      });
    } else {
      setTimeout(run, 48);
    }
  }

  /**
   * Same bands dawnFlexColumnCount / the column CSS already use.
   * Phone <750, tablet 750–989, narrow desktop 990–1040, desktop ≥1041.
   */
  function productGridViewportBand() {
    try {
      if (typeof window.matchMedia !== "function") return "phone";
      if (
        window.matchMedia(
          "(min-width: " + PRODUCT_GRID_DESKTOP_LOCK_MIN + "px)",
        ).matches
      ) {
        return "desktop";
      }
      if (window.matchMedia("(min-width: 990px)").matches) return "narrow";
      if (window.matchMedia("(min-width: 750px)").matches) return "tablet";
    } catch (err) {
      /* ignore */
    }
    return "phone";
  }

  /**
   * ensureDawnFlexColumnWidths writes column-gap as a raw px length, then the
   * next run reads that length back. Drop only that inline value so a band
   * change measures the theme gap the way a fresh load at this width would.
   * Leave the gap alone unless this host also has the flex lock that function sets.
   */
  function clearFindlyInlinePxGap(host) {
    if (!host || !host.style || typeof host.style.getPropertyValue !== "function") {
      return;
    }
    var display = "";
    var priority = "";
    try {
      display = String(host.style.getPropertyValue("display") || "").trim();
      priority = String(host.style.getPropertyPriority("display") || "");
    } catch (err) {
      return;
    }
    if (display !== "flex" || priority !== "important") return;
    var props = ["column-gap", "row-gap", "gap"];
    var i;
    for (i = 0; i < props.length; i++) {
      var value = "";
      try {
        value = String(host.style.getPropertyValue(props[i]) || "").trim();
      } catch (readErr) {
        value = "";
      }
      if (!/^\d+(\.\d+)?px$/.test(value)) continue;
      try {
        host.style.removeProperty(props[i]);
      } catch (removeErr) {
        /* ignore */
      }
    }
  }

  function listingCardGridHost(widget) {
    return (
      (widget && resolveListingCardGrid(widget._gridParent)) ||
      (widget && resolveListingCardGrid(collectionSearchGridEl(widget))) ||
      resolveListingCardGrid(
        liveProductGridIn(document.querySelector(".sf-collection-layout")),
      ) ||
      null
    );
  }

  /**
   * Re-run the existing column lock after a breakpoint cross.
   * Does not move the toolbar — scheduleRelockProductGridTracks also calls
   * ensureToolbarInColumnMain, which this path leaves alone.
   */
  function relockProductGridForViewport(widget) {
    widget = widget || window.__FINDLY_FILTER_WIDGET;
    /* Read the grid the widget already uses. Do not assign _gridParent —
       that would retarget later filter renders. */
    var host = listingCardGridHost(widget);
    if (!host) return;
    clearThemeGridSnap(host);
    clearFindlyInlinePxGap(host);
    clearDawnFlexColumnWidths(host);
    lockThemeGridTracks(host);
    if (host.closest && host.closest(".sf-collection-layout .sf-layout-main")) {
      var relockFlex = false;
      try {
        if (typeof window.getComputedStyle === "function") {
          relockFlex =
            String(window.getComputedStyle(host).display || "").indexOf("flex") !==
            -1;
        }
      } catch (relockErr) {
        relockFlex = false;
      }
      if (relockFlex) ensureDawnFlexColumnWidths(host, true);
    }
  }

  function bindProductGridViewportRelock() {
    if (window.__findlyGridViewportRelock) return;
    window.__findlyGridViewportRelock = true;
    var lastBand = productGridViewportBand();
    var scheduled = false;
    var thresholds = [750, 990, PRODUCT_GRID_DESKTOP_LOCK_MIN];
    function onBandChange() {
      var band = productGridViewportBand();
      if (band === lastBand) return;
      lastBand = band;
      if (scheduled) return;
      scheduled = true;
      var run = function () {
        scheduled = false;
        lastBand = productGridViewportBand();
        relockProductGridForViewport(window.__FINDLY_FILTER_WIDGET);
      };
      if (typeof requestAnimationFrame === "function") {
        requestAnimationFrame(function () {
          requestAnimationFrame(run);
        });
      } else {
        setTimeout(run, 48);
      }
    }
    var i;
    for (i = 0; i < thresholds.length; i++) {
      try {
        var mq = window.matchMedia("(min-width: " + thresholds[i] + "px)");
        if (mq.addEventListener) mq.addEventListener("change", onBandChange);
        else if (mq.addListener) mq.addListener(onBandChange);
      } catch (err) {
        /* ignore */
      }
    }
    window.addEventListener("orientationchange", onBandChange);
  }

  function isThemeWidthContainer(el) {
    if (!el || el.nodeType !== 1 || isFullBleedHost(el)) return false;
    if (!el.classList) return false;
    if (el.classList.contains("sf-collection-layout")) return false;
    /* Peeled outer shell — never the listing node itself. */
    if (
      el.classList.contains("sf-theme-width") &&
      !isProductGridLike(el) &&
      !isProductGridIdShell(el)
    ) {
      return true;
    }
    /* Dawn search: #product-grid.page-width is a width shell, not the card list. */
    if (isProductGridIdShell(el)) {
      return (
        el.classList.contains("page-width") ||
        el.classList.contains("page-width-desktop") ||
        el.classList.contains("page-width--narrow") ||
        el.classList.contains("page-width--compact")
      );
    }
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
    return copyThemeWidthClassName(shell, true);
  }

  /**
   * True when the listing shell itself carries the theme max-width (Dawn search
   * `#product-grid.page-width`). Wrapping `.sf-collection-layout` *around* that
   * node leaves the filter+grid full-bleed; peel width to an outer shell first.
   */
  function listingCarriesThemeWidth(el) {
    if (!el || !isThemeWidthContainer(el)) return false;
    return isProductGridIdShell(el) || (isPageShellHost(el) && !isProductGridLike(el));
  }

  function copyThemeWidthClassName(el, forSearch) {
    var sample = el;
    if (!sample || !sample.classList || !isThemeWidthContainer(sample)) {
      sample =
        (el &&
          el.querySelector &&
          el.querySelector(
            ".page-width:not(.page-width--full), .page-width-desktop, .page-width--narrow," +
              ".container:not(.container-fluid), .Container, .page-container, .wrapper",
          )) ||
        document.querySelector(THEME_WIDTH_SELECTOR);
    }
    var parts = [];
    if (sample && sample.classList) {
      if (sample.classList.contains("page-width-desktop")) {
        parts.push("page-width-desktop");
      } else if (sample.classList.contains("page-width--narrow")) {
        parts.push("page-width", "page-width--narrow");
      } else if (sample.classList.contains("page-width--compact")) {
        parts.push("page-width", "page-width--compact");
      } else if (sample.classList.contains("page-width")) {
        parts.push("page-width");
      } else if (
        sample.classList.contains("container") &&
        !sample.classList.contains("container-fluid")
      ) {
        parts.push("container");
      } else if (sample.classList.contains("Container")) {
        parts.push("Container");
      } else if (sample.classList.contains("page-container")) {
        parts.push("page-container");
      } else if (sample.classList.contains("wrapper")) {
        parts.push("wrapper");
      } else if (sample.classList.contains("collection-wrapper")) {
        parts.push("collection-wrapper");
      }
    }
    if (!parts.length) parts.push("page-width");
    parts.push("sf-theme-width");
    if (forSearch) parts.push("sf-search-width");
    return parts.join(" ");
  }

  function stripThemeWidthClasses(el) {
    if (!el || !el.classList) return;
    el.classList.remove(
      "page-width",
      "page-width-desktop",
      "page-width--narrow",
      "page-width--compact",
      "page-width--full",
      "sf-search-width",
      "sf-theme-width",
    );
    if (el.removeAttribute) el.removeAttribute("data-sf-theme-width");
  }

  /**
   * Move theme max-width off a listing shell onto an outer wrapper so
   * `.sf-collection-layout` can sit *inside* the constrained column:
   *   .page-width.sf-theme-width > .sf-collection-layout > aside + listing
   * Leaves title/banner siblings outside this shell untouched.
   */
  function peelListingThemeWidth(listing) {
    if (!listing || !listing.parentNode || !listingCarriesThemeWidth(listing)) {
      return null;
    }
    var parent = listing.parentNode;
    if (
      parent &&
      parent.nodeType === 1 &&
      parent.classList &&
      parent.classList.contains("sf-theme-width") &&
      isThemeWidthContainer(parent)
    ) {
      stripThemeWidthClasses(listing);
      return parent;
    }
    var climb = parent;
    var hops = 0;
    while (climb && climb.nodeType === 1 && hops < 8) {
      if (
        climb !== listing &&
        isThemeWidthContainer(climb) &&
        !listingCarriesThemeWidth(climb)
      ) {
        stripThemeWidthClasses(listing);
        return climb;
      }
      if (isFullBleedHost(climb)) break;
      climb = climb.parentElement;
      hops += 1;
    }
    var outer = document.createElement("div");
    outer.className = copyThemeWidthClassName(listing, isSearchPageContext());
    if (outer.setAttribute) outer.setAttribute("data-sf-theme-width", "1");
    stripThemeWidthClasses(listing);
    if (!safeInsertBefore(parent, outer, listing)) parent.appendChild(outer);
    outer.appendChild(listing);
    return outer;
  }

  /* Search pages only: title/form often sit in a theme width box while the
     product grid is a sibling. Wrap both in one shell so Vertical layout
     matches collections. No-op on collection templates. */
  function safeInsertBefore(parent, node, ref) {
    if (!parent || !node || typeof parent.insertBefore !== "function") return false;
    if (node === parent) return false;
    /* Same node as reference — already in the only meaningful position. */
    if (ref && node === ref) return true;
    try {
      /* insertBefore requires a *direct* child as reference. Themes often nest
         the product shell (e.g. main > ProductGridContainer > collection > ul),
         so walk up until we hit a direct child of parent. */
      var before = ref || null;
      if (before && before.parentNode !== parent) {
        while (before && before.parentNode && before.parentNode !== parent) {
          before = before.parentNode;
        }
        if (!before || before.parentNode !== parent) before = null;
      }
      if (before === node) return true;
      if (before && before.parentNode === parent) {
        if (node.parentNode === parent && node.nextSibling === before) return true;
        parent.insertBefore(node, before);
        return true;
      }
      if (node.parentNode === parent && !node.nextSibling) return true;
      parent.appendChild(node);
      return true;
    } catch (err) {
      try {
        if (node.parentNode !== parent) parent.appendChild(node);
        return true;
      } catch (err2) {
        return false;
      }
    }
  }

  function ensureSearchThemeWidthShell(grid) {
    if (!grid || !isSearchPageContext()) return null;
    /* Dawn search: #product-grid.page-width must not stay the width *and* listing
       host — peel max-width to an outer .sf-theme-width so filter+grid stay
       constrained and title/header siblings keep their own theme width. */
    var nativeWidth = closestThemeWidth(grid);
    if (nativeWidth) {
      if (listingCarriesThemeWidth(nativeWidth)) {
        var peeledNative = peelListingThemeWidth(nativeWidth);
        if (peeledNative) {
          if (peeledNative.classList) peeledNative.classList.add("sf-search-width");
          return peeledNative;
        }
      }
      return nativeWidth;
    }
    var existing =
      (grid.closest && grid.closest(".sf-search-width")) ||
      (grid.closest && grid.closest(".sf-theme-width")) ||
      document.querySelector(".sf-search-width, .sf-theme-width");
    if (existing && existing.contains && existing.contains(grid)) {
      return existing;
    }
    var shell = closestSearchShell(grid);
    if (!shell || isThemeWidthContainer(shell)) return null;
    if (shell.classList && shell.classList.contains("sf-search-width")) {
      return shell;
    }
    if (isProductGridIdShell(shell)) {
      var peeledShell = peelListingThemeWidth(shell);
      return peeledShell || shell;
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

  function isFindlyLayoutChrome(el) {
    if (!el || !el.classList) return false;
    return (
      el.classList.contains("sf-toolbar") ||
      el.classList.contains("sf-sort-host") ||
      el.classList.contains("sf-search-host") ||
      el.classList.contains("sf-pager") ||
      el.classList.contains("sf-page-chips") ||
      el.classList.contains("sf-total-count") ||
      el.classList.contains("smart-filter") ||
      el.classList.contains("sf-layout-aside") ||
      el.classList.contains("sf-layout-main") ||
      el.classList.contains("sf-collection-layout") ||
      el.classList.contains("shopify-block")
    );
  }

  function nodeContainsProductResults(el) {
    if (!el || el.nodeType !== 1) return false;
    if (isProductGridLike(el) || isPageShellHost(el)) return true;
    var id = String(el.id || "");
    if (
      id === "ProductGridContainer" ||
      id === "product-grid" ||
      id === "ProductGrid" ||
      id === "CollectionProductGrid"
    ) {
      return true;
    }
    if (!el.querySelector) return false;
    return Boolean(
      el.querySelector(
        "#product-grid, #ProductGrid, #ProductGridContainer, ul.product-grid, ol.product-grid," +
          " .main-collection-grid, .sf-app-grid, results-list, .results-list",
      ),
    );
  }

  function isSearchPageHeaderEl(el, grid) {
    if (!el || el.nodeType !== 1) return false;
    if (isFindlyLayoutChrome(el)) return false;
    if (grid && el.contains && el.contains(grid)) return false;
    if (nodeContainsProductResults(el)) return false;
    if (el.classList) {
      if (el.classList.contains("template-search__header")) return true;
      if (el.classList.contains("main-search__header")) return true;
      if (el.classList.contains("search-page__header")) return true;
      if (el.classList.contains("search__header")) return true;
      if (el.classList.contains("search-header")) return true;
    }
    if (el.getAttribute && el.getAttribute("data-sf-search-header") === "1") {
      return true;
    }
    if (isThemeWidthContainer(el) && (!grid || !(el.contains && el.contains(grid)))) {
      return true;
    }
    if (!el.querySelector) return false;
    if (
      el.querySelector(
        "h1, h2, .h1, .h2, .title, .page-title, .search__title, .template-search__header",
      )
    ) {
      return true;
    }
    var form = el.querySelector(
      "form[action*='/search'], form.search, form.search-form",
    );
    if (
      form &&
      !form.closest(
        "header, .header, .shopify-section-header, predictive-search, .predictive-search",
      )
    ) {
      return true;
    }
    return false;
  }

  function liveProductGridIn(scope) {
    if (!scope || !scope.querySelector) return null;
    /* Prefer real card lists before Dawn search DIV#product-grid shell. */
    var found =
      scope.querySelector(
        "ul#product-grid, ol#product-grid, ul#ProductGrid, ol#ProductGrid," +
          " ul.product-grid, ol.product-grid, .main-collection-grid, .sf-app-grid," +
          " results-list, [product-grid-view], #product-grid, #ProductGrid",
      ) || null;
    return resolveListingCardGrid(found);
  }

  /**
   * Collection and search must both resolve to the card list host (UL/OL),
   * never Dawn's DIV#product-grid.template-search__results shell.
   */
  function resolveListingCardGrid(el) {
    if (!el || el.nodeType !== 1) return null;
    if (isFindlyLayoutShell(el)) return null;
    var card = preferProductCardGrid(el);
    if (card && isProductGridIdShell(card)) {
      var inner = queryInnerCardGrid(card);
      if (inner) card = inner;
    }
    if (card && isPageShellHost(card) && !isActualCardGrid(card)) {
      var nested = queryInnerCardGrid(card);
      if (nested) card = nested;
    }
    if (card && !isFindlyLayoutShell(card)) return card;
    if (isActualCardGrid(el)) return el;
    return queryInnerCardGrid(el) || null;
  }

  function closestThemeGridShell(grid) {
    if (!grid || grid.nodeType !== 1) return null;
    if (isProductGridIdShell(grid)) return grid;
    var node = grid.parentElement;
    var hops = 0;
    var soft = null;
    while (node && node.nodeType === 1 && hops < 8) {
      if (isProductGridIdShell(node) || isPageShellHost(node)) return node;
      var id = String(node.id || "");
      if (
        id === "ProductGridContainer" ||
        id === "CollectionProductGrid" ||
        id === "CollectionAjaxContent"
      ) {
        return node;
      }
      if (node.classList) {
        if (node.classList.contains("sf-layout-main")) break;
        if (node.classList.contains("sf-collection-layout")) break;
        if (node.classList.contains("product-grid-container")) return node;
        if (node.classList.contains("template-search__results")) return node;
        if (
          node.classList.contains("collection") &&
          !node.classList.contains("sf-collection-layout")
        ) {
          soft = soft || node;
        }
      }
      node = node.parentElement;
      hops += 1;
    }
    return soft;
  }

  /** Walk up detached parents so we reattach the theme wrapper tree, not only the UL. */
  function topDetachedAncestor(el) {
    if (!el || el.nodeType !== 1) return el;
    var node = el;
    while (node.parentElement) {
      var parent = node.parentElement;
      if (parent.isConnected !== false) break;
      node = parent;
    }
    return node;
  }

  function findLiveThemeGridShell(scope) {
    var root = scope || document;
    if (!root || !root.querySelector) return null;
    return (
      root.querySelector(
        "#ProductGridContainer, #CollectionProductGrid, #CollectionAjaxContent," +
          " .product-grid-container",
      ) ||
      root.querySelector(".collection:not(.sf-collection-layout)") ||
      null
    );
  }

  function rememberThemeGridShell(widget, grid) {
    if (!widget || !grid) return;
    var shell = closestThemeGridShell(grid);
    if (shell && shell.isConnected !== false) {
      widget._themeGridShell = shell;
    }
  }

  /**
   * Match collection-page markup: keep the product UL inside the theme section
   * shell (#ProductGridContainer > .collection > ul.product-grid). Bare ULs in
   * .sf-layout-main lose Dawn grid column / card CSS.
   */
  function ensureStandardThemeGridShell(grid, widget) {
    if (!grid || grid.nodeType !== 1) return null;
    if (grid.classList) grid.classList.remove("sf-layout-main");

    var remembered =
      (widget &&
        widget._themeGridShell &&
        widget._themeGridShell.isConnected !== false &&
        widget._themeGridShell) ||
      null;
    /* Prefer Dawn search results shell (#product-grid DIV) over a synthetic
       ProductGridContainer — matches collection card CSS without remounting. */
    var nativeResults =
      closestThemeGridShell(grid) ||
      (isProductGridIdShell(grid) ? grid : null);
    if (
      remembered &&
      remembered.getAttribute &&
      remembered.getAttribute("data-findly-grid-shell") === "1" &&
      nativeResults &&
      nativeResults !== remembered
    ) {
      remembered = null;
    }
    var shell =
      (nativeResults &&
      (isProductGridIdShell(nativeResults) || isPageShellHost(nativeResults))
        ? nativeResults
        : null) ||
      (remembered && (remembered.contains(grid) || !liveProductGridIn(remembered))
        ? remembered
        : null) ||
      findLiveThemeGridShell(
        document.querySelector(".sf-layout-main") || document,
      );

    if (shell && isProductGridLike(shell) && !isProductGridIdShell(shell)) {
      shell = null;
    }

    /* Native Dawn search/collection results shells: keep overlay + ul as-is. */
    if (shell && isProductGridIdShell(shell)) {
      if (shell.setAttribute) shell.setAttribute("data-findly-grid-shell", "1");
      if (widget) widget._themeGridShell = shell;
      return shell;
    }

    if (!shell || shell.isConnected === false) {
      shell = document.createElement("div");
      shell.id = "ProductGridContainer";
      shell.className = "product-grid-container";
      shell.setAttribute("data-findly-grid-shell", "1");
    } else if (shell.setAttribute) {
      shell.setAttribute("data-findly-grid-shell", "1");
    }

    var collection = null;
    if (
      shell.classList &&
      shell.classList.contains("collection") &&
      !shell.classList.contains("sf-collection-layout")
    ) {
      collection = shell;
    } else if (shell.children) {
      var ci;
      for (ci = 0; ci < shell.children.length; ci++) {
        var kid = shell.children[ci];
        if (
          kid &&
          kid.classList &&
          kid.classList.contains("collection") &&
          !kid.classList.contains("sf-collection-layout")
        ) {
          collection = kid;
          break;
        }
      }
    }

    if (!collection) {
      if (
        shell.id === "ProductGridContainer" ||
        (shell.classList && shell.classList.contains("product-grid-container")) ||
        shell.getAttribute("data-findly-grid-shell") === "1"
      ) {
        collection = document.createElement("div");
        collection.className = "collection";
        /* Keep loading-overlay siblings ahead of the product list. */
        var overlay = null;
        var oi;
        if (shell.children) {
          for (oi = 0; oi < shell.children.length; oi++) {
            if (
              shell.children[oi].classList &&
              shell.children[oi].classList.contains("loading-overlay")
            ) {
              overlay = shell.children[oi];
              break;
            }
          }
        }
        if (overlay && overlay.parentNode === shell) {
          if (!safeInsertBefore(shell, collection, overlay.nextSibling)) {
            shell.appendChild(collection);
          }
        } else {
          shell.appendChild(collection);
        }
      } else {
        collection = shell;
      }
    }

    if (!collection.contains(grid) && canMoveNode(collection, grid)) {
      collection.appendChild(grid);
    }

    if (widget) widget._themeGridShell = shell;
    return shell;
  }

  function isListingChromeHost(el) {
    if (!el || el.nodeType !== 1) return false;
    return (
      isProductGridIdShell(el) ||
      isPageShellHost(el) ||
      isProductGridLike(el) ||
      isThemeManagedGrid(el) ||
      isResultsListEl(el)
    );
  }

  function collectFindlyChromeDeep(root, out, limit) {
    if (!root || !root.querySelectorAll || !out) return out;
    var nodes = root.querySelectorAll(
      ".sf-toolbar, .sf-sort-host, .sf-search-host, .sf-total-count, .sf-page-chips, .sf-pager",
    );
    var i;
    var max = typeof limit === "number" ? limit : 24;
    for (i = 0; i < nodes.length && out.length < max; i++) {
      if (nodes[i] && isFindlyLayoutChrome(nodes[i])) out.push(nodes[i]);
    }
    return out;
  }

  function placeChromeBeforeListing(main, shell) {
    if (!main || !shell || !main.contains(shell)) return;
    /* Real column main only — never treat Dawn search DIV#product-grid as main. */
    if (isListingChromeHost(main) || !isColumnMain(main)) {
      var realMain = findColumnMainContaining(shell) || ensureBlockMain(shell);
      if (realMain && realMain !== main && !isListingChromeHost(realMain)) {
        main = realMain;
        if (!main.contains(shell) && canMoveNode(main, shell)) {
          main.appendChild(shell);
        }
      }
    }
    if (!main || !main.contains(shell)) return;
    var chrome = [];
    var i;
    for (i = 0; i < main.children.length; i++) {
      var child = main.children[i];
      if (!child || child === shell) continue;
      if (isFindlyLayoutChrome(child)) chrome.push(child);
    }
    /* Search often leaves toolbar inside the listing shell / UL — hoist it out. */
    collectFindlyChromeDeep(shell, chrome, 24);
    var seen = typeof WeakSet !== "undefined" ? new WeakSet() : null;
    for (i = chrome.length - 1; i >= 0; i--) {
      var node = chrome[i];
      if (!node || (seen && seen.has(node))) continue;
      if (seen) seen.add(node);
      if (shell.contains(node) || node.parentNode !== main) {
        safeInsertBefore(main, node, shell);
      } else if (node.parentNode === main) {
        safeInsertBefore(main, node, shell);
      }
    }
  }

  /**
   * Keep search product listing mounted like collection pages: theme shell inside
   * .sf-layout-main, product UL inside that shell (not a bare orphan UL).
   */
  function ensureProductGridMounted(widget) {
    if (!widget) return null;
    var grid = widget._gridParent;
    if (!grid || grid.nodeType !== 1) {
      grid =
        liveProductGridIn(document.querySelector(".sf-collection-layout")) ||
        liveProductGridIn(document) ||
        null;
      if (!grid) return null;
      widget._gridParent = grid;
    }

    if (grid.isConnected !== false) {
      rememberThemeGridShell(widget, grid);
    }

    var layout = document.querySelector(".sf-collection-layout");
    var main = layout && layout.querySelector(".sf-layout-main");
    var connected = grid.isConnected !== false;

    if (!connected) {
      var mountRoot = topDetachedAncestor(grid) || grid;
      if (main && mountRoot && !isProductGridLike(mountRoot) && canMoveNode(main, mountRoot)) {
        /* Detached tree still has theme wrappers — remount the whole tree. */
        main.appendChild(mountRoot);
        connected = grid.isConnected !== false;
      }
    }

    var shell = ensureStandardThemeGridShell(grid, widget);
    if (main && shell) {
      if (!main.contains(shell) && canMoveNode(main, shell)) {
        main.appendChild(shell);
      }
      placeChromeBeforeListing(main, shell);
    } else if (
      main &&
      grid &&
      !main.contains(grid) &&
      canMoveNode(main, grid)
    ) {
      /* Last resort — still wrap before leaving a bare UL in main. */
      shell = ensureStandardThemeGridShell(grid, widget);
      if (shell && canMoveNode(main, shell)) main.appendChild(shell);
      else main.appendChild(grid);
      if (shell) placeChromeBeforeListing(main, shell);
    }

    showEl(grid);
    if (shell && shell !== grid) showEl(shell);
    grid.removeAttribute("data-findly-orphan-hidden");
    if (shell) shell.removeAttribute("data-findly-orphan-hidden");
    widget._gridParent =
      resolveListingCardGrid(grid) || preferProductCardGrid(grid) || grid;
    lockThemeGridTracks(widget._gridParent);
    scheduleRelockProductGridTracks(widget);
    if (!connected || (main && shell && !main.contains(grid))) {
      gridLog("normalized product grid shell", {
        id: widget._gridParent && widget._gridParent.id,
        shellId: shell && shell.id,
        className: String(
          (widget._gridParent && widget._gridParent.className) || "",
        ).slice(0, 80),
        connected: widget._gridParent && widget._gridParent.isConnected !== false,
      });
    }
    return widget._gridParent;
  }

  /* Search only: move theme title/search form ABOVE the two-column layout so
     the filter sidebar aligns with the product grid, not the page heading. */
  function liftSearchPageHeaderAboveLayout(layout, widget) {
    if (!layout || !layout.parentNode || !isSearchPageContext(widget)) return;
    var parent = layout.parentNode;
    /* Prefer a LIVE grid inside the layout — a disconnected _gridParent makes
       every listing wrapper look like a "header" and get lifted out. */
    var grid =
      liveProductGridIn(layout) ||
      collectionSearchGridEl(widget) ||
      (widget &&
      widget._gridParent &&
      widget._gridParent.isConnected !== false
        ? widget._gridParent
        : null);
    var main = layout.querySelector(".sf-layout-main");
    if (!main || !main.children) return;
    var toLift = [];
    var i;
    for (i = 0; i < main.children.length; i++) {
      var child = main.children[i];
      if (!child || child.nodeType !== 1) continue;
      if (isFindlyLayoutChrome(child)) continue;
      if (child.classList && child.classList.contains("sf-toolbar")) continue;
      /* Never lift the product listing or its theme shells (even if empty). */
      if (isProductGridLike(child) || isPageShellHost(child)) break;
      if (grid && (child === grid || (child.contains && child.contains(grid)))) {
        break;
      }
      if (nodeContainsProductResults(child)) break;
      if (isSearchPageHeaderEl(child, grid)) {
        toLift.push(child);
        continue;
      }
      /* Leading non-product block before the grid (theme-specific wrappers). */
      if (!nodeContainsProductResults(child)) {
        toLift.push(child);
        continue;
      }
      break;
    }
    for (i = 0; i < toLift.length; i++) {
      var node = toLift[i];
      if (isProductGridLike(node) || isPageShellHost(node)) continue;
      if (nodeContainsProductResults(node)) continue;
      if (node.classList && node.classList.contains("sf-toolbar")) continue;
      if (node.parentNode === parent && node.nextSibling === layout) continue;
      if (node.setAttribute) node.setAttribute("data-sf-search-header", "1");
      safeInsertBefore(parent, node, layout);
    }
    /* If a prior pass parked .sf-toolbar on .sf-theme-width, pull it back. */
    ensureToolbarInColumnMain(widget);
  }

  function wrapSearchResultsOnly(pageWidth, grid) {
    if (!pageWidth || isProductGridLike(pageWidth)) return null;
    /* Listing that still owns page-width: peel first, then wrap results only. */
    if (listingCarriesThemeWidth(pageWidth)) {
      var peeledWrap = peelListingThemeWidth(pageWidth);
      if (peeledWrap) pageWidth = peeledWrap;
      if (!pageWidth || listingCarriesThemeWidth(pageWidth)) {
        return ensureBlockMain(pageWidth);
      }
    }
    var existing = null;
    var existingMain = null;
    var i;
    for (i = 0; i < pageWidth.children.length; i++) {
      var direct = pageWidth.children[i];
      if (!direct || !direct.classList) continue;
      if (direct.classList.contains("sf-collection-layout")) {
        existing = direct;
      }
      if (direct.classList.contains("sf-layout-main")) {
        existingMain = existingMain || direct;
      }
    }
    if (existing) {
      return existing.querySelector(".sf-layout-main") || existing;
    }
    /* Idempotent: never wrap an existing .sf-layout-main in another main. */
    if (existingMain) {
      return existingMain;
    }
    var nested =
      pageWidth.querySelector && pageWidth.querySelector(".sf-collection-layout");
    if (nested) {
      return nested.querySelector(".sf-layout-main") || nested;
    }
    var kids = [];
    for (i = 0; i < pageWidth.children.length; i++) {
      kids.push(pageWidth.children[i]);
    }
    var main = document.createElement("div");
    main.className = "sf-layout-main";
    var sawResults = false;
    var liveGrid = grid && grid.isConnected !== false ? grid : liveProductGridIn(pageWidth);
    for (i = 0; i < kids.length; i++) {
      var child = kids[i];
      if (child.classList && child.classList.contains("sf-layout-main")) {
        return child;
      }
      /* Always keep listing shells/grids inside main — never treat as headers. */
      if (
        isProductGridLike(child) ||
        isPageShellHost(child) ||
        isProductGridIdShell(child) ||
        nodeContainsProductResults(child) ||
        (liveGrid && child.contains && child.contains(liveGrid))
      ) {
        sawResults = true;
        main.appendChild(child);
        continue;
      }
      if (!sawResults && isSearchPageHeaderEl(child, liveGrid)) {
        if (child.setAttribute) child.setAttribute("data-sf-search-header", "1");
        continue;
      }
      sawResults = true;
      main.appendChild(child);
    }
    if (!main.firstChild) {
      return wrapInsidePageWidth(pageWidth);
    }
    pageWidth.appendChild(main);
    return main;
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
      safeInsertBefore(parent, gridWrap, host);
      gridWrap.appendChild(host);
      return gridWrap;
    }
    if (host.classList && host.classList.contains("sf-layout-main")) {
      return host;
    }
    if (!needsBlockMainWrap(host)) return host;
    var wrap = document.createElement("div");
    wrap.className = "sf-layout-main";
    safeInsertBefore(parent, wrap, host);
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
    /* Same host preference as collection pages: ProductGridContainer / theme
       section shell — never treat the bare product UL as the layout host. */
    var themeShell =
      closestThemeGridShell(grid) ||
      (isPageShellHost(host) ? host : null) ||
      closestThemeGridShell(host);
    if (themeShell && isProductGridLike(themeShell)) themeShell = null;
    if (isProductGridLike(host) && themeShell && themeShell.contains(host)) {
      host = themeShell;
    } else if (isProductGridLike(host) && listingShell && listingShell.contains(host)) {
      host = listingShell;
    } else if (isProductGridLike(host)) {
      host = (themeShell && themeShell.contains(host) ? themeShell : null) ||
        host.parentElement ||
        host;
    } else if (
      themeShell &&
      host &&
      host.contains &&
      host.contains(themeShell) &&
      !isThemeWidthContainer(host) &&
      !isFullBleedHost(host)
    ) {
      /* Host is an intermediate wrapper — prefer the theme product section. */
      host = themeShell;
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
      if (themeShell) return ensureBlockMain(themeShell);
      if (listingShell) return ensureBlockMain(listingShell);
      if (isFullBleedHost(host) && grid && host.contains && host.contains(grid)) {
        return ensureBlockMain(host);
      }
      return ensureBlockMain(host);
    }
    /* Listing that also owns page-width: peel width outward, wrap the listing
       so `.sf-collection-layout` lands inside the constrained column. */
    if (listingCarriesThemeWidth(pageWidth)) {
      var listingEl = pageWidth;
      var peeledHost = peelListingThemeWidth(listingEl);
      if (peeledHost) pageWidth = peeledHost;
      if (pageWidth && listingEl && pageWidth.contains(listingEl)) {
        return ensureBlockMain(listingEl);
      }
      var peeledListing =
        (isProductGridIdShell(host) && host) ||
        (themeShell && pageWidth && pageWidth.contains(themeShell) ? themeShell : null) ||
        themeWidthChildContaining(pageWidth, grid) ||
        (pageWidth && pageWidth.firstElementChild);
      if (peeledListing && peeledListing !== pageWidth) {
        return ensureBlockMain(peeledListing);
      }
      return wrapInsidePageWidth(pageWidth) || ensureBlockMain(host);
    }
    if (
      host === pageWidth ||
      isFullBleedHost(host) ||
      isProductGridLike(host) ||
      (host.contains && host.contains(pageWidth) && host !== pageWidth)
    ) {
      var child =
        (themeShell &&
          !listingCarriesThemeWidth(themeShell) &&
          pageWidth.contains(themeShell) &&
          themeShell) ||
        themeWidthChildContaining(pageWidth, grid);
      if (!child) {
        var slot = pageWidth.querySelector(
          "#ProductGridContainer, #CollectionProductGrid, #product-grid, #ProductGrid," +
            " ul.product-grid, ol.product-grid, .main-collection-grid, .sf-app-grid, results-list",
        );
        child = themeWidthChildContaining(pageWidth, slot) || slot;
      }
      if (child && child !== pageWidth && !isThemeWidthContainer(child)) {
        /* Search: wrap results only — leave title/form as siblings above layout.
           Prefer the theme product section shell (collection parity). */
        if (
          pageWidth.classList &&
          (pageWidth.classList.contains("sf-search-width") ||
            pageWidth.classList.contains("sf-theme-width"))
        ) {
          return wrapSearchResultsOnly(pageWidth, grid) || ensureBlockMain(child);
        }
        return ensureBlockMain(child);
      }
      if (
        pageWidth.classList &&
        (pageWidth.classList.contains("sf-search-width") ||
          pageWidth.classList.contains("sf-theme-width"))
      ) {
        return wrapSearchResultsOnly(pageWidth, grid) || ensureBlockMain(host);
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
      safeInsertBefore(grand, layout, gridHost);
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

  function isLeadingListingChrome(el) {
    if (!el || el.nodeType !== 1 || !el.classList) return false;
    return (
      el.classList.contains("sf-toolbar") ||
      el.classList.contains("sf-sort-host") ||
      el.classList.contains("sf-search-host") ||
      el.classList.contains("sf-page-chips") ||
      el.classList.contains("sf-total-count")
    );
  }

  function firstListingChildInMain(main) {
    if (!main || !main.children) return null;
    var i;
    for (i = 0; i < main.children.length; i++) {
      var child = main.children[i];
      if (!child || child.nodeType !== 1) continue;
      if (isLeadingListingChrome(child)) continue;
      if (child.classList && child.classList.contains("sf-pager")) continue;
      return child;
    }
    return null;
  }

  function resolveColumnMain(widget) {
    var layout = document.querySelector(".sf-collection-layout");
    var main =
      findColumnMainContaining(
        (widget && widget._gridParent) ||
          (widget && widget._themeGridShell) ||
          null,
      ) || null;
    if ((!main || !isColumnMain(main)) && layout) {
      var mains = layout.querySelectorAll(":scope > .sf-layout-main, .sf-layout-main");
      var i;
      for (i = 0; i < mains.length; i++) {
        if (isColumnMain(mains[i])) {
          main = mains[i];
          break;
        }
      }
    }
    if (!main || !isColumnMain(main)) {
      /* Last resort: direct column under the layout (never require isPageShellHost). */
      main =
        (layout && layout.querySelector(":scope > .sf-layout-main")) ||
        document.querySelector(".sf-collection-layout > .sf-layout-main");
      if (main && !isColumnMain(main)) {
        /* Still use it if it is clearly our column wrapper with listing children. */
        if (
          main.classList &&
          main.classList.contains("sf-layout-main") &&
          !isProductGridLike(main) &&
          !isProductGridIdShell(main)
        ) {
          /* keep main */
        } else {
          main = null;
        }
      }
    }
    return main || null;
  }

  /**
   * Off-canvas regression: sort-host was left as a sibling AFTER div.collection
   * with no .sf-toolbar. Force toolbar + sort above the product listing.
   */
  function ensureListingChromeAboveProducts(widget) {
    var main = resolveColumnMain(widget);
    if (!main) return null;
    if (main.classList) main.classList.add("sf-layout-main");

    var listing = firstListingChildInMain(main);
    var toolbar =
      (main.querySelector && main.querySelector(":scope > .sf-toolbar")) ||
      document.querySelector(".sf-toolbar");
    if (!toolbar) {
      toolbar = document.createElement("div");
      toolbar.className = "sf-toolbar";
    }

    var searchHost =
      toolbar.querySelector(".sf-search-host") ||
      document.querySelector(".sf-search-host");
    if (!searchHost) {
      searchHost = document.createElement("div");
      searchHost.className = "sf-search-host";
    }
    searchHost.classList.add("sf-toolbar-search");
    if (searchHost.parentNode !== toolbar) {
      toolbar.insertBefore(searchHost, toolbar.firstChild);
    }

    var end = toolbar.querySelector(".sf-toolbar-end");
    if (!end) {
      end = document.createElement("div");
      end.className = "sf-toolbar-end";
    }
    if (end.parentNode !== toolbar) toolbar.appendChild(end);

    var actions = end.querySelector(".sf-toolbar-actions");
    if (!actions) {
      actions = document.createElement("div");
      actions.className = "sf-toolbar-actions";
    }
    if (actions.parentNode !== end) end.insertBefore(actions, end.firstChild);

    var sortHost =
      actions.querySelector(".sf-sort-host") ||
      toolbar.querySelector(".sf-sort-host") ||
      (main.querySelector && main.querySelector(".sf-sort-host")) ||
      document.querySelector(".sf-sort-host");
    if (!sortHost) {
      sortHost = document.createElement("div");
      sortHost.className = "sf-sort-host";
    }
    if (sortHost.parentNode !== actions) actions.appendChild(sortHost);

    if (widget && widget.sortWrap && !widget.sortWrap.hidden) {
      widget.sortWrap.classList.add("sf-sort-toolbar");
      if (widget.sortWrap.parentNode !== sortHost) {
        sortHost.appendChild(widget.sortWrap);
      }
    }

    /* Product count must live under toolbar-end (not below the grid). */
    var countEl =
      end.querySelector(".sf-total-count") ||
      (main.querySelector && main.querySelector(".sf-total-count")) ||
      document.querySelector(".sf-total-count");
    if (!countEl) {
      countEl = document.createElement("div");
      countEl.className = "sf-total-count";
      countEl.setAttribute("data-sf-total-count", "");
    }
    if (countEl.parentNode !== end) end.appendChild(countEl);
    if (widget) {
      widget.totalCountEl = countEl;
      countEl.hidden = widget.showTotalProductCount === false;
    }

    /* Drop duplicate orphan hosts left after a prior bad placement. */
    var orphans = main.querySelectorAll
      ? main.querySelectorAll(
          ":scope > .sf-sort-host, :scope > .sf-search-host, :scope > .sf-total-count",
        )
      : [];
    var oi;
    for (oi = 0; oi < orphans.length; oi++) {
      if (
        orphans[oi] === sortHost ||
        orphans[oi] === searchHost ||
        orphans[oi] === countEl
      ) {
        continue;
      }
      if (toolbar.contains(orphans[oi])) continue;
      if (orphans[oi].parentNode) orphans[oi].parentNode.removeChild(orphans[oi]);
    }

    if (
      toolbar.parentNode !== main ||
      (listing && toolbar !== listing && toolbar.nextSibling !== listing)
    ) {
      if (!safeInsertBefore(main, toolbar, listing || main.firstChild)) {
        if (toolbar.parentNode !== main) main.insertBefore(toolbar, main.firstChild);
      }
    }

    placeMobileToolbarToggle(widget);
    return main;
  }

  function listingChromeIsMisplaced(main) {
    if (!main || !main.children) return false;
    var listing = firstListingChildInMain(main);
    var toolbar = main.querySelector && main.querySelector(":scope > .sf-toolbar");
    var orphanSort =
      main.querySelector && main.querySelector(":scope > .sf-sort-host");
    var orphanCount =
      main.querySelector && main.querySelector(":scope > .sf-total-count");
    /* Orphan sort/count after/beside .collection (off-canvas regression). */
    if (orphanSort || orphanCount) return true;
    if (!toolbar) {
      var sortAnywhere = main.querySelector && main.querySelector(".sf-sort-host");
      if (sortAnywhere && listing) {
        var pos = sortAnywhere.compareDocumentPosition(listing);
        /* listing precedes sort → sort is below products */
        if (pos & Node.DOCUMENT_POSITION_PRECEDING) return true;
      }
      return !!sortAnywhere;
    }
    if (listing) {
      var rel = toolbar.compareDocumentPosition(listing);
      /* listing precedes toolbar → sort/count render below products */
      if (rel & Node.DOCUMENT_POSITION_PRECEDING) return true;
    }
    /* Count exists but not inside the toolbar → below-grid bug. */
    var countAnywhere = main.querySelector && main.querySelector(".sf-total-count");
    if (countAnywhere && !toolbar.contains(countAnywhere)) return true;
    return false;
  }

  /**
   * Keep sort/count above products for ALL filter layouts (left/right/top/
   * offcanvas) when themes reshuffle DOM. Previously offcanvas-only.
   */
  function armListingChromeGuard(widget) {
    if (!widget) return;
    var main = resolveColumnMain(widget);
    if (!main) return;
    ensureListingChromeAboveProducts(widget);
    if (main.getAttribute && main.getAttribute("data-sf-chrome-guard") === "1") {
      return;
    }
    if (main.setAttribute) main.setAttribute("data-sf-chrome-guard", "1");
    var queued = 0;
    function reassert() {
      queued = 0;
      try {
        if (listingChromeIsMisplaced(main) || !main.querySelector(":scope > .sf-toolbar")) {
          ensureListingChromeAboveProducts(widget);
        }
      } catch (err) {
        /* guard is best-effort */
      }
    }
    function schedule() {
      if (queued) return;
      queued = 1;
      if (typeof requestAnimationFrame === "function") {
        requestAnimationFrame(reassert);
      } else {
        setTimeout(reassert, 0);
      }
    }
    if (typeof MutationObserver === "function") {
      try {
        var obs = new MutationObserver(schedule);
        obs.observe(main, { childList: true, subtree: true });
        widget._sfChromeGuardObs = obs;
      } catch (obsErr) {
        /* ignore */
      }
    }
    var ticks = 0;
    if (widget._sfChromeGuardTimer) {
      try {
        clearInterval(widget._sfChromeGuardTimer);
      } catch (clearErr) {
        /* ignore */
      }
    }
    widget._sfChromeGuardTimer = setInterval(function () {
      reassert();
      ticks += 1;
      if (ticks >= 40) {
        try {
          clearInterval(widget._sfChromeGuardTimer);
        } catch (doneErr) {
          /* ignore */
        }
        widget._sfChromeGuardTimer = 0;
      }
    }, 250);
  }

  /* Back-compat name — guard now covers all 4 layouts. */
  function armOffcanvasChromeGuard(widget) {
    return armListingChromeGuard(widget);
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
      /* Toolbar/sort must stay above the product listing. appendChild alone
         parked them below products (especially visible in off-canvas). */
      if (isLeadingListingChrome(node)) {
        var listing = firstListingChildInMain(main);
        if (!safeInsertBefore(main, node, listing)) {
          main.insertBefore(node, listing || main.firstChild);
        }
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
        ensureProductGridMounted(widget);
        return;
      }
      var stamped = layout.querySelectorAll(".sf-layout-main");
      var si;
      for (si = 0; si < stamped.length; si++) {
        if (
          isProductGridLike(stamped[si]) ||
          isThemeManagedGrid(stamped[si]) ||
          isProductGridIdShell(stamped[si]) ||
          isPageShellHost(stamped[si])
        ) {
          stamped[si].classList.remove("sf-layout-main");
          ensureBlockMain(stamped[si]);
        }
      }
      liftLayoutOutOfProductGrid(layout);
      normalizeLayoutShell(layout);
      liftSearchPageHeaderAboveLayout(layout, widget);
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
          safeInsertBefore(pageWidth, layout, child);
          var mainCol = layout.querySelector(".sf-layout-main");
          if (mainCol && !mainCol.contains(child)) mainCol.appendChild(child);
        }
      }
      normalizeLayoutShell(layout);
      liftSearchPageHeaderAboveLayout(layout, widget);
      flattenHorizonCollectionWrapper(layout);
      ensureProductGridMounted(widget);
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
      safeInsertBefore(existing, mount, existing.firstChild);
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
    /* If the width box is still the listing shell, peel first so layout can
       live inside the theme column instead of replacing it (full bleed). */
    if (listingCarriesThemeWidth(pageWidth)) {
      var peeledFit = peelListingThemeWidth(pageWidth);
      if (peeledFit) pageWidth = peeledFit;
    }
    if (!pageWidth || isProductGridLike(pageWidth) || listingCarriesThemeWidth(pageWidth)) {
      normalizeLayoutShell(layout);
      liftSearchPageHeaderAboveLayout(layout, widget);
      return;
    }
    if (pageWidth.contains(layout) && layout !== pageWidth) {
      normalizeLayoutShell(layout);
      liftSearchPageHeaderAboveLayout(layout, widget);
      return;
    }

    if (layout.contains(pageWidth)) {
      var parent = layout.parentNode;
      if (!parent) return;
      var mainCol = layout.querySelector(".sf-layout-main");
      if (!mainCol) {
        mainCol = document.createElement("div");
        mainCol.className = "sf-layout-main";
        layout.appendChild(mainCol);
      }
      /* Extract width shell, keep its listing children, then nest layout
         inside it so theme max-width wraps filter + grid (not full bleed). */
      safeInsertBefore(parent, pageWidth, layout);
      if (pageWidth.classList) pageWidth.classList.remove("sf-layout-main");
      while (pageWidth.firstChild) {
        var widthChild = pageWidth.firstChild;
        if (widthChild === layout) break;
        mainCol.appendChild(widthChild);
      }
      pageWidth.appendChild(layout);
      var aside =
        layout.querySelector(".sf-layout-aside") ||
        (widget && widget.root);
      if (aside && aside.parentNode === layout && layout.firstChild !== aside) {
        safeInsertBefore(layout, aside, layout.firstChild);
      }
      normalizeLayoutShell(layout);
      liftSearchPageHeaderAboveLayout(layout, widget);
      return;
    }

    var child = themeWidthChildContaining(pageWidth, grid);
    if (child && child.parentNode === pageWidth && !isThemeWidthContainer(child)) {
      safeInsertBefore(pageWidth, layout, child);
      var mainCol = layout.querySelector(".sf-layout-main");
      if (mainCol && !mainCol.contains(child) && child.parentNode === pageWidth) {
        mainCol.appendChild(child);
      } else if (!mainCol) {
        var wrapped = ensureBlockMain(child);
        if (wrapped.parentNode !== layout) layout.appendChild(wrapped);
      }
      normalizeLayoutShell(layout);
      liftSearchPageHeaderAboveLayout(layout, widget);
      return;
    }
    var slot = pageWidth.querySelector(
      "#product-grid, #ProductGrid, ul.product-grid, ol.product-grid, .main-collection-grid, .sf-app-grid",
    );
    var before = themeWidthChildContaining(pageWidth, slot) || pageWidth.firstChild;
    if (before && before.parentNode === pageWidth) {
      safeInsertBefore(pageWidth, layout, before);
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
    liftSearchPageHeaderAboveLayout(layout, widget);
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
    if (!safeInsertBefore(parent, wrapper, el)) parent.appendChild(wrapper);
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

  /* One product link = a card. Two or more sibling cards = that theme's grid,
     whatever class names it uses. Dawn/Horizon still match the selectors above. */
  function uniqueProductHandleCount(el) {
    if (!el || !el.querySelectorAll) return 0;
    var links = el.querySelectorAll('a[href*="/products/"]');
    var seen = {};
    var n = 0;
    var i;
    for (i = 0; i < links.length; i++) {
      if (isSkippedCardRegion(links[i])) continue;
      var handle = handleFromHref(links[i].getAttribute("href"));
      if (!handle || seen[handle]) continue;
      seen[handle] = true;
      n += 1;
      if (n > 1) return n;
    }
    return n;
  }

  function firstProductHandle(el) {
    if (!el || !el.querySelectorAll) return "";
    var links = el.querySelectorAll('a[href*="/products/"]');
    var i;
    for (i = 0; i < links.length; i++) {
      if (isSkippedCardRegion(links[i])) continue;
      var handle = handleFromHref(links[i].getAttribute("href"));
      if (handle) return handle;
    }
    return "";
  }

  function repeatedDistinctProductCards(el) {
    if (!el || !el.children) return 0;
    var seen = {};
    var n = 0;
    var i;
    for (i = 0; i < el.children.length; i++) {
      var child = el.children[i];
      if (!child || child.nodeType !== 1 || isSkippedCardRegion(child)) continue;
      if (isGridChrome(child)) continue;
      if (uniqueProductHandleCount(child) !== 1) continue;
      var handle = firstProductHandle(child);
      if (!handle || seen[handle]) continue;
      seen[handle] = true;
      n += 1;
    }
    return n;
  }

  function insideDawnListing(el) {
    if (!el || !el.closest) return false;
    try {
      return Boolean(
        el.closest(
          "#product-grid, .product-grid, #ProductGridContainer, #CollectionProductGrid, results-list, .main-collection-grid, .product-grid-container",
        ),
      );
    } catch (err) {
      return false;
    }
  }

  function isDawnLikeGrid(el) {
    if (!el || el.nodeType !== 1) return false;
    if (isResultsListEl(el) || isGridHostEl(el)) return true;
    if (
      el.id === "product-grid" ||
      el.id === "ProductGrid" ||
      el.id === "ProductGridContainer" ||
      el.id === "CollectionProductGrid"
    ) {
      return true;
    }
    var cls = el.classList;
    return Boolean(
      cls &&
        (cls.contains("product-grid") ||
          cls.contains("main-collection-grid") ||
          cls.contains("product-grid-container")),
    );
  }

  function findRepeatedCardGrid(el, depth) {
    if (!el || el.nodeType !== 1 || depth > 8 || isSkippedCardRegion(el)) return null;
    if (isDawnLikeGrid(el) || insideDawnListing(el)) return null;
    if (repeatedDistinctProductCards(el) >= 2) return el;
    var kids = el.children;
    if (!kids) return null;
    var i;
    for (i = 0; i < kids.length; i++) {
      var found = findRepeatedCardGrid(kids[i], depth + 1);
      if (found) return found;
    }
    return null;
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
      if (cls.contains("ko-grid")) return true;
    }
    if (isResultsListEl(el) || isGridHostEl(el)) return true;
    if (
      tag !== "article" &&
      tag !== "li" &&
      tag !== "a" &&
      !insideDawnListing(el) &&
      repeatedDistinctProductCards(el) >= 2
    ) {
      return true;
    }
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
      if (el.classList.contains("pcard")) return true;
    }
    if (isSkippedCardRegion(el) || insideDawnListing(el) || uniqueProductHandleCount(el) !== 1) return false;
    var parent = el.parentElement;
    if (!parent || isSkippedCardRegion(parent) || isDawnLikeGrid(parent) || insideDawnListing(parent)) return false;
    return repeatedDistinctProductCards(parent) >= 2;
  }

  var OUTER_CARD_SEL =
    "product-card, product-item, grid-item, li.grid__item, li.product-grid__item, " +
    ".grid__item, .product-grid__item, .product-card, .product-item, .grid-product, " +
    ".grid-view-item, .product-block, .productitem, article.pcard, .pcard, .sf-app-card";

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
      if (el.parentNode === parent) safeInsertBefore(parent, holder, el);
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
    if (chrome && el !== chrome) safeInsertBefore(parent, el, chrome);
    else if (el.parentNode !== parent) parent.appendChild(el);
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

  /** True when el owns Findly listing chrome (search/sort) — never busy-paint it. */
  function containsFindlyListingChrome(el) {
    if (!el || !el.querySelector) return false;
    try {
      if (el.querySelector(":scope > .sf-toolbar, :scope > .sf-sort-host, :scope > .sf-search-host, :scope > .sf-total-count")) {
        return true;
      }
      if (el.classList && el.classList.contains("sf-toolbar")) return true;
      return Boolean(el.querySelector(".sf-toolbar"));
    } catch (err) {
      return Boolean(el.querySelector(".sf-toolbar, .sf-sort-host, .sf-total-count"));
    }
  }

  /** Prefer a card-grid / ProductGridContainer that does not wrap Findly chrome. */
  function narrowBusyHost(el) {
    if (!el || !el.querySelector) return el && !isTooWideBusyHost(el) ? el : null;
    if (!containsFindlyListingChrome(el) && !isTooWideBusyHost(el) && matchesBusyHost(el)) {
      return el;
    }
    var inner =
      el.querySelector(".main-collection-grid") ||
      el.querySelector("ul#product-grid, ol#product-grid, ul#ProductGrid, ol#ProductGrid") ||
      el.querySelector("ul.product-grid, ol.product-grid") ||
      el.querySelector(".sf-app-grid") ||
      el.querySelector("#ProductGridContainer #product-grid, #ProductGridContainer .product-grid") ||
      el.querySelector("#product-grid") ||
      el.querySelector(".product-grid");
    if (inner && !isTooWideBusyHost(inner) && !containsFindlyListingChrome(inner)) {
      return inner;
    }
    var shell =
      el.querySelector("#ProductGridContainer") ||
      el.querySelector("#CollectionProductGrid") ||
      el.querySelector(".product-grid-container");
    if (
      shell &&
      !containsFindlyListingChrome(shell) &&
      !isTooWideBusyHost(shell)
    ) {
      return shell;
    }
    if (!containsFindlyListingChrome(el) && !isTooWideBusyHost(el)) return el;
    return null;
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
    /* Column main that holds toolbar+listing — busy must target the grid only. */
    if (
      el.classList &&
      el.classList.contains("sf-layout-main") &&
      !matchesBusyHost(el) &&
      containsFindlyListingChrome(el)
    ) {
      return true;
    }
    if (containsFindlyListingChrome(el) && !matchesBusyHost(el)) {
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
      if (matchesBusyHost(node) && !containsFindlyListingChrome(node)) {
        found = node;
      }
    }
    if (found) return found;
    if (el) {
      var narrowed = narrowBusyHost(el);
      if (narrowed) return narrowed;
    }
    if (el && !isTooWideBusyHost(el) && !containsFindlyListingChrome(el)) {
      return el;
    }
    return null;
  }

  function isBusyPainted() {
    if (
      document.querySelector(
        "[data-findly-theme-loading='1'], [data-findly-theme-loader='1'], .findly-grid-is-busy, [data-findly-skel-host='1']",
      )
    ) {
      return true;
    }
    var skels = document.querySelectorAll("[" + SKEL_ATTR + "='1']");
    var i;
    for (i = 0; i < skels.length; i++) {
      var parent = skels[i].parentElement;
      if (!parent || isTooWideBusyHost(parent)) continue;
      if (matchesBusyHost(parent) || parent.getAttribute("data-findly-skel-host") === "1") {
        return true;
      }
    }
    return false;
  }

  var THEME_LOADER_SELECTOR =
    ".loading-overlay, .loading-overlay--sticky, [data-loading-overlay]," +
    " .collection__loading, .collection-loading, .ajax-loading, .facets-loading";

  function findThemeLoadingOverlay(host) {
    var scopes = [];
    if (host && host.nodeType === 1) {
      scopes.push(host);
      if (host.parentElement) scopes.push(host.parentElement);
      try {
        var shell =
          (host.closest &&
            (host.closest("#ProductGridContainer") ||
              host.closest("#CollectionProductGrid") ||
              host.closest("#CollectionAjaxContent") ||
              host.closest(".product-grid-container") ||
              host.closest(".collection") ||
              host.closest("results-list"))) ||
          null;
        if (shell) scopes.push(shell);
      } catch (err) {
        /* ignore */
      }
    }
    scopes.push(document);
    var i;
    var j;
    for (i = 0; i < scopes.length; i++) {
      var scope = scopes[i];
      if (!scope || !scope.querySelectorAll) continue;
      var nodes = scope.querySelectorAll(THEME_LOADER_SELECTOR);
      for (j = 0; j < nodes.length; j++) {
        var el = nodes[j];
        if (
          el.closest &&
          el.closest(
            "header, footer, .header, .footer, predictive-search, .predictive-search, cart-drawer, #CartDrawer",
          )
        ) {
          continue;
        }
        return el;
      }
    }
    return null;
  }

  function findThemeLoadingContainer(host, overlay) {
    var candidates = [];
    if (overlay && overlay.parentElement && overlay.parentElement.nodeType === 1) {
      candidates.push(overlay.parentElement);
    }
    if (host && host.closest) {
      candidates.push(
        host.closest("#ProductGridContainer"),
        host.closest("#CollectionProductGrid"),
        host.closest("#CollectionAjaxContent"),
        host.closest(".product-grid-container"),
        host.closest(".collection"),
        host.closest("results-list"),
        host,
      );
    }
    var i;
    for (i = 0; i < candidates.length; i++) {
      var c = candidates[i];
      if (!c || c.nodeType !== 1) continue;
      /* Never mark a node that owns Findly search/sort — theme overlay blanks chrome. */
      if (containsFindlyListingChrome(c)) continue;
      if (isTooWideBusyHost(c) && !matchesBusyHost(c)) continue;
      return c;
    }
    /* Overlay parent had chrome — try a nested grid shell under it. */
    var scope =
      (overlay && overlay.parentElement) || host || null;
    if (scope && scope.querySelector) {
      var nested =
        scope.querySelector("#ProductGridContainer") ||
        scope.querySelector("#CollectionProductGrid") ||
        scope.querySelector(".product-grid-container") ||
        scope.querySelector("ul#product-grid, ol#product-grid, ul.product-grid");
      if (
        nested &&
        !containsFindlyListingChrome(nested) &&
        !(isTooWideBusyHost(nested) && !matchesBusyHost(nested))
      ) {
        return nested;
      }
    }
    return null;
  }

  function rememberThemeLoaderPrev(el) {
    if (!el || el.hasAttribute("data-findly-theme-loader-prev")) return;
    if (el.hasAttribute("hidden")) {
      el.setAttribute("data-findly-theme-loader-prev", "hidden");
      return;
    }
    if (el.classList && el.classList.contains("hidden")) {
      el.setAttribute("data-findly-theme-loader-prev", "class-hidden");
      return;
    }
    try {
      if (el.style && String(el.style.display || "") === "none") {
        el.setAttribute("data-findly-theme-loader-prev", "display-none");
        return;
      }
    } catch (err) {
      /* ignore */
    }
    el.setAttribute("data-findly-theme-loader-prev", "visible");
  }

  function restoreThemeLoaderPrev(el) {
    if (!el) return;
    var prev = el.getAttribute("data-findly-theme-loader-prev") || "";
    el.removeAttribute("data-findly-theme-loader");
    el.removeAttribute("data-findly-theme-loader-prev");
    if (prev === "hidden") {
      el.setAttribute("hidden", "");
      return;
    }
    if (prev === "class-hidden") {
      if (el.classList) el.classList.add("hidden");
      return;
    }
    if (prev === "display-none") {
      try {
        el.style.display = "none";
      } catch (err) {
        /* ignore */
      }
      return;
    }
    if (prev === "visible") return;
    /* Dawn default idle state when we could not snapshot. */
    if (el.classList) el.classList.add("hidden");
  }

  /**
   * Prefer the theme's native loading overlay / .loading class when present so
   * search/filter fetches keep the merchant default spinner instead of Findly
   * card skeletons. Returns true when theme UI was activated.
   */
  function setThemeGridLoading(host, on) {
    if (!on) {
      var loaders = document.querySelectorAll("[data-findly-theme-loader='1']");
      var i;
      for (i = 0; i < loaders.length; i++) restoreThemeLoaderPrev(loaders[i]);
      var containers = document.querySelectorAll("[data-findly-theme-loading='1']");
      for (i = 0; i < containers.length; i++) {
        var c = containers[i];
        if (c.classList) {
          c.classList.remove("loading");
          c.classList.remove("is-loading");
        }
        c.removeAttribute("aria-busy");
        c.removeAttribute("data-findly-theme-loading");
      }
      return false;
    }

    var overlay = findThemeLoadingOverlay(host);
    var container = findThemeLoadingContainer(host, overlay);
    if (!overlay && !container) return false;
    /* If theme overlay's parent still owns Findly chrome, skip theme path —
       Findly grid busy will target the card grid only. */
    if (container && containsFindlyListingChrome(container)) {
      container = null;
    }
    /*
     * Dawn .loading-overlay is often a child of .collection. If that same
     * .collection now also holds .sf-toolbar, forcing the overlay visible
     * blanks search/sort even when we mark a nested #ProductGridContainer.
     * Only use the theme overlay when it lives inside a chrome-free container.
     */
    if (overlay) {
      var overlayParent = overlay.parentElement;
      var overlayCoversChrome =
        (overlayParent && containsFindlyListingChrome(overlayParent)) ||
        (container &&
          overlayParent &&
          overlayParent !== container &&
          !container.contains(overlay) &&
          containsFindlyListingChrome(overlayParent));
      if (overlayCoversChrome) {
        return false;
      }
    }
    if (!container) return false;
    /* Require a real overlay OR a known theme grid shell — avoid marking
       arbitrary nodes with .loading on themes that have no loader markup. */
    var shellOk =
      isPageShellHost(container) ||
      matchesBusyHost(container) ||
      (container.id &&
        /ProductGrid|CollectionProduct|CollectionAjax/i.test(container.id)) ||
      (container.classList &&
        (container.classList.contains("product-grid-container") ||
          container.classList.contains("collection") ||
          container.classList.contains("loading-overlay"))) ||
      overlay;
    if (!shellOk) return false;

    if (overlay) {
      rememberThemeLoaderPrev(overlay);
      overlay.removeAttribute("hidden");
      if (overlay.classList) overlay.classList.remove("hidden");
      try {
        if (overlay.style && overlay.style.display === "none") {
          overlay.style.display = "";
        }
      } catch (err) {
        /* ignore */
      }
      overlay.setAttribute("data-findly-theme-loader", "1");
    }
    if (container.classList) {
      container.classList.add("loading");
      container.classList.add("is-loading");
    }
    container.setAttribute("aria-busy", "true");
    container.setAttribute("data-findly-theme-loading", "1");
    return true;
  }

  function customProductGridFromRoot() {
    var root =
      document.getElementById("smart-filter-root") ||
      document.getElementById("smart-filter-embed");
    if (!root || !root.getAttribute) return null;
    var sel = String(root.getAttribute("data-product-grid-selector") || "").trim();
    if (!sel) return null;
    try {
      var el = document.querySelector(sel);
      if (el && el.nodeType === 1 && !isTooWideBusyHost(el)) return el;
    } catch (err) {
      /* invalid merchant selector */
    }
    return null;
  }

  function discoverBusyHost(hint) {
    var parent =
      hint ||
      customProductGridFromRoot() ||
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

  function armLoadingRelease() {
    if (window.__findlyLoadingRelease) {
      window.clearTimeout(window.__findlyLoadingRelease);
    }
    window.__findlyLoadingRelease = window.setTimeout(function () {
      window.__findlyLoadingRelease = 0;
      window.__FINDLY_LOADING_SETTLED = true;
      var busy = document.querySelectorAll(".findly-grid-is-busy");
      var i;
      for (i = 0; i < busy.length; i++) {
        busy[i].classList.remove("findly-grid-is-busy");
        busy[i].removeAttribute("aria-busy");
        busy[i].removeAttribute("data-findly-skel-host");
      }
      var overlay = document.getElementById("findly-grid-busy-overlay");
      if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
      setFilterLoading(false);
    }, 3000);
  }

  function setFilterLoading(on) {
    var root = document.documentElement;
    if (!root || !root.classList) return;
    var isOn = root.classList.contains("sf-filter-loading");
    var isReady = root.classList.contains("sf-filter-ready");
    /* No-op when state already matches — avoids class thrash that blinks the grid. */
    if (on) {
      if (storefrontV2()) armLoadingRelease();
      if (isOn && !isReady) {
        syncToolbarLoading(true);
        return;
      }
      root.classList.add("sf-filter-loading");
      root.classList.remove("sf-filter-ready");
    } else {
      if (window.__findlyLoadingRelease) {
        window.clearTimeout(window.__findlyLoadingRelease);
        window.__findlyLoadingRelease = 0;
      }
      if (!isOn && isReady) {
        syncToolbarLoading(false);
        return;
      }
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
      var wasBusy =
        isFilterLoading() ||
        isBusyPainted() ||
        Boolean(document.querySelector(".findly-grid-is-busy")) ||
        Boolean(document.getElementById("findly-grid-busy-overlay"));
      if (!wasBusy) {
        /* Never entered busy on this cycle (idle reload with deferred busy) —
           skip skeleton clear + forceCardVisible which re-paints every card. */
        setFilterLoading(false);
        return;
      }
      setThemeGridLoading(host, false);
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
    if (host && containsFindlyListingChrome(host)) {
      host = narrowBusyHost(host) || discoverBusyHost(host);
    }
    /* Prefer theme-native loader when present (any theme with .loading-overlay /
       .is-loading markup) — still keep sf-filter-loading so Liquid cards stay
       hidden on every theme until settle (avoids blink under the spinner). */
    if (setThemeGridLoading(host, true)) {
      removeBusyOverlay();
      try {
        clearGridSkeletons(host);
      } catch (skelClearErr) {
        /* ignore */
      }
      var staleTheme = document.querySelectorAll(".findly-grid-is-busy");
      var st;
      for (st = 0; st < staleTheme.length; st++) {
        staleTheme[st].classList.remove("findly-grid-is-busy");
        staleTheme[st].removeAttribute("data-findly-skel-host");
      }
      setFilterLoading(true);
      return;
    }
    if (!host) {
      setFilterLoading(true);
      return;
    }
    if (containsFindlyListingChrome(host)) {
      host = narrowBusyHost(host);
      if (!host) {
        setFilterLoading(true);
        return;
      }
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
    /* First paint: keep loading gate + skeletons until Widget reveals once.
       Only skip when already ready AND no busy UI (post-settle). */
    var root = document.documentElement;
    if (
      root &&
      root.classList &&
      root.classList.contains("sf-filter-ready") &&
      !root.classList.contains("sf-filter-loading") &&
      !isBusyPainted()
    ) {
      return;
    }
    setFilterLoading(true);
    var host = discoverBusyHost();
    if (host) {
      paintGridBusy(host, true);
      return;
    }
    if (isBusyPainted()) {
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

  /**
   * Hide listing cards in the host when filtered results are empty.
   * Uses collectTrayAndGridCards (theme-agnostic) — does not invent Dawn/Horizon
   * selectors and does not hide nested product-grid shells or Findly chrome.
   */
  function hideAllListingCardsInHost(parent) {
    if (!parent) return;
    var cards = collectTrayAndGridCards(parent);
    var i;
    for (i = 0; i < cards.length; i++) {
      if (!cards[i] || !cards[i].el) continue;
      hideEl(cards[i].el);
    }
    /* App-grid fallback cards (may lack a parseable handle on some themes). */
    if (!parent.querySelectorAll) return;
    var apps = parent.querySelectorAll(".sf-app-card");
    for (i = 0; i < apps.length; i++) {
      if (
        apps[i].closest &&
        apps[i].closest(".sf-grid-empty, #" + EMPTY_ID)
      ) {
        continue;
      }
      hideEl(apps[i]);
    }
  }

  function syncGridEmptyState(widget, parent, handles, shownCount) {
    var emptyEl = document.getElementById(EMPTY_ID);
    var filtering =
      widget && widget.hasActiveFilters && widget.hasActiveFilters();
    var none =
      Boolean(filtering) && Array.isArray(handles) && handles.length === 0;
    if (Array.isArray(handles) && handles.length && shownCount === 0) {
      none = false;
    }
    if (!none) {
      /* Same removal as before. Do not wait for the busy overlay: it is still
         up during this paint and comes down immediately after, so waiting left
         the empty lock in place after Clear. Showing a new empty message below
         still waits. */
      if (parent && parent.classList) parent.classList.remove("sf-grid-is-empty");
      if (emptyEl && emptyEl.parentNode) emptyEl.parentNode.removeChild(emptyEl);
      return;
    }
    if (isBusyPainted() || (widget && widget._importingCards)) return;
    if (!parent) return;
    /* Hide leftover cards in place. Do not stripAppCards — that drops
       .sf-app-grid and can remount cached cards over the empty state. */
    if (parent.classList) parent.classList.add("sf-grid-is-empty");
    hideAllListingCardsInHost(parent);
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
    emptyEl.hidden = false;
    emptyEl.removeAttribute("data-smart-filter-hidden");
    if (emptyEl.style) emptyEl.style.removeProperty("display");
    showEl(emptyEl);
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
    /* Hard stop — never rewrite color-swatch imgs (any theme). */
    if (img.getAttribute("data-sf-swatch-lock") === "1") return;
    if (typeof isThemeCardSwatchByMarkup === "function" && isThemeCardSwatchByMarkup(img)) {
      return;
    }
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

  /**
   * Media wrappers across common Shopify themes (Dawn, Horizon, Impulse,
   * Prestige, Warehouse, Focal, Debut, Brooklyn, custom sf-* themes, etc.).
   * Not Dawn-only — used only as a hint for where product photos live.
   */
  var THEME_CARD_MEDIA_SELECTOR =
    ".card__media, .card-media, .card__media-wrapper, .media-wrapper," +
    " .product-card__image, .product-card__media, .product-card-media," +
    " .product-card__figure, .product-item__image, .product-item__image-wrapper," +
    " .grid-view-item__image, .product-block__image, .productitem--image," +
    " .product-image, .product__media, .product-media, .image-wrap," +
    " .card__img, .product-card-image, [class*='card__media']," +
    " [class*='product-card__image'], [class*='product-item__image']," +
    " [class*='product-image'], .media";

  /*
   * Includes SoFetch / custom themes: .color-swatch, .color-swatch-circle,
   * .product-color-swatches, .product-option-values (verified on storefront).
   */
  var THEME_CARD_SWATCH_SELECTOR =
    ".swatch, .swatches, .swatch-element, .swatch-list, .swatch-wrapper," +
    " .color-swatch, .color-swatches, .color-swatch-circle," +
    " .product-color-swatches, .product-option-values," +
    " .color-list, .colors, .colours," +
    " .product-colors, .product-colours, .product-card__swatch," +
    " .product-card-swatches, .product-card__colors, .product-item__swatch," +
    " .product-item__swatches, .product-block__swatch, .variant-swatch," +
    " .option-swatch, .option-colors, .sf-app-card-swatch," +
    " .sf-app-card-swatches, .product-form__input--swatch," +
    " [class*='swatch'], [class*='Swatch'], [class*='color-swatch']," +
    " [data-swatch], [data-option-swatch], [data-color-swatch]," +
    " [data-variant-swatch]";

  /* Build marker for console: window.__FINDLY_SWATCH_GUARD === 7 */
  try {
    window.__FINDLY_SWATCH_GUARD = 7;
    /* Tear down v5/v6 document MutationObserver if a prior bundle left it running. */
    if (window.__FINDLY_SWATCH_OBS && window.__FINDLY_SWATCH_OBS.disconnect) {
      window.__FINDLY_SWATCH_OBS.disconnect();
      window.__FINDLY_SWATCH_OBS = null;
    }
  } catch (err) {
    /* ignore */
  }

  function themeCardHasMediaHint(img, mediaRoot) {
    return Boolean(mediaRoot && mediaRoot.contains && mediaRoot.contains(img));
  }

  /** Prefer a media node that does not wrap color swatches. */
  function themeCardMediaRoot(card) {
    if (!card || !card.querySelectorAll) return null;
    var nodes;
    try {
      nodes = card.querySelectorAll(THEME_CARD_MEDIA_SELECTOR);
    } catch (err) {
      return null;
    }
    if (!nodes || !nodes.length) return null;
    var fallback = nodes[0];
    var i;
    for (i = 0; i < nodes.length; i++) {
      var hasSwatch = false;
      try {
        hasSwatch = Boolean(nodes[i].querySelector(THEME_CARD_SWATCH_SELECTOR));
      } catch (err2) {
        hasSwatch = false;
      }
      if (!hasSwatch) return nodes[i];
    }
    return fallback;
  }

  /**
   * Tiny chip heuristic — only for imgs outside product media so we never
   * skip a main/hover photo that uses small width/height attrs or LQIP.
   */
  function isThemeCardSwatchBySize(img) {
    if (!img) return false;
    var w =
      Number(img.getAttribute("width")) ||
      Number(img.getAttribute("data-width")) ||
      0;
    var h =
      Number(img.getAttribute("height")) ||
      Number(img.getAttribute("data-height")) ||
      0;
    if ((w > 0 && w <= 96) || (h > 0 && h <= 96)) return true;
    var cw = img.clientWidth || 0;
    var ch = img.clientHeight || 0;
    if ((cw > 0 && cw <= 48) || (ch > 0 && ch <= 48)) return true;
    return false;
  }

  function isThemeCardSwatchByMarkup(img) {
    if (!img || img.nodeType !== 1) return false;
    var className = String(img.className || "");
    if (
      /swatch|color[-_]?dot|color[-_]?chip|colour[-_]?chip|option[-_]?color|variant[-_]?color/i.test(
        className,
      )
    ) {
      return true;
    }
    if (
      img.getAttribute("data-swatch") != null ||
      img.getAttribute("data-option-swatch") != null ||
      img.getAttribute("data-color-swatch") != null ||
      img.getAttribute("data-variant-swatch") != null
    ) {
      return true;
    }
    if (!img.closest) return false;
    try {
      if (img.closest(THEME_CARD_SWATCH_SELECTOR)) return true;
      if (img.closest("[role='radiogroup']")) return true;
    } catch (err) {
      /* ignore unsupported selectors */
    }
    var parent = img.parentElement;
    var depth = 0;
    while (parent && depth < 4) {
      var pClass = String(parent.className || "");
      var pId = String(parent.id || "");
      var hint = pClass + " " + pId;
      if (
        /swatch/i.test(hint) ||
        /(^|[\s_-])(colors|colours)([\s_-]|$)/i.test(hint) ||
        /(color|colour)[-_]?(swatch|chip|dot|option|list|picker|circle)/i.test(
          hint,
        ) ||
        /(^|[\s_-])(sf-color|js-color)([\s_-]|$)/i.test(hint)
      ) {
        if (
          !/(product[-_]?image|card[-_]?media|media[-_]?wrapper|featured[-_]?image)/i.test(
            pClass,
          )
        ) {
          return true;
        }
      }
      parent = parent.parentElement;
      depth += 1;
    }
    return false;
  }

  /* Hooks for smart-filter.js applyVariantImages (must stay in companion — schema JS is at 100 KB). */
  try {
    window.__FINDLY_SKIP_CARD_IMG = function (img) {
      return isThemeCardSwatchByMarkup(img);
    };
    window.__FINDLY_FIRST_CARD_IMG = function (card) {
      if (!card || !card.querySelectorAll) return null;
      var imgs = card.querySelectorAll("img");
      var i;
      for (i = 0; i < imgs.length; i++) {
        if (isThemeCardSwatchByMarkup(imgs[i])) continue;
        return imgs[i];
      }
      return null;
    };
  } catch (errHook) {
    /* ignore */
  }

  /**
   * Color/option swatch img on any theme. Product media imgs must stay false
   * so filter/sort remapping still updates main + hover photos as before.
   */
  function isThemeCardSwatchImage(img, mediaRoot) {
    if (!img || img.nodeType !== 1) return false;
    if (isThemeCardSwatchByMarkup(img)) return true;
    if (!isThemeCardSwatchBySize(img)) return false;
    /* Outside media: any tiny img is a chip/icon — safe to skip. */
    if (!themeCardHasMediaHint(img, mediaRoot)) return true;
    /*
     * Inside media: skip tiny imgs only when a normal product photo peer exists.
     * Avoids skipping a lone LQIP/main img that uses small width attrs.
     */
    if (!mediaRoot || !mediaRoot.querySelectorAll) return false;
    var peers = mediaRoot.querySelectorAll("img");
    var i;
    for (i = 0; i < peers.length; i++) {
      if (peers[i] === img) continue;
      if (isThemeCardSwatchByMarkup(peers[i])) continue;
      if (!isThemeCardSwatchBySize(peers[i])) return true;
    }
    return false;
  }

  /**
   * Same behavior as painting every card img, minus color-swatch imgs.
   * Prefer media-scoped imgs when a media node exists (avoids title-row icons);
   * otherwise walk the whole card like the original implementation.
   */
  function themeCardProductImages(card) {
    if (!card || !card.querySelectorAll) return [];
    var media = themeCardMediaRoot(card);
    var scope = media || card;
    var imgs = scope.querySelectorAll("img");
    var out = [];
    var i;
    for (i = 0; i < imgs.length; i++) {
      if (isThemeCardSwatchByMarkup(imgs[i])) continue;
      if (isThemeCardSwatchImage(imgs[i], media)) continue;
      out.push(imgs[i]);
    }
    /* Media matched but yielded nothing usable — fall back to full-card walk. */
    if (!out.length && media) {
      imgs = card.querySelectorAll("img");
      for (i = 0; i < imgs.length; i++) {
        if (isThemeCardSwatchByMarkup(imgs[i])) continue;
        if (isThemeCardSwatchImage(imgs[i], null)) continue;
        out.push(imgs[i]);
      }
    }
    return out;
  }

  function absolutizeThemeCardUrl(url) {
    var raw = String(url || "").trim();
    if (!raw) return "";
    if (raw.indexOf("//") === 0) return "https:" + raw;
    return raw;
  }

  function restoreOneThemeCardSwatchImage(img) {
    if (!img) return false;
    var orig = absolutizeThemeCardUrl(img.getAttribute("data-sf-orig-src") || "");
    if (!orig) return false;
    var cur = absolutizeThemeCardUrl(
      img.getAttribute("src") || img.currentSrc || "",
    );
    var origKey = shopifyImageKey(orig);
    var curKey = shopifyImageKey(cur);
    /* Already restored — avoid no-op writes that retrigger observers/layout. */
    if (origKey && curKey && origKey === curKey) {
      if (img.getAttribute("data-sf-swatch-lock") !== "1") {
        img.setAttribute("data-sf-swatch-lock", "1");
      }
      return false;
    }
    var origSet = String(img.getAttribute("data-sf-orig-srcset") || "").trim();
    /* Clear product srcset first — otherwise currentSrc keeps the featured image. */
    img.removeAttribute("srcset");
    try {
      img.srcset = "";
    } catch (err) {
      /* ignore */
    }
    if (origSet) {
      img.setAttribute(
        "srcset",
        origSet.replace(/(^|[\s,])\/\//g, "$1https://"),
      );
    }
    img.setAttribute("src", orig);
    try {
      img.src = orig;
    } catch (err2) {
      /* ignore */
    }
    img.setAttribute("data-sf-swatch-lock", "1");
    return true;
  }

  /**
   * Restore color-swatch imgs previously overwritten (data-sf-orig-src).
   * Forced for known swatch containers — do not rely on size alone.
   */
  function restoreThemeCardSwatchImages(card) {
    if (!card || !card.querySelectorAll) return;
    var imgs = card.querySelectorAll("img[data-sf-orig-src]");
    var i;
    for (i = 0; i < imgs.length; i++) {
      if (!isThemeCardSwatchByMarkup(imgs[i]) && !isThemeCardSwatchImage(imgs[i], null)) {
        continue;
      }
      restoreOneThemeCardSwatchImage(imgs[i]);
    }
  }

  /** After a grid pass, repair any already-painted swatch imgs in scope. */
  function restoreAllThemeCardSwatchImages(root) {
    var scope = root || document;
    if (!scope.querySelectorAll) return;
    var imgs = scope.querySelectorAll("img[data-sf-orig-src]");
    var i;
    for (i = 0; i < imgs.length; i++) {
      if (!isThemeCardSwatchByMarkup(imgs[i]) && !isThemeCardSwatchImage(imgs[i], null)) {
        continue;
      }
      restoreOneThemeCardSwatchImage(imgs[i]);
    }
    /*
     * Hard pass: any overwritten img under a swatch container (all themes).
     * Uses the shared selector list — not Dawn/Horizon-only.
     */
    var forced;
    try {
      forced = scope.querySelectorAll("img[data-sf-orig-src]");
    } catch (err) {
      forced = [];
    }
    for (i = 0; i < forced.length; i++) {
      if (!isThemeCardSwatchByMarkup(forced[i])) continue;
      restoreOneThemeCardSwatchImage(forced[i]);
    }
  }

  function firstNonSwatchCardImage(card) {
    if (!card || !card.querySelectorAll) return null;
    if (window.__FINDLY_FIRST_CARD_IMG) {
      try {
        var hooked = window.__FINDLY_FIRST_CARD_IMG(card);
        if (hooked) return hooked;
      } catch (err) {
        /* ignore */
      }
    }
    var imgs = card.querySelectorAll("img");
    var j;
    for (j = 0; j < imgs.length; j++) {
      if (isThemeCardSwatchByMarkup(imgs[j])) continue;
      if (isThemeCardSwatchBySize(imgs[j]) && !themeCardMediaRoot(card)) {
        /* Tiny imgs outside media are chips on most themes. */
        continue;
      }
      return imgs[j];
    }
    return null;
  }

  /**
   * smart-filter.js applyVariantImages uses card.querySelector("img"), which on
   * some themes is a color swatch (DOM order). Undo that and paint the real
   * product photo — same behavior as before, minus swatch damage.
   */
  function repairVariantImagesAfterGrid(widget, root) {
    var scope = root || (widget && widget._gridParent) || document;
    restoreAllThemeCardSwatchImages(scope);
    if (!widget || widget.showMatchingVariantImage === false) return;
    var products = widget._lastProducts || [];
    if (
      widget._lastFilterData &&
      widget._lastFilterData.products &&
      widget._lastFilterData.products.length
    ) {
      products = widget._lastFilterData.products;
    }
    if (!products.length || !scope.querySelectorAll) return;
    var byKey = {};
    var p;
    for (p = 0; p < products.length; p++) {
      var item = products[p];
      if (!item) continue;
      var image =
        item.variantImageUrl != null && item.variantImageUrl !== ""
          ? String(item.variantImageUrl)
          : item.imageUrl
            ? String(item.imageUrl)
            : "";
      if (!image) continue;
      if (item.cardKey) byKey[String(item.cardKey).toLowerCase()] = image;
      if (item.handle) {
        var hk = String(item.handle).toLowerCase();
        if (byKey[hk] == null) byKey[hk] = image;
      }
    }
    /* Same discovery as applyVariantImages: product links → card (all themes). */
    var links = scope.querySelectorAll('a[href*="/products/"]');
    var seen = typeof WeakSet !== "undefined" ? new WeakSet() : null;
    var seenList = seen ? null : [];
    var i;
    for (i = 0; i < links.length; i++) {
      var link = links[i];
      var handle = handleFromHref(link.getAttribute("href"));
      if (!handle) continue;
      var card =
        (link.closest &&
          link.closest(
            "product-card, product-item, li.grid__item, .grid__item, .product-card, .sf-app-card, [data-product-card]",
          )) ||
        null;
      if (!card) card = link.closest ? link.closest("li, article, .card") : null;
      if (!card) continue;
      if (seen) {
        if (seen.has(card)) continue;
        seen.add(card);
      } else {
        if (seenList.indexOf(card) !== -1) continue;
        seenList.push(card);
      }
      var key =
        (card.getAttribute && card.getAttribute("data-sf-card-key")) ||
        handle.toLowerCase();
      key = String(key || "").toLowerCase();
      var base = key.split("::")[0];
      var url = byKey[key] || byKey[base] || byKey[handle.toLowerCase()] || "";
      if (!url) continue;
      var img = firstNonSwatchCardImage(card);
      if (img) paintThemeCardImage(img, url);
    }
    restoreAllThemeCardSwatchImages(scope);
  }

  /**
   * Debounced repair after grid paint. Do NOT use a document-wide MutationObserver
   * on img src — restore writes src/srcset and that caused an infinite loop / freeze.
   * One immediate pass + one delayed pass (after applyVariantImages in afterGrid).
   */
  var _swatchRestoreTimer = 0;
  var _swatchRestoreWidget = null;
  var _swatchRestoreRoot = null;

  function scheduleSwatchRestore(root, widget) {
    _swatchRestoreWidget = widget || _swatchRestoreWidget;
    _swatchRestoreRoot = root || _swatchRestoreRoot;
    if (_swatchRestoreTimer) return;
    _swatchRestoreTimer = setTimeout(function () {
      _swatchRestoreTimer = 0;
      var w = _swatchRestoreWidget;
      var r = _swatchRestoreRoot;
      _swatchRestoreWidget = null;
      _swatchRestoreRoot = null;
      try {
        repairVariantImagesAfterGrid(w, r);
      } catch (err) {
        /* never block the filter UI */
      }
      /* Second pass after smart-filter.js applyVariantImages (afterGrid). */
      setTimeout(function () {
        try {
          repairVariantImagesAfterGrid(w, r);
        } catch (err2) {
          /* ignore */
        }
      }, 120);
    }, 0);
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
      var imgs = themeCardProductImages(card);
      for (i = 0; i < imgs.length; i++) {
        if (imgUrl) paintThemeCardImage(imgs[i], imgUrl);
        if (product.title) imgs[i].setAttribute("alt", product.title);
        if (!imgs[i].getAttribute("loading")) imgs[i].setAttribute("loading", "lazy");
        if (!imgs[i].getAttribute("decoding")) imgs[i].setAttribute("decoding", "async");
      }
      /* Per-card restore only — full-grid repair is debounced via scheduleSwatchRestore. */
      restoreThemeCardSwatchImages(card);
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
    scheduleSwatchRestore(parent, widget);
  }

  function nativeHideKilled() {
    var root =
      document.getElementById("smart-filter-root") ||
      document.getElementById("smart-filter-embed");
    return Boolean(
      root && root.getAttribute("data-findly-disable-native-hide") === "true",
    );
  }

  function storefrontV2() {
    var root = document.documentElement;
    if (root && root.classList && root.classList.contains("sf-storefront-v2")) {
      return true;
    }
    var block =
      document.getElementById("smart-filter-root") ||
      document.getElementById("smart-filter-embed");
    if (block && block.getAttribute("data-findly-storefront-v2") === "true") {
      return true;
    }
    var widget = window.__FINDLY_FILTER_WIDGET;
    return Boolean(widget && widget.storefrontV2);
  }

  function findlyMetric(name, detail) {
    if (typeof window.__FINDLY_EMIT_METRIC === "function") {
      window.__FINDLY_EMIT_METRIC(name, detail);
      return;
    }
    var bag = window.__FINDLY_COUNTS || (window.__FINDLY_COUNTS = {});
    bag[name] = (bag[name] || 0) + 1;
    console.info("[findly-metric]", name, bag[name], detail || "");
  }

  function findlyLog(pass, why, extra) {
    try {
      if (!/(?:^|[?&])findly_debug=1(?:&|$)/.test(window.location.search)) return;
    } catch (err) {
      return;
    }
    console.info("[findly]", pass, why, extra || "");
  }

  function listingRefined(widget) {
    if (!widget) return false;
    if (Math.max(1, Number(widget.page) || 1) > 1) return true;
    if (widget.hasActiveFilters && widget.hasActiveFilters()) return true;
    if (widget.collectionQuery) return true;
    if (
      widget.sortKey &&
      widget.defaultSort &&
      widget.sortKey !== widget.defaultSort
    ) {
      return true;
    }
    return false;
  }

  function catalogCount(widget) {
    var root = widget && widget.root;
    if (!root || !root.getAttribute) return null;
    var raw = root.getAttribute("data-findly-catalog-count");
    if (raw == null || raw === "") return null;
    var n = Number(raw);
    if (!Number.isFinite(n) || n < 0) return null;
    return n;
  }

  /* Confirmed when indexed_count covers Liquid's unfiltered count, within
     min(25, 2% of the catalog), or an explicit index_complete flag.
     Unknown coverage does not take over. Used only when storefrontV2 is on. */
  function coverageConfirmed(widget) {
    var data = widget && widget._lastFilterData;
    if (!widget) return false;
    if (!data) {
      widget._indexCovers = null;
      return false;
    }
    if (data.index_complete === true) {
      widget._indexCovers = true;
      findlyLog("index", "complete-flag");
      return true;
    }
    var indexed = Number(data.indexed_count);
    var catalog = catalogCount(widget);
    if (!Number.isFinite(indexed) || catalog == null) {
      widget._indexCovers = null;
      findlyLog("index", "unknown", { indexed: data.indexed_count, catalog: catalog });
      return false;
    }
    var exact = indexed >= catalog;
    var covers = exact;
    if (!covers && indexed > 0 && catalog > 0) {
      var slack = Math.min(25, Math.floor(catalog * 0.02));
      if (indexed + slack >= catalog) {
        covers = true;
        findlyMetric("slack", "indexed=" + indexed + ",catalog=" + catalog);
      }
    }
    widget._indexCovers = covers;
    findlyLog("index", covers ? "covers" : "partial-or-empty", {
      indexed: indexed,
      catalog: catalog,
    });
    return covers;
  }

  function indexAllowsTakeover(widget) {
    if (!widget || widget._findlyFilterFailed || nativeHideKilled()) return false;
    var data = widget._lastFilterData;
    if (!data) return false;
    var products = data.products;
    if (!Array.isArray(products) || products.length === 0) return false;
    var total = Number(data.total);
    if (!Number.isFinite(total) || total <= 0) return false;
    return coverageConfirmed(widget);
  }

  function restoreHiddenCards(widget) {
    if (widget) delete widget._keepThemeCards;
    var nodes = document.querySelectorAll("[data-smart-filter-hidden='true']");
    var i;
    for (i = 0; i < nodes.length; i++) showEl(nodes[i]);
    findlyLog("takeover", "release", { n: nodes.length });
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
    if (!storefrontV2() && widget.searchQuery) return false;
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
    clearOrphanHideTimers(widget);
    restoreOrphanThemeOutside();
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
    if (nativeHideKilled()) return false;
    if (widget.isAppGridMode && widget.isAppGridMode()) return false;
    if (!storefrontV2()) {
      if (isNativeThemeGridState(widget)) {
        delete widget._keepThemeCards;
        return false;
      }
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
    if (!listingRefined(widget)) {
      delete widget._keepThemeCards;
      findlyLog("takeover", "plain-listing");
      return false;
    }
    if (!indexAllowsTakeover(widget)) {
      findlyLog("takeover", "skip", {
        page: widget.page,
        failed: Boolean(widget._findlyFilterFailed),
        covers: widget._indexCovers,
        indexed: widget._lastFilterData && widget._lastFilterData.indexed_count,
        catalog: catalogCount(widget),
        total: widget._lastFilterData && widget._lastFilterData.total,
      });
      return false;
    }
    markGridTakeover(widget);
    findlyLog("takeover", "apply", {
      page: widget.page,
      total: widget._lastFilterData && widget._lastFilterData.total,
    });
    return true;
  }

  /**
   * True when the host (or its inner card grid) already has theme / app product
   * cards. Used so empty-theme fallback never replaces a working Liquid grid.
   */
  function themeHostHasProductCards(parent) {
    if (!parent) return false;
    var cards = collectThemeCards(parent);
    if (cards && cards.length) return true;
    var inner = queryInnerCardGrid(parent);
    if (inner && inner !== parent) {
      var innerCards = collectThemeCards(inner);
      if (innerCards && innerCards.length) return true;
    }
    if (parent.querySelector && parent.querySelector(".sf-app-card")) return true;
    return false;
  }

  /**
   * .sf-app-grid on a page shell (e.g. .product-grid-container) hides every
   * non-.sf-app-card child — including the theme's #product-grid UL. Always
   * keep sf-app-grid on the card list host only (all themes).
   */
  function stripAppGridFromPageShells(from) {
    var seen = typeof WeakSet !== "undefined" ? new WeakSet() : null;
    function strip(el) {
      if (!el || el.nodeType !== 1 || !el.classList) return;
      if (seen) {
        if (seen.has(el)) return;
        seen.add(el);
      }
      if (!isPageShellHost(el) && !isProductGridIdShell(el)) return;
      if (isActualCardGrid(el)) return;
      el.classList.remove("sf-app-grid");
    }
    if (from && from.nodeType === 1) {
      strip(from);
      if (from.closest) {
        strip(
          from.closest(
            ".product-grid-container, #ProductGridContainer, #CollectionProductGrid, [data-findly-grid-shell='1']",
          ),
        );
      }
    }
    var nodes = document.querySelectorAll(
      ".product-grid-container.sf-app-grid, #ProductGridContainer.sf-app-grid, #CollectionProductGrid.sf-app-grid, [data-findly-grid-shell='1'].sf-app-grid",
    );
    var i;
    for (i = 0; i < nodes.length; i++) strip(nodes[i]);
  }

  /**
   * Copy a real theme product-grid className when available (any theme).
   * Falls back to a minimal product-grid class — theme CSS / lockThemeGridTracks
   * own columns; we do not invent Dawn/Horizon-only column tokens here.
   */
  function discoverThemeProductGridClassName(scope) {
    scope = scope || document;
    var sels = [
      "ul#product-grid",
      "ol#product-grid",
      "ul.product-grid",
      "ol.product-grid",
      ".main-collection-grid",
      ".ProductList--grid",
      ".productgrid--items",
      ".grid--view-items",
      "[data-product-grid]",
      "ul.grid",
      "ol.grid",
    ];
    var i;
    for (i = 0; i < sels.length; i++) {
      var el = scope.querySelector && scope.querySelector(sels[i]);
      if (!el || !el.className) continue;
      var cls = String(el.className).trim();
      if (!cls) continue;
      if (
        /product-grid|main-collection|ProductList|productgrid|grid--view|data-product-grid|grid--\d/i.test(
          cls,
        )
      ) {
        return cls
          .replace(/\bsf-app-grid\b/g, "")
          .replace(/\s+/g, " ")
          .trim();
      }
    }
    return "grid product-grid";
  }

  /**
   * Resolve or create the theme card list inside a shell so app cards inherit
   * the theme's product-grid CSS (all themes). Never paints onto the shell.
   */
  function ensureThemeCardGridHost(widget, hint) {
    var parent =
      preferProductCardGrid(resolveCardHost(hint) || hint) || hint || null;
    if (parent && isActualCardGrid(parent)) {
      stripAppGridFromPageShells(parent);
      if (widget) widget._gridParent = parent;
      return parent;
    }
    var shell = null;
    if (parent && (isPageShellHost(parent) || isProductGridIdShell(parent))) {
      shell = parent;
    } else if (parent && parent.closest) {
      shell = parent.closest(
        ".product-grid-container, #ProductGridContainer, #CollectionProductGrid, [data-findly-grid-shell='1']",
      );
    }
    if (!shell && widget && widget._themeGridShell) shell = widget._themeGridShell;
    if (!shell) {
      shell =
        document.querySelector(
          ".product-grid-container, #ProductGridContainer, #CollectionProductGrid",
        ) || null;
    }
    if (shell) {
      stripAppGridFromPageShells(shell);
      var inner =
        queryInnerCardGrid(shell) ||
        liveProductGridIn(shell) ||
        null;
      if (inner && inner !== shell && isActualCardGrid(inner)) {
        showEl(inner);
        inner.removeAttribute("data-findly-orphan-hidden");
        if (widget) {
          widget._gridParent = inner;
          widget._themeGridShell = shell;
        }
        return inner;
      }
      var section =
        (shell.closest &&
          shell.closest(".shopify-section, [data-section-id], .collection")) ||
        shell;
      var ghost =
        (section &&
          section.querySelector &&
          (section.querySelector("ul.product-grid, ol.product-grid, .main-collection-grid, [data-product-grid]") ||
            section.querySelector("ul.grid, ol.grid"))) ||
        document.querySelector(
          "ul.product-grid, ol.product-grid, .main-collection-grid, [data-product-grid]",
        );
      var tag = "ul";
      if (ghost) {
        var gTag = String(ghost.tagName || "").toLowerCase();
        if (gTag === "ol" || gTag === "div" || gTag === "ul") tag = gTag;
      }
      var mount = shell;
      if (shell.children) {
        var mi;
        for (mi = 0; mi < shell.children.length; mi++) {
          var mKid = shell.children[mi];
          if (
            mKid &&
            mKid.classList &&
            mKid.classList.contains("collection") &&
            !mKid.classList.contains("sf-collection-layout")
          ) {
            mount = mKid;
            break;
          }
        }
      }
      var grid = document.createElement(tag);
      if (tag === "ul" || tag === "ol") grid.id = "product-grid";
      grid.className = discoverThemeProductGridClassName(section || document);
      grid.setAttribute("data-findly-adopted-theme-grid", "1");
      mount.appendChild(grid);
      showEl(grid);
      stripAppGridFromPageShells(shell);
      if (widget) {
        widget._gridParent = grid;
        widget._themeGridShell = shell;
      }
      return grid;
    }
    if (parent) {
      stripAppGridFromPageShells(parent);
      if (widget) widget._gridParent = parent;
    }
    return parent;
  }

  /**
   * After .sf-app-card paint: match theme list item structure + theme tracks.
   * Does not invent Dawn/Horizon-only layouts — uses existing lock helpers.
   */
  function finalizeAppCardsInThemeGrid(widget, parent) {
    parent =
      ensureThemeCardGridHost(widget, parent) ||
      parent ||
      (widget && widget._gridParent);
    if (!parent) return null;
    stripAppGridFromPageShells(parent);
    /* If origApply painted onto the shell, move cards into the theme list host. */
    var shell =
      (parent.closest &&
        parent.closest(
          ".product-grid-container, #ProductGridContainer, #CollectionProductGrid, [data-findly-grid-shell='1']",
        )) ||
      (widget && widget._themeGridShell) ||
      null;
    if (shell && shell !== parent && shell.querySelectorAll) {
      var orphans = shell.querySelectorAll(".sf-app-card");
      var oi;
      for (oi = 0; oi < orphans.length; oi++) {
        if (parent.contains(orphans[oi])) continue;
        parent.appendChild(orphans[oi]);
      }
    }
    if (parent.classList && isActualCardGrid(parent)) {
      parent.classList.add("sf-app-grid");
    } else if (
      parent.classList &&
      !isPageShellHost(parent) &&
      !isProductGridIdShell(parent)
    ) {
      parent.classList.add("sf-app-grid");
    }
    stripAppGridFromPageShells(parent);
    if (typeof restyleAppCardsAsThemeItems === "function") {
      restyleAppCardsAsThemeItems(parent);
    }
    showEl(parent);
    parent.removeAttribute("data-findly-orphan-hidden");
    parent.removeAttribute("data-findly-theme-hidden");
    lockThemeGridTracks(parent);
    if (widget) {
      widget._gridParent = parent;
      scheduleRelockProductGridTracks(widget);
    }
    return parent;
  }

  /**
   * Standard empty-theme fallback (all themes): when the filters API returned
   * products/handles but Liquid rendered zero product cards, paint DEFAULT
   * .sf-app-card via applyAppGrid. No-op when the theme already has cards.
   */
  function ensureAppCardsIfThemeEmpty(widget, handles, parent, append) {
    if (!widget || typeof widget.applyAppGrid !== "function") return false;
    parent =
      ensureThemeCardGridHost(
        widget,
        preferProductCardGrid(resolveCardHost(parent) || parent) ||
          parent ||
          widget._gridParent,
      ) || parent;
    if (!parent) return false;
    var list =
      Array.isArray(handles) && handles.length
        ? handles
        : widget._allFilterHandles || widget._visibleHandles || [];
    if (!uniqueAllowedCount(list)) return false;
    if (countAllowedInHost(parent, list) > 0) return false;
    if (themeHostHasProductCards(parent)) return false;
    var products = widget._lastProducts || [];
    if (
      widget._lastFilterData &&
      Array.isArray(widget._lastFilterData.products) &&
      widget._lastFilterData.products.length
    ) {
      products = widget._lastFilterData.products;
    }
    if (!products.length && !list.length) return false;
    widget._skipPageSlice = true;
    var painted = false;
    try {
      painted = !!widget.applyAppGrid(
        { products: products },
        list,
        Boolean(append),
      );
    } finally {
      widget._skipPageSlice = false;
    }
    var appN =
      (parent.querySelectorAll &&
        parent.querySelectorAll(".sf-app-card").length) ||
      0;
    if (
      painted ||
      appN > 0 ||
      (widget._shownHandles && widget._shownHandles.length)
    ) {
      if (!(widget._shownHandles && widget._shownHandles.length)) {
        widget._shownHandles = list.slice();
      }
      widget._visibleHandles = (widget._shownHandles || list).slice();
      parent = finalizeAppCardsInThemeGrid(widget, parent) || parent;
      if (parent && parent.isConnected !== false) widget._gridParent = parent;
      appN =
        (parent.querySelectorAll &&
          parent.querySelectorAll(".sf-app-card").length) ||
        appN;
      markGridPainted(widget);
      syncGridEmptyState(
        widget,
        parent,
        list,
        Math.max(
          appN,
          uniqueAllowedCount(widget._shownHandles || list),
        ),
      );
      return true;
    }
    return false;
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
          if (widget._sfFlushListingScroll) widget._sfFlushListingScroll();
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
      if (widget._sfFlushListingScroll) widget._sfFlushListingScroll();
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
      if (!safeInsertBefore(parent, el, reference || null)) {
        if (el.parentNode !== parent) parent.appendChild(el);
      }
      reference = el;
    }
  }

  function applyNativeFilterGrid(handles, hint) {
    var parent = preferProductCardGrid(resolveCardHost(hint) || hint);
    if (!parent) return false;
    var widget = window.__FINDLY_FILTER_WIDGET;
    var allowed = Array.isArray(handles) ? allowedHandleSet(handles) : null;
    /* Filtering (incl. empty results): keep .sf-app-card nodes and hide/show
       in place. stripAppCards is only for full native Liquid restore. */
    if (!allowed) {
      stripAppCards(parent || document);
    }
    if (widget && !widget._nativeGridOrder) {
      snapshotNativeGridOrder(widget, parent);
    }
    lockThemeGridTracks(parent);
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
      if (isPrice) {
        syncPriceFacetDom(widget, node, facet);
        continue;
      }

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

  function paintIndexBlockedNotice(widget) {
    if (!widget || !widget.root) return;
    var note = widget.root.querySelector("[data-findly-index-block]");
    if (!widget._findlyIndexBlocked) {
      if (note && note.parentNode) note.parentNode.removeChild(note);
      return;
    }
    if (!note) {
      note = document.createElement("p");
      note.setAttribute("data-findly-index-block", "1");
      note.setAttribute("role", "status");
      note.className = "sf-status";
      var facets = widget.facetsEl;
      if (facets && facets.parentNode) facets.parentNode.insertBefore(note, facets);
      else widget.root.appendChild(note);
    }
    note.textContent =
      "Filters aren't changing the product grid. The catalog index doesn't cover this page yet.";
  }

  function undoRefusedRefinement(widget) {
    if (!widget || widget._findlyUndoBusy || nativeHideKilled()) return;
    findlyMetric("undo", "refused");
    widget._findlyUndoBusy = true;
    widget._findlyIndexBlocked = true;
    resetWidgetFilterState(widget);
    widget.page = 1;
    delete widget._keepThemeCards;
    delete widget._sfPaged;
    if (widget.markFiltersApplied) widget.markFiltersApplied();
    if (widget.renderFacets) widget.renderFacets();
    if (widget.syncDrawerBadge) widget.syncDrawerBadge();
    if (widget.syncClearAll) widget.syncClearAll();
    paintIndexBlockedNotice(widget);
    var pending = widget.fetchFilters ? widget.fetchFilters() : null;
    var done = function () {
      widget._findlyUndoBusy = false;
    };
    if (pending && typeof pending.then === "function") {
      pending.then(done, done);
    } else {
      done();
    }
  }

  function applyNativeAfterGrid(self) {
    if (!self) return;
    if (self._importingCards) return;
    if (self._loadingPage || self._inflight) return;
    /* Same filter cycle already painted — skip another full hide/show/reorder
       (idle reload used to re-paint Liquid cards 2–3 extra times here). */
    if (alreadyPaintedGrid(self)) return;
    if (self.isAppGridMode && self.isAppGridMode()) {
      var parent = self._gridParent;
      if (parent && self.hideNativeGridCards) self.hideNativeGridCards(parent);
      return;
    }
    if (!shouldTakeOverThemeCards(self)) {
      if (!storefrontV2()) {
        applyNativeFilterGrid(null, self._gridParent);
        markGridPainted(self);
        syncGridEmptyState(self, self._gridParent, null, 0);
        return;
      }
      var covered = coverageConfirmed(self);
      var payload = self._lastFilterData;
      var payloadProducts = payload && payload.products;
      var noProducts = !Array.isArray(payloadProducts) || payloadProducts.length === 0;
      if (!nativeHideKilled() && listingRefined(self) && covered && noProducts) {
        applyNativeFilterGrid([], self._gridParent);
        markGridPainted(self);
        syncGridEmptyState(self, self._gridParent, [], 0);
        return;
      }
      applyNativeFilterGrid(null, self._gridParent);
      if (
        !nativeHideKilled() &&
        listingRefined(self) &&
        payload &&
        !covered
      ) {
        undoRefusedRefinement(self);
      } else if (self._findlyIndexBlocked) {
        paintIndexBlockedNotice(self);
      }
      markGridPainted(self);
      syncGridEmptyState(self, self._gridParent, null, 0);
      return;
    }
    self._findlyIndexBlocked = false;
    paintIndexBlockedNotice(self);
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

  function drawerOpensFromRight(widget) {
    if (!widget) return false;
    // Derive only from position / offcanvasSide — never from data-drawer-side
    // (that attr is write-only output from syncDrawerSideAttrs).
    if (widget.position === "right") return true;
    var root = widget.root;
    if (root && root.classList && root.classList.contains("smart-filter--right")) {
      return true;
    }
    if (isOffcanvasPosition(widget) && widget.offcanvasSide === "right") {
      return true;
    }
    return false;
  }

  function syncDrawerSideAttrs(widget, panel) {
    var side = drawerOpensFromRight(widget) ? "right" : "left";
    if (widget && widget.root && widget.root.setAttribute) {
      widget.root.setAttribute("data-drawer-side", side);
    }
    var target = panel;
    if (!target && widget) {
      target =
        widget.panelEl ||
        (widget.root && widget.root.querySelector
          ? widget.root.querySelector("[data-drawer-panel]")
          : null);
    }
    if (target && target.setAttribute) {
      target.setAttribute("data-drawer-side", side);
    }
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

  /* Menu rows keep is-selected from the first build. The native select value
     is what sorts. Move only that existing marker before focus. If the value
     cannot be matched, leave the rows alone so open/focus stay as they were. */
  function syncSortMenuSelection(menu, select) {
    if (!menu || !select || !menu.querySelectorAll) return;
    var options = menu.querySelectorAll(".sf-sort-option");
    if (!options.length) return;
    var current = String(select.value || "");
    var matched = -1;
    var stamped = false;
    var i;
    for (i = 0; i < options.length; i++) {
      if (!options[i].hasAttribute("data-sf-sort-value")) continue;
      stamped = true;
      if (options[i].getAttribute("data-sf-sort-value") === current) {
        matched = i;
        break;
      }
    }
    if (!stamped && select.selectedIndex >= 0 && select.selectedIndex < options.length) {
      matched = select.selectedIndex;
    }
    if (matched < 0) return;
    for (i = 0; i < options.length; i++) {
      var on = i === matched;
      if (on) options[i].classList.add("is-selected");
      else options[i].classList.remove("is-selected");
      options[i].setAttribute("aria-selected", on ? "true" : "false");
    }
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
    syncSortMenuSelection(menu, sortMenuSelect(wrap));
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
      optionBtn.setAttribute("data-sf-sort-value", opt.value);
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
      if (input.parentNode === label) {
        safeInsertBefore(label, mark, input.nextSibling);
      } else {
        label.appendChild(mark);
      }
    }
  }

  function toolbarHost() {
    var toolbar = document.querySelector(".sf-toolbar");
    if (toolbar && toolbar.parentNode && !isListingChromeHost(toolbar.parentNode)) {
      return toolbar;
    }
    var host = document.querySelector(".sf-sort-host");
    if (
      host &&
      host.parentNode &&
      !isListingChromeHost(host.parentNode) &&
      !(host.closest && host.closest(".sf-toolbar"))
    ) {
      return host;
    }
    var grid =
      resolveListingCardGrid(document.querySelector(PRODUCT_GRID_SELECTOR)) ||
      document.querySelector(PRODUCT_GRID_SELECTOR);
    var shell = closestThemeGridShell(grid);
    var main =
      findColumnMainContaining(grid) ||
      (shell ? ensureBlockMain(shell) : null) ||
      document.querySelector(".sf-layout-main");
    if (main && (!isColumnMain(main) || isListingChromeHost(main))) {
      main = shell ? ensureBlockMain(shell) : null;
    }
    if (!main || isListingChromeHost(main)) return toolbar || null;
    if (!toolbar) {
      toolbar = document.createElement("div");
      toolbar.className = "sf-toolbar";
    }
    var before = shell && main.contains(shell) ? shell : main.firstChild;
    if (!safeInsertBefore(main, toolbar, before)) {
      main.insertBefore(toolbar, before || main.firstChild);
    }
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
        if (!safeInsertBefore(toolbar.parentNode, slot, toolbar.nextSibling)) {
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
      if (!safeInsertBefore(toolbar.parentNode, slot, toolbar.nextSibling)) {
        toolbar.parentNode.appendChild(slot);
      }
      return slot;
    }
    var main = document.querySelector(".sf-layout-main");
    if (main) {
      if (!safeInsertBefore(main, slot, main.firstChild)) main.appendChild(slot);
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
    var right = drawerOpensFromRight(widget);
    syncDrawerSideAttrs(widget, panel);
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
        if (panel.parentNode === widget.root) {
          safeInsertBefore(widget.root, backdrop, panel);
        } else {
          widget.root.appendChild(backdrop);
        }
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

  /* dual-grid-v4: link-based theme grid discovery + scoped rival hide in main. */
  var DUAL_GRID_BUILD = "dual-grid-v4";
  var RIVAL_SKIP =
    "header, footer, nav, cart-drawer, #CartDrawer, .cart-drawer, [data-cart-drawer]," +
    " product-recommendations, .related-products, [data-related-products], .recently-viewed," +
    " .predictive-search, .search-modal, [data-predictive-search], .quick-add-modal," +
    " complementary-products, .complementary-products, .upsell, .cross-sell";

  function gridDebugEnabled() {
    try {
      if (window.__FINDLY_DEBUG_GRID) return true;
      var q = String(window.location.search || "");
      return /(?:^|[?&])findly_debug=1(?:&|$)/.test(q);
    } catch (err) {
      return false;
    }
  }

  function gridLog() {
    if (!gridDebugEnabled()) return;
    var args = ["[Findly " + DUAL_GRID_BUILD + "]"].concat(
      Array.prototype.slice.call(arguments),
    );
    try {
      console.info.apply(console, args);
    } catch (err) {
      /* ignore */
    }
  }

  function markOrphanHidden(node) {
    if (!node || node.nodeType !== 1) return false;
    if (node.getAttribute("data-findly-orphan-hidden") === "1" && node.hidden) {
      return false;
    }
    hideEl(node);
    node.setAttribute("data-findly-orphan-hidden", "1");
    return true;
  }

  function restoreOrphanThemeOutside() {
    var nodes = document.querySelectorAll("[data-findly-orphan-hidden='1']");
    var i;
    for (i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      if (!node) continue;
      showEl(node);
      node.removeAttribute("data-findly-orphan-hidden");
    }
  }

  function clearOrphanHideTimers(widget) {
    if (!widget || !widget._sfOrphanHideTimers) return;
    var i;
    for (i = 0; i < widget._sfOrphanHideTimers.length; i++) {
      try {
        window.clearTimeout(widget._sfOrphanHideTimers[i]);
      } catch (err) {
        /* ignore */
      }
    }
    widget._sfOrphanHideTimers = [];
  }

  function mainListingScope() {
    return (
      document.querySelector(
        "main, #MainContent, #main, [role='main'], #PageContainer, .main-content",
      ) || document.body
    );
  }

  function isRivalSkipRegion(el) {
    if (!el || !el.closest) return false;
    if (isSkippedCardRegion(el)) return true;
    try {
      return Boolean(el.closest(RIVAL_SKIP));
    } catch (err) {
      return false;
    }
  }

  function countThemeCardsIn(el) {
    if (!el || !el.querySelectorAll) return 0;
    var links = el.querySelectorAll('a[href*="/products/"]');
    var seen = {};
    var count = 0;
    var i;
    for (i = 0; i < links.length; i++) {
      var link = links[i];
      if (!link || isRivalSkipRegion(link)) continue;
      if (link.closest && link.closest(".sf-app-card, #" + HOST_ID)) continue;
      var handle = handleFromHref(link.getAttribute("href"));
      if (!handle || seen[handle]) continue;
      seen[handle] = true;
      count += 1;
    }
    return count;
  }

  /**
   * Best Liquid product grid outside the Findly synthetic host.
   * Uses product-link clustering (same idea as theme discoverAnyThemeGrid).
   */
  function findLiveThemeProductGrid(excludeHost) {
    var scope = mainListingScope();
    if (!scope || !scope.querySelectorAll) return null;

    var hints = scope.querySelectorAll(PRODUCT_GRID_SELECTOR);
    var best = null;
    var bestCount = 0;
    var i;
    for (i = 0; i < hints.length; i++) {
      var hint = hints[i];
      if (!hint || hint.nodeType !== 1) continue;
      if (hint.id === HOST_ID) continue;
      if (excludeHost && (hint === excludeHost || excludeHost.contains(hint))) {
        continue;
      }
      if (hint.contains && excludeHost && hint.contains(excludeHost)) continue;
      if (isRivalSkipRegion(hint)) continue;
      if (hint.classList && hint.classList.contains("sf-app-grid") && countThemeCardsIn(hint) === 0) {
        continue;
      }
      var count = countThemeCardsIn(hint);
      if (count > bestCount) {
        best = hint;
        bestCount = count;
      }
    }
    if (bestCount >= 1) {
      gridLog("found theme grid via PRODUCT_GRID_SELECTOR", {
        id: best && best.id,
        className: best && String(best.className || "").slice(0, 80),
        themeCards: bestCount,
      });
      return preferProductCardGrid(best);
    }

    /* Link-parent cluster — works when theme markup misses product-grid classes. */
    var links = scope.querySelectorAll('a[href*="/products/"]');
    var tally = typeof Map !== "undefined" ? new Map() : null;
    var legacy = [];
    for (i = 0; i < links.length; i++) {
      var link = links[i];
      if (!link || isRivalSkipRegion(link)) continue;
      if (link.closest && link.closest(".sf-app-card, #" + HOST_ID + ", .smart-filter, .sf-panel")) {
        continue;
      }
      if (excludeHost && excludeHost.contains(link)) continue;
      if (!handleFromHref(link.getAttribute("href"))) continue;
      var card =
        resolveOuterThemeCard(link) ||
        (link.closest &&
          link.closest(
            "li, article, product-card, product-item, .grid__item, .card-wrapper, .product-card, .product",
          )) ||
        link;
      if (excludeHost && excludeHost.contains(card)) continue;
      var parent = card && card.parentElement;
      if (!parent || parent.nodeType !== 1 || parent.id === HOST_ID) continue;
      if (excludeHost && (parent === excludeHost || excludeHost.contains(parent))) {
        continue;
      }
      if (isRivalSkipRegion(parent)) continue;
      if (tally) {
        tally.set(parent, (tally.get(parent) || 0) + 1);
      } else {
        var found = null;
        var t;
        for (t = 0; t < legacy.length; t++) {
          if (legacy[t].parent === parent) {
            found = legacy[t];
            break;
          }
        }
        if (!found) {
          found = { parent: parent, count: 0 };
          legacy.push(found);
        }
        found.count += 1;
      }
    }
    if (tally) {
      tally.forEach(function (count, parent) {
        if (count > bestCount) {
          best = parent;
          bestCount = count;
        }
      });
    } else {
      for (i = 0; i < legacy.length; i++) {
        if (legacy[i].count > bestCount) {
          best = legacy[i].parent;
          bestCount = legacy[i].count;
        }
      }
    }
    if (bestCount >= 1) {
      gridLog("found theme grid via link parents", {
        id: best && best.id,
        className: best && String(best.className || "").slice(0, 80),
        themeCards: bestCount,
      });
      return preferProductCardGrid(best);
    }
    gridLog("no live theme grid", { excludeId: excludeHost && excludeHost.id });
    return null;
  }

  function reclaimThemeGridHost(widget, current) {
    if (!widget) return current || null;
    var host = current || widget._gridParent;
    var exclude = host && host.id === HOST_ID ? host : null;
    var live = findLiveThemeProductGrid(exclude);
    if (!live) return host || null;
    if (live.id === HOST_ID) return host || null;
    if (host && host !== live) {
      moveCardsToHost(host, live);
      if (host.id === HOST_ID && host.classList) {
        host.classList.remove("sf-app-grid");
      }
    }
    showEl(live);
    live.removeAttribute("data-findly-orphan-hidden");
    widget._gridParent = live;
    gridLog("reclaimed theme grid as _gridParent", {
      id: live.id || null,
      className: String(live.className || "").slice(0, 80),
    });
    return live;
  }

  function hideRivalCardsInScope(host, rival) {
    var hiddenCards = 0;
    var seen = typeof WeakSet !== "undefined" ? new WeakSet() : null;
    var scope = rival || mainListingScope();
    if (!scope || !scope.querySelectorAll) return 0;
    var links = scope.querySelectorAll('a[href*="/products/"]');
    var i;
    for (i = 0; i < links.length; i++) {
      var link = links[i];
      if (!link || isRivalSkipRegion(link)) continue;
      if (host && host.contains(link)) continue;
      if (link.closest && link.closest(".sf-app-card, #" + HOST_ID + ", .smart-filter, .sf-panel")) {
        continue;
      }
      if (!handleFromHref(link.getAttribute("href"))) continue;
      var card =
        resolveOuterThemeCard(link) ||
        (link.closest &&
          link.closest(
            "li, article, product-card, product-item, .grid__item, .card-wrapper, .product-card, .product",
          )) ||
        link;
      if (!card || (host && host.contains(card))) continue;
      if (seen) {
        if (seen.has(card)) continue;
        seen.add(card);
      }
      if (markOrphanHidden(card)) hiddenCards += 1;
    }
    return hiddenCards;
  }

  /**
   * When app cards remain on #findly-grid-host, hide the competing Liquid
   * listing inside main only (not cart / header / recommendations).
   */
  function hideCompetingThemeGrid(host) {
    if (!host || host.nodeType !== 1 || host.id !== HOST_ID) {
      gridLog("scoped rival hide skipped (not synthetic host)", {
        hostId: host && host.id,
      });
      return { grids: 0, cards: 0 };
    }
    if (!host.querySelector || !host.querySelector(".sf-app-card")) {
      gridLog("scoped rival hide skipped (no app cards on host)");
      return { grids: 0, cards: 0 };
    }
    var rival = findLiveThemeProductGrid(host);
    var hiddenCards = 0;
    var hiddenGrid = 0;
    if (rival && rival !== host && !host.contains(rival) && !rival.contains(host)) {
      hiddenCards = hideRivalCardsInScope(host, rival);
      if (markOrphanHidden(rival)) hiddenGrid = 1;
    } else {
      /* Still hide Liquid product cards in main outside the synthetic host. */
      hiddenCards = hideRivalCardsInScope(host, mainListingScope());
    }
    gridLog("scoped rival hide", {
      rivalId: rival && rival.id,
      rivalClass: rival && String(rival.className || "").slice(0, 80),
      hiddenGrid: hiddenGrid,
      hiddenCards: hiddenCards,
    });
    return { grids: hiddenGrid, cards: hiddenCards };
  }

  function shouldHideCompetingThemeGrid(widget, parent) {
    if (!widget || !widget._appGridActive) return false;
    var host = parent || widget._gridParent;
    return Boolean(
      host &&
        host.id === HOST_ID &&
        host.querySelector &&
        host.querySelector(".sf-app-card"),
    );
  }

  function scheduleCompetingThemeHide(widget, host) {
    if (!widget || !shouldHideCompetingThemeGrid(widget, host)) return;
    var target = host || widget._gridParent;
    if (!target) return;
    clearOrphanHideTimers(widget);
    hideCompetingThemeGrid(target);
    widget._sfOrphanHideTimers = [];
    var delays = [50, 200, 600];
    var d;
    for (d = 0; d < delays.length; d++) {
      (function (ms) {
        var id = window.setTimeout(function () {
          if (!shouldHideCompetingThemeGrid(widget, widget._gridParent)) return;
          gridLog("scheduled rival hide @" + ms + "ms");
          hideCompetingThemeGrid(widget._gridParent || target);
        }, ms);
        widget._sfOrphanHideTimers.push(id);
      })(delays[d]);
    }
  }

  function installGridDebugApi() {
    window.__FINDLY_GRID_DEBUG = {
      build: DUAL_GRID_BUILD,
      hideOrphans: function () {
        var w = window.__FINDLY_FILTER_WIDGET;
        var host = (w && w._gridParent) || document.getElementById(HOST_ID);
        window.__FINDLY_DEBUG_GRID = true;
        return hideCompetingThemeGrid(host);
      },
      reclaim: function () {
        var w = window.__FINDLY_FILTER_WIDGET;
        window.__FINDLY_DEBUG_GRID = true;
        return reclaimThemeGridHost(w, w && w._gridParent);
      },
      diagnose: function () {
        window.__FINDLY_DEBUG_GRID = true;
        var w = window.__FINDLY_FILTER_WIDGET;
        var host = (w && w._gridParent) || document.getElementById(HOST_ID);
        var rival = findLiveThemeProductGrid(host && host.id === HOST_ID ? host : null);
        var report = {
          build: DUAL_GRID_BUILD,
          appGridActive: !!(w && w._appGridActive),
          isAppGridMode: !!(w && w.isAppGridMode && w.isAppGridMode()),
          hostId: host && host.id,
          hostClass: host && String(host.className || "").slice(0, 80),
          appCards: document.querySelectorAll(".sf-app-card").length,
          orphanMarked: document.querySelectorAll("[data-findly-orphan-hidden='1']").length,
          rivalId: rival && (rival.id || null),
          rivalClass: rival && String(rival.className || "").slice(0, 80),
          rivalThemeCards: rival ? countThemeCardsIn(rival) : 0,
        };
        gridLog("diagnose", report);
        return report;
      },
    };
    gridLog("debug API ready — window.__FINDLY_GRID_DEBUG");
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
    safeInsertBefore(form.parentNode, mount, form);
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
        if (self._appGridActive) {
          var parent = self._gridParent;
          if (parent && parent.id === HOST_ID) {
            parent = reclaimThemeGridHost(self, parent) || parent;
          }
          gridLog("mutation: app-grid active", {
            hostId: parent && parent.id,
          });
          if (parent && self.hideNativeGridCards) self.hideNativeGridCards(parent);
          else if (shouldHideCompetingThemeGrid(self, parent)) {
            hideCompetingThemeGrid(parent);
          }
          return;
        }
        if (self.appGridTemplate && self.appGridTemplate()) {
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

  function refreshBoundSlider(slider) {
    if (!slider) return;
    var inputs = slider.querySelectorAll('input[type="range"]');
    if (inputs.length < 2) return;
    var low = inputs[0];
    var high = inputs[1];
    var fill = slider.querySelector(".sf-slider-fill");
    var thumbLow = slider.querySelector(".sf-slider-thumb-min");
    var thumbHigh = slider.querySelector(".sf-slider-thumb-max");
    var min = Number(low.min);
    var max = Number(low.max);
    if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return;
    var left = sliderPercent(low.value, min, max);
    var right = sliderPercent(high.value, min, max);
    if (left < 0) left = 0;
    if (left > 100) left = 100;
    if (right < 0) right = 0;
    if (right > 100) right = 100;
    if (thumbLow) thumbLow.style.left = left + "%";
    if (thumbHigh) thumbHigh.style.left = right + "%";
    if (fill) {
      fill.style.left = Math.min(left, right) + "%";
      fill.style.width = Math.abs(right - left) + "%";
    }
  }

  /* Price UI is Findly-owned (.sf-price / .sf-slider) — theme-agnostic.
     Resolve body-ported horizontal pops so left/right/top/drawer all sync. */
  function priceFacetHost(node) {
    if (!node) return null;
    var host = resolveFacetSearchRoot(node) || node;
    if (host.querySelector && host.querySelector(".sf-price, .sf-slider")) {
      return host;
    }
    if (node.querySelector && node.querySelector(".sf-price, .sf-slider")) {
      return node;
    }
    return host;
  }

  function syncPriceFacetDom(widget, node, facet) {
    if (!widget || !node || !facet) return;
    var host = priceFacetHost(node);
    if (!host || !host.querySelector) return;
    var isProductPrice = facet.isProductPrice || facet.key === "price";
    var boundMin = Number(facet.min);
    var boundMax = Number(facet.max);
    var hasBounds =
      Number.isFinite(boundMin) &&
      Number.isFinite(boundMax) &&
      boundMax > boundMin;
    var current = isProductPrice
      ? [
          widget.price && widget.price.min != null ? widget.price.min : "",
          widget.price && widget.price.max != null ? widget.price.max : "",
        ]
      : (widget.selected && widget.selected[facet.key]) || ["", ""];
    var liveMin =
      current[0] !== "" && current[0] != null ? Number(current[0]) : boundMin;
    var liveMax =
      current[1] !== "" && current[1] != null ? Number(current[1]) : boundMax;
    if (!Number.isFinite(liveMin)) liveMin = hasBounds ? boundMin : 0;
    if (!Number.isFinite(liveMax)) liveMax = hasBounds ? boundMax : 0;
    if (hasBounds) {
      if (liveMin < boundMin) liveMin = boundMin;
      if (liveMin > boundMax) liveMin = boundMax;
      if (liveMax < boundMin) liveMax = boundMin;
      if (liveMax > boundMax) liveMax = boundMax;
    }
    if (liveMin > liveMax) {
      var swap = liveMin;
      liveMin = liveMax;
      liveMax = swap;
    }

    var numberInputs = host.querySelectorAll('.sf-price input[type="number"]');
    if (numberInputs.length < 2) {
      numberInputs = host.querySelectorAll('input[type="number"]');
    }
    var active = document.activeElement;
    var editing =
      active &&
      numberInputs.length >= 2 &&
      (active === numberInputs[0] || active === numberInputs[1]);
    /* Do not clobber values while the shopper is typing. */
    if (!editing && numberInputs.length >= 2) {
      numberInputs[0].value =
        current[0] !== "" && current[0] != null
          ? String(current[0])
          : hasBounds
            ? String(Math.round(boundMin))
            : "";
      numberInputs[1].value =
        current[1] !== "" && current[1] != null
          ? String(current[1])
          : hasBounds
            ? String(Math.round(boundMax))
            : "";
    }

    var slider = host.querySelector(".sf-slider");
    if (!slider || !hasBounds) return;
    var ranges = slider.querySelectorAll('input[type="range"]');
    if (ranges.length < 2) return;
    ranges[0].min = String(boundMin);
    ranges[0].max = String(boundMax);
    ranges[1].min = String(boundMin);
    ranges[1].max = String(boundMax);
    /* While editing, mirror the live field values so thumbs track typing. */
    if (editing && numberInputs.length >= 2) {
      var typedMin = String(numberInputs[0].value || "").trim();
      var typedMax = String(numberInputs[1].value || "").trim();
      var a = typedMin === "" ? boundMin : Number(typedMin);
      var b = typedMax === "" ? boundMax : Number(typedMax);
      if (Number.isFinite(a) && Number.isFinite(b) && a <= b) {
        if (a < boundMin) a = boundMin;
        if (a > boundMax) a = boundMax;
        if (b < boundMin) b = boundMin;
        if (b > boundMax) b = boundMax;
        liveMin = a;
        liveMax = b;
      }
    }
    ranges[0].value = String(liveMin);
    ranges[1].value = String(liveMax);
    refreshBoundSlider(slider);
  }

  function bindPriceSlider(slider) {
    if (!slider) return;
    var inputs = slider.querySelectorAll('input[type="range"]');
    if (inputs.length < 2) return;
    if (slider.getAttribute("data-sf-range") === "1") {
      refreshBoundSlider(slider);
      return;
    }
    slider.setAttribute("data-sf-range", "1");
    var low = inputs[0];
    var high = inputs[1];
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
      min = Number(low.min);
      max = Number(low.max);
      refreshBoundSlider(slider);
    }
    syncThumbs();
    low.addEventListener("input", syncThumbs);
    high.addEventListener("input", syncThumbs);

    function startDrag(input, other, isMin, ev) {
      ev.preventDefault();
      ev.stopPropagation();
      min = Number(low.min);
      max = Number(low.max);
      step = low.step || "1";
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
      min = Number(low.min);
      max = Number(low.max);
      step = low.step || "1";
      var next = sliderValueFromX(slider, ev.clientX, min, max, step);
      var useLow =
        Math.abs(next - Number(low.value)) <= Math.abs(next - Number(high.value));
      startDrag(useLow ? low : high, useLow ? high : low, useLow, ev);
    });
  }

  function resolveFacetSearchRoot(wrap) {
    if (!wrap) return null;
    /* Horizontal top popovers move .sf-facet-pop to document.body. */
    if (wrap.classList && wrap.classList.contains("sf-facet-pop")) return wrap;
    if (wrap._sfFacetPop && wrap._sfFacetPop.isConnected) return wrap._sfFacetPop;
    var nestedPop =
      wrap.querySelector && wrap.querySelector(".sf-facet-pop");
    if (nestedPop) return nestedPop;
    var key =
      wrap.getAttribute && wrap.getAttribute("data-facet-key");
    if (key) {
      var ported = document.querySelectorAll("body > .sf-facet-pop.is-ported");
      var p;
      for (p = 0; p < ported.length; p++) {
        if (ported[p].getAttribute("data-facet-owner") === key) {
          return ported[p];
        }
      }
    }
    return wrap;
  }

  function applyFacetValueQuery(wrap, query) {
    var q = String(query || "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
    var root = resolveFacetSearchRoot(wrap) || wrap;
    var list =
      (root && root.querySelector && root.querySelector(".sf-options")) ||
      (root && root.querySelector && root.querySelector("select.sf-dropdown")) ||
      (wrap && wrap.querySelector && wrap.querySelector(".sf-options")) ||
      (wrap && wrap.querySelector && wrap.querySelector("select.sf-dropdown"));
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
      var scope =
        (input.closest && input.closest(".sf-facet-pop")) ||
        (input.closest && input.closest(".sf-facet")) ||
        wrap;
      applyFacetValueQuery(scope, input.value);
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
      var searchRoot = resolveFacetSearchRoot(wrap) || wrap;
      if (
        (searchRoot && searchRoot.querySelector(".sf-facet-search")) ||
        wrap.querySelector(".sf-facet-search")
      ) {
        continue;
      }
      if (
        (searchRoot && searchRoot.querySelector(".sf-price")) ||
        wrap.querySelector(".sf-price")
      ) {
        continue;
      }
      var after =
        (searchRoot &&
          (searchRoot.querySelector(".sf-options") ||
            searchRoot.querySelector(".sf-dropdown-wrap"))) ||
        wrap.querySelector(".sf-options") ||
        wrap.querySelector(".sf-dropdown-wrap");
      if (!after) continue;
      var host = after.parentNode || searchRoot || wrap;
      safeInsertBefore(host, buildFacetValueSearch(wrap, widget), after);
    }
  }

  function enhancePriceSliders(root) {
    var i;
    if (root && root.querySelectorAll) {
      var sliders = root.querySelectorAll(".sf-slider");
      for (i = 0; i < sliders.length; i++) bindPriceSlider(sliders[i]);
    }
    /* Findly-only hosts on document.body (top pops / drawer portal). */
    var ported = document.querySelectorAll(
      "body > .sf-facet-pop .sf-slider, body > .sf-panel.sf-drawer-portal .sf-slider",
    );
    for (i = 0; i < ported.length; i++) bindPriceSlider(ported[i]);
  }

  /* Keep custom thumbs/fill aligned when shoppers type into min/max fields.
     Visual-only: does not emit range input events, so filter apply/debounce
     stays owned by renderPriceFacet (existing behavior unchanged). */
  function wirePriceInputsToSlider(wrap) {
    if (!wrap || wrap.getAttribute("data-sf-price-sync") === "1") return;
    var host = wrap.classList && wrap.classList.contains("sf-price")
      ? wrap
      : wrap.querySelector
        ? wrap.querySelector(".sf-price") || wrap
        : wrap;
    var slider = host.querySelector
      ? host.querySelector(".sf-slider")
      : null;
    if (!slider) return;
    var ranges = slider.querySelectorAll('input[type="range"]');
    var numbers = host.querySelectorAll('input[type="number"]');
    if (ranges.length < 2 || numbers.length < 2) return;
    wrap.setAttribute("data-sf-price-sync", "1");
    var low = ranges[0];
    var high = ranges[1];
    var minInput = numbers[0];
    var maxInput = numbers[1];

    function syncFromNumbers(forceRewrite) {
      var boundMin = Number(low.min);
      var boundMax = Number(low.max);
      if (!Number.isFinite(boundMin) || !Number.isFinite(boundMax)) return;
      if (boundMax <= boundMin) return;
      var rawMin = String(minInput.value || "").trim();
      var rawMax = String(maxInput.value || "").trim();
      var parsedMin = rawMin === "" ? NaN : Number(rawMin);
      var parsedMax = rawMax === "" ? NaN : Number(rawMax);
      var a = rawMin === "" ? boundMin : parsedMin;
      var b = rawMax === "" ? boundMax : parsedMax;
      if (!Number.isFinite(a) || !Number.isFinite(b)) return;
      if (a < boundMin) a = boundMin;
      if (a > boundMax) a = boundMax;
      if (b < boundMin) b = boundMin;
      if (b > boundMax) b = boundMax;
      if (a > b) {
        if (!forceRewrite) return;
        var swap = a;
        a = b;
        b = swap;
      }
      low.value = String(a);
      high.value = String(b);
      /* Arrow keys already clamp via min/max; typed values do not — snap the
         field back when the number is finished (or out of range / on blur). */
      var minComplete =
        rawMin !== "" && Number.isFinite(parsedMin) && !/\.$/.test(rawMin);
      var maxComplete =
        rawMax !== "" && Number.isFinite(parsedMax) && !/\.$/.test(rawMax);
      var minOut =
        minComplete && (parsedMin < boundMin || parsedMin > boundMax);
      var maxOut =
        maxComplete && (parsedMax < boundMin || parsedMax > boundMax);
      if (minComplete && (forceRewrite || minOut) && minInput.value !== String(a)) {
        minInput.value = String(a);
      }
      if (maxComplete && (forceRewrite || maxOut) && maxInput.value !== String(b)) {
        maxInput.value = String(b);
      }
      refreshBoundSlider(slider);
    }

    minInput.addEventListener("input", function () {
      syncFromNumbers(false);
    });
    maxInput.addEventListener("input", function () {
      syncFromNumbers(false);
    });
    minInput.addEventListener("change", function () {
      syncFromNumbers(true);
    });
    maxInput.addEventListener("change", function () {
      syncFromNumbers(true);
    });
    minInput.addEventListener("blur", function () {
      syncFromNumbers(true);
    });
    maxInput.addEventListener("blur", function () {
      syncFromNumbers(true);
    });
  }

  function isFindlyLayoutShell(el) {
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
    /*
     * Accept the real product column (.sf-layout-main div). Do NOT call
     * isPageShellHost / isThemeManagedGrid here — those treat every
     * .sf-layout-main as a shell / display:grid host and blocked toolbar
     * placement (off-canvas: orphan .sf-sort-host after .collection).
     * Only reject grids wrongly stamped with sf-layout-main.
     */
    if (isProductGridLike(el) || isProductGridIdShell(el) || isResultsListEl(el)) {
      return false;
    }
    if (el.classList.contains("sf-layout-aside")) return false;
    if (el.classList.contains("smart-filter")) return false;
    if (el.classList.contains("sf-collection-layout")) return false;
    var id = String(el.id || "");
    if (id === "ProductGridContainer" || id === "CollectionProductGrid") {
      return false;
    }
    if (el.classList.contains("collection-wrapper")) return false;
    if (
      el.classList.contains("product-grid-container") &&
      !el.classList.contains("product-grid")
    ) {
      return false;
    }
    if (
      el.classList.contains("template-search__results") &&
      !isProductGridLike(el)
    ) {
      return false;
    }
    return true;
  }

  function isToolbarAnchorParent(el) {
    if (!el || el.nodeType !== 1) return false;
    if (!isColumnMain(el)) return false;
    /* Console verify showed toolbar parked on .sf-theme-width (sibling of layout). */
    if (el.classList) {
      if (el.classList.contains("sf-theme-width")) return false;
      if (el.classList.contains("sf-search-width")) return false;
      if (el.classList.contains("page-width")) return false;
      if (el.classList.contains("sf-collection-layout")) return false;
      if (el.classList.contains("sf-layout-aside")) return false;
    }
    return true;
  }

  /**
   * Collection parity: Sort + count live in `.sf-layout-main` above the listing
   * shell — never on `.sf-theme-width` / page-width (search console: toolbar path).
   */
  function ensureToolbarInColumnMain(widget) {
    var layout = document.querySelector(".sf-collection-layout");
    if (!layout) return null;
    var main =
      findColumnMainContaining(
        (widget && widget._gridParent) ||
          (widget && widget._themeGridShell) ||
          null,
      ) || null;
    if (!main || !isColumnMain(main)) {
      var mains = layout.querySelectorAll(":scope > .sf-layout-main, .sf-layout-main");
      var i;
      for (i = 0; i < mains.length; i++) {
        if (isColumnMain(mains[i])) {
          main = mains[i];
          break;
        }
      }
    }
    if (!main || !isColumnMain(main)) {
      var shellHint =
        (widget && widget._themeGridShell) ||
        layout.querySelector("[data-findly-grid-shell='1']") ||
        layout.querySelector(
          "#ProductGridContainer, #product-grid, .product-grid-container",
        );
      if (shellHint) main = ensureBlockMain(shellHint);
    }
    if (!main || !isColumnMain(main)) return null;
    if (main.classList) main.classList.add("sf-layout-main");
    var shell =
      (widget &&
        widget._themeGridShell &&
        main.contains(widget._themeGridShell) &&
        widget._themeGridShell) ||
      main.querySelector(":scope > [data-findly-grid-shell='1']") ||
      main.querySelector(
        ":scope > .collection, :scope > #ProductGridContainer, :scope > #product-grid, :scope > .product-grid-container, :scope > .template-search__results",
      ) ||
      main.querySelector("[data-findly-grid-shell='1']") ||
      main.querySelector(
        ":scope > .collection, #ProductGridContainer, #product-grid, .product-grid-container, .template-search__results",
      );
    var toolbar =
      document.querySelector(".sf-toolbar") ||
      layout.querySelector(".sf-toolbar") ||
      main.querySelector(".sf-toolbar");
    /* No toolbar yet — still return main so callers can build chrome above .collection. */
    if (!toolbar) return main;
    /* Always re-home toolbar into the product column before the listing shell. */
    if (shell && main.contains(shell)) {
      if (toolbar.parentNode !== main || toolbar.nextElementSibling !== shell) {
        safeInsertBefore(main, toolbar, shell);
      }
    } else {
      var listing = firstListingChildInMain(main);
      if (
        toolbar.parentNode !== main ||
        (listing && toolbar.nextSibling !== listing)
      ) {
        if (!safeInsertBefore(main, toolbar, listing || main.firstChild)) {
          if (toolbar.parentNode !== main) {
            main.insertBefore(toolbar, listing || main.firstChild);
          }
        }
      }
    }
    return main;
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
      "ul#product-grid, ol#product-grid, ul.product-grid, ol.product-grid," +
        " .sf-app-grid, .main-collection-grid, #product-grid, #ProductGrid",
    );
    if (precise && !isFindlyLayoutShell(precise)) {
      return resolveListingCardGrid(precise) || precise;
    }
    var grid = widget && widget._gridParent;
    if (
      grid &&
      !isFindlyLayoutShell(grid) &&
      (!main || main.contains(grid) || grid.contains(main))
    ) {
      return resolveListingCardGrid(grid) || grid;
    }
    try {
      var fallback =
        document.querySelector(
          "ul#product-grid, ol#product-grid, ul.product-grid, ol.product-grid," +
            " .sf-app-grid, .main-collection-grid, #product-grid, #ProductGrid",
        ) || scope.querySelector(PRODUCT_GRID_SELECTOR);
      return resolveListingCardGrid(fallback) || fallback;
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
    var grid =
      resolveListingCardGrid(collectionSearchGridEl(widget)) ||
      resolveListingCardGrid(widget && widget._gridParent) ||
      collectionSearchGridEl(widget) ||
      (widget && widget._gridParent);
    var shell =
      (widget && widget._themeGridShell) ||
      closestThemeGridShell(grid) ||
      (grid && isProductGridIdShell(grid) ? grid : null);
    var main = findColumnMainContaining(grid) || findColumnMainContaining(shell);
    if ((!main || !isToolbarAnchorParent(main)) && shell && shell.parentNode) {
      /* Match collection: ensure a real block `.sf-layout-main` around the shell. */
      main = ensureBlockMain(shell);
      if (main && main.classList && !isListingChromeHost(main)) {
        main.classList.add("sf-layout-main");
      }
    }
    if (main && isToolbarAnchorParent(main)) {
      var before =
        shell && main.contains(shell)
          ? shell
          : grid && main.contains(grid)
            ? grid
            : null;
      while (before && before.parentNode && before.parentNode !== main) {
        before = before.parentNode;
      }
      if (
        before &&
        isListingChromeHost(before.parentNode) &&
        main.contains(before.parentNode)
      ) {
        before = before.parentNode;
      }
      return { parent: main, before: before || main.firstChild };
    }
    var wrapped = ensureBlockMain(shell || grid);
    if (wrapped && isToolbarAnchorParent(wrapped)) {
      var beforeWrapped =
        (shell && wrapped.contains(shell) && shell) ||
        (grid && wrapped.contains(grid) && grid) ||
        wrapped.firstChild;
      return { parent: wrapped, before: beforeWrapped };
    }
    /* Never park toolbar on .sf-theme-width / page-width (search console bug). */
    return { parent: null, before: null };
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
    var fixedMain = ensureToolbarInColumnMain(widget);
    var loc = listingToolbarAnchor(widget);
    var parent =
      (fixedMain && isToolbarAnchorParent(fixedMain) && fixedMain) || loc.parent;
    var before = loc.before;
    if (!parent || parent.nodeType !== 1 || !isToolbarAnchorParent(parent)) {
      parent = ensureToolbarInColumnMain(widget);
      loc = listingToolbarAnchor(widget);
      before = loc.before;
    }
    /* Search console: toolbar path null — last-resort column main. */
    if (!parent || !isToolbarAnchorParent(parent)) {
      var layout = document.querySelector(".sf-collection-layout");
      var mains =
        layout &&
        layout.querySelectorAll(".sf-layout-main");
      var mi;
      for (mi = 0; mains && mi < mains.length; mi++) {
        if (isToolbarAnchorParent(mains[mi])) {
          parent = mains[mi];
          break;
        }
      }
      if (parent && isToolbarAnchorParent(parent)) {
        var shellHint =
          (widget && widget._themeGridShell) ||
          parent.querySelector(
            "[data-findly-grid-shell='1'], #ProductGridContainer, #product-grid, .product-grid-container, .template-search__results",
          );
        before =
          shellHint && parent.contains(shellHint)
            ? shellHint
            : parent.firstChild;
      }
    }
    if (!parent || !isToolbarAnchorParent(parent)) return;

    var host = document.querySelector(".sf-toolbar");
    if (!host) {
      host = document.createElement("div");
      host.className = "sf-toolbar";
    }
    /* If an old toolbar was left inside the grid shell, reuse it after hoist. */
    if (host.parentNode && isListingChromeHost(host.parentNode)) {
      /* will be moved below */
    }
    /* Always re-home: a toolbar already inside parent but after the listing
       used to be left there when `before` failed the direct-child check. */
    var anchor =
      before && before.parentNode === parent
        ? before
        : firstListingChildInMain(parent) || parent.firstChild;
    if (host.parentNode !== parent || (anchor && host.nextSibling !== anchor)) {
      if (!safeInsertBefore(parent, host, anchor)) {
        if (host.parentNode !== parent) {
          parent.insertBefore(host, anchor || parent.firstChild);
        }
      }
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
    ensureToolbarInColumnMain(widget);
    ensureListingChromeAboveProducts(widget);
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
        resolveListingCardGrid(this._gridParent) ||
        this._gridParent ||
        document.querySelector(PRODUCT_GRID_SELECTOR) ||
        findResultsList();
      var cardHost = preferProductCardGrid(parent) || parent;
      var cards = cardHost ? collectThemeCards(cardHost) : [];
      var fromCards = themeShowsNextPage()
        ? pageSizeInRange(cards.length)
        : 0;
      var fromPager = pageSizeFromPager();
      var fromAttrs = pageSizeFromDataAttrs(cardHost, this.root);
      var fromBlock = 0;
      try {
        fromBlock = pageSizeInRange(
          (this.root && this.root.getAttribute("data-page-size")) || "0",
        );
      } catch (err) {
        fromBlock = 0;
      }
      /*
       * Search: never trust data-page-size alone — Liquid used to set it from
       * search.results.size (hit total), which hid the pager when total≤pageSize.
       */
      var size = isSearchPageContext(this)
        ? fromCards || fromPager || fromAttrs || 16
        : fromCards || fromPager || fromAttrs || fromBlock || 16;
      this._themePageSize = size;
      this.pageSize = size;
      return this.pageSize;
    };

    var origEnsure = proto.ensureGridParent;
    proto.ensureGridParent = function () {
      if (this._gridParent && this._gridParent.isConnected === false) {
        ensureProductGridMounted(this);
      }
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

      // Sticky #findly-grid-host often wins before the theme grid is in the DOM.
      // Always prefer the live Liquid grid so app cards paint in-place (path A/B).
      if (!parent || parent.id === HOST_ID) {
        parent = reclaimThemeGridHost(this, parent) || parent;
      }

      if (parent && inAppMode) {
        parent = preferProductCardGrid(pickBetterGridHost(parent));
        if (parent && isResultsListEl(parent)) {
          parent = preferProductCardGrid(parent.parentElement || parent);
        }
        if (!parent || parent.id === HOST_ID) {
          parent = reclaimThemeGridHost(this, parent) || parent;
        }
      }

      if (parent && isPageShellHost(parent)) {
        var fromShell = queryInnerCardGrid(parent);
        if (fromShell) parent = fromShell;
        else parent = ensureThemeCardGridHost(this, parent) || parent;
      }
      stripAppGridFromPageShells(parent);

      if (parent && parent.id !== HOST_ID) {
        if (
          this._gridParent &&
          this._gridParent !== parent &&
          !isPageShellHost(parent)
        ) {
          moveCardsToHost(this._gridParent, parent);
        }
        showEl(parent);
        parent.removeAttribute("data-findly-orphan-hidden");
        this._gridParent = parent;
        rememberThemeGridShell(this, parent);
        lockThemeGridTracks(parent);
        ensureProductGridMounted(this);
        stripAppGridFromPageShells(this._gridParent || parent);
        placeCollectionSearchOnGrid(this);
        return this._gridParent || parent;
      }

      if (!inAppMode) {
        /* Never keep #findly-grid-host when not in admin app-grid mode — returning
           it blocks theme.discoverAnyThemeGrid() and causes dual listings. */
        if (this._gridParent && this._gridParent.id === HOST_ID) {
          this._gridParent = null;
        }
        var remounted = ensureProductGridMounted(this);
        placeCollectionSearchOnGrid(this);
        return remounted || null;
      }
      parent = reclaimThemeGridHost(this, parent);
      if (parent && parent.id !== HOST_ID) {
        lockThemeGridTracks(parent);
        ensureProductGridMounted(this);
        placeCollectionSearchOnGrid(this);
        return this._gridParent || parent;
      }
      if (results) {
        this._gridParent =
          preferProductCardGrid(results) || results.parentElement;
        lockThemeGridTracks(this._gridParent);
        ensureProductGridMounted(this);
        placeCollectionSearchOnGrid(this);
        return this._gridParent;
      }
      this._gridParent = fallbackHost();
      lockThemeGridTracks(this._gridParent);
      ensureProductGridMounted(this);
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
      try {
        if (
          !document.querySelector(
            ".sf-collection-layout[data-sf-layout-stable='1']",
          )
        ) {
          fitLayoutIntoThemeContainer(this);
        }
        ensureProductGridMounted(this);
        scheduleRelockProductGridTracks(this);
        portalMobileDrawer(this);
        mountFindlyPager(this);
        placeCollectionSearchOnGrid(this);
        ensureToolbarInColumnMain(this);
        ensureListingChromeAboveProducts(this);
        /* Hoist toolbar again after mount — search often leaves it in the shell. */
        var mainNow = ensureToolbarInColumnMain(this) || resolveColumnMain(this);
        ensureListingChromeAboveProducts(this);
        var shellNow =
          (this && this._themeGridShell) ||
          (mainNow &&
            (mainNow.querySelector("[data-findly-grid-shell='1']") ||
              mainNow.querySelector(
                ":scope > .collection, #ProductGridContainer, #product-grid, .product-grid-container",
              )));
        if (mainNow && shellNow && isColumnMain(mainNow)) {
          placeChromeBeforeListing(mainNow, shellNow);
        }
        ensureListingChromeAboveProducts(this);
        armListingChromeGuard(this);
        scheduleRelockProductGridTracks(this);
      } catch (syncErr) {
        try {
          gridLog("syncCollectionLayout post-hook failed", {
            message: String((syncErr && syncErr.message) || syncErr || ""),
          });
        } catch (logErr) {
          /* logging is best-effort */
        }
      }
      return layout;
    };

    var origHide = proto.hideNativeGridCards;
    proto.hideNativeGridCards = function (parent) {
      if (origHide) origHide.call(this, parent);
      hideNestedThemeCards(parent);
      /* Scoped rival hide only when stuck on synthetic host with app cards. */
      if (shouldHideCompetingThemeGrid(this, parent || this._gridParent)) {
        scheduleCompetingThemeHide(this, parent || this._gridParent);
      }
      setOwnsGrid(true);
    };

    var origRestore = proto.restoreNativeGrid;
    proto.restoreNativeGrid = function () {
      clearOrphanHideTimers(this);
      stripAppCards(document);
      restoreOrphanThemeOutside();
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
      ensureListingChromeAboveProducts(this);
      var el =
        this.totalCountEl ||
        document.querySelector(".sf-toolbar .sf-total-count") ||
        document.querySelector(".sf-total-count");
      var show = this.showTotalProductCount !== false;
      var n = Number(count);
      if (el) {
        this.totalCountEl = el;
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
      ensureListingChromeAboveProducts(this);
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
        if (!alreadyPaintedGrid(this)) {
          applyNativeFilterGrid(null, this._gridParent);
        }
        /* Empty theme grid: paint API products via .sf-app-card (no-op when
           Liquid already rendered cards). */
        ensureAppCardsIfThemeEmpty(this, handles, this._gridParent, false);
        markGridPainted(this);
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
      var listingRoot = document.querySelector("main, #MainContent") || document.body;
      var dawnListing = false;
      try {
        dawnListing = Boolean(
          listingRoot.querySelector(
            "#product-grid, .product-grid, #ProductGridContainer, #CollectionProductGrid, results-list, .main-collection-grid",
          ),
        );
      } catch (dawnErr) {
        dawnListing = false;
      }
      var themePcardGrid = dawnListing
        ? null
        : findRepeatedCardGrid(parent || listingRoot, 0);
      if (themePcardGrid) {
        this._gridParent = themePcardGrid;
        var themeFiltered =
          (this.hasActiveFilters && this.hasActiveFilters()) ||
          Boolean(this.collectionQuery) ||
          Boolean(this.searchQuery) ||
          Math.max(1, Number(this.page) || 1) > 1 ||
          Boolean(
            this.sortKey &&
              this.defaultSort &&
              this.sortKey !== this.defaultSort,
          );
        applyNativeFilterGrid(themeFiltered ? sliced.handles : null, themePcardGrid);
        if (this.setGridBusy) this.setGridBusy(false);
        this._loadingPage = false;
        return true;
      }
      if (!(this.isAppGridMode && this.isAppGridMode())) {
        mountCachedCards(this, sliced.handles, parent);
        if (shouldTakeOverThemeCards(this) || Math.max(1, Number(this.page) || 1) > 1) {
          applyNativeFilterGrid(sliced.handles, parent);
        } else {
          applyNativeFilterGrid(null, parent);
        }
        var shownNative = countAllowedInHost(parent, sliced.handles);
        var neededNative = uniqueAllowedCount(sliced.handles);
        if (neededNative > 0 && shownNative >= neededNative) {
          scheduleSwatchRestore(parent, this);
          return true;
        }
        fillGapsWithThemeClones(this, sliced.handles, parent);
        shownNative = countAllowedInHost(parent, sliced.handles);
        var themeCardsPresent = themeHostHasProductCards(parent);
        if (!shouldTakeOverThemeCards(this)) {
          /* Idle / keep-theme: leave working Liquid alone. */
          if (shownNative > 0 || themeCardsPresent) {
            scheduleSwatchRestore(parent, this);
            return true;
          }
          if (uniqueAllowedCount(sliced.handles) === 0) {
            scheduleSwatchRestore(parent, this);
            return true;
          }
          /* Empty Liquid host + API handles — fall through to DEFAULT
             .sf-app-card so collection pages are not blank (all themes). */
        } else {
          if (shownNative > 0) {
            scheduleSwatchRestore(parent, this);
            return true;
          }
          fillGapsWithThemeClones(this, sliced.handles, parent);
          shownNative = countAllowedInHost(parent, sliced.handles);
          if (shownNative > 0) {
            scheduleSwatchRestore(parent, this);
            return true;
          }
          /* Takeover hid Liquid cards but clones/cache missed — fall through to
             origApply (.sf-app-card) so search/filter pages still show a grid. */
          if (uniqueAllowedCount(sliced.handles) === 0) return true;
        }
      }
      /* Before painting .sf-app-card: reclaim / adopt the theme card list host
         (never leave sf-app-grid on a page shell — that hides #product-grid). */
      parent = reclaimThemeGridHost(this, parent) || parent;
      parent = ensureThemeCardGridHost(this, parent) || parent;
      stripAppGridFromPageShells(parent);
      if (parent) this._gridParent = parent;
      var ok = origApply
        ? origApply.call(this, sliced.data, sliced.handles, append)
        : false;
      parent = finalizeAppCardsInThemeGrid(
        this,
        this._gridParent || parent,
      ) || this._gridParent || parent;
      /* Last resort: synthetic host still in use → hide only that rival Liquid grid. */
      if (ok && shouldHideCompetingThemeGrid(this, parent)) {
        scheduleCompetingThemeHide(this, parent);
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
        var nativeHost = preferProductCardGrid(
          resolveCardHost(this._gridParent) || this._gridParent,
        );
        if (
          themeHostHasProductCards(nativeHost) ||
          countAllowedInHost(nativeHost, handles) > 0
        ) {
          return Promise.resolve(true);
        }
        /* Empty Liquid host — continue so seed / app-grid fallback can run. */
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
        ensureAppCardsIfThemeEmpty(this, handles, host, append);
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
        /* Takeover hid Liquid cards but cache/clones missed — fall through to
           applyAppGrid (.sf-app-card) so search/filter pages still show a grid. */
        if (
          this.applyAppGrid &&
          !(this.isAppGridMode && this.isAppGridMode())
        ) {
          this._skipPageSlice = true;
          var painted = false;
          try {
            painted = this.applyAppGrid(
              { products: this._lastProducts || [] },
              next,
              append,
            );
          } finally {
            this._skipPageSlice = false;
          }
          shown = countAllowedInHost(host, next);
          if (
            painted ||
            shown > 0 ||
            (this._shownHandles && this._shownHandles.length)
          ) {
            if (!(this._shownHandles && this._shownHandles.length)) {
              this._shownHandles = next.slice();
            }
            markGridPainted(this);
            if (this.setGridBusy && !this._importingCards) {
              this.setGridBusy(false);
            }
            return true;
          }
        }
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
            if (
              !opts.append &&
              !self._importingCards &&
              self._sfFlushListingScroll
            ) {
              self._sfFlushListingScroll();
            }
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
              if (self._sfFlushListingScroll) self._sfFlushListingScroll();
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
      clearOrphanHideTimers(this);
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
        /* Mount toolbar on the real column main first (collection parity). */
        placeCollectionSearchOnGrid(this);
        if (origPlaceSort) origPlaceSort.call(this);
        placeCollectionSearchOnGrid(this);
        var main = resolveColumnMain(this);
        var shell =
          (this && this._themeGridShell) ||
          (main &&
            (main.querySelector("[data-findly-grid-shell='1']") ||
              main.querySelector(
                ":scope > .collection, #ProductGridContainer, #product-grid, .product-grid-container",
              )));
        if (main && shell && isColumnMain(main)) {
          placeChromeBeforeListing(main, shell);
        }
        /* All layouts: keep toolbar/sort/count above the product listing. */
        ensureListingChromeAboveProducts(this);
        armListingChromeGuard(this);
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
      if (origBusy && origBusy !== proto.setGridBusy && (!host || !busy)) {
        origBusy.call(this, busy);
      }
    };

    proto.syncProductGrid = function (handles) {
      ensureProductGridMounted(this);
      var parent = resolveCardHost(
        this._gridParent ||
          (this.ensureGridParent && this.ensureGridParent()),
      );
      if (parent && parent.isConnected !== false) this._gridParent = parent;
      else parent = ensureProductGridMounted(this) || parent;
      if (parent && parent.isConnected !== false) this._gridParent = parent;
      /* afterGrid / fetch then often re-enter after the first paint — bail early
         so idle reloads do not hide/show/reorder Liquid cards again. */
      if (alreadyPaintedGrid(this) && !this._importingCards) {
        var shownFast = countAllowedInHost(parent, handles);
        /* Empty *filtered* results must still hide leftover cards on the
           already-painted fast path. Do not run this for unfiltered empty
           catalogs (would blank a theme with zero products incorrectly). */
        if (
          Array.isArray(handles) &&
          handles.length === 0 &&
          this.hasActiveFilters &&
          this.hasActiveFilters()
        ) {
          applyNativeFilterGrid(handles, parent);
          syncGridEmptyState(this, parent, handles, 0);
          placeCollectionSearchOnGrid(this);
          return;
        }
        var hasApp =
          this._appGridActive &&
          parent &&
          parent.querySelector &&
          parent.querySelector(".sf-app-card");
        if (
          shownFast === 0 &&
          !hasApp &&
          uniqueAllowedCount(handles) > 0 &&
          !themeHostHasProductCards(parent)
        ) {
          if (ensureAppCardsIfThemeEmpty(this, handles, parent, false)) {
            placeCollectionSearchOnGrid(this);
            return;
          }
        }
        syncGridEmptyState(this, parent, handles, shownFast);
        placeCollectionSearchOnGrid(this);
        return;
      }
      if (
        !shouldTakeOverThemeCards(this) &&
        Math.max(1, Number(this.page) || 1) <= 1 &&
        !this._loadingPage
      ) {
        applyNativeFilterGrid(null, parent);
        if (!ensureAppCardsIfThemeEmpty(this, handles, parent, false)) {
          markGridPainted(this);
          syncGridEmptyState(this, parent, null, 0);
        }
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
      /* applyVariantImages runs in afterGrid just before watchThemeGrid — repair swatches. */
      scheduleSwatchRestore(this._gridParent || document, this);
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
      /* Custom CSS lives here (companion) so schema JS stays under 100 KB.
         Only touch the style tag when customCss is present — partial search
         payloads must not wipe merchant CSS. */
      if (settings && typeof settings === "object" && "customCss" in settings && this.root) {
        var customCss =
          typeof settings.customCss === "string" ? settings.customCss.trim() : "";
        var customStyle = this.root.querySelector("style[data-findly-custom]");
        if (customCss) {
          if (!customStyle) {
            customStyle = document.createElement("style");
            customStyle.setAttribute("data-findly-custom", "");
            this.root.appendChild(customStyle);
          }
          customStyle.textContent = customCss;
        } else if (customStyle && customStyle.parentNode) {
          customStyle.parentNode.removeChild(customStyle);
        }
      }
      /* Merge admin Theme integration / templates into embedConfig.
         Live-store safe: only non-empty admin strings / quickview=true win.
         Empty admin defaults must NOT clear orphan theme-embed values that
         older themes still carry after the embed schema became toggle-only. */
      if (settings && typeof settings === "object") {
        var cfg = this.embedConfig || {};
        function takeStr(key, adminKey) {
          var adminKeyName = adminKey || key;
          if (
            typeof settings[adminKeyName] === "string" &&
            String(settings[adminKeyName]).trim()
          ) {
            cfg[key] = String(settings[adminKeyName]);
          }
        }
        takeStr("productGridSelector");
        /* Opt-in only — default false must not disable orphan embed quickview. */
        if (settings.useQuickviewTemplate === true) {
          cfg.useQuickviewTemplate = true;
        }
        takeStr("customJavascript");
        takeStr("treeTemplate");
        takeStr("sortTemplate");
        takeStr("searchTemplate");
        takeStr("variables", "templateVariables");
        this.embedConfig = cfg;
        if (cfg.productGridSelector) {
          this.root.setAttribute(
            "data-product-grid-selector",
            String(cfg.productGridSelector),
          );
        }
        if (cfg.useQuickviewTemplate) {
          this.root.setAttribute("data-use-quickview", "true");
        }
      }
      if (origApplySettings) origApplySettings.apply(this, arguments);
      if (settings && typeof settings === "object") {
        if ("offcanvasSide" in settings) {
          this.offcanvasSide =
            settings.offcanvasSide === "right" ? "right" : "left";
        } else if (this.offcanvasSide == null) {
          this.offcanvasSide = "left";
        }
        syncDrawerSideAttrs(this, liveDrawerPanel(this));
        if (shouldPortalDrawer(this)) {
          portalMobileDrawer(this);
        }
        /* Apply chrome / JS / quickview after settings merge when orphans were empty. */
        if (!this._embedChromeApplied && this.applyEmbedChrome) {
          this.applyEmbedChrome();
        }
        if (typeof this.maybeRunEmbedJs === "function") {
          this.maybeRunEmbedJs(this.embedConfig);
        }
        if (
          this.embedConfig &&
          this.embedConfig.useQuickviewTemplate &&
          this.ensureQuickviewButtons
        ) {
          this.ensureQuickviewButtons();
        }
      }
    };

    var origHideChrome = proto.hideThemeDuplicateChrome;
    proto.hideThemeDuplicateChrome = function () {
      if (nativeHideKilled()) return;
      if (this._sfChromeHiddenReq === this._reqId && this._reqId) return;
      this._sfChromeHiddenReq = this._reqId;
      if (origHideChrome) return origHideChrome.apply(this, arguments);
    };

    var origFetchFilters = proto.fetchFilters;
    proto.fetchFilters = function () {
      this._findlyFilterFailed = false;
      var result = origFetchFilters
        ? origFetchFilters.apply(this, arguments)
        : null;
      var self = this;
      var started = self._reqId;
      if (result && typeof result.then === "function") {
        result.then(
          function (value) {
            self._findlyFilterFailed = false;
            return value;
          },
          function (err) {
            if (self._reqId !== started) throw err;
            self._findlyFilterFailed = true;
            restoreHiddenCards(self);
            findlyLog("takeover", "request-failed");
            throw err;
          },
        );
      }
      return result;
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

    /* Arrow keys honor input min/max; typed values do not. Clamp before apply
       so Price / Sale range fields snap to catalog bounds (e.g. max 15). */
    var origApplyRange = proto.applyRangeValues;
    proto.applyRangeValues = function (facet, min, max, isProductPrice) {
      var nextMin = min == null ? "" : String(min);
      var nextMax = max == null ? "" : String(max);
      var boundMin = Number(facet && facet.min);
      var boundMax = Number(facet && facet.max);
      if (
        Number.isFinite(boundMin) &&
        Number.isFinite(boundMax) &&
        boundMax > boundMin
      ) {
        if (nextMin !== "") {
          var nMin = Number(nextMin);
          if (Number.isFinite(nMin)) {
            if (nMin < boundMin) nMin = boundMin;
            if (nMin > boundMax) nMin = boundMax;
            nextMin = String(nMin);
          }
        }
        if (nextMax !== "") {
          var nMax = Number(nextMax);
          if (Number.isFinite(nMax)) {
            if (nMax < boundMin) nMax = boundMin;
            if (nMax > boundMax) nMax = boundMax;
            nextMax = String(nMax);
          }
        }
        if (nextMin !== "" && nextMax !== "") {
          var a = Number(nextMin);
          var b = Number(nextMax);
          if (Number.isFinite(a) && Number.isFinite(b) && a > b) {
            nextMin = String(b);
            nextMax = String(a);
          }
        }
      }
      if (!origApplyRange) return;
      return origApplyRange.call(this, facet, nextMin, nextMax, isProductPrice);
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
      wirePriceInputsToSlider(wrap);
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
    installGridDebugApi();
    bindFindlyChangeCapture();
    bindHashChange();
    bootEarlyGridBusy();
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", bootEarlyGridBusy);
    }
    bindProductGridViewportRelock();
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
