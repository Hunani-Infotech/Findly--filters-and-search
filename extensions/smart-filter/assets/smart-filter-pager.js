/**
 * Collection pager — theme numbered pagination + Load More + infinite sync.
 * Loaded from Liquid via asset_url so it does not count against the 100 KB
 * schema "javascript" cap on smart-filter.min.js.
 *
 * Patches Widget.prototype as soon as window.__FINDLY_FILTER_WIDGET is set.
 * Filtered views rewrite numbered theme pagers via syncThemePager +
 * bindThemePagerClicks → goToPage. Theme Load More controls are kept
 * visible/bound separately (not rewritten). Theme #infinite-loader /
 * [data-next-url] hosts are disarmed while filters are active and driven
 * by Findly append paging so unfiltered collection ?page=N HTML cannot
 * leak into the grid. Unfiltered browse leaves theme infinite alone.
 */
(function () {
  "use strict";

  var THEME_PAGER_SEL =
    "nav.pagination, .pagination-wrapper, .pagination, [data-pagination], .paginate, #pagination, .Pagination, #AjaxinatePagination, .ajaxinate-pagination";
  /* Kept separate from THEME_PAGER_SEL so rewritePager never treats these
     as numbered lists. */
  var THEME_LOAD_MORE_SEL =
    "load-more-button, .load-more-button, .pagination__load-more, [data-load-more], button[name='load-more'], .js-load-more, .btn--load-more";
  var THEME_INFINITE_SEL = "#infinite-loader, [data-next-url]";
  var PAGER_CHROME_SKIP =
    "header, footer, .header, .footer, .announcement-bar, .predictive-search, .quick-add-modal, product-recommendations, .shopify-section-group-header-group, .shopify-section-group-footer-group";
  var ORIG_ATTR = "data-sf-theme-orig";
  var SUPPRESS_ATTR = "data-sf-pager-suppressed";
  var NEXT_URL_ORIG_ATTR = "data-sf-next-url-orig";
  var INFINITE_OWNED_ATTR = "data-sf-infinite-owned";
  var LOAD_MORE_CSS_ID = "findly-sf-load-more-css";

  function pageWindow(current, count) {
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

  /** Always theme numbered — admin paginationStyle is ignored. */
  function usesThemeNumberedPager() {
    return true;
  }

  function setHtmlClass(name, on) {
    var root = document.documentElement;
    if (!root || !root.classList) return;
    if (on) root.classList.add(name);
    else root.classList.remove(name);
  }

  function clearCustomPagerClass() {
    setHtmlClass("sf-custom-pager", false);
  }

  function setPagerUnneeded(on) {
    setHtmlClass("sf-pager-unneeded", on);
    setHtmlClass("sf-few-results", on);
    var layout = document.querySelector(".sf-collection-layout");
    if (!layout || !layout.setAttribute) return;
    if (on) layout.setAttribute("data-sf-single-page", "1");
    else layout.removeAttribute("data-sf-single-page");
  }

  function isFindlyPager(el) {
    if (!el) return true;
    if (el.classList && el.classList.contains("sf-pager")) return true;
    if (el.id === "findly-sf-pager") return true;
    if (el.closest) return Boolean(el.closest(".sf-pager, .smart-filter"));
    return false;
  }

  function findThemePagers() {
    var nodes = document.querySelectorAll(THEME_PAGER_SEL);
    var roots = [];
    var i;
    var j;
    for (i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (!el || isFindlyPager(el)) continue;
      if (el.closest && el.closest(PAGER_CHROME_SKIP)) continue;
      var skip = false;
      for (j = 0; j < roots.length; j++) {
        if (roots[j].contains(el)) {
          skip = true;
          break;
        }
        if (el.contains(roots[j])) {
          roots[j] = el;
          skip = true;
          break;
        }
      }
      if (!skip) roots.push(el);
    }
    var anchor =
      document.querySelector(".smart-filter") ||
      document.querySelector(
        "#product-grid, #ProductGrid, .product-grid, .sf-app-grid, main, #MainContent",
      );
    if (anchor && roots.length > 1) {
      roots.sort(function (a, b) {
        var da =
          (anchor.contains && anchor.contains(a)) ||
          (a.closest && a.closest("main, #MainContent"))
            ? 0
            : 1;
        var db =
          (anchor.contains && anchor.contains(b)) ||
          (b.closest && b.closest("main, #MainContent"))
            ? 0
            : 1;
        return da - db;
      });
    }
    return roots;
  }

  function shouldDriveThemePager(widget) {
    if (!widget) return false;
    /* Keep rewritten page numbers (data-sf-page) after returning to page 1
       so clicks stay on Findly AJAX instead of theme section reloads. */
    if (widget._sfPaged) return true;
    /* Page 2+ needs rewritten theme chrome. Page 1 default browse uses the
       original Liquid pager + product cards so order matches first paint. */
    if (Math.max(1, Number(widget.page) || 1) > 1) return true;
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
    if (widget._keepThemeCards === false) return true;
    if (widget.shouldInterceptPaging) return Boolean(widget.shouldInterceptPaging());
    return false;
  }

  function snapshotPager(el) {
    if (!el || el.getAttribute(ORIG_ATTR) != null) return;
    el.setAttribute(ORIG_ATTR, el.innerHTML);
  }

  function unhidePager(el) {
    if (!el) return;
    el.hidden = false;
    el.removeAttribute("hidden");
    el.removeAttribute(SUPPRESS_ATTR);
    el.removeAttribute("data-sf-pager-hidden");
    el.removeAttribute("data-findly-theme-hidden");
    el.removeAttribute("data-findly-native-chrome");
    el.removeAttribute("data-smart-filter-hidden");
    el.removeAttribute("data-sf-pager-display");
    el.removeAttribute("data-findly-theme-display");
    if (el.classList) el.classList.remove("hidden");
    el.style.removeProperty("display");
  }

  function suppressPager(el) {
    if (!el) return;
    snapshotPager(el);
    el.setAttribute(SUPPRESS_ATTR, "1");
    el.hidden = true;
    el.setAttribute("hidden", "");
    el.style.setProperty("display", "none", "important");
  }

  function restorePager(el) {
    if (!el) return;
    el.removeAttribute("data-sf-pager-driven");
    var orig = el.getAttribute(ORIG_ATTR);
    if (orig != null) el.innerHTML = orig;
    unhidePager(el);
  }

  function payloadHasNext(widget) {
    var data = widget && widget._lastFilterData;
    if (!data) return false;
    if (data.hasNext === true || data.has_next === true) return true;
    var page = Math.max(1, Number(data.page != null ? data.page : widget.page) || 1);
    var size = Math.max(
      1,
      Number(data.pageSize != null ? data.pageSize : widget.pageSize) || 16,
    );
    var total = Number(data.total);
    if (Number.isFinite(total) && total >= 0) return page * size < total;
    return false;
  }

  function filteredTotal(widget) {
    var data = widget && widget._lastFilterData;
    if (data) {
      var fromTotal = Number(data.total);
      if (Number.isFinite(fromTotal) && fromTotal >= 0) return fromTotal;
      var fromCount = Number(data.count);
      if (Number.isFinite(fromCount) && fromCount >= 0) return fromCount;
      /*
       * Never use page-sliced handles.length as catalog total — that hides
       * the pager whenever the current page is "full" (e.g. 16 of 40).
       */
    }
    // Latest filter payload wins. Mixing it with leftover
    // _statusProductCount / _pageTotal from the previous unfiltered view
    // kept theme pagination visible on the first filter apply.
    var pageTotal = Number(widget && widget._pageTotal);
    if (Number.isFinite(pageTotal) && pageTotal >= 0) return pageTotal;
    var all = widget && widget._allFilterHandles;
    if (Array.isArray(all) && all.length) return all.length;
    var status = Number(widget && widget._statusProductCount);
    if (Number.isFinite(status) && status >= 0) return status;
    return -1;
  }

  function resultsFitOnePage(widget) {
    if (!widget) return false;
    /* API says more pages exist — keep pager visible. */
    if (payloadHasNext(widget)) return false;
    if (widget.ensurePageSize) widget.ensurePageSize();
    var size = widget.pageSize || 16;
    var total = filteredTotal(widget);
    if (total < 0) return false;
    return total <= size;
  }

  function findThemeLoadMore() {
    var nodes = document.querySelectorAll(THEME_LOAD_MORE_SEL);
    var out = [];
    var i;
    for (i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (!el || isFindlyPager(el)) continue;
      if (el.closest && el.closest(PAGER_CHROME_SKIP)) continue;
      out.push(el);
    }
    return out;
  }

  function ensureLoadMoreCss() {
    if (document.getElementById(LOAD_MORE_CSS_ID)) return;
    var style = document.createElement("style");
    style.id = LOAD_MORE_CSS_ID;
    /* Hide when a single page of results; do not force-show with
       display:flex — theme breakpoints (e.g. Dawn large-up-hide) stay in
       control after we clear inline suppress. App-grid must not swallow
       load-more children. */
    style.textContent =
      "html.sf-few-results load-more-button," +
      "html.sf-few-results .load-more-button," +
      "html.sf-few-results .pagination__load-more," +
      "html.sf-few-results [data-load-more]," +
      "html.sf-few-results button[name='load-more']," +
      "html.sf-few-results .js-load-more," +
      "html.sf-few-results .btn--load-more," +
      "html.sf-few-results #infinite-loader," +
      "html.sf-few-results [" +
      INFINITE_OWNED_ATTR +
      "='1']," +
      "html.sf-pager-unneeded load-more-button," +
      "html.sf-pager-unneeded .load-more-button," +
      "html.sf-pager-unneeded .pagination__load-more," +
      "html.sf-pager-unneeded [data-load-more]," +
      "html.sf-pager-unneeded button[name='load-more']," +
      "html.sf-pager-unneeded .js-load-more," +
      "html.sf-pager-unneeded .btn--load-more," +
      "html.sf-pager-unneeded #infinite-loader," +
      "html.sf-pager-unneeded [" +
      INFINITE_OWNED_ATTR +
      "='1']," +
      ".sf-collection-layout[data-sf-single-page='1'] load-more-button," +
      ".sf-collection-layout[data-sf-single-page='1'] .load-more-button," +
      ".sf-collection-layout[data-sf-single-page='1'] .pagination__load-more," +
      ".sf-collection-layout[data-sf-single-page='1'] [data-load-more]," +
      ".sf-collection-layout[data-sf-single-page='1'] button[name='load-more']," +
      ".sf-collection-layout[data-sf-single-page='1'] .js-load-more," +
      ".sf-collection-layout[data-sf-single-page='1'] .btn--load-more," +
      ".sf-collection-layout[data-sf-single-page='1'] #infinite-loader," +
      ".sf-collection-layout[data-sf-single-page='1'] [" +
      INFINITE_OWNED_ATTR +
      "='1']" +
      "{display:none!important}" +
      ".sf-app-grid>load-more-button," +
      ".sf-app-grid>.load-more-button," +
      ".sf-app-grid>.pagination__load-more," +
      ".sf-app-grid>[data-load-more]," +
      ".sf-app-grid>button[name='load-more']," +
      ".sf-app-grid>.js-load-more," +
      ".sf-app-grid>.btn--load-more," +
      ".sf-app-grid>#infinite-loader," +
      ".sf-app-grid load-more-button:not([" +
      SUPPRESS_ATTR +
      "='1'])," +
      ".sf-app-grid .load-more-button:not([" +
      SUPPRESS_ATTR +
      "='1'])," +
      ".sf-app-grid .pagination__load-more:not([" +
      SUPPRESS_ATTR +
      "='1'])," +
      ".sf-app-grid [data-load-more]:not([" +
      SUPPRESS_ATTR +
      "='1'])," +
      ".sf-app-grid button[name='load-more']:not([" +
      SUPPRESS_ATTR +
      "='1'])," +
      ".sf-app-grid .js-load-more:not([" +
      SUPPRESS_ATTR +
      "='1'])," +
      ".sf-app-grid .btn--load-more:not([" +
      SUPPRESS_ATTR +
      "='1'])," +
      ".sf-app-grid #infinite-loader:not([" +
      SUPPRESS_ATTR +
      "='1'])" +
      "{display:revert!important;visibility:visible!important;pointer-events:auto!important}";
    var parent = document.head || document.documentElement;
    if (parent) parent.appendChild(style);
  }

  function suppressThemeLoadMore() {
    ensureLoadMoreCss();
    var nodes = findThemeLoadMore();
    var i;
    for (i = 0; i < nodes.length; i++) suppressPager(nodes[i]);
  }

  function unhideThemeLoadMore() {
    ensureLoadMoreCss();
    var nodes = findThemeLoadMore();
    var i;
    for (i = 0; i < nodes.length; i++) unhidePager(nodes[i]);
  }

  function syncThemeLoadMore(show) {
    if (show) unhideThemeLoadMore();
    else suppressThemeLoadMore();
  }

  function findThemeInfiniteHosts() {
    var nodes = document.querySelectorAll(THEME_INFINITE_SEL);
    var out = [];
    var i;
    for (i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (!el || isFindlyPager(el)) continue;
      if (el.closest && el.closest(PAGER_CHROME_SKIP)) continue;
      out.push(el);
    }
    return out;
  }

  function snapshotNextUrl(el) {
    if (!el || el.getAttribute(NEXT_URL_ORIG_ATTR) != null) return;
    var cur = el.getAttribute("data-next-url");
    if (cur == null) return;
    el.setAttribute(NEXT_URL_ORIG_ATTR, cur);
  }

  function disarmThemeInfiniteHost(el) {
    if (!el) return;
    snapshotNextUrl(el);
    el.setAttribute(INFINITE_OWNED_ATTR, "1");
    /* Theme scripts key off data-next-url — clear so they cannot fetch
       unfiltered collection HTML while Findly owns paging. */
    if (el.hasAttribute("data-next-url")) {
      el.setAttribute("data-next-url", "");
    }
    el.hidden = false;
    el.removeAttribute("hidden");
    el.removeAttribute(SUPPRESS_ATTR);
    if (el.style) el.style.removeProperty("display");
  }

  function restoreThemeInfiniteHost(el) {
    if (!el) return;
    var orig = el.getAttribute(NEXT_URL_ORIG_ATTR);
    if (orig != null) {
      el.setAttribute("data-next-url", orig);
      el.removeAttribute(NEXT_URL_ORIG_ATTR);
    }
    el.removeAttribute(INFINITE_OWNED_ATTR);
    el.removeAttribute(SUPPRESS_ATTR);
    el.hidden = false;
    el.removeAttribute("hidden");
    if (el.style) el.style.removeProperty("display");
  }

  function suppressThemeInfiniteHosts() {
    ensureLoadMoreCss();
    var nodes = findThemeInfiniteHosts();
    var i;
    for (i = 0; i < nodes.length; i++) {
      snapshotNextUrl(nodes[i]);
      if (nodes[i].hasAttribute("data-next-url")) {
        nodes[i].setAttribute("data-next-url", "");
      }
      nodes[i].setAttribute(INFINITE_OWNED_ATTR, "1");
      suppressPager(nodes[i]);
    }
  }

  function isThemeCollectionPageUrl(url) {
    if (!url) return false;
    try {
      var u = new URL(String(url), window.location.origin);
      if (u.origin !== window.location.origin) return false;
      var path = String(u.pathname || "");
      if (path.indexOf("/apps/smart-filter") !== -1) return false;
      if (path.indexOf("/a/smart-filter") !== -1) return false;
      var page = Number(u.searchParams.get("page") || "0") || 0;
      if (page <= 1) return false;
      if (/\/collections\//.test(path) || /\/search\/?$/.test(path) || path === "/search") {
        return true;
      }
      /* Section AJAX often keeps the collection path + page + sections= */
      if (
        (u.searchParams.has("sections") || u.searchParams.has("section_id")) &&
        (path === window.location.pathname || /\/collections\//.test(path))
      ) {
        return true;
      }
      return false;
    } catch (err) {
      return false;
    }
  }

  function installThemePageFetchGuard() {
    if (window.__findlyThemePageFetchGuard) return;
    window.__findlyThemePageFetchGuard = true;

    if (typeof window.fetch === "function") {
      var origFetch = window.fetch;
      window.fetch = function (input, init) {
        var url =
          typeof input === "string"
            ? input
            : input && typeof input.url === "string"
              ? input.url
              : "";
        var w = window.__FINDLY_FILTER_WIDGET;
        if (w && shouldDriveThemePager(w) && isThemeCollectionPageUrl(url)) {
          return Promise.resolve(
            new Response("", {
              status: 204,
              statusText: "No Content",
            }),
          );
        }
        return origFetch.apply(this, arguments);
      };
    }

    if (typeof window.XMLHttpRequest === "function") {
      var xhrOpen = XMLHttpRequest.prototype.open;
      var xhrSend = XMLHttpRequest.prototype.send;
      XMLHttpRequest.prototype.open = function (method, url) {
        this.__findlyReqUrl = url;
        return xhrOpen.apply(this, arguments);
      };
      XMLHttpRequest.prototype.send = function () {
        var w = window.__FINDLY_FILTER_WIDGET;
        if (
          w &&
          shouldDriveThemePager(w) &&
          isThemeCollectionPageUrl(this.__findlyReqUrl)
        ) {
          try {
            this.abort();
          } catch (err) {
            /* ignore */
          }
          return;
        }
        return xhrSend.apply(this, arguments);
      };
    }
  }

  function loadNextFilteredPage(widget) {
    if (!widget || !shouldDriveThemePager(widget)) return;
    if (widget._sfInfiniteLoading || widget._loadingPage || widget._inflight) {
      return;
    }
    if (!payloadHasNext(widget)) {
      suppressThemeInfiniteHosts();
      disconnectWidgetInfinite(widget);
      return;
    }
    var current = Math.max(1, Number(widget.page) || 1);
    var next = current + 1;
    widget._sfInfiniteLoading = true;
    widget._sfPaged = true;
    widget.page = next;
    var finish = function () {
      widget._sfInfiniteLoading = false;
      if (widget.syncThemePager) widget.syncThemePager();
    };
    try {
      var req =
        widget.fetchFilters && widget.fetchFilters({ append: true });
      if (req && typeof req.then === "function") {
        req.then(finish, finish);
      } else {
        finish();
      }
    } catch (err) {
      finish();
    }
  }

  function disconnectWidgetInfinite(widget) {
    if (!widget) return;
    if (widget._infiniteObserver) {
      try {
        widget._infiniteObserver.disconnect();
      } catch (err) {
        /* ignore */
      }
      widget._infiniteObserver = null;
    }
    if (widget._infiniteOnScroll) {
      window.removeEventListener("scroll", widget._infiniteOnScroll);
      window.removeEventListener("resize", widget._infiniteOnScroll);
      widget._infiniteOnScroll = null;
    }
  }

  function observeFindlyInfinite(widget) {
    if (!widget) return;
    installThemePageFetchGuard();
    disconnectWidgetInfinite(widget);
    var hosts = findThemeInfiniteHosts();
    if (!hosts.length) return;

    var i;
    for (i = 0; i < hosts.length; i++) disarmThemeInfiniteHost(hosts[i]);

    function maybeLoad() {
      if (!shouldDriveThemePager(widget)) return;
      if (!payloadHasNext(widget)) {
        suppressThemeInfiniteHosts();
        disconnectWidgetInfinite(widget);
        return;
      }
      var host = hosts[0];
      if (!host || !host.isConnected) {
        hosts = findThemeInfiniteHosts();
        host = hosts[0];
        if (!host) return;
        disarmThemeInfiniteHost(host);
      }
      var rect = host.getBoundingClientRect();
      var vh =
        window.innerHeight ||
        (document.documentElement && document.documentElement.clientHeight) ||
        0;
      /* Load a bit before the sentinel fully enters the viewport. */
      if (rect.top <= vh + 240) loadNextFilteredPage(widget);
    }

    if (typeof IntersectionObserver === "function") {
      widget._infiniteObserver = new IntersectionObserver(
        function (entries) {
          var e;
          for (e = 0; e < entries.length; e++) {
            if (entries[e] && entries[e].isIntersecting) {
              loadNextFilteredPage(widget);
              break;
            }
          }
        },
        { root: null, rootMargin: "240px 0px", threshold: 0 },
      );
      for (i = 0; i < hosts.length; i++) {
        try {
          widget._infiniteObserver.observe(hosts[i]);
        } catch (err) {
          /* ignore */
        }
      }
    }

    widget._infiniteOnScroll = function () {
      maybeLoad();
    };
    window.addEventListener("scroll", widget._infiniteOnScroll, {
      passive: true,
    });
    window.addEventListener("resize", widget._infiniteOnScroll, {
      passive: true,
    });
    window.setTimeout(maybeLoad, 60);
  }

  function syncThemeInfinite(widget, show) {
    ensureLoadMoreCss();
    installThemePageFetchGuard();
    if (!show) {
      suppressThemeInfiniteHosts();
      disconnectWidgetInfinite(widget);
      return;
    }
    observeFindlyInfinite(widget);
  }

  function restoreThemeInfiniteAll(widget) {
    disconnectWidgetInfinite(widget);
    var nodes = findThemeInfiniteHosts();
    var i;
    for (i = 0; i < nodes.length; i++) restoreThemeInfiniteHost(nodes[i]);
  }

  function mergeHandleList(into, handles) {
    var map = {};
    var out = [];
    var i;
    var list = into || [];
    for (i = 0; i < list.length; i++) {
      var a = String(list[i] || "");
      if (!a || map[a]) continue;
      map[a] = true;
      out.push(a);
    }
    list = handles || [];
    for (i = 0; i < list.length; i++) {
      var b = String(list[i] || "");
      if (!b || map[b]) continue;
      map[b] = true;
      out.push(b);
    }
    return out;
  }

  function updateAccumHandles(widget, appended) {
    if (!widget) return;
    var shown = Array.isArray(widget._shownHandles)
      ? widget._shownHandles
      : [];
    if (!appended) {
      widget._sfAccumHandles = shown.slice();
      return;
    }
    widget._sfAccumHandles = mergeHandleList(widget._sfAccumHandles, shown);
  }

  function gridAllowList(widget) {
    if (!widget) return null;
    var accum = widget._sfAccumHandles;
    var shown = widget._shownHandles;
    var visible = widget._visibleHandles;
    if (Array.isArray(accum) && accum.length) return accum;
    if (Array.isArray(shown) && shown.length) return shown;
    if (Array.isArray(visible) && visible.length) return visible;
    return null;
  }

  /** Hide theme-injected cards that are not in the filtered allow-list. */
  function enforceFilteredGrid(widget) {
    if (!widget || !shouldDriveThemePager(widget)) return;
    var allow = gridAllowList(widget);
    if (!allow || !allow.length) return;
    if (typeof widget.syncProductGrid === "function") {
      widget.syncProductGrid(allow);
    }
    widget._visibleHandles = allow.slice();
  }

  function clearThemePageFromUrl() {
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

  function suppressThemePagers() {
    var roots = findThemePagers();
    var i;
    for (i = 0; i < roots.length; i++) suppressPager(roots[i]);
    suppressThemeLoadMore();
  }

  function unhideThemePagers() {
    var roots = findThemePagers();
    var i;
    for (i = 0; i < roots.length; i++) unhidePager(roots[i]);
    unhideThemeLoadMore();
  }

  function applyPagerByProductCount(widget, count) {
    if (widget && widget.ensurePageSize) widget.ensurePageSize();
    var size = (widget && widget.pageSize) || 16;
    var n = Number(count);
    if (!Number.isFinite(n) || n < 0) return;
    var hide = n <= size && !payloadHasNext(widget);
    setPagerUnneeded(hide);
    if (hide) suppressThemePagers();
    else unhideThemePagers();
  }

  function removeFindlyNumberedPagers(widget) {
    if (widget && widget.hideFindlyPagerEl) widget.hideFindlyPagerEl();
    var nodes = document.querySelectorAll(
      "#findly-sf-pager, .sf-pager, .sf-pager--pagination, .sf-pager--load-more, .sf-pager--infinite",
    );
    var i;
    for (i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (!el) continue;
      el.hidden = true;
      el.setAttribute("hidden", "");
      el.innerHTML = "";
      el.style.setProperty("display", "none", "important");
      if (el.parentNode) el.parentNode.removeChild(el);
    }
    if (widget) widget._pagerEl = null;
  }

  function pageHref(page) {
    try {
      var url = new URL(window.location.href);
      url.searchParams.set("page", String(page));
      url.hash = "";
      return url.pathname + url.search;
    } catch (err) {
      return "?page=" + String(page);
    }
  }

  function controlOf(item) {
    if (!item) return null;
    if (item.matches && item.matches("a, button, span")) return item;
    return item.querySelector ? item.querySelector("a, button, span") : item;
  }

  function itemRole(item) {
    var ctrl = controlOf(item);
    if (!ctrl) return "unknown";
    var text = String(ctrl.textContent || "").replace(/\s+/g, " ").trim();
    var label = String(ctrl.getAttribute("aria-label") || "").toLowerCase();
    var rel = String(ctrl.getAttribute("rel") || "").toLowerCase();
    var href = String(ctrl.getAttribute("href") || "");
    var hrefMatch = href.match(/[?&]page=(\d+)/);
    var hrefPage = hrefMatch ? Number(hrefMatch[1]) : 0;
    var cls = String(
      (item && item.className) ||
        (ctrl && ctrl.className) ||
        "",
    ).toLowerCase();
    /* Dawn reuses pagination__item--prev on the rotated "Next" caret — prefer
       aria-label / rel over class names. */
    if (rel === "prev" || label.indexOf("previous") !== -1) return "prev";
    if (rel === "next" || (/\bnext\b/.test(label) && !/^\d+$/.test(text))) {
      return "next";
    }
    if (
      cls.indexOf("pagination__item--next") !== -1 ||
      cls.indexOf("pagination-next") !== -1
    ) {
      return "next";
    }
    if (
      cls.indexOf("pagination__item--prev") !== -1 ||
      cls.indexOf("pagination-prev") !== -1
    ) {
      return "prev";
    }
    if (text === "…" || text === "..." || text === "…") return "ellipsis";
    if (ctrl.getAttribute("aria-current") === "page") return "current";
    if (/^\d+$/.test(text)) return "page";
    if (hrefPage && !/^\d+$/.test(text)) {
      return hrefPage <= 1 ? "prev" : "next";
    }
    return "unknown";
  }

  function parseTemplates(html) {
    var box = document.createElement("div");
    box.innerHTML = html;
    var list = box.querySelector("ul, ol, .pagination__list, [role='list']");
    var parent = list || box;
    var items = [];
    var i;
    for (i = 0; i < parent.children.length; i++) {
      if (parent.children[i].nodeType === 1) items.push(parent.children[i]);
    }
    var tpls = {
      list: list,
      page: null,
      current: null,
      ellipsis: null,
      prev: null,
      next: null,
    };
    for (i = 0; i < items.length; i++) {
      var role = itemRole(items[i]);
      if (role === "prev" && !tpls.prev) tpls.prev = items[i].cloneNode(true);
      else if (role === "next" && !tpls.next) tpls.next = items[i].cloneNode(true);
      else if (role === "ellipsis" && !tpls.ellipsis) {
        tpls.ellipsis = items[i].cloneNode(true);
      } else if (role === "current" && !tpls.current) {
        tpls.current = items[i].cloneNode(true);
      } else if (role === "page" && !tpls.page) {
        tpls.page = items[i].cloneNode(true);
      }
    }
    if (!tpls.page) tpls.page = tpls.current;
    if (!tpls.current) tpls.current = tpls.page;
    if (!tpls.prev && tpls.next) {
      tpls.prev = tpls.next.cloneNode(true);
      swapArrowDir(tpls.prev);
    }
    if (!tpls.next && tpls.prev) {
      tpls.next = tpls.prev.cloneNode(true);
      swapArrowDir(tpls.next);
    }
    return tpls;
  }

  function swapArrowDir(item) {
    if (!item) return;
    var nodes = [item];
    if (item.querySelectorAll) {
      nodes = nodes.concat(Array.prototype.slice.call(item.querySelectorAll("*")));
    }
    var i;
    for (i = 0; i < nodes.length; i++) {
      var cls = String(nodes[i].className || "");
      if (!cls) continue;
      if (
        cls.indexOf("pagination__item--next") !== -1 &&
        cls.indexOf("pagination__item--prev") === -1
      ) {
        nodes[i].className = cls.replace(
          "pagination__item--next",
          "pagination__item--prev",
        );
      } else if (cls.indexOf("pagination__item--prev") !== -1) {
        nodes[i].className = cls.replace(
          "pagination__item--prev",
          "pagination__item--next",
        );
      }
    }
    var ctrl = controlOf(item);
    if (!ctrl) return;
    var label = String(ctrl.getAttribute("aria-label") || "");
    if (/next/i.test(label)) {
      ctrl.setAttribute("aria-label", label.replace(/next/gi, "Previous"));
    } else if (/prev/i.test(label)) {
      ctrl.setAttribute("aria-label", label.replace(/previous|prev/gi, "Next"));
    }
  }

  function ensurePagerLink(node, page) {
    if (!node || node.nodeType !== 1) return node;
    if (node.closest && node.closest("a, button") && node.tagName !== "A") {
      return node;
    }
    var tag = String(node.tagName || "").toUpperCase();
    if (tag === "A") {
      node.setAttribute("href", pageHref(page));
      return node;
    }
    if (tag === "BUTTON") {
      node.setAttribute("type", "button");
      node.setAttribute("data-sf-page", String(page));
      return node;
    }
    /* Dawn current-page controls are often <span> — upgrade clones so page
       numbers stay clickable after rewrite. */
    if (tag === "SPAN" || node.getAttribute("role") === "link") {
      var link = document.createElement("a");
      link.href = pageHref(page);
      link.className = node.className || "";
      var attrs = node.attributes;
      var a;
      for (a = 0; a < attrs.length; a++) {
        var name = attrs[a].name;
        if (
          name === "class" ||
          name === "aria-current" ||
          name === "aria-disabled"
        ) {
          continue;
        }
        link.setAttribute(name, attrs[a].value);
      }
      while (node.firstChild) link.appendChild(node.firstChild);
      if (node.parentNode) node.parentNode.replaceChild(link, node);
      return link;
    }
    return node;
  }

  function setItemPage(item, page, isCurrent) {
    if (!item) return;
    item.setAttribute("data-sf-page", String(page));
    var primary =
      (item.matches && item.matches("a, button, span, [role='link']")
        ? item
        : null) ||
      (item.querySelector &&
        item.querySelector("a, button, span[aria-current], [role='link'], span"));
    if (primary && !isCurrent) {
      primary = ensurePagerLink(primary, page) || primary;
    } else if (primary && primary.tagName === "A") {
      primary.setAttribute("href", pageHref(page));
    }
    var nodes = [item];
    if (item.querySelectorAll) {
      nodes = nodes.concat(
        Array.prototype.slice.call(item.querySelectorAll("a, button, span")),
      );
    }
    var i;
    for (i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      if (!node || !node.setAttribute) continue;
      node.setAttribute("data-sf-page", String(page));
      if (node.tagName === "A") node.setAttribute("href", pageHref(page));
      if (isCurrent) {
        node.setAttribute("aria-current", "page");
        if (node.getAttribute("role") === "link") {
          node.setAttribute("aria-disabled", "true");
        }
      } else {
        node.removeAttribute("aria-current");
        node.removeAttribute("aria-disabled");
      }
      var aria = node.getAttribute("aria-label");
      if (aria && /\d+/.test(aria)) {
        node.setAttribute("aria-label", aria.replace(/\d+/, String(page)));
      }
      var leaf =
        node.tagName === "A" ||
        node.tagName === "BUTTON" ||
        node.tagName === "SPAN";
      if (
        leaf &&
        !node.querySelector("a, button, svg, img") &&
        /^\d+$/.test(String(node.textContent || "").replace(/\s+/g, " ").trim())
      ) {
        node.textContent = String(page);
      }
    }
  }

  function pagerListEl(el) {
    if (!el || !el.querySelector) return el;
    return (
      el.querySelector(
        "ul, ol, .pagination__list, .pagination-list, [role='list']",
      ) ||
      el.querySelector(".pagination__inner") ||
      el
    );
  }

  function maxVisiblePageNumber(el) {
    if (!el || !el.querySelectorAll) return 0;
    var max = 0;
    var nodes = el.querySelectorAll("a, button, span");
    var i;
    for (i = 0; i < nodes.length; i++) {
      var cs = window.getComputedStyle
        ? window.getComputedStyle(nodes[i])
        : null;
      if (cs && (cs.display === "none" || cs.visibility === "hidden")) continue;
      var n = pageFromControl(nodes[i]);
      if (n > max) max = n;
    }
    return max;
  }

  function restoreLoadMoreFromSnapshot(el) {
    if (!el || !el.querySelector) return;
    if (el.querySelector(THEME_LOAD_MORE_SEL)) return;
    var orig = el.getAttribute(ORIG_ATTR);
    if (orig == null || !orig) return;
    var tmp = document.createElement("div");
    tmp.innerHTML = orig;
    var found = tmp.querySelectorAll(THEME_LOAD_MORE_SEL);
    var i;
    for (i = 0; i < found.length; i++) {
      el.appendChild(found[i]);
    }
  }

  function rewritePager(el, widget) {
    snapshotPager(el);
    var orig = el.getAttribute(ORIG_ATTR) || "";
    if (widget.ensurePageSize) widget.ensurePageSize();
    var size = widget.pageSize || 16;
    var total = filteredTotal(widget);
    if (total < 0) return;
    widget._pageTotal = total;
    var pageCount = Math.max(1, Math.ceil(total / size) || 1);
    var page = Math.max(1, widget.page || 1);
    if (pageCount <= 1) {
      suppressThemePagers();
      return;
    }
    el.setAttribute("data-sf-pager-driven", "1");
    unhidePager(el);
    var tpls = parseTemplates(orig);
    var list = pagerListEl(el);
    if (list && list === el && String(el.tagName || "").toLowerCase() === "nav") {
      var made = document.createElement("ul");
      made.className = "pagination__list";
      el.innerHTML = "";
      el.appendChild(made);
      list = made;
    }
    if (tpls.page && list) {
      list.innerHTML = "";
      var appendClone = function (tpl, target, current) {
        if (!tpl) return;
        var node = tpl.cloneNode(true);
        if (target) setItemPage(node, target, Boolean(current));
        list.appendChild(node);
      };
      if (page > 1) appendClone(tpls.prev, page - 1, false);
      pageWindow(page, pageCount).forEach(function (item) {
        if (item === "ellipsis") {
          if (tpls.ellipsis) list.appendChild(tpls.ellipsis.cloneNode(true));
          return;
        }
        appendClone(
          item === page ? tpls.current : tpls.page,
          item,
          item === page,
        );
      });
      if (page < pageCount) appendClone(tpls.next, page + 1, false);
    } else {
      clipThemePager(el, page, pageCount);
    }
    if (maxVisiblePageNumber(el) > pageCount) {
      forceSimplePager(el, widget, page, pageCount, tpls);
    }
    /* Numbered rewrite may wipe a Load More node nested in the same root. */
    restoreLoadMoreFromSnapshot(el);
    var grid = document.querySelector(
      "#product-grid, #ProductGrid, ul.product-grid, ol.product-grid, .product-grid, .sf-app-grid, [data-product-grid], .collection-grid",
    );
    if (grid && grid.setAttribute) {
      grid.setAttribute("data-last-page", String(pageCount));
    }
  }

  function forceSimplePager(el, widget, page, pageCount, tpls) {
    if (!el) return;
    unhidePager(el);
    el.setAttribute("data-sf-pager-driven", "1");
    var list = pagerListEl(el);
    if (!list) list = el;
    list.innerHTML = "";
    function appendTpl(tpl, target, current) {
      if (!tpl) return false;
      var node = tpl.cloneNode(true);
      if (target) setItemPage(node, target, Boolean(current));
      list.appendChild(node);
      return true;
    }
    function appendLink(label, target, current) {
      var item = document.createElement("li");
      var link = document.createElement("a");
      link.href = pageHref(target);
      link.textContent = String(label);
      link.setAttribute("data-sf-page", String(target));
      if (current) link.setAttribute("aria-current", "page");
      item.appendChild(link);
      list.appendChild(item);
    }
    if (page > 1 && !appendTpl(tpls && tpls.prev, page - 1, false)) {
      appendLink("<", page - 1, false);
    }
    pageWindow(page, pageCount).forEach(function (item) {
      if (item === "ellipsis") {
        if (tpls && tpls.ellipsis) {
          list.appendChild(tpls.ellipsis.cloneNode(true));
          return;
        }
        var dots = document.createElement("li");
        dots.textContent = "…";
        list.appendChild(dots);
        return;
      }
      if (
        !appendTpl(
          tpls && (item === page ? tpls.current : tpls.page),
          item,
          item === page,
        )
      ) {
        appendLink(item, item, item === page);
      }
    });
    if (page < pageCount && !appendTpl(tpls && tpls.next, page + 1, false)) {
      appendLink(">", page + 1, false);
    }
  }

  function clipThemePager(el, page, pageCount) {
    var items = el.querySelectorAll("li, a, button, span");
    var i;
    for (i = 0; i < items.length; i++) {
      var item = items[i];
      var role = itemRole(item);
      var n = pageFromControl(controlOf(item) || item);
      if (role === "prev") {
        if (page <= 1) item.style.setProperty("display", "none", "important");
        else item.style.removeProperty("display");
      } else if (role === "next") {
        if (page >= pageCount) item.style.setProperty("display", "none", "important");
        else item.style.removeProperty("display");
      } else if (n) {
        if (n > pageCount) item.style.setProperty("display", "none", "important");
        else item.style.removeProperty("display");
      } else if (role === "ellipsis") {
        item.style.setProperty("display", "none", "important");
      }
    }
  }

  function pageFromControl(el) {
    if (!el) return 0;
    var marked = el.getAttribute("data-sf-page");
    if (marked && /^\d+$/.test(marked)) return Number(marked);
    var href = String(el.getAttribute("href") || "");
    var match = href.match(/[?&]page=(\d+)/);
    if (match) return Math.max(1, Number(match[1]) || 0);
    var text = String(el.textContent || "").replace(/\s+/g, " ").trim();
    if (/^\d+$/.test(text)) return Number(text);
    return 0;
  }

  /**
   * Page changes keep the existing listing scroll (instant jump, then smooth
   * correction after paint). Filter, sort, and clear use a separate hold:
   * while product cards are hidden the listing height is pinned and scroll
   * anchoring is paused, then the same listing target is applied once.
   * The hold is removed when the new grid is painted.
   */
  var _listingScrollTimer = 0;
  var _listingScrollRaf = 0;

  function stickyHeaderOffset() {
    var sel =
      "sticky-header, .section-header.shopify-section-header-sticky," +
      " .shopify-section-header-sticky, #shopify-section-header," +
      " header.header, .header-wrapper, [data-sticky-header]";
    var nodes = document.querySelectorAll(sel);
    var max = 0;
    var i;
    for (i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (!el || !el.getBoundingClientRect) continue;
      try {
        var cs = window.getComputedStyle(el);
        var pos = cs.position || "";
        if (pos !== "sticky" && pos !== "fixed") continue;
        var h = el.getBoundingClientRect().height || 0;
        if (h > max) max = h;
      } catch (err) {
        /* ignore */
      }
    }
    return Math.min(160, Math.max(0, Math.round(max)));
  }

  function prefersReducedMotion() {
    try {
      return (
        typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
      );
    } catch (err) {
      return false;
    }
  }

  function listingScrollTarget(widget) {
    var candidates = [
      document.querySelector(".sf-toolbar"),
      document.querySelector(".sf-collection-layout .sf-layout-main"),
      widget && widget._themeGridShell,
      document.querySelector(
        "#ProductGridContainer, [data-findly-grid-shell='1'], .product-grid-container",
      ),
      document.querySelector(
        ".sf-collection-layout #product-grid, .sf-layout-main #product-grid",
      ),
      document.querySelector(".sf-collection-layout"),
    ];
    var i;
    for (i = 0; i < candidates.length; i++) {
      var el = candidates[i];
      if (!el || !el.getBoundingClientRect) continue;
      try {
        if ((el.getBoundingClientRect().width || 0) < 1) continue;
      } catch (err) {
        continue;
      }
      return el;
    }
    return null;
  }

  function listingLockHost(widget) {
    return (
      document.querySelector(".sf-collection-layout") ||
      document.querySelector(".sf-layout-main") ||
      (widget && (widget._themeGridShell || widget._gridParent)) ||
      document.querySelector(
        "#ProductGridContainer, #product-grid, .product-grid-container, .main-collection-grid",
      )
    );
  }

  function lockListingHeight(widget) {
    if (!widget || widget._sfScrollLockHost) return;
    var host = listingLockHost(widget);
    if (!host || !host.style) return;
    var h = 0;
    try {
      h = host.offsetHeight || 0;
    } catch (err) {
      h = 0;
    }
    if (h < 120) return;
    widget._sfScrollLockHost = host;
    widget._sfScrollLockMin = host.style.minHeight || "";
    host.style.minHeight = h + "px";
  }

  function unlockListingHeight(widget) {
    if (!widget || !widget._sfScrollLockHost) return;
    var host = widget._sfScrollLockHost;
    var prev = widget._sfScrollLockMin || "";
    widget._sfScrollLockHost = null;
    widget._sfScrollLockMin = "";
    try {
      host.style.minHeight = prev;
    } catch (err) {
      /* ignore */
    }
  }

  function setAnchorSuppressed(on) {
    var root = document.documentElement;
    if (!root || !root.style) return;
    if (on) {
      if (root.hasAttribute("data-sf-anchor-off")) return;
      root.setAttribute("data-sf-anchor-off", root.style.overflowAnchor || "");
      root.style.overflowAnchor = "none";
      return;
    }
    if (!root.hasAttribute("data-sf-anchor-off")) return;
    root.style.overflowAnchor = root.getAttribute("data-sf-anchor-off") || "";
    root.removeAttribute("data-sf-anchor-off");
  }

  function scrollRootFor(el) {
    var node = el && el.parentElement;
    while (node && node !== document.body && node !== document.documentElement) {
      try {
        var cs = window.getComputedStyle(node);
        var oy = cs.overflowY || cs.overflow || "";
        if (
          (oy === "auto" || oy === "scroll" || oy === "overlay") &&
          node.scrollHeight > node.clientHeight + 1
        ) {
          return node;
        }
      } catch (err) {
        /* ignore */
      }
      node = node.parentElement;
    }
    return (
      document.scrollingElement ||
      document.documentElement ||
      document.body
    );
  }

  function readScrollTop(root) {
    if (!root) return 0;
    if (root === document.documentElement || root === document.body || root === document.scrollingElement) {
      return (
        window.pageYOffset ||
        document.documentElement.scrollTop ||
        document.body.scrollTop ||
        0
      );
    }
    return root.scrollTop || 0;
  }

  function writeScrollTop(root, top, behavior) {
    top = Math.max(0, Math.round(top));
    var isWindow =
      !root ||
      root === document.documentElement ||
      root === document.body ||
      root === document.scrollingElement;
    try {
      if (isWindow && typeof window.scrollTo === "function") {
        window.scrollTo({ top: top, left: 0, behavior: behavior || "auto" });
        return;
      }
    } catch (err) {
      try {
        window.scrollTo(0, top);
        return;
      } catch (err2) {
        /* fall through */
      }
    }
    if (!isWindow && root) {
      try {
        if (typeof root.scrollTo === "function") {
          root.scrollTo({ top: top, left: 0, behavior: behavior || "auto" });
        } else {
          root.scrollTop = top;
        }
        return;
      } catch (err3) {
        try {
          root.scrollTop = top;
        } catch (err4) {
          /* ignore */
        }
      }
    }
    try {
      document.documentElement.scrollTop = top;
      document.body.scrollTop = top;
    } catch (err5) {
      /* ignore */
    }
  }

  function listingScrollTop(widget) {
    var target = listingScrollTarget(widget);
    var root = scrollRootFor(target);
    if (!target) return { root: root, top: 0 };
    var top = 0;
    try {
      var rect = target.getBoundingClientRect();
      if (
        root === document.documentElement ||
        root === document.body ||
        root === document.scrollingElement
      ) {
        top =
          readScrollTop(root) + rect.top - stickyHeaderOffset() - 12;
      } else {
        var rootRect = root.getBoundingClientRect();
        top =
          readScrollTop(root) + (rect.top - rootRect.top) - 12;
      }
    } catch (err) {
      top = 0;
    }
    return { root: root, top: Math.max(0, Math.round(top)) };
  }

  function cancelListingScroll() {
    if (_listingScrollTimer) {
      try {
        clearTimeout(_listingScrollTimer);
      } catch (err) {
        /* ignore */
      }
      _listingScrollTimer = 0;
    }
    if (_listingScrollRaf) {
      try {
        cancelAnimationFrame(_listingScrollRaf);
      } catch (err2) {
        /* ignore */
      }
      _listingScrollRaf = 0;
    }
  }

  function scrollListingIntoView(widget, opts) {
    opts = opts || {};
    var mode = opts.mode || "auto";
    var dest = listingScrollTop(widget);
    var current = readScrollTop(dest.root);
    if (Math.abs(current - dest.top) < 4) return;
    var behavior =
      mode === "smooth" && !prefersReducedMotion() ? "smooth" : "auto";
    /* Interrupt any in-flight smooth scroll, then apply the chosen behavior. */
    if (behavior === "smooth") {
      writeScrollTop(dest.root, current, "auto");
    }
    writeScrollTop(dest.root, dest.top, behavior);
  }

  function scheduleListingScroll(widget, opts) {
    opts = opts || {};
    cancelListingScroll();
    var run = function () {
      _listingScrollRaf = 0;
      _listingScrollTimer = 0;
      try {
        scrollListingIntoView(widget, opts);
      } catch (err) {
        /* ignore */
      }
      /* Images / theme layout can shift height; one correction after settle. */
      if (opts.correct !== false) {
        _listingScrollTimer = setTimeout(function () {
          _listingScrollTimer = 0;
          try {
            scrollListingIntoView(widget, { mode: "auto" });
          } catch (err2) {
            /* ignore */
          }
        }, 120);
      }
    };
    if (typeof requestAnimationFrame === "function") {
      _listingScrollRaf = requestAnimationFrame(function () {
        _listingScrollRaf = requestAnimationFrame(run);
      });
    } else {
      _listingScrollTimer = setTimeout(run, 32);
    }
  }

  function markListingScroll(widget) {
    if (!widget) return;
    widget._sfNeedsListingScroll = true;
    /*
     * Jump immediately so the viewport is not stuck on the old pager while
     * the grid rebuilds. (Smooth scroll here is cancelled by height collapse.)
     */
    try {
      scrollListingIntoView(widget, { mode: "auto" });
    } catch (err) {
      /* ignore */
    }
  }

  function flushListingScroll(widget) {
    if (!widget || !widget._sfNeedsListingScroll) return;
    widget._sfNeedsListingScroll = false;
    /*
     * After paint: re-measure and scroll again. Use smooth only when still far
     * from the target; otherwise auto-correct residual layout shift.
     */
    var dest = listingScrollTop(widget);
    var current = readScrollTop(dest.root);
    var distance = Math.abs(current - dest.top);
    scheduleListingScroll(widget, {
      mode:
        distance > 80 && !prefersReducedMotion() ? "smooth" : "auto",
      correct: true,
    });
  }

  function listingNeedsScroll(widget) {
    var dest = listingScrollTop(widget);
    var current = readScrollTop(dest.root);
    return current > dest.top + 48;
  }

  function releaseFilterScrollHold(widget) {
    if (!widget || !widget._sfFilterScrollHold) return;
    widget._sfFilterScrollHold = false;
    try {
      if (widget._sfFilterScrollTimer) {
        clearTimeout(widget._sfFilterScrollTimer);
        widget._sfFilterScrollTimer = 0;
      }
    } catch (err) {
      /* ignore */
    }
    try {
      scrollListingIntoView(widget, { mode: "auto" });
    } catch (err2) {
      /* ignore */
    }
    unlockListingHeight(widget);
    setAnchorSuppressed(false);
  }

  function scheduleFilterScrollRelease(widget) {
    if (!widget) return;
    try {
      if (widget._sfFilterScrollTimer) clearTimeout(widget._sfFilterScrollTimer);
    } catch (err) {
      /* ignore */
    }
    widget._sfFilterScrollTries = 0;
    var tick = function () {
      widget._sfFilterScrollTimer = 0;
      if (!widget._sfFilterScrollHold) return;
      if (widget._loadingPage || widget._inflight || widget._importingCards) {
        widget._sfFilterScrollTries = (widget._sfFilterScrollTries || 0) + 1;
        if (widget._sfFilterScrollTries < 20) {
          widget._sfFilterScrollTimer = setTimeout(tick, 400);
          return;
        }
      }
      releaseFilterScrollHold(widget);
    };
    widget._sfFilterScrollTimer = setTimeout(tick, 400);
  }

  /* Filter applies only. Page changes keep markListingScroll / flushListingScroll. */
  function armFilterScroll(widget) {
    if (!widget || !listingNeedsScroll(widget)) return;
    widget._sfFilterScrollHold = true;
    setAnchorSuppressed(true);
    lockListingHeight(widget);
    try {
      scrollListingIntoView(widget, { mode: "auto" });
    } catch (err) {
      /* ignore */
    }
    scheduleFilterScrollRelease(widget);
  }

  function bindThemePagerClicks() {
    if (window.__findlyThemePagerBound) return;
    window.__findlyThemePagerBound = true;
    document.addEventListener(
      "click",
      function (event) {
        var widget = window.__FINDLY_FILTER_WIDGET;
        if (!widget || !usesThemeNumberedPager()) return;
        var target = event.target;
        if (!target || !target.closest) return;
        if (target.closest(".sf-pager, .smart-filter")) return;
        /* Load More is handled by bindThemeLoadMoreClicks — do not treat
           those controls as numbered page links. */
        if (target.closest(THEME_LOAD_MORE_SEL)) return;
        var root = target.closest(THEME_PAGER_SEL);
        if (!root || isFindlyPager(root)) return;
        if (root.closest && root.closest(PAGER_CHROME_SKIP)) return;
        var ctrl =
          target.closest("a, button, [data-sf-page], [role='link']") ||
          target.closest("li");
        if (!ctrl || (root !== ctrl && !root.contains(ctrl))) return;
        var page = pageFromControl(ctrl);
        if (!page) {
          var role = itemRole(ctrl.closest("li") || ctrl);
          var current = Math.max(1, Number(widget.page) || 1);
          if (role === "prev") page = current - 1;
          else if (role === "next") page = current + 1;
          else if (role === "current") page = current;
        }
        if (!page || page < 1) return;
        event.preventDefault();
        event.stopPropagation();
        if (typeof event.stopImmediatePropagation === "function") {
          event.stopImmediatePropagation();
        }
        if (widget.goToPage) widget.goToPage(page);
      },
      true,
    );
  }

  function bindThemeLoadMoreClicks() {
    if (window.__findlyThemeLoadMoreBound) return;
    window.__findlyThemeLoadMoreBound = true;
    ensureLoadMoreCss();
    document.addEventListener(
      "click",
      function (event) {
        var widget = window.__FINDLY_FILTER_WIDGET;
        if (!widget || !usesThemeNumberedPager()) return;
        /* Unfiltered browse: leave theme Load More to the theme. */
        if (!shouldDriveThemePager(widget)) return;
        var target = event.target;
        if (!target || !target.closest) return;
        if (target.closest(".sf-pager, .smart-filter")) return;
        var btn = target.closest(THEME_LOAD_MORE_SEL);
        if (!btn || isFindlyPager(btn)) return;
        if (btn.closest && btn.closest(PAGER_CHROME_SKIP)) return;
        if (resultsFitOnePage(widget) && !payloadHasNext(widget)) return;
        var current = Math.max(1, Number(widget.page) || 1);
        var next = current + 1;
        event.preventDefault();
        event.stopPropagation();
        if (typeof event.stopImmediatePropagation === "function") {
          event.stopImmediatePropagation();
        }
        if (widget.goToPage) widget.goToPage(next);
      },
      true,
    );
  }

  function patchWidget(widget) {
    if (!widget) return;
    var proto = Object.getPrototypeOf(widget);
    if (!proto || proto.__findlyPagerPatched) return;
    proto.__findlyPagerPatched = true;

    proto.disconnectInfinite = function () {
      disconnectWidgetInfinite(this);
    };

    proto.hideFindlyPagerEl = function () {
      var el = this._pagerEl || document.getElementById("findly-sf-pager");
      if (!el) return;
      el.hidden = true;
      el.setAttribute("hidden", "");
      el.innerHTML = "";
      el.style.setProperty("display", "none", "important");
      if (el.parentNode) el.parentNode.removeChild(el);
      if (this._pagerEl === el) this._pagerEl = null;
    };

    proto.applyPagerByProductCount = function (count) {
      applyPagerByProductCount(this, count);
    };

    function seedPageFromUrl(widget) {
      if (!widget || widget._sfPageSeeded) return;
      widget._sfPageSeeded = true;
      try {
        var url = new URL(window.location.href);
        var p = Math.max(1, Number(url.searchParams.get("page") || "1") || 1);
        if (p > 1) {
          widget.page = p;
          widget._sfPaged = true;
        }
      } catch (err) {
        /* ignore */
      }
    }

    function writePageToUrl(widget) {
      try {
        var url = new URL(window.location.href);
        var page = Math.max(1, Number(widget && widget.page) || 1);
        var cur = url.searchParams.get("page");
        if (page <= 1) {
          if (!cur) return;
          url.searchParams.delete("page");
        } else if (String(cur || "") === String(page)) {
          return;
        } else {
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

    var origFetchFilters = proto.fetchFilters;
    if (origFetchFilters) {
      proto.fetchFilters = function (opts) {
        opts = opts || {};
        var userFilter = !opts.append && opts.page == null;
        /*
         * Theme infinite scroll often writes ?page=N into the URL. If we
         * seed that into widget.page before a new filter apply, Findly
         * requests filtered page N instead of page 1 and the grid looks
         * "short" while theme cards from other pages stay painted.
         */
        if (userFilter) {
          this.page = 1;
          this._sfAccumHandles = [];
          this._sfPageSeeded = true;
          clearThemePageFromUrl();
          if (this._sfScrollReady) armFilterScroll(this);
          this._sfScrollReady = true;
        } else {
          seedPageFromUrl(this);
          if (
            !opts.append &&
            opts.page == null &&
            Math.max(1, Number(this.page) || 1) > 1
          ) {
            opts = Object.assign({}, opts, { page: this.page });
          }
        }
        var self = this;
        var wasAppend = Boolean(opts.append);
        var req = origFetchFilters.call(this, opts);
        if (req && typeof req.then === "function") {
          return req.then(
            function (value) {
              updateAccumHandles(self, wasAppend);
              enforceFilteredGrid(self);
              return value;
            },
            function (err) {
              throw err;
            },
          );
        }
        updateAccumHandles(this, wasAppend);
        enforceFilteredGrid(this);
        return req;
      };
    }

    var origReadPagingMeta = proto.readPagingMeta;
    if (origReadPagingMeta) {
      proto.readPagingMeta = function (data, handles) {
        origReadPagingMeta.call(this, data, handles);
        var t = Number(data && data.total);
        if (Number.isFinite(t) && t >= 0) {
          this._pageTotal = t;
          this._statusProductCount = t;
          return;
        }
        /* Prefer hasNext over page-sliced handle counts for pager visibility. */
        if (data && (data.hasNext === true || data.has_next === true)) {
          var size = Math.max(1, Number(this.pageSize) || 16);
          var page = Math.max(
            1,
            Number(data.page != null ? data.page : this.page) || 1,
          );
          var minTotal = page * size + 1;
          if (!(Number(this._pageTotal) >= minTotal)) {
            this._pageTotal = minTotal;
            this._statusProductCount = minTotal;
          }
        }
      };
    }

    var origGoToPage = proto.goToPage;
    proto.goToPage = function (page) {
      var next = Math.max(1, Math.floor(Number(page) || 1));
      var current = Math.max(1, Number(this.page) || 1);
      var self = this;
      this._sfPaged = true;
      if (next !== current || this._inflight || this._loadingPage) {
        this._loadingPage = false;
        if (next > 1) {
          this._keepThemeCards = false;
          this._sfNativeListing = false;
          this._sfPaintedReq = -1;
        } else {
          delete this._keepThemeCards;
        }
      }
      if (next !== current) {
        markListingScroll(this);
        /* Fallback if setGridBusy(false) never fires (cached / skipped busy). */
        try {
          if (this._sfScrollFallbackTimer) {
            clearTimeout(this._sfScrollFallbackTimer);
          }
        } catch (clearErr) {
          /* ignore */
        }
        this._sfScrollFallbackTimer = setTimeout(function () {
          self._sfScrollFallbackTimer = 0;
          if (self._sfNeedsListingScroll) flushListingScroll(self);
        }, 450);
      }
      var result = origGoToPage ? origGoToPage.call(this, next) : undefined;
      /* Sync ?page= after core updates widget.page (do not mutate before). */
      writePageToUrl(this);
      return result;
    };

    var origSetGridBusy = proto.setGridBusy;
    proto.setGridBusy = function (busy) {
      var parent = this._gridParent || this.ensureGridParent && this.ensureGridParent();
      var wasBusy =
        parent && parent.classList && parent.classList.contains("sf-grid-busy");
      if (origSetGridBusy) origSetGridBusy.apply(this, arguments);
      /* After new page paints, smooth-scroll onto a stable layout. */
      if (wasBusy && !busy && this._sfNeedsListingScroll) {
        try {
          if (this._sfScrollFallbackTimer) {
            clearTimeout(this._sfScrollFallbackTimer);
            this._sfScrollFallbackTimer = 0;
          }
        } catch (clearErr) {
          /* ignore */
        }
        flushListingScroll(this);
      }
    };

    proto._sfFlushListingScroll = function () {
      releaseFilterScrollHold(this);
    };

    proto.syncThemePager = function () {
      if (this.ensurePageSize) this.ensurePageSize();
      var total = filteredTotal(this);
      var size = this.pageSize || 16;
      var drive = shouldDriveThemePager(this);
      clearCustomPagerClass();
      removeFindlyNumberedPagers(this);
      ensureLoadMoreCss();
      bindThemeLoadMoreClicks();
      installThemePageFetchGuard();

      // Unfiltered browse: leave theme pager / infinite chrome as-is, but
      // still bind numbered clicks so page changes AJAX the grid.
      if (!drive) {
        setPagerUnneeded(false);
        unhideThemePagers();
        restoreThemeInfiniteAll(this);
        var idleRoots = findThemePagers();
        var r;
        for (r = 0; r < idleRoots.length; r++) restorePager(idleRoots[r]);
        bindThemePagerClicks();
        return true;
      }

      if (total >= 0) applyPagerByProductCount(this, total);
      if (window.__findlyThemePagerSyncing) {
        window.__findlyThemePagerDirty = true;
        return true;
      }
      window.__findlyThemePagerSyncing = true;
      window.__findlyThemePagerDirty = false;
      window.__findlyThemePagerIgnoreMutations = true;
      try {
        observeThemePager();
        if (total < 0) {
          scheduleThemePagerSync(this);
          return true;
        }
        // Few filtered results (≤ one page): hide theme pager / infinite.
        // hasNext / total>pageSize keep search pagination like collection.
        if (resultsFitOnePage(this) || (total <= size && !payloadHasNext(this))) {
          syncThemeLoadMore(false);
          syncThemeInfinite(this, false);
          enforceFilteredGrid(this);
          return true;
        }
        unhideThemePagers();
        syncThemeLoadMore(true);
        syncThemeInfinite(this, true);
        var roots = findThemePagers();
        if (!roots.length) {
          /* No numbered chrome — Load More / infinite hosts are enough. */
          bindThemePagerClicks();
          this._themePagerTries = 0;
          if (!findThemeLoadMore().length && !findThemeInfiniteHosts().length) {
            scheduleThemePagerSync(this);
          }
          enforceFilteredGrid(this);
          return true;
        }
        bindThemePagerClicks();
        this._themePagerTries = 0;
        var i;
        for (i = 0; i < roots.length; i++) {
          snapshotPager(roots[i]);
          rewritePager(roots[i], this);
        }
        /* rewritePager may touch wrapper innerHTML; re-assert Load More /
           infinite only when more pages remain. */
        if (
          !(
            resultsFitOnePage(this) ||
            (total <= size && !payloadHasNext(this))
          )
        ) {
          syncThemeLoadMore(true);
          syncThemeInfinite(this, true);
        } else {
          syncThemeInfinite(this, false);
        }
        enforceFilteredGrid(this);
        return true;
      } finally {
        var self = this;
        window.setTimeout(function () {
          window.__findlyThemePagerIgnoreMutations = false;
          window.__findlyThemePagerSyncing = false;
          if (!window.__findlyThemePagerDirty) return;
          window.__findlyThemePagerDirty = false;
          if (self.syncThemePager) self.syncThemePager();
        }, 40);
      }
    };

    proto.setThemePagerHidden = function () {
      this.syncThemePager();
      removeFindlyNumberedPagers(this);
    };

    var origRestore = proto.restoreThemePaging;
    proto.restoreThemePaging = function () {
      if (origRestore) origRestore.call(this);
      this.syncThemePager();
      removeFindlyNumberedPagers(this);
    };

    proto.renderPager = function () {
      clearCustomPagerClass();
      this.disconnectInfinite();
      this.syncThemePager();
    };

    bindThemePagerClicks();
  }

  function scheduleThemePagerSync(widget) {
    if (!widget) return;
    widget._themePagerTries = (widget._themePagerTries || 0) + 1;
    if (widget._themePagerTries > 12) return;
    if (widget._themePagerRetry) return;
    widget._themePagerRetry = window.setTimeout(function () {
      widget._themePagerRetry = 0;
      if (widget.syncThemePager) widget.syncThemePager();
    }, 60);
  }

  function observeThemePager() {
    if (window.__findlyThemePagerObs || typeof MutationObserver !== "function") {
      return;
    }
    window.__findlyThemePagerObs = new MutationObserver(function () {
      if (window.__findlyThemePagerIgnoreMutations) return;
      var w = window.__FINDLY_FILTER_WIDGET;
      if (!w || !usesThemeNumberedPager() || !w.syncThemePager) return;
      if (window.__findlyThemePagerSyncing) {
        window.__findlyThemePagerDirty = true;
        return;
      }
      if (window.__findlyThemePagerObsTimer) return;
      window.__findlyThemePagerObsTimer = window.setTimeout(function () {
        window.__findlyThemePagerObsTimer = 0;
        if (window.__findlyThemePagerIgnoreMutations) return;
        var next = window.__FINDLY_FILTER_WIDGET;
        if (!next || !usesThemeNumberedPager() || !next.syncThemePager) {
          return;
        }
        next.syncThemePager();
      }, 40);
    });
    window.__findlyThemePagerObs.observe(document.documentElement, {
      childList: true,
      subtree: true,
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
    if (held) {
      patchWidget(held);
      if (held.renderPager) held.renderPager();
    }
  }

  /* Arm before widget boot so theme infinite ?page= fetches cannot race. */
  installThemePageFetchGuard();
  installSetter();
})();
