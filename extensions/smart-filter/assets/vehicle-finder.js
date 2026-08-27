(function () {
  "use strict";

  var PLACEHOLDER = "-- Select --";
  var MSG_LOADING = "Loading…";
  var MSG_SEARCHING = "Searching…";
  var MSG_ERROR = "Vehicle finder could not be loaded. Please try again.";
  var MSG_NO_MATCH = "No matching products.";
  var MSG_NEED_SELECTION = "Select at least one field to search.";
  var DEBOUNCE_MS = 300;
  var EMPTY_MARKUP =
    '<h2 class="smart-filter-ymm__heading" data-ymm-heading></h2>' +
    '<input class="smart-filter-ymm__q" type="search" data-ymm-q placeholder="Search" autocomplete="off" hidden>' +
    '<div class="smart-filter-ymm__fields" data-ymm-fields></div>' +
    '<button type="button" class="smart-filter-ymm__search" data-ymm-search>SEARCH</button>' +
    '<div class="smart-filter-ymm__status" data-ymm-status aria-live="polite"></div>' +
    '<ul class="smart-filter-ymm__results" data-ymm-results role="list"></ul>';

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

  function isStructured(el) {
    return Boolean(
      el &&
        (el.querySelector("[data-ymm-fields]") ||
          el.querySelector("[data-ymm-search]") ||
          el.querySelector("[data-ymm-heading]")),
    );
  }

  function ensureMarkup(root) {
    if (isStructured(root)) return;
    root.classList.add("smart-filter-ymm");
    if (!root.getAttribute("data-proxy-base")) {
      root.setAttribute("data-proxy-base", "/apps/smart-filter");
    }
    root.innerHTML = EMPTY_MARKUP;
  }

  function applyStyles(root, styles) {
    if (!root || !styles) return;
    var map = {
      radius: "--ymm-radius",
      bg: "--ymm-bg",
      headingColor: "--ymm-heading",
      labelColor: "--ymm-label",
      borderColor: "--ymm-border",
      selectBg: "--ymm-select-bg",
      btnText: "--ymm-btn-text",
      btnBg: "--ymm-btn-bg",
    };
    Object.keys(map).forEach(function (key) {
      if (styles[key] == null || styles[key] === "") return;
      var value = styles[key];
      if (key === "radius") {
        value = typeof value === "number" || /^\d+(\.\d+)?$/.test(String(value))
          ? String(value) + "px"
          : String(value);
      }
      root.style.setProperty(map[key], String(value));
    });
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

  var partnerUpdateTimer = null;
  var partnerUpdateHandles = [];

  function reinitPartnerWidgetsFallback() {
    try {
      if (window.jdgm && typeof window.jdgm.customizeBadges === "function") {
        window.jdgm.customizeBadges();
      } else if (window.jdgm && typeof window.jdgm.preLoader === "function") {
        window.jdgm.preLoader();
      }
    } catch (err) {
      /* optional partner widget */
    }

    try {
      var heroButtons = document.querySelectorAll(".wishlist-hero-custom-button");
      var hi;
      for (hi = 0; hi < heroButtons.length; hi++) {
        document.dispatchEvent(
          new CustomEvent("wishlist-hero-add-to-custom-element", {
            bubbles: true,
            detail: heroButtons[hi],
          }),
        );
      }
    } catch (err) {
      /* optional partner widget */
    }

    try {
      if (
        window.frcp &&
        window.frcp.wishlist &&
        typeof window.frcp.wishlist.attachOnCollection === "function"
      ) {
        window.frcp.wishlist.attachOnCollection();
      }
    } catch (err) {
      /* optional partner widget */
    }

    try {
      if (window._swat && typeof window._swat.initializeActionButtons === "function") {
        window._swat.initializeActionButtons();
      }
    } catch (err) {
      /* optional partner widget */
    }

    try {
      if (window.Weglot && typeof window.Weglot.refresh === "function") {
        window.Weglot.refresh();
      }
    } catch (err) {
      /* optional partner widget */
    }

    try {
      if (window.Currency && typeof window.Currency.convertAll === "function") {
        window.Currency.convertAll(
          window.Currency.currentCurrency ||
            (window.Shopify &&
              window.Shopify.currency &&
              window.Shopify.currency.active) ||
            "USD",
        );
      }
    } catch (err) {
      /* optional currency converter */
    }
  }

  function reinitPartnerWidgets() {
    var api = window.__FINDLY_DOM;
    if (api && api.reinitPartnerWidgets) {
      api.reinitPartnerWidgets();
      return;
    }
    reinitPartnerWidgetsFallback();
  }

  function dispatchPartnerRenderEvents(handles) {
    var detail = { handles: handles || [] };
    window.dispatchEvent(
      new CustomEvent("findlyFilterRenderCompleted", {
        bubbles: true,
        detail: detail,
      }),
    );
    document.dispatchEvent(
      new CustomEvent("findlyFilterRenderCompleted", {
        bubbles: true,
        detail: detail,
      }),
    );
    reinitPartnerWidgets();
  }

  function dispatchUpdate(handles) {
    document.dispatchEvent(
      new CustomEvent("smart-filter:update", {
        bubbles: true,
        detail: { handles: handles || [] },
      }),
    );
    partnerUpdateHandles = handles || [];
    if (partnerUpdateTimer) {
      clearTimeout(partnerUpdateTimer);
    }
    partnerUpdateTimer = setTimeout(function () {
      partnerUpdateTimer = null;
      dispatchPartnerRenderEvents(partnerUpdateHandles);
    }, 0);
  }

  function YmmWidget(root) {
    ensureMarkup(root);
    this.root = root;
    this.headingEl = qs(root, "[data-ymm-heading]");
    this.searchEl = qs(root, "[data-ymm-q]");
    this.fieldsEl = qs(root, "[data-ymm-fields]");
    this.searchBtn = qs(root, "[data-ymm-search]");
    this.statusEl = qs(root, "[data-ymm-status]");
    this.resultsEl = qs(root, "[data-ymm-results]");
    this.proxyBase = (root.getAttribute("data-proxy-base") || "/apps/smart-filter").replace(
      /\/$/,
      "",
    );
    this.locale = root.getAttribute("data-locale") || "";
    this.fields = [];
    this.selects = [];
    this.products = [];
    this._didSearch = false;
    this._reqId = 0;
    this._abort = null;
  }

  YmmWidget.prototype.buildUrl = function (intent, values) {
    var params = new URLSearchParams();
    params.set("intent", intent);
    var shop = shopFromPage();
    if (shop) params.set("shop", shop);
    if (this.locale) params.set("locale", this.locale);
    (values || []).forEach(function (value) {
      if (value) params.append("v", value);
    });
    return this.proxyBase + "/ymm?" + params.toString();
  };

  YmmWidget.prototype.fetchJson = function (url) {
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

  YmmWidget.prototype.selectedValues = function (throughIndex) {
    var values = [];
    var end =
      typeof throughIndex === "number" ? throughIndex : this.selects.length - 1;
    for (var i = 0; i <= end && i < this.selects.length; i++) {
      var value = this.selects[i] ? String(this.selects[i].value || "").trim() : "";
      if (!value) break;
      values.push(value);
    }
    return values;
  };

  YmmWidget.prototype.clearSelect = function (select) {
    if (!select) return;
    select.innerHTML = "";
    var option = document.createElement("option");
    option.value = "";
    option.textContent = PLACEHOLDER;
    select.appendChild(option);
    select.value = "";
    select.disabled = true;
  };

  YmmWidget.prototype.fillSelect = function (select, options) {
    this.clearSelect(select);
    select.disabled = false;
    (options || []).forEach(function (item) {
      if (!item) return;
      var option = document.createElement("option");
      option.value = item.value != null ? String(item.value) : String(item.label || "");
      option.textContent = item.label != null ? String(item.label) : option.value;
      select.appendChild(option);
    });
  };

  YmmWidget.prototype.buildFields = function (fields) {
    var self = this;
    this.fields = Array.isArray(fields) ? fields : [];
    this.selects = [];
    if (!this.fieldsEl) return;
    this.fieldsEl.innerHTML = "";
    this.fields.forEach(function (field, index) {
      var wrap = document.createElement("label");
      wrap.className = "smart-filter-ymm__field";
      var caption = document.createElement("span");
      caption.className = "smart-filter-ymm__label";
      caption.textContent = field && field.label ? field.label : "Field " + (index + 1);
      var select = document.createElement("select");
      select.className = "smart-filter-ymm__select";
      select.setAttribute("data-ymm-select", String(index));
      select.setAttribute("data-field-id", field && field.id ? String(field.id) : "");
      self.clearSelect(select);
      wrap.appendChild(caption);
      wrap.appendChild(select);
      self.fieldsEl.appendChild(wrap);
      self.selects.push(select);
      select.addEventListener("change", function () {
        self.onSelectChange(index);
      });
    });
  };

  YmmWidget.prototype.onSelectChange = function (index) {
    var self = this;
    for (var i = index + 1; i < this.selects.length; i++) {
      this.clearSelect(this.selects[i]);
    }
    if (this.resultsEl) this.resultsEl.innerHTML = "";
    this.products = [];
    var selected = this.selectedValues(index);
    if (!selected.length || index >= this.selects.length - 1) return;
    var next = this.selects[index + 1];
    setStatus(this.statusEl, MSG_LOADING, false);
    this.fetchJson(this.buildUrl("options", selected))
      .then(function (payload) {
        self.fillSelect(next, payload && payload.options);
        setStatus(self.statusEl, "", false);
      })
      .catch(function () {
        setStatus(self.statusEl, MSG_ERROR, true);
      });
  };

  YmmWidget.prototype.loadFirstOptions = function () {
    var self = this;
    var first = this.selects[0];
    if (!first) return Promise.resolve();
    setStatus(this.statusEl, MSG_LOADING, false);
    return this.fetchJson(this.buildUrl("options", []))
      .then(function (payload) {
        self.fillSelect(first, payload && payload.options);
        setStatus(self.statusEl, "", false);
      })
      .catch(function () {
        setStatus(self.statusEl, MSG_ERROR, true);
      });
  };

  YmmWidget.prototype.renderProducts = function (products) {
    var list = this.resultsEl;
    if (!list) return;
    list.innerHTML = "";
    (products || []).forEach(function (item) {
      if (!item) return;
      var href = productUrl(item);
      if (!href) return;
      var li = document.createElement("li");
      li.className = "smart-filter-ymm__result";
      li.setAttribute("data-title", String(item.title || "").toLowerCase());
      li.setAttribute("data-handle", String(item.handle || "").toLowerCase());
      var link = document.createElement("a");
      link.className = "smart-filter-ymm__result-link";
      link.href = href;
      if (item.imageUrl) {
        var img = document.createElement("img");
        img.className = "smart-filter-ymm__result-image";
        img.src = item.imageUrl;
        img.alt = item.title || "";
        img.loading = "lazy";
        link.appendChild(img);
      }
      var meta = document.createElement("span");
      meta.className = "smart-filter-ymm__result-meta";
      var title = document.createElement("span");
      title.className = "smart-filter-ymm__result-title";
      title.textContent = item.title || item.handle || "";
      meta.appendChild(title);
      var price = formatPrice(item.priceMin);
      if (price) {
        var priceEl = document.createElement("span");
        priceEl.className = "smart-filter-ymm__result-price";
        priceEl.textContent = price;
        meta.appendChild(priceEl);
      }
      if (item.available === false) {
        var oos = document.createElement("span");
        oos.className = "smart-filter-ymm__result-oos";
        oos.textContent = "Sold out";
        meta.appendChild(oos);
      }
      link.appendChild(meta);
      li.appendChild(link);
      list.appendChild(li);
    });
    this.applyKeywordFilter();
  };

  YmmWidget.prototype.applyKeywordFilter = function (dispatch) {
    if (!this.resultsEl) return [];
    var query = this.searchEl ? String(this.searchEl.value || "").trim().toLowerCase() : "";
    var items = this.resultsEl.querySelectorAll("[data-title]");
    var visibleHandles = [];
    items.forEach(function (item) {
      var title = item.getAttribute("data-title") || "";
      var match = !query || title.indexOf(query) !== -1;
      setHidden(item, !match);
      if (match) {
        var handle = item.getAttribute("data-handle");
        if (handle) visibleHandles.push(handle);
      }
    });
    if (dispatch && this._didSearch) dispatchUpdate(visibleHandles);
    return visibleHandles;
  };

  YmmWidget.prototype.renderSkeletons = function (count) {
    var list = this.resultsEl;
    if (!list) return;
    list.innerHTML = "";
    var i;
    for (i = 0; i < (count || 4); i++) {
      var li = document.createElement("li");
      li.className = "smart-filter-ymm__result is-skeleton";
      li.setAttribute("aria-hidden", "true");
      li.innerHTML =
        '<span class="smart-filter-ymm__skel-img"></span>' +
        '<span class="smart-filter-ymm__skel-body">' +
        '<span class="smart-filter-ymm__skel-line"></span>' +
        '<span class="smart-filter-ymm__skel-line is-short"></span></span>';
      list.appendChild(li);
    }
  };

  YmmWidget.prototype.search = function () {
    var self = this;
    var selected = this.selectedValues();
    if (!selected.length) {
      setStatus(this.statusEl, MSG_NEED_SELECTION, true);
      return;
    }
    setStatus(this.statusEl, MSG_SEARCHING, false);
    this.renderSkeletons(4);
    var reqId = ++this._reqId;
    this.fetchJson(this.buildUrl("search", selected))
      .then(function (payload) {
        if (reqId !== self._reqId) return;
        var products = payload && Array.isArray(payload.products) ? payload.products : [];
        var handles =
          payload && Array.isArray(payload.handles)
            ? payload.handles
            : products.map(function (item) {
                return item && item.handle ? String(item.handle) : "";
              }).filter(Boolean);
        self.products = products;
        self._didSearch = true;
        self.renderProducts(products);
        var visible = self.applyKeywordFilter();
        dispatchUpdate(visible.length ? visible : handles);
        if (!products.length) {
          setStatus(self.statusEl, MSG_NO_MATCH, false);
        } else {
          setStatus(
            self.statusEl,
            products.length === 1 ? "1 product" : products.length + " products",
            false,
          );
        }
      })
      .catch(function () {
        if (reqId !== self._reqId) return;
        setStatus(self.statusEl, MSG_ERROR, true);
        if (self.resultsEl) self.resultsEl.innerHTML = "";
      });
  };

  YmmWidget.prototype.init = function () {
    var self = this;
    if (this.searchBtn) {
      this.searchBtn.addEventListener("click", function () {
        self.search();
      });
    }
    if (this.searchEl) {
      this.searchEl.addEventListener("input", function () {
        window.clearTimeout(self._filterTimer);
        self._filterTimer = 0;
        if (!String(self.searchEl.value || "").trim()) {
          self.applyKeywordFilter(true);
          return;
        }
        self._filterTimer = window.setTimeout(function () {
          self._filterTimer = 0;
          self.applyKeywordFilter(true);
        }, DEBOUNCE_MS);
      });
      this.searchEl.addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
          event.preventDefault();
          window.clearTimeout(self._filterTimer);
          self._filterTimer = 0;
          self.applyKeywordFilter(true);
          self.search();
        }
      });
      this.searchEl.addEventListener("blur", function () {
        if (!self._filterTimer) return;
        window.clearTimeout(self._filterTimer);
        self._filterTimer = 0;
        self.applyKeywordFilter(true);
      });
    }
    setStatus(this.statusEl, MSG_LOADING, false);
    return this.fetchJson(this.buildUrl("config", []))
      .then(function (config) {
        if (!config || !config.enabled) {
          self.root.setAttribute("hidden", "");
          return;
        }
        applyStyles(self.root, config.styles);
        if (self.headingEl) self.headingEl.textContent = config.heading || "";
        setHidden(self.searchEl, config.showSearch !== true);
        self.buildFields(config.fields);
        return self.loadFirstOptions();
      })
      .catch(function () {
        setStatus(self.statusEl, MSG_ERROR, true);
      });
  };

  function collectRoots() {
    var nodes = [];
    function add(el) {
      if (!el || nodes.indexOf(el) >= 0) return;
      if (el.getAttribute("data-ymm-ready") === "true") return;
      nodes.push(el);
    }
    document.querySelectorAll(".smart-filter-ymm, [data-ymm-root], #gf-form.smart-filter-ymm").forEach(add);
    var gf = document.getElementById("gf-form");
    if (gf && (gf.classList.contains("smart-filter-ymm") || isStructured(gf))) {
      add(gf);
    } else if (gf) {
      var siblingHasWidget = nodes.some(function (el) {
        return el !== gf && isStructured(el);
      });
      if (!siblingHasWidget) add(gf);
    }
    return nodes;
  }

  function boot() {
    collectRoots().forEach(function (root) {
      root.setAttribute("data-ymm-ready", "true");
      new YmmWidget(root).init();
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
