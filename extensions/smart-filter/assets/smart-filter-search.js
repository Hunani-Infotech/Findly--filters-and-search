(function () {
  "use strict";

  var DEBOUNCE_MS = 300;
  var MSG_LOADING = "Searching…";
  var MSG_ERROR = "Search could not be loaded. Please try again.";

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

  function qs(root, selector) {
    return root.querySelector(selector);
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

  function productUrl(item) {
    if (item && typeof item.url === "string" && item.url) return item.url;
    var handle = item && item.handle ? String(item.handle) : "";
    if (!handle) return "";
    return "/products/" + encodeURIComponent(handle);
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

  function formatPrice(value) {
    if (value == null || value === "") return "";
    var n = Number(value);
    if (!Number.isFinite(n)) return String(value);
    var currency =
      (window.Shopify &&
        window.Shopify.currency &&
        window.Shopify.currency.active) ||
      "USD";
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

  function SearchWidget(root) {
    this.root = root;
    this.formEl = qs(root, "[data-search-form]");
    this.inputEl = qs(root, "[data-search-input]");
    this.statusEl = qs(root, "[data-status]");
    this.emptyEl = qs(root, "[data-empty]");
    this.clearQueryEl = qs(root, "[data-clear-query]");
    this.resultsEl = qs(root, "[data-results]");
    this.proxyBase = (root.getAttribute("data-proxy-base") || "/apps/smart-filter").replace(
      /\/$/,
      "",
    );
    this.showImages = String(root.getAttribute("data-show-images") || "true") !== "false";
    this._timer = 0;
    this._reqId = 0;
    this._abort = null;
  }

  SearchWidget.prototype.setEmptyVisible = function (visible) {
    if (!this.emptyEl) return;
    if (visible) {
      this.emptyEl.removeAttribute("hidden");
    } else {
      this.emptyEl.setAttribute("hidden", "");
    }
  };

  SearchWidget.prototype.clearResults = function () {
    if (this.resultsEl) this.resultsEl.innerHTML = "";
    this.setEmptyVisible(false);
    setStatus(this.statusEl, "", false);
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

    var showImages = this.showImages;
    var fragment = document.createDocumentFragment();

    products.forEach(function (item) {
      var href = productUrl(item);
      var title = String(item.title || item.handle || "Product");
      var li = document.createElement("li");
      li.className = "smart-filter-search__item";
      li.setAttribute("role", "listitem");

      var link = document.createElement("a");
      link.className = "smart-filter-search__link";
      link.href = href || "#";

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

    this.resultsEl.appendChild(fragment);
  };

  SearchWidget.prototype.fetchSearch = function (query) {
    var reqId = ++this._reqId;
    if (this._abort) {
      try {
        this._abort.abort();
      } catch (err) {}
    }
    this._abort =
      typeof AbortController === "function" ? new AbortController() : null;

    this.setEmptyVisible(false);
    setStatus(this.statusEl, MSG_LOADING, false);

    var url = this.proxyBase + "/search?q=" + encodeURIComponent(query);
    var opts = {
      credentials: "same-origin",
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
            setStatus(this.statusEl, MSG_ERROR, true);
            this.setEmptyVisible(false);
            if (this.resultsEl) this.resultsEl.innerHTML = "";
            return;
          }
          this.render(extractProducts(data));
        }.bind(this),
      )
      .catch(
        function (err) {
          if (err && err.name === "AbortError") return;
          if (reqId !== this._reqId) return;
          this.setEmptyVisible(false);
          if (this.resultsEl) this.resultsEl.innerHTML = "";
          setStatus(this.statusEl, MSG_ERROR, true);
        }.bind(this),
      );
  };

  SearchWidget.prototype.runQuery = function () {
    var query = this.inputEl ? String(this.inputEl.value || "").trim() : "";
    if (!query) {
      this._reqId += 1;
      if (this._abort) {
        try {
          this._abort.abort();
        } catch (err) {}
      }
      this.clearResults();
      return;
    }
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
    this._reqId += 1;
    if (this._abort) {
      try {
        this._abort.abort();
      } catch (err) {}
    }
    if (this.inputEl) {
      this.inputEl.value = "";
      this.inputEl.focus();
    }
    this.clearResults();
  };

  SearchWidget.prototype.init = function () {
    var self = this;
    this.setEmptyVisible(false);
    if (this.inputEl) {
      this.inputEl.addEventListener("input", function () {
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
