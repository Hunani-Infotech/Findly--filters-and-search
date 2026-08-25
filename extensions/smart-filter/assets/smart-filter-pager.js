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

    proto.renderPager = function () {
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
