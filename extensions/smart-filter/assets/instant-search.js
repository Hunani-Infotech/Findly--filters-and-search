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

  function domApi() {
    return window.__FINDLY_DOM || null;
  }

  function runWhenIdle(fn) {
    var api = domApi();
    if (api && api.runWhenIdle) {
      api.runWhenIdle(fn);
      return;
    }
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
    var api = domApi();
    if (api && api.setHidden) {
      api.setHidden(el, hidden);
      return;
    }
    if (!el) return;
    if (hidden) el.setAttribute("hidden", "");
    else el.removeAttribute("hidden");
  }

  function text(value, fallback) {
    if (typeof value === "string" && value.trim()) return value;
    return fallback || "";
  }

  function formatPrice(value, currencyCode) {
    var api = domApi();
    if (api && api.formatPrice) return api.formatPrice(value, currencyCode);
    if (value == null || value === "") return "";
    var n = Number(value);
    if (!Number.isFinite(n)) return String(value);
    var currency =
      currencyCode ||
      (window.Shopify &&
        window.Shopify.currency &&
        window.Shopify.currency.active) ||
      "";
    if (!currency) return String(n);
    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: currency,
      }).format(n);
    } catch (err) {
      return String(n);
    }
  }

  function asArray(value) {
    return Array.isArray(value) ? value.filter(Boolean) : [];
  }

  function isIgnoredContainer(el) {
    return Boolean(
      el &&
        (el.closest(".smart-filter-search") ||
          el.closest(".findly-instant") ||
          el.closest(".sf-search-host") ||
          el.closest(".sf-search")),
    );
  }

  function isThemeSearchInput(el) {
    if (!el || el.nodeType !== 1) return false;
    if (el.tagName !== "INPUT" && el.tagName !== "TEXTAREA") return false;
    if (el.hasAttribute && el.hasAttribute("data-collection-search")) return false;
    if (isIgnoredContainer(el)) return false;
    var type = String(el.getAttribute("type") || "text").toLowerCase();
    if (
      type &&
      type !== "search" &&
      type !== "text" &&
      type !== "url"
    ) {
      return false;
    }
    var name = String(el.getAttribute("name") || "").toLowerCase();
    var id = String(el.id || "").toLowerCase();
    var role = String(el.getAttribute("role") || "").toLowerCase();
    var aria = String(
      el.getAttribute("aria-label") ||
        el.getAttribute("placeholder") ||
        "",
    ).toLowerCase();
    var form = el.form || (el.closest && el.closest("form"));
    var action = form ? String(form.getAttribute("action") || "") : "";
    var inSearchForm =
      /\/search/i.test(action) ||
      Boolean(
        el.closest &&
          el.closest(
            "predictive-search, .predictive-search, search-form, [data-predictive-search], details-modal, .search-modal, .header__search, [role='search']",
          ),
      );
    if (inSearchForm && (name === "q" || type === "search" || role === "searchbox")) {
      return true;
    }
    if (name === "q" && (type === "search" || type === "text")) return true;
    if (type === "search" && /q|search|query/.test(name || "q")) return true;
    if (role === "searchbox") return true;
    if (
      inSearchForm &&
      /search/.test(id + " " + aria) &&
      (type === "search" || type === "text")
    ) {
      return true;
    }
    return false;
  }

  function suppressThemePredictive(input) {
    if (!input || !input.closest) return;
    var host = input.closest(
      "predictive-search, .predictive-search, search-form, details-modal, [data-predictive-search]",
    );
    if (!host || !host.querySelectorAll) return;
    var results = host.querySelectorAll(
      "[data-predictive-search-results], #predictive-search-results, .predictive-search__results, .predictive-search-results, [id*='predictive-search']",
    );
    var i;
    for (i = 0; i < results.length; i++) {
      if (results[i] === input || (results[i].contains && results[i].contains(input))) {
        continue;
      }
      results[i].setAttribute("hidden", "");
      results[i].style.setProperty("display", "none", "important");
    }
    try {
      if (typeof host.close === "function") host.close();
      if (typeof host.reset === "function") {
        /* keep typed value */
      }
    } catch (err) {
      /* ignore */
    }
  }

  function InstantSearch(root) {
    this.root = root;
    this.proxyBase = (root.getAttribute("data-proxy-base") || "/apps/smart-filter").replace(
      /\/$/,
      "",
    );
    this.locale = root.getAttribute("data-locale") || "";
    this.country =
      root.getAttribute("data-country") ||
      (window.Shopify && window.Shopify.country) ||
      "";
    this.currency =
      root.getAttribute("data-currency") ||
      (window.Shopify &&
        window.Shopify.currency &&
        window.Shopify.currency.active) ||
      "";
    this.companyLocation = root.getAttribute("data-company-location") || "";
    this.instant = null;
    this.minChars = DEFAULT_MIN_CHARS;
    this.showSuggestionsOnEmptyQuery = false;
    this.showSuggestionsOnNoResults = false;
    this.activeInput = null;
    this._timer = 0;
    this._abort = null;
    this._reqId = 0;
    this.panel = document.createElement("div");
    this.panel.className = "findly-instant-panel";
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
    wrap.className = "findly-instant-section " + className;
    var heading = document.createElement("h3");
    heading.className = "findly-instant-heading";
    heading.textContent = title;
    wrap.appendChild(heading);
    return wrap;
  };

  InstantSearch.prototype.linkItem = function (href, label, extraClass) {
    var li = document.createElement("li");
    li.className = "findly-instant-item";
    var a = document.createElement("a");
    a.className = "findly-instant-link" + (extraClass ? " " + extraClass : "");
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
    a.className = "findly-instant-product";
    a.href = href;

    var src = item && item.imageUrl ? String(item.imageUrl) : "";
    if (src) {
      var img = document.createElement("img");
      img.className = "findly-instant-image";
      img.src = src;
      img.alt = "";
      img.loading = "lazy";
      img.width = 72;
      img.height = 72;
      a.appendChild(img);
    } else {
      var ph = document.createElement("span");
      ph.className = "findly-instant-image is-empty";
      ph.setAttribute("aria-hidden", "true");
      a.appendChild(ph);
    }

    var meta = document.createElement("span");
    meta.className = "findly-instant-meta";
    var name = document.createElement("span");
    name.className = "findly-instant-title";
    name.textContent = title;
    meta.appendChild(name);

    if (instant.showVendor && item && item.vendor) {
      var vendor = document.createElement("span");
      vendor.className = "findly-instant-vendor";
      vendor.textContent = String(item.vendor);
      meta.appendChild(vendor);
    }

    if (instant.showPrice) {
      var priceText = formatPrice(
        item && item.priceMin != null ? item.priceMin : item && item.price,
        this.payloadCurrency || this.currency,
      );
      if (priceText) {
        var price = document.createElement("span");
        price.className = "findly-instant-price";
        price.textContent = priceText;
        meta.appendChild(price);
      }
    }

    a.appendChild(meta);
    return a;
  };

  InstantSearch.prototype.renderList = function (items, mapFn) {
    var ul = document.createElement("ul");
    ul.className = "findly-instant-list";
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

    var chrome = (data && data.i18n && typeof data.i18n === "object") ? data.i18n : {};
    var suggestion = String((data && data.didYouMean) || "").trim();
    var showSpell =
      Boolean(query) &&
      Boolean(suggestion) &&
      suggestion.toLowerCase() !== query.toLowerCase();
    if (showSpell) {
      var spell = document.createElement("p");
      spell.className = "findly-instant-spell";
      spell.appendChild(
        document.createTextNode(
          (chrome.did_you_mean || "Did you mean") + " ",
        ),
      );
      var spellBtn = document.createElement("button");
      spellBtn.type = "button";
      spellBtn.className = "findly-instant-spell-link";
      spellBtn.textContent = suggestion;
      var selfSpell = this;
      spellBtn.addEventListener("click", function () {
        if (selfSpell.activeInput) {
          selfSpell.activeInput.value = suggestion;
        }
        selfSpell.runQuery(suggestion);
      });
      spell.appendChild(spellBtn);
      this.panel.appendChild(spell);
    }

    if (!showQueries && !showProducts && !showCollections && !showPages && !showPosts) {
      if (query) {
        var empty = document.createElement("p");
        empty.className = "findly-instant-empty";
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
    layout.className = "findly-instant-layout";
    var aside = document.createElement("div");
    aside.className = "findly-instant-aside";
    var main = document.createElement("div");
    main.className = "findly-instant-main";

    var self = this;

    if (showQueries) {
      var qSec = this.section("Queries", "findly-instant-section-queries");
      qSec.appendChild(
        this.renderList(queries, function (row) {
          var label = text(row.query, "");
          var href = text(row.url, "/search?q=" + encodeURIComponent(label));
          return self.linkItem(href, label, "findly-instant-link-query");
        }),
      );
      aside.appendChild(qSec);
    }

    if (showCollections) {
      var cSec = this.section("Collections", "findly-instant-section-collections");
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
      var bSec = this.section("Blog posts", "findly-instant-section-articles");
      bSec.appendChild(
        this.renderList(articles, function (row) {
          return self.linkItem(text(row.url, "#"), text(row.title, "Article"));
        }),
      );
      aside.appendChild(bSec);
    }

    if (showPages) {
      var pSec = this.section("Pages", "findly-instant-section-pages");
      pSec.appendChild(
        this.renderList(pages, function (row) {
          return self.linkItem(text(row.url, "#"), text(row.title, "Page"));
        }),
      );
      aside.appendChild(pSec);
    }

    if (showProducts) {
      var prodSec = this.section("Products", "findly-instant-section-products");
      var grid = document.createElement("div");
      grid.className = "findly-instant-products";
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

  InstantSearch.prototype.showLoadingPanel = function () {
    if (!this.panel) return;
    this.applyChrome();
    this.panel.innerHTML =
      '<div class="findly-instant-layout is-skeleton" aria-hidden="true">' +
      '<div class="findly-instant-main">' +
      '<div class="findly-instant-skel-row"></div>' +
      '<div class="findly-instant-skel-row"></div>' +
      '<div class="findly-instant-skel-row is-short"></div>' +
      '<div class="findly-instant-products">' +
      '<div class="findly-instant-skel-card"></div>' +
      '<div class="findly-instant-skel-card"></div>' +
      '<div class="findly-instant-skel-card"></div>' +
      '<div class="findly-instant-skel-card"></div>' +
      "</div></div></div>";
    setHidden(this.root, false);
    this.position();
  };

  InstantSearch.prototype.fetchJson = function (url) {
    if (this._abort) this._abort.abort();
    this._abort =
      typeof AbortController === "function" ? new AbortController() : null;
    var opts = {
      credentials: "same-origin",
      cache: "no-store",
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
    if (data && data.settings && data.settings.currency) {
      this.payloadCurrency = String(data.settings.currency);
    }
    this.render(data || {});
  };

  InstantSearch.prototype.runQuery = function (rawQuery) {
    var query = String(rawQuery || "").trim();
    if (query === this._lastQuery) {
      if (this.root.hasAttribute("hidden") && this.panel && this.panel.childNodes.length) {
        setHidden(this.root, false);
        this.position();
      }
      return;
    }
    this._lastQuery = query;
    var self = this;
    var reqId = ++this._reqId;
    this.showLoadingPanel();
    var limit = (this.instant && this.instant.maxProducts) || DEFAULT_LIMIT;
    var url =
      this.proxyBase +
      "/search?q=" +
      encodeURIComponent(query) +
      "&limit=" +
      encodeURIComponent(String(limit));
    if (this.locale) url += "&locale=" + encodeURIComponent(this.locale);
    if (this.country) url += "&country=" + encodeURIComponent(this.country);
    if (this.currency) url += "&currency=" + encodeURIComponent(this.currency);
    if (this.companyLocation) {
      url +=
        "&company_location=" + encodeURIComponent(this.companyLocation);
    }

    this.fetchJson(url)
      .then(function (data) {
        if (reqId !== self._reqId) return;
        self.applySearchData(data);
      })
      .catch(function (err) {
        if (err && err.name === "AbortError") return;
        if (reqId !== self._reqId) return;
        if (self._lastQuery === query) self._lastQuery = undefined;
        if (!self.panel) return;
        self.panel.innerHTML =
          '<p class="findly-instant-empty">Search could not be loaded.</p>';
        setHidden(self.root, false);
        self.position();
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
    suppressThemePredictive(input);
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
    suppressThemePredictive(input);
    var trimmed = String(input.value || "").trim();
    if (!trimmed && this.showSuggestionsOnEmptyQuery) {
      this.scheduleQuery("");
    } else if (trimmed.length >= (this.minChars || DEFAULT_MIN_CHARS)) {
      this.scheduleQuery(trimmed);
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
    document.addEventListener(
      "submit",
      function (event) {
        var form = event.target;
        if (!form || !form.querySelector) return;
        var input = form.querySelector(
          "input[name='q'], input[type='search'], [role='searchbox']",
        );
        if (!input || !isThemeSearchInput(input)) return;
        suppressThemePredictive(input);
      },
      true,
    );
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
    if (this.locale) url += "&locale=" + encodeURIComponent(this.locale);
    if (this.country) url += "&country=" + encodeURIComponent(this.country);
    if (this.currency) url += "&currency=" + encodeURIComponent(this.currency);
    if (this.companyLocation) {
      url +=
        "&company_location=" + encodeURIComponent(this.companyLocation);
    }
    this.fetchJson(url)
      .then(function (data) {
        var instant = data && data.instant;
        if (!instant || instant.enabled !== true) return;
        self.instant = instant;
        self.minChars = Number(data.minChars) || DEFAULT_MIN_CHARS;
        self.showSuggestionsOnEmptyQuery = data.showSuggestionsOnEmptyQuery === true;
        self.showSuggestionsOnNoResults = data.showSuggestionsOnNoResults === true;
        if (data && data.settings && data.settings.currency) {
          self.payloadCurrency = String(data.settings.currency);
        }
        self.applyChrome();
        self.bind();
        ensureFallbackSearchBar();
      })
      .catch(function () {});
  };

  function findThemeSearchInputs() {
    var nodes = document.querySelectorAll("input, textarea");
    var found = [];
    var i;
    for (i = 0; i < nodes.length; i++) {
      if (isThemeSearchInput(nodes[i])) found.push(nodes[i]);
    }
    return found;
  }

  function ensureFallbackSearchBar() {
    if (document.querySelector(".findly-instant-bar")) return;
    if (findThemeSearchInputs().length) return;
    var bar = document.createElement("div");
    bar.className = "findly-instant-bar";
    var input = document.createElement("input");
    input.className = "findly-instant-bar-input";
    input.type = "search";
    input.name = "q";
    input.setAttribute("role", "searchbox");
    input.setAttribute("autocomplete", "off");
    input.setAttribute("enterkeyhint", "search");
    input.setAttribute("aria-label", "Search");
    input.setAttribute("placeholder", "Search");
    bar.appendChild(input);
    var header = document.querySelector(
      "header, .header, .shopify-section-header, #shopify-section-header, [data-header]",
    );
    if (header) header.appendChild(bar);
    else if (document.body && document.body.firstChild) {
      document.body.insertBefore(bar, document.body.firstChild);
    } else if (document.body) {
      document.body.appendChild(bar);
    }
  }

  function ensureInstantRoot() {
    var existing = document.querySelector(".findly-instant");
    if (existing) return existing;
    var root = document.createElement("div");
    root.className = "findly-instant";
    root.setAttribute("hidden", "");
    root.setAttribute("data-proxy-base", "/apps/smart-filter");
    try {
      if (window.Shopify && window.Shopify.locale) {
        root.setAttribute("data-locale", String(window.Shopify.locale));
      }
      if (window.Shopify && window.Shopify.country) {
        root.setAttribute("data-country", String(window.Shopify.country));
      }
      if (
        window.Shopify &&
        window.Shopify.currency &&
        window.Shopify.currency.active
      ) {
        root.setAttribute("data-currency", String(window.Shopify.currency.active));
      }
    } catch (err) {
      /* ignore */
    }
    (document.body || document.documentElement).appendChild(root);
    return root;
  }

  function boot() {
    var roots = document.querySelectorAll(".findly-instant");
    if (!roots.length) {
      var created = ensureInstantRoot();
      if (!created) return;
      roots = [created];
    }
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
