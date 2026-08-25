/**
 * Collection grid takeover extras.
 * Loaded from Liquid via asset_url so it does not count against the 100 KB
 * schema "javascript" cap on smart-filter.min.js.
 *
 * Patches Widget.prototype as soon as window.__FINDLY_FILTER_WIDGET is set.
 */
(function () {
  "use strict";

  var STYLE_ID = "findly-grid-takeover-v6";
  var HOST_ID = "findly-grid-host";
  var CARD_TRAY_ID = "findly-card-tray";
  var PRODUCT_GRID_START_CSS =
    ".sf-collection-layout .main-collection-grid,.sf-og .main-collection-grid," +
    ".sf-collection-layout #product-grid,.sf-og #product-grid," +
    ".sf-collection-layout #ProductGrid,.sf-og #ProductGrid," +
    ".sf-collection-layout ul.product-grid,.sf-og ul.product-grid," +
    ".sf-collection-layout ol.product-grid,.sf-og ol.product-grid," +
    ".sf-collection-layout .product-grid,.sf-og .product-grid," +
    ".sf-collection-layout .sf-app-grid,.sf-og .sf-app-grid," +
    ".sf-collection-layout results-list>.main-collection-grid,.sf-og results-list>.main-collection-grid" +
    "{justify-content:start!important}";
  var GRID_BUSY_CSS =
    "@keyframes sf-grid-spin{to{transform:rotate(360deg)}}" +
    ".sf-grid-busy{position:relative!important;opacity:1!important;pointer-events:none;min-height:8rem}" +
    ".sf-grid-busy::before{content:\"\";position:absolute;inset:0;z-index:20;background:rgb(255 255 255 / .55);pointer-events:none}" +
    ".sf-grid-busy::after{content:\"\";position:absolute;z-index:21;top:50%;left:50%;width:2rem;height:2rem;margin:-1rem 0 0 -1rem;" +
    "border:2px solid rgb(0 0 0 / .12);border-top-color:var(--sf-accent,#111);border-radius:50%;animation:sf-grid-spin .7s linear infinite}";
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
      if (widget.restoreFromHash) widget.restoreFromHash();
      applyLooseHash(widget);
      widget.fetchFilters();
    });
  }

  function injectCss() {
    var legacy = document.getElementById("findly-grid-takeover");
    if (legacy && legacy.parentNode) legacy.parentNode.removeChild(legacy);
    var legacy2 = document.getElementById("findly-grid-takeover-v2");
    if (legacy2 && legacy2.parentNode) legacy2.parentNode.removeChild(legacy2);
    var legacy3 = document.getElementById("findly-grid-takeover-v3");
    if (legacy3 && legacy3.parentNode) legacy3.parentNode.removeChild(legacy3);
    var legacy4 = document.getElementById("findly-grid-takeover-v4");
    if (legacy4 && legacy4.parentNode) legacy4.parentNode.removeChild(legacy4);
    var legacy5 = document.getElementById("findly-grid-takeover-v5");
    if (legacy5 && legacy5.parentNode) legacy5.parentNode.removeChild(legacy5);
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
      ".smart-filter__sort--toolbar,.sf-sort-host{overflow:visible!important;position:relative}" +
      ".smart-filter__sort-menu{z-index:100060;box-sizing:border-box;background:var(--sf-surface,#fff);" +
      "color:inherit;border:1px solid var(--sf-border,#ececec);border-radius:8px;padding:6px 0;" +
      "box-shadow:0 10px 28px rgb(0 0 0 / 14%)}" +
      ".smart-filter__sort-menu[hidden]{display:none!important}" +
      ".smart-filter__sort-option{display:block;width:100%;appearance:none;margin:0;" +
      "padding:8px 18px 8px 30px;border:0;background:transparent;color:inherit;font:inherit;" +
      "text-align:left;white-space:nowrap;cursor:pointer}";
    var style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = css;
    (document.head || document.documentElement).appendChild(style);
    if (!document.getElementById("findly-theme-bridge")) {
      var bridge = document.createElement("style");
      bridge.id = "findly-theme-bridge";
      bridge.textContent =
        "[data-smart-filter-hidden='true'],[data-findly-theme-hidden='1']{display:none!important}" +
        GRID_BUSY_CSS +
        ".sf-collection-layout{display:block;box-sizing:border-box;width:100%;max-width:100%;min-width:0}" +
        ".sf-collection-layout__aside,.sf-collection-layout__main{box-sizing:border-box;min-width:0}" +
        "@media(min-width:750px){" +
        ".sf-collection-layout--left,.sf-collection-layout--right{display:flex!important;align-items:flex-start;gap:32px;width:100%}" +
        ".sf-collection-layout--left .sf-collection-layout__aside,.sf-collection-layout--right .sf-collection-layout__aside," +
        ".sf-collection-layout--left .smart-filter,.sf-collection-layout--right .smart-filter," +
        ".sf-collection-layout--left .shopify-block:has(.smart-filter),.sf-collection-layout--right .shopify-block:has(.smart-filter)" +
        "{flex:0 0 280px;width:280px;max-width:280px;min-width:280px}" +
        ".sf-collection-layout--left .sf-collection-layout__main,.sf-collection-layout--right .sf-collection-layout__main" +
        "{flex:1 1 auto;min-width:0;max-width:100%}" +
        ".sf-sort-host{display:flex;justify-content:flex-end;width:100%;margin:0 0 14px;overflow:visible;position:relative;z-index:6}" +
        ".sf-sort-host .smart-filter__sort{display:inline-flex;position:relative;width:fit-content;max-width:100%;margin:0 0 0 auto;overflow:visible}" +
        ".sf-collection-layout--top{display:flex!important;flex-direction:column;gap:16px;width:100%}" +
        ".sf-collection-layout--top>.sf-collection-layout__aside,.sf-collection-layout--top>.smart-filter," +
        ".sf-collection-layout--top>.shopify-block:has(.smart-filter)" +
        "{flex:0 0 auto!important;width:100%!important;max-width:100%!important;min-width:0!important}" +
        "}" +
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
        ".sf-app-grid>:not(.sf-app-card){display:none!important}";
      (document.head || document.documentElement).appendChild(bridge);
    }
  }

  function injectCatalogCss() {
    var oldCatalog =
      document.getElementById("findly-catalog-grid-v1") ||
      document.getElementById("findly-catalog-grid-v2") ||
      document.getElementById("findly-catalog-grid-v3") ||
      document.getElementById("findly-catalog-grid-v4") ||
      document.getElementById("findly-catalog-grid-v5");
    if (oldCatalog && oldCatalog.parentNode) oldCatalog.parentNode.removeChild(oldCatalog);
    if (document.getElementById("findly-catalog-grid-v6")) return;
    var catalog = document.createElement("style");
    catalog.id = "findly-catalog-grid-v6";
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

  function isLayoutUnsafeHost(el) {
    if (!el || el.nodeType !== 1) return false;
    if (isResultsListEl(el) || isListHost(el) || isThemeManagedGrid(el)) {
      return true;
    }
    var cls = " " + String(el.className || "") + " ";
    return / collection-wrapper | main-collection-grid /.test(cls);
  }

  function liftFragileLayout(el, position) {
    if (!el || !el.parentNode) return el;
    var parent = el.parentNode;
    if (parent.classList && parent.classList.contains("sf-collection-layout")) {
      parent.classList.remove(
        "sf-collection-layout--left",
        "sf-collection-layout--right",
        "sf-collection-layout--top",
        "sf-collection-layout--offcanvas",
      );
      parent.classList.add("sf-collection-layout");
      parent.classList.add("sf-collection-layout--" + (position || "left"));
      el.classList.remove(
        "sf-collection-layout",
        "sf-collection-layout--left",
        "sf-collection-layout--right",
        "sf-collection-layout--top",
        "sf-collection-layout--offcanvas",
      );
      el.classList.add("sf-collection-layout__main");
      return parent;
    }
    var wrapper = document.createElement("div");
    parent.insertBefore(wrapper, el);
    wrapper.appendChild(el);
    el.classList.remove(
      "sf-collection-layout",
      "sf-collection-layout--left",
      "sf-collection-layout--right",
      "sf-collection-layout--top",
      "sf-collection-layout--offcanvas",
    );
    el.classList.add("sf-collection-layout__main");
    wrapper.classList.add("sf-collection-layout");
    wrapper.classList.add("sf-collection-layout--" + (position || "left"));
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
      / card__inner | card__content | card__media | card__information | card__heading | card-information | full-unstyled-link | media-wrapper | card__text | product-item__info | product-card__image | productitem--info | grid-view-item__link | product-block__image | card__details /.test(
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
    if (el.id === CARD_TRAY_ID) return true;
    var cls = el.classList;
    if (!cls) return false;
    return (
      cls.contains("sf-sort-host") ||
      cls.contains("sf-pager") ||
      cls.contains("pagination") ||
      cls.contains("facets-container") ||
      cls.contains("smart-filter")
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
    if (el.classList && el.classList.contains("sf-app-card")) return false;
    if (isLayoutShell(el)) return false;
    if (isInnerCardSlice(el)) return false;
    var tag = String(el.tagName || "").toLowerCase();
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
    return Boolean(handleFromCard(el));
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
    if (!scope.querySelectorAll) return;
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
      if (child.id === CARD_TRAY_ID) continue;
      if (child.classList && child.classList.contains("sf-app-card")) continue;
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

  function resetInnerFilterHides(parent) {
    if (!parent || !parent.querySelectorAll) return;
    var nodes = parent.querySelectorAll("[data-smart-filter-hidden='true']");
    var i;
    for (i = 0; i < nodes.length; i++) {
      if (!isInnerCardSlice(nodes[i])) continue;
      var host =
        nodes[i].closest &&
        nodes[i].closest(
          "product-card, product-item, grid-item, .product-card, .grid__item, .card-wrapper, .sf-app-card",
        );
      if (
        host &&
        host !== nodes[i] &&
        (host.hidden || host.getAttribute("data-smart-filter-hidden") === "true")
      ) {
        continue;
      }
      showEl(nodes[i]);
    }
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
    var chrome = null;
    var kids = parent.children;
    var i;
    for (i = 0; i < kids.length; i++) {
      var kid = kids[i];
      var cls = kid.classList;
      var tag = String(kid.tagName || "").toLowerCase();
      if (
        (cls &&
          (cls.contains("sf-sort-host") ||
            cls.contains("sf-pager") ||
            cls.contains("pagination"))) ||
        tag === "nav"
      ) {
        chrome = kid;
        break;
      }
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
    if (!host || !host.querySelectorAll || !tray) return;
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

  function applyNativeFilterGrid(handles, hint) {
    stripAppCards(document);
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
    for (i = 0; i < shown.length; i++) {
      if (shown[i].orphan) continue;
      placeCardInGrid(parent, shown[i].el);
      showCardTree(shown[i].el);
      shownHosts.push(shown[i].el);
    }
    for (i = 0; i < shown.length; i++) {
      if (!shown[i].orphan) continue;
      if (!attachOrphanToShown(shown[i].el, shown[i].handle, shown)) {
        placeCardInGrid(parent, shown[i].el);
      }
      showCardTree(shown[i].el);
    }
    for (i = 0; i < hidden.length; i++) {
      showCardTree(hidden[i].el);
      tray.appendChild(hidden[i].el);
    }
    sweepHostOrphans(parent, shownHosts, allowed, tray);
    return cards.length > 0;
  }

  function applyNativeAfterGrid(self) {
    if (!self) return;
    if (self._appGridActive || (self.isAppGridMode && self.isAppGridMode())) {
      var parent = self._gridParent;
      if (parent && self.hideNativeGridCards) self.hideNativeGridCards(parent);
      return;
    }
    if (self.appGridTemplate && self.appGridTemplate()) return;
    var handles =
      self._visibleHandles && self._visibleHandles.length
        ? self._visibleHandles
        : self._shownHandles;
    if (!handles || !handles.length) {
      if (self.hasActiveFilters && self.hasActiveFilters()) {
        applyNativeFilterGrid(handles || [], self._gridParent);
      } else {
        applyNativeFilterGrid(null, self._gridParent);
      }
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

  function copyDrawerThemeVars(widget, target) {
    if (!widget || !widget.root || !target || !target.style) return;
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
      cs = window.getComputedStyle(widget.root);
    } catch (err) {
      cs = null;
    }
    var i;
    var name;
    var value;
    for (i = 0; i < names.length; i++) {
      name = names[i];
      value = cs ? cs.getPropertyValue(name) : "";
      if (!value) value = widget.root.style.getPropertyValue(name);
      if (value) target.style.setProperty(name, value);
    }
  }

  function useCustomSortMenu() {
    try {
      return window.matchMedia("(min-width: 750px)").matches;
    } catch (err) {
      return window.innerWidth >= 750;
    }
  }

  function closeSortMenu(wrap) {
    if (!wrap) return;
    wrap.classList.remove("is-sort-open");
    var menu = wrap.querySelector(".smart-filter__sort-menu");
    if (menu) menu.hidden = true;
  }

  function openSortMenu(wrap, menu) {
    if (!wrap || !menu) return;
    var rect = wrap.getBoundingClientRect();
    var viewport = Math.max(
      document.documentElement.clientWidth || 0,
      window.innerWidth || 0,
    );
    var maxWidth = Math.max(160, viewport - 24);
    var width = Math.min(Math.max(rect.width, 240), maxWidth);
    var left = rect.right - width;
    if (left < 12) left = 12;
    if (left + width > viewport - 12) {
      left = Math.max(12, viewport - 12 - width);
    }
    menu.style.position = "fixed";
    menu.style.top = Math.round(rect.bottom + 4) + "px";
    menu.style.left = Math.round(left) + "px";
    menu.style.right = "auto";
    menu.style.width = Math.round(width) + "px";
    menu.style.maxWidth = maxWidth + "px";
    menu.style.zIndex = "100060";
    menu.hidden = false;
    wrap.classList.add("is-sort-open");
  }

  function enhanceSortMenu(widget) {
    var wrap = widget && widget.sortWrap;
    var select = widget && widget.sortEl;
    if (!wrap || !select || wrap.hidden) {
      if (wrap) closeSortMenu(wrap);
      return;
    }
    copyDrawerThemeVars(widget, wrap);
    var menu = wrap.querySelector(".smart-filter__sort-menu");
    if (!menu) {
      menu = document.createElement("div");
      menu.className = "smart-filter__sort-menu";
      menu.setAttribute("role", "listbox");
      menu.hidden = true;
      wrap.appendChild(menu);
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
      var live = wrap.querySelector(".smart-filter__sort-menu") || menu;
      if (wrap.classList.contains("is-sort-open")) closeSortMenu(wrap);
      else openSortMenu(wrap, live);
      try {
        select.focus();
      } catch (err) {}
    });
    select.addEventListener("keydown", function (e) {
      if (!useCustomSortMenu()) return;
      if (e.key === "Escape") {
        closeSortMenu(wrap);
        return;
      }
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        openSortMenu(wrap, wrap.querySelector(".smart-filter__sort-menu") || menu);
      }
    });
    if (!window.__findlySortMenuDoc) {
      window.__findlySortMenuDoc = true;
      document.addEventListener("click", function (e) {
        var openWrap = document.querySelector(".smart-filter__sort.is-sort-open");
        if (!openWrap || openWrap.contains(e.target)) return;
        closeSortMenu(openWrap);
      });
      document.addEventListener("keydown", function (e) {
        if (e.key !== "Escape") return;
        var openWrap = document.querySelector(".smart-filter__sort.is-sort-open");
        if (openWrap) closeSortMenu(openWrap);
      });
    }
  }

  function toolbarHost() {
    var host = document.querySelector(".sf-sort-host");
    if (host) return host;
    var main = document.querySelector(".sf-collection-layout__main");
    if (!main) {
      var grid = document.querySelector(PRODUCT_GRID_SELECTOR);
      main = grid && grid.parentElement;
    }
    if (!main) return null;
    host = document.createElement("div");
    host.className = "sf-sort-host";
    if (main.firstChild) main.insertBefore(host, main.firstChild);
    else main.appendChild(host);
    return host;
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

  function ensureFindlyGridObserver(self) {
    if (!self || self._findlyGridObserver) return;
    if (typeof MutationObserver !== "function") return;
    var debounceTimer = null;
    self._findlyGridObserver = new MutationObserver(function () {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(function () {
        debounceTimer = null;
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
        applyNativeAfterGrid(self);
      }, 50);
    });
    self._findlyGridObserver.observe(document.documentElement, {
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
        return parent;
      }

      if (!inAppMode) return null;
      if (results && results.parentElement) {
        this._gridParent = results.parentElement;
        return this._gridParent;
      }
      this._gridParent = fallbackHost();
      return this._gridParent;
    };

    var origWrap = proto.wrapHostWithLayout;
    proto.wrapHostWithLayout = function (host, mount, position) {
      try {
        if (
          host &&
          host.parentElement &&
          (isResultsListEl(host) || isListHost(host))
        ) {
          host = host.parentElement;
        }
        var existing =
          (mount && mount.closest && mount.closest(".sf-collection-layout")) ||
          (host &&
          host.classList &&
          host.classList.contains("sf-collection-layout")
            ? host
            : null);
        if (host && existing && (host === existing || host.contains(existing))) {
          existing = stampLayoutPosition(existing, position) || existing;
          if (host !== existing && host.classList) {
            host.classList.add("sf-collection-layout__main");
          }
          if (mount && mount.classList) {
            mount.classList.add("sf-collection-layout__aside");
          }
          if (position === "right") {
            if (existing.lastChild !== mount) existing.appendChild(mount);
          } else if (existing.firstChild !== mount) {
            existing.insertBefore(mount, existing.firstChild);
          }
          return existing;
        }
        if (existing && host && !canMoveNode(existing, host)) {
          existing = stampLayoutPosition(existing, position) || existing;
          if (mount && mount.classList) {
            mount.classList.add("sf-collection-layout__aside");
          }
          return existing;
        }
        return origWrap ? origWrap.call(this, host, mount, position) : null;
      } catch (err) {
        return (
          (mount && mount.closest && mount.closest(".sf-collection-layout")) ||
          null
        );
      }
    };

    var origSync = proto.syncCollectionLayout;
    proto.syncCollectionLayout = function () {
      var layout;
      try {
        layout = origSync ? origSync.apply(this, arguments) : undefined;
      } catch (err) {
        /* ignore */
      }
      portalMobileDrawer(this);
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

    var origApply = proto.applyAppGrid;
    proto.applyAppGrid = function (data, handles, append) {
      var sliced = pageSlicePayload(this, data, handles, append);
      var parent =
        this._gridParent ||
        (this.ensureGridParent && this.ensureGridParent());
      var ok = origApply
        ? origApply.call(this, sliced.data, sliced.handles, append)
        : false;
      parent = this._gridParent || parent;
      if (parent && isGridHostEl(parent) && parent.classList) {
        parent.classList.remove("sf-app-grid");
        restyleAppCardsAsThemeItems(parent);
      }
      setOwnsGrid(true);
      return ok;
    };

    var origIntercept = proto.applyInterceptGrid;
    proto.applyInterceptGrid = function (handles, append) {
      var next = pageSlice(this, handles, append);
      var ok = origIntercept ? origIntercept.call(this, next, append) : false;
      if (!(this._appGridActive || (this.isAppGridMode && this.isAppGridMode()))) {
        applyNativeFilterGrid(
          this._shownHandles && this._shownHandles.length
            ? this._shownHandles
            : next,
          this._gridParent,
        );
      }
      return ok;
    };

    var origFetch = proto.fetchFilters;
    proto.fetchFilters = function () {
      var result = origFetch ? origFetch.apply(this, arguments) : undefined;
      var self = this;
      if (result && typeof result.then === "function") {
        return result.then(function (value) {
          if (
            !(self._appGridActive || (self.isAppGridMode && self.isAppGridMode()))
          ) {
            applyNativeAfterGrid(self);
          } else if (self._gridParent && self.hideNativeGridCards) {
            self.hideNativeGridCards(self._gridParent);
          }
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

    var origPlaceSort = proto.placeSortOnGrid;
    proto.placeSortOnGrid = function () {
      if (origPlaceSort) origPlaceSort.call(this);
      enhanceSortMenu(this);
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
      var host = resolveCardHost(parent) || parent;
      if (host && isLayoutShell(host) && host.querySelector) {
        var inner =
          host.querySelector(".main-collection-grid") ||
          host.querySelector("#product-grid") ||
          host.querySelector("#ProductGrid") ||
          host.querySelector("ul.product-grid");
        if (inner) host = inner;
      }
      function stamp(el, on) {
        if (!el || !el.classList) return;
        if (on) {
          el.classList.add("sf-grid-busy");
          el.setAttribute("aria-busy", "true");
        } else {
          el.classList.remove("sf-grid-busy");
          el.setAttribute("aria-busy", "false");
        }
      }
      if (parent && parent !== host) stamp(parent, false);
      stamp(host, busy);
      if (origBusy && origBusy !== proto.setGridBusy && !host) {
        origBusy.call(this, busy);
      }
    };

    var origSyncGrid = proto.syncProductGrid;
    proto.syncProductGrid = function (handles) {
      var parent =
        this._gridParent ||
        (this.ensureGridParent && this.ensureGridParent());
      applyNativeFilterGrid(handles, parent);
      if (origSyncGrid && origSyncGrid !== proto.syncProductGrid) {
        /* tray owns visibility; skip CSS hide/order that leaks titles */
      }
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

    var origRenderFacets = proto.renderFacets;
    proto.renderFacets = function () {
      var result = origRenderFacets
        ? origRenderFacets.apply(this, arguments)
        : undefined;
      enhancePriceSliders(this.root);
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
    }
  }

  install();
})();
