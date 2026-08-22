/**
 * Collection grid takeover extras.
 * Loaded from Liquid via asset_url so it does not count against the 100 KB
 * schema "javascript" cap on smart-filter.min.js.
 *
 * Patches Widget.prototype as soon as window.__FINDLY_FILTER_WIDGET is set.
 */
(function () {
  "use strict";

  var STYLE_ID = "findly-grid-takeover";
  var HOST_ID = "findly-grid-host";
  var THEME_CARD_HOST_SELECTOR = [
    "product-card",
    ".product-card",
    "[data-product-handle]",
    "[data-product-id]",
    "li.grid__item",
    ".product-grid__item",
    ".card-wrapper",
  ].join(", ");
  var RESULTS_LIST_SELECTOR =
    "results-list, .results-list, #ResultsList";
  var PRODUCT_GRID_SELECTOR =
    "#product-grid, ul.product-grid, .product-grid";

  function injectCss() {
    if (document.getElementById(STYLE_ID)) return;
    var css =
      ".sf-app-grid>:not(.sf-app-card){display:none!important}" +
      "html.sf-og .product-grid>:not(.sf-app-card)," +
      "html.sf-og results-list>:not(.sf-app-card)," +
      "html.sf-og .sf-collection-layout__main :is(.product-grid,results-list)>:not(.sf-app-card){display:none!important}" +
      "html.sf-og main product-card:not(.sf-app-card)," +
      "html.sf-og .sf-collection-layout__main product-card:not(.sf-app-card)," +
      "html.sf-og results-list product-card:not(.sf-app-card)," +
      "html.sf-og main .pagination," +
      "html.sf-og .sf-collection-layout__main .pagination," +
      "html.sf-og .pagination-wrapper," +
      "html.sf-og nav.pagination{display:none!important}" +
      "html.sf-og .sorting-filter," +
      "html.sf-og .sorting-filter__container," +
      "html.sf-og .facets__sort," +
      "html.sf-og .collection-toolbar__sort," +
      "html.sf-og facet-filters-form .select{display:none!important}";
    var style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = css;
    (document.head || document.documentElement).appendChild(style);
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
    } catch (err) {}
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
    node.removeAttribute("data-smart-filter-hidden");
    node.style.removeProperty("display");
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

  function countAppCards(parent) {
    if (!parent || !parent.querySelectorAll) return 0;
    return parent.querySelectorAll(".sf-app-card").length;
  }

  function pickBetterGridHost(parent) {
    var parentTheme = countThemeCards(parent);
    var candidates = document.querySelectorAll(
      RESULTS_LIST_SELECTOR + ", " + PRODUCT_GRID_SELECTOR,
    );
    var best = parent;
    var bestCount = parentTheme;
    var i;
    for (i = 0; i < candidates.length; i++) {
      var candidate = candidates[i];
      if (!candidate || candidate.nodeType !== 1) continue;
      var themeCount = countThemeCards(candidate);
      if (themeCount > bestCount) {
        best = candidate;
        bestCount = themeCount;
      }
    }
    return best;
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

  function ensureFindlyGridObserver(self) {
    if (!self || self._findlyGridObserver) return;
    if (typeof MutationObserver !== "function") return;
    var debounceTimer = null;
    self._findlyGridObserver = new MutationObserver(function () {
      if (!self._appGridActive) return;
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(function () {
        debounceTimer = null;
        if (!self._appGridActive) return;
        try {
          var url = new URL(window.location.href);
          if (url.searchParams.has("page")) stripThemePageParam();
        } catch (err) {}
        var parent = self._gridParent;
        if (!parent) return;
        if (self.hideNativeGridCards) self.hideNativeGridCards(parent);
      }, 50);
    });
    self._findlyGridObserver.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  }

  function patchWidget(widget) {
    if (!widget) return;
    var proto = Object.getPrototypeOf(widget);
    if (!proto || proto.__findlyGridPatched) return;
    proto.__findlyGridPatched = true;

    var origMode = proto.isAppGridMode;
    proto.isAppGridMode = function () {
      if (origMode) {
        var mode = origMode.call(this);
        if (mode) return mode;
      }
      return Boolean(this.hasActiveFilters && this.hasActiveFilters()) ||
        Boolean(this.collectionQuery);
    };

    var origEnsure = proto.ensureGridParent;
    proto.ensureGridParent = function () {
      var parent = origEnsure ? origEnsure.call(this) : null;
      var inAppMode =
        this.isAppGridMode && this.isAppGridMode();

      if (parent && inAppMode) {
        var themeCards = countThemeCards(parent);
        var appCards = countAppCards(parent);
        if (themeCards === 0 && appCards === 0) {
          parent = null;
        } else {
          parent = pickBetterGridHost(parent);
        }
      }

      if (parent) {
        this._gridParent = parent;
        return parent;
      }

      if (!inAppMode) return null;
      this._gridParent = fallbackHost();
      return this._gridParent;
    };

    var origHide = proto.hideNativeGridCards;
    proto.hideNativeGridCards = function (parent) {
      if (origHide) origHide.call(this, parent);
      hideNestedThemeCards(parent);
    };

    var origRestore = proto.restoreNativeGrid;
    proto.restoreNativeGrid = function () {
      var parent = this._gridParent;
      if (origRestore) origRestore.call(this);
      setOwnsGrid(false);
      if (!parent || !parent.querySelectorAll) return;
      var nested = parent.querySelectorAll("[data-smart-filter-hidden='true']");
      var i;
      for (i = 0; i < nested.length; i++) showEl(nested[i]);
    };

    var origRender = proto.renderAppCard;
    proto.renderAppCard = function (product) {
      var card = origRender ? origRender.call(this, product) : null;
      if (!card) return card;
      var parent = this._gridParent;
      if (!isListHost(parent) || String(card.tagName).toLowerCase() === "li") {
        return card;
      }
      var li = document.createElement("li");
      li.className = card.className;
      var attrs = card.attributes;
      var a;
      for (a = 0; a < attrs.length; a++) {
        if (attrs[a].name === "class") continue;
        li.setAttribute(attrs[a].name, attrs[a].value);
      }
      while (card.firstChild) li.appendChild(card.firstChild);
      return li;
    };

    var origApply = proto.applyAppGrid;
    proto.applyAppGrid = function (data, handles, append) {
      stripThemePageParam();
      var ok = origApply ? origApply.call(this, data, handles, append) : false;
      if (this._appGridActive) {
        setOwnsGrid(true);
        ensureFindlyGridObserver(this);
        hideNestedThemeCards(this._gridParent);
      }
      return ok;
    };

    var origWatch = proto.watchThemeGrid;
    proto.watchThemeGrid = function () {
      if (origWatch) origWatch.call(this);
      if (this._findlyGridWatch) return;
      this._findlyGridWatch = true;
      ensureFindlyGridObserver(this);
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
        },
      });
    } catch (err) {}
  }

  function install() {
    injectCss();
    var held = window.__FINDLY_FILTER_WIDGET;
    installSetter(held);
    if (held) patchWidget(held);
  }

  install();
})();
