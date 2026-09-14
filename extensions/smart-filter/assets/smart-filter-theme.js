/**
 * Theme-agnostic storefront glue.
 * Discovers product grids, native filter chrome, and layout hosts on any
 * theme instead of relying on Dawn/Horizon class names alone.
 * Loaded from Liquid via asset_url (not counted against the 100 KB schema cap).
 */
(function () {
  "use strict";

  var STYLE_ID = "findly-theme-compat-v10";
  var SKIP =
    "header, footer, .header, .footer, .announcement-bar, .shopify-section-group-header-group, product-recommendations, .related-products, [data-related-products], .recently-viewed, .predictive-search, .quick-add-modal, .complementary-products, .collection-banner, .collection-hero, .slideshow";
  var PROTECT =
    ".smart-filter, .smart-filter-search, .findly-instant, .sf-panel, .sf-facet, .sf-facets, .sf-header, .sf-backdrop, .sf-toolbar, .sf-sort-host, .sf-search-host, .sf-total-count, .sf-pager, .sf-app-card, .sf-collection-layout";
  var NATIVE_INPUT =
    "[name^='filter.'], [name^='filter.v.'], [name^='filter.p.'], select[name='sort_by'], select[name='sortBy']";
  var PAGER_HINT =
    "nav.pagination, .pagination, .pagination-wrapper, [data-pagination], .paginate, #pagination, load-more-button, .load-more-button, [data-load-more], .ajaxinate-pagination, #AjaxinatePagination, .Pagination, .infinite-scroll, .js-load-more, .btn--load-more, .pagination__load-more";

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

  function hideLeaf(el) {
    if (!el || el.nodeType !== 1) return;
    if (isFindlyUi(el) || isSkipped(el)) return;
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

  function hideIfChrome(el) {
    if (!el || el.nodeType !== 1) return;
    if (isFindlyUi(el) || isSkipped(el)) return;
    if (clusterScore(el) >= 2) {
      var kids = el.children;
      var k;
      for (k = 0; k < kids.length; k++) hideIfChrome(kids[k]);
      return;
    }
    hideLeaf(el);
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
    if (isFindlyUi(el) || isSkipped(el)) return false;
    var tag = String(el.tagName || "").toLowerCase();
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
    var inputs = document.querySelectorAll(NATIVE_INPUT);
    var i;
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
      if (looksLikeFilterChrome(candidates[i])) hideIfChrome(candidates[i]);
    }
    unhideFindlyDrawer();
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
      "@media(min-width:750px){" +
      ".sf-collection-layout--left{display:grid!important;grid-template-columns:320px minmax(0,1fr)!important;align-items:start;gap:32px;width:100%!important}" +
      ".sf-collection-layout--right{display:grid!important;grid-template-columns:minmax(0,1fr) 320px!important;align-items:start;gap:32px;width:100%!important}" +
      ".sf-collection-layout--left>.sf-layout-main,.sf-collection-layout--right>.sf-layout-main{" +
      "min-width:0!important;max-width:none!important}" +
      "}" +
      ".sf-layout-main:not(ul):not(ol):not(.product-grid):not(.main-collection-grid){min-width:0;flex:1 1 0%;display:block}" +
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
    form.parentNode.insertBefore(mount, form);
    widget._gridParent = null;
  }

  function patchWidget(widget) {
    if (!widget) return;
    var proto = Object.getPrototypeOf(widget);
    if (!proto || proto.__findlyThemePatched) return;
    proto.__findlyThemePatched = true;

    var origEnsure = proto.ensureGridParent;
    proto.ensureGridParent = function () {
      var parent = origEnsure ? origEnsure.call(this) : this._gridParent;
      if (parent && isSkipped(parent)) parent = null;
      if (!parent) parent = discoverAnyThemeGrid();
      if (parent) this._gridParent = parent;
      return this._gridParent || parent;
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
      if (origHide) origHide.call(this);
      hideNativeChromeHeuristic();
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
      var result = origSync ? origSync.apply(this, arguments) : undefined;
      hideNativeChromeHeuristic();
      ensureSortHost(this);
      ensureCollectionSearchHost(this);
      return result;
    };

    var origInit = proto.init;
    proto.init = function () {
      injectCompatCss();
      liftOutOfAnyFilterForm(this);
      if (origInit) origInit.apply(this, arguments);
      if (!this._gridParent && this.ensureGridParent) this.ensureGridParent();
      if (this.syncCollectionLayout) this.syncCollectionLayout();
      hideNativeChromeHeuristic();
    };
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

  function restoreFiltersFromLocation(widget) {
    if (!widget || !widget.fetchFilters) return;
    if (widget.restoreFromHash) widget.restoreFromHash();
    try {
      widget.fetchFilters();
    } catch (err) {
      /* ignore */
    }
  }

  function rebindWidget() {
    var widget = window.__FINDLY_FILTER_WIDGET;
    cleanupOrphanPortals(false);
    if (!widget || !widget.root || widget.root.isConnected === false) return;
    widget._gridParent = null;
    if (widget.ensureGridParent) widget.ensureGridParent();
    if (widget.syncCollectionLayout) widget.syncCollectionLayout();
    if (widget.placeCollectionSearchOnGrid) widget.placeCollectionSearchOnGrid();
    if (widget.hideThemeDuplicateChrome) widget.hideThemeDuplicateChrome();
    if (widget.watchThemeGrid) widget.watchThemeGrid();
    if (Array.isArray(widget._visibleHandles) && window.applyProductVisibility) {
      /* visibility lives in the schema IIFE; MutationObserver in grid companion covers it */
    }
  }

  function bindThemeLifecycle() {
    if (window.__findlyThemeLifecycle) return;
    window.__findlyThemeLifecycle = true;
    document.addEventListener("shopify:section:load", function () {
      window.setTimeout(function () {
        cleanupOrphanPortals(false);
        rebindWidget();
      }, 0);
    });
    document.addEventListener("shopify:section:unload", function (event) {
      if (scopeHasFilter(event && event.target)) {
        window.__FINDLY_FILTER_BOOTED = false;
        cleanupOrphanPortals(true);
        return;
      }
      window.setTimeout(rebindWidget, 0);
    });
    document.addEventListener("shopify:section:reorder", function () {
      window.setTimeout(rebindWidget, 0);
    });
    document.addEventListener("shopify:block:select", function () {
      window.setTimeout(rebindWidget, 0);
    });
    document.addEventListener("shopify:block:deselect", function () {
      window.setTimeout(rebindWidget, 0);
    });
    window.addEventListener("popstate", function () {
      window.setTimeout(function () {
        var widget = window.__FINDLY_FILTER_WIDGET;
        if (widget && liveFilterRoot()) restoreFiltersFromLocation(widget);
        rebindWidget();
      }, 0);
    });
    window.addEventListener("pageshow", function (event) {
      if (!event || !event.persisted) return;
      window.setTimeout(function () {
        var widget = window.__FINDLY_FILTER_WIDGET;
        if (widget && liveFilterRoot()) restoreFiltersFromLocation(widget);
        rebindWidget();
      }, 0);
    });
    window.addEventListener("load", function () {
      window.setTimeout(rebindWidget, 50);
    });
    document.addEventListener("page:load", function () {
      window.setTimeout(rebindWidget, 0);
    });
    document.addEventListener("turbo:load", function () {
      window.setTimeout(rebindWidget, 0);
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

  function install() {
    injectCompatCss();
    bindThemeLifecycle();
    installSetter();
  }

  install();
})();
