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
  var POSITIONS = { left: true, right: true, top: true, offcanvas: true };
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

  function chipDisplayLabel(facets, key, value) {
    var list = facets || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].key !== key) continue;
      var values = list[i].values || [];
      for (var j = 0; j < values.length; j++) {
        if (String(values[j].value) === String(value) && values[j].label) {
          return String(values[j].label);
        }
      }
    }
    return String(value);
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

  function looksLikeFontFamily(value) {
    if (typeof value !== "string") return false;
    var font = value.trim();
    if (!font || font.length > 120) return false;
    if (/url\s*\(|expression|@import|[<>]|javascript:/i.test(font)) return false;
    return /^[a-zA-Z0-9\s"',._-]+$/.test(font);
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

  function applyVariantImages(products) {
    var byHandle = {};
    (products || []).forEach(function (item) {
      if (!item || !item.handle) return;
      byHandle[String(item.handle).toLowerCase()] =
        item.variantImageUrl != null && item.variantImageUrl !== ""
          ? String(item.variantImageUrl)
          : "";
    });

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

      var img = card.querySelector("img");
      if (!img) return;
      if (!img.getAttribute("data-sf-orig-src")) {
        img.setAttribute("data-sf-orig-src", img.getAttribute("src") || "");
        img.setAttribute("data-sf-orig-srcset", img.getAttribute("srcset") || "");
      }
      var next = byHandle[handle.toLowerCase()] || "";
      if (next) {
        img.setAttribute("src", next);
        img.removeAttribute("srcset");
      } else {
        var orig = img.getAttribute("data-sf-orig-src") || "";
        var origSet = img.getAttribute("data-sf-orig-srcset") || "";
        if (orig) img.setAttribute("src", orig);
        if (origSet) img.setAttribute("srcset", origSet);
        else img.removeAttribute("srcset");
      }
    });
  }

  function applyProductOrder(handles) {
    if (!Array.isArray(handles) || !handles.length) return;
    var rank = {};
    handles.forEach(function (handle, index) {
      rank[String(handle).toLowerCase()] = index;
    });
    var links = document.querySelectorAll('a[href*="/products/"]');
    var seen = typeof WeakSet !== "undefined" ? new WeakSet() : null;
    var byParent = [];
    links.forEach(function (link) {
      var handle = handleFromHref(link.getAttribute("href"));
      if (!handle) return;
      var card = closestProductCard(link);
      if (!card || !card.parentNode) return;
      if (seen) {
        if (seen.has(card)) return;
        seen.add(card);
      }
      var parent = card.parentNode;
      var group = null;
      for (var i = 0; i < byParent.length; i++) {
        if (byParent[i].parent === parent) {
          group = byParent[i];
          break;
        }
      }
      if (!group) {
        group = { parent: parent, cards: [] };
        byParent.push(group);
      }
      var key = handle.toLowerCase();
      if (Object.prototype.hasOwnProperty.call(rank, key)) {
        group.cards.push({ card: card, index: rank[key] });
      }
    });
    byParent.forEach(function (group) {
      group.cards.sort(function (a, b) {
        return a.index - b.index;
      });
      group.cards.forEach(function (item) {
        group.parent.appendChild(item.card);
      });
    });
  }

  function dispatchUpdate(handles) {
    document.dispatchEvent(
      new CustomEvent("smart-filter:update", {
        detail: { handles: handles || [] },
      }),
    );
  }

  var SORT_LABELS = {
    manual: "Featured",
    title_asc: "Alphabetically, A-Z",
    title_desc: "Alphabetically, Z-A",
    price_asc: "Price, low to high",
    price_desc: "Price, high to low",
    date_desc: "Date, new to old",
    date_asc: "Date, old to new",
    sale_pct_desc: "% Sale off",
  };

  function serializeState(selected, price, sort, query) {
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
    if (sort) {
      parts.push("sort:" + encodeURIComponent(sort));
    }
    if (query) {
      parts.push("q:" + encodeURIComponent(query));
    }
    return parts.join("|");
  }

  function writeHash(selected, price, sort, query) {
    var encoded = serializeState(selected, price, sort, query);
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
    var sort = "";
    var query = "";

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
        if (key === "sort") {
          sort = values[0] || "";
          return;
        }
        if (key === "q") {
          query = values[0] || "";
          return;
        }
        if (key.indexOf("mf_") === 0) {
          selected[key] = values.map(function (value) {
            return value == null ? "" : value;
          });
          return;
        }
        selected[key] = values.filter(function (value) {
          return value !== "";
        });
      });

    return { selected: selected, price: price, sort: sort, query: query };
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
        var isBoolean = type === "boolean" || type === "bool";
        var displayType = String(facet.displayType || "").toLowerCase();
        if (displayType === "slider") isRange = true;
        var range = facet.range || {};
        return {
          key: key,
          label: facet.label || facet.name || key,
          type: isRange ? "price_range" : isBoolean ? "boolean" : "list",
          displayType: displayType,
          isProductPrice: isProductPrice,
          source: source,
          valueSortMode: facet.valueSortMode || "auto",
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
    this.titleEl = qs(root, "[data-title]");
    this.proxyBase = (root.getAttribute("data-proxy-base") || "/apps/smart-filter").replace(
      /\/$/,
      "",
    );
    this.collectionId = root.getAttribute("data-collection-id") || "";
    this.searchQuery = (root.getAttribute("data-search-query") || "").trim();
    if (!this.searchQuery && !this.collectionId) {
      try {
        this.searchQuery = (
          new URLSearchParams(window.location.search).get("q") || ""
        ).trim();
      } catch (err) {
        this.searchQuery = "";
      }
    }
    this.collectionQuery = "";
    this.collectionSearchWrap = qs(root, "[data-collection-search-wrap]");
    this.collectionSearchEl = qs(root, "[data-collection-search]");
    this.blockPosition = root.getAttribute("data-position") || "";
    this.position = this.blockPosition || "left";
    this.showCounts = String(root.getAttribute("data-show-counts") || "true") !== "false";
    this.collapseByDefault = false;
    this.collapsedState = {};
    this.selected = {};
    this.price = { min: "", max: "" };
    this.sortKey = "";
    this.sortWrap = qs(root, "[data-sort-wrap]");
    this.sortEl = qs(root, "[data-sort]");
    this.facets = [];
    this._reqId = 0;
    this._drawerPrevOverflow = "";
    this._onDrawerKey = this.onDrawerKey.bind(this);
    root.classList.add("smart-filter--" + this.position);
    root.setAttribute("data-position", this.position);
    this.bindDrawer();
    this.bindSort();
    this.bindCollectionSearch();
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

    var fontMode = String(settings.widgetFontMode || "theme");
    var customFont = looksLikeFontFamily(settings.widgetFontFamily)
      ? settings.widgetFontFamily.trim()
      : "";
    if (fontMode === "custom" && customFont) {
      this.root.style.setProperty("--sf-font-body", customFont);
      this.root.style.setProperty("--sf-font-heading", customFont);
    } else if (fontMode === "heading") {
      this.root.style.setProperty(
        "--sf-font-body",
        "var(--font-heading-family, inherit)",
      );
      this.root.style.setProperty(
        "--sf-font-heading",
        "var(--font-heading-family, inherit)",
      );
    } else if (fontMode === "body") {
      this.root.style.setProperty(
        "--sf-font-body",
        "var(--font-body-family, inherit)",
      );
      this.root.style.setProperty(
        "--sf-font-heading",
        "var(--font-body-family, inherit)",
      );
    } else {
      this.root.style.removeProperty("--sf-font-body");
      this.root.style.removeProperty("--sf-font-heading");
    }

    if (typeof settings.widgetTitle === "string" && this.titleEl) {
      var title = settings.widgetTitle.trim();
      this.titleEl.textContent = title;
      this.titleEl.hidden = !title;
    }

    var titleSize = Number(settings.widgetTitleSize);
    if (Number.isFinite(titleSize) && titleSize >= 12 && titleSize <= 32) {
      this.root.style.setProperty("--sf-title-size", titleSize + "px");
    }

    if (looksLikeCssColor(settings.widgetTitleColor)) {
      this.root.style.setProperty(
        "--sf-title-color",
        settings.widgetTitleColor.trim(),
      );
    }

    if (typeof settings.showProductCounts === "boolean") {
      this.showCounts = settings.showProductCounts;
    }

    if (typeof settings.collapseByDefault === "boolean") {
      this.collapseByDefault = settings.collapseByDefault;
    }

    if (settings.widgetPosition && POSITIONS[settings.widgetPosition]) {
      this.position = settings.widgetPosition;
      this.root.classList.remove(
        "smart-filter--left",
        "smart-filter--right",
        "smart-filter--top",
        "smart-filter--offcanvas",
      );
      this.root.classList.add("smart-filter--" + this.position);
      this.root.setAttribute("data-position", this.position);
    }

    this.renderSortSelect(settings);
    this.renderCollectionSearch(settings);
  };

  Widget.prototype.bindCollectionSearch = function () {
    var input = this.collectionSearchEl;
    if (!input || input.getAttribute("data-sf-bound") === "1") return;
    input.setAttribute("data-sf-bound", "1");
    var self = this;
    var timer = 0;
    function applyValue() {
      var next = (input.value || "").trim();
      if (next === self.collectionQuery) return;
      self.collectionQuery = next;
      self.fetchFilters();
    }
    input.addEventListener("input", function () {
      window.clearTimeout(timer);
      timer = window.setTimeout(applyValue, 250);
    });
    input.addEventListener("search", applyValue);
    input.addEventListener("keydown", function (event) {
      if (event.key === "Enter") {
        window.clearTimeout(timer);
        applyValue();
      }
    });
  };

  Widget.prototype.renderCollectionSearch = function (settings) {
    var wrap = this.collectionSearchWrap;
    var input = this.collectionSearchEl;
    if (!wrap) return;
    var show =
      Boolean(this.collectionId) && Boolean(settings.enableCollectionSearch);
    wrap.hidden = !show;
    if (!show) {
      this.collectionQuery = "";
      if (input) input.value = "";
      return;
    }
    if (input && input.value !== this.collectionQuery) {
      input.value = this.collectionQuery;
    }
  };

  Widget.prototype.bindSort = function () {
    if (!this.sortEl || this.sortEl.getAttribute("data-sf-bound") === "1") return;
    this.sortEl.setAttribute("data-sf-bound", "1");
    this.sortEl.addEventListener(
      "change",
      function () {
        this.sortKey = this.sortEl.value;
        this.fetchFilters();
      }.bind(this),
    );
  };

  Widget.prototype.renderSortSelect = function (settings) {
    var wrap = this.sortWrap;
    var select = this.sortEl;
    if (!wrap || !select) return;
    var enabled = Array.isArray(settings.sortOptionsEnabled)
      ? settings.sortOptionsEnabled
      : [];
    var hide = Boolean(settings.hideSortDropdown) || enabled.length === 0;
    wrap.hidden = hide;
    if (hide) {
      if (!this.sortKey) this.sortKey = settings.defaultSort || "manual";
      return;
    }
    var current =
      this.sortKey && enabled.indexOf(this.sortKey) !== -1
        ? this.sortKey
        : settings.defaultSort && enabled.indexOf(settings.defaultSort) !== -1
          ? settings.defaultSort
          : enabled[0];
    this.sortKey = current || "manual";
    select.innerHTML = "";
    enabled.forEach(function (key) {
      var option = document.createElement("option");
      option.value = key;
      option.textContent = SORT_LABELS[key] || key;
      if (key === this.sortKey) option.selected = true;
      select.appendChild(option);
    }, this);
  };

  Widget.prototype.restoreFromHash = function () {
    var parsed = parseHash(window.location.hash);
    if (!parsed) return;
    this.selected = parsed.selected || {};
    this.price = parsed.price || { min: "", max: "" };
    if (parsed.sort) this.sortKey = parsed.sort;
    if (this.collectionId && parsed.query) this.collectionQuery = parsed.query;
  };

  Widget.prototype.buildProxyUrl = function () {
    var params = new URLSearchParams();
    if (this.collectionId) {
      params.set("collection_id", this.collectionId);
      if (this.collectionQuery) {
        params.set("q", this.collectionQuery);
      }
    } else if (this.searchQuery) {
      params.set("q", this.searchQuery);
    }

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

    if (this.sortKey) {
      params.set("sort", this.sortKey);
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
    if (
      (this.searchQuery || this.collectionQuery) &&
      (count === 0 || (typeof total === "number" ? total === 0 : !handles.length))
    ) {
      setStatus(this.statusEl, MSG_NO_MATCH, false);
      return;
    }
    setStatus(this.statusEl, count ? String(count) + " products" : "", false);
  };

  Widget.prototype.fetchFilters = function () {
    var reqId = ++this._reqId;
    setStatus(this.statusEl, MSG_LOADING, false);
    writeHash(this.selected, this.price, this.sortKey, this.collectionQuery);

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
            applyVariantImages([]);
            dispatchUpdate([]);
            setStatus(this.statusEl, MSG_DISABLED, false);
            this.syncDrawerBadge();
            return;
          }

          this.applySettings(data && data.settings);
          this.facets = normalizeFacets(data);
          var handles = extractHandles(data);
          this.renderFacets();
          applyProductVisibility(handles);
          applyProductOrder(handles);
          applyVariantImages(data && data.products);
          dispatchUpdate(handles);
          this.updateStatus(data, handles);
          this.syncDrawerBadge();
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

  Widget.prototype.bindDrawer = function () {
    this.toggleEl = qs(this.root, "[data-drawer-toggle]");
    this.backdropEl = qs(this.root, "[data-drawer-backdrop]");
    this.panelEl = qs(this.root, "[data-drawer-panel]");
    this.closeEl = qs(this.root, "[data-drawer-close]");
    this.countEl = qs(this.root, "[data-drawer-count]");

    if (this.toggleEl) {
      this.toggleEl.addEventListener(
        "click",
        function () {
          this.openDrawer();
        }.bind(this),
      );
    }
    if (this.closeEl) {
      this.closeEl.addEventListener(
        "click",
        function () {
          this.closeDrawer();
        }.bind(this),
      );
    }
    if (this.backdropEl) {
      this.backdropEl.addEventListener(
        "click",
        function () {
          this.closeDrawer();
        }.bind(this),
      );
    }
  };

  Widget.prototype.onDrawerKey = function (event) {
    if (event.key === "Escape") this.closeDrawer();
  };

  Widget.prototype.openDrawer = function () {
    if (this.root.classList.contains("is-drawer-open")) return;
    this.root.classList.add("is-drawer-open");
    if (this.toggleEl) this.toggleEl.setAttribute("aria-expanded", "true");
    if (this.backdropEl) this.backdropEl.hidden = false;
    document.addEventListener("keydown", this._onDrawerKey);
    this._drawerPrevOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    if (this.closeEl) this.closeEl.focus();
  };

  Widget.prototype.closeDrawer = function () {
    if (!this.root.classList.contains("is-drawer-open")) return;
    this.root.classList.remove("is-drawer-open");
    if (this.toggleEl) this.toggleEl.setAttribute("aria-expanded", "false");
    if (this.backdropEl) this.backdropEl.hidden = true;
    document.removeEventListener("keydown", this._onDrawerKey);
    document.documentElement.style.overflow = this._drawerPrevOverflow || "";
    if (this.toggleEl) this.toggleEl.focus();
  };

  Widget.prototype.syncDrawerBadge = function () {
    if (!this.countEl) return;
    var n = 0;
    Object.keys(this.selected).forEach(
      function (key) {
        n += (this.selected[key] || []).length;
      }.bind(this),
    );
    if (this.price.min !== "" || this.price.max !== "") n += 1;
    if (n) {
      this.countEl.hidden = false;
      this.countEl.textContent = String(n);
    } else {
      this.countEl.hidden = true;
      this.countEl.textContent = "";
    }
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
    if (this.position === "top") return false;
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
      var facet = (self.facets || []).find(function (item) {
        return item.key === key;
      });
      var vals = self.selected[key] || [];
      if (facet && facet.type === "price_range") {
        if (!vals[0] && !vals[1]) return;
        var rangeChip = document.createElement("button");
        rangeChip.type = "button";
        rangeChip.className = "smart-filter__chip";
        rangeChip.setAttribute(
          "aria-label",
          "Remove " + (facet.label || key) + " range",
        );
        rangeChip.innerHTML =
          "<span>" +
          String(facet.label || key).replace(/</g, "&lt;") +
          ": " +
          (vals[0] || "Min") +
          " – " +
          (vals[1] || "Max") +
          '</span><span class="smart-filter__chip-x" aria-hidden="true">×</span>';
        rangeChip.addEventListener("click", function () {
          delete self.selected[key];
          self.fetchFilters();
        });
        wrap.appendChild(rangeChip);
        return;
      }
      vals.forEach(function (value) {
        var chipLabel = chipDisplayLabel(self.facets, key, value);
        var chip = document.createElement("button");
        chip.type = "button";
        chip.className = "smart-filter__chip";
        chip.setAttribute("aria-label", "Remove " + chipLabel);
        chip.innerHTML =
          "<span>" +
          String(chipLabel).replace(/</g, "&lt;") +
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

        if (facet.type === "price_range" || facet.displayType === "slider") {
          wrap.appendChild(this.renderPriceFacet(facet));
        } else if (facet.type === "boolean") {
          wrap.appendChild(this.renderBooleanFacet(facet));
        } else if (facet.displayType === "dropdown") {
          wrap.appendChild(this.renderDropdownFacet(facet));
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

  Widget.prototype.renderDropdownFacet = function (facet) {
    var wrap = document.createElement("div");
    wrap.className = "smart-filter__dropdown-wrap";
    var select = document.createElement("select");
    select.className = "smart-filter__dropdown";
    select.setAttribute("aria-label", facet.label);
    var any = document.createElement("option");
    any.value = "";
    any.textContent = "Any";
    select.appendChild(any);
    var selected = this.selected[facet.key] || [];
    (facet.values || []).forEach(function (item) {
      var value = String(
        item.value != null ? item.value : item.label || item,
      );
      var option = document.createElement("option");
      option.value = value;
      option.textContent = String(item.label != null ? item.label : value);
      if (selected.indexOf(value) !== -1) option.selected = true;
      select.appendChild(option);
    });
    select.addEventListener(
      "change",
      function () {
        if (!select.value) delete this.selected[facet.key];
        else this.selected[facet.key] = [select.value];
        this.fetchFilters();
      }.bind(this),
    );
    wrap.appendChild(select);
    return wrap;
  };

  Widget.prototype.renderBooleanFacet = function (facet) {
    var list = this.renderListFacet(facet);
    list.className = "smart-filter__options smart-filter__options--boolean";
    return list;
  };

  Widget.prototype.renderListFacet = function (facet) {
    var list = document.createElement("ul");
    var asBoolean = facet.type === "boolean";
    var displayType = String(facet.displayType || "").toLowerCase();
    var asColor =
      displayType === "swatch" ||
      displayType === "swatch-text" ||
      (!displayType && !asBoolean && isColorFacet(facet));
    var asSize =
      displayType === "box" ||
      (!displayType && !asBoolean && !asColor && isSizeFacet(facet));
    var asSwatchText = displayType === "swatch-text";
    var asRadio = displayType === "radio";
    var asPlainList = displayType === "list";
    list.className =
      "smart-filter__options" +
      (asColor ? " smart-filter__options--swatches" : "") +
      (asSize ? " smart-filter__options--pills" : "") +
      (asBoolean ? " smart-filter__options--boolean" : "") +
      (asSwatchText ? " smart-filter__options--swatch-text" : "") +
      (asPlainList ? " smart-filter__options--list" : "");
    var selected = this.selected[facet.key] || [];
    var showCounts = this.showCounts;
    var items = facet.values || [];
    if (
      asSize &&
      facet.valueSortMode !== "manual" &&
      facet.valueSortMode !== "alpha"
    ) {
      items = sortSizeValues(items);
    }
    var isAvailability =
      facet.source === "availability" || facet.key === "availability";
    var isBinary = isAvailability || asBoolean;

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
        if (asSwatchText) label.className += " smart-filter__swatch-text";
        if (asSize) label.className += " smart-filter__pill";
        label.title = labelText + (typeof count === "number" ? " (" + count + ")" : "");

        var swatch = asColor ? swatchColor(labelText) || swatchColor(value) : "";
        if (swatch) label.style.setProperty("--sf-swatch", swatch);

        var input = document.createElement("input");
        input.type = asRadio ? "radio" : "checkbox";
        input.name = "sf." + facet.key;
        input.value = value;
        input.checked = selected.indexOf(value) !== -1;
        input.disabled = isBinary && empty && !input.checked;
        if (asPlainList) input.className = "smart-filter__sr-only";
        input.addEventListener(
          "change",
          function (event) {
            if (asRadio) {
              this.selected[facet.key] = event.target.checked ? [value] : [];
              if (!this.selected[facet.key].length) delete this.selected[facet.key];
              this.fetchFilters();
              return;
            }
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

      var updateFill = function () {
        var span = boundMax - boundMin || 1;
        var left = ((Number(low.value) - boundMin) / span) * 100;
        var right = ((Number(high.value) - boundMin) / span) * 100;
        fill.style.left = Math.max(0, left) + "%";
        fill.style.width = Math.max(0, right - left) + "%";
      };
      updateFill();

      slider.appendChild(track);
      slider.appendChild(fill);
      slider.appendChild(low);
      slider.appendChild(high);
      wrap.appendChild(slider);

      var debounceId = 0;
      var self = this;
      var commitFromSlider = function () {
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
      };
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
    if (!this.collectionId && !this.searchQuery) {
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
