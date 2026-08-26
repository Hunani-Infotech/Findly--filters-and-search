(function () {
  "use strict";

  var DEBOUNCE_MS = 300;
  var MSG_LOADING = "Searching…";
  var MSG_ERROR = "Search could not be loaded. Please try again.";

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

  function qs(root, selector) {
    var api = domApi();
    if (api && api.qs) return api.qs(root, selector);
    return root.querySelector(selector);
  }

  function setHidden(el, hidden) {
    var api = domApi();
    if (api && api.setHidden) {
      api.setHidden(el, hidden);
      return;
    }
    if (!el) return;
    if (hidden) {
      el.setAttribute("hidden", "");
    } else {
      el.removeAttribute("hidden");
    }
  }

  function setStatus(el, text, isError) {
    if (!el) return;
    el.textContent = text || "";
    if (isError) {
      el.setAttribute("data-error", "true");
    } else {
      el.removeAttribute("data-error");
    }
  }

  function renderSearchSkeletons(list, count) {
    if (!list) return;
    list.innerHTML = "";
    var i;
    for (i = 0; i < (count || 5); i++) {
      var li = document.createElement("li");
      li.className = "smart-filter-search__item is-skeleton";
      li.setAttribute("aria-hidden", "true");
      li.innerHTML =
        '<span class="smart-filter-search__skel-img"></span>' +
        '<span class="smart-filter-search__skel-body">' +
        '<span class="smart-filter-search__skel-line"></span>' +
        '<span class="smart-filter-search__skel-line is-short"></span></span>';
      list.appendChild(li);
    }
  }

  function shopDomain() {
    var api = domApi();
    if (api && api.shopDomain) return api.shopDomain();
    return (window.Shopify && window.Shopify.shop) || "";
  }

  function deviceKind() {
    return window.innerWidth < 750 ? "mobile" : "desktop";
  }

  function uuidish() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }
    return (
      String(Date.now()) +
      "-" +
      Math.random().toString(16).slice(2) +
      "-" +
      Math.random().toString(16).slice(2)
    );
  }

  function visitorId() {
    var key = "findly:vid";
    try {
      var existing = window.localStorage.getItem(key);
      if (existing) return existing;
      var created = uuidish();
      window.localStorage.setItem(key, created);
      return created;
    } catch (err) {
      return uuidish();
    }
  }

  function fireAnalytics(proxyBase, fields) {
    var url =
      String(proxyBase || "/apps/smart-filter").replace(/\/$/, "") +
      "/analytics?kind=" +
      encodeURIComponent(fields.kind || "") +
      "&shop=" +
      encodeURIComponent(shopDomain());
    if (fields.q != null && fields.q !== "") {
      url += "&q=" + encodeURIComponent(fields.q);
    }
    if (fields.n != null) url += "&n=" + encodeURIComponent(String(fields.n));
    if (fields.combo) url += "&combo=" + encodeURIComponent(fields.combo);
    if (fields.handle) url += "&handle=" + encodeURIComponent(fields.handle);
    url +=
      "&v=" +
      encodeURIComponent(visitorId()) +
      "&d=" +
      encodeURIComponent(deviceKind());
    try {
      if (typeof navigator.sendBeacon === "function") {
        navigator.sendBeacon(url);
        return;
      }
    } catch (err) {
      /* fall through */
    }
    fetch(url, {
      method: "GET",
      keepalive: true,
      credentials: "same-origin",
      mode: "no-cors",
    }).catch(function () {});
  }

  function productUrl(item) {
    if (item && typeof item.url === "string" && item.url) return item.url;
    var handle = item && item.handle ? String(item.handle) : "";
    if (!handle) return "";
    return "/products/" + encodeURIComponent(handle);
  }

  function collectionUrl(item) {
    if (item && typeof item.url === "string" && item.url) return item.url;
    var handle = item && item.handle ? String(item.handle) : "";
    if (!handle) return "";
    return "/collections/" + encodeURIComponent(handle);
  }

  function productImage(item) {
    if (!item) return "";
    if (typeof item.image === "string" && item.image) return item.image;
    if (typeof item.imageUrl === "string" && item.imageUrl) return item.imageUrl;
    if (item.featuredImage) {
      if (typeof item.featuredImage === "string") return item.featuredImage;
      if (item.featuredImage.url) return String(item.featuredImage.url);
    }
    if (item.image && item.image.url) return String(item.image.url);
    return "";
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

  function extractProducts(payload) {
    if (!payload) return [];
    var list = payload.products || payload.results || payload.items;
    if (!Array.isArray(list)) return [];
    return list.filter(Boolean);
  }

  function extractSuggestions(payload) {
    if (!payload) return [];
    var list = payload.suggestions;
    if (!Array.isArray(list)) return [];
    return list.filter(Boolean);
  }

  function extractCollections(payload) {
    if (!payload) return [];
    var list = payload.collections;
    if (!Array.isArray(list)) return [];
    return list.filter(Boolean);
  }

  function SearchWidget(root) {
    this.root = root;
    this.formEl = qs(root, "[data-search-form]");
    this.inputEl = qs(root, "[data-search-input]");
    this.statusEl = qs(root, "[data-status]");
    this.emptyEl = qs(root, "[data-empty]");
    this.clearQueryEl = qs(root, "[data-clear-query]");
    this.resultsEl = qs(root, "[data-results]");
    this.suggestionsEl = qs(root, "[data-suggestions]");
    this.collectionsEl = qs(root, "[data-suggest-collections]");
    this.suggestHeadingEl = qs(root, "[data-suggest-heading]");
    this.submitEl = qs(root, "[data-search-submit]");
    this.proxyBase = (root.getAttribute("data-proxy-base") || "/apps/smart-filter").replace(
      /\/$/,
      "",
    );
    this.showImages = String(root.getAttribute("data-show-images") || "true") !== "false";
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
    this.i18n = {};
    this._timer = 0;
    this._reqId = 0;
    this._abort = null;
    this._didEmptyFocus = false;
  }

  SearchWidget.prototype.t = function (key, fallback) {
    var value = this.i18n && this.i18n[key];
    if (typeof value === "string" && value.trim()) return value;
    return fallback;
  };

  SearchWidget.prototype.applyI18n = function (payload) {
    this.i18n =
      payload && payload.i18n && typeof payload.i18n === "object"
        ? payload.i18n
        : {};

    if (this.emptyEl) {
      var heading = this.emptyEl.querySelector(
        ".smart-filter-search__empty-heading, h1, h2, h3, p",
      );
      var copy = this.emptyEl.querySelector(".smart-filter-search__empty-copy");
      if (heading) {
        heading.textContent = this.t(
          "search_empty",
          heading.textContent || "No products found",
        );
      }
      if (copy) {
        copy.textContent = this.t(
          "search_empty_copy",
          copy.textContent || "Your search did not match any products.",
        );
      }
    }
    if (this.clearQueryEl) {
      this.clearQueryEl.textContent = this.t(
        "search_clear",
        this.clearQueryEl.textContent || "Clear query",
      );
    }
    if (this.submitEl) {
      this.submitEl.textContent = this.t(
        "search_submit",
        this.submitEl.textContent || "Search",
      );
    }
    if (this.suggestHeadingEl) {
      this.suggestHeadingEl.textContent = this.t(
        "suggested",
        this.suggestHeadingEl.textContent || "Suggested",
      );
    }
  };

  SearchWidget.prototype.setEmptyVisible = function (visible) {
    if (!this.emptyEl) return;
    if (visible) {
      this.emptyEl.removeAttribute("hidden");
    } else {
      this.emptyEl.setAttribute("hidden", "");
    }
  };

  SearchWidget.prototype.hideSuggestions = function () {
    if (this.suggestionsEl) this.suggestionsEl.innerHTML = "";
    if (this.collectionsEl) this.collectionsEl.innerHTML = "";
    setHidden(this.suggestionsEl, true);
    setHidden(this.collectionsEl, true);
    setHidden(this.suggestHeadingEl, true);
  };

  SearchWidget.prototype.updateSuggestHeading = function () {
    var hasSuggestions =
      this.suggestionsEl &&
      this.suggestionsEl.children.length > 0 &&
      !this.suggestionsEl.hasAttribute("hidden");
    var hasCollections =
      this.collectionsEl &&
      this.collectionsEl.children.length > 0 &&
      !this.collectionsEl.hasAttribute("hidden");
    setHidden(this.suggestHeadingEl, !(hasSuggestions || hasCollections));
  };

  SearchWidget.prototype.clearResults = function () {
    if (this.resultsEl) this.resultsEl.innerHTML = "";
    this.hideSuggestions();
    this.setEmptyVisible(false);
    this.hideDidYouMean();
    setStatus(this.statusEl, "", false);
  };

  SearchWidget.prototype.ensureSpellEl = function () {
    if (this.spellEl) return this.spellEl;
    var el = document.createElement("p");
    el.className = "smart-filter-search__spell";
    el.hidden = true;
    var host = this.statusEl || this.emptyEl || this.resultsEl;
    if (host && host.parentNode) {
      host.parentNode.insertBefore(el, host);
    } else {
      this.root.insertBefore(el, this.root.firstChild);
    }
    this.spellEl = el;
    return el;
  };

  SearchWidget.prototype.hideDidYouMean = function () {
    if (!this.spellEl) return;
    this.spellEl.innerHTML = "";
    this.spellEl.hidden = true;
  };

  SearchWidget.prototype.renderDidYouMean = function (data) {
    var suggestion = String((data && data.didYouMean) || "").trim();
    var query = String(
      (this.inputEl ? this.inputEl.value : "") ||
        (data && data.query) ||
        "",
    ).trim();
    if (!suggestion || suggestion.toLowerCase() === query.toLowerCase()) {
      this.hideDidYouMean();
      return;
    }
    var el = this.ensureSpellEl();
    el.innerHTML = "";
    el.appendChild(
      document.createTextNode(this.t("did_you_mean", "Did you mean") + " "),
    );
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "smart-filter-search__spell-link";
    btn.textContent = suggestion;
    var self = this;
    btn.addEventListener("click", function () {
      if (self.inputEl) self.inputEl.value = suggestion;
      self.fetchSearch(suggestion);
    });
    el.appendChild(btn);
    el.hidden = false;
  };

  SearchWidget.prototype.renderProductList = function (container, items) {
    if (!container) return;
    container.innerHTML = "";
    if (!items || !items.length) {
      setHidden(container, true);
      return;
    }

    var self = this;
    var showImages = this.showImages;
    var fragment = document.createDocumentFragment();

    items.forEach(function (item) {
      var href = productUrl(item);
      var title = String(item.title || item.handle || "Product");
      var handle = item && item.handle ? String(item.handle) : "";
      var li = document.createElement("li");
      li.className = "smart-filter-search__item";
      li.setAttribute("role", "listitem");

      var link = document.createElement("a");
      link.className = "smart-filter-search__link";
      link.href = href || "#";
      link.addEventListener("click", function () {
        fireAnalytics(self.proxyBase, {
          kind: "click",
          handle: handle,
          q: self.inputEl ? String(self.inputEl.value || "").trim() : "",
        });
      });

      if (showImages) {
        var src = productImage(item);
        if (src) {
          var img = document.createElement("img");
          img.className = "smart-filter-search__image";
          img.src = src;
          img.alt = "";
          img.loading = "lazy";
          img.width = 48;
          img.height = 48;
          link.appendChild(img);
        }
      }

      var meta = document.createElement("span");
      meta.className = "smart-filter-search__meta";

      var name = document.createElement("span");
      name.className = "smart-filter-search__title";
      name.textContent = title;
      meta.appendChild(name);

      var priceText = formatPrice(
        item.priceMin != null ? item.priceMin : item.price,
        self.payloadCurrency || self.currency,
      );
      if (priceText) {
        var price = document.createElement("span");
        price.className = "smart-filter-search__price";
        price.textContent = priceText;
        meta.appendChild(price);
      }

      link.appendChild(meta);
      li.appendChild(link);
      fragment.appendChild(li);
    });

    container.appendChild(fragment);
    setHidden(container, false);
  };

  SearchWidget.prototype.renderCollections = function (items) {
    var container = this.collectionsEl;
    if (!container) return;
    container.innerHTML = "";
    if (!items || !items.length) {
      setHidden(container, true);
      return;
    }

    var fragment = document.createDocumentFragment();
    items.forEach(function (item) {
      var href = collectionUrl(item);
      var title = String((item && (item.title || item.handle)) || "Collection");
      var li = document.createElement("li");
      li.className = "smart-filter-search__item";
      li.setAttribute("role", "listitem");

      var link = document.createElement("a");
      link.className = "smart-filter-search__link";
      link.href = href || "#";

      var meta = document.createElement("span");
      meta.className = "smart-filter-search__meta";

      var name = document.createElement("span");
      name.className = "smart-filter-search__title";
      name.textContent = title;
      meta.appendChild(name);

      link.appendChild(meta);
      li.appendChild(link);
      fragment.appendChild(li);
    });

    container.appendChild(fragment);
    setHidden(container, false);
  };

  SearchWidget.prototype.renderSuggestions = function (suggestions, collections) {
    this.renderProductList(this.suggestionsEl, suggestions);
    this.renderCollections(collections);
    this.updateSuggestHeading();
  };

  SearchWidget.prototype.render = function (products) {
    if (!this.resultsEl) return;
    this.resultsEl.innerHTML = "";

    if (!products.length) {
      setStatus(this.statusEl, "", false);
      this.setEmptyVisible(true);
      return;
    }

    this.setEmptyVisible(false);
    setStatus(
      this.statusEl,
      products.length === 1 ? "1 product" : String(products.length) + " products",
      false,
    );
    this.renderProductList(this.resultsEl, products);
  };

  SearchWidget.prototype.applyPayload = function (data) {
    if (data && data.redirect) {
      window.location = data.redirect;
      return;
    }
    if (data && data.settings && data.settings.currency) {
      this.payloadCurrency = String(data.settings.currency);
    }
    var query = this.inputEl ? String(this.inputEl.value || "").trim() : "";
    var products = extractProducts(data);
    var suggestions = extractSuggestions(data);
    var collections = extractCollections(data);
    this.renderDidYouMean(data);

    if (!query) {
      this.hideDidYouMean();
      this.setEmptyVisible(false);
      if (this.resultsEl) this.resultsEl.innerHTML = "";
      if (!suggestions.length && !collections.length) {
        this.clearResults();
        return;
      }
      setStatus(this.statusEl, "", false);
      this.renderSuggestions(suggestions, collections);
      return;
    }

    fireAnalytics(this.proxyBase, {
      kind: "search",
      q: query,
      n: products.length,
    });

    if (products.length) {
      this.hideSuggestions();
      this.render(products);
      return;
    }

    if (this.resultsEl) this.resultsEl.innerHTML = "";
    setStatus(this.statusEl, "", false);
    this.setEmptyVisible(true);
    this.renderSuggestions(suggestions, collections);
  };

  SearchWidget.prototype.fetchSearch = function (query) {
    var reqId = ++this._reqId;
    if (this._abort) {
      this._abort.abort();
    }
    this._abort =
      typeof AbortController === "function" ? new AbortController() : null;

    this.setEmptyVisible(false);
    setStatus(this.statusEl, this.t("search_loading", MSG_LOADING), false);
    renderSearchSkeletons(this.resultsEl, 5);

    var url = this.proxyBase + "/search?q=" + encodeURIComponent(query);
    if (this.locale) {
      url += "&locale=" + encodeURIComponent(this.locale);
    }
    if (this.country) {
      url += "&country=" + encodeURIComponent(this.country);
    }
    if (this.currency) {
      url += "&currency=" + encodeURIComponent(this.currency);
    }
    if (this.companyLocation) {
      url += "&company_location=" + encodeURIComponent(this.companyLocation);
    }
    var opts = {
      credentials: "same-origin",
      cache: "no-store",
      headers: { Accept: "application/json" },
    };
    if (this._abort) opts.signal = this._abort.signal;

    return fetch(url, opts)
      .then(
        function (response) {
          if (!response.ok) {
            throw new Error("Request failed (" + response.status + ")");
          }
          return response.text();
        }.bind(this),
      )
      .then(
        function (raw) {
          if (reqId !== this._reqId) return;
          var data;
          try {
            data = raw ? JSON.parse(raw) : {};
          } catch (parseErr) {
            this.hideSuggestions();
            setStatus(this.statusEl, this.t("search_error", MSG_ERROR), true);
            this.setEmptyVisible(false);
            if (this.resultsEl) this.resultsEl.innerHTML = "";
            return;
          }
          this.applyI18n(data);
          this.applyPayload(data);
        }.bind(this),
      )
      .catch(
        function (err) {
          if (err && err.name === "AbortError") return;
          if (reqId !== this._reqId) return;
          this.hideSuggestions();
          this.setEmptyVisible(false);
          if (this.resultsEl) this.resultsEl.innerHTML = "";
          setStatus(this.statusEl, this.t("search_error", MSG_ERROR), true);
        }.bind(this),
      );
  };

  SearchWidget.prototype.runQuery = function () {
    var query = this.inputEl ? String(this.inputEl.value || "").trim() : "";
    this.fetchSearch(query);
  };

  SearchWidget.prototype.scheduleQuery = function () {
    var self = this;
    window.clearTimeout(this._timer);
    this._timer = window.setTimeout(function () {
      self.runQuery();
    }, DEBOUNCE_MS);
  };

  SearchWidget.prototype.clearQuery = function () {
    window.clearTimeout(this._timer);
    if (this.inputEl) {
      this.inputEl.value = "";
      this.inputEl.focus();
    }
    this._didEmptyFocus = true;
    this.fetchSearch("");
  };

  SearchWidget.prototype.init = function () {
    var self = this;
    this.setEmptyVisible(false);
    if (this.inputEl) {
      this.inputEl.addEventListener("input", function () {
        self.scheduleQuery();
      });
      this.inputEl.addEventListener("focus", function () {
        if (String(self.inputEl.value || "").trim()) return;
        if (self._didEmptyFocus) return;
        self._didEmptyFocus = true;
        self.scheduleQuery();
      });
    }
    if (this.formEl) {
      this.formEl.addEventListener("submit", function (event) {
        event.preventDefault();
        window.clearTimeout(self._timer);
        self.runQuery();
      });
    }
    if (this.clearQueryEl) {
      this.clearQueryEl.addEventListener("click", function () {
        self.clearQuery();
      });
    }
  };

  function boot() {
    var roots = document.querySelectorAll(".smart-filter-search");
    if (!roots.length) return;
    roots.forEach(function (root) {
      if (root.getAttribute("data-sf-search-ready") === "true") return;
      root.setAttribute("data-sf-search-ready", "true");
      new SearchWidget(root).init();
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
