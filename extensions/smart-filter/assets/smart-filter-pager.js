/**
 * Collection pager — theme numbered pagination only.
 * Loaded from Liquid via asset_url so it does not count against the 100 KB
 * schema "javascript" cap on smart-filter.min.js.
 *
 * Patches Widget.prototype as soon as window.__FINDLY_FILTER_WIDGET is set.
 * Findly never mounts load-more / infinite chrome; filtered views sync the
 * theme pager via syncThemePager + bindThemePagerClicks → goToPage.
 * Unfiltered pager clicks are also AJAX (grid only) so the filter panel
 * stays painted instead of a full collection reload.
 */
(function () {
  "use strict";

  var THEME_PAGER_SEL =
    "nav.pagination, .pagination-wrapper, .pagination, [data-pagination], .paginate, #pagination, .Pagination, #AjaxinatePagination, .ajaxinate-pagination";
  var PAGER_CHROME_SKIP =
    "header, footer, .header, .footer, .announcement-bar, .predictive-search, .quick-add-modal, product-recommendations, .shopify-section-group-header-group, .shopify-section-group-footer-group";
  var ORIG_ATTR = "data-sf-theme-orig";
  var SUPPRESS_ATTR = "data-sf-pager-suppressed";

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

  function filteredTotal(widget) {
    var data = widget && widget._lastFilterData;
    var latest = [];
    if (data) {
      var fromTotal = Number(data.total);
      if (Number.isFinite(fromTotal) && fromTotal >= 0) latest.push(fromTotal);
      var fromCount = Number(data.count);
      if (Number.isFinite(fromCount) && fromCount >= 0) latest.push(fromCount);
      if (Array.isArray(data.handles) && data.handles.length) {
        latest.push(data.handles.length);
      }
    }
    // Latest filter payload wins. Mixing it with leftover
    // _statusProductCount / _pageTotal from the previous unfiltered view
    // kept theme pagination visible on the first filter apply.
    if (latest.length) return Math.max.apply(null, latest);
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
    if (widget.ensurePageSize) widget.ensurePageSize();
    var size = widget.pageSize || 16;
    var total = filteredTotal(widget);
    if (total < 0) return false;
    return total <= size;
  }

  function suppressThemePagers() {
    var roots = findThemePagers();
    var i;
    for (i = 0; i < roots.length; i++) suppressPager(roots[i]);
  }

  function unhideThemePagers() {
    var roots = findThemePagers();
    var i;
    for (i = 0; i < roots.length; i++) unhidePager(roots[i]);
  }

  function applyPagerByProductCount(widget, count) {
    if (widget && widget.ensurePageSize) widget.ensurePageSize();
    var size = (widget && widget.pageSize) || 16;
    var n = Number(count);
    if (!Number.isFinite(n) || n < 0) return;
    var hide = n <= size;
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
    if (rel === "prev" || label.indexOf("previous") !== -1) return "prev";
    if (rel === "next" || (/\bnext\b/.test(label) && !/^\d+$/.test(text))) {
      return "next";
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

  function setItemPage(item, page, isCurrent) {
    if (!item) return;
    item.setAttribute("data-sf-page", String(page));
    var nodes = [item];
    if (item.querySelectorAll) {
      nodes = nodes.concat(
        Array.prototype.slice.call(item.querySelectorAll("a, button, span")),
      );
    }
    var i;
    for (i = 0; i < nodes.length; i++) {
      var node = nodes[i];
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
        var root = target.closest(THEME_PAGER_SEL);
        if (!root || isFindlyPager(root)) return;
        if (root.closest && root.closest(PAGER_CHROME_SKIP)) return;
        var ctrl = target.closest("a, button");
        if (!ctrl) return;
        var page = pageFromControl(ctrl);
        if (!page) {
          var role = itemRole(ctrl.closest("li") || ctrl);
          var current = Math.max(1, widget.page || 1);
          if (role === "prev") page = current - 1;
          else if (role === "next") page = current + 1;
        }
        if (!page || page < 1) return;
        event.preventDefault();
        event.stopPropagation();
        if (widget.goToPage) widget.goToPage(page);
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
      if (this._infiniteObserver) {
        this._infiniteObserver.disconnect();
        this._infiniteObserver = null;
      }
      if (this._infiniteOnScroll) {
        window.removeEventListener("scroll", this._infiniteOnScroll);
        window.removeEventListener("resize", this._infiniteOnScroll);
        this._infiniteOnScroll = null;
      }
    };

    proto.bindInfinite = function () {
      this.disconnectInfinite();
    };

    proto.placePagerEl = function (el) {
      if (!el) return el;
      el.classList.add("sf-pager");
      el.removeAttribute("data-smart-filter-hidden");
      el.removeAttribute("data-findly-theme-hidden");
      if (this.root) {
        try {
          var cs = window.getComputedStyle(this.root);
          var accent = (cs.getPropertyValue("--sf-accent") || "").trim();
          var focus = (cs.getPropertyValue("--sf-focus") || "").trim();
          if (accent) el.style.setProperty("--sf-accent", accent);
          if (focus) el.style.setProperty("--sf-focus", focus);
        } catch (err) {
          /* ignore */
        }
      }
      var main = document.querySelector(
        ".sf-collection-layout > .sf-layout-main",
      ) || document.querySelector(".sf-layout-main");
      if (
        main &&
        main.classList &&
        (main.classList.contains("collection-wrapper") ||
          main.classList.contains("main-collection-grid") ||
          main.classList.contains("product-grid") ||
          main.classList.contains("product-grid-container"))
      ) {
        main = main.parentElement;
      }
      var grid = this._gridParent;
      var parent = main || null;
      var after = null;
      if (main && grid && main.contains(grid)) after = grid;
      if (!parent) {
        var layout = document.querySelector(".sf-collection-layout");
        if (layout && layout.parentNode) {
          parent = layout.parentNode;
          after = layout;
        } else if (grid && grid.parentNode) {
          parent = grid.parentNode;
          after = grid;
        }
      }
      if (parent) {
        if (after && after.parentNode === parent) {
          if (after.nextSibling !== el) parent.insertBefore(el, after.nextSibling);
        } else if (el.parentNode !== parent) {
          parent.appendChild(el);
        }
        return el;
      }
      if (!el.parentNode && this.root && this.root.parentNode) {
        this.root.parentNode.appendChild(el);
      } else if (!el.parentNode) {
        document.body.appendChild(el);
      }
      return el;
    };

    proto.renderLoadMore = function () {};

    proto.renderNumberedPager = function (el) {
      var size = this.pageSize || 16;
      var total = this._pageTotal || 0;
      var pageCount = Math.max(1, Math.ceil(total / size) || 1);
      var page = Math.max(1, this.page || 1);
      el.innerHTML = "";
      if (pageCount <= 1) {
        el.hidden = true;
        return;
      }
      el.hidden = false;
      el.removeAttribute("hidden");
      el.style.removeProperty("display");
      var list = document.createElement("div");
      list.className = "sf-pager-nav";

      var prev = document.createElement("button");
      prev.type = "button";
      prev.className = "sf-pager-btn sf-pager-btn-prev";
      prev.textContent = this.t("previous", "Previous");
      prev.setAttribute("aria-label", this.t("previous", "Previous"));
      prev.disabled = page <= 1 || this._loadingPage;
      prev.addEventListener(
        "click",
        function () {
          this.goToPage(page - 1);
        }.bind(this),
      );
      list.appendChild(prev);

      var pages = document.createElement("div");
      pages.className = "sf-pager-pages";
      pageWindow(page, pageCount).forEach(
        function (item) {
          if (item === "ellipsis") {
            var dots = document.createElement("span");
            dots.className = "sf-pager-ellipsis";
            dots.textContent = "…";
            pages.appendChild(dots);
            return;
          }
          var btn = document.createElement("button");
          btn.type = "button";
          btn.className =
            "sf-pager-page" + (item === page ? " is-current" : "");
          btn.textContent = String(item);
          btn.setAttribute("aria-label", this.t("page", "Page") + " " + item);
          if (item === page) btn.setAttribute("aria-current", "page");
          btn.disabled = this._loadingPage;
          btn.addEventListener(
            "click",
            function () {
              this.goToPage(item);
            }.bind(this),
          );
          pages.appendChild(btn);
        }.bind(this),
      );
      list.appendChild(pages);

      var next = document.createElement("button");
      next.type = "button";
      next.className = "sf-pager-btn sf-pager-btn-next";
      next.textContent = this.t("next", "Next");
      next.setAttribute("aria-label", this.t("next", "Next"));
      next.disabled = page >= pageCount || this._loadingPage;
      next.addEventListener(
        "click",
        function () {
          this.goToPage(page + 1);
        }.bind(this),
      );
      list.appendChild(next);
      el.appendChild(list);
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

    var origGoToPage = proto.goToPage;
    proto.goToPage = function (page) {
      var next = Math.max(1, Math.floor(Number(page) || 1));
      if (next !== this.page) {
        this._loadingPage = false;
        this._keepThemeCards = false;
      } else if (this._loadingPage && !this._inflight) {
        this._loadingPage = false;
      }
      if (origGoToPage) return origGoToPage.apply(this, arguments);
    };

    proto.usesThemeNumberedPager = function () {
      return usesThemeNumberedPager();
    };

    proto.syncThemePager = function () {
      if (this.ensurePageSize) this.ensurePageSize();
      var total = filteredTotal(this);
      var size = this.pageSize || 16;
      var drive = shouldDriveThemePager(this);
      clearCustomPagerClass();
      removeFindlyNumberedPagers(this);

      // Unfiltered browse: leave theme pager chrome as-is, but still bind
      // clicks so page changes AJAX the grid instead of reloading the panel.
      if (!drive) {
        setPagerUnneeded(false);
        unhideThemePagers();
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
        // Few filtered results (≤ one page): hide theme pager.
        if (resultsFitOnePage(this) || total <= size) {
          return true;
        }
        unhideThemePagers();
        var roots = findThemePagers();
        if (!roots.length) {
          scheduleThemePagerSync(this);
          return true;
        }
        bindThemePagerClicks();
        this._themePagerTries = 0;
        var i;
        for (i = 0; i < roots.length; i++) {
          snapshotPager(roots[i]);
          rewritePager(roots[i], this);
        }
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

  installSetter();
})();
