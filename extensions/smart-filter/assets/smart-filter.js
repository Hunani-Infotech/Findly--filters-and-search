(function () {
  "use strict";

  var HASH_KEY = "sf";
  var MSG_LOADING = "Loading filters…";
  var MSG_ERROR = "Filters could not be loaded. Please try again.";
  var MSG_NO_MATCH = "No matching products.";
  var MSG_DISABLED = "Filters are not enabled for this collection.";
  var MSG_CLEAR = "Clear filters";
  var MSG_MIN = "Min";
  var MSG_MAX = "Max";
  var MSG_APPLY = "Apply";
  var POSITIONS = { left: true, right: true, top: true };
  var CARD_SELECTOR = [
    "[data-product-id]",
    ".product-card",
    ".card-wrapper",
    ".grid__item",
    ".product-grid-item",
    "li",
    "article",
  ].join(", ");

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

  function hashHue(value) {
    var hash = 2166136261;
    var text = String(value || "").toLowerCase();
    for (var i = 0; i < text.length; i++) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return Math.abs(hash) % 360;
  }

  function swatchColor(value) {
    var raw = String(value || "").trim();
    if (!raw) return "";
    if (
      /^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(raw) ||
      /^(rgb|rgba|hsl|hsla)\(/i.test(raw)
    ) {
      return raw;
    }
    if (/^[a-z]{3,24}$/i.test(raw) && looksLikeCssColor(raw)) return raw;
    return "hsl(" + hashHue(raw) + ", 58%, 52%)";
  }

  function isColorFacet(facet) {
    if (/colou?r|hue|shade/i.test(String(facet.label || facet.key || ""))) {
      return true;
    }
    var values = facet.values || [];
    if (values.length < 2) return false;
    var colorish = 0;
    values.forEach(function (item) {
      var text = String(item.value != null ? item.value : item.label || "");
      if (
        /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(text) ||
        (/^[a-z]{3,24}$/i.test(text) && looksLikeCssColor(text))
      ) {
        colorish += 1;
      }
    });
    return colorish / values.length >= 0.5;
  }

  function sizeRank(raw) {
    var value = String(raw || "")
      .trim()
      .toLowerCase();
    if (!value) return null;
    var numeric = value.match(/^(\d+(\.\d+)?)/);
    if (numeric) return 1000 + Number(numeric[1]);
    var small = value.match(/^(x*)s$/);
    if (small) return 40 - small[1].length;
    if (value === "m") return 50;
    var large = value.match(/^(x*)l$/);
    if (large) return 60 + large[1].length;
    var numbered = value.match(/^(\d+)\s*x?l$/);
    if (numbered) return 60 + Number(numbered[1]);
    return null;
  }

  function isSizeFacet(facet) {
    if (/size|length|width/i.test(String(facet.label || facet.key || ""))) {
      return true;
    }
    var values = facet.values || [];
    if (!values.length) return false;
    var sized = 0;
    values.forEach(function (item) {
      if (sizeRank(String(item.value != null ? item.value : item.label || "")) != null) {
        sized += 1;
      }
    });
    return sized / values.length >= 0.6;
  }

  function sortSizeValues(values) {
    return values.slice().sort(function (a, b) {
      var av = String(a.value != null ? a.value : a.label || "");
      var bv = String(b.value != null ? b.value : b.label || "");
      var ar = sizeRank(av);
      var br = sizeRank(bv);
      if (ar != null && br != null) return ar - br;
      if (ar != null) return -1;
      if (br != null) return 1;
      return av.localeCompare(bv, undefined, { numeric: true, sensitivity: "base" });
    });
  }

  function looksLikeCssColor(value) {
    if (typeof value !== "string") return false;
    var color = value.trim();
    if (!color || color.length > 64) return false;
    if (
      /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(
        color,
      )
    ) {
      return true;
    }
    if (/^(rgb|rgba|hsl|hsla)\(\s*[\d.%+\-\s,/]+\)$/i.test(color)) {
      return true;
    }
    return /^[a-zA-Z][a-zA-Z-]{1,30}$/.test(color);
  }

  function handleFromHref(href) {
    if (!href) return null;
    try {
      var match = new URL(href, window.location.origin).pathname.match(
        /\/products\/([^/?#]+)/i,
      );
      return match ? decodeURIComponent(match[1]) : null;
    } catch (err) {
      return null;
    }
  }

  function closestProductCard(link) {
    return link.closest(CARD_SELECTOR) || link;
  }

  function applyProductVisibility(handles) {
    var allowed = null;
    if (Array.isArray(handles)) {
      allowed = {};
      handles.forEach(function (handle) {
        allowed[String(handle).toLowerCase()] = true;
      });
    }

    var links = document.querySelectorAll('a[href*="/products/"]');
    var seen = typeof WeakSet !== "undefined" ? new WeakSet() : null;
    var seenList = seen ? null : [];

    links.forEach(function (link) {
      var handle = handleFromHref(link.getAttribute("href"));
      if (!handle) return;

      var card = closestProductCard(link);
      if (seen) {
        if (seen.has(card)) return;
        seen.add(card);
      } else {
        if (seenList.indexOf(card) !== -1) return;
        seenList.push(card);
      }

      if (!allowed) {
        card.hidden = false;
        card.removeAttribute("data-smart-filter-hidden");
        return;
      }

      var visible = Boolean(allowed[handle.toLowerCase()]);
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
      }),
    );
  }

  function serializeState(selected, price) {
    var parts = [];
    Object.keys(selected)
      .sort()
      .forEach(function (key) {
        var values = selected[key];
        if (values && values.length) {
          parts.push(
            encodeURIComponent(key) +
              ":" +
              values.map(encodeURIComponent).join(","),
          );
        }
      });
    if (!(price.min === "" && price.max === "")) {
      parts.push(
        "price:" +
          encodeURIComponent(price.min === "" ? "" : String(price.min)) +
          "," +
          encodeURIComponent(price.max === "" ? "" : String(price.max)),
      );
    }
    return parts.join("|");
  }

  function writeHash(selected, price) {
    var encoded = serializeState(selected, price);
    var url = new URL(window.location.href);
    var nextHash = encoded ? HASH_KEY + "=" + encoded : "";
    if ((url.hash || "").replace(/^#/, "") !== nextHash) {
      var path = url.pathname + url.search;
      var href = nextHash ? path + "#" + nextHash : path;
      window.history.replaceState(window.history.state, "", href);
    }
  }

  function parseHash(hash) {
    var raw = String(hash || "").replace(/^#/, "");
    if (!raw) return null;

    var payload = new URLSearchParams(raw.indexOf("=") === -1 ? "" : raw).get(
      HASH_KEY,
    );
    if (payload == null && raw.indexOf("sf=") === 0) {
      payload = decodeURIComponent(raw.slice(3));
    } else if (
      payload == null &&
      raw.indexOf(":") !== -1 &&
      raw.indexOf("=") === -1
    ) {
      payload = raw;
    }
    if (!payload) return null;

    var selected = {};
    var price = { min: "", max: "" };

    String(payload)
      .split("|")
      .forEach(function (part) {
        if (!part) return;
        var colon = part.indexOf(":");
        if (colon === -1) return;
        var key = decodeURIComponent(part.slice(0, colon));
        var values = part
          .slice(colon + 1)
          .split(",")
          .map(function (value) {
            try {
              return decodeURIComponent(value);
            } catch (err) {
              return value;
            }
          });
        if (key === "price") {
          price.min = values[0] != null ? values[0] : "";
          price.max = values[1] != null ? values[1] : "";
          return;
        }
        selected[key] = values.filter(function (value) {
          return value !== "";
        });
      });

    return { selected: selected, price: price };
  }

  function normalizeFacets(payload) {
    var list = payload && payload.facets ? payload.facets : [];
    if (!Array.isArray(list)) return [];

    return list
      .map(function (facet) {
        var key = String(facet.key || facet.id || "");
        var type = String(facet.type || "checkbox").toLowerCase();
        var source = String(facet.source || "").toLowerCase();
        var isProductPrice = source === "price" || key === "price";
        var isRange =
          isProductPrice || type === "price" || type === "price_range" || type === "range";
        var range = facet.range || {};
        return {
          key: key,
          label: facet.label || facet.name || key,
          type: isRange ? "price_range" : "list",
          isProductPrice: isProductPrice,
          source: source,
          values: Array.isArray(facet.values) ? facet.values : [],
          min: Number(
            range.min != null ? range.min : facet.min != null ? facet.min : NaN,
          ),
          max: Number(
            range.max != null ? range.max : facet.max != null ? facet.max : NaN,
          ),
        };
      })
      .filter(function (facet) {
        return Boolean(facet.key);
      });
  }

  function extractHandles(payload) {
    if (!payload) return [];
    if (Array.isArray(payload.handles)) {
      return payload.handles.map(String);
    }
    if (Array.isArray(payload.products)) {
      return payload.products
        .map(function (item) {
          if (typeof item === "string") return item;
          return item && item.handle ? String(item.handle) : null;
        })
        .filter(Boolean);
    }
    return [];
  }

  function Widget(root) {
    this.root = root;
    this.facetsEl = qs(root, "[data-facets]");
    this.statusEl = qs(root, "[data-status]");
    this.proxyBase = (root.getAttribute("data-proxy-base") || "/apps/smart-filter").replace(
      /\/$/,
      "",
    );
    this.collectionId = root.getAttribute("data-collection-id") || "";
    this.blockPosition = root.getAttribute("data-position") || "";
    this.position = this.blockPosition || "left";
    this.showCounts = String(root.getAttribute("data-show-counts") || "true") !== "false";
    this.collapseByDefault = false;
    this.collapsedState = {};
    this.selected = {};
    this.price = { min: "", max: "" };
    this.facets = [];
    this._reqId = 0;
    root.classList.add("smart-filter--" + this.position);
    root.setAttribute("data-position", this.position);
  }

  Widget.prototype.applySettings = function (settings) {
    if (!settings || typeof settings !== "object") return;

    if (looksLikeCssColor(settings.accentColor)) {
      var accent = settings.accentColor.trim();
      this.root.style.setProperty("--sf-accent", accent);
      this.root.style.setProperty("--sf-focus", accent);
    }

    if (typeof settings.widgetShadow === "boolean") {
      this.root.style.setProperty(
        "--sf-shadow",
        settings.widgetShadow ? "0 8px 24px rgb(28 25 23 / 6%)" : "none",
      );
    }

    var radius = Number(settings.widgetRadius);
    if (Number.isFinite(radius) && radius >= 0 && radius <= 40) {
      this.root.style.setProperty("--sf-radius", radius + "px");
    }

    if (typeof settings.showProductCounts === "boolean") {
      this.showCounts = settings.showProductCounts;
    }

    if (typeof settings.collapseByDefault === "boolean") {
      this.collapseByDefault = settings.collapseByDefault;
    }

    if (settings.widgetPosition && POSITIONS[settings.widgetPosition]) {
      var next = settings.widgetPosition;
      var hasConflict = Boolean(this.blockPosition && this.blockPosition !== next);
      if (!hasConflict) {
        this.position = next;
        this.root.classList.remove(
          "smart-filter--left",
          "smart-filter--right",
          "smart-filter--top",
        );
        this.root.classList.add("smart-filter--" + next);
        this.root.setAttribute("data-position", next);
      }
    }
  };

  Widget.prototype.restoreFromHash = function () {
    var parsed = parseHash(window.location.hash);
    if (!parsed) return;
    this.selected = parsed.selected || {};
    this.price = parsed.price || { min: "", max: "" };
  };

  Widget.prototype.buildProxyUrl = function () {
    var params = new URLSearchParams();
    if (this.collectionId) params.set("collection_id", this.collectionId);

    Object.keys(this.selected).forEach(
      function (key) {
        var values = this.selected[key];
        if (values && values.length) params.set("f." + key, values.join(","));
      }.bind(this),
    );

    if (!(this.price.min === "" && this.price.max === "")) {
      var min = this.price.min === "" ? "" : this.price.min;
      var max = this.price.max === "" ? "" : this.price.max;
      params.set("f.price", min + "," + max);
    }

    return this.proxyBase + "/filters?" + params.toString();
  };

  Widget.prototype.hasActiveFilters = function () {
    var hasList = Object.keys(this.selected).some(
      function (key) {
        return this.selected[key] && this.selected[key].length > 0;
      }.bind(this),
    );
    return hasList || this.price.min !== "" || this.price.max !== "";
  };

  Widget.prototype.updateStatus = function (payload, handles) {
    var total =
      payload && typeof payload.total === "number"
        ? payload.total
        : payload && typeof payload.count === "number"
          ? payload.count
          : null;

    if (this.hasActiveFilters()) {
      if (typeof total === "number") {
        setStatus(
          this.statusEl,
          total === 0 ? MSG_NO_MATCH : String(total) + " products",
          false,
        );
        return;
      }
      if (!handles.length) {
        setStatus(this.statusEl, MSG_NO_MATCH, false);
        return;
      }
      setStatus(this.statusEl, String(handles.length) + " products", false);
      return;
    }

    var count = total != null ? total : handles.length;
    setStatus(this.statusEl, count ? String(count) + " products" : "", false);
  };

  Widget.prototype.fetchFilters = function () {
    var reqId = ++this._reqId;
    setStatus(this.statusEl, MSG_LOADING, false);
    writeHash(this.selected, this.price);

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
        }.bind(this),
      )
      .then(
        function (data) {
          if (reqId !== this._reqId) return;

          if (data && data.enabled === false) {
            this.facets = [];
            if (this.facetsEl) this.facetsEl.innerHTML = "";
            applyProductVisibility(null);
            dispatchUpdate([]);
            setStatus(this.statusEl, MSG_DISABLED, false);
            return;
          }

          this.applySettings(data && data.settings);
          this.facets = normalizeFacets(data);
          var handles = extractHandles(data);
          this.renderFacets();
          applyProductVisibility(handles);
          dispatchUpdate(handles);
          this.updateStatus(data, handles);
        }.bind(this),
      )
      .catch(
        function () {
          if (reqId !== this._reqId) return;
          setStatus(this.statusEl, MSG_ERROR, true);
          if (this.facetsEl && !this.facetsEl.childElementCount) {
            this.facetsEl.innerHTML = "";
          }
        }.bind(this),
      );
  };

  Widget.prototype.toggleValue = function (key, value, checked) {
    if (!this.selected[key]) this.selected[key] = [];
    var list = this.selected[key];
    var index = list.indexOf(value);
    if (checked && index === -1) {
      list.push(value);
    } else if (!checked && index !== -1) {
      list.splice(index, 1);
    }
    if (!list.length) delete this.selected[key];
    this.fetchFilters();
  };

  Widget.prototype.clearFilters = function () {
    this.selected = {};
    this.price = { min: "", max: "" };
    this.fetchFilters();
  };

  Widget.prototype.isFacetCollapsed = function (key) {
    if (Object.prototype.hasOwnProperty.call(this.collapsedState, key)) {
      return this.collapsedState[key];
    }
    return this.collapseByDefault;
  };

  Widget.prototype.selectedCount = function (facet) {
    if (facet.type === "price_range") {
      var current = facet.isProductPrice
        ? [this.price.min, this.price.max]
        : this.selected[facet.key] || ["", ""];
      return current[0] || current[1] ? 1 : 0;
    }
    return (this.selected[facet.key] || []).length;
  };

  Widget.prototype.renderChips = function () {
    var wrap = document.createElement("div");
    wrap.className = "smart-filter__chips";
    var self = this;

    Object.keys(this.selected).forEach(function (key) {
      (self.selected[key] || []).forEach(function (value) {
        var chip = document.createElement("button");
        chip.type = "button";
        chip.className = "smart-filter__chip";
        chip.setAttribute("aria-label", "Remove " + value);
        chip.innerHTML =
          "<span>" +
          String(value).replace(/</g, "&lt;") +
          '</span><span class="smart-filter__chip-x" aria-hidden="true">×</span>';
        chip.addEventListener("click", function () {
          self.toggleValue(key, value, false);
        });
        wrap.appendChild(chip);
      });
    });

    if (this.price.min || this.price.max) {
      var priceChip = document.createElement("button");
      priceChip.type = "button";
      priceChip.className = "smart-filter__chip";
      priceChip.innerHTML =
        "<span>" +
        (this.price.min || "Min") +
        " – " +
        (this.price.max || "Max") +
        '</span><span class="smart-filter__chip-x" aria-hidden="true">×</span>';
      priceChip.addEventListener("click", function () {
        self.price = { min: "", max: "" };
        self.fetchFilters();
      });
      wrap.appendChild(priceChip);
    }

    return wrap.childElementCount ? wrap : null;
  };

  Widget.prototype.renderFacets = function () {
    if (!this.facetsEl) return;
    this.facetsEl.innerHTML = "";

    var chips = this.renderChips();
    if (chips) this.facetsEl.appendChild(chips);

    this.facets.forEach(
      function (facet) {
        var wrap = document.createElement("div");
        wrap.className = "smart-filter__facet";
        wrap.setAttribute("data-facet-key", facet.key);
        if (this.isFacetCollapsed(facet.key)) {
          wrap.classList.add("is-collapsed");
        }

        var selectedCount = this.selectedCount(facet);
        var label = document.createElement("button");
        label.type = "button";
        label.className = "smart-filter__facet-label";
        label.setAttribute("aria-expanded", String(!wrap.classList.contains("is-collapsed")));

        var labelText = document.createElement("span");
        labelText.className = "smart-filter__facet-label-text";
        labelText.appendChild(document.createTextNode(facet.label));
        if (selectedCount) {
          var badge = document.createElement("span");
          badge.className = "smart-filter__facet-selected";
          badge.textContent = String(selectedCount);
          labelText.appendChild(badge);
        }
        var chevron = document.createElement("span");
        chevron.className = "smart-filter__chevron";
        chevron.setAttribute("aria-hidden", "true");
        label.appendChild(labelText);
        label.appendChild(chevron);
        label.addEventListener(
          "click",
          function () {
            var collapsed = wrap.classList.toggle("is-collapsed");
            this.collapsedState[facet.key] = collapsed;
            label.setAttribute("aria-expanded", String(!collapsed));
          }.bind(this),
        );
        wrap.appendChild(label);

        if (facet.type === "price_range") {
          wrap.appendChild(this.renderPriceFacet(facet));
        } else {
          wrap.appendChild(this.renderListFacet(facet));
        }
        this.facetsEl.appendChild(wrap);
      }.bind(this),
    );

    if (this.hasActiveFilters()) {
      var clear = document.createElement("button");
      clear.type = "button";
      clear.className = "smart-filter__btn smart-filter__clear";
      clear.textContent = MSG_CLEAR;
      clear.addEventListener(
        "click",
        function () {
          this.clearFilters();
        }.bind(this),
      );
      this.facetsEl.appendChild(clear);
    }
  };

  Widget.prototype.renderListFacet = function (facet) {
    var list = document.createElement("ul");
    var asColor = isColorFacet(facet);
    var asSize = isSizeFacet(facet);
    list.className =
      "smart-filter__options" +
      (asColor ? " smart-filter__options--swatches" : "") +
      (asSize ? " smart-filter__options--pills" : "");
    var selected = this.selected[facet.key] || [];
    var showCounts = this.showCounts;
    var items = asSize ? sortSizeValues(facet.values) : facet.values;
    var isAvailability =
      facet.source === "availability" || facet.key === "availability";

    items.forEach(
      function (item) {
        var value = String(
          item.value != null
            ? item.value
            : item.handle != null
              ? item.handle
              : item.label || item,
        );
        var labelText = String(item.label != null ? item.label : value);
        var count = item.count;
        var empty = typeof count === "number" && count === 0;

        var li = document.createElement("li");
        var label = document.createElement("label");
        label.className = "smart-filter__option";
        if (asColor) label.className += " smart-filter__swatch";
        if (asSize) label.className += " smart-filter__pill";
        label.title = labelText + (typeof count === "number" ? " (" + count + ")" : "");

        var swatch = asColor ? swatchColor(labelText) || swatchColor(value) : "";
        if (swatch) label.style.setProperty("--sf-swatch", swatch);

        var input = document.createElement("input");
        input.type = "checkbox";
        input.name = "sf." + facet.key;
        input.value = value;
        input.checked = selected.indexOf(value) !== -1;
        input.disabled = isAvailability && empty && !input.checked;
        input.addEventListener(
          "change",
          function (event) {
            this.toggleValue(facet.key, value, event.target.checked);
          }.bind(this),
        );

        var text = document.createElement("span");
        text.className = "smart-filter__option-text";
        text.textContent = labelText;
        label.appendChild(input);
        label.appendChild(text);

        if (showCounts && typeof count === "number") {
          var countEl = document.createElement("span");
          countEl.className = "smart-filter__option-count";
          countEl.textContent = String(count);
          label.appendChild(countEl);
        }

        li.appendChild(label);
        list.appendChild(li);
      }.bind(this),
    );

    return list;
  };

  Widget.prototype.applyRangeValues = function (facet, min, max, isProductPrice) {
    if (isProductPrice) {
      this.price.min = min;
      this.price.max = max;
    } else if (!min && !max) {
      delete this.selected[facet.key];
    } else {
      this.selected[facet.key] = [min, max];
    }
    this.fetchFilters();
  };

  Widget.prototype.renderPriceFacet = function (facet) {
    var wrap = document.createElement("div");
    wrap.className = "smart-filter__price";
    var isProductPrice = facet.isProductPrice || facet.key === "price";
    var boundMin = Number(facet.min);
    var boundMax = Number(facet.max);
    var hasBounds =
      Number.isFinite(boundMin) &&
      Number.isFinite(boundMax) &&
      boundMax > boundMin;
    var current = isProductPrice
      ? [this.price.min, this.price.max]
      : this.selected[facet.key] || ["", ""];
    var liveMin = current[0] !== "" && current[0] != null ? Number(current[0]) : boundMin;
    var liveMax = current[1] !== "" && current[1] != null ? Number(current[1]) : boundMax;
    if (!Number.isFinite(liveMin)) liveMin = hasBounds ? boundMin : 0;
    if (!Number.isFinite(liveMax)) liveMax = hasBounds ? boundMax : 0;
    if (liveMin > liveMax) {
      var swap = liveMin;
      liveMin = liveMax;
      liveMax = swap;
    }

    if (hasBounds) {
      var slider = document.createElement("div");
      slider.className = "smart-filter__slider";
      var track = document.createElement("div");
      track.className = "smart-filter__slider-track";
      var fill = document.createElement("div");
      fill.className = "smart-filter__slider-fill";
      var low = document.createElement("input");
      low.type = "range";
      low.min = String(boundMin);
      low.max = String(boundMax);
      low.step = boundMax - boundMin > 50 ? "1" : "0.01";
      low.value = String(liveMin);
      var high = document.createElement("input");
      high.type = "range";
      high.min = String(boundMin);
      high.max = String(boundMax);
      high.step = low.step;
      high.value = String(liveMax);

      function updateFill() {
        var span = boundMax - boundMin || 1;
        var left = ((Number(low.value) - boundMin) / span) * 100;
        var right = ((Number(high.value) - boundMin) / span) * 100;
        fill.style.left = Math.max(0, left) + "%";
        fill.style.width = Math.max(0, right - left) + "%";
      }
      updateFill();

      slider.appendChild(track);
      slider.appendChild(fill);
      slider.appendChild(low);
      slider.appendChild(high);
      wrap.appendChild(slider);

      var debounceId = 0;
      var self = this;
      function commitFromSlider() {
        var a = Number(low.value);
        var b = Number(high.value);
        if (a > b) {
          var tmp = a;
          a = b;
          b = tmp;
          low.value = String(a);
          high.value = String(b);
        }
        minInput.value = String(a);
        maxInput.value = String(b);
        updateFill();
        window.clearTimeout(debounceId);
        debounceId = window.setTimeout(function () {
          self.applyRangeValues(facet, String(a), String(b), isProductPrice);
        }, 280);
      }
      low.addEventListener("input", commitFromSlider);
      high.addEventListener("input", commitFromSlider);
    }

    var minField = document.createElement("div");
    minField.className = "smart-filter__price-field";
    var minLabel = document.createElement("span");
    minLabel.className = "smart-filter__field-label";
    minLabel.textContent = MSG_MIN;
    var minInput = document.createElement("input");
    minInput.type = "number";
    minInput.inputMode = "decimal";
    if (hasBounds) {
      minInput.min = String(boundMin);
      minInput.max = String(boundMax);
      minInput.placeholder = String(boundMin);
    } else {
      minInput.placeholder = MSG_MIN;
    }
    minInput.value = current[0] || "";
    minField.appendChild(minLabel);
    minField.appendChild(minInput);

    var maxField = document.createElement("div");
    maxField.className = "smart-filter__price-field";
    var maxLabel = document.createElement("span");
    maxLabel.className = "smart-filter__field-label";
    maxLabel.textContent = MSG_MAX;
    var maxInput = document.createElement("input");
    maxInput.type = "number";
    maxInput.inputMode = "decimal";
    if (hasBounds) {
      maxInput.min = String(boundMin);
      maxInput.max = String(boundMax);
      maxInput.placeholder = String(boundMax);
    } else {
      maxInput.placeholder = MSG_MAX;
    }
    maxInput.value = current[1] || "";
    maxField.appendChild(maxLabel);
    maxField.appendChild(maxInput);

    var actions = document.createElement("div");
    actions.className = "smart-filter__price-actions";
    var apply = document.createElement("button");
    apply.type = "button";
    apply.className = "smart-filter__btn smart-filter__btn--primary";
    apply.textContent = MSG_APPLY;
    apply.addEventListener(
      "click",
      function () {
        this.applyRangeValues(
          facet,
          minInput.value.trim(),
          maxInput.value.trim(),
          isProductPrice,
        );
      }.bind(this),
    );
    actions.appendChild(apply);

    wrap.appendChild(minField);
    wrap.appendChild(maxField);
    wrap.appendChild(actions);
    return wrap;
  };

  Widget.prototype.init = function () {
    if (!this.collectionId) {
      setStatus(this.statusEl, MSG_ERROR, true);
      return;
    }
    this.restoreFromHash();
    this.fetchFilters();
  };

  function boot() {
    var root = document.getElementById("smart-filter-root");
    if (!root) return;
    new Widget(root).init();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      runWhenIdle(boot);
    });
  } else {
    runWhenIdle(boot);
  }
})();
