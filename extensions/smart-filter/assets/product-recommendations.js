(function () {
  "use strict";

  var STORAGE_KEY = "findly:recently-viewed";
  var MAX_RECENT = 20;
  var MSG_LOADING = "Loading…";
  var MSG_ERROR = "Recommendations could not be loaded. Please try again.";

  function runWhenIdle(fn) {
    var api = window.__FINDLY_DOM;
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
    var api = window.__FINDLY_DOM;
    if (api && api.qs) return api.qs(root, selector);
    return root.querySelector(selector);
  }

  function shopDomain() {
    var api = window.__FINDLY_DOM;
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

  function setHidden(el, hidden) {
    var api = window.__FINDLY_DOM;
    if (api && api.setHidden) {
      api.setHidden(el, hidden);
      return;
    }
    if (!el) return;
    if (hidden) el.setAttribute("hidden", "");
    else el.removeAttribute("hidden");
  }

  function setStatus(el, text, isError) {
    if (!el) return;
    el.textContent = text || "";
    if (isError) el.setAttribute("data-error", "true");
    else el.removeAttribute("data-error");
  }

  function shopFromPage() {
    return (window.Shopify && window.Shopify.shop) || "";
  }

  function breakpointKey() {
    var width = window.innerWidth;
    if (width < 750) return "mobile";
    if (width < 990) return "tablet";
    return "desktop";
  }

  function attrCount(root, key) {
    var n = Number(root.getAttribute("data-count-" + key) || "0");
    return Number.isFinite(n) && n > 0 ? Math.min(12, Math.round(n)) : 0;
  }

  function resolveLimit(root, counts) {
    var key = breakpointKey();
    var override = attrCount(root, key);
    if (override > 0) return override;
    if (counts && Number(counts[key]) > 0) {
      return Math.min(12, Math.round(Number(counts[key])));
    }
    return 4;
  }

  function formatPrice(value) {
    var currency =
      (window.Shopify &&
        window.Shopify.currency &&
        window.Shopify.currency.active) ||
      "USD";
    var api = window.__FINDLY_DOM;
    if (api && api.formatPrice) return api.formatPrice(value, currency);
    if (value == null || value === "") return "";
    var n = Number(value);
    if (!Number.isFinite(n)) return String(value);
    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: currency,
      }).format(n);
    } catch (err) {
      return String(n);
    }
  }

  function productUrl(item) {
    if (item && typeof item.url === "string" && item.url) return item.url;
    var handle = item && item.handle ? String(item.handle) : "";
    if (!handle) return "";
    return "/products/" + encodeURIComponent(handle);
  }

  function readRecentHandles(exclude) {
    var list = [];
    try {
      list = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]");
    } catch (err) {
      list = [];
    }
    if (!Array.isArray(list)) list = [];
    var skip = String(exclude || "").toLowerCase();
    var seen = {};
    var out = [];
    list.forEach(function (raw) {
      var handle = String(raw || "")
        .trim()
        .toLowerCase();
      if (!handle || handle === skip || seen[handle]) return;
      seen[handle] = true;
      out.push(handle);
    });
    return out;
  }

  function rememberView(handle) {
    var current = String(handle || "")
      .trim()
      .toLowerCase();
    if (!current) return;
    try {
      var next = [current].concat(
        readRecentHandles(current).filter(function (item) {
          return item !== current;
        }),
      );
      if (next.length > MAX_RECENT) next = next.slice(0, MAX_RECENT);
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch (err) {
      /* private mode / quota */
    }
  }

  function RecsWidget(root) {
    this.root = root;
    this.headingEl = qs(root, "[data-recs-heading]");
    this.statusEl = qs(root, "[data-recs-status]");
    this.resultsEl = qs(root, "[data-recs-results]");
    this.proxyBase = (root.getAttribute("data-proxy-base") || "/apps/smart-filter").replace(
      /\/$/,
      "",
    );
    this.type = root.getAttribute("data-type") || "new-products";
    this.locale = root.getAttribute("data-locale") || "";
    this.productHandle = (root.getAttribute("data-product-handle") || "")
      .trim()
      .toLowerCase();
    this.heading = root.getAttribute("data-heading") || "";
    this.products = [];
    this.counts = null;
    this._abort = null;
    this._reqId = 0;
  }

  RecsWidget.prototype.buildUrl = function (limit) {
    var params = new URLSearchParams();
    params.set("type", this.type);
    var shop = shopFromPage();
    if (shop) params.set("shop", shop);
    if (this.locale) params.set("locale", this.locale);
    if (this.productHandle) params.set("product", this.productHandle);
    params.set("limit", String(limit));
    if (this.type === "recently-viewed-products") {
      var handles = readRecentHandles(this.productHandle);
      if (handles.length) params.set("handles", handles.join(","));
    }
    return this.proxyBase + "/recs?" + params.toString();
  };

  RecsWidget.prototype.fetchJson = function (url) {
    if (this._abort) this._abort.abort();
    this._abort =
      typeof AbortController === "function" ? new AbortController() : null;
    var opts = {
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    };
    if (this._abort) opts.signal = this._abort.signal;
    return fetch(url, opts).then(function (response) {
      if (!response.ok) {
        throw new Error("Request failed (" + response.status + ")");
      }
      return response.json();
    });
  };

  RecsWidget.prototype.setColumns = function (limit) {
    if (!this.resultsEl) return;
    this.resultsEl.style.setProperty("--recs-cols", String(limit));
    this.root.style.setProperty("--recs-cols", String(limit));
  };

  RecsWidget.prototype.renderSkeletons = function (count) {
    var list = this.resultsEl;
    if (!list) return;
    list.innerHTML = "";
    this.setColumns(count || 4);
    var i;
    for (i = 0; i < (count || 4); i++) {
      var li = document.createElement("li");
      li.className = "smart-filter-recs__result is-skeleton";
      li.setAttribute("aria-hidden", "true");
      li.innerHTML =
        '<span class="smart-filter-recs__skel-img"></span>' +
        '<span class="smart-filter-recs__skel-line"></span>' +
        '<span class="smart-filter-recs__skel-line is-short"></span>';
      list.appendChild(li);
    }
  };

  RecsWidget.prototype.renderProducts = function (products, limit) {
    var list = this.resultsEl;
    if (!list) return;
    list.innerHTML = "";
    this.setColumns(limit);
    var proxyBase = this.proxyBase;
    (products || []).slice(0, limit).forEach(function (item) {
      if (!item) return;
      var href = productUrl(item);
      if (!href) return;
      var handle = item.handle ? String(item.handle) : "";
      var li = document.createElement("li");
      li.className = "smart-filter-recs__result";
      var link = document.createElement("a");
      link.className = "smart-filter-recs__result-link";
      link.href = href;
      link.addEventListener("click", function () {
        fireAnalytics(proxyBase, { kind: "visit", handle: handle });
      });
      if (item.imageUrl) {
        var img = document.createElement("img");
        img.className = "smart-filter-recs__result-image";
        img.src = item.imageUrl;
        img.alt = item.title || "";
        img.loading = "lazy";
        link.appendChild(img);
      }
      var meta = document.createElement("span");
      meta.className = "smart-filter-recs__result-meta";
      var title = document.createElement("span");
      title.className = "smart-filter-recs__result-title";
      title.textContent = item.title || item.handle || "";
      meta.appendChild(title);
      var price = formatPrice(item.priceMin);
      if (price) {
        var priceEl = document.createElement("span");
        priceEl.className = "smart-filter-recs__result-price";
        priceEl.textContent = price;
        meta.appendChild(priceEl);
      }
      if (item.available === false) {
        var oos = document.createElement("span");
        oos.className = "smart-filter-recs__result-oos";
        oos.textContent = "Sold out";
        meta.appendChild(oos);
      }
      link.appendChild(meta);
      li.appendChild(link);
      list.appendChild(li);
    });
  };

  RecsWidget.prototype.applyPayload = function (payload) {
    if (!payload || payload.enabled === false) {
      setHidden(this.root, true);
      return;
    }
    this.counts = payload.counts || this.counts;
    var limit = resolveLimit(this.root, this.counts);
    var products = Array.isArray(payload.products) ? payload.products : [];
    this.products = products;
    if (!products.length) {
      setHidden(this.root, true);
      return;
    }
    if (this.headingEl && this.heading) this.headingEl.textContent = this.heading;
    setHidden(this.root, false);
    this.renderProducts(products, limit);
    setStatus(this.statusEl, "", false);
  };

  RecsWidget.prototype.load = function () {
    var self = this;
    var override = attrCount(this.root, breakpointKey());
    var fetchLimit = override > 0 ? override : 12;
    var reqId = ++this._reqId;
    setStatus(this.statusEl, MSG_LOADING, false);
    setHidden(this.root, false);
    this.renderSkeletons(fetchLimit > 6 ? 6 : fetchLimit || 4);
    return this.fetchJson(this.buildUrl(fetchLimit))
      .then(function (payload) {
        if (reqId !== self._reqId) return;
        self.applyPayload(payload);
        rememberView(self.productHandle);
      })
      .catch(function () {
        if (reqId !== self._reqId) return;
        setStatus(self.statusEl, MSG_ERROR, true);
        if (self.resultsEl) self.resultsEl.innerHTML = "";
        rememberView(self.productHandle);
      });
  };

  RecsWidget.prototype.onResize = function () {
    if (!this.products.length || !this.counts) return;
    var limit = resolveLimit(this.root, this.counts);
    this.renderProducts(this.products, limit);
  };

  function boot() {
    var roots = document.querySelectorAll(".smart-filter-recs");
    var widgets = [];
    roots.forEach(function (root) {
      if (root.getAttribute("data-recs-ready") === "true") return;
      root.setAttribute("data-recs-ready", "true");
      var widget = new RecsWidget(root);
      widgets.push(widget);
      widget.load();
    });
    if (!widgets.length) return;
    var resizeTimer = 0;
    window.addEventListener("resize", function () {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(function () {
        widgets.forEach(function (widget) {
          widget.onResize();
        });
      }, 150);
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
