(function () {
  "use strict";

  var DEBOUNCE_MS = 300;
  var DEFAULT_MIN_CHARS = 2;
  var DEFAULT_LIMIT = 6;
  var LAYOUT_CLASS = {
    overlay: "findly-instant--overlay",
    dropdown_two: "findly-instant--dropdown-two",
    dropdown_one: "findly-instant--dropdown-one",
  };

  function runWhenIdle(fn) {
    if (typeof window.requestIdleCallback !== "function") {
      window.setTimeout(fn, 0);
      return;
    }
    window.requestIdleCallback(
      function () {
        fn();
      },
      { timeout: 2000 },
    );
  }

  function setHidden(el, hidden) {
    if (!el) return;
    if (hidden) el.setAttribute("hidden", "");
    else el.removeAttribute("hidden");
  }

  function text(value, fallback) {
    if (typeof value === "string" && value.trim()) return value;
    return fallback || "";
  }

  function formatPrice(value) {
    if (value == null || value === "") return "";
    var n = Number(value);
    if (!Number.isFinite(n)) return String(value);
    return String(n);
  }

  function asArray(value) {
    return Array.isArray(value) ? value.filter(Boolean) : [];
  }

  function isIgnoredContainer(el) {
    return Boolean(
      el &&
        (el.closest(".smart-filter-search") || el.closest(".findly-instant")),
    );
  }

  function isThemeSearchInput(el) {
    if (!el || el.nodeType !== 1) return false;
    if (el.tagName !== "INPUT") return false;
    if (isIgnoredContainer(el)) return false;
    var type = String(el.getAttribute("type") || "").toLowerCase();
    var name = String(el.getAttribute("name") || "");
    var form = el.form || el.closest("form");
    var action = form ? String(form.getAttribute("action") || "") : "";
    var inSearchForm = action.indexOf("/search") !== -1;
    if (inSearchForm && (name === "q" || type === "search")) return true;
    if (name === "q" && type === "search") return true;
    return false;
  }

  function InstantSearch(root) {
    this.root = root;
    this.proxyBase = (root.getAttribute("data-proxy-base") || "/apps/smart-filter").replace(
      /\/$/,
      "",
    );
    this.locale = root.getAttribute("data-locale") || "";
    this.instant = null;
    this.minChars = DEFAULT_MIN_CHARS;
    this.showSuggestionsOnEmptyQuery = false;
    this.showSuggestionsOnNoResults = false;
    this.activeInput = null;
    this._timer = 0;
    this._abort = null;
    this._reqId = 0;
    this.panel = document.createElement("div");
    this.panel.className = "findly-instant__panel";
    this.panel.setAttribute("data-instant-panel", "");
    root.appendChild(this.panel);
  }

  InstantSearch.prototype.layoutClass = function () {
    var layout = this.instant && this.instant.layout;
    return LAYOUT_CLASS[layout] || LAYOUT_CLASS.dropdown_one;
  };

  InstantSearch.prototype.applyChrome = function () {
    var root = this.root;
    root.classList.remove(
      "findly-instant--overlay",
      "findly-instant--dropdown-two",
      "findly-instant--dropdown-one",
      "findly-instant--grid",
      "findly-instant--carousel",
    );
    root.classList.add(this.layoutClass());
    if (this.instant && this.instant.productStyle === "carousel") {
      root.classList.add("findly-instant--carousel");
    } else {
      root.classList.add("findly-instant--grid");
    }
  };

  InstantSearch.prototype.close = function () {
    window.clearTimeout(this._timer);
    if (this._abort) this._abort.abort();
    this._abort = null;
    this.panel.innerHTML = "";
    setHidden(this.root, true);
    if (this.activeInput) {
      this.activeInput.removeAttribute("aria-expanded");
      this.activeInput.removeAttribute("aria-controls");
    }
    this.activeInput = null;
  };

  InstantSearch.prototype.position = function () {
    var input = this.activeInput;
    var root = this.root;
    if (!input) return;
    var rect = input.getBoundingClientRect();
    var gap = 4;
    var top = Math.max(0, Math.round(rect.bottom + gap));
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    root.style.position = "fixed";
    root.style.zIndex = "2147483000";
    root.style.maxHeight = Math.max(160, vh - top - 8) + "px";
    root.style.top = top + "px";

    if (this.instant && this.instant.layout === "overlay") {
      root.style.left = "0";
      root.style.right = "0";
      root.style.width = "100%";
      root.style.maxWidth = "none";
      return;
    }

    var maxW = this.instant && this.instant.layout === "dropdown_two" ? 860 : 420;
    var width = Math.min(maxW, Math.max(rect.width, 240), vw - 16);
    var left = Math.round(rect.left);
    if (left + width > vw - 8) left = Math.max(8, vw - width - 8);
    if (left < 8) left = 8;
    root.style.left = left + "px";
    root.style.right = "auto";
    root.style.width = width + "px";
    root.style.maxWidth = maxW + "px";
  };

  InstantSearch.prototype.section = function (title, className) {
    var wrap = document.createElement("section");
    wrap.className = "findly-instant__section " + className;
    var heading = document.createElement("h3");
    heading.className = "findly-instant__heading";
    heading.textContent = title;
    wrap.appendChild(heading);
    return wrap;
  };

  InstantSearch.prototype.linkItem = function (href, label, extraClass) {
    var li = document.createElement("li");
    li.className = "findly-instant__item";
    var a = document.createElement("a");
    a.className = "findly-instant__link" + (extraClass ? " " + extraClass : "");
    a.href = href || "#";
    a.textContent = label;
    li.appendChild(a);
    return li;
  };

  InstantSearch.prototype.productCard = function (item) {
    var instant = this.instant || {};
    var href = item && item.url ? String(item.url) : item && item.handle ? "/products/" + item.handle : "#";
    var title = String((item && (item.title || item.handle)) || "Product");
    var a = document.createElement("a");
    a.className = "findly-instant__product";
    a.href = href;

    var src = item && item.imageUrl ? String(item.imageUrl) : "";
    if (src) {
      var img = document.createElement("img");
      img.className = "findly-instant__image";
      img.src = src;
      img.alt = "";
      img.loading = "lazy";
      img.width = 72;
      img.height = 72;
      a.appendChild(img);
    } else {
      var ph = document.createElement("span");
      ph.className = "findly-instant__image findly-instant__image--empty";
      ph.setAttribute("aria-hidden", "true");
      a.appendChild(ph);
    }

    var meta = document.createElement("span");
    meta.className = "findly-instant__meta";
    var name = document.createElement("span");
    name.className = "findly-instant__title";
    name.textContent = title;
    meta.appendChild(name);

    if (instant.showVendor && item && item.vendor) {
      var vendor = document.createElement("span");
      vendor.className = "findly-instant__vendor";
      vendor.textContent = String(item.vendor);
      meta.appendChild(vendor);
    }

    if (instant.showPrice) {
      var priceText = formatPrice(item && item.priceMin != null ? item.priceMin : item && item.price);
      if (priceText) {
        var price = document.createElement("span");
        price.className = "findly-instant__price";
        price.textContent = priceText;
        meta.appendChild(price);
      }
    }

    a.appendChild(meta);
    return a;
  };

  InstantSearch.prototype.renderList = function (items, mapFn) {
    var ul = document.createElement("ul");
    ul.className = "findly-instant__list";
    ul.setAttribute("role", "list");
    items.forEach(function (item) {
      ul.appendChild(mapFn(item));
    });
    return ul;
  };

  InstantSearch.prototype.render = function (data) {
    var instant = (data && data.instant) || this.instant || {};
    this.instant = instant;
    this.applyChrome();

    var query = String((data && data.query) || "").trim();
    var queries = asArray(data && data.queries);
    var products = asArray(data && data.products);
    var suggestions = asArray(data && data.suggestions);
    var collections = asArray(data && data.collections);
    var pages = asArray(data && data.pages);
    var articles = asArray(data && data.articles);

    if (!products.length && suggestions.length) products = suggestions;

    var showProducts = instant.showProducts !== false && products.length > 0;
    var showCollections = instant.showCollections !== false && collections.length > 0;
    var showPages = instant.showPages === true && pages.length > 0;
    var showPosts = instant.showBlogPosts === true && articles.length > 0;
    var showQueries = queries.length > 0;

    this.panel.innerHTML = "";
    if (!showQueries && !showProducts && !showCollections && !showPages && !showPosts) {
      if (query) {
        var empty = document.createElement("p");
        empty.className = "findly-instant__empty";
        empty.textContent = "No results";
        this.panel.appendChild(empty);
        setHidden(this.root, false);
        this.position();
      } else {
        this.close();
      }
      return;
    }

    var layout = document.createElement("div");
    layout.className = "findly-instant__layout";
    var aside = document.createElement("div");
    aside.className = "findly-instant__aside";
    var main = document.createElement("div");
    main.className = "findly-instant__main";

    var self = this;

    if (showQueries) {
      var qSec = this.section("Queries", "findly-instant__section--queries");
      qSec.appendChild(
        this.renderList(queries, function (row) {
          var label = text(row.query, "");
          var href = text(row.url, "/search?q=" + encodeURIComponent(label));
          return self.linkItem(href, label, "findly-instant__link--query");
        }),
      );
      aside.appendChild(qSec);
    }

    if (showCollections) {
      var cSec = this.section("Collections", "findly-instant__section--collections");
      cSec.appendChild(
        this.renderList(collections, function (row) {
          var label = text(row.title || row.handle, "Collection");
          var href = text(row.url, row.handle ? "/collections/" + row.handle : "#");
          return self.linkItem(href, label);
        }),
      );
      aside.appendChild(cSec);
    }

    if (showPosts) {
      var bSec = this.section("Blog posts", "findly-instant__section--articles");
      bSec.appendChild(
        this.renderList(articles, function (row) {
          return self.linkItem(text(row.url, "#"), text(row.title, "Article"));
        }),
      );
      aside.appendChild(bSec);
    }

    if (showPages) {
      var pSec = this.section("Pages", "findly-instant__section--pages");
      pSec.appendChild(
        this.renderList(pages, function (row) {
          return self.linkItem(text(row.url, "#"), text(row.title, "Page"));
        }),
      );
      aside.appendChild(pSec);
    }

    if (showProducts) {
      var prodSec = this.section("Products", "findly-instant__section--products");
      var grid = document.createElement("div");
      grid.className = "findly-instant__products";
      products.forEach(function (item) {
        grid.appendChild(self.productCard(item));
      });
      prodSec.appendChild(grid);
      main.appendChild(prodSec);
    }

    if (aside.childNodes.length) layout.appendChild(aside);
    else this.root.classList.add("findly-instant--no-aside");
    if (main.childNodes.length) layout.appendChild(main);
    this.root.classList.toggle("findly-instant--no-aside", !aside.childNodes.length);

    this.panel.appendChild(layout);
    setHidden(this.root, false);
    if (this.activeInput) {
      if (!this.panel.id) this.panel.id = "findly-instant-panel";
      this.activeInput.setAttribute("aria-expanded", "true");
      this.activeInput.setAttribute("aria-controls", this.panel.id);
    }
    this.position();
  };

  InstantSearch.prototype.fetchJson = function (url) {
    if (this._abort) this._abort.abort();
    this._abort =
      typeof AbortController === "function" ? new AbortController() : null;
    var opts = {
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    };
    if (this._abort) opts.signal = this._abort.signal;
    return fetch(url, opts).then(function (response) {
      if (!response.ok) throw new Error("Request failed (" + response.status + ")");
      return response.text();
    }).then(function (raw) {
      return raw ? JSON.parse(raw) : {};
    });
  };

  InstantSearch.prototype.applySearchData = function (data) {
    if (data && data.redirect) {
      window.location = data.redirect;
      return;
    }
    if (data && data.instant) this.instant = data.instant;
    this.render(data || {});
  };

  InstantSearch.prototype.runQuery = function (rawQuery) {
    var query = String(rawQuery || "").trim();
    var self = this;
    var reqId = ++this._reqId;
    var limit = (this.instant && this.instant.maxProducts) || DEFAULT_LIMIT;
    var url =
      this.proxyBase +
      "/search?q=" +
      encodeURIComponent(query) +
      "&limit=" +
      encodeURIComponent(String(limit));
    if (this.locale) url += "&locale=" + encodeURIComponent(this.locale);

    this.fetchJson(url)
      .then(function (data) {
        if (reqId !== self._reqId) return;
        self.applySearchData(data);
      })
      .catch(function (err) {
        if (err && err.name === "AbortError") return;
        if (reqId !== self._reqId) return;
      });
  };

  InstantSearch.prototype.scheduleQuery = function (value) {
    var self = this;
    window.clearTimeout(this._timer);
    this._timer = window.setTimeout(function () {
      self.runQuery(value);
    }, DEBOUNCE_MS);
  };

  InstantSearch.prototype.onInputValue = function (input) {
    if (!isThemeSearchInput(input)) return;
    this.activeInput = input;
    var value = String(input.value || "");
    var trimmed = value.trim();
    var minChars = this.minChars || DEFAULT_MIN_CHARS;

    if (!trimmed) {
      if (this.showSuggestionsOnEmptyQuery) this.scheduleQuery("");
      else this.close();
      return;
    }

    if (trimmed.length < minChars) {
      this.close();
      return;
    }

    this.scheduleQuery(trimmed);
  };

  InstantSearch.prototype.onFocus = function (input) {
    if (!isThemeSearchInput(input)) return;
    this.activeInput = input;
    var trimmed = String(input.value || "").trim();
    if (!trimmed && this.showSuggestionsOnEmptyQuery) {
      this.runQuery("");
    } else if (trimmed.length >= (this.minChars || DEFAULT_MIN_CHARS)) {
      this.runQuery(trimmed);
    }
  };

  InstantSearch.prototype.bind = function () {
    var self = this;
    document.addEventListener(
      "focusin",
      function (event) {
        self.onFocus(event.target);
      },
      true,
    );
    document.addEventListener(
      "input",
      function (event) {
        self.onInputValue(event.target);
      },
      true,
    );
    document.addEventListener("keydown", function (event) {
      if (event.key !== "Escape") return;
      if (self.root.hasAttribute("hidden")) return;
      self.close();
    });
    document.addEventListener("click", function (event) {
      if (self.root.hasAttribute("hidden")) return;
      var target = event.target;
      if (self.root.contains(target)) return;
      if (self.activeInput && (target === self.activeInput || self.activeInput.contains(target))) {
        return;
      }
      self.close();
    });
    window.addEventListener(
      "resize",
      function () {
        if (!self.root.hasAttribute("hidden")) self.position();
      },
      { passive: true },
    );
    window.addEventListener(
      "scroll",
      function () {
        if (!self.root.hasAttribute("hidden")) self.position();
      },
      true,
    );
  };

  InstantSearch.prototype.init = function () {
    var self = this;
    var url = this.proxyBase + "/search?widget=1";
    this.fetchJson(url)
      .then(function (data) {
        var instant = data && data.instant;
        if (!instant || instant.enabled !== true) return;
        self.instant = instant;
        self.minChars = Number(data.minChars) || DEFAULT_MIN_CHARS;
        self.showSuggestionsOnEmptyQuery = data.showSuggestionsOnEmptyQuery === true;
        self.showSuggestionsOnNoResults = data.showSuggestionsOnNoResults === true;
        self.applyChrome();
        self.bind();
      })
      .catch(function () {});
  };

  function boot() {
    var roots = document.querySelectorAll(".findly-instant");
    if (!roots.length) return;
    roots.forEach(function (root) {
      if (root.getAttribute("data-findly-instant-ready") === "true") return;
      root.setAttribute("data-findly-instant-ready", "true");
      new InstantSearch(root).init();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      runWhenIdle(boot);
    });
  } else {
    runWhenIdle(boot);
  }
})();
