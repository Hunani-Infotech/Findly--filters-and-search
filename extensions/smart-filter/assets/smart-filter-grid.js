/**
 * Collection grid takeover extras.
 * Loaded from Liquid via asset_url so it does not count against the 100 KB
 * schema "javascript" cap on smart-filter.min.js.
 *
 * Patches Widget.prototype as soon as window.__FINDLY_FILTER_WIDGET is set.
 */
(function () {
  "use strict";

  var STYLE_ID = "findly-grid-takeover-v3";
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
    "#product-grid, #ProductGrid, ul.product-grid, ol.product-grid, [data-id='product-grid'], [data-product-grid], .grid.product-grid";

  function findlyLog() {
    var args = ["[Findly]"];
    var i;
    for (i = 0; i < arguments.length; i++) args.push(arguments[i]);
    try {
      if (typeof console !== "undefined" && console.info) {
        console.info.apply(console, args);
      }
    } catch (err) {
      /* ignore */
    }
    try {
      window.__FINDLY_LOGS = window.__FINDLY_LOGS || [];
      window.__FINDLY_LOGS.push({
        t: Date.now(),
        m: Array.prototype.slice.call(arguments),
      });
    } catch (err2) {
      /* ignore */
    }
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
    findlyLog("loose hash applied", {
      hash: raw,
      selected: widget.selected,
      sort: widget.sortKey,
    });
    return true;
  }

  function bindHashChange() {
    if (window.__findlyHashBound) return;
    window.__findlyHashBound = true;
    window.addEventListener("hashchange", function () {
      var widget = window.__FINDLY_FILTER_WIDGET;
      if (!widget || !widget.fetchFilters) return;
      findlyLog("hashchange", window.location.hash);
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
      ".smart-filter .smart-filter__option:not(.smart-filter__swatch):not(.smart-filter__pill) input[type=radio]:checked::after{transform:scale(1)}";
    var style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = css;
    (document.head || document.documentElement).appendChild(style);
    findlyLog("css injected", {
      id: STYLE_ID,
      checkCssLink: Boolean(
        document.querySelector('link[href*="smart-filter-check"]'),
      ),
    });
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

  function countAppCards(parent) {
    if (!parent || !parent.querySelectorAll) return 0;
    return parent.querySelectorAll(".sf-app-card").length;
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
          "header, footer, product-recommendations, .related-products, [data-related-products], .recently-viewed",
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
    if (
      tag === "a" ||
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
      / card__inner | card__content | card__media | card__information | card__heading | card-information | full-unstyled-link | media-wrapper | card__text /.test(
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

  function isOuterThemeCard(el) {
    if (!el || el.nodeType !== 1) return false;
    if (el.classList && el.classList.contains("sf-app-card")) return false;
    if (isInnerCardSlice(el)) return false;
    var tag = String(el.tagName || "").toLowerCase();
    if (tag === "product-card") return true;
    if (el.classList && el.classList.contains("product-card")) return true;
    if (el.classList && el.classList.contains("grid__item")) return true;
    if (el.classList && el.classList.contains("product-grid__item")) return true;
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
      "header, footer, product-recommendations, .related-products, [data-related-products], .recently-viewed";
    if (hint && hint.nodeType === 1) {
      var promoted = promoteToGridHost(hint);
      if (promoted && gridHasProductLinks(promoted) && !isSkippedCardRegion(promoted)) {
        return promoted;
      }
    }

    var cards = document.querySelectorAll(
      "main product-card, main .product-card, " +
        RESULTS_LIST_SELECTOR +
        " product-card, " +
        RESULTS_LIST_SELECTOR +
        " .product-card",
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
            "li.grid__item, li.product-grid__item, product-card, .product-card",
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
    var link =
      card.querySelector && card.querySelector('a[href*="/products/"]');
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

  function collectDirectThemeCards(parent) {
    var cards = [];
    if (!parent || !parent.children) return cards;
    var i;
    for (i = 0; i < parent.children.length; i++) {
      var child = parent.children[i];
      if (!child || child.nodeType !== 1) continue;
      if (child.classList && child.classList.contains("sf-app-card")) continue;
      if (isInnerCardSlice(child)) continue;
      if (!isOuterThemeCard(child) && !handleFromCard(child)) continue;
      cards.push({ el: child, handle: handleFromCard(child) });
    }
    return cards;
  }

  function collectThemeCards(parent) {
    parent = promoteToGridHost(parent) || parent;
    var cards = collectDirectThemeCards(parent);
    if (cards.length) return cards;
    if (!parent || !parent.querySelector) return cards;
    var inner =
      parent.querySelector(PRODUCT_GRID_SELECTOR) ||
      parent.querySelector(RESULTS_LIST_SELECTOR);
    if (inner && inner !== parent && !isSkippedCardRegion(inner)) {
      cards = collectDirectThemeCards(inner);
      if (cards.length) return cards;
    }
    return cards;
  }

  function resetInnerFilterHides(parent) {
    if (!parent || !parent.querySelectorAll) return;
    var nodes = parent.querySelectorAll("[data-smart-filter-hidden='true']");
    var i;
    for (i = 0; i < nodes.length; i++) {
      if (isInnerCardSlice(nodes[i])) showEl(nodes[i]);
    }
  }

  function applyNativeFilterGrid(handles, hint) {
    stripAppCards(document);
    var parent = findThemeCardParent(hint);
    var allowed = Array.isArray(handles) ? allowedHandleSet(handles) : null;
    var cards = collectThemeCards(parent);
    resetInnerFilterHides(parent);
    var i;
    for (i = 0; i < cards.length; i++) {
      var item = cards[i];
      if (!allowed) {
        showCardTree(item.el);
        continue;
      }
      if (item.handle && allowed[item.handle]) showCardTree(item.el);
      else hideEl(item.el);
    }
    findlyLog("native filter grid", {
      parent: describeHost(parent),
      firstCard: cards[0] ? describeHost(cards[0].el) : null,
      total: cards.length,
      allowed: handles ? handles.length : null,
    });
    return cards.length > 0;
  }

  function applyNativeAfterGrid(self) {
    if (!self || (self.appGridTemplate && self.appGridTemplate())) return;
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

  function describeHost(el) {
    if (!el) return null;
    var vis = hostVisibility(el);
    return {
      tag: el.tagName,
      id: el.id || "",
      className: String(el.className || "").slice(0, 160),
      visible: vis.visible,
      w: vis.w,
      h: vis.h,
      display: vis.display,
      appCards: countAppCards(el),
      inResults: Boolean(el.closest && el.closest(RESULTS_LIST_SELECTOR)),
    };
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
        findlyLog("checkbox change", {
          name: input.getAttribute("name"),
          value: input.value,
          checked: input.checked,
          autoApply: widget.autoApplyFilters,
        });
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
          if (!parent) return;
          if (self.hideNativeGridCards) self.hideNativeGridCards(parent);
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

  function patchWidget(widget) {
    if (!widget) return;
    liftOutOfThemeForm(widget);
    var proto = Object.getPrototypeOf(widget);
    if (!proto || proto.__findlyGridPatched) return;
    proto.__findlyGridPatched = true;

    proto.isAppGridMode = function () {
      return Boolean(this.appGridTemplate && this.appGridTemplate());
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
          findlyLog("wrapHostWithLayout skip cycle", {
            host: host.tagName,
            same: host === existing,
          });
          if (host.classList) host.classList.add("sf-collection-layout__main");
          if (mount && mount.classList) {
            mount.classList.add("sf-collection-layout__aside");
          }
          return existing;
        }
        if (existing && host && !canMoveNode(existing, host)) {
          findlyLog("wrapHostWithLayout skip append", { host: host.tagName });
          return existing;
        }
        return origWrap ? origWrap.call(this, host, mount, position) : null;
      } catch (err) {
        findlyLog("wrapHostWithLayout error", String((err && err.message) || err));
        return (
          (mount && mount.closest && mount.closest(".sf-collection-layout")) ||
          null
        );
      }
    };

    var origSync = proto.syncCollectionLayout;
    proto.syncCollectionLayout = function () {
      try {
        return origSync ? origSync.apply(this, arguments) : undefined;
      } catch (err) {
        findlyLog(
          "syncCollectionLayout error",
          String((err && err.message) || err),
        );
      }
    };

    var origHide = proto.hideNativeGridCards;
    proto.hideNativeGridCards = function (parent) {
      if (this.appGridTemplate && this.appGridTemplate()) {
        if (origHide) origHide.call(this, parent);
        hideNestedThemeCards(parent);
      }
    };

    var origRestore = proto.restoreNativeGrid;
    proto.restoreNativeGrid = function () {
      stripAppCards(document);
      applyNativeFilterGrid(null, this._gridParent);
      if (origRestore) origRestore.call(this);
      setOwnsGrid(false);
    };

    proto.applyThemeGridLegacy = function (data, handles) {
      stripAppCards(document);
      if (this.restoreThemePaging) this.restoreThemePaging();
      applyNativeFilterGrid(handles, this._gridParent);
      this._shownHandles = handles || [];
    };

    proto.applyInterceptGrid = function (handles) {
      applyNativeFilterGrid(handles, this._gridParent);
      this._shownHandles = handles || [];
      return true;
    };

    var origApply = proto.applyAppGrid;
    proto.applyAppGrid = function (data, handles, append) {
      if (!(this.appGridTemplate && this.appGridTemplate())) {
        stripAppCards(document);
        applyNativeFilterGrid(handles, this._gridParent);
        this._appGridActive = false;
        this._shownHandles = handles || [];
        findlyLog("applyAppGrid native", {
          products: handles && handles.length,
          total: data && data.total,
        });
        return true;
      }
      return origApply ? origApply.call(this, data, handles, append) : false;
    };

    var origFetch = proto.fetchFilters;
    proto.fetchFilters = function () {
      var url = this.buildProxyUrl ? this.buildProxyUrl() : "";
      findlyLog("fetchFilters", {
        selected: this.selected,
        price: this.price,
        url: url,
        hash: String(window.location.hash || ""),
        appGrid: Boolean(this.isAppGridMode && this.isAppGridMode()),
        autoApply: this.autoApplyFilters,
      });
      var result = origFetch ? origFetch.apply(this, arguments) : undefined;
      var self = this;
      if (result && typeof result.then === "function") {
        return result.then(function (value) {
          applyNativeAfterGrid(self);
          return value;
        });
      }
      return result;
    };

    var origInit = proto.init;
    proto.init = function () {
      applyLooseHash(this);
      findlyLog("init", {
        selected: this.selected,
        hash: String(window.location.hash || ""),
        collectionId: this.collectionId,
      });
      if (origInit) origInit.apply(this, arguments);
    };

    var origWatch = proto.watchThemeGrid;
    proto.watchThemeGrid = function () {
      if (origWatch) origWatch.call(this);
      applyNativeAfterGrid(this);
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
    } catch (err) {
      /* ignore */
    }
  }

  function install() {
    injectCss();
    bindFindlyChangeCapture();
    bindHashChange();
    var held = window.__FINDLY_FILTER_WIDGET;
    installSetter(held);
    if (held) {
      patchWidget(held);
      applyLooseHash(held);
      if (
        held.hasActiveFilters &&
        held.hasActiveFilters() &&
        held.fetchFilters
      ) {
        held.fetchFilters();
      }
    }
    findlyLog("companion ready", {
      widget: Boolean(held),
      hash: String(window.location.hash || ""),
    });
  }

  install();
})();
