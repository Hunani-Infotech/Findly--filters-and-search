/**
 * Theme-agnostic storefront glue.
 * Discovers product grids, native filter chrome, and layout hosts on any
 * theme instead of relying on Dawn/Horizon class names alone.
 * Loaded from Liquid via asset_url (not counted against the 100 KB schema cap).
 */
(function () {
  "use strict";

  /* Default-off. One check; prototypes stay untouched unless the flag is on.
     Runs at theme-script eval, before smart-filter.min.js boots the widget. */
  var sfTraceWanted = false;
  try {
    sfTraceWanted =
      /(?:^|[?&])sf_trace=1(?:&|$)/.test(String(window.location.search || "")) ||
      window.sessionStorage.getItem("sf_trace") === "1";
  } catch (sfTraceErr) {
    sfTraceWanted = false;
  }
  if (sfTraceWanted) {
    var SF_TRACE_SEL =
      "results-list, #ResultsList, .collection-wrapper, #smart-filter-embed, #smart-filter-root, link[href*='smart-filter']";
    window.__FINDLY_TRACE_LOG = [];
    function sfTraceWatched(node) {
      if (!node || node.nodeType !== 1) return false;
      var id = node.id || "";
      if (
        id === "ResultsList" ||
        id === "smart-filter-embed" ||
        id === "smart-filter-root"
      ) {
        return true;
      }
      var tag = String(node.tagName || "").toLowerCase();
      if (tag === "results-list") return true;
      if (node.classList && node.classList.contains("collection-wrapper")) return true;
      if (tag === "link" && String(node.getAttribute("href") || "").indexOf("smart-filter") !== -1) {
        return true;
      }
      return false;
    }
    function sfTraceHit(node) {
      if (!node || node.nodeType !== 1) return null;
      if (sfTraceWatched(node)) return node;
      if (!node.querySelector) return null;
      try {
        return node.querySelector(SF_TRACE_SEL);
      } catch (err) {
        return null;
      }
    }
    function sfTraceDescribe(node) {
      if (!node || node.nodeType !== 1) return String(node);
      var tag = String(node.tagName || "").toLowerCase();
      var desc = tag;
      if (node.id) desc += "#" + node.id;
      if (node.classList && node.classList.length) {
        desc += "." + String(node.className || "").trim().split(/\s+/).slice(0, 3).join(".");
      }
      if (tag === "link") desc += " " + String(node.getAttribute("href") || "");
      return desc;
    }
    function sfTracePush(op, node) {
      var stack = "";
      try {
        throw new Error("sf-trace");
      } catch (err) {
        stack = String((err && err.stack) || "")
          .split("\n")
          .slice(2, 6)
          .join(" | ");
      }
      var entry = { op: op, node: sfTraceDescribe(node), stack: stack };
      var log = window.__FINDLY_TRACE_LOG;
      log.push(entry);
      if (log.length > 50) log.shift();
      console.warn("[SF-TRACE] " + op + " " + entry.node);
      console.trace();
    }
    function sfTraceNote(op, node, removing, parent) {
      var hit = sfTraceHit(node);
      if (!hit || hit.isConnected === false) return;
      if (removing) {
        sfTracePush(op, hit);
        return;
      }
      if (parent && parent.isConnected === false) sfTracePush(op, hit);
    }
    function sfTraceArgs(op, parent, args, removing) {
      var i;
      for (i = 0; i < args.length; i++) {
        var arg = args[i];
        if (!arg || arg.nodeType !== 1) continue;
        sfTraceNote(op, arg, removing, parent);
      }
    }
    function sfTraceWrap(proto, name, before) {
      if (!proto) return;
      var orig = proto[name];
      if (typeof orig !== "function" || orig.__sfTrace) return;
      var wrapped = function () {
        try {
          before(this, arguments);
        } catch (err) {
          /* tracer must not break the DOM call */
        }
        return orig.apply(this, arguments);
      };
      wrapped.__sfTrace = true;
      try {
        proto[name] = wrapped;
      } catch (err) {
        /* method is not writable */
      }
    }
    function sfTracePatchSetter(proto, prop) {
      var desc;
      try {
        desc = Object.getOwnPropertyDescriptor(proto, prop);
      } catch (err) {
        desc = null;
      }
      if (!desc || typeof desc.set !== "function" || desc.set.__sfTrace) return;
      var origSet = desc.set;
      var setter = function (value) {
        try {
          if (this && this.isConnected !== false) sfTraceNote(prop, this, true, null);
        } catch (err) {
          /* tracer must not break the DOM call */
        }
        return origSet.call(this, value);
      };
      setter.__sfTrace = true;
      try {
        Object.defineProperty(proto, prop, {
          configurable: true,
          enumerable: desc.enumerable,
          get: desc.get,
          set: setter,
        });
      } catch (err) {
        /* setter is not configurable */
      }
    }
    var sfTraceParentProtos = [Node.prototype, Element.prototype, Document.prototype, DocumentFragment.prototype];
    var sfTracePi;
    for (sfTracePi = 0; sfTracePi < sfTraceParentProtos.length; sfTracePi++) {
      sfTraceWrap(sfTraceParentProtos[sfTracePi], "appendChild", function (parent, args) {
        if (args[0]) sfTraceNote("appendChild", args[0], false, parent);
      });
      sfTraceWrap(sfTraceParentProtos[sfTracePi], "insertBefore", function (parent, args) {
        if (args[0]) sfTraceNote("insertBefore", args[0], false, parent);
      });
      sfTraceWrap(sfTraceParentProtos[sfTracePi], "append", function (parent, args) {
        sfTraceArgs("append", parent, args, false);
      });
      sfTraceWrap(sfTraceParentProtos[sfTracePi], "prepend", function (parent, args) {
        sfTraceArgs("prepend", parent, args, false);
      });
      sfTraceWrap(sfTraceParentProtos[sfTracePi], "removeChild", function (parent, args) {
        if (args[0]) sfTraceNote("removeChild", args[0], true, null);
      });
      sfTraceWrap(sfTraceParentProtos[sfTracePi], "replaceChild", function (parent, args) {
        if (args[1]) sfTraceNote("replaceChild", args[1], true, null);
        sfTraceNote("replaceChild", args[0], false, parent);
      });
      sfTraceWrap(sfTraceParentProtos[sfTracePi], "remove", function (node) {
        sfTraceNote("remove", node, true, null);
      });
      sfTraceWrap(sfTraceParentProtos[sfTracePi], "replaceWith", function (node) {
        sfTraceNote("replaceWith", node, true, null);
      });
      sfTraceWrap(sfTraceParentProtos[sfTracePi], "replaceChildren", function (node) {
        sfTraceNote("replaceChildren", node, true, null);
      });
    }
    sfTracePatchSetter(Element.prototype, "innerHTML");
    sfTracePatchSetter(Element.prototype, "outerHTML");
    sfTracePatchSetter(Node.prototype, "textContent");
  }

  var STYLE_ID = "findly-theme-compat-v13";
  var SKIP =
    "header, footer, .header, .footer, .announcement-bar, .shopify-section-group-header-group, product-recommendations, .related-products, [data-related-products], .recently-viewed, .predictive-search, .quick-add-modal, .complementary-products, .collection-banner, .collection-hero, .slideshow";
  var PROTECT =
    ".smart-filter, .smart-filter-search, .findly-instant, .sf-panel, .sf-facet, .sf-facets, .sf-header, .sf-backdrop, .sf-toolbar, .sf-sort-host, .sf-search-host, .sf-total-count, .sf-pager, .sf-app-card, .sf-collection-layout";
  var NATIVE_INPUT =
    "[name^='filter.'], [name^='filter.v.'], [name^='filter.p.'], select[name='sort_by'], select[name='sortBy']";
  var PAGER_HINT =
    "nav.pagination, .pagination, .pagination-wrapper, [data-pagination], .paginate, #pagination, load-more-button, .load-more-button, [data-load-more], .ajaxinate-pagination, #AjaxinatePagination, .Pagination, .infinite-scroll, .js-load-more, .btn--load-more, .pagination__load-more";
  var PRODUCT_LIST =
    "#ResultsList, #product-grid, #ProductGrid, ul.product-grid, ol.product-grid, .product-grid, [data-product-grid]";
  var hidePassDisabled = false;
  var hideTimer = 0;
  var guardTimer = 0;
  var hideObserver = null;
  window.__FINDLY_FACET_HIDE_SELECTOR = [
    ".facets__wrapper",
    "#FacetsWrapperDesktop",
    ".facets-vertical-form",
    "#main-collection-filters",
    ".facets-wrapper",
    ".mobile-facets__wrapper",
    ".active-facets-desktop",
    ".active-facets-mobile",
    "facet-filters-form details",
    ".facets details.facets__disclosure",
    "details.facets__panel",
    ".facets__panel",
    "dropdown-facet",
    "facet-dropdown",
    "facet-status-component",
    "facets-form-component",
    "facets-form",
    "filter-form",
    "facet-form",
    ".facets__form-wrapper",
    "facets-form .facets",
    ".facet-filters",
    ".facets-container .facets",
    ".facets-header",
    ".facets-toolbar",
    ".facets--bar",
    ".facets-horizontal",
    ".collection-filters",
    ".product-filters",
    ".filters-toolbar",
    "price-range",
    ".price-range",
    "[class*='active-facets']",
    ".facets-block-wrapper",
    ".facets-toggle",
    ".facets--horizontal",
    ".facets--vertical",
    ".facets-mobile-wrapper",
    ".facets:not(.smart-filter)",
  ].join(", ");
  window.__FINDLY_SORT_HIDE_SELECTOR = [
    "select[name='sort_by']",
    "select[name='sortBy']",
    ".facet-filters__sort",
    ".facet-filters.sorting",
    "#SortBy",
    "#sort-by",
    "[data-sort-by]",
    ".collection-sort",
    "sort-by-select",
    "sorting-filter-component",
    ".sorting-filter",
    ".sorting-filter__container",
    ".sorting-filter-component",
  ].join(", ");
  window.__FINDLY_PAGER_SELECTOR = [
    "nav.pagination",
    ".pagination",
    ".pagination-wrapper",
    "[data-pagination]",
    ".paginate",
    "#pagination",
    ".Pagination",
    "#AjaxinatePagination",
    ".ajaxinate-pagination",
    "load-more-button",
    ".load-more-button",
    ".pagination__load-more",
    "[data-load-more]",
    "button[name='load-more']",
  ].join(", ");
  window.__FINDLY_COUNT_SELECTOR = [
    "#ProductCount",
    "#ProductCountDesktop",
    ".product-count__text",
    ".product-count",
    "[data-product-count]",
    ".products-count-wrapper",
    "[data-testid='products-count']",
    ".collection-product-count",
    ".product-count-vertical",
    ".facets__product-count",
    ".filter-count-bubble__text",
  ].join(", ");
  window.__FINDLY_GRID_HINT = [
    "ul#product-grid",
    "ol#product-grid",
    "ul.product-grid",
    "ol.product-grid",
    "ul[id*='product-grid']",
    "ul[class*='product-grid']",
    "[data-id='product-grid']",
    "[data-product-grid]",
    "[product-grid-view]",
    ".grid.product-grid",
    "#product-grid",
    ".product-grid",
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
    ".boost-sd-grid",
    ".sf-grid",
    "results-list",
    ".results-list",
  ].join(", ");

  function themeAdapter() {
    var theme = window.Shopify && window.Shopify.theme;
    var name = theme ? String(theme.schema_name || theme.name || "") : "";
    if (name === "Dawn") {
      return {
        grid: "ul#product-grid, ol#product-grid",
        card: "li.grid__item",
        filter: "#FacetsWrapperDesktop, facet-filters-form, #main-collection-filters",
        header: "#header-group, .shopify-section-group-header-group",
        searchTitle: ".template-search__header, .search-page__header",
      };
    }
    if (name === "Horizon") {
      return {
        grid: "#ResultsList ul.product-grid, ul.product-grid",
        card: "li.product-grid__item",
        filter: "facets-form-component, #filters-drawer, .facets-block-wrapper",
        header: "#header-group, .shopify-section-group-header-group",
        searchTitle: ".search-page__header",
      };
    }
    return null;
  }

  function findlyDebug() {
    try {
      return /(?:^|[?&])findly_debug=1(?:&|$)/.test(window.location.search);
    } catch (err) {
      return false;
    }
  }

  function findlyLog(pass, why, extra) {
    if (!findlyDebug()) return;
    console.info("[findly]", pass, why, extra || "");
  }

  function nativeHideKilled() {
    var root =
      document.getElementById("smart-filter-root") ||
      document.getElementById("smart-filter-embed");
    return Boolean(
      root && root.getAttribute("data-findly-disable-native-hide") === "true",
    );
  }

  /* Default off. Liquid sets the class from the app metafield; the filters
     payload can set widget.storefrontV2 after the first response. */
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

  function pageKind() {
    var path = "";
    try {
      path = window.location.pathname || "";
    } catch (err) {
      path = "";
    }
    return /\/search\/?$/.test(path) || path.indexOf("/search") !== -1
      ? "search"
      : "collection";
  }

  function themeName() {
    var theme = window.Shopify && window.Shopify.theme;
    return theme ? String(theme.schema_name || theme.name || "") : "";
  }

  function findlyMetric(name, detail) {
    var bag = window.__FINDLY_COUNTS || (window.__FINDLY_COUNTS = {});
    bag[name] = (bag[name] || 0) + 1;
    console.info("[findly-metric]", name, bag[name], detail || "");
    var sent = window.__FINDLY_METRIC_SENT || (window.__FINDLY_METRIC_SENT = {});
    var key = String(name) + "|" + String(detail || "");
    var now = Date.now();
    if (sent[key] && now - sent[key] < 60000) return;
    sent[key] = now;
    var block =
      document.getElementById("smart-filter-root") ||
      document.getElementById("smart-filter-embed");
    var base =
      (block && block.getAttribute && block.getAttribute("data-proxy-base")) ||
      "/apps/smart-filter";
    var shop = (window.Shopify && window.Shopify.shop) || "";
    var url =
      String(base).replace(/\/$/, "") +
      "/analytics?kind=" +
      encodeURIComponent(name) +
      "&shop=" +
      encodeURIComponent(shop) +
      "&q=" +
      encodeURIComponent(pageKind()) +
      "&handle=" +
      encodeURIComponent(themeName()) +
      "&combo=" +
      encodeURIComponent(
        "flag=" + (storefrontV2() ? "1" : "0") + "|" + String(detail || name),
      );
    try {
      if (typeof navigator.sendBeacon === "function") {
        navigator.sendBeacon(url);
        return;
      }
    } catch (err) {
      /* fall through */
    }
    try {
      fetch(url, { method: "GET", keepalive: true, credentials: "same-origin", mode: "no-cors" }).catch(
        function () {},
      );
    } catch (err2) {
      /* ignore */
    }
  }

  function clearStorefrontV2Timer() {
    if (window.__FINDLY_V2_TIMER) {
      window.clearTimeout(window.__FINDLY_V2_TIMER);
      window.__FINDLY_V2_TIMER = 0;
    }
    if (window.__findlyLoadingRelease) {
      window.clearTimeout(window.__findlyLoadingRelease);
      window.__findlyLoadingRelease = 0;
    }
  }

  function armStorefrontV2Failsafe() {
    if (!storefrontV2()) return;
    if (window.__FINDLY_V2_FAILSAFE) return;
    window.__FINDLY_V2_FAILSAFE = true;
    window.__FINDLY_V2_TIMER = window.setTimeout(function () {
      window.__FINDLY_V2_TIMER = 0;
      if (!storefrontV2()) return;
      window.__FINDLY_LOADING_SETTLED = true;
      var root = document.documentElement;
      if (!root || !root.classList) return;
      root.classList.remove("sf-filter-loading");
      if (!root.classList.contains("sf-filter-ready")) {
        root.classList.add("sf-filter-ready");
      }
    }, 3000);
  }

  /* adminExtras on the filters payload is the source of truth once it arrives.
     The metafield only paints the class before that response. */
  function applyStorefrontV2Flag(widget, settings) {
    if (!widget || !settings) return;
    var on = settings.storefrontV2 === true;
    var root = document.documentElement;
    var block =
      widget.root ||
      document.getElementById("smart-filter-root") ||
      document.getElementById("smart-filter-embed");
    var had =
      Boolean(widget.storefrontV2) ||
      Boolean(root && root.classList && root.classList.contains("sf-storefront-v2")) ||
      Boolean(block && block.getAttribute && block.getAttribute("data-findly-storefront-v2") === "true");
    widget.storefrontV2 = on;
    if (root && root.classList) {
      if (on) root.classList.add("sf-storefront-v2");
      else root.classList.remove("sf-storefront-v2");
    }
    if (block && block.setAttribute) {
      block.setAttribute("data-findly-storefront-v2", on ? "true" : "false");
    }
    if (on) {
      armStorefrontV2Failsafe();
    } else {
      clearStorefrontV2Timer();
      window.__FINDLY_V2_FAILSAFE = false;
    }
    if (had === on) return;
    restoreAllHideTags();
    if (on) scheduleHidePass("flag-on");
    else hideNativeChromeHeuristic();
  }

  function isFindlyUi(el) {
    if (!el || el.nodeType !== 1) return false;
    if (el.closest) return Boolean(el.closest(PROTECT));
    return false;
  }

  function isSkipped(el) {
    if (!el || el.nodeType !== 1) return false;
    if (el.closest) return Boolean(el.closest(SKIP));
    return false;
  }

  /**
   * Custom collection shells (Keeling `.ko .coll`, and any main section whose
   * id ends in `__grid`) have no Dawn `#product-grid`. The embed must sit in
   * that section, under the hero — not as the first child of `<main>`.
   */
  function customCollectionColumn() {
    var sections = document.querySelectorAll(
      "#MainContent [id$='__grid'], main [id$='__grid'], [role='main'] [id$='__grid']",
    );
    var i;
    for (i = 0; i < sections.length; i++) {
      var sec = sections[i];
      if (!sec || isSkipped(sec)) continue;
      var coll = sec.querySelector(".ko .coll") || sec.querySelector(".coll");
      if (!coll) continue;
      if (coll.querySelector("#filters, #ko-sort, #ko-filters, .ko-filters")) return coll;
    }
    return document.querySelector("#MainContent .ko .coll, main .ko .coll");
  }

  function isCustomProductColumn(el) {
    if (!el || el.nodeType !== 1) return false;
    if (el.id === "filters" || el.id === "ko-filters" || el.id === "ko-sort") return false;
    if (el.closest && el.closest("#filters, #ko-filters")) return false;
    var coll = el.closest ? el.closest(".ko .coll, .coll") : null;
    if (!coll || !coll.querySelector("#filters, #ko-filters")) return false;
    if (el === coll) return true;
    var aside = coll.querySelector("#filters");
    if (!aside) return false;
    var column = aside.nextElementSibling;
    return Boolean(column && (el === column || column.contains(el)));
  }

  function hostDisplay(el) {
    try {
      if (typeof window.getComputedStyle === "function") {
        return String(window.getComputedStyle(el).display || "").toLowerCase();
      }
    } catch (err) {
      /* ignore */
    }
    return "";
  }

  function isFragileHost(el) {
    if (!el || el.nodeType !== 1) return false;
    var tag = String(el.tagName || "").toLowerCase();
    if (
      tag === "results-list" ||
      tag === "product-list" ||
      tag === "grid-list" ||
      tag === "media-grid" ||
      tag === "collection-list"
    ) {
      return true;
    }
    var display = hostDisplay(el);
    if (display === "contents") return true;
    var cls = " " + String(el.className || "") + " ";
    return / collection-wrapper | main-collection-grid | collection__content | product-grid-container /.test(
      cls,
    );
  }

  function productHref(href) {
    if (!href) return "";
    try {
      var match = String(href).match(/\/products\/([^/?#]+)/i);
      return match ? decodeURIComponent(match[1]).toLowerCase() : "";
    } catch (err) {
      return "";
    }
  }

  function cardFromLink(link) {
    if (!link || !link.closest) return link;
    var card = link.closest(
      "product-card, product-item, grid-item, li.grid__item, .product-card, .product-item, .grid-product, .grid-view-item, .product-block, .productitem, .product-grid-item, .product-grid__item, .card-wrapper, .card, .card--product, [data-product-handle], [data-product-id], article, li",
    );
    return card || link.parentElement || link;
  }

  function clusterScore(parent) {
    if (!parent || parent.nodeType !== 1) return 0;
    if (!parent.querySelectorAll) return 0;
    var links = parent.querySelectorAll('a[href*="/products/"]');
    var seen = {};
    var n = 0;
    var i;
    for (i = 0; i < links.length; i++) {
      if (isSkipped(links[i]) || isFindlyUi(links[i])) continue;
      var handle = productHref(links[i].getAttribute("href"));
      if (!handle || seen[handle]) continue;
      seen[handle] = true;
      n += 1;
    }
    return n;
  }

  function productHandleCount(el) {
    if (!el || !el.querySelectorAll) return 0;
    var links = el.querySelectorAll('a[href*="/products/"]');
    var seen = {};
    var n = 0;
    var i;
    for (i = 0; i < links.length; i++) {
      if (isSkipped(links[i]) || isFindlyUi(links[i])) continue;
      var handle = productHref(links[i].getAttribute("href"));
      if (!handle || seen[handle]) continue;
      seen[handle] = true;
      n += 1;
      if (n > 1) return n;
    }
    return n;
  }

  function repeatedCardCount(el) {
    if (!el || !el.children) return 0;
    var n = 0;
    var i;
    for (i = 0; i < el.children.length; i++) {
      var child = el.children[i];
      if (!child || child.nodeType !== 1 || isSkipped(child) || isFindlyUi(child)) continue;
      if (productHandleCount(child) === 1) n += 1;
    }
    return n;
  }

  function bestRepeatedGrid(scope) {
    var best = null;
    var bestCount = 1;
    function walk(el, depth) {
      if (!el || el.nodeType !== 1 || depth > 8 || isSkipped(el) || isFindlyUi(el)) return;
      var count = repeatedCardCount(el);
      if (count > bestCount) {
        best = el;
        bestCount = count;
      }
      var kids = el.children;
      var i;
      for (i = 0; kids && i < kids.length; i++) walk(kids[i], depth + 1);
    }
    walk(scope, 0);
    return best;
  }

  function isDawnGrid(el) {
    if (!el || !el.closest) return false;
    try {
      return Boolean(
        el.matches(
          "#product-grid, .product-grid, #ProductGridContainer, #CollectionProductGrid, #main-collection-product-grid, results-list, .product-grid-container, .main-collection-grid",
        ) ||
          el.closest(
            "#product-grid, .product-grid, #ProductGridContainer, #CollectionProductGrid, results-list, .main-collection-grid",
          ),
      );
    } catch (err) {
      return false;
    }
  }

  /**
   * Where the filter bar sits, and which node is the theme's own card list.
   * Dawn/Horizon grids return null so the existing layout path is unchanged.
   * Any other theme uses the list of repeated product cards.
   */
  function mainHasDawnGrid(main) {
    if (!main || !main.querySelector) return false;
    try {
      return Boolean(
        main.querySelector(
          "#product-grid, .product-grid, #ProductGridContainer, #CollectionProductGrid, #main-collection-product-grid, results-list, .product-grid-container, .main-collection-grid",
        ),
      );
    } catch (err) {
      return false;
    }
  }

  function nativeListingAnchor() {
    var main =
      document.querySelector("main, #MainContent, [role='main']") || document.body;
    if (mainHasDawnGrid(main)) return null;
    var column = customCollectionColumn();
    if (column) {
      var inside = bestRepeatedGrid(column);
      if (inside && !isDawnGrid(inside)) return { grid: inside, before: column };
    }
    var grid = bestRepeatedGrid(main);
    if (!grid || isDawnGrid(grid)) return null;
    return { grid: grid, before: grid };
  }

  function discoverAnyThemeGrid() {
    var scope =
      document.querySelector(
        "main, #MainContent, #main, [role='main'], #PageContainer, .main-content",
      ) || document.body;
    if (!scope || !scope.querySelectorAll) return null;
    var links = scope.querySelectorAll('a[href*="/products/"]');
    var tally = [];
    var i;
    for (i = 0; i < links.length; i++) {
      var link = links[i];
      if (isSkipped(link) || isFindlyUi(link)) continue;
      if (!productHref(link.getAttribute("href"))) continue;
      var card = cardFromLink(link);
      var parent = card && card.parentElement;
      if (!parent || parent.nodeType !== 1) continue;
      if (isSkipped(parent) || isFindlyUi(parent)) continue;
      var group = null;
      var t;
      for (t = 0; t < tally.length; t++) {
        if (tally[t].parent === parent) {
          group = tally[t];
          break;
        }
      }
      if (!group) {
        group = { parent: parent, count: 0 };
        tally.push(group);
      }
      group.count += 1;
    }
    var best = null;
    var bestCount = 0;
    for (i = 0; i < tally.length; i++) {
      if (tally[i].count > bestCount) {
        best = tally[i].parent;
        bestCount = tally[i].count;
      }
    }
    if (best && bestCount >= 1) return best;
    return null;
  }

  function tagOf(el) {
    return String((el && el.tagName) || "").toLowerCase();
  }

  function containsProductList(el) {
    if (!el || el.nodeType !== 1) return false;
    try {
      if (el.matches && el.matches(PRODUCT_LIST)) return true;
      if (el.querySelector) return Boolean(el.querySelector(PRODUCT_LIST));
    } catch (err) {
      return false;
    }
    return false;
  }

  /* True when the node matched [class*=filter] only because of an app class. */
  function appFilterClassOnly(el) {
    var raw = el && el.className;
    var cls = typeof raw === "string" ? raw : (raw && raw.baseVal) || "";
    var tokens = String(cls).split(/\s+/);
    var app = false;
    var theme = false;
    var i;
    for (i = 0; i < tokens.length; i++) {
      var token = tokens[i];
      if (!token) continue;
      if (/^(sf-|findly-)/i.test(token)) {
        if (/filter|facet/i.test(token)) app = true;
      } else if (/filter|facet/i.test(token)) {
        theme = true;
      }
    }
    var id = String((el && el.id) || "");
    if (id && /filter|facet/i.test(id) && !/^(sf-|findly-)/i.test(id)) theme = true;
    var tag = tagOf(el);
    if (tag === "form" || tag === "aside") return false;
    return app && !theme;
  }

  function hideLeaf(el) {
    if (!el || el.nodeType !== 1) return;
    var leaveWidget = window.__FINDLY_FILTER_WIDGET;
    if (leaveWidget && leaveWidget._sfLeaveNative) return;
    if (hidePassDisabled || nativeHideKilled()) return;
    var tag = tagOf(el);
    if (storefrontV2()) {
      if (tag === "html" || tag === "body" || tag === "head" || tag === "main" || tag === "header" || tag === "footer") {
        return;
      }
      if (containsProductList(el)) return;
    }
    if (isFindlyUi(el) || isSkipped(el)) return;
    if (isCustomProductColumn(el)) return;
    if (el.getAttribute("data-findly-native-chrome") === "1") return;
    if (el.querySelector && el.querySelector(".smart-filter, .sf-panel, .sf-app-card, .sf-pager")) {
      return;
    }
    try {
      if (
        el.matches &&
        (el.matches(PAGER_HINT) || (el.closest && el.closest(PAGER_HINT)))
      ) {
        // Theme owns pagination chrome; never hide it via native-chrome heuristic.
        return;
      }
    } catch (err) {
      /* ignore */
    }
    if (clusterScore(el) >= 2) return;
    el.setAttribute("data-findly-native-chrome", "1");
    el.setAttribute("data-findly-theme-hidden", "1");
    el.setAttribute("hidden", "");
    el.style.setProperty("display", "none", "important");
  }

  function holdsCustomCollection(el) {
    if (isCustomProductColumn(el)) return true;
    if (!el || el.nodeType !== 1 || !el.querySelector) return false;
    var coll = el.querySelector(".ko .coll, .coll");
    return Boolean(coll && coll.querySelector("#filters, #ko-filters"));
  }

  /* Flag on: hide the matched facet container only. Flag off: the released
     child walk, so a page that hides theme facets today still does. */
  function hideIfChrome(el) {
    if (!el || el.nodeType !== 1) return;
    if (hidePassDisabled || nativeHideKilled()) return;
    if (isFindlyUi(el) || isSkipped(el)) return;
    if (!storefrontV2()) {
      if (holdsCustomCollection(el) && el.id !== "filters" && el.id !== "ko-filters") {
        var kids = el.children;
        var i;
        for (i = 0; i < kids.length; i++) hideIfChrome(kids[i]);
        return;
      }
      if (clusterScore(el) >= 2) {
        var children = el.children;
        var j;
        for (j = 0; j < children.length; j++) hideIfChrome(children[j]);
        return;
      }
      hideLeaf(el);
      return;
    }
    if (containsProductList(el)) return;
    if (holdsCustomCollection(el) && el.id !== "filters" && el.id !== "ko-filters") return;
    hideLeaf(el);
  }

  function restoreHideTag(el) {
    if (!el || el.nodeType !== 1) return;
    el.removeAttribute("data-findly-theme-hidden");
    el.removeAttribute("data-findly-native-chrome");
    el.removeAttribute("hidden");
    el.hidden = false;
    if (el.classList) el.classList.remove("hidden");
    if (el.style) el.style.removeProperty("display");
  }

  function restoreAllHideTags() {
    var nodes = document.querySelectorAll(
      "[data-findly-theme-hidden='1'], [data-findly-native-chrome='1']",
    );
    var i;
    for (i = 0; i < nodes.length; i++) restoreHideTag(nodes[i]);
  }

  function visibleArea(el) {
    if (!el || !el.isConnected) return 0;
    var cs;
    try {
      cs = window.getComputedStyle(el);
    } catch (err) {
      return 0;
    }
    if (cs.display === "contents") {
      var sum = 0;
      var i;
      for (i = 0; i < el.children.length; i++) sum += visibleArea(el.children[i]);
      return sum;
    }
    if (cs.display === "none" || cs.visibility === "hidden" || el.hidden) return 0;
    var rect = el.getBoundingClientRect();
    return Math.max(0, rect.width) * Math.max(0, rect.height);
  }

  function pageIsLoading() {
    return (
      document.documentElement.classList.contains("sf-filter-loading") ||
      Boolean(document.querySelector(".findly-grid-is-busy"))
    );
  }

  /* Only a node this hide pass tagged, or an ancestor it tagged. A missing
     search title, a lazy card with no box, and a filter-hidden card do not count. */
  function hiddenByUs(el) {
    var node = el;
    while (node && node.nodeType === 1) {
      if (
        node.getAttribute("data-findly-theme-hidden") === "1" ||
        node.getAttribute("data-findly-native-chrome") === "1"
      ) {
        return true;
      }
      node = node.parentElement;
    }
    return false;
  }

  function guardStoreVisible(why) {
    if (pageIsLoading()) {
      if ((window.__FINDLY_GUARD_WAITS || 0) < 40) {
        window.__FINDLY_GUARD_WAITS = (window.__FINDLY_GUARD_WAITS || 0) + 1;
        scheduleGuard(why || "after-loading");
      }
      return;
    }
    window.__FINDLY_GUARD_WAITS = 0;
    var header = storeHeader();
    var main = document.querySelector("#MainContent, main, [role='main']");
    var list = storeProductList();
    var bad = [];
    if (header && visibleArea(header) <= 0 && hiddenByUs(header)) bad.push("header");
    if (main && visibleArea(main) <= 0 && hiddenByUs(main)) bad.push("main");
    if (list) {
      var cards = listCards(list);
      if (visibleArea(list) <= 0 && cards.length && hiddenByUs(list)) {
        bad.push("product-list");
      } else if (cards.length && cardsAllHidden(cards) && hiddenByUs(cards[0])) {
        var tagged = true;
        var i;
        for (i = 0; i < cards.length; i++) {
          if (!hiddenByUs(cards[i])) tagged = false;
        }
        if (tagged) bad.push("product-cards");
      }
    }
    var searchTitle = storeSearchTitle();
    if (searchTitle && visibleArea(searchTitle) <= 0 && hiddenByUs(searchTitle)) {
      bad.push("search-title");
    }
    if (!bad.length) return;
    restoreAllHideTags();
    hidePassDisabled = true;
    if (hideObserver) {
      try {
        hideObserver.disconnect();
      } catch (err) {
        /* ignore */
      }
      hideObserver = null;
    }
    findlyMetric("rollback", bad.join(","));
    console.warn(
      "[findly] hide pass disabled: " + bad.join(", ") + " has no visible area",
      why || "",
    );
  }

  function restoreFindlyNode(el) {
    if (!el || el.nodeType !== 1) return;
    el.removeAttribute("data-findly-theme-hidden");
    el.removeAttribute("data-findly-native-chrome");
    el.removeAttribute("hidden");
    el.hidden = false;
    if (el.classList) el.classList.remove("hidden");
    if (el.style) el.style.removeProperty("display");
  }

  function unhideFindlyDrawer() {
    var nodes = document.querySelectorAll(
      ".sf-panel[data-findly-theme-hidden='1'], .sf-panel[data-findly-native-chrome='1'], .sf-panel [data-findly-theme-hidden='1'], .sf-panel [data-findly-native-chrome='1']",
    );
    var i;
    for (i = 0; i < nodes.length; i++) restoreFindlyNode(nodes[i]);
  }

  function looksLikeFilterChrome(el) {
    if (!el || el.nodeType !== 1) return false;
    var tag = tagOf(el);
    if (storefrontV2()) {
      if (
        tag === "html" ||
        tag === "body" ||
        tag === "head" ||
        tag === "main" ||
        tag === "header" ||
        tag === "footer"
      ) {
        return false;
      }
      if (containsProductList(el) || appFilterClassOnly(el)) return false;
    }
    if (isFindlyUi(el) || isSkipped(el)) return false;
    if (
      tag === "facet-filters-form" ||
      tag === "facets-form" ||
      tag === "facets-form-component" ||
      tag === "filter-form" ||
      tag === "facet-form" ||
      tag === "dropdown-facet" ||
      tag === "facet-dropdown" ||
      tag === "sorting-filter-component" ||
      tag === "price-range"
    ) {
      return true;
    }
    if (el.querySelector && el.querySelector(NATIVE_INPUT)) return true;
    var cls = " " + String(el.className || "") + " ";
    if (/\s sf-(panel|facet|facets|header|option|toolbar|toggle)\b/.test(cls)) {
      return false;
    }
    var hint =
      String(el.id || "") +
      " " +
      String(el.className || "") +
      " " +
      String(el.getAttribute && el.getAttribute("data-section-type") || "");
    return /\bfacets?\b|\bfilter[s-]?(toolbar|sidebar|wrapper|form|drawer|bar)\b|\bsorting-filter\b|\bcollection-filter|\bproduct-filter|\bfacet-filters\b/i.test(
      hint,
    );
  }

  function hideNativeChromeHeuristic() {
    if (hidePassDisabled || nativeHideKilled()) return;
    var i;
    var adapter = themeAdapter();
    if (storefrontV2() && adapter && adapter.filter) {
      var mapped = document.querySelectorAll(adapter.filter);
      for (i = 0; i < mapped.length; i++) hideIfChrome(mapped[i]);
    }
    var inputs = document.querySelectorAll(NATIVE_INPUT);
    for (i = 0; i < inputs.length; i++) {
      var input = inputs[i];
      if (!input || isFindlyUi(input)) continue;
      var chrome =
        (input.closest &&
          input.closest(
            "form, facet-filters-form, facets-form, facets-form-component, details, fieldset, .facets__item, .facet-filters__field, .sorting-filter",
          )) ||
        input;
      hideIfChrome(chrome);
    }

    var tagged = document.querySelectorAll(
      "facet-filters-form, facets-form, facets-form-component, filter-form, dropdown-facet, facet-dropdown, sorting-filter-component, .sorting-filter, .facets-wrapper, .facets__wrapper, #FacetsWrapperDesktop, #main-collection-filters, .collection-filters, .product-filters, .filters-toolbar",
    );
    for (i = 0; i < tagged.length; i++) hideIfChrome(tagged[i]);

    var candidates = document.querySelectorAll(
      "form, aside, [class*='facet'], [class*='filter'], [id*='facet'], [id*='Filter']",
    );
    for (i = 0; i < Math.min(candidates.length, 80); i++) {
      var candidate = candidates[i];
      var candidateTag = tagOf(candidate);
      if (storefrontV2()) {
        if (
          candidateTag === "html" ||
          candidateTag === "body" ||
          candidateTag === "head"
        ) {
          continue;
        }
        if (appFilterClassOnly(candidate)) continue;
      }
      if (looksLikeFilterChrome(candidate)) hideIfChrome(candidate);
    }
    unhideFindlyDrawer();
    guardStoreVisible("hide");
  }

  function injectCompatCss() {
    var oldIds = [
      "findly-theme-compat-v1",
      "findly-theme-compat-v2",
      "findly-theme-compat-v3",
      "findly-theme-compat-v4",
      "findly-theme-compat-v5",
      "findly-theme-compat-v6",
      "findly-theme-compat-v7",
      "findly-theme-compat-v8",
      "findly-theme-compat-v9",
      "findly-theme-compat-v10",
      "findly-theme-compat-v11",
      "findly-theme-compat-v12",
      "findly-theme-compat-v13",
    ];
    var oi;
    for (oi = 0; oi < oldIds.length; oi++) {
      if (oldIds[oi] === STYLE_ID) continue;
      var old = document.getElementById(oldIds[oi]);
      if (old && old.parentNode) old.parentNode.removeChild(old);
    }
    if (document.getElementById(STYLE_ID)) return;
    var css =
      ".smart-filter,.smart-filter-search,.findly-instant,.sf-panel{isolation:isolate}" +
      ".smart-filter button,.smart-filter select,.smart-filter summary,.smart-filter label," +
      ".sf-panel button,.sf-panel select,.sf-panel summary{" +
      "max-width:100%;color:inherit}" +
      ".smart-filter select,.sf-panel select{appearance:auto;-webkit-appearance:menulist}" +
      ".smart-filter details,.smart-filter summary,.sf-panel details,.sf-panel summary{display:revert}" +
      ".smart-filter summary,.sf-panel summary{list-style:none;cursor:pointer}" +
      ".smart-filter summary::-webkit-details-marker,.sf-panel summary::-webkit-details-marker{display:none}" +
      ".smart-filter fieldset,.sf-panel fieldset{border:0;margin:0;padding:0;min-width:0}" +
      ".sf-panel.sf-drawer-portal .sf-option:not(.sf-swatch):not(.sf-pill) input[type=checkbox]," +
      ".sf-panel.sf-drawer-portal .sf-option:not(.sf-swatch):not(.sf-pill) input[type=radio]{" +
      "appearance:none!important;-webkit-appearance:none!important;opacity:1!important;visibility:visible!important;" +
      "width:18px!important;height:18px!important;min-width:18px!important;margin:0!important;" +
      "border:1.5px solid #c3c3c3!important;background:#fff!important;display:inline-grid!important;" +
      "clip:auto!important;transform:none!important}" +
      ".sf-collection-layout{display:block;width:100%;max-width:100%;min-width:0;box-sizing:border-box;margin-inline:0}" +
      ".page-width>.sf-collection-layout,.page-width-desktop>.sf-collection-layout,.container>.sf-collection-layout{width:100%!important;max-width:100%!important}" +
      ".sf-collection-layout,[data-findly-theme-hidden='1'],[data-findly-native-chrome='1']{--findly-theme-compat:1}" +
      "[data-findly-native-chrome='1'],[data-findly-theme-hidden='1']{display:none!important}" +
      ".sf-panel.sf-drawer-portal[data-findly-theme-hidden='1'],.sf-panel.sf-drawer-portal[data-findly-native-chrome='1']," +
      ".sf-panel.sf-drawer-portal [data-findly-theme-hidden='1'],.sf-panel.sf-drawer-portal [data-findly-native-chrome='1']{" +
      "display:revert!important;visibility:visible!important}" +
      ".sf-panel.sf-drawer-portal .sf-facet{display:block!important;visibility:visible!important}" +
      ".sf-panel.sf-drawer-portal .sf-facet-label{display:flex!important;visibility:visible!important}" +
      ".sf-panel.sf-drawer-portal .sf-facet:not(.is-collapsed)>.sf-options:not(.sf-options-swatches):not(.sf-options-pills){" +
      "display:flex!important;flex-direction:column!important;align-items:stretch!important;visibility:visible!important}" +
      ".sf-panel.sf-drawer-portal .sf-facet:not(.is-collapsed)>.sf-options-swatches:not(.sf-options-swatch-text),.sf-panel.sf-drawer-portal .sf-facet:not(.is-collapsed)>.sf-options-pills{" +
      "display:flex!important;flex-direction:row!important;flex-wrap:wrap!important;align-items:flex-start!important;align-content:flex-start!important;visibility:visible!important}" +
      ".sf-panel.sf-drawer-portal .sf-options-swatches:not(.sf-options-swatch-text)>li,.sf-panel.sf-drawer-portal .sf-options-pills>li{flex:0 0 auto!important;width:auto!important}" +
      ".sf-panel.sf-drawer-portal .sf-options:not(.sf-options-swatches):not(.sf-options-pills)>li{" +
      "flex:0 0 auto!important;width:100%!important;height:auto!important}" +
      ".sf-panel.sf-drawer-portal .sf-facet.is-collapsed>.sf-options,.sf-panel.sf-drawer-portal .sf-facet.is-collapsed>.sf-price,.sf-panel.sf-drawer-portal .sf-facet.is-collapsed>.sf-dropdown-wrap,.sf-panel.sf-drawer-portal .sf-facet.is-collapsed>.sf-facet-search{display:none!important}" +
      "#findly-sf-pager,.sf-pager--pagination,.sf-pager--load-more,.sf-pager--infinite,[data-sf-pager-suppressed='1']," +
      ".sf-collection-layout[data-sf-single-page='1'] nav.pagination," +
      ".sf-collection-layout[data-sf-single-page='1'] .pagination," +
      ".sf-collection-layout[data-sf-single-page='1'] .pagination-wrapper," +
      ".sf-collection-layout[data-sf-single-page='1'] .paginate," +
      ".sf-collection-layout[data-sf-single-page='1'] #pagination," +
      ".sf-collection-layout[data-sf-single-page='1'] .Pagination," +
      ".sf-collection-layout[data-sf-single-page='1'] #AjaxinatePagination," +
      ".sf-collection-layout[data-sf-single-page='1'] .ajaxinate-pagination," +
      "html.sf-few-results nav.pagination,html.sf-few-results .pagination-wrapper," +
      "html.sf-few-results .pagination,html.sf-few-results [data-pagination]," +
      "html.sf-few-results .paginate,html.sf-few-results #pagination," +
      "html.sf-few-results .Pagination,html.sf-few-results #AjaxinatePagination," +
      "html.sf-few-results .ajaxinate-pagination," +
      "html.sf-pager-unneeded nav.pagination,html.sf-pager-unneeded .pagination-wrapper," +
      "html.sf-pager-unneeded .pagination,html.sf-pager-unneeded [data-pagination]," +
      "html.sf-pager-unneeded .paginate,html.sf-pager-unneeded #pagination," +
      "html.sf-pager-unneeded .Pagination,html.sf-pager-unneeded #AjaxinatePagination," +
      "html.sf-pager-unneeded .ajaxinate-pagination" +
      "{display:none!important}" +
      "html:not(.sf-few-results):not(.sf-pager-unneeded):not(.sf-filter-loading):has(.smart-filter) nav.pagination:not(.sf-pager):not([hidden]):not([data-sf-pager-suppressed='1'])," +
      "html:not(.sf-few-results):not(.sf-pager-unneeded):not(.sf-filter-loading):has(.smart-filter) .pagination-wrapper:not([hidden]):not([data-sf-pager-suppressed='1'])," +
      "html:not(.sf-few-results):not(.sf-pager-unneeded):not(.sf-filter-loading):has(.smart-filter) .pagination:not(.sf-pager):not([hidden]):not([data-sf-pager-suppressed='1'])," +
      "html:not(.sf-few-results):not(.sf-pager-unneeded):not(.sf-filter-loading):has(.smart-filter) [data-pagination]:not(.sf-pager):not([hidden]):not([data-sf-pager-suppressed='1'])," +
      "html:not(.sf-few-results):not(.sf-pager-unneeded):not(.sf-filter-loading):has(.smart-filter) .paginate:not([hidden]):not([data-sf-pager-suppressed='1'])," +
      "html:not(.sf-few-results):not(.sf-pager-unneeded):not(.sf-filter-loading):has(.smart-filter) #pagination:not([hidden]):not([data-sf-pager-suppressed='1'])," +
      "html:not(.sf-few-results):not(.sf-pager-unneeded):not(.sf-filter-loading):has(.smart-filter) .Pagination:not([hidden]):not([data-sf-pager-suppressed='1'])," +
      "html:not(.sf-few-results):not(.sf-pager-unneeded):not(.sf-filter-loading):has(.smart-filter) #AjaxinatePagination:not([hidden]):not([data-sf-pager-suppressed='1'])," +
      "html:not(.sf-few-results):not(.sf-pager-unneeded):not(.sf-filter-loading):has(.smart-filter) .ajaxinate-pagination:not([hidden]):not([data-sf-pager-suppressed='1'])" +
      "{display:flex!important;flex-direction:row!important;flex-wrap:wrap!important;justify-content:center!important;align-items:center;grid-column:1/-1!important;width:100%!important;visibility:visible!important}" +
      ".collection-wrapper>.sf-collection-layout{grid-column:var(--centered,2 / -2)!important;width:auto!important;max-width:none!important;min-width:0!important}" +
      ".collection-wrapper--grid-full-width>.sf-collection-layout," +
      ".collection-wrapper:has(.collection-wrapper--full-width)>.sf-collection-layout{grid-column:var(--full-width,1 / -1)!important}" +
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
      ".sf-layout-main:not(ul):not(ol):not(.product-grid):not(.main-collection-grid):not(results-list)" +
      "{display:flex;flex-direction:column}" +
      ".sf-layout-main>.sf-toolbar{order:-1;flex:0 0 auto;width:100%}" +
      ".sf-layout-main>.sf-pager{order:20}" +
      ".sf-collection-layout--offcanvas{display:flex!important;flex-direction:column;width:100%}" +
      ".sf-collection-layout--offcanvas>.sf-layout-aside," +
      ".sf-collection-layout--offcanvas>.shopify-block.sf-layout-aside," +
      ".sf-collection-layout--offcanvas>.smart-filter," +
      ".sf-collection-layout--offcanvas>.shopify-block:has(.smart-filter){order:-2}" +
      ".sf-collection-layout--offcanvas>.sf-toolbar," +
      ".sf-collection-layout--offcanvas>.sf-sort-host," +
      ".sf-collection-layout--offcanvas>.sf-page-chips{order:-1}" +
      ".sf-collection-layout--offcanvas>.sf-layout-main{order:1}" +
      ".sf-collection-layout--offcanvas>.sf-pager{order:20}" +
      ".sf-collection-layout--offcanvas>.sf-layout-aside:not(:has([data-drawer-toggle])):not(:has([data-drawer-panel]))," +
      ".sf-collection-layout--offcanvas>.shopify-block.sf-layout-aside:not(:has([data-drawer-toggle])):not(:has([data-drawer-panel]))" +
      "{display:none!important}" +
      "@media(min-width:990px){" +
      ".sf-collection-layout--left{display:grid!important;grid-template-columns:320px minmax(0,1fr)!important;align-items:start;gap:32px;width:100%!important}" +
      ".sf-collection-layout--right{display:grid!important;grid-template-columns:minmax(0,1fr) 320px!important;align-items:start;gap:32px;width:100%!important}" +
      ".sf-collection-layout--left>.sf-layout-main,.sf-collection-layout--right>.sf-layout-main{" +
      "min-width:0!important;max-width:none!important}" +
      ".sf-toggle,.sf-sort-host .sf-toggle-toolbar{display:none!important}" +
      ".smart-filter--offcanvas .sf-toggle," +
      ".sf-collection-layout--offcanvas .sf-toggle," +
      ".sf-collection-layout--offcanvas .sf-toggle-toolbar," +
      ".sf-collection-layout--offcanvas .sf-toolbar .sf-toggle" +
      "{display:inline-flex!important}" +
      "}" +
      ".sf-layout-main:not(ul):not(ol):not(.product-grid):not(.main-collection-grid){min-width:0;flex:1 1 0%;display:flex;flex-direction:column}" +
      ".smart-filter-search input,.findly-instant a{max-width:100%}";
    var style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = css;
    (document.head || document.documentElement).appendChild(style);
  }

  function ensureSortHost(widget) {
    if (widget && widget.placeCollectionSearchOnGrid) {
      widget.placeCollectionSearchOnGrid();
      return;
    }
    if (!widget || !widget.sortWrap || widget.sortWrap.hidden) return;
    if (widget.sortWrap.closest && widget.sortWrap.closest(".sf-sort-host")) {
      return;
    }
    var main =
      document.querySelector(".sf-collection-layout > .sf-layout-main") ||
      document.querySelector(".sf-layout-main") ||
      widget._gridParent;
    if (!main) return;
    var host = main.querySelector
      ? main.querySelector(".sf-sort-host")
      : null;
    if (!host) {
      host = document.createElement("div");
      host.className = "sf-sort-host";
      if (main.firstChild) main.insertBefore(host, main.firstChild);
      else main.appendChild(host);
    }
    if (widget.sortWrap.parentNode !== host) host.appendChild(widget.sortWrap);
    widget.sortWrap.classList.add("sf-sort-toolbar");
  }

  function ensureCollectionSearchHost(widget) {
    if (!widget) return;
    if (widget.placeCollectionSearchOnGrid) {
      widget.placeCollectionSearchOnGrid();
      return;
    }
    var wrap = widget.collectionSearchWrap;
    if (!wrap || wrap.hidden) return;
    var main =
      document.querySelector(".sf-collection-layout > .sf-layout-main") ||
      document.querySelector(".sf-layout-main") ||
      (widget._gridParent && widget._gridParent.parentElement);
    if (!main) return;
    wrap.classList.add("sf-search-toolbar");
    var host = main.querySelector
      ? main.querySelector(".sf-search-host")
      : null;
    if (!host) {
      host = document.createElement("div");
      host.className = "sf-search-host";
      var grid = widget._gridParent;
      if (grid && grid.parentNode === main) main.insertBefore(host, grid);
      else main.appendChild(host);
    }
    if (wrap.parentNode !== host) host.appendChild(wrap);
  }

  function liftOutOfAnyFilterForm(widget) {
    if (!widget || !widget.root || !widget.root.closest) return;
    var mount =
      widget.root.closest(".shopify-block, .shopify-app-block") || widget.root;
    var form = mount.closest("form");
    if (!form || form === mount || !form.parentNode) return;
    if (isFindlyUi(form) && form.classList && form.classList.contains("sf-search-form")) {
      return;
    }
    var action = String(form.getAttribute("action") || "");
    var hasFilter =
      Boolean(form.querySelector && form.querySelector(NATIVE_INPUT)) ||
      /filter\.|sort_by/.test(action);
    if (!hasFilter && String(form.getAttribute("id") || "").indexOf("Facet") === -1) {
      return;
    }
    try {
      if (mount.parentNode !== form.parentNode || mount.nextSibling !== form) {
        form.parentNode.insertBefore(mount, form);
      }
    } catch (err) {
      try {
        if (form.parentNode) form.parentNode.appendChild(mount);
      } catch (err2) {
        /* theme form lift is best-effort */
      }
    }
    widget._gridParent = null;
  }

  function patchWidget(widget) {
    if (!widget) return;
    var proto = Object.getPrototypeOf(widget);
    if (!proto || proto.__findlyThemePatched) return;
    proto.__findlyThemePatched = true;

    var origEnsure = proto.ensureGridParent;
    proto.ensureGridParent = function () {
      var anchor = nativeListingAnchor();
      if (anchor && anchor.grid) {
        this._gridParent = anchor.grid;
        return anchor.grid;
      }
      var parent = origEnsure ? origEnsure.call(this) : this._gridParent;
      if (parent && isSkipped(parent)) parent = null;
      if (!parent) parent = discoverAnyThemeGrid();
      if (!parent) parent = customCollectionColumn();
      if (parent) this._gridParent = parent;
      return this._gridParent || parent;
    };

    var origFallback = proto.placeAtMainFallback;
    proto.placeAtMainFallback = function (mount) {
      var anchor = nativeListingAnchor();
      if (anchor && anchor.before && mount && anchor.before.parentNode) {
        if (mount.parentNode !== anchor.before.parentNode || mount.nextSibling !== anchor.before) {
          anchor.before.parentNode.insertBefore(mount, anchor.before);
        }
        this._gridParent = anchor.grid;
        this._layoutFallbackDone = true;
        if (this.markFilterPlaced) this.markFilterPlaced();
        return true;
      }
      if (origFallback) return origFallback.call(this, mount);
      return false;
    };

    var origFindHost = proto.findLayoutHost;
    proto.findLayoutHost = function (grid) {
      var host = origFindHost ? origFindHost.call(this, grid) : grid;
      if (host && isFragileHost(host) && host.parentElement) {
        var parent = host.parentElement;
        var parentCls = " " + String(parent.className || "") + " ";
        var stayInside =
          / page-width | page-width-desktop | page-width--narrow /.test(parentCls) ||
          (parent.classList && parent.classList.contains("shopify-section")) ||
          String(parent.tagName || "").toLowerCase() === "main";
        if (!stayInside) host = parent;
      }
      if (host && hostDisplay(host) === "contents" && host.parentElement) {
        var contentsParent = host.parentElement;
        var contentsCls = " " + String(contentsParent.className || "") + " ";
        if (!/ page-width | page-width-desktop /.test(contentsCls)) {
          host = contentsParent;
        }
      }
      return host;
    };

    var origHide = proto.hideThemeDuplicateChrome;
    proto.hideThemeDuplicateChrome = function () {
      if (nativeHideKilled()) return;
      if (origHide) origHide.call(this);
      if (!storefrontV2()) hideNativeChromeHeuristic();
      else scheduleHidePass("schema-hide");
      scheduleGuard("schema-hide");
    };

    var origApply = proto.applySettings;
    proto.applySettings = function (settings) {
      if (origApply) origApply.apply(this, arguments);
      applyStorefrontV2Flag(this, settings);
    };

    var origPlaceSort = proto.placeSortOnGrid;
    proto.placeSortOnGrid = function () {
      if (origPlaceSort) origPlaceSort.call(this);
      ensureSortHost(this);
      ensureCollectionSearchHost(this);
    };

    var origCount = proto.syncThemeProductCount;
    proto.syncThemeProductCount = function (count) {
      if (origCount) origCount.call(this, count);
      var n = Number(count);
      if (!Number.isFinite(n) || n < 0) return;
      var extras = document.querySelectorAll(
        ".collection-count, .js-product-count, [data-collection-count], .toolbar__product-count, .product-count-text, .filters-toolbar__product-count, .boost-pfs-filter-total-product, .gf-products-count",
      );
      var label = n === 1 ? "1 product" : n + " products";
      var i;
      for (i = 0; i < extras.length; i++) {
        if (!extras[i] || isFindlyUi(extras[i])) continue;
        extras[i].textContent = label;
      }
    };

    var origSync = proto.syncCollectionLayout;
    proto.syncCollectionLayout = function () {
      liftOutOfAnyFilterForm(this);
      var anchor = nativeListingAnchor();
      var root = this.root;
      var mount =
        root && root.closest
          ? root.closest("shopify-app-block, .shopify-app-block, .shopify-block") || root
          : root;
      if (anchor && anchor.before && anchor.grid && mount && anchor.before.parentNode) {
        if (mount.parentNode !== anchor.before.parentNode || mount.nextSibling !== anchor.before) {
          anchor.before.parentNode.insertBefore(mount, anchor.before);
        }
        this._gridParent = anchor.grid;
        this._layoutFallbackDone = true;
        if (this.markFilterPlaced) this.markFilterPlaced();
        if (!storefrontV2()) hideNativeChromeHeuristic();
        else scheduleHidePass("layout");
        var aside = anchor.before.querySelector ? anchor.before.querySelector("#filters") : null;
        var product = aside && aside.nextElementSibling;
        if (product && aside && product !== mount) {
          var filtersHidden = false;
          try {
            filtersHidden = Boolean(aside.hidden) || window.getComputedStyle(aside).display === "none";
          } catch (err) {
            filtersHidden = Boolean(aside.hidden);
          }
          if (filtersHidden) product.style.gridColumn = "1 / -1";
        }
        ensureSortHost(this);
        ensureCollectionSearchHost(this);
        return;
      }
      var result = origSync ? origSync.apply(this, arguments) : undefined;
      if (!storefrontV2()) hideNativeChromeHeuristic();
      else scheduleHidePass("layout");
      ensureSortHost(this);
      ensureCollectionSearchHost(this);
      return result;
    };

    var origInit = proto.init;
    proto.init = function () {
      injectCompatCss();
      liftOutOfAnyFilterForm(this);
      if (origInit) origInit.apply(this, arguments);
      if (!storefrontV2()) {
        if (!this._gridParent && this.ensureGridParent) this.ensureGridParent();
        if (this.syncCollectionLayout) this.syncCollectionLayout();
        hideNativeChromeHeuristic();
        return;
      }
      if (!this.collectionId && !this.searchQuery && !this.collectionHandle) {
        clearFilterLoading();
        restoreAllHideTags();
        return;
      }
      if (!this._gridParent && this.ensureGridParent) this.ensureGridParent();
      if (this.syncCollectionLayout) this.syncCollectionLayout();
      scheduleHidePass("widget-ready");
    };

    if (!proto.__findlyHideScheduled) {
      proto.__findlyHideScheduled = true;
      window.__FINDLY_BOOTED = true;
      if (storefrontV2()) scheduleHidePass("widget-ready");
    }
  }

  function clearFilterLoading() {
    var root = document.documentElement;
    if (!root || !root.classList) return;
    root.classList.remove("sf-filter-loading");
    if (!root.classList.contains("sf-filter-ready")) {
      root.classList.add("sf-filter-ready");
    }
  }

  function liveFilterRoot() {
    return (
      document.getElementById("smart-filter-root") ||
      document.getElementById("smart-filter-embed")
    );
  }

  function scopeHasFilter(scope) {
    if (!scope || !scope.querySelector) return false;
    return Boolean(
      scope.querySelector(
        "#smart-filter-root, #smart-filter-embed, .smart-filter",
      ),
    );
  }

  /**
   * Portaled drawer nodes live on document.body. Theme editor section reloads
   * destroy the mount but leave orphans — remove any portal not owned by the
   * current connected widget.
   */
  function cleanupOrphanPortals(forceAll) {
    var widget = window.__FINDLY_FILTER_WIDGET;
    var root = liveFilterRoot();
    var ownedPanel = widget && widget.panelEl;
    var ownedBackdrop = widget && widget.backdropEl;
    var nodes = document.querySelectorAll(
      ".sf-panel.sf-drawer-portal, .sf-backdrop.sf-drawer-portal",
    );
    var i;
    for (i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (!el || !el.parentNode) continue;
      if (!forceAll && root && widget && widget.root && widget.root.isConnected) {
        if (el === ownedPanel || el === ownedBackdrop) continue;
        if (root.contains(el)) continue;
      }
      try {
        el.parentNode.removeChild(el);
      } catch (err) {
        /* ignore */
      }
    }
    if (forceAll || !root) {
      try {
        document.documentElement.classList.remove("is-sf-drawer-open");
      } catch (err) {
        /* ignore */
      }
    }
  }
  window.__FINDLY_CLEANUP_PORTALS = cleanupOrphanPortals;

  function restoreFiltersFromLocation(widget) {
    if (!widget || !widget.fetchFilters) return;
    if (widget.restoreFromHash) widget.restoreFromHash();
    try {
      widget.fetchFilters();
    } catch (err) {
      /* ignore */
    }
  }

  function storeHeader() {
    var adapter = themeAdapter();
    if (adapter && adapter.header) {
      var mappedHeader = document.querySelector(adapter.header);
      if (mappedHeader) return mappedHeader;
    }
    var grouped = document.querySelector(
      "#header-group, .shopify-section-group-header-group",
    );
    if (grouped) return grouped;
    var headers = document.querySelectorAll("header");
    var i;
    for (i = 0; i < headers.length; i++) {
      var header = headers[i];
      if (
        header.closest &&
        header.closest(".predictive-search, dialog, [role='dialog']")
      ) {
        continue;
      }
      return header;
    }
    return null;
  }

  function storeProductList() {
    var scope =
      document.querySelector("#MainContent, main, [role='main']") || document.body;
    if (!scope || !scope.querySelector) return null;
    var adapter = themeAdapter();
    if (adapter && adapter.grid) {
      var mappedGrid = scope.querySelector(adapter.grid);
      if (mappedGrid) return mappedGrid;
    }
    return scope.querySelector(
      "#ResultsList, #product-grid, #ProductGrid, ul.product-grid, ol.product-grid",
    );
  }

  function storeSearchTitle() {
    var adapter = themeAdapter();
    var sel =
      (adapter && adapter.searchTitle) ||
      ".search-page__header, .template-search__header, .search-header";
    return document.querySelector(sel);
  }

  function listCards(list) {
    if (!list || !list.querySelectorAll) return [];
    var adapter = themeAdapter();
    var generic = "li, product-card, article, .product-card, .card";
    if (!adapter || !adapter.card) return list.querySelectorAll(generic);
    var mapped = list.querySelectorAll(adapter.card);
    if (mapped.length) return mapped;
    return list.querySelectorAll(generic);
  }

  function cardsAllHidden(cards) {
    var i;
    for (i = 0; i < cards.length; i++) {
      if (visibleArea(cards[i]) > 0) return false;
    }
    return true;
  }

  function scheduleGuard(why) {
    if (hidePassDisabled) return;
    if (guardTimer) window.clearTimeout(guardTimer);
    guardTimer = window.setTimeout(function () {
      guardTimer = 0;
      if (hidePassDisabled) return;
      guardStoreVisible(why);
    }, 200);
  }

  function scheduleHidePass(why) {
    if (hidePassDisabled || nativeHideKilled()) return;
    if (hideTimer) window.clearTimeout(hideTimer);
    hideTimer = window.setTimeout(function () {
      hideTimer = 0;
      if (hidePassDisabled || nativeHideKilled()) return;
      findlyLog("hide", why || "run");
      hideNativeChromeHeuristic();
    }, 200);
  }

  function bindHideObserver() {
    if (hideObserver || hidePassDisabled || typeof MutationObserver !== "function") return;
    var root = document.body || document.documentElement;
    if (!root) return;
    hideObserver = new MutationObserver(function () {
      if (!storefrontV2() || hidePassDisabled || nativeHideKilled()) return;
      scheduleHidePass("mutation");
    });
    hideObserver.observe(root, { childList: true, subtree: true });
  }

  function rememberAssetBase() {
    var node = document.querySelector(
      "script[src*='smart-filter'],link[href*='smart-filter']",
    );
    var url = (node && (node.src || node.href)) || window.__FINDLY_ASSET_BASE || "";
    var base = url ? String(url).replace(/[^/?#]+(?:\?.*)?$/, "") : "";
    if (base) window.__FINDLY_ASSET_BASE = base;
  }

  function ensureEditorAsset(file, kind) {
    var urls = window.__FINDLY_ASSET_URLS || {};
    var href = urls[file] || "";
    if (!href) {
      var base = window.__FINDLY_ASSET_BASE || "";
      if (base) href = base + file;
    }
    if (!href || !file) return;
    if (
      kind === "js" &&
      file === "smart-filter.min.js" &&
      (window.__FINDLY_BOOTED || window.__FINDLY_FILTER_BOOTED)
    ) {
      return;
    }
    var sel =
      kind === "css"
        ? "link[href*='" + file + "']"
        : "script[src*='" + file + "']";
    if (document.querySelector(sel)) return;
    if (kind === "css") {
      var link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
      link.setAttribute("data-findly-reinjected", "1");
      (document.head || document.documentElement).appendChild(link);
      findlyLog("assets", "css", file);
      return;
    }
    var script = document.createElement("script");
    script.src = href;
    script.defer = true;
    script.async = false;
    script.setAttribute("data-findly-reinjected", "1");
    (document.body || document.documentElement).appendChild(script);
    findlyLog("assets", "js", file);
  }

  function ensureEditorAssets() {
    rememberAssetBase();
    var files = [
      ["smart-filter-check.min.css", "css"],
      ["smart-filter-ui.min.css", "css"],
      ["smart-filter.min.css", "css"],
      ["smart-filter-grid.min.js", "js"],
      ["smart-filter-theme.min.js", "js"],
      ["smart-filter.min.js", "js"],
    ];
    var i;
    for (i = 0; i < files.length; i++) ensureEditorAsset(files[i][0], files[i][1]);
  }

  function rebindLayout() {
    var widget = window.__FINDLY_FILTER_WIDGET;
    cleanupOrphanPortals(false);
    if (window.Shopify && window.Shopify.designMode) ensureEditorAssets();
    if (!widget || !widget.root || widget.root.isConnected === false) {
      cleanupOrphanPortals(true);
      return;
    }
    widget._gridParent = null;
    if (widget.ensureGridParent) widget.ensureGridParent();
    if (widget.syncCollectionLayout) widget.syncCollectionLayout();
    if (widget.placeCollectionSearchOnGrid) widget.placeCollectionSearchOnGrid();
    if (widget.watchThemeGrid) widget.watchThemeGrid();
  }

  function bindThemeLifecycle() {
    if (window.__findlyThemeLifecycle) return;
    window.__findlyThemeLifecycle = true;
    /* Section reload replaces the DOM, so the new theme filters are not hidden
       yet and the editor may have dropped the embed asset tags. */
    document.addEventListener("shopify:section:load", function () {
      window.setTimeout(function () {
        rebindLayout();
        if (storefrontV2()) scheduleHidePass("section-load");
        else {
          var widget = window.__FINDLY_FILTER_WIDGET;
          if (widget && widget.hideThemeDuplicateChrome) widget.hideThemeDuplicateChrome();
        }
      }, 0);
    });
    document.addEventListener("shopify:section:unload", function (event) {
      if (scopeHasFilter(event && event.target)) {
        window.__FINDLY_FILTER_BOOTED = false;
        cleanupOrphanPortals(true);
        return;
      }
      window.setTimeout(rebindLayout, 0);
    });
    /* Reorder moves sections. Layout only — the observer schedules the hide. */
    document.addEventListener("shopify:section:reorder", function () {
      window.setTimeout(rebindLayout, 0);
    });
    document.addEventListener("shopify:block:select", function () {
      window.setTimeout(rebindLayout, 0);
    });
    document.addEventListener("shopify:block:deselect", function () {
      window.setTimeout(rebindLayout, 0);
    });
    /* Flag off keeps the released hide triggers. Flag on only restores URL state. */
    window.addEventListener("popstate", function () {
      window.setTimeout(function () {
        var widget = window.__FINDLY_FILTER_WIDGET;
        if (widget && liveFilterRoot()) restoreFiltersFromLocation(widget);
        if (!storefrontV2()) {
          rebindLayout();
          if (widget && widget.hideThemeDuplicateChrome) widget.hideThemeDuplicateChrome();
        }
      }, 0);
    });
    window.addEventListener("pageshow", function (event) {
      if (!event || !event.persisted) return;
      window.setTimeout(function () {
        var widget = window.__FINDLY_FILTER_WIDGET;
        if (widget && liveFilterRoot()) restoreFiltersFromLocation(widget);
        if (!storefrontV2()) {
          rebindLayout();
          if (widget && widget.hideThemeDuplicateChrome) widget.hideThemeDuplicateChrome();
        }
      }, 0);
    });
    window.addEventListener("load", function () {
      if (storefrontV2()) return;
      window.setTimeout(function () {
        rebindLayout();
        var widget = window.__FINDLY_FILTER_WIDGET;
        if (widget && widget.hideThemeDuplicateChrome) widget.hideThemeDuplicateChrome();
      }, 50);
    });
    document.addEventListener("page:load", function () {
      window.setTimeout(rebindLayout, 0);
    });
    document.addEventListener("turbo:load", function () {
      window.setTimeout(function () {
        if (hideObserver) {
          try {
            hideObserver.disconnect();
          } catch (err) {
            /* ignore */
          }
          hideObserver = null;
        }
        bindHideObserver();
        rebindLayout();
        if (storefrontV2()) scheduleHidePass("turbo");
        else {
          var widget = window.__FINDLY_FILTER_WIDGET;
          if (widget && widget.hideThemeDuplicateChrome) widget.hideThemeDuplicateChrome();
        }
      }, 0);
    });
  }

  function installSetter() {
    var desc = Object.getOwnPropertyDescriptor(
      window,
      "__FINDLY_FILTER_WIDGET",
    );
    var prevSet = desc && desc.set;
    var prevGet = desc && desc.get;
    var held = prevGet
      ? prevGet()
      : desc && !desc.get
        ? desc.value
        : window.__FINDLY_FILTER_WIDGET;
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
        },
      });
    } catch (err) {
      /* ignore */
    }
    if (held) patchWidget(held);
  }

  function shownArea(el) {
    return visibleArea(el) > 0;
  }

  function installDiag() {
    window.__FINDLY_DIAG = function () {
      var html = document.documentElement;
      var widget = window.__FINDLY_FILTER_WIDGET;
      var proto = widget ? Object.getPrototypeOf(widget) : null;
      var cards = document.querySelectorAll(
        "#ResultsList li.product-grid__item, ul.product-grid > li, ol.product-grid > li, article.pcard",
      );
      var visible = 0;
      var themeHidden = 0;
      var smartHidden = 0;
      var i;
      for (i = 0; i < cards.length; i++) {
        if (shownArea(cards[i])) visible += 1;
        if (cards[i].getAttribute("data-findly-theme-hidden") === "1") themeHidden += 1;
        if (cards[i].getAttribute("data-smart-filter-hidden") === "true") smartHidden += 1;
      }
      var scripts = {};
      var list = document.scripts;
      for (i = 0; i < list.length; i++) {
        var src = list[i].src || "";
        if (!/smart-filter/.test(src)) continue;
        var name = src.split("/").pop().split("?")[0];
        scripts[name] = (scripts[name] || 0) + 1;
      }
      var header = document.querySelector(
        "#header-group, .shopify-section-group-header-group, header",
      );
      var main = document.querySelector("#MainContent, main, [role='main']");
      var resultsTag = document.querySelector("results-list");
      var results = document.getElementById("ResultsList");
      var rootEl =
        document.getElementById("smart-filter-root") ||
        document.getElementById("smart-filter-embed");
      var cssCount = 0;
      var cssNodes = document.querySelectorAll('link[rel="stylesheet"]');
      for (i = 0; i < cssNodes.length; i++) {
        var cssHref = cssNodes[i].href || "";
        if (/smart-filter/i.test(cssHref) && cssNodes[i].isConnected !== false) {
          cssCount += 1;
        }
      }
      var gridEl = document.querySelector("ul.product-grid, ol.product-grid");
      return {
        path: window.location.pathname + window.location.search,
        htmlClass: html.className,
        loading: html.classList.contains("sf-filter-loading"),
        ready: html.classList.contains("sf-filter-ready"),
        hideDisabled: hidePassDisabled,
        nativeHideKilled: nativeHideKilled(),
        htmlMatchesFilterSelector: html.matches
          ? html.matches("[class*='filter']")
          : false,
        widget: widget
          ? {
              searchQuery: widget.searchQuery || "",
              page: widget.page,
              sortKey: widget.sortKey,
              defaultSort: widget.defaultSort,
              active: Boolean(widget.hasActiveFilters && widget.hasActiveFilters()),
              indexCovers: widget._indexCovers,
              filterFailed: Boolean(widget._findlyFilterFailed),
              total: widget._lastFilterData && widget._lastFilterData.total,
              themePatched: Boolean(proto && proto.__findlyThemePatched),
              gridPatched: Boolean(proto && proto.__findlyGridPatched),
            }
          : null,
        scripts: scripts,
        booted: Boolean(window.__FINDLY_BOOTED || window.__FINDLY_FILTER_BOOTED),
        headerShown: shownArea(header),
        mainShown: shownArea(main),
        resultsListConnected: Boolean(
          (resultsTag && resultsTag.isConnected) || (results && results.isConnected),
        ),
        listingConnected: Boolean(
          resultsTag &&
            resultsTag.isConnected &&
            results &&
            results.isConnected &&
            gridEl &&
            gridEl.isConnected,
        ),
        rootConnected: Boolean(rootEl && rootEl.isConnected),
        cssLinksConnected: cssCount > 0,
        layoutRolledBack: Boolean(window.__FINDLY_LAYOUT_ROLLED_BACK),
        lastLayoutError: window.__FINDLY_LAST_LAYOUT_ERROR || "",
        taggedTotal: document.querySelectorAll("[data-findly-theme-hidden='1']").length,
        cards: {
          n: cards.length,
          visible: visible,
          themeHidden: themeHidden,
          smartHidden: smartHidden,
        },
      };
    };
  }

  function installMovedHooks() {
    var lastAnalyticsStamp = "";
    var lastAnalyticsAt = 0;
    var partnerUpdateTimer = null;
    var partnerUpdateHandles = [];

    function shopDomain() {
      var api = window.__FINDLY_DOM;
      if (api && api.shopDomain) return api.shopDomain();
      return (window.Shopify && window.Shopify.shop) || "";
    }
    function deviceKind() {
      return window.innerWidth < 750 ? "mobile" : "desktop";
    }
    function visitorId() {
      var privacy = window.__FINDLY_PRIVACY;
      if (privacy && typeof privacy.visitorId === "function") {
        return privacy.visitorId() || "";
      }
      return "";
    }
    function sendAnalytics(proxyBase, fields) {
      var vid = visitorId();
      if (!vid) return;
      var stamp =
        String(fields.kind || "") +
        "|" +
        String(fields.combo || "") +
        "|" +
        String(fields.q || "");
      var now = Date.now();
      if (stamp === lastAnalyticsStamp && now - lastAnalyticsAt < 2000) return;
      lastAnalyticsStamp = stamp;
      lastAnalyticsAt = now;
      var url =
        String(proxyBase || "/apps/smart-filter").replace(/\/$/, "") +
        "/analytics?kind=" +
        encodeURIComponent(fields.kind || "") +
        "&shop=" +
        encodeURIComponent(shopDomain());
      if (fields.q != null && fields.q !== "") {
        url += "&q=" + encodeURIComponent(fields.q);
      }
      if (fields.n != null) url += "&n=" + encodeURIComponent(String(fields.n));
      if (fields.combo) url += "&combo=" + encodeURIComponent(fields.combo);
      if (fields.handle) url += "&handle=" + encodeURIComponent(fields.handle);
      url +=
        "&v=" +
        encodeURIComponent(vid) +
        "&d=" +
        encodeURIComponent(deviceKind());
      try {
        if (typeof navigator.sendBeacon === "function") {
          navigator.sendBeacon(url);
          return;
        }
      } catch (err) {
        /* fall through */
      }
      fetch(url, {
        method: "GET",
        keepalive: true,
        credentials: "same-origin",
        mode: "no-cors",
      }).catch(function () {});
    }
    function reinitPartnerWidgetsFallback() {
      try {
        if (window.jdgm && typeof window.jdgm.customizeBadges === "function") {
          window.jdgm.customizeBadges();
        } else if (window.jdgm && typeof window.jdgm.preLoader === "function") {
          window.jdgm.preLoader();
        }
      } catch (err) {
        /* optional partner widget */
      }
      try {
        var heroButtons = document.querySelectorAll(".wishlist-hero-custom-button");
        var hi;
        for (hi = 0; hi < heroButtons.length; hi++) {
          document.dispatchEvent(
            new CustomEvent("wishlist-hero-add-to-custom-element", {
              bubbles: true,
              detail: heroButtons[hi],
            }),
          );
        }
      } catch (err2) {
        /* optional partner widget */
      }
      try {
        if (
          window.frcp &&
          window.frcp.wishlist &&
          typeof window.frcp.wishlist.attachOnCollection === "function"
        ) {
          window.frcp.wishlist.attachOnCollection();
        }
      } catch (err3) {
        /* optional partner widget */
      }
      try {
        if (window._swat && typeof window._swat.initializeActionButtons === "function") {
          window._swat.initializeActionButtons();
        }
      } catch (err4) {
        /* optional partner widget */
      }
      try {
        if (window.Weglot && typeof window.Weglot.refresh === "function") {
          window.Weglot.refresh();
        }
      } catch (err5) {
        /* optional partner widget */
      }
      try {
        if (window.Currency && typeof window.Currency.convertAll === "function") {
          window.Currency.convertAll(
            window.Currency.currentCurrency ||
              (window.Shopify &&
                window.Shopify.currency &&
                window.Shopify.currency.active) ||
              "USD",
          );
        }
      } catch (err6) {
        /* optional currency converter */
      }
    }
    function reinitPartnerWidgets() {
      var api = window.__FINDLY_DOM;
      if (api && api.reinitPartnerWidgets) {
        api.reinitPartnerWidgets();
        return;
      }
      reinitPartnerWidgetsFallback();
    }
    function dispatchPartnerRenderEvents(handles) {
      var detail = { handles: handles || [] };
      window.dispatchEvent(
        new CustomEvent("findlyFilterRenderCompleted", {
          bubbles: true,
          detail: detail,
        }),
      );
      document.dispatchEvent(
        new CustomEvent("findlyFilterRenderCompleted", {
          bubbles: true,
          detail: detail,
        }),
      );
      reinitPartnerWidgets();
    }
    window.__FINDLY_FIRE_ANALYTICS = function (proxyBase, fields) {
      var privacy = window.__FINDLY_PRIVACY;
      if (!privacy || typeof privacy.run !== "function") return;
      privacy.run(function () {
        sendAnalytics(proxyBase, fields);
      });
    };
    window.__FINDLY_ACTIVE_FILTER_COMBO = function (selected, price) {
      var parts = [];
      var facetCount = 0;
      Object.keys(selected || {})
        .sort()
        .forEach(function (key) {
          var values = selected[key];
          if (!values || !values.length) return;
          facetCount += 1;
          parts.push(key + "=" + values.join(","));
        });
      if (price && (price.min !== "" || price.max !== "")) {
        facetCount += 1;
        parts.push("price=" + String(price.min) + "," + String(price.max));
        parts.sort();
      }
      return { facetCount: facetCount, combo: parts.join("|") };
    };
    window.__FINDLY_DISPATCH_UPDATE = function (handles) {
      document.dispatchEvent(
        new CustomEvent("smart-filter:update", {
          bubbles: true,
          detail: { handles: handles || [] },
        }),
      );
      partnerUpdateHandles = handles || [];
      if (partnerUpdateTimer) clearTimeout(partnerUpdateTimer);
      partnerUpdateTimer = setTimeout(function () {
        partnerUpdateTimer = null;
        dispatchPartnerRenderEvents(partnerUpdateHandles);
      }, 0);
    };
  }

  function install() {
    window.__FINDLY_EMIT_METRIC = findlyMetric;
    injectCompatCss();
    rememberAssetBase();
    installMovedHooks();
    bindThemeLifecycle();
    bindHideObserver();
    installSetter();
    installDiag();
  }

  install();
})();
