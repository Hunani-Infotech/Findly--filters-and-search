/**
 * Collection pager (pagination / load more / infinite scroll).
 * Loaded from Liquid via asset_url so it does not count against the 100 KB
 * schema "javascript" cap on smart-filter.min.js.
 *
 * Patches Widget.prototype as soon as window.__FINDLY_FILTER_WIDGET is set.
 * Infinite scroll never renders the Load more button.
 */
(function () {
  "use strict";

  var THEME_PAGER_SEL =
    "nav.pagination, .pagination, .pagination-wrapper, [data-pagination], .paginate, #pagination, .Pagination";
  var ORIG_ATTR = "data-sf-theme-orig";

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

  function usesThemeNumberedPager(widget) {
    var style = widget && widget.paginationStyle;
    return style !== "load_more" && style !== "infinite";
  }

  function setCustomPagerClass(on) {
    var root = document.documentElement;
    if (!root || !root.classList) return;
    if (on) root.classList.add("sf-custom-pager");
    else root.classList.remove("sf-custom-pager");
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
    return roots;
  }

  function shouldDriveThemePager(widget) {
    if (!widget) return false;
    if (widget.shouldInterceptPaging) return Boolean(widget.shouldInterceptPaging());
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

  function snapshotPager(el) {
    if (!el || el.getAttribute(ORIG_ATTR) != null) return;
    el.setAttribute(ORIG_ATTR, el.innerHTML);
  }

  function unhidePager(el) {
    if (!el) return;
    el.hidden = false;
    el.removeAttribute("hidden");
    el.removeAttribute("data-sf-pager-hidden");
    el.removeAttribute("data-findly-theme-hidden");
    el.removeAttribute("data-findly-native-chrome");
    el.removeAttribute("data-smart-filter-hidden");
    el.removeAttribute("data-sf-pager-display");
    el.removeAttribute("data-findly-theme-display");
    if (el.classList) el.classList.remove("hidden");
    el.style.removeProperty("display");
  }

  function restorePager(el) {
    if (!el) return;
    var orig = el.getAttribute(ORIG_ATTR);
    if (orig != null) el.innerHTML = orig;
    unhidePager(el);
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

  function rewritePager(el, widget) {
    snapshotPager(el);
    var orig = el.getAttribute(ORIG_ATTR) || "";
    var size = widget.pageSize || 16;
    var total = Number(widget._pageTotal) || 0;
    var pageCount = Math.max(1, Math.ceil(total / size) || 1);
    var page = Math.max(1, widget.page || 1);
    if (pageCount <= 1) {
      el.hidden = true;
      el.setAttribute("hidden", "");
      el.style.setProperty("display", "none", "important");
      return;
    }
    unhidePager(el);
    var tpls = parseTemplates(orig);
    if (!tpls.page) {
      restorePager(el);
      return;
    }
    var list = el.querySelector("ul, ol, .pagination__list, [role='list']");
    if (!list) {
      restorePager(el);
      return;
    }
    list.innerHTML = "";
    function appendClone(tpl, target, current) {
      if (!tpl) return;
      var node = tpl.cloneNode(true);
      if (target) setItemPage(node, target, Boolean(current));
      list.appendChild(node);
    }
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
        if (!widget || !usesThemeNumberedPager(widget)) return;
        if (!shouldDriveThemePager(widget)) return;
        var target = event.target;
        if (!target || !target.closest) return;
        if (target.closest(".sf-pager, .smart-filter")) return;
        var root = target.closest(THEME_PAGER_SEL);
        if (!root || isFindlyPager(root)) return;
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

    proto.bindInfinite = function (sentinel) {
      var self = this;
      this.disconnectInfinite();
      if (!sentinel) return;
      function maybeLoad() {
        if (self.paginationStyle !== "infinite") return;
        if (self._loadingPage || !self._hasNext) return;
        var rect = sentinel.getBoundingClientRect();
        if (rect.top > (window.innerHeight || 0) + 400) return;
        self.disconnectInfinite();
        self.loadNextPage();
      }
      if (typeof window.IntersectionObserver === "function") {
        this._infiniteObserver = new IntersectionObserver(
          function (entries) {
            var hit = false;
            for (var i = 0; i < entries.length; i++) {
              if (entries[i].isIntersecting) hit = true;
            }
            if (!hit) return;
            maybeLoad();
          },
          { root: null, rootMargin: "400px", threshold: 0 },
        );
        this._infiniteObserver.observe(sentinel);
        return;
      }
      this._infiniteOnScroll = maybeLoad;
      window.addEventListener("scroll", maybeLoad, { passive: true });
      window.addEventListener("resize", maybeLoad);
      maybeLoad();
    };

    proto.placePagerEl = function (el) {
      if (!el) return el;
      el.classList.add("sf-pager");
      el.removeAttribute("data-smart-filter-hidden");
      el.removeAttribute("data-findly-theme-hidden");
      var main = document.querySelector(
        ".sf-collection-layout > .sf-collection-layout__main",
      ) || document.querySelector(".sf-collection-layout__main");
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

    proto.renderLoadMore = function (el) {
      if (this.paginationStyle === "infinite") return;
      el.innerHTML = "";
      if (!this._hasNext) {
        el.hidden = true;
        return;
      }
      el.hidden = false;
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "sf-pager__more";
      btn.textContent = this.t("load_more", "Load more");
      btn.disabled = Boolean(this._loadingPage || this._appending);
      if (btn.disabled) btn.setAttribute("aria-busy", "true");
      btn.addEventListener(
        "click",
        function () {
          this.loadNextPage();
        }.bind(this),
      );
      el.appendChild(btn);
      if (this._loadingPage || this._appending) {
        var spin = document.createElement("span");
        spin.className = "sf-pager__spin";
        spin.setAttribute("aria-hidden", "true");
        btn.appendChild(spin);
      }
    };

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
      list.className = "sf-pager__nav";

      var prev = document.createElement("button");
      prev.type = "button";
      prev.className = "sf-pager__btn sf-pager__btn--prev";
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
      pages.className = "sf-pager__pages";
      pageWindow(page, pageCount).forEach(
        function (item) {
          if (item === "ellipsis") {
            var dots = document.createElement("span");
            dots.className = "sf-pager__ellipsis";
            dots.textContent = "…";
            pages.appendChild(dots);
            return;
          }
          var btn = document.createElement("button");
          btn.type = "button";
          btn.className =
            "sf-pager__page" + (item === page ? " is-current" : "");
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
      next.className = "sf-pager__btn sf-pager__btn--next";
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
      var el = this._pagerEl;
      if (!el) return;
      el.hidden = true;
      el.setAttribute("hidden", "");
      el.innerHTML = "";
      el.style.setProperty("display", "none", "important");
    };

    proto.usesThemeNumberedPager = function () {
      return usesThemeNumberedPager(this);
    };

    proto.syncThemePager = function () {
      if (!usesThemeNumberedPager(this)) return false;
      var roots = findThemePagers();
      if (!roots.length) return false;
      this.hideFindlyPagerEl();
      bindThemePagerClicks();
      var drive = shouldDriveThemePager(this);
      var i;
      for (i = 0; i < roots.length; i++) {
        snapshotPager(roots[i]);
        if (drive) rewritePager(roots[i], this);
        else restorePager(roots[i]);
      }
      return true;
    };

    var origSetHidden = proto.setThemePagerHidden;
    proto.setThemePagerHidden = function (hide) {
      if (usesThemeNumberedPager(this) && hide && findThemePagers().length) {
        this.syncThemePager();
        return;
      }
      if (origSetHidden) origSetHidden.call(this, hide);
    };

    var origRestore = proto.restoreThemePaging;
    proto.restoreThemePaging = function () {
      if (origRestore) origRestore.call(this);
      if (!usesThemeNumberedPager(this)) return;
      var roots = findThemePagers();
      var i;
      for (i = 0; i < roots.length; i++) restorePager(roots[i]);
      this.hideFindlyPagerEl();
    };

    proto.renderPager = function () {
      setCustomPagerClass(!usesThemeNumberedPager(this));
      if (usesThemeNumberedPager(this) && this.syncThemePager()) {
        this.disconnectInfinite();
        return;
      }
      var el = this.ensurePagerEl();
      if (this.placePagerEl) this.placePagerEl(el);
      var style = this.paginationStyle;
      el.classList.remove(
        "sf-pager--pagination",
        "sf-pager--load-more",
        "sf-pager--infinite",
      );
      el.classList.add(
        style === "load_more"
          ? "sf-pager--load-more"
          : style === "infinite"
            ? "sf-pager--infinite"
            : "sf-pager--pagination",
      );
      el.style.removeProperty("display");
      if (style === "load_more") {
        this.disconnectInfinite();
        this.renderLoadMore(el);
        return;
      }
      if (style === "infinite") {
        el.innerHTML = "";
        if (!this._hasNext) {
          el.hidden = true;
          this.disconnectInfinite();
          return;
        }
        el.hidden = false;
        var sentinel = document.createElement("div");
        sentinel.className =
          "sf-pager__sentinel" +
          (this._loadingPage || this._appending ? " is-busy" : "");
        sentinel.setAttribute("aria-hidden", "true");
        el.appendChild(sentinel);
        this.bindInfinite(sentinel);
        return;
      }
      this.disconnectInfinite();
      this.renderNumberedPager(el);
    };
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
