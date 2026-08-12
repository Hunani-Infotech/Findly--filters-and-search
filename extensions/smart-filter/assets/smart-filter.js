/**
 * Findly Smart Filter — storefront widget
 * - Deferred via theme schema `javascript` + idle init (does not block LCP)
 * - Filter state: in-memory + optional `#sf=` hash via replaceState (no crawlable ?filter= URLs)
 */
(function () {
  "use strict";

  var HASH_KEY = "sf";
  var STRINGS = {
    loading: "Loading filters…",
    error: "Filters could not be loaded. Please try again.",
    empty: "No matching products.",
    disabled: "Filters are not enabled for this collection.",
    clear: "Clear filters",
    priceMin: "Min",
    priceMax: "Max",
    applyPrice: "Apply",
  };

  function whenIdle(fn) {
    if (typeof window.requestIdleCallback === "function") {
      window.requestIdleCallback(
        function () {
          fn();
        },
        { timeout: 2000 }
      );
      return;
    }
    window.setTimeout(fn, 0);
  }

  function onReady(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", function () {
        whenIdle(fn);
      });
    } else {
      whenIdle(fn);
    }
  }

  function qs(el, sel) {
    return el.querySelector(sel);
  }

  function setStatus(el, message, isError) {
    if (!el) return;
    el.textContent = message || "";
    if (isError) {
      el.setAttribute("data-error", "true");
    } else {
      el.removeAttribute("data-error");
    }
  }

  function parseHandles(payload) {
    if (!payload) return [];

    if (Array.isArray(payload.handles)) {
      return payload.handles.map(String);
    }

    if (Array.isArray(payload.products)) {
      return payload.products
        .map(function (item) {
          if (typeof item === "string") return item;
          if (item && item.handle) return String(item.handle);
          return null;
        })
        .filter(Boolean);
    }

    return [];
  }

  function normalizeFacets(payload) {
    var facets = (payload && payload.facets) || [];
    if (!Array.isArray(facets)) return [];

    return facets
      .map(function (facet) {
        var key = String(facet.key || facet.id || "");
        var type = String(facet.type || "checkbox").toLowerCase();
        var source = String(facet.source || "").toLowerCase();
        var isPrice =
          type === "price" ||
          type === "price_range" ||
          type === "range" ||
          source === "price" ||
          key === "price";

        var range = facet.range || {};
        return {
          key: key,
          label: facet.label || facet.name || key,
          type: isPrice ? "price_range" : "list",
          source: source,
          values: Array.isArray(facet.values) ? facet.values : [],
          min: Number(
            range.min != null
              ? range.min
              : facet.min != null
                ? facet.min
                : 0
          ),
          max: Number(
            range.max != null
              ? range.max
              : facet.max != null
                ? facet.max
                : 0
          ),
        };
      })
      .filter(function (facet) {
        return Boolean(facet.key);
      });
  }

  function extractHandleFromHref(href) {
    if (!href) return null;
    try {
      var url = new URL(href, window.location.origin);
      var match = url.pathname.match(/\/products\/([^/?#]+)/i);
      return match ? decodeURIComponent(match[1]) : null;
    } catch (e) {
      return null;
    }
  }

  function findProductCard(anchor) {
    return (
      anchor.closest(
        [
          "[data-product-id]",
          ".product-card",
          ".card-wrapper",
          ".grid__item",
          ".product-grid-item",
          "li",
          "article",
        ].join(", ")
      ) || anchor
    );
  }

  function applyProductVisibility(handles) {
    var allow = null;
    if (Array.isArray(handles)) {
      allow = {};
      handles.forEach(function (handle) {
        allow[String(handle).toLowerCase()] = true;
      });
    }

    var anchors = document.querySelectorAll('a[href*="/products/"]');
    var seen = typeof WeakSet !== "undefined" ? new WeakSet() : null;
    var seenFallback = seen ? null : [];

    anchors.forEach(function (anchor) {
      var handle = extractHandleFromHref(anchor.getAttribute("href"));
      if (!handle) return;

      var card = findProductCard(anchor);
      if (seen) {
        if (seen.has(card)) return;
        seen.add(card);
      } else if (seenFallback.indexOf(card) !== -1) {
        return;
      } else {
        seenFallback.push(card);
      }

      if (!allow) {
        card.hidden = false;
        card.removeAttribute("data-smart-filter-hidden");
        return;
      }

      var visible = Boolean(allow[handle.toLowerCase()]);
      card.hidden = !visible;
      if (visible) {
        card.removeAttribute("data-smart-filter-hidden");
      } else {
        card.setAttribute("data-smart-filter-hidden", "true");
      }
    });
  }

  function dispatchUpdate(handles) {
    document.dispatchEvent(
      new CustomEvent("smart-filter:update", {
        detail: { handles: handles || [] },
      })
    );
  }

  /** Encode selected filters into compact #sf= payload (not indexed like query params). */
  function encodeHashState(selected, price) {
    var parts = [];
    Object.keys(selected)
      .sort()
      .forEach(function (key) {
        var values = selected[key];
        if (!values || !values.length) return;
        parts.push(
          encodeURIComponent(key) +
            ":" +
            values.map(encodeURIComponent).join(",")
        );
      });
    if (price.min !== "" || price.max !== "") {
      parts.push(
        "price:" +
          encodeURIComponent(price.min === "" ? "" : String(price.min)) +
          "," +
          encodeURIComponent(price.max === "" ? "" : String(price.max))
      );
    }
    return parts.join("|");
  }

  function parseHashState(hash) {
    var raw = String(hash || "").replace(/^#/, "");
    if (!raw) return null;

    var params = new URLSearchParams(raw.indexOf("=") === -1 ? "" : raw);
    var payload = params.get(HASH_KEY);
    if (payload == null && raw.indexOf(HASH_KEY + "=") === 0) {
      payload = decodeURIComponent(raw.slice(HASH_KEY.length + 1));
    } else if (payload == null && raw.indexOf(":") !== -1 && raw.indexOf("=") === -1) {
      // bare sf-style fragment without key
      payload = raw;
    }

    if (!payload) return null;

    var selected = {};
    var price = { min: "", max: "" };
    var segments = String(payload).split("|");

    segments.forEach(function (segment) {
      if (!segment) return;
      var colon = segment.indexOf(":");
      if (colon === -1) return;
      var key = decodeURIComponent(segment.slice(0, colon));
      var valuePart = segment.slice(colon + 1);
      var values = valuePart.split(",").map(function (v) {
        try {
          return decodeURIComponent(v);
        } catch (e) {
          return v;
        }
      });

      if (key === "price") {
        price.min = values[0] != null ? values[0] : "";
        price.max = values[1] != null ? values[1] : "";
        return;
      }

      selected[key] = values.filter(function (v) {
        return v !== "";
      });
    });

    return { selected: selected, price: price };
  }

  /**
   * Persist filter UI state in the hash only (replaceState).
   * Never writes ?filter= (or similar) query params onto the page URL.
   */
  function syncHashToLocation(selected, price) {
    var encoded = encodeHashState(selected, price);
    var url = new URL(window.location.href);
    var nextHash = encoded ? HASH_KEY + "=" + encoded : "";

    if ((url.hash || "").replace(/^#/, "") === nextHash) return;

    var pathSearch = url.pathname + url.search;
    var next = nextHash ? pathSearch + "#" + nextHash : pathSearch;
    window.history.replaceState(window.history.state, "", next);
  }

  function SmartFilter(root) {
    this.root = root;
    this.facetsEl = qs(root, "[data-facets]");
    this.statusEl = qs(root, "[data-status]");
    this.proxyBase = (
      root.getAttribute("data-proxy-base") || "/apps/smart-filter"
    ).replace(/\/$/, "");
    this.collectionId = root.getAttribute("data-collection-id") || "";
    this.position = root.getAttribute("data-position") || "left";
    this.showCounts =
      String(root.getAttribute("data-show-counts") || "true") !== "false";
    this.selected = {};
    this.price = { min: "", max: "" };
    this.facets = [];
    this._reqId = 0;

    root.classList.add("smart-filter--" + this.position);
    root.setAttribute("data-position", this.position);
  }

  SmartFilter.prototype.restoreFromHash = function () {
    var state = parseHashState(window.location.hash);
    if (!state) return;
    this.selected = state.selected || {};
    this.price = state.price || { min: "", max: "" };
  };

  SmartFilter.prototype.buildProxyUrl = function () {
    var params = new URLSearchParams();
    if (this.collectionId) {
      params.set("collection_id", this.collectionId);
    }

    Object.keys(this.selected).forEach(
      function (key) {
        var values = this.selected[key];
        if (values && values.length) {
          params.set("f." + key, values.join(","));
        }
      }.bind(this)
    );

    if (this.price.min !== "" || this.price.max !== "") {
      params.set(
        "f.price",
        [
          this.price.min === "" ? "" : this.price.min,
          this.price.max === "" ? "" : this.price.max,
        ].join(",")
      );
    }

    return this.proxyBase + "/filters?" + params.toString();
  };

  SmartFilter.prototype.fetchFilters = function () {
    var reqId = ++this._reqId;
    setStatus(this.statusEl, STRINGS.loading, false);
    syncHashToLocation(this.selected, this.price);

    return fetch(this.buildProxyUrl(), {
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    })
      .then(
        function (response) {
          if (!response.ok) {
            throw new Error("Request failed (" + response.status + ")");
          }
          return response.json();
        }.bind(this)
      )
      .then(
        function (payload) {
          if (reqId !== this._reqId) return;

          if (payload && payload.enabled === false) {
            this.facets = [];
            if (this.facetsEl) this.facetsEl.innerHTML = "";
            applyProductVisibility(null);
            dispatchUpdate([]);
            setStatus(this.statusEl, STRINGS.disabled, false);
            return;
          }

          this.facets = normalizeFacets(payload);
          var handles = parseHandles(payload);
          this.renderFacets();
          applyProductVisibility(handles);
          dispatchUpdate(handles);

          if (!handles.length && this.hasActiveFilters()) {
            setStatus(this.statusEl, STRINGS.empty, false);
          } else {
            var count =
              typeof payload.total === "number"
                ? payload.total
                : typeof payload.count === "number"
                  ? payload.count
                  : handles.length;
            setStatus(
              this.statusEl,
              count ? String(count) + " products" : "",
              false
            );
          }
        }.bind(this)
      )
      .catch(
        function () {
          if (reqId !== this._reqId) return;
          setStatus(this.statusEl, STRINGS.error, true);
          if (this.facetsEl && !this.facetsEl.childElementCount) {
            this.facetsEl.innerHTML = "";
          }
        }.bind(this)
      );
  };

  SmartFilter.prototype.hasActiveFilters = function () {
    var hasList = Object.keys(this.selected).some(
      function (key) {
        return this.selected[key] && this.selected[key].length > 0;
      }.bind(this)
    );
    return hasList || this.price.min !== "" || this.price.max !== "";
  };

  SmartFilter.prototype.toggleValue = function (key, value, checked) {
    if (!this.selected[key]) this.selected[key] = [];
    var list = this.selected[key];
    var idx = list.indexOf(value);

    if (checked && idx === -1) {
      list.push(value);
    } else if (!checked && idx !== -1) {
      list.splice(idx, 1);
    }

    if (!list.length) delete this.selected[key];
    this.fetchFilters();
  };

  SmartFilter.prototype.clearFilters = function () {
    this.selected = {};
    this.price = { min: "", max: "" };
    this.fetchFilters();
  };

  SmartFilter.prototype.renderFacets = function () {
    if (!this.facetsEl) return;
    this.facetsEl.innerHTML = "";

    this.facets.forEach(
      function (facet) {
        var section = document.createElement("div");
        section.className = "smart-filter__facet";
        section.setAttribute("data-facet-key", facet.key);

        var label = document.createElement("span");
        label.className = "smart-filter__facet-label";
        label.textContent = facet.label;
        section.appendChild(label);

        if (facet.type === "price_range") {
          section.appendChild(this.renderPriceFacet(facet));
        } else {
          section.appendChild(this.renderListFacet(facet));
        }

        this.facetsEl.appendChild(section);
      }.bind(this)
    );

    if (this.hasActiveFilters()) {
      var clearBtn = document.createElement("button");
      clearBtn.type = "button";
      clearBtn.className = "smart-filter__btn smart-filter__clear";
      clearBtn.textContent = STRINGS.clear;
      clearBtn.addEventListener(
        "click",
        function () {
          this.clearFilters();
        }.bind(this)
      );
      this.facetsEl.appendChild(clearBtn);
    }
  };

  SmartFilter.prototype.renderListFacet = function (facet) {
    var list = document.createElement("ul");
    list.className = "smart-filter__options";

    var selected = this.selected[facet.key] || [];
    var showCounts = this.showCounts;

    facet.values.forEach(
      function (item) {
        var value = String(
          item.value != null
            ? item.value
            : item.handle != null
              ? item.handle
              : item.label || item
        );
        var text = String(item.label != null ? item.label : value);
        var count = item.count;

        var li = document.createElement("li");
        var option = document.createElement("label");
        option.className = "smart-filter__option";

        var input = document.createElement("input");
        input.type = "checkbox";
        input.name = "sf." + facet.key;
        input.value = value;
        input.checked = selected.indexOf(value) !== -1;

        input.addEventListener(
          "change",
          function (event) {
            this.toggleValue(facet.key, value, event.target.checked);
          }.bind(this)
        );

        var textEl = document.createElement("span");
        textEl.className = "smart-filter__option-text";
        textEl.textContent = text;

        option.appendChild(input);
        option.appendChild(textEl);

        if (showCounts && typeof count === "number") {
          var countEl = document.createElement("span");
          countEl.className = "smart-filter__option-count";
          countEl.textContent = String(count);
          option.appendChild(countEl);
        }

        li.appendChild(option);
        list.appendChild(li);
      }.bind(this)
    );

    return list;
  };

  SmartFilter.prototype.renderPriceFacet = function (facet) {
    var wrap = document.createElement("div");
    wrap.className = "smart-filter__price";

    var minField = document.createElement("div");
    minField.className = "smart-filter__price-field";
    var minLabel = document.createElement("span");
    minLabel.className = "smart-filter__field-label";
    minLabel.textContent = STRINGS.priceMin;
    var minInput = document.createElement("input");
    minInput.type = "number";
    minInput.inputMode = "decimal";
    minInput.min = String(facet.min || 0);
    if (facet.max) minInput.max = String(facet.max);
    minInput.placeholder = String(facet.min || 0);
    minInput.value = this.price.min;
    minField.appendChild(minLabel);
    minField.appendChild(minInput);

    var maxField = document.createElement("div");
    maxField.className = "smart-filter__price-field";
    var maxLabel = document.createElement("span");
    maxLabel.className = "smart-filter__field-label";
    maxLabel.textContent = STRINGS.priceMax;
    var maxInput = document.createElement("input");
    maxInput.type = "number";
    maxInput.inputMode = "decimal";
    maxInput.min = String(facet.min || 0);
    if (facet.max) maxInput.max = String(facet.max);
    maxInput.placeholder = facet.max ? String(facet.max) : "";
    maxInput.value = this.price.max;
    maxField.appendChild(maxLabel);
    maxField.appendChild(maxInput);

    var actions = document.createElement("div");
    actions.className = "smart-filter__price-actions";
    var applyBtn = document.createElement("button");
    applyBtn.type = "button";
    applyBtn.className = "smart-filter__btn smart-filter__btn--primary";
    applyBtn.textContent = STRINGS.applyPrice;

    applyBtn.addEventListener(
      "click",
      function () {
        this.price.min = minInput.value.trim();
        this.price.max = maxInput.value.trim();
        this.fetchFilters();
      }.bind(this)
    );

    actions.appendChild(applyBtn);
    wrap.appendChild(minField);
    wrap.appendChild(maxField);
    wrap.appendChild(actions);
    return wrap;
  };

  SmartFilter.prototype.init = function () {
    if (!this.collectionId) {
      setStatus(this.statusEl, STRINGS.error, true);
      return;
    }
    this.restoreFromHash();
    this.fetchFilters();
  };

  onReady(function () {
    var root = document.getElementById("smart-filter-root");
    if (!root) return;
    new SmartFilter(root).init();
  });
})();
