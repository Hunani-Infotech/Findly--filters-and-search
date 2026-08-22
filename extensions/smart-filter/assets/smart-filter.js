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

  function shopDomain() {
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

  function activeFilterCombo(selected, price) {
    var parts = [];
    var facetCount = 0;
    Object.keys(selected || {})
      .sort()
      .forEach(function (key) {
        var values = selected[key];
        if (!values || !values.length) return;
        facetCount += 1;
        parts.push(key + "=" + values.join(","));
      });
    if (price && (price.min !== "" || price.max !== "")) {
      facetCount += 1;
      parts.push("price=" + String(price.min) + "," + String(price.max));
      parts.sort();
    }
    return { facetCount: facetCount, combo: parts.join("|") };
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

  function escapeCssUrl(url) {
    return String(url || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  }

  function applyFacetSwatch(label, item, labelText, value) {
    var spec = item && item.swatch;
    if (spec && spec.kind === "image" && spec.imageUrl) {
      label.style.setProperty(
        "--sf-swatch-image",
        'url("' + escapeCssUrl(spec.imageUrl) + '")',
      );
      label.className += " is-image";
      return;
    }
    if (spec && spec.kind === "dual" && spec.color1 && spec.color2) {
      label.style.setProperty("--sf-swatch", spec.color1);
      label.style.setProperty("--sf-swatch-2", spec.color2);
      label.className += " is-dual";
      return;
    }
    if (spec && spec.kind === "solid" && spec.color1) {
      label.style.setProperty("--sf-swatch", spec.color1);
      return;
    }
    var swatch = swatchColor(labelText) || swatchColor(value);
    if (swatch) label.style.setProperty("--sf-swatch", swatch);
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
    var byKey = {};
    (products || []).forEach(function (item) {
      if (!item) return;
      var image =
        item.variantImageUrl != null && item.variantImageUrl !== ""
          ? String(item.variantImageUrl)
          : item.imageUrl
            ? String(item.imageUrl)
            : "";
      if (item.cardKey) byKey[String(item.cardKey).toLowerCase()] = image;
      if (item.handle) {
        var handleKey = String(item.handle).toLowerCase();
        if (byKey[handleKey] == null) byKey[handleKey] = image;
      }
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
      var key =
        (card.getAttribute && card.getAttribute("data-sf-card-key")) ||
        handle.toLowerCase();
      var next = byKey[String(key).toLowerCase()] || "";
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

  var partnerUpdateTimer = null;
  var partnerUpdateHandles = [];

  function reinitPartnerWidgets() {
    try {
      if (window.jdgm && typeof window.jdgm.customizeBadges === "function") {
        window.jdgm.customizeBadges();
      } else if (window.jdgm && typeof window.jdgm.preLoader === "function") {
        window.jdgm.preLoader();
      }
    } catch (errJdgm) {
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
    } catch (errHero) {
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
    } catch (errFrcp) {
      /* optional partner widget */
    }

    try {
      if (window._swat && typeof window._swat.initializeActionButtons === "function") {
        window._swat.initializeActionButtons();
      }
    } catch (errSwym) {
      /* optional partner widget */
    }

    try {
      // Shopify Translate & Adapt needs no JS because we hide/show locale-rendered theme cards.
      if (window.Weglot && typeof window.Weglot.refresh === "function") {
        window.Weglot.refresh();
      }
    } catch (errWeglot) {
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
    } catch (errCurrency) {
      /* optional currency converter */
    }
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

  var THEME_PAGER_SELECTOR =
    "nav.pagination, .pagination, .pagination-wrapper, [data-pagination]";
  var GRID_HINT_SELECTOR =
    "#product-grid, [data-id='product-grid'], ul.product-grid, .product-grid, [data-product-grid]";
  var THEME_PAGE_FETCH_MAX = 40;
  var PAGING_STYLES = { pagination: true, load_more: true, infinite: true };

  function normalizePaginationStyle(value) {
    var style = String(value || "").toLowerCase();
    return PAGING_STYLES[style] ? style : "pagination";
  }

  function currentThemePage() {
    try {
      var raw = new URLSearchParams(window.location.search).get("page");
      var n = Number(raw);
      return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
    } catch (err) {
      return 1;
    }
  }

  function themePageHref(page) {
    var url = new URL(window.location.href);
    url.searchParams.set("page", String(page));
    url.hash = "";
    return url.pathname + url.search;
  }

  function isPagingChrome(node) {
    if (!node) return true;
    if (node.closest) {
      return Boolean(node.closest(".smart-filter, .sf-pager"));
    }
    return false;
  }

  function eachProductCard(root, fn) {
    if (!root || !root.querySelectorAll) return;
    var links = root.querySelectorAll('a[href*="/products/"]');
    var seen = typeof WeakSet !== "undefined" ? new WeakSet() : null;
    var seenList = seen ? null : [];
    for (var i = 0; i < links.length; i++) {
      var link = links[i];
      if (isPagingChrome(link)) continue;
      var handle = handleFromHref(link.getAttribute("href"));
      if (!handle) continue;
      var card = closestProductCard(link);
      if (!card) continue;
      if (seen) {
        if (seen.has(card)) continue;
        seen.add(card);
      } else {
        if (seenList.indexOf(card) !== -1) continue;
        seenList.push(card);
      }
      var cardKey =
        (card.getAttribute && card.getAttribute("data-sf-card-key")) ||
        handle.toLowerCase();
      fn(String(cardKey).toLowerCase(), card);
    }
  }

  function discoverGridParent() {
    var hints = document.querySelectorAll(GRID_HINT_SELECTOR);
    var i;
    for (i = 0; i < hints.length; i++) {
      if (isPagingChrome(hints[i])) continue;
      var count = 0;
      eachProductCard(hints[i], function () {
        count += 1;
      });
      if (count) return hints[i];
    }
    var bestParent = null;
    var bestCount = 0;
    var tally = [];
    eachProductCard(document, function (handle, card) {
      if (!card.parentNode) return;
      var parent = card.parentNode;
      var group = null;
      for (var g = 0; g < tally.length; g++) {
        if (tally[g].parent === parent) {
          group = tally[g];
          break;
        }
      }
      if (!group) {
        group = { parent: parent, count: 0 };
        tally.push(group);
      }
      group.count += 1;
      if (group.count > bestCount) {
        bestCount = group.count;
        bestParent = parent;
      }
    });
    return bestCount ? bestParent : null;
  }

  function inferCollectionId() {
    try {
      var meta = window.ShopifyAnalytics && window.ShopifyAnalytics.meta;
      var page = meta && meta.page;
      if (!page) return "";
      var type = String(page.resourceType || "").toLowerCase();
      if (
        type === "collection" &&
        page.resourceId != null &&
        String(page.resourceId) !== ""
      ) {
        return String(page.resourceId);
      }
    } catch (err) {
      /* ignore */
    }
    return "";
  }

  function isDocumentRoot(el) {
    if (!el || !el.tagName) return true;
    var tag = String(el.tagName).toLowerCase();
    return tag === "body" || tag === "html";
  }

  function widgetMountNode(root) {
    if (!root) return null;
    if (root.closest) {
      var block = root.closest(".shopify-block, .shopify-app-block");
      if (block) return block;
    }
    return root;
  }

  function closestLayoutEl(el) {
    if (!el) return null;
    if (el.classList && el.classList.contains("sf-collection-layout")) return el;
    return el.closest ? el.closest(".sf-collection-layout") : null;
  }

  function applyLayoutPositionClass(el, position) {
    if (!el || !el.classList) return;
    el.classList.add("sf-collection-layout");
    el.classList.remove(
      "sf-collection-layout--left",
      "sf-collection-layout--right",
      "sf-collection-layout--top",
      "sf-collection-layout--offcanvas",
    );
    el.classList.add("sf-collection-layout--" + position);
  }

  function placeMountInLayout(layout, mount, position) {
    if (!layout || !mount) return;
    if (mount.classList) mount.classList.add("sf-collection-layout__aside");
    var atStart = position !== "right";
    if (atStart) {
      if (layout.firstChild !== mount) {
        layout.insertBefore(mount, layout.firstChild);
      }
    } else if (layout.lastChild !== mount) {
      layout.appendChild(mount);
    }
  }

  function hideEmptyShopifySection(section, mount) {
    if (!section || (mount && section.contains(mount))) return;
    if (section.querySelector(".shopify-block")) return;
    if (section.querySelector(GRID_HINT_SELECTOR)) return;
    section.style.display = "none";
    section.setAttribute("data-sf-empty-hidden", "true");
  }

  function clampPageSize(n) {
    var count = Number(n) || 0;
    if (!count) return 24;
    if (count < 8) return 8;
    if (count > 48) return 48;
    return Math.floor(count);
  }

  function uniqueHandleList(handles) {
    var out = [];
    var seen = {};
    (handles || []).forEach(function (handle) {
      var key = String(handle || "").toLowerCase();
      if (!key || seen[key]) return;
      seen[key] = true;
      out.push(key);
    });
    return out;
  }

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

  function formatMoney(value, currencyCode) {
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

  function extractHandles(payload) {
    if (!payload) return [];
    if (Array.isArray(payload.handles)) {
      return payload.handles.map(String);
    }
    if (Array.isArray(payload.products)) {
      return payload.products
        .map(function (item) {
          if (typeof item === "string") return item;
          if (!item) return null;
          if (item.cardKey) return String(item.cardKey);
          if (item.variantId && item.handle) {
            return String(item.handle).toLowerCase() + "::" + item.variantId;
          }
          return item.handle ? String(item.handle) : null;
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
    if (!this.collectionId) {
      this.collectionId = inferCollectionId();
    }
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
    this.showTotalProductCount = true;
    this.collapseByDefault = false;
    this.collapsedState = {};
    this.selected = {};
    this.price = { min: "", max: "" };
    this.sortKey = "";
    this.sortWrap = qs(root, "[data-sort-wrap]");
    this.sortEl = qs(root, "[data-sort]");
    this.facets = [];
    this.page = 1;
    this.pageSize = 0;
    this.paginationStyle = "pagination";
    this.defaultSort = "manual";
    this._appending = false;
    this._loadingPage = false;
    this._cardCache = {};
    this._nativeHandles = {};
    this._importedHandles = {};
    this._gridParent = null;
    this._shownHandles = [];
    this._hasNext = false;
    this._pageTotal = 0;
    this._pagerEl = null;
    this._infiniteObserver = null;
    this._themePagesCached = {};
    this._themeNoMore = false;
    this._pagingFallback = false;
    this._sentPagingParams = false;
    this._lastProducts = [];
    this._reqId = 0;
    this._drawerPrevOverflow = "";
    this._onDrawerKey = this.onDrawerKey.bind(this);
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
    this.widgetFontMode = "theme";
    this._layoutAttempts = 0;
    this._layoutRetryTimer = null;
    this._layoutFallbackDone = false;
    root.classList.add("smart-filter--" + this.position);
    root.setAttribute("data-position", this.position);
    this.inheritThemeType();
    this.syncCollectionLayout();
    this.bindDrawer();
    this.bindSort();
    this.bindCollectionSearch();
  }

  Widget.prototype.t = function (key, fallback) {
    var value = this.i18n && this.i18n[key];
    if (typeof value === "string" && value.trim()) return value;
    return fallback;
  };

  Widget.prototype.applyI18n = function (payload) {
    this.i18n =
      payload && payload.i18n && typeof payload.i18n === "object"
        ? payload.i18n
        : {};
  };

  Widget.prototype.applyI18nChrome = function () {
    if (this.i18n.filter && this.titleEl) {
      this.titleEl.textContent = this.i18n.filter;
      this.titleEl.hidden = !String(this.i18n.filter).trim();
    }
    var toggle = this.root.querySelector("[data-drawer-toggle]");
    if (toggle && this.i18n.filter) {
      toggle.setAttribute(
        "data-title",
        this.t("filter", "Filter:").replace(/:\s*$/, "").trim(),
      );
    }
  };

  Widget.prototype.productCountLabel = function (n) {
    return this.t("products", "{n} products").replace("{n}", String(n));
  };

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
    this.widgetFontMode = fontMode;
    this.inheritThemeType();

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

    var customCss =
      typeof settings.customCss === "string" ? settings.customCss.trim() : "";
    var customStyle = this.root.querySelector("style[data-findly-custom]");
    if (customCss) {
      if (!customStyle) {
        customStyle = document.createElement("style");
        customStyle.setAttribute("data-findly-custom", "");
        this.root.appendChild(customStyle);
      }
      customStyle.textContent = customCss;
    } else if (customStyle) {
      customStyle.parentNode.removeChild(customStyle);
    }

    if (typeof settings.showProductCounts === "boolean") {
      this.showCounts = settings.showProductCounts;
    }

    this.showTotalProductCount =
      settings.showTotalProductCount == null
        ? true
        : Boolean(settings.showTotalProductCount);
    this.applyThemeProductCountVisibility(this.showTotalProductCount);

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
    this.syncCollectionLayout();

    this.enableFiltersOnSearch =
      settings.enableFiltersOnSearch == null
        ? true
        : Boolean(settings.enableFiltersOnSearch);
    this.hideSingleValueFacets = Boolean(settings.hideSingleValueFacets);
    this.showMatchingVariantImage =
      settings.showMatchingVariantImage == null
        ? true
        : Boolean(settings.showMatchingVariantImage);
    this.showRefineBy =
      settings.showRefineBy == null ? true : Boolean(settings.showRefineBy);

    this.root.hidden = Boolean(this.searchQuery) && this.enableFiltersOnSearch === false;

    if (typeof settings.currency === "string" && settings.currency.trim()) {
      this.currency = settings.currency.trim();
    }

    this.defaultSort = settings.defaultSort || "manual";
    this.paginationStyle = normalizePaginationStyle(settings.paginationStyle);

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
    // D11 metafield sort options from settings.metafieldSortOptions.
    var extra = Array.isArray(settings.metafieldSortOptions)
      ? settings.metafieldSortOptions
      : [];
    var extraLabels = {};
    extra.forEach(function (item) {
      if (!item || !item.key) return;
      var rawLabel = item.label || item.key;
      extraLabels[item.key] = /^sort by /i.test(rawLabel)
        ? rawLabel
        : "Sort by " + rawLabel;
    });
    var keys = enabled.concat(
      extra
        .map(function (item) {
          return item && item.key;
        })
        .filter(Boolean),
    );
    var hide = Boolean(settings.hideSortDropdown) || keys.length === 0;
    wrap.hidden = hide;
    if (hide) {
      if (!this.sortKey) this.sortKey = settings.defaultSort || "manual";
      return;
    }
    var current =
      this.sortKey && keys.indexOf(this.sortKey) !== -1
        ? this.sortKey
        : settings.defaultSort && keys.indexOf(settings.defaultSort) !== -1
          ? settings.defaultSort
          : keys[0];
    this.sortKey = current || "manual";
    select.innerHTML = "";
    keys.forEach(function (key) {
      var option = document.createElement("option");
      option.value = key;
      option.textContent =
        extraLabels[key] || this.t("sort_" + key, SORT_LABELS[key] || key);
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

    if (this.locale) params.set("locale", this.locale);
    if (this.country) params.set("country", this.country);
    if (this.currency) params.set("currency", this.currency);
    if (this.companyLocation) {
      params.set("company_location", this.companyLocation);
    }

    this._sentPagingParams = false;
    if (this.shouldInterceptPaging()) {
      this.ensurePageSize();
      params.set("page", String(Math.max(1, this.page || 1)));
      params.set("pageSize", String(this.pageSize || 24));
      this._sentPagingParams = true;
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

  Widget.prototype.applyThemeProductCountVisibility = function (show) {
    var selectors = [
      "#ProductCount",
      "#ProductCountDesktop",
      ".product-count__text",
    ];
    for (var i = 0; i < selectors.length; i++) {
      var nodes = document.querySelectorAll(selectors[i]);
      for (var j = 0; j < nodes.length; j++) {
        var el = nodes[j];
        if (!el || el.closest && el.closest(".smart-filter")) continue;
        if (show) {
          if (el.getAttribute("data-findly-count-hidden") === "1") {
            el.removeAttribute("data-findly-count-hidden");
            el.style.display = el.getAttribute("data-findly-count-display") || "";
            el.removeAttribute("data-findly-count-display");
          }
        } else if (el.getAttribute("data-findly-count-hidden") !== "1") {
          el.setAttribute("data-findly-count-hidden", "1");
          el.setAttribute("data-findly-count-display", el.style.display || "");
          el.style.display = "none";
        }
      }
    }
  };

  Widget.prototype.updateStatus = function (payload, handles) {
    var total =
      payload && typeof payload.total === "number"
        ? payload.total
        : payload && typeof payload.count === "number"
          ? payload.count
          : null;

    if (this.showTotalProductCount === false) {
      if (
        this.hasActiveFilters() &&
        (total === 0 || (!handles.length && total == null))
      ) {
        setStatus(this.statusEl, this.t("no_match", MSG_NO_MATCH), false);
        return;
      }
      setStatus(this.statusEl, "", false);
      return;
    }

    if (this.hasActiveFilters()) {
      if (typeof total === "number") {
        setStatus(
          this.statusEl,
          total === 0
            ? this.t("no_match", MSG_NO_MATCH)
            : this.productCountLabel(total),
          false,
        );
        return;
      }
      if (!handles.length) {
        setStatus(this.statusEl, this.t("no_match", MSG_NO_MATCH), false);
        return;
      }
      setStatus(this.statusEl, this.productCountLabel(handles.length), false);
      return;
    }

    var count = total != null ? total : handles.length;
    if (
      (this.searchQuery || this.collectionQuery) &&
      (count === 0 || (typeof total === "number" ? total === 0 : !handles.length))
    ) {
      setStatus(this.statusEl, this.t("no_match", MSG_NO_MATCH), false);
      return;
    }
    setStatus(this.statusEl, count ? this.productCountLabel(count) : "", false);
  };

  Widget.prototype.hasNonThemeMatching = function () {
    return (
      this.hasActiveFilters() ||
      Boolean(this.collectionQuery) ||
      Boolean(this.sortKey && this.sortKey !== this.defaultSort) ||
      this.hasVariantCards()
    );
  };

  Widget.prototype.hasVariantCards = function () {
    var products = this._lastProducts || [];
    return products.some(function (item) {
      return item && (item.variantId || (item.cardKey && String(item.cardKey).indexOf("::") !== -1));
    });
  };

  Widget.prototype.shouldInterceptPaging = function () {
    if (this._pagingFallback) return false;
    if (
      this.paginationStyle === "load_more" ||
      this.paginationStyle === "infinite"
    ) {
      return true;
    }
    return this.hasNonThemeMatching();
  };

  Widget.prototype.ensureGridParent = function () {
    if (this._gridParent && this._gridParent.parentNode) return this._gridParent;
    this._gridParent = discoverGridParent();
    return this._gridParent;
  };

  Widget.prototype.findLayoutHost = function (grid) {
    if (!grid) return null;

    function wrapsGrid(el) {
      if (isDocumentRoot(el)) return false;
      return el === grid || (el.contains && el.contains(grid));
    }

    var byId = document.getElementById("ProductGridContainer");
    if (wrapsGrid(byId)) return byId;

    var i;
    var containers = document.querySelectorAll(
      "[class*='product-grid-container']",
    );
    for (i = 0; i < containers.length; i++) {
      if (wrapsGrid(containers[i])) return containers[i];
    }

    var collections = document.querySelectorAll(".collection");
    for (i = 0; i < collections.length; i++) {
      if (wrapsGrid(collections[i])) return collections[i];
    }

    var sections = document.querySelectorAll("main .shopify-section");
    for (i = 0; i < sections.length; i++) {
      if (wrapsGrid(sections[i])) return sections[i];
    }

    var parent = grid.parentElement;
    if (parent && !isDocumentRoot(parent)) return parent;
    return null;
  };

  Widget.prototype.inheritThemeType = function () {
    var sample = this.ensureGridParent() || document.body;
    if (!sample || typeof window.getComputedStyle !== "function") return;
    var cs = window.getComputedStyle(sample);
    this.root.style.setProperty("--sf-ink", cs.color);
    var fontMode = this.widgetFontMode || "theme";
    var useThemeFace = fontMode === "theme" || fontMode === "";
    if (useThemeFace) {
      this.root.style.fontFamily = cs.fontFamily;
      this.root.style.fontSize = cs.fontSize;
    } else {
      this.root.style.fontFamily = "";
      this.root.style.fontSize = cs.fontSize;
    }
  };

  Widget.prototype.scheduleLayoutRetry = function () {
    var self = this;
    if (this._layoutRetryTimer) return;
    if (this._layoutAttempts >= 8) return;
    this._layoutRetryTimer = window.setTimeout(function () {
      self._layoutRetryTimer = null;
      self._layoutAttempts += 1;
      self.syncCollectionLayout();
    }, 150);
  };

  Widget.prototype.placeAtMainFallback = function (mount) {
    if (!mount || this._layoutFallbackDone) return false;
    var main =
      document.getElementById("MainContent") ||
      document.querySelector("main");
    if (!main || isDocumentRoot(main)) return false;
    this._layoutFallbackDone = true;
    var originSection = mount.closest ? mount.closest(".shopify-section") : null;
    if (main.firstChild) {
      main.insertBefore(mount, main.firstChild);
    } else {
      main.appendChild(mount);
    }
    hideEmptyShopifySection(originSection, mount);
    return true;
  };

  Widget.prototype.syncCollectionLayout = function () {
    var mount = widgetMountNode(this.root);
    if (!mount) return;

    var grid = this.ensureGridParent();
    var position = POSITIONS[this.position] ? this.position : "left";

    if (!grid) {
      this.placeAtMainFallback(mount);
      if (this._layoutAttempts >= 8) {
        this.markFilterPlaced();
        return;
      }
      this.scheduleLayoutRetry();
      return;
    }

    this._layoutAttempts = 0;
    if (this._layoutRetryTimer) {
      window.clearTimeout(this._layoutRetryTimer);
      this._layoutRetryTimer = null;
    }

    var host = this.findLayoutHost(grid);
    if (!host && grid && !isDocumentRoot(grid)) host = grid;
    if (!host) {
      this.placeAtMainFallback(mount);
      this.markFilterPlaced();
      return;
    }

    var originSection = mount.closest ? mount.closest(".shopify-section") : null;
    var layout;

    if (host.contains(mount)) {
      applyLayoutPositionClass(host, position);
      placeMountInLayout(host, mount, position);
      layout = host;
    } else {
      layout =
        closestLayoutEl(mount) ||
        closestLayoutEl(host) ||
        (host.parentNode &&
        host.parentNode.classList &&
        host.parentNode.classList.contains("sf-collection-layout")
          ? host.parentNode
          : null);
      if (layout) {
        applyLayoutPositionClass(layout, position);
        if (host.parentNode !== layout) {
          layout.appendChild(host);
        }
        placeMountInLayout(layout, mount, position);
      } else {
        var parent = host.parentNode;
        if (!parent) {
          this.placeAtMainFallback(mount);
          this.markFilterPlaced();
          return;
        }
        layout = document.createElement("div");
        applyLayoutPositionClass(layout, position);
        parent.insertBefore(layout, host);
        layout.appendChild(host);
        placeMountInLayout(layout, mount, position);
      }
    }

    hideEmptyShopifySection(originSection, mount);
    this.markFilterPlaced();
    this.inheritThemeType();
  };

  Widget.prototype.markFilterPlaced = function () {
    this.root.classList.add("is-placed");
    this.root.setAttribute("data-placed", "true");
  };

  Widget.prototype.ensurePageSize = function () {
    if (this.pageSize >= 8 && this.pageSize <= 48) return this.pageSize;
    this.ensureGridParent();
    var n = 0;
    if (this._gridParent) {
      eachProductCard(this._gridParent, function () {
        n += 1;
      });
    }
    this.pageSize = clampPageSize(n);
    return this.pageSize;
  };

  Widget.prototype.cacheNativeCards = function () {
    var self = this;
    this.ensureGridParent();
    var root = this._gridParent || document;
    eachProductCard(root, function (handle, card) {
      if (String(handle).indexOf("::") !== -1) return;
      if (!self._cardCache[handle]) {
        self._cardCache[handle] = card;
        self._nativeHandles[handle] = true;
      }
    });
    var current = currentThemePage();
    this._themePagesCached[current] = true;
  };

  Widget.prototype.cloneVariantCard = function (product) {
    var handle = String(product.handle || "").toLowerCase();
    var key = String(product.cardKey || "").toLowerCase();
    if (!key || key === handle) return null;
    var proto = this._cardCache[handle];
    if (!proto) {
      var first = null;
      for (var cached in this._nativeHandles) {
        if (this._cardCache[cached]) {
          first = this._cardCache[cached];
          break;
        }
      }
      proto = first;
    }
    if (!proto) return null;
    var clone;
    try {
      clone = proto.cloneNode(true);
    } catch (err) {
      return null;
    }
    clone.setAttribute("data-sf-card-key", key);
    clone.setAttribute("data-sf-variant-clone", "1");
    var url =
      product.url ||
      "/products/" +
        handle +
        (product.variantId ? "?variant=" + product.variantId : "");
    var links = clone.querySelectorAll('a[href*="/products/"]');
    for (var i = 0; i < links.length; i++) {
      links[i].setAttribute("href", url);
    }
    var img = clone.querySelector("img");
    var imageUrl = product.variantImageUrl || product.imageUrl || "";
    if (img && imageUrl) {
      if (!img.getAttribute("data-sf-orig-src")) {
        img.setAttribute("data-sf-orig-src", img.getAttribute("src") || "");
      }
      img.setAttribute("src", imageUrl);
      if (img.getAttribute("srcset")) img.removeAttribute("srcset");
    }
    var heading = clone.querySelector(
      ".card__heading, .card__title, .product-card-title, h3, h2",
    );
    if (heading && product.title) {
      heading.textContent = product.title;
    }
    return clone;
  };

  Widget.prototype.ensureVariantCards = function (products) {
    this.cacheNativeCards();
    var list = products || [];
    for (var i = 0; i < list.length; i++) {
      var item = list[i];
      if (!item || !item.variantId) continue;
      var key = String(item.cardKey || "").toLowerCase();
      if (!key || this._cardCache[key]) continue;
      var clone = this.cloneVariantCard(item);
      if (clone) this._cardCache[key] = clone;
    }
  };

  Widget.prototype.importCardsFromDocument = function (doc) {
    var self = this;
    var added = 0;
    eachProductCard(doc, function (handle, card) {
      if (self._cardCache[handle]) return;
      try {
        var imported = document.importNode(card, true);
        self._cardCache[handle] = imported;
        self._importedHandles[handle] = true;
        added += 1;
      } catch (err) {
        /* skip un-importable node */
      }
    });
    return added;
  };

  Widget.prototype.missingHandles = function (handles) {
    var self = this;
    return uniqueHandleList(handles).filter(function (handle) {
      if (self._cardCache[handle]) return false;
      if (String(handle).indexOf("::") !== -1) return false;
      return true;
    });
  };

  Widget.prototype.fetchThemePage = function (page) {
    var self = this;
    if (this._themePagesCached[page]) return Promise.resolve(true);
    var href = themePageHref(page);
    return fetch(href, { credentials: "same-origin" })
      .then(function (response) {
        if (!response.ok) throw new Error("theme page");
        return response.text();
      })
      .then(function (html) {
        var doc;
        try {
          doc = new DOMParser().parseFromString(html, "text/html");
        } catch (err) {
          return false;
        }
        if (!doc) return false;
        var added = self.importCardsFromDocument(doc);
        self._themePagesCached[page] = true;
        if (!added && page !== currentThemePage()) {
          self._themeNoMore = true;
        }
        return true;
      })
      .catch(function () {
        return false;
      });
  };

  Widget.prototype.ensureCardsForHandles = function (handles) {
    var self = this;
    this.cacheNativeCards();
    if (!this._gridParent) return Promise.resolve(false);
    if (!this.missingHandles(handles).length) return Promise.resolve(true);

    function hasAnyRequested() {
      var list = uniqueHandleList(handles);
      if (!list.length) return true;
      return list.some(function (handle) {
        return Boolean(self._cardCache[handle]);
      });
    }

    function step(page) {
      if (!self.missingHandles(handles).length) return Promise.resolve(true);
      if (page > THEME_PAGE_FETCH_MAX || self._themeNoMore) {
        return Promise.resolve(hasAnyRequested());
      }
      return self.fetchThemePage(page).then(function (ok) {
        if (!ok) return false;
        return step(page + 1);
      });
    }

    return step(1);
  };

  Widget.prototype.setThemePagerHidden = function (hide) {
    var nodes = document.querySelectorAll(THEME_PAGER_SELECTOR);
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (!el || isPagingChrome(el)) continue;
      if (el.classList && el.classList.contains("sf-pager")) continue;
      if (hide) {
        if (el.getAttribute("data-sf-pager-hidden") === "1") continue;
        el.setAttribute("data-sf-pager-hidden", "1");
        el.setAttribute("data-sf-pager-display", el.style.display || "");
        el.style.display = "none";
      } else if (el.getAttribute("data-sf-pager-hidden") === "1") {
        el.style.display = el.getAttribute("data-sf-pager-display") || "";
        el.removeAttribute("data-sf-pager-hidden");
        el.removeAttribute("data-sf-pager-display");
      }
    }
  };

  Widget.prototype.removeImportedCards = function () {
    var self = this;
    Object.keys(this._importedHandles).forEach(function (handle) {
      var card = self._cardCache[handle];
      if (card && card.parentNode) {
        card.parentNode.removeChild(card);
      }
    });
  };

  Widget.prototype.restoreThemePaging = function () {
    this.disconnectInfinite();
    this.setThemePagerHidden(false);
    if (this._pagerEl) this._pagerEl.hidden = true;
    this.removeImportedCards();
  };

  Widget.prototype.enterPagingFallback = function (handles, data) {
    this._pagingFallback = true;
    this._appending = false;
    this._loadingPage = false;
    this.restoreThemePaging();
    if (handles) {
      applyProductVisibility(handles);
      applyProductOrder(handles);
      applyVariantImages(
        this.showMatchingVariantImage === false
          ? []
          : data && data.products,
      );
      dispatchUpdate(handles);
      if (data) this.updateStatus(data, handles);
    }
  };

  Widget.prototype.applyInterceptGrid = function (handles, append) {
    var parent = this.ensureGridParent();
    if (!parent) return false;
    var next = append ? this._shownHandles.slice() : [];
    uniqueHandleList(handles).forEach(function (handle) {
      if (next.indexOf(handle) === -1) next.push(handle);
    });
    var allowed = {};
    var shown = [];
    var i;
    for (i = 0; i < next.length; i++) {
      var handle = next[i];
      var card = this._cardCache[handle];
      if (!card) continue;
      allowed[handle] = true;
      shown.push(handle);
      if (card.parentNode !== parent) {
        parent.appendChild(card);
      } else {
        parent.appendChild(card);
      }
      card.hidden = false;
      card.removeAttribute("data-smart-filter-hidden");
    }
    if (!shown.length && next.length) return false;
    eachProductCard(parent, function (handle, card) {
      if (allowed[handle]) return;
      card.hidden = true;
      card.setAttribute("data-smart-filter-hidden", "true");
    });
    this._shownHandles = shown;
    return true;
  };

  Widget.prototype.ensurePagerEl = function () {
    if (this._pagerEl && this._pagerEl.parentNode) return this._pagerEl;
    var el = document.createElement("nav");
    el.className = "sf-pager";
    el.setAttribute("aria-label", this.t("pagination", "Pagination"));
    var grid = this._gridParent;
    if (grid && grid.parentNode) {
      if (grid.nextSibling) {
        grid.parentNode.insertBefore(el, grid.nextSibling);
      } else {
        grid.parentNode.appendChild(el);
      }
    } else if (this.root.parentNode) {
      if (this.root.nextSibling) {
        this.root.parentNode.insertBefore(el, this.root.nextSibling);
      } else {
        this.root.parentNode.appendChild(el);
      }
    } else {
      document.body.appendChild(el);
    }
    this._pagerEl = el;
    return el;
  };

  Widget.prototype.disconnectInfinite = function () {
    if (this._infiniteObserver) {
      this._infiniteObserver.disconnect();
      this._infiniteObserver = null;
    }
  };

  Widget.prototype.readPagingMeta = function (data, handles) {
    if (typeof data.page === "number" && data.page >= 1) {
      this.page = Math.floor(data.page);
    }
    if (typeof data.pageSize === "number" && data.pageSize >= 1) {
      this.pageSize = clampPageSize(data.pageSize);
    }
    this._pageTotal =
      typeof data.total === "number"
        ? data.total
        : typeof data.count === "number"
          ? data.count
          : handles.length;
    if (typeof data.hasNext === "boolean") {
      this._hasNext = data.hasNext;
    } else if (this.pageSize) {
      this._hasNext = this.page * this.pageSize < this._pageTotal;
    } else {
      this._hasNext = handles.length >= (this.pageSize || 24);
    }
  };

  Widget.prototype.loadNextPage = function () {
    if (this._loadingPage || !this._hasNext) return;
    this._loadingPage = true;
    this.page = Math.max(1, this.page || 1) + 1;
    this.renderPager();
    this.fetchFilters({ append: true });
  };

  Widget.prototype.goToPage = function (page) {
    var next = Math.max(1, Math.floor(Number(page) || 1));
    if (next === this.page || this._loadingPage) return;
    this.fetchFilters({ page: next });
  };

  Widget.prototype.bindInfinite = function (sentinel) {
    var self = this;
    this.disconnectInfinite();
    if (!sentinel) return;
    if (typeof window.IntersectionObserver !== "function") {
      this.renderLoadMore(this.ensurePagerEl());
      return;
    }
    this._infiniteObserver = new IntersectionObserver(
      function (entries) {
        var hit = false;
        for (var i = 0; i < entries.length; i++) {
          if (entries[i].isIntersecting) hit = true;
        }
        if (!hit) return;
        if (self._loadingPage || !self._hasNext) return;
        self.disconnectInfinite();
        self.loadNextPage();
      },
      { root: null, rootMargin: "400px", threshold: 0 },
    );
    this._infiniteObserver.observe(sentinel);
  };

  Widget.prototype.renderLoadMore = function (el) {
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
    btn.addEventListener(
      "click",
      function () {
        this.loadNextPage();
      }.bind(this),
    );
    el.appendChild(btn);
  };

  Widget.prototype.renderNumberedPager = function (el) {
    var size = this.pageSize || 24;
    var total = this._pageTotal || 0;
    var pageCount = Math.max(1, Math.ceil(total / size) || 1);
    var page = Math.max(1, this.page || 1);
    el.innerHTML = "";
    if (pageCount <= 1) {
      el.hidden = true;
      return;
    }
    el.hidden = false;
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
        btn.className = "sf-pager__page" + (item === page ? " is-current" : "");
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

  Widget.prototype.renderPager = function () {
    var el = this.ensurePagerEl();
    var style = this.paginationStyle;
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
      sentinel.className = "sf-pager__sentinel";
      sentinel.setAttribute("aria-hidden", "true");
      el.appendChild(sentinel);
      this.bindInfinite(sentinel);
      return;
    }
    this.disconnectInfinite();
    this.renderNumberedPager(el);
  };

  Widget.prototype.finishEnabledFalse = function () {
    this.page = 1;
    this._shownHandles = [];
    this._lastProducts = [];
    this._hasNext = false;
    this.restoreThemePaging();
  };

  Widget.prototype.applyThemeGridLegacy = function (data, handles) {
    this.restoreThemePaging();
    this.ensureVariantCards((data && data.products) || this._lastProducts);
    if (this.hasVariantCards() && this.applyInterceptGrid(handles, false)) {
      applyVariantImages(
        this.showMatchingVariantImage === false ? [] : data && data.products,
      );
      dispatchUpdate(handles);
      return;
    }
    applyProductVisibility(handles);
    applyProductOrder(handles);
    applyVariantImages(
      this.showMatchingVariantImage === false ? [] : data && data.products,
    );
    dispatchUpdate(handles);
  };

  Widget.prototype.fetchFilters = function (opts) {
    opts = opts || {};
    var append = Boolean(opts.append);
    this._appending = append;
    if (!append) {
      this.page = opts.page != null ? Math.max(1, Number(opts.page) || 1) : 1;
      this._shownHandles = [];
      this._lastProducts = [];
      this._pagingFallback = false;
      this._loadingPage = false;
    }

    var reqId = append ? this._reqId : ++this._reqId;
    if (!append) {
      setStatus(this.statusEl, this.t("loading", MSG_LOADING), false);
    }
    writeHash(this.selected, this.price, this.sortKey, this.collectionQuery);
    this.cacheNativeCards();
    this.ensurePageSize();

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
            this.applyI18n(data);
            this.applySettings(data && data.settings);
            this.applyI18nChrome();
            this.facets = [];
            if (this.facetsEl) this.facetsEl.innerHTML = "";
            applyProductVisibility(null);
            applyVariantImages([]);
            dispatchUpdate([]);
            setStatus(this.statusEl, this.t("disabled", MSG_DISABLED), false);
            this.syncDrawerBadge();
            this.finishEnabledFalse();
            return;
          }

          var sentPaging = this._sentPagingParams;
          this.applyI18n(data);
          this.applySettings(data && data.settings);
          this.applyI18nChrome();

          if (!append) {
            this.facets = normalizeFacets(data);
            this.renderFacets();
          }

          if (!append && this.shouldInterceptPaging() && !sentPaging) {
            return this.fetchFilters({ page: 1 });
          }

          var handles = extractHandles(data);
          this.readPagingMeta(data, handles);
          if (
            this._sentPagingParams &&
            handles.length > this.pageSize &&
            data.page == null &&
            data.hasNext == null
          ) {
            this._pageTotal = handles.length;
            var sliceStart = (Math.max(1, this.page) - 1) * this.pageSize;
            handles = handles.slice(sliceStart, sliceStart + this.pageSize);
            this._hasNext = sliceStart + this.pageSize < this._pageTotal;
          }
          if (append) {
            this._lastProducts = (this._lastProducts || []).concat(
              data && data.products ? data.products : [],
            );
          } else {
            this._lastProducts = (data && data.products) || [];
          }

          var intercept = this.shouldInterceptPaging();
          var self = this;

          function afterGrid(visible) {
            applyVariantImages(
              self.showMatchingVariantImage === false ? [] : self._lastProducts,
            );
            dispatchUpdate(visible);
            self.updateStatus(data, visible);
            self.syncDrawerBadge();
            if (!append) {
              var tracked = activeFilterCombo(self.selected, self.price);
              if (tracked.facetCount >= 2) {
                fireAnalytics(self.proxyBase, {
                  kind: "filter",
                  combo: tracked.combo,
                });
              }
            }
          }

          if (!intercept) {
            this._loadingPage = false;
            this._appending = false;
            this.ensureVariantCards(this._lastProducts);
            this.applyThemeGridLegacy(data, handles);
            afterGrid(handles);
            return;
          }

          this.ensureVariantCards(this._lastProducts);
          return this.ensureCardsForHandles(handles).then(function (ok) {
            if (reqId !== self._reqId) return;
            self._loadingPage = false;
            self._appending = false;
            if (!ok) {
              self.enterPagingFallback(handles, data);
              self.syncDrawerBadge();
              return;
            }
            var applied = self.applyInterceptGrid(handles, append);
            if (!applied) {
              self.enterPagingFallback(handles, data);
              self.syncDrawerBadge();
              return;
            }
            self.setThemePagerHidden(true);
            self.renderPager();
            afterGrid(self._shownHandles.length ? self._shownHandles : handles);
          });
        }.bind(this),
      )
      .catch(
        function () {
          if (reqId !== this._reqId) return;
          setStatus(this.statusEl, this.t("error", MSG_ERROR), true);
          if (append) {
            this.page = Math.max(1, (this.page || 1) - 1);
            this._loadingPage = false;
            this._appending = false;
            this.renderPager();
            return;
          }
          this.enterPagingFallback(null);
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
        (this.price.min !== ""
          ? formatMoney(this.price.min, this.currency)
          : "Min") +
        " – " +
        (this.price.max !== ""
          ? formatMoney(this.price.max, this.currency)
          : "Max") +
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

    var chips = this.showRefineBy === false ? null : this.renderChips();
    if (chips) this.facetsEl.appendChild(chips);

    this.facets.forEach(
      function (facet) {
        var selectedCount = this.selectedCount(facet);
        var isPrice =
          facet.type === "price_range" || facet.displayType === "slider";
        if (
          this.hideSingleValueFacets &&
          !isPrice &&
          (facet.values || []).length <= 1 &&
          selectedCount === 0
        ) {
          return;
        }

        var wrap = document.createElement("div");
        wrap.className = "smart-filter__facet";
        wrap.setAttribute("data-facet-key", facet.key);
        if (this.isFacetCollapsed(facet.key)) {
          wrap.classList.add("is-collapsed");
        }

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
        } else if (facet.displayType === "collection") {
          wrap.appendChild(this.renderCollectionFacet(facet));
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
      clear.textContent = this.t("clear", MSG_CLEAR);
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
    any.textContent = this.t("any", "Any");
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

  Widget.prototype.renderCollectionFacet = function (facet) {
    var list = document.createElement("ul");
    list.className =
      "smart-filter__options smart-filter__options--collection-nav" +
      (facet.collectionTree ? " smart-filter__options--collection-tree" : "");
    this.appendCollectionNavItems(list, facet.values || []);
    return list;
  };

  Widget.prototype.appendCollectionNavItems = function (list, items) {
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
        var href =
          item.url ||
          (item.handle ? "/collections/" + String(item.handle).replace(/^\/+|\/+$/g, "") : "");
        var li = document.createElement("li");
        var link = document.createElement("a");
        link.className = "smart-filter__option smart-filter__collection-link";
        link.href = href || "#";
        link.textContent = labelText;
        if (href) {
          link.addEventListener("click", function (event) {
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            event.preventDefault();
            window.location.assign(href);
          });
        }
        li.appendChild(link);
        if (item.children && item.children.length) {
          var nested = document.createElement("ul");
          nested.className = "smart-filter__tree-children";
          this.appendCollectionNavItems(nested, item.children);
          li.appendChild(nested);
        }
        list.appendChild(li);
      }.bind(this),
    );
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
    var asRating = facet.source === "rating" || facet.key === "rating";
    list.className =
      "smart-filter__options" +
      (asColor ? " smart-filter__options--swatches" : "") +
      (asSize ? " smart-filter__options--pills" : "") +
      (asBoolean ? " smart-filter__options--boolean" : "") +
      (asRating ? " smart-filter__options--stars" : "") +
      (asSwatchText ? " smart-filter__options--swatch-text" : "") +
      (asPlainList ? " smart-filter__options--list" : "") +
      (facet.collectionTree || facet.source === "collection"
        ? " smart-filter__options--collection-tree"
        : "");
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

    var addItems = function (targetList, nodeItems) {
    nodeItems.forEach(
      function (item) {
        var value = String(
          item.value != null
            ? item.value
            : item.handle != null
              ? item.handle
              : item.label || item,
        );
        var labelText = String(item.label != null ? item.label : value);
        if (isAvailability) {
          var stockKey = String(value).toLowerCase();
          if (
            stockKey === "true" ||
            stockKey === "1" ||
            stockKey === "in_stock" ||
            /in stock/i.test(labelText)
          ) {
            labelText = this.t("in_stock", labelText);
          } else if (
            stockKey === "false" ||
            stockKey === "0" ||
            stockKey === "out_of_stock" ||
            /out of stock/i.test(labelText)
          ) {
            labelText = this.t("out_of_stock", labelText);
          }
        }
        var count = item.count;
        var empty = typeof count === "number" && count === 0;

        var li = document.createElement("li");
        var label = document.createElement("label");
        label.className = "smart-filter__option";
        if (asColor) label.className += " smart-filter__swatch";
        if (asSwatchText) label.className += " smart-filter__swatch-text";
        if (asSize) label.className += " smart-filter__pill";
        label.title = labelText + (typeof count === "number" ? " (" + count + ")" : "");

        if (asColor) applyFacetSwatch(label, item, labelText, value);

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
        if (asRating) {
          var filled = Math.max(0, Math.min(5, Math.round(Number(value) || 0)));
          text.className += " smart-filter__stars";
          text.setAttribute(
            "aria-label",
            filled + " stars " + this.t("and_up", "and up"),
          );
          for (var s = 1; s <= 5; s += 1) {
            var star = document.createElement("span");
            star.className =
              "smart-filter__star" + (s <= filled ? " is-on" : "");
            star.textContent = s <= filled ? "★" : "☆";
            text.appendChild(star);
          }
        } else {
          text.textContent = labelText;
        }
        label.appendChild(input);
        label.appendChild(text);

        if (showCounts && typeof count === "number") {
          var countEl = document.createElement("span");
          countEl.className = "smart-filter__option-count";
          countEl.textContent = String(count);
          label.appendChild(countEl);
        }

        li.appendChild(label);
        if (item.children && item.children.length) {
          var nested = document.createElement("ul");
          nested.className = "smart-filter__tree-children";
          addItems(nested, item.children);
          li.appendChild(nested);
        }
        targetList.appendChild(li);
      }.bind(this),
    );
    };
    addItems(list, items);

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
    minLabel.textContent = this.t("min", MSG_MIN);
    var minInput = document.createElement("input");
    minInput.type = "number";
    minInput.inputMode = "decimal";
    if (hasBounds) {
      minInput.min = String(boundMin);
      minInput.max = String(boundMax);
      minInput.placeholder = String(boundMin);
    } else {
      minInput.placeholder = this.t("min", MSG_MIN);
    }
    minInput.value = current[0] || "";
    minField.appendChild(minLabel);
    minField.appendChild(minInput);

    var maxField = document.createElement("div");
    maxField.className = "smart-filter__price-field";
    var maxLabel = document.createElement("span");
    maxLabel.className = "smart-filter__field-label";
    maxLabel.textContent = this.t("max", MSG_MAX);
    var maxInput = document.createElement("input");
    maxInput.type = "number";
    maxInput.inputMode = "decimal";
    if (hasBounds) {
      maxInput.min = String(boundMin);
      maxInput.max = String(boundMax);
      maxInput.placeholder = String(boundMax);
    } else {
      maxInput.placeholder = this.t("max", MSG_MAX);
    }
    maxInput.value = current[1] || "";
    maxField.appendChild(maxLabel);
    maxField.appendChild(maxInput);

    var actions = document.createElement("div");
    actions.className = "smart-filter__price-actions";
    var apply = document.createElement("button");
    apply.type = "button";
    apply.className = "smart-filter__btn smart-filter__btn--primary";
    apply.textContent = this.t("apply", MSG_APPLY);
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
      setStatus(this.statusEl, this.t("error", MSG_ERROR), true);
      return;
    }
    this.syncCollectionLayout();
    this.inheritThemeType();
    this.restoreFromHash();
    this.fetchFilters();
  };

  function boot() {
    var block = document.getElementById("smart-filter-root");
    var embed = document.getElementById("smart-filter-embed");
    if (block && embed && embed !== block) {
      if (embed.parentNode) embed.parentNode.removeChild(embed);
    }
    var root = block || embed;
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
