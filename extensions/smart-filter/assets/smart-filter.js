(function () {
  "use strict";

  if (!window.__FINDLY_PRIVACY) {
    window.__FINDLY_PRIVACY = {
      _q: [],
      run: function (fn) {
        this._q.push(fn);
      },
      visitorId: function () {
        return "";
      },
    };
  }

  var HASH_KEY = "sf";
  var DEBOUNCE_MS = 300;
  var MSG_LOADING = "Loading filters…";
  var MSG_ERROR = "Filters could not be loaded. Please try again.";
  var MSG_NO_MATCH = "No matching products.";
  var MSG_DISABLED = "Filters are not enabled for this collection.";
  var MSG_CLEAR = "Clear All";
  var MSG_MIN = "Min";
  var MSG_MAX = "Max";
  var MSG_APPLY_NOW = "Apply now";
  var POSITIONS = { left: true, right: true, top: true, offcanvas: true };
  var FILTER_CACHE_PREFIX = "findly:filters:v1:";
  var FILTER_CACHE_TTL_MS = 5 * 1000;
  /** Keep in sync with app/limits.ts SIZE_FACET_MATCH_RATIO / SIZE_NUMERIC_RANK_BASE. */
  var SIZE_FACET_MATCH_RATIO = 0.6;
  var SIZE_NUMERIC_RANK_BASE = 1000;
  var COLOR_FACET_MATCH_RATIO = 0.5;
  var CARD_SELECTOR = [
    ".sf-app-card",
    "product-card",
    "product-item",
    "grid-item",
    "[data-product-id]",
    ".product-card",
    ".card-wrapper",
    ".grid__item",
    ".product-grid-item",
    ".product-grid__item",
    "li",
    "article",
  ].join(", ");

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

  function readFilterCache(key) {
    if (!key) return null;
    try {
      var raw = window.sessionStorage.getItem(key);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return null;
      if (Number(parsed.expires) < Date.now()) {
        window.sessionStorage.removeItem(key);
        return null;
      }
      return parsed.data && typeof parsed.data === "object" ? parsed.data : null;
    } catch (err) {
      return null;
    }
  }

  function writeFilterCache(key, data) {
    if (!key || !data || data.enabled === false) return;
    try {
      window.sessionStorage.setItem(
        key,
        JSON.stringify({
          expires: Date.now() + FILTER_CACHE_TTL_MS,
          data: {
            enabled: true,
            settings: data.settings || {},
            facets: data.facets || [],
            i18n: data.i18n || {},
            locale: data.locale || "",
          },
        }),
      );
    } catch (err) {
      /* quota / private mode */
    }
  }

  function deviceKind() {
    return window.innerWidth < 750 ? "mobile" : "desktop";
  }

  function visitorId() {
    var privacy = window.__FINDLY_PRIVACY;
    if (privacy && typeof privacy.visitorId === "function") {
      return privacy.visitorId() || "";
    }
    return "";
  }

  var lastAnalyticsStamp = "";
  var lastAnalyticsAt = 0;

  function fireAnalytics(proxyBase, fields) {
    var privacy = window.__FINDLY_PRIVACY;
    if (!privacy || typeof privacy.run !== "function") return;
    privacy.run(function () {
      sendAnalytics(proxyBase, fields);
    });
  }

  function sendAnalytics(proxyBase, fields) {
    var vid = visitorId();
    if (!vid) return;
    var stamp =
      String(fields.kind || "") +
      "|" +
      String(fields.combo || "") +
      "|" +
      String(fields.q || "");
    var now = Date.now();
    if (stamp === lastAnalyticsStamp && now - lastAnalyticsAt < 2000) return;
    lastAnalyticsStamp = stamp;
    lastAnalyticsAt = now;
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
      encodeURIComponent(vid) +
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

  function logFilterError(message, err) {
    if (typeof console === "undefined" || typeof console.error !== "function") {
      return;
    }
    if (err) console.error("[Findly]", message, err);
    else console.error("[Findly]", message);
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

  function displayTitle(value, fallback) {
    var text = String(value == null || value === "" ? fallback || "Filter" : value).trim();
    return text.replace(/:\s*$/, "").trim() || fallback || "Filter";
  }

  function valuesHaveChildren(values) {
    return (values || []).some(function (item) {
      return item && item.children && item.children.length;
    });
  }

  function nestPathLabels(values) {
    if (!values || !values.length || valuesHaveChildren(values)) return values || [];
    var hasPath = values.some(function (item) {
      return String(item && item.label != null ? item.label : "").indexOf(" > ") !== -1;
    });
    if (!hasPath) return values;

    var roots = [];
    var byPath = {};

    function ensureNode(path, label, leafItem) {
      if (byPath[path]) {
        if (leafItem) {
          byPath[path].value =
            leafItem.value != null ? leafItem.value : leafItem.label;
          byPath[path].count =
            typeof leafItem.count === "number" ? leafItem.count : byPath[path].count;
          byPath[path].handle = leafItem.handle || byPath[path].handle;
          byPath[path].url = leafItem.url || byPath[path].url;
          byPath[path].synthetic = false;
          if (leafItem.swatch) byPath[path].swatch = leafItem.swatch;
        }
        return byPath[path];
      }
      var node = {
        value: leafItem && leafItem.value != null ? leafItem.value : "path:" + path,
        label: label,
        count: leafItem && typeof leafItem.count === "number" ? leafItem.count : 0,
        children: [],
        synthetic: !leafItem,
        handle: leafItem && leafItem.handle,
        url: leafItem && leafItem.url,
      };
      byPath[path] = node;
      return node;
    }

    values.forEach(function (item) {
      var label = String(item.label != null ? item.label : item.value || "");
      var parts = label
        .split(/\s*>\s*/)
        .map(function (part) {
          return part.trim();
        })
        .filter(Boolean);
      if (parts.length < 2) {
        roots.push(item);
        return;
      }
      var path = "";
      var parent = null;
      parts.forEach(function (part, index) {
        path = path ? path + " > " + part : part;
        var node = ensureNode(path, part, index === parts.length - 1 ? item : null);
        if (index === 0) {
          if (roots.indexOf(node) === -1) roots.push(node);
        } else if (parent && parent.children.indexOf(node) === -1) {
          parent.children.push(node);
        }
        parent = node;
      });
    });

    function walk(node) {
      (node.children || []).forEach(walk);
      var members = [];
      if (!node.synthetic && node.value && String(node.value).indexOf("path:") !== 0) {
        members.push(String(node.value));
      }
      (node.children || []).forEach(function (child) {
        members = members.concat(child.memberValues || []);
      });
      node.memberValues = members;
      if (node.synthetic) {
        node.count = (node.children || []).reduce(function (acc, child) {
          return acc + (Number(child.count) || 0);
        }, 0);
      }
      if (node.children && !node.children.length) delete node.children;
    }
    roots.forEach(walk);
    return roots;
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
    return colorish / values.length >= COLOR_FACET_MATCH_RATIO;
  }

  function sizeRank(raw) {
    var value = String(raw || "")
      .trim()
      .toLowerCase();
    if (!value) return null;
    var numeric = value.match(/^(\d+(\.\d+)?)/);
    if (numeric) return SIZE_NUMERIC_RANK_BASE + Number(numeric[1]);
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
    function walk(values) {
      var list = values || [];
      for (var i = 0; i < list.length; i++) {
        var item = list[i];
        if (!item) continue;
        var itemValue = String(item.value != null ? item.value : item.label || "");
        var handle = String(item.handle || "");
        if (itemValue === String(value) || (handle && handle === String(value))) {
          var label = String(item.label != null ? item.label : "").trim();
          if (label && label.indexOf("gid://") !== 0) return label;
          if (handle) return handle;
        }
        var nested = walk(item.children);
        if (nested) return nested;
      }
      return "";
    }
    var list = facets || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].key !== key) continue;
      var found = walk(list[i].values);
      if (found) return found;
    }
    var raw = String(value == null ? "" : value);
    return raw.indexOf("gid://") === 0 ? "" : raw;
  }

  function isSizeFacet(facet) {
    var text = String(facet.label || facet.key || "");
    if (/\bsizes?\b/i.test(text) && !/length|width|weight/i.test(text)) {
      return true;
    }
    var values = facet.values || [];
    if (values.length < 2) return false;
    var sized = 0;
    values.forEach(function (item) {
      var value = String(item.value != null ? item.value : item.label || "").trim();
      if (/^(x{0,3}[sml]|xxl|\d+\s*xl)$/i.test(value)) sized += 1;
    });
    return sized / values.length >= SIZE_FACET_MATCH_RATIO;
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

  function closestGridHost(link) {
    if (!link) return null;
    var el = link.parentElement;
    while (el && el.nodeType === 1 && !isDocumentRoot(el)) {
      if (isProductCardGrid(el)) return el;
      el = el.parentElement;
    }
    return null;
  }

  function isBareProductLink(el) {
    return Boolean(el && String(el.tagName || "").toLowerCase() === "a");
  }

  function closestProductCard(link) {
    if (!link) return link;
    var grid = closestGridHost(link);
    if (grid) {
      var node = link;
      while (node && node.parentElement && node.parentElement !== grid) {
        node = node.parentElement;
      }
      if (
        node &&
        node.parentElement === grid &&
        isLikelyProductCard(node) &&
        !isBareProductLink(node)
      ) {
        return node;
      }
    }
    var viaHost =
      link.closest &&
      link.closest(
        "product-card, product-item, grid-item, li.grid__item, .grid__item, .product-card, .sf-app-card",
      );
    if (viaHost && isLikelyProductCard(viaHost)) return viaHost;
    var viaSel = (link.closest && link.closest(CARD_SELECTOR)) || null;
    if (viaSel && isLikelyProductCard(viaSel) && !isBareProductLink(viaSel)) {
      return viaSel;
    }
    if (isBareProductLink(link) && link.closest) {
      var fromLink = link.closest(
        "product-card, product-item, grid-item, li.grid__item, .grid__item, .card-wrapper, .product-card",
      );
      if (fromLink && isLikelyProductCard(fromLink) && !isBareProductLink(fromLink)) {
        return fromLink;
      }
    }
    return null;
  }

  function setCardHidden(card, hidden) {
    if (!card || card.nodeType !== 1) return;
    if (hidden) {
      card.hidden = true;
      card.setAttribute("data-smart-filter-hidden", "true");
      card.style.setProperty("display", "none", "important");
    } else {
      card.hidden = false;
      card.removeAttribute("data-smart-filter-hidden");
      card.style.removeProperty("display");
    }
  }

  function allowedHandleMap(handles) {
    var allowed = {};
    (handles || []).forEach(function (handle) {
      var key = String(handle || "").toLowerCase();
      if (!key) return;
      allowed[key] = true;
      var base = key.split("::")[0];
      if (base) allowed[base] = true;
    });
    return allowed;
  }

  function handleIsAllowed(allowed, handle) {
    if (!allowed) return true;
    var key = String(handle || "").toLowerCase();
    if (allowed[key]) return true;
    var base = key.split("::")[0];
    return Boolean(base && allowed[base]);
  }

  function applyProductVisibility(handles) {
    var allowed = Array.isArray(handles) ? allowedHandleMap(handles) : null;

    var links = document.querySelectorAll('a[href*="/products/"]');
    var seen = typeof WeakSet !== "undefined" ? new WeakSet() : null;
    var seenList = seen ? null : [];

    links.forEach(function (link) {
      if (isPagingChrome(link) || isSkippedRegion(link)) return;
      var handle = handleFromHref(link.getAttribute("href"));
      if (!handle) return;

      var card = closestProductCard(link);
      if (isSkippedRegion(card)) return;
      if (isBareProductLink(card)) return;
      if (seen) {
        if (seen.has(card)) return;
        seen.add(card);
      } else {
        if (seenList.indexOf(card) !== -1) return;
        seenList.push(card);
      }

      if (!allowed) {
        setCardHidden(card, false);
        return;
      }

      setCardHidden(card, !handleIsAllowed(allowed, handle));
    });
  }

  function shopifyImageKey(url) {
    if (!url) return "";
    var path = String(url).split("?")[0];
    try {
      path = new URL(url, window.location.origin).pathname;
    } catch (err) {
      /* keep path */
    }
    return path.replace(
      /_(?:pico|icon|thumb|small|compact|medium|large|grande|original|master|\d+x\d+)(?:@\d+x)?(?=\.[a-z]+$)/i,
      "",
    );
  }

  function shopifyImageWithWidth(url, width) {
    if (!url) return url;
    try {
      var parsed = new URL(url, window.location.origin);
      if (width) parsed.searchParams.set("width", String(width));
      return parsed.toString();
    } catch (err) {
      return url;
    }
  }

  function setThemeCardImage(img, nextUrl) {
    if (!img) return;
    var cur = img.getAttribute("src") || "";
    var orig = img.getAttribute("data-sf-orig-src") || cur;
    var origSet =
      img.getAttribute("data-sf-orig-srcset") || img.getAttribute("srcset") || "";
    if (!img.getAttribute("data-sf-orig-src")) {
      img.setAttribute("data-sf-orig-src", orig);
      img.setAttribute("data-sf-orig-srcset", origSet);
    }
    if (!nextUrl) {
      if (orig) img.setAttribute("src", orig);
      if (origSet) img.setAttribute("srcset", origSet);
      else img.removeAttribute("srcset");
      return;
    }
    var nextKey = shopifyImageKey(nextUrl);
    if (
      nextKey &&
      (nextKey === shopifyImageKey(cur) || nextKey === shopifyImageKey(orig))
    ) {
      if (origSet && !img.getAttribute("srcset")) img.setAttribute("srcset", origSet);
      return;
    }
    img.setAttribute("src", shopifyImageWithWidth(nextUrl, img.getAttribute("width")));
    if (!origSet) {
      img.removeAttribute("srcset");
      return;
    }
    img.setAttribute(
      "srcset",
      origSet
        .split(",")
        .map(function (part) {
          var bits = part.trim().split(/\s+/);
          var desc = bits.slice(1).join(" ");
          var wide = desc.match(/(\d+)w/);
          return (
            shopifyImageWithWidth(nextUrl, wide ? wide[1] : "") +
            (desc ? " " + desc : "")
          );
        })
        .join(", "),
    );
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

    /* Scope to the product grid when known — full-document scans thrash large themes. */
    var scanRoot = document;
    try {
      var live = window.__FINDLY_FILTER_WIDGET;
      if (live && live._gridParent && live._gridParent.querySelectorAll) {
        scanRoot = live._gridParent;
      }
    } catch (err) {
      /* ignore */
    }
    var links = scanRoot.querySelectorAll('a[href*="/products/"]');
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
      var key =
        (card.getAttribute && card.getAttribute("data-sf-card-key")) ||
        handle.toLowerCase();
      setThemeCardImage(img, byKey[String(key).toLowerCase()] || "");
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
      if (!card || !card.parentNode || isBareProductLink(card)) return;
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

  var THEME_PAGER_SELECTOR = [
    "nav.pagination",
    ".pagination",
    ".pagination-wrapper",
    "[data-pagination]",
    ".paginate",
    "#pagination",
    ".Pagination",
    "#AjaxinatePagination",
    ".ajaxinate-pagination",
    "load-more-button",
    ".load-more-button",
    ".pagination__load-more",
    "[data-load-more]",
    "button[name='load-more']",
  ].join(", ");
  var THEME_FACET_HIDE_SELECTOR = [
    ".facets__wrapper",
    "#FacetsWrapperDesktop",
    ".facets-vertical-form",
    "#main-collection-filters",
    ".facets-wrapper",
    ".mobile-facets__wrapper",
    ".active-facets-desktop",
    ".active-facets-mobile",
    "facet-filters-form details",
    ".facets details.facets__disclosure",
    "details.facets__panel",
    ".facets__panel",
    "dropdown-facet",
    "facet-dropdown",
    "facet-status-component",
    "facets-form-component",
    "facets-form",
    "filter-form",
    "facet-form",
    ".facets__form-wrapper",
    "facets-form .facets",
    ".facet-filters",
    ".facets-container .facets",
    ".facets-header",
    ".facets-toolbar",
    ".facets--bar",
    ".facets-horizontal",
    ".collection-filters",
    ".product-filters",
    ".filters-toolbar",
    "price-range",
    ".price-range",
    "[class*='active-facets']",
    ".facets-block-wrapper",
    ".facets-toggle",
    ".facets--horizontal",
    ".facets--vertical",
    ".facets-mobile-wrapper",
    ".facets:not(.smart-filter)",
  ].join(", ");
  var THEME_SORT_HIDE_SELECTOR = [
    "select[name='sort_by']",
    "select[name='sortBy']",
    ".facet-filters__sort",
    ".facet-filters.sorting",
    "#SortBy",
    "#sort-by",
    "[data-sort-by]",
    ".collection-sort",
    "sort-by-select",
    "sorting-filter-component",
    ".sorting-filter",
    ".sorting-filter__container",
    ".sorting-filter-component",
  ].join(", ");
  var NATIVE_FACET_HOST_SELECTOR = [
    "facet-filters-form",
    "facets-form",
    "facets-form-component",
    "filter-form",
    "facet-form",
    ".facets__form",
    ".facets__form-wrapper",
    "form.facets",
    "form.facet-filters",
    "form#FacetFiltersForm",
    "[data-facet-filters]",
  ].join(", ");
  var FRAGILE_LAYOUT_HOST_SELECTOR = [
    "results-list",
    "#ResultsList",
    "product-list",
    "grid-list",
    ".collection-wrapper",
    ".main-collection-grid",
    ".product-grid-container",
  ].join(", ");
  var THEME_COUNT_SELECTOR = [
    "#ProductCount",
    "#ProductCountDesktop",
    ".product-count__text",
    ".product-count",
    "[data-product-count]",
    ".products-count-wrapper",
    "[data-testid='products-count']",
    ".collection-product-count",
    ".product-count-vertical",
    ".facets__product-count",
    ".filter-count-bubble__text",
  ].join(", ");
  var THEME_BRIDGE_STYLE_ID = "findly-theme-bridge";
  var GRID_HINT_SELECTOR = [
    "#product-grid",
    "[data-id='product-grid']",
    "[data-product-grid]",
    "ul.product-grid",
    "ul[id*='product-grid']",
    "ul[class*='product-grid']",
    ".product-grid",
    "[product-grid-view]",
    "#ProductGridContainer",
    "#CollectionProductGrid",
    "#CollectionAjaxContent",
    "#collection-products",
    "#CollectionLoop",
    "#product-loop",
    "#product-list",
    "product-list",
    ".ProductList",
    ".ProductList--grid",
    ".product-list",
    ".product-list__inner",
    ".product-listing",
    ".collection-grid",
    ".collection-products",
    ".grid-uniform",
    ".grid--uniform",
    ".grid--view-items",
    ".grid-products",
    ".products-grid",
    ".products-list",
    "[data-collection-products]",
    "[data-products-grid]",
    "[data-product-list]",
    ".collection__products",
    ".collection-product-list",
    "#main-collection-product-grid",
    ".productgrid--items",
    ".boost-sd-grid",
    ".sf-grid",
    "results-list",
    ".results-list",
  ].join(", ");
  var SKIP_REGION_SELECTOR = [
    "header",
    "footer",
    ".header",
    ".footer",
    ".announcement-bar",
    "[id*='announcement']",
    ".related-products",
    "product-recommendations",
    ".product-recommendations",
    "#product-recommendations",
    "[data-related-products]",
    "[class*='related-product']",
    ".recently-viewed",
    "[data-recently-viewed]",
    ".complementary-products",
    "#shopify-section-footer",
    "[id*='footer']",
    ".collection-banner",
    ".collection-hero",
    ".collection-header",
    ".slideshow",
    ".shopify-section-group-header-group",
  ].join(", ");
  var MAIN_FALLBACK_SELECTOR = [
    "#MainContent",
    "#main",
    "#Main",
    "main",
    "[role='main']",
    "#PageContainer",
    "#page-content",
    "#PageContent",
    "#MainContentWrapper",
    ".main-content",
    "#content",
    "#Content",
  ].join(", ");
  var LAYOUT_HOST_SELECTOR = [
    "#ProductGridContainer",
    "[class*='product-grid-container']",
    "results-list",
    ".product-grid-container",
    ".main-collection-grid",
    ".collection-wrapper",
    ".CollectionInner",
    ".CollectionMain",
    ".CollectionInner__Products",
    ".ProductListWrapper",
    "#CollectionProductGrid",
    "#CollectionAjaxContent",
    ".CollectionAjaxContent",
    ".collection-content",
    ".collection-grid__wrapper",
    "#CollectionSection",
    ".productgrid",
    ".collection__content",
    ".collection-main",
    ".main-collection",
    "#main-collection-product-grid",
    "[data-section-type='collection']",
    "[data-section-type='collection-template']",
  ].join(", ");
  var LAYOUT_WALK_MAX = 8;
  var LAYOUT_RETRY_MAX = 15;
  var LAYOUT_RETRY_MS = 250;
  var LATE_GRID_OBSERVE_MS = 4000;
  var THEME_PAGE_FETCH_MAX = 40;

  function matchesSel(el, selector) {
    if (!el || el.nodeType !== 1) return false;
    var fn = el.matches || el.msMatchesSelector || el.webkitMatchesSelector;
    if (!fn) return false;
    try {
      return fn.call(el, selector);
    } catch (err) {
      return false;
    }
  }

  function isSkippedRegion(el) {
    if (!el || el.nodeType !== 1) return false;
    if (el.closest) return Boolean(el.closest(SKIP_REGION_SELECTOR));
    return matchesSel(el, SKIP_REGION_SELECTOR);
  }

  function isMainLike(el) {
    if (!el || !el.tagName) return false;
    if (matchesSel(el, MAIN_FALLBACK_SELECTOR)) return true;
    return String(el.tagName).toLowerCase() === "main";
  }

  function findMainFallbackEl() {
    var nodes = document.querySelectorAll(MAIN_FALLBACK_SELECTOR);
    var i;
    for (i = 0; i < nodes.length; i++) {
      if (nodes[i] && !isDocumentRoot(nodes[i])) return nodes[i];
    }
    return null;
  }

  function isInsideMainLike(el) {
    if (!el) return false;
    if (el.closest) return Boolean(el.closest(MAIN_FALLBACK_SELECTOR));
    var cur = el;
    while (cur && cur.nodeType === 1) {
      if (isMainLike(cur)) return true;
      cur = cur.parentElement;
    }
    return false;
  }

  function isLikelyProductCard(el) {
    if (!el || el.nodeType !== 1) return false;
    if (isBareProductLink(el)) return false;
    if (matchesSel(el, ".sf-app-card")) return true;
    var tag = String(el.tagName || "").toLowerCase();
    if (tag === "product-card" || tag === "product-item" || tag === "grid-item") {
      return true;
    }
    if (!el.querySelector || !el.querySelector('a[href*="/products/"]')) {
      return matchesSel(el, "[data-product-id]");
    }
    var nested = 0;
    var i;
    for (i = 0; i < el.children.length; i++) {
      var child = el.children[i];
      if (child && child.querySelector && child.querySelector('a[href*="/products/"]')) {
        nested += 1;
      }
    }
    return nested <= 1;
  }

  function countDirectProductCards(el) {
    if (!el || !el.children) return 0;
    var n = 0;
    var i;
    for (i = 0; i < el.children.length; i++) {
      if (isLikelyProductCard(el.children[i])) n += 1;
    }
    return n;
  }

  function isProductCardGrid(el) {
    if (!el || !el.children || isDocumentRoot(el)) return false;
    var tag = String(el.tagName || "").toLowerCase();
    if (
      tag === "product-card" ||
      tag === "product-item" ||
      tag === "grid-item" ||
      tag === "li" ||
      tag === "article"
    ) {
      return false;
    }
    if (
      el.classList &&
      (el.classList.contains("grid__item") ||
        el.classList.contains("product-grid__item") ||
        el.classList.contains("product-card") ||
        el.classList.contains("product-item"))
    ) {
      return false;
    }
    var childCount = el.children.length;
    if (!childCount) return false;
    var cards = countDirectProductCards(el);
    if (cards >= 1 && cards / childCount >= 0.5) return true;
    var display = "";
    if (typeof window.getComputedStyle === "function") {
      try {
        display = String(window.getComputedStyle(el).display || "").toLowerCase();
      } catch (err) {
        display = "";
      }
    }
    if (
      (display === "grid" || display === "flex" || display === "inline-flex") &&
      cards >= 2
    ) {
      return true;
    }
    return false;
  }

  function countProductCards(el) {
    var n = 0;
    eachProductCard(el, function () {
      n += 1;
    });
    return n;
  }

  function hasPaginationOrSort(el) {
    if (!el || !el.querySelector) return false;
    return Boolean(
      el.querySelector(THEME_PAGER_SELECTOR) ||
        el.querySelector(
          "[name='sort_by'], .facet-filters__sort, .collection-filters, select[name='sortBy']",
        ),
    );
  }

  function ancestorWrapsBanner(el, grid) {
    if (!el || !el.querySelector || !grid) return false;
    var extras = el.querySelectorAll(
      ".collection-banner, .collection-hero, .collection-header, .slideshow, .banner",
    );
    var i;
    for (i = 0; i < extras.length; i++) {
      if (!grid.contains(extras[i])) return true;
    }
    return false;
  }

  function preferGridHint(current, next, currentCount, nextCount, currentMain, nextMain) {
    if (!current) return true;
    if (nextCount > currentCount) return true;
    if (nextCount < currentCount) return false;
    if (nextMain && !currentMain) return true;
    if (!nextMain && currentMain) return false;
    if (current.contains && current.contains(next) && isProductCardGrid(next)) {
      return true;
    }
    if (next.contains && next.contains(current) && isProductCardGrid(current)) {
      return false;
    }
    if (isProductCardGrid(next) && !isProductCardGrid(current)) return true;
    return false;
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

  function ensureThemeBridgeStyles() {
    if (document.getElementById(THEME_BRIDGE_STYLE_ID)) return;
  }

  function bindNativeFacetGuard() {
    if (window.__findlyFacetGuard) return;
    window.__findlyFacetGuard = true;
    function isNativeFacetTarget(target) {
      if (!target || !target.closest) return false;
      if (
        target.closest(
          ".smart-filter, .sf-pager, .sf-app-card, .sf-sort-host, .sf-search-host, .sf-toolbar, .sf-total-count, [data-collection-search-wrap]",
        )
      ) {
        return false;
      }
      if (target.closest(NATIVE_FACET_HOST_SELECTOR)) return true;
      var name = "";
      if (target.getAttribute) name = String(target.getAttribute("name") || "");
      if (name.indexOf("filter.") === 0 || name === "sort_by" || name === "sortBy") {
        return true;
      }
      return Boolean(
        target.closest(
          "[name^='filter.'], select[name='sort_by'], dropdown-facet, facet-dropdown, facets-form-component, sorting-filter-component, .sorting-filter, .facets__item, .facets__panel",
        ),
      );
    }
    function stopNative(event) {
      if (!isNativeFacetTarget(event.target)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    }
    function stopNativeClick(event) {
      var target = event.target;
      if (!target || !target.closest) return;
      if (
        target.closest(
          ".smart-filter, .sf-pager, .sf-app-card, .sf-sort-host, .sf-search-host, .sf-toolbar, .sf-total-count, [data-collection-search-wrap]",
        )
      ) {
        return;
      }
      var link = target.closest("a[href]");
      if (!link) return;
      var href = String(link.getAttribute("href") || "");
      if (href.indexOf("filter.") === -1 && href.indexOf("sort_by=") === -1) {
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
    }
    document.addEventListener("submit", stopNative, true);
    document.addEventListener("change", stopNative, true);
    document.addEventListener("input", stopNative, true);
    document.addEventListener("click", stopNativeClick, true);
  }

  function stripNativeCollectionParams(url) {
    var changed = false;
    Array.from(url.searchParams.keys()).forEach(function (key) {
      if (key.indexOf("filter.") === 0 || key === "sort_by") {
        url.searchParams.delete(key);
        changed = true;
      }
    });
    return changed;
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
    var selected = gridFromSelector(readEmbedConfig().productGridSelector);
    if (selected) return selected;
    var hints = document.querySelectorAll(GRID_HINT_SELECTOR);
    var best = null;
    var bestCount = 0;
    var bestMain = false;
    var i;
    for (i = 0; i < hints.length; i++) {
      var hint = hints[i];
      if (isPagingChrome(hint) || isSkippedRegion(hint)) continue;
      var count = countProductCards(hint);
      if (count < 1) continue;
      var inMain = isInsideMainLike(hint);
      if (preferGridHint(best, hint, bestCount, count, bestMain, inMain)) {
        best = hint;
        bestCount = count;
        bestMain = inMain;
      }
    }
    if (best) return best;

    var bestParent = null;
    var tallyBest = 0;
    var tallyMain = false;
    var tally = [];
    eachProductCard(document, function (handle, card) {
      if (!card.parentNode) return;
      if (isSkippedRegion(card) || isSkippedRegion(card.parentNode)) return;
      var parent = card.parentNode;
      if (parent.nodeType !== 1) return;
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
      var inMainParent = isInsideMainLike(parent);
      if (
        preferGridHint(
          bestParent,
          parent,
          tallyBest,
          group.count,
          tallyMain,
          inMainParent,
        )
      ) {
        tallyBest = group.count;
        bestParent = parent;
        tallyMain = inMainParent;
      }
    });
    return tallyBest ? bestParent : null;
  }

  function collectionIdFromPage(page) {
    if (!page) return "";
    var type = String(page.resourceType || "").toLowerCase();
    if (
      type === "collection" &&
      page.resourceId != null &&
      String(page.resourceId) !== ""
    ) {
      var id = String(page.resourceId);
      if (/^\d+$/.test(id)) return id;
    }
    return "";
  }

  function inferCollectionId() {
    try {
      var meta = window.ShopifyAnalytics && window.ShopifyAnalytics.meta;
      var fromAnalytics = collectionIdFromPage(meta && meta.page);
      if (fromAnalytics) return fromAnalytics;
    } catch (err) {
      /* ignore */
    }
    try {
      var fromMeta = collectionIdFromPage(window.meta && window.meta.page);
      if (fromMeta) return fromMeta;
    } catch (errMeta) {
      /* ignore */
    }
    return "";
  }

  function collectionHandleFromPathname(pathname) {
    var path = String(pathname || "");
    var match = path.match(/\/collections\/([^/?#]+)/i);
    if (!match) return "";
    try {
      return decodeURIComponent(match[1]).replace(/^\/+|\/+$/g, "");
    } catch (err) {
      return String(match[1] || "").replace(/^\/+|\/+$/g, "");
    }
  }

  function inferCollectionHandle() {
    return collectionHandleFromPathname(
      window.location && window.location.pathname,
    );
  }

  function isAllProductsCollectionHandle(handle) {
    return String(handle || "").trim().toLowerCase() === "all";
  }

  function shouldShowCollectionFacet(widget) {
    if (widget && widget.searchQuery) return true;
    var handle =
      (widget && widget.collectionHandle) || inferCollectionHandle();
    return isAllProductsCollectionHandle(handle);
  }

  function dropCollectionFacetUnlessCatalog(widget, facets) {
    var list = Array.isArray(facets) ? facets : [];
    if (shouldShowCollectionFacet(widget)) return list;
    if (widget && widget.selected) delete widget.selected.collection;
    return list.filter(function (facet) {
      return !isCollectionFacet(facet);
    });
  }

  function isCollectionFilterKey(key) {
    return String(key || "").toLowerCase() === "collection";
  }

  function isCollectionFacet(facet) {
    if (!facet) return false;
    return (
      isCollectionFilterKey(facet.key) ||
      String(facet.source || "").toLowerCase() === "collection"
    );
  }

  function isCollectionRedirectFacet(facet) {
    return (
      isCollectionFacet(facet) &&
      String(facet.displayType || "").toLowerCase() === "collection"
    );
  }

  function storefrontCollectionUrl(path) {
    var href = String(path || "").trim();
    if (!href || href === "#") return "";
    if (/^https?:\/\//i.test(href)) return href;
    if (href.charAt(0) !== "/") href = "/" + href;
    var root = "/";
    try {
      root = String(
        (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) ||
          "/",
      );
    } catch (errRoot) {
      root = "/";
    }
    if (!root || root === "/") return href;
    var prefix = root.replace(/\/+$/, "");
    if (!prefix) return href;
    if (href === prefix || href.indexOf(prefix + "/") === 0) return href;
    return prefix + href;
  }

  function isCurrentStorefrontPath(href) {
    if (!href) return false;
    try {
      var next = new URL(href, window.location.origin);
      var current = String(window.location.pathname || "/")
        .replace(/\/+$/, "")
        .toLowerCase();
      var dest = String(next.pathname || "/")
        .replace(/\/+$/, "")
        .toLowerCase();
      return (current || "/") === (dest || "/");
    } catch (errPath) {
      return false;
    }
  }

  function collectionNumericId(value) {
    var raw = String(value == null ? "" : value).trim();
    if (!raw) return "";
    if (/^\d+$/.test(raw)) return raw;
    var match = raw.match(/\/Collection\/(\d+)/i);
    return match ? match[1] : "";
  }

  function normalizeCollectionHandle(handle) {
    return String(handle || "")
      .trim()
      .replace(/^\/+|\/+$/g, "")
      .replace(/^collections\//i, "")
      .toLowerCase();
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

  function isFragileLayoutHost(el) {
    if (!el || el.nodeType !== 1) return false;
    var tag = String(el.tagName || "").toLowerCase();
    if (tag === "results-list") return true;
    return matchesSel(el, FRAGILE_LAYOUT_HOST_SELECTOR);
  }

  function applyLayoutPositionClass(el, position) {
    if (!el || !el.classList) return;
    if (isFragileLayoutHost(el) || isProductCardGrid(el)) return;
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
    if (mount.classList) mount.classList.add("sf-layout-aside");
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
    if (!count) return 16;
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

  function hasPersistableHashState(selected, price, sort, query, defaultSort) {
    if (query) return true;
    if (price && (price.min !== "" || price.max !== "")) return true;
    if (
      selected &&
      Object.keys(selected).some(function (key) {
        return selected[key] && selected[key].length;
      })
    ) {
      return true;
    }
    var nextSort = sort || "";
    var fallback = defaultSort || "manual";
    return Boolean(nextSort && nextSort !== fallback);
  }

  function writeHash(selected, price, sort, query, defaultSort) {
    var encoded = hasPersistableHashState(
      selected,
      price,
      sort,
      query,
      defaultSort,
    )
      ? serializeState(selected, price, sort, query)
      : "";
    var url = new URL(window.location.href);
    stripNativeCollectionParams(url);
    var nextHash = encoded ? HASH_KEY + "=" + encoded : "";
    var currentHash = (url.hash || "").replace(/^#/, "");
    if (currentHash !== nextHash) {
      url.hash = nextHash;
    }
    var href = url.pathname + url.search + (nextHash ? "#" + nextHash : "");
    if (href !== window.location.pathname + window.location.search + window.location.hash) {
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
        var nestedValues = nestPathLabels(
          Array.isArray(facet.values) ? facet.values : [],
        );
        return {
          key: key,
          label: facet.label || facet.name || key,
          type: isRange ? "price_range" : isBoolean ? "boolean" : "list",
          displayType: displayType,
          isProductPrice: isProductPrice,
          source: source,
          valueSortMode: facet.valueSortMode || "auto",
          collectionTree: Boolean(facet.collectionTree) || valuesHaveChildren(nestedValues),
          hasMergedValues: Boolean(facet.hasMergedValues),
          enableValueSearch: Boolean(facet.enableValueSearch),
          values: nestedValues,
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
    if (Array.isArray(payload.handles) && payload.handles.length) {
      return payload.handles.map(String);
    }
    if (Array.isArray(payload.products) && payload.products.length) {
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

  var embedConfigCache = null;

  function readEmbedConfig() {
    if (embedConfigCache) return embedConfigCache;
    var out = {
      productGridSelector: "",
      useQuickviewTemplate: false,
      customCss: "",
      customJavascript: "",
      productTemplate: "",
      treeTemplate: "",
      sortTemplate: "",
      searchTemplate: "",
      variables: "",
      themeId: "",
    };
    var script = document.getElementById("findly-embed-config");
    if (script) {
      try {
        var parsed = JSON.parse(script.textContent || "{}");
        if (parsed && typeof parsed === "object") {
          out.productGridSelector = String(parsed.productGridSelector || "");
          out.useQuickviewTemplate =
            parsed.useQuickviewTemplate === true ||
            parsed.useQuickviewTemplate === "true" ||
            parsed.useQuickviewTemplate === 1;
          out.customCss = String(parsed.customCss || "");
          out.customJavascript = String(parsed.customJavascript || "");
          out.productTemplate = String(parsed.productTemplate || "");
          out.treeTemplate = String(parsed.treeTemplate || "");
          out.sortTemplate = String(parsed.sortTemplate || "");
          out.searchTemplate = String(parsed.searchTemplate || "");
          out.variables =
            parsed.variables == null ? "" : String(parsed.variables);
          out.themeId =
            parsed.themeId == null ? "" : String(parsed.themeId);
        }
      } catch (err) {
        /* invalid JSON */
      }
    }
    var root =
      document.getElementById("smart-filter-embed") ||
      document.getElementById("smart-filter-root");
    if (root) {
      var sel = root.getAttribute("data-product-grid-selector");
      if (sel && !String(out.productGridSelector).trim()) {
        out.productGridSelector = sel;
      }
      var qv = root.getAttribute("data-use-quickview");
      if (qv === "true" || qv === "1") out.useQuickviewTemplate = true;
    }
    embedConfigCache = out;
    return out;
  }

  function gridLooksLikeGrid(el) {
    if (!el || el.nodeType !== 1) return false;
    if (matchesSel(el, GRID_HINT_SELECTOR)) return true;
    if (isProductCardGrid(el)) return true;
    if (countProductCards(el) > 0) return true;
    var hint = String(el.id || "") + " " + String(el.className || "");
    if (/product|grid|collection/i.test(hint)) return true;
    if (typeof window.getComputedStyle === "function") {
      try {
        var display = String(
          window.getComputedStyle(el).display || "",
        ).toLowerCase();
        if (display === "grid" || display === "flex" || display === "inline-flex") {
          return true;
        }
      } catch (err) {
        /* ignore */
      }
    }
    return false;
  }

  function gridFromSelector(selector) {
    var raw = String(selector || "").trim();
    if (!raw) return null;
    var node = null;
    try {
      node = document.querySelector(raw);
    } catch (err) {
      return null;
    }
    if (!node || node === document || isDocumentRoot(node)) return null;
    if (isSkippedRegion(node)) return null;
    if (countProductCards(node) > 0 || gridLooksLikeGrid(node)) return node;
    if (String(readEmbedConfig().productTemplate || "").trim()) return node;
    return null;
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function lookupPath(ctx, path) {
    var parts = String(path || "").split(".");
    var cur = ctx;
    var i;
    for (i = 0; i < parts.length; i++) {
      if (cur == null || typeof cur !== "object") return undefined;
      cur = cur[parts[i]];
    }
    return cur;
  }

  function interpolateTemplate(tpl, ctx) {
    var out = String(tpl || "");
    out = out.replace(
      /\{\{#([\w.]+)\}\}([\s\S]*?)\{\{\/\1\}\}/g,
      function (_, key, inner) {
        var val = lookupPath(ctx, key);
        var truthy =
          val === true ||
          val === "true" ||
          val === 1 ||
          val === "1" ||
          (typeof val === "string" && val && val !== "false");
        if (val && typeof val === "object") truthy = true;
        if (!val && val !== 0) truthy = false;
        if (val === false || val === "false" || val === 0 || val === "0") {
          truthy = false;
        }
        return truthy ? interpolateTemplate(inner, ctx) : "";
      },
    );
    out = out.replace(
      /\{\{\s*([\w.]+)(\s*\|\s*raw)?\s*\}\}/g,
      function (_, key, raw) {
        var val = lookupPath(ctx, key);
        if (val == null || val === false) return "";
        if (val === true) return "true";
        var str = String(val);
        return raw ? str : escapeHtml(str);
      },
    );
    return out;
  }

  function chromeTemplateContext(widget) {
    var embed = (widget && widget.embedConfig) || readEmbedConfig();
    var titleText =
      (widget && widget.titleEl && widget.titleEl.textContent) ||
      (widget && widget.t && widget.t("filter", "")) ||
      "";
    return {
      title: titleText,
      variables: embed.variables || "",
      theme: { id: embed.themeId || "" },
      themeId: embed.themeId || "",
      product: {},
    };
  }

  function productTemplateContext(product, widget) {
    var item = product || {};
    var handle = String(item.handle || "");
    var url =
      item.url ||
      (handle
        ? "/products/" +
          handle +
          (item.variantId ? "?variant=" + item.variantId : "")
        : "");
    var image = item.imageUrl || item.featured_image || item.image || "";
    var priceMin = item.priceMin != null ? item.priceMin : item.price;
    var priceMax = item.priceMax != null ? item.priceMax : priceMin;
    var currency = widget && widget.currency;
    var money = function (v) {
      return formatMoney(v, currency);
    };
    var compare =
      item.compareAtPrice != null
        ? item.compareAtPrice
        : item.compare_at_price;
    var chrome = chromeTemplateContext(widget);
    return {
      product: {
        title: item.title || "",
        url: url,
        handle: handle,
        id: item.id != null ? item.id : "",
        vendor: item.vendor || "",
        image: image,
        featured_image: image,
        price: money(priceMin),
        price_min: money(priceMin),
        price_max: money(priceMax),
        compare_at_price: compare != null && compare !== "" ? money(compare) : "",
        available: item.available,
        product_type: item.productType || item.product_type || "",
      },
      title: chrome.title,
      variables: chrome.variables,
      theme: chrome.theme,
      themeId: chrome.themeId,
    };
  }

  function decodeEmbedJsHolder(holder) {
    if (!holder) return "";
    try {
      var decode = document.createElement("textarea");
      decode.innerHTML = holder.textContent || "";
      return String(decode.value || "").trim();
    } catch (errDecode) {
      return String(holder.textContent || "").trim();
    }
  }

  function maybeRunEmbedJs(config) {
    try {
      if (window.__findlyEmbedJsRan) return;
      window.__findlyEmbedJsRan = true;
      var code = decodeEmbedJsHolder(
        document.getElementById("findly-embed-js"),
      );
      if (!code) {
        code = config && String(config.customJavascript || "").trim();
      }
      if (!code) return;
      new Function(code)();
    } catch (err) {
      try {
        window.__findlyEmbedJsRan = true;
      } catch (errFlag) {
        /* ignore */
      }
    }
  }

  function Widget(root) {
    this.root = root;
    this.facetsEl = qs(root, "[data-facets]");
    this.statusEl = qs(root, "[data-status]");
    this.titleEl = qs(root, "[data-title]");
    this.clearAllEl = qs(root, "[data-clear-all]");
    this.proxyBase = (root.getAttribute("data-proxy-base") || "/apps/smart-filter").replace(
      /\/$/,
      "",
    );
    this.collectionId = root.getAttribute("data-collection-id") || "";
    if (!this.collectionId) {
      this.collectionId = inferCollectionId();
    }
    this.collectionHandle = (root.getAttribute("data-collection-handle") || "").trim();
    if (!this.collectionHandle) {
      this.collectionHandle = inferCollectionHandle();
    }
    this.searchQuery = (root.getAttribute("data-search-query") || "").trim();
    if (!this.searchQuery && !this.collectionId && !this.collectionHandle) {
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
    this.autoApplyFilters = true;
    this._appliedSnapshot = "";
    this.sortKey = "";
    this.sortWrap = qs(root, "[data-sort-wrap]");
    this.sortEl = qs(root, "[data-sort]");
    this.facets = [];
    this.page = 1;
    this.pageSize = 0;
    this._themePageSize = 0;
    this.defaultSort = "manual";
    this._loadingPage = false;
    this._cardCache = {};
    this._nativeHandles = {};
    this._importedHandles = {};
    this._gridParent = null;
    this._shownHandles = [];
    this._pageTotal = 0;
    this._pagerEl = null;
    this._infiniteObserver = null;
    this._infiniteOnScroll = null;
    this._themePagesCached = {};
    this._themeNoMore = false;
    this._pagingFallback = false;
    this._sentPagingParams = false;
    this._lastProducts = [];
    this._reqId = 0;
    this._hydratedFromCache = false;
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
    this._lateGridObserver = null;
    this._lateGridTimer = null;
    this.embedConfig = readEmbedConfig();
    this._adminProductTemplate = "";
    this._nativeGridBackup = null;
    this._appGridActive = false;
    this._embedChromeApplied = false;
    this._quickviewEl = null;
    this._pendingAppGrid = null;
    this._visibleHandles = null;
    this._gridObserver = null;
    window.__FINDLY_FILTER_WIDGET = this;
    this._gridObserveEl = null;
    this._reapplyingGrid = false;
    root.classList.add("smart-filter--" + this.position);
    root.setAttribute("data-position", this.position);
    this.applyEmbedChrome();
    ensureThemeBridgeStyles();
    bindNativeFacetGuard();
    this.trapWidgetEvents();
    this.inheritThemeType();
    this.syncCollectionLayout();
    this.ensureOutsideThemeForm();
    this.bindDrawer();
    this.bindSort();
    this.bindCollectionSearch();
    this.bindClearAll();
    maybeRunEmbedJs(this.embedConfig);
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
      this.titleEl.textContent = displayTitle(this.i18n.filter, "Filter");
      this.titleEl.hidden = !String(this.titleEl.textContent).trim();
    }
    var toggle = this.root.querySelector("[data-drawer-toggle]");
    if (toggle && this.i18n.filter) {
      toggle.setAttribute("data-title", displayTitle(this.i18n.filter, "Filter"));
    }
    this.syncClearAll();
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
      var title = displayTitle(settings.widgetTitle, "Filter");
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
    this.autoApplyFilters =
      settings.autoApplyFilters == null ? true : Boolean(settings.autoApplyFilters);

    this.root.hidden = Boolean(this.searchQuery) && this.enableFiltersOnSearch === false;

    if (typeof settings.currency === "string" && settings.currency.trim()) {
      this.currency = settings.currency.trim();
    }

    this.defaultSort = settings.defaultSort || "manual";

    if (typeof settings.productListLiquid === "string") {
      this._adminProductTemplate = settings.productListLiquid.trim();
    }

    this.renderSortSelect(settings);
    this.renderCollectionSearch(settings);
    this.placeSortOnGrid();
    if (this.placeCollectionSearchOnGrid) this.placeCollectionSearchOnGrid();
    this.hideThemeDuplicateChrome();
  };

  Widget.prototype.isCollectionListing = function () {
    if (this.searchQuery) return false;
    if (this.collectionId || this.collectionHandle) return true;
    return Boolean(inferCollectionHandle());
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
      timer = 0;
      if (!(input.value || "").trim()) {
        applyValue();
        return;
      }
      timer = window.setTimeout(function () {
        timer = 0;
        applyValue();
      }, DEBOUNCE_MS);
    });
    input.addEventListener("keydown", function (event) {
      if (event.key === "Enter") {
        event.preventDefault();
        window.clearTimeout(timer);
        timer = 0;
        applyValue();
      }
    });
    input.addEventListener("blur", function () {
      if (!timer) return;
      window.clearTimeout(timer);
      timer = 0;
      applyValue();
    });
  };

  Widget.prototype.renderCollectionSearch = function (settings) {
    var wrap = this.collectionSearchWrap;
    var input = this.collectionSearchEl;
    if (!wrap) return;
    var show =
      Boolean(settings && settings.enableCollectionSearch) &&
      this.isCollectionListing();
    wrap.hidden = !show;
    if (!show) {
      this.collectionQuery = "";
      if (input) input.value = "";
      return;
    }
    if (input && input.value !== this.collectionQuery) {
      input.value = this.collectionQuery;
    }
    if (this.placeCollectionSearchOnGrid) this.placeCollectionSearchOnGrid();
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
    this.placeSortOnGrid();
  };

  Widget.prototype.placeSortOnGrid = function () {
    var wrap = this.sortWrap;
    if (!wrap || wrap.hidden) return;
    wrap.classList.add("sf-sort-toolbar");
    if (this.placeCollectionSearchOnGrid) this.placeCollectionSearchOnGrid();
    var host =
      document.querySelector(".sf-toolbar .sf-sort-host") ||
      document.querySelector(".sf-sort-host");
    var main = document.querySelector(".sf-layout-main");
    if (!host && main) {
      host = document.createElement("div");
      host.className = "sf-sort-host";
      if (main.firstChild) main.insertBefore(host, main.firstChild);
      else main.appendChild(host);
    }
    if (!host) return;
    if (wrap.parentNode !== host) host.appendChild(wrap);
    if (this.placeCollectionSearchOnGrid) this.placeCollectionSearchOnGrid();
  };

  Widget.prototype.hideThemeDuplicateChrome = function () {
    var root = this.root;
    var grid = this._gridParent;
    var seen = typeof WeakSet !== "undefined" ? new WeakSet() : null;
    function isProtected(el) {
      if (!el) return true;
      if (
        el.closest &&
        el.closest(
          ".smart-filter, .sf-panel, .sf-sort-host, .sf-search-host, .sf-toolbar, .sf-total-count, .sf-app-card, .sf-pager, [data-collection-search-wrap]",
        )
      ) {
        return true;
      }
      if (root && (el.contains(root) || root.contains(el))) return true;
      return false;
    }
    function isGridHost(el) {
      if (!el || el.nodeType !== 1) return false;
      if (matchesSel(el, "results-list, .results-list, #ResultsList, .collection-wrapper, .main-collection-grid")) {
        return false;
      }
      if (grid && el === grid) return true;
      if (
        matchesSel(
          el,
          "#product-grid, ul.product-grid, [data-product-grid], [data-id='product-grid'], .sf-app-grid",
        )
      ) {
        return true;
      }
      if (matchesSel(el, THEME_FACET_HIDE_SELECTOR) || matchesSel(el, THEME_SORT_HIDE_SELECTOR)) {
        return false;
      }
      return isProductCardGrid(el);
    }
    function containsGrid(el) {
      if (!el) return false;
      if (grid && el.contains && el.contains(grid)) return true;
      if (
        el.querySelector &&
        el.querySelector(
          "#product-grid, ul.product-grid, [data-product-grid], results-list, .results-list, .sf-app-grid",
        )
      ) {
        return true;
      }
      return false;
    }
    function hideLeaf(el) {
      if (!el || el.nodeType !== 1) return;
      if (seen) {
        if (seen.has(el)) return;
        seen.add(el);
      }
      if (el.getAttribute("data-findly-theme-hidden") === "1") return;
      if (isProtected(el) || isGridHost(el) || containsGrid(el)) return;
      if (matchesSel(el, THEME_COUNT_SELECTOR)) return;
      el.classList.add("hidden");
      el.setAttribute("hidden", "");
      el.setAttribute("data-findly-theme-hidden", "1");
      el.setAttribute("data-findly-theme-display", el.style.display || "");
      el.style.setProperty("display", "none", "important");
    }
    function hideNode(el) {
      if (!el || el.nodeType !== 1) return;
      if (isProtected(el) || isGridHost(el)) return;
      if (
        containsGrid(el) ||
        (el.querySelector &&
          el.querySelector(THEME_COUNT_SELECTOR) &&
          !matchesSel(el, THEME_COUNT_SELECTOR))
      ) {
        var children = el.children;
        var n;
        for (n = 0; n < children.length; n++) hideNode(children[n]);
        return;
      }
      hideLeaf(el);
    }
    document.querySelectorAll(THEME_FACET_HIDE_SELECTOR).forEach(hideNode);
    document.querySelectorAll(THEME_SORT_HIDE_SELECTOR).forEach(hideNode);
    document.querySelectorAll(
      "dropdown-facet, facet-dropdown, facet-status, facet-status-component, .facets__disclosure, .facets__panel, details.facets__panel, .facets__item, .facets-toolbar, .facets-header, sorting-filter-component, .sorting-filter, .sorting-filter__container, .active-facets, details.facets__disclosure",
    ).forEach(hideLeaf);
    document.querySelectorAll("[name^='filter.'], select[name='sort_by'], select[name='sortBy']").forEach(function (input) {
      if (!input || (input.closest && input.closest(".smart-filter, .sf-panel"))) return;
      var chrome =
        (input.closest &&
          input.closest(
            "details, dropdown-facet, facet-dropdown, .facets__item, .facet-filters__field, .facet-checkbox, fieldset, label, .sorting-filter",
          )) ||
        input;
      hideLeaf(chrome);
    });
  };

  Widget.prototype.trapWidgetEvents = function () {
    if (this._trapped) return;
    this._trapped = true;
    var root = this.root;
    function stopBubble(event) {
      event.stopPropagation();
    }
    root.addEventListener("change", stopBubble);
    root.addEventListener("input", stopBubble);
    root.addEventListener("submit", function (event) {
      event.preventDefault();
      event.stopPropagation();
    });
  };

  Widget.prototype.ensureOutsideThemeForm = function () {
    if (this._liftedForm) return;
    var mount = widgetMountNode(this.root);
    if (!mount || !mount.closest) return;
    var form = mount.closest(NATIVE_FACET_HOST_SELECTOR);
    if (!form || form === mount || !form.parentNode) return;
    this._liftedForm = true;
    form.parentNode.insertBefore(mount, form);
    this._gridParent = null;
    this.syncCollectionLayout();
  };

  Widget.prototype.setGridBusy = function (busy) {
    var parent = this.ensureGridParent();
    if (!parent) return;
    if (busy) {
      parent.classList.add("sf-grid-busy");
      parent.setAttribute("aria-busy", "true");
    } else {
      parent.classList.remove("sf-grid-busy");
      parent.setAttribute("aria-busy", "false");
    }
  };

  Widget.prototype.watchThemeGrid = function () {
    var parent = this.ensureGridParent();
    if (!parent || typeof MutationObserver !== "function") return;
    var host = parent.parentElement || parent;
    if (parent.closest) {
      var stable = parent.closest(
        "#ProductGridContainer, #CollectionProductGrid, #CollectionAjaxContent, .sf-layout-main, results-list",
      );
      if (stable) {
        host =
          matchesSel(stable, "results-list, #ResultsList") && stable.parentElement
            ? stable.parentElement
            : stable;
      }
    }
    if (this._gridObserver && this._gridObserveEl === host && host.isConnected !== false) {
      return;
    }
    if (this._gridObserver) {
      this._gridObserver.disconnect();
      this._gridObserver = null;
    }
    var self = this;
    this._gridObserveEl = host;
    this._gridObserver = new MutationObserver(function () {
      if (self._appGridActive || self._reapplyingGrid) return;
      if (self._gridObserveEl && self._gridObserveEl.isConnected === false) {
        self._gridObserver.disconnect();
        self._gridObserver = null;
        self._gridObserveEl = null;
        self._gridParent = null;
        self.watchThemeGrid();
        return;
      }
      if (!Array.isArray(self._visibleHandles)) return;
      if (self._gridWatchTimer) return;
      self._gridWatchTimer = window.setTimeout(function () {
        self._gridWatchTimer = 0;
        if (self._appGridActive || self._reapplyingGrid) return;
        if (!Array.isArray(self._visibleHandles)) return;
        self._reapplyingGrid = true;
        try {
          self.syncProductGrid(self._visibleHandles);
        } finally {
          self._reapplyingGrid = false;
        }
      }, 150);
    });
    this._gridObserver.observe(host, { childList: true, subtree: true });
  };

  Widget.prototype.syncThemeProductCount = function (count) {
    var n = Number(count);
    if (!Number.isFinite(n) || n < 0) return;
    var label = this.productCountLabel(n);
    var itemLabel =
      n === 1
        ? this.t("item", "1 item")
        : this.t("items", "{n} items").replace("{n}", String(n));
    var countRe = /\d+\s*(items?|products?|results?)\b/i;
    var nodes = document.querySelectorAll(THEME_COUNT_SELECTOR);
    var i;
    for (i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (!el || (el.closest && el.closest(".smart-filter"))) continue;
      var text = String(el.textContent || "").trim();
      if (
        !text ||
        countRe.test(text) ||
        el.id === "ProductCount" ||
        el.id === "ProductCountDesktop" ||
        (el.hasAttribute && el.hasAttribute("data-results-count"))
      ) {
        el.textContent = /item/i.test(text) ? itemLabel : label;
      }
      if (el.hasAttribute && el.hasAttribute("data-results-count")) {
        el.setAttribute("data-results-count", String(n));
      }
    }
    var resultHosts = document.querySelectorAll("[data-results-count]");
    for (i = 0; i < resultHosts.length; i++) {
      resultHosts[i].setAttribute("data-results-count", String(n));
    }
    var main = document.querySelector(".sf-layout-main") || this._gridParent;
    if (!main || !main.querySelectorAll) return;
    var extras = main.querySelectorAll("p, span, small, div");
    var max = Math.min(extras.length, 80);
    for (i = 0; i < max; i++) {
      var node = extras[i];
      if (!node || node.children.length > 1) continue;
      if (
        node.closest &&
        node.closest(
          ".smart-filter, .sf-pager, .sf-app-card, .sf-toolbar, .sf-sort-host, .sf-sort-control, .sf-total-count",
        )
      ) {
        continue;
      }
      if (countRe.test(String(node.textContent || "").trim())) {
        node.textContent = itemLabel;
      }
    }
  };

  Widget.prototype.applyEmbedChrome = function () {
    if (this._embedChromeApplied) return;
    this._embedChromeApplied = true;
    var config = this.embedConfig || readEmbedConfig();
    this.applyTreeTemplate(config.treeTemplate);
    this.applySortTemplate(config.sortTemplate);
    this.applySearchTemplate(config.searchTemplate);
  };

  Widget.prototype.applyTreeTemplate = function (html) {
    var raw = String(html || "");
    if (!raw.trim() || raw.indexOf("data-facets") === -1) return;
    if (!this.facetsEl || !this.facetsEl.parentNode) return;
    var box = document.createElement("div");
    box.innerHTML = interpolateTemplate(raw, chromeTemplateContext(this));
    var nextFacets = box.querySelector("[data-facets]");
    if (!nextFacets) return;
    var nextStatus = box.querySelector("[data-status]");
    this.facetsEl.parentNode.replaceChild(nextFacets, this.facetsEl);
    this.facetsEl = nextFacets;
    if (nextStatus) {
      if (this.statusEl && this.statusEl.parentNode) {
        this.statusEl.parentNode.replaceChild(nextStatus, this.statusEl);
      } else if (this.facetsEl.parentNode) {
        this.facetsEl.parentNode.appendChild(nextStatus);
      }
      this.statusEl = nextStatus;
    }
  };

  Widget.prototype.applySortTemplate = function (html) {
    var raw = String(html || "");
    if (!raw.trim() || raw.indexOf("data-sort") === -1) return;
    var wrap = this.sortWrap || qs(this.root, "[data-sort-wrap]");
    if (!wrap) return;
    var box = document.createElement("div");
    box.innerHTML = interpolateTemplate(raw, chromeTemplateContext(this));
    var tplSort = box.querySelector("[data-sort]");
    if (!tplSort) return;
    var tplWrap = box.querySelector("[data-sort-wrap]");
    wrap.innerHTML = "";
    if (tplWrap) {
      while (tplWrap.firstChild) wrap.appendChild(tplWrap.firstChild);
    } else {
      wrap.appendChild(tplSort);
    }
    this.sortWrap = wrap;
    this.sortEl = qs(wrap, "[data-sort]") || qs(this.root, "[data-sort]");
    if (this.sortEl) this.sortEl.removeAttribute("data-sf-bound");
  };

  Widget.prototype.applySearchTemplate = function (html) {
    var raw = String(html || "");
    if (!raw.trim() || raw.indexOf("data-collection-search") === -1) return;
    var wrap =
      this.collectionSearchWrap || qs(this.root, "[data-collection-search-wrap]");
    if (!wrap) return;
    var box = document.createElement("div");
    box.innerHTML = interpolateTemplate(raw, chromeTemplateContext(this));
    var tplInput = box.querySelector("[data-collection-search]");
    if (!tplInput) return;
    var tplWrap = box.querySelector("[data-collection-search-wrap]");
    wrap.innerHTML = "";
    if (tplWrap) {
      while (tplWrap.firstChild) wrap.appendChild(tplWrap.firstChild);
    } else {
      wrap.appendChild(tplInput);
    }
    this.collectionSearchWrap = wrap;
    this.collectionSearchEl =
      qs(wrap, "[data-collection-search]") ||
      qs(this.root, "[data-collection-search]");
    if (this.collectionSearchEl) {
      this.collectionSearchEl.removeAttribute("data-sf-bound");
    }
  };

  Widget.prototype.appGridTemplate = function () {
    var embed = this.embedConfig || readEmbedConfig();
    var fromEmbed = String((embed && embed.productTemplate) || "").trim();
    if (fromEmbed) return fromEmbed;
    return String(this._adminProductTemplate || "").trim();
  };

  Widget.prototype.isAppGridMode = function () {
    return Boolean(this.appGridTemplate());
  };

  Widget.prototype.backupNativeGrid = function (parent) {
    if (!parent || this._nativeGridBackup) return;
    var backup = [];
    var i;
    for (i = 0; i < parent.childNodes.length; i++) {
      backup.push(parent.childNodes[i]);
    }
    this._nativeGridBackup = backup;
  };

  Widget.prototype.restoreNativeGrid = function () {
    var parent = this._gridParent;
    if (!parent) return;
    var apps = parent.querySelectorAll(".sf-app-card");
    var i;
    for (i = 0; i < apps.length; i++) {
      if (apps[i].parentNode) apps[i].parentNode.removeChild(apps[i]);
    }
    if (parent.classList) parent.classList.remove("sf-app-grid");
    var backup = this._nativeGridBackup;
    if (backup && backup.length) {
      for (i = 0; i < backup.length; i++) {
        var node = backup[i];
        if (!node) continue;
        if (node.parentNode !== parent) parent.appendChild(node);
        if (node.nodeType === 1) {
          setCardHidden(node, false);
        }
      }
    } else {
      var kids = parent.children;
      for (i = 0; i < kids.length; i++) {
        setCardHidden(kids[i], false);
      }
    }
    this._appGridActive = false;
  };

  Widget.prototype.hideNativeGridCards = function (parent) {
    if (!parent || !parent.children) return;
    var i;
    for (i = 0; i < parent.children.length; i++) {
      var child = parent.children[i];
      if (!child || child.nodeType !== 1) continue;
      if (
        child.classList &&
        (child.classList.contains("sf-app-card") ||
          child.classList.contains("sf-pager") ||
          child.classList.contains("sf-sort-host") ||
          child.classList.contains("sf-search-host") ||
          child.classList.contains("sf-toolbar") ||
          child.classList.contains("sf-total-count") ||
          child.classList.contains("sf-grid-empty"))
      ) {
        continue;
      }
      if (child.id === "findly-grid-empty" || child.id === "findly-card-tray") {
        continue;
      }
      setCardHidden(child, true);
    }
  };

  var DEFAULT_APP_CARD =
    '<a class="sf-app-card-link" href="{{product.url}}">' +
    '<span class="sf-app-card-media">' +
    '<img src="{{product.image}}" alt="{{product.title}}">' +
    "</span>" +
    '<p class="sf-app-card-title">{{product.title}}</p>' +
    '<p class="sf-app-card-price">{{product.price}}</p>' +
    '<p class="sf-app-card-vendor">{{product.vendor}}</p>' +
    "</a>";

  Widget.prototype.renderAppCard = function (product) {
    var tpl = this.appGridTemplate() || DEFAULT_APP_CARD;
    var html = interpolateTemplate(tpl, productTemplateContext(product, this)).trim();
    if (!html) {
      html = interpolateTemplate(
        DEFAULT_APP_CARD,
        productTemplateContext(product, this),
      );
    }
    var wrap = document.createElement("div");
    wrap.className = "sf-app-card";
    wrap.innerHTML = html;
    var item = product || {};
    var handle = String(item.handle || "").toLowerCase();
    var key = String(item.cardKey || handle).toLowerCase();
    if (key) wrap.setAttribute("data-sf-card-key", key);
    if (handle) wrap.setAttribute("data-product-handle", handle);
    if (item.id != null && item.id !== "") {
      wrap.setAttribute("data-product-id", String(item.id));
    }
    var url =
      item.url ||
      (handle
        ? "/products/" +
          handle +
          (item.variantId ? "?variant=" + item.variantId : "")
        : "");
    if (url && !wrap.querySelector('a[href*="/products/"]')) {
      var a = document.createElement("a");
      a.setAttribute("href", url);
      while (wrap.firstChild) a.appendChild(wrap.firstChild);
      wrap.appendChild(a);
    }
    return wrap;
  };

  Widget.prototype.applyAppGrid = function (data, handles, append) {
    var parent = this.ensureGridParent();
    if (!parent) return false;
    this.backupNativeGrid(parent);
    if (parent.classList) parent.classList.add("sf-app-grid");
    this._appGridActive = true;
    if (!append) {
      var stale = parent.querySelectorAll(".sf-app-card");
      var s;
      for (s = 0; s < stale.length; s++) {
        if (stale[s].parentNode) stale[s].parentNode.removeChild(stale[s]);
      }
      this.hideNativeGridCards(parent);
    } else {
      this.hideNativeGridCards(parent);
    }
    var products = (data && data.products) || [];
    if (!products.length && handles && handles.length) {
      products = handles.map(function (h) {
        var key = String(h || "");
        var handle = key.split("::")[0];
        return { handle: handle, cardKey: key, url: "/products/" + handle };
      });
    }
    var shown = append ? this._shownHandles.slice() : [];
    var i;
    for (i = 0; i < products.length; i++) {
      var product = products[i];
      if (typeof product === "string") {
        product = {
          handle: product,
          cardKey: product,
          url: "/products/" + product,
        };
      }
      if (!product) continue;
      var card = this.renderAppCard(product);
      var key =
        (card.getAttribute && card.getAttribute("data-sf-card-key")) ||
        String(product.cardKey || product.handle || "").toLowerCase();
      if (key) this._cardCache[key] = card;
      parent.appendChild(card);
      if (key && shown.indexOf(key) === -1) shown.push(key);
    }
    this._shownHandles = shown;
    return shown.length > 0 || products.length === 0;
  };

  Widget.prototype.ensureQuickviewModal = function () {
    if (this._quickviewEl && this._quickviewEl.parentNode) return this._quickviewEl;
    var existing = document.querySelector(".sf-quickview");
    if (existing) {
      this._quickviewEl = existing;
      return existing;
    }
    var modal = document.createElement("div");
    modal.className = "sf-quickview";
    modal.hidden = true;
    modal.innerHTML =
      '<div class="sf-quickview-overlay" data-findly-quickview-overlay></div>' +
      '<div class="sf-quickview-dialog" role="dialog" aria-modal="true">' +
      '<button type="button" class="sf-quickview-close" data-findly-quickview-close aria-label="Close">×</button>' +
      '<div class="sf-quickview-body" data-findly-quickview-body></div>' +
      "</div>";
    document.body.appendChild(modal);
    var self = this;
    modal.addEventListener("click", function (event) {
      if (event.target === modal) self.closeQuickview();
    });
    var overlay = modal.querySelector("[data-findly-quickview-overlay]");
    if (overlay) {
      overlay.addEventListener("click", function () {
        self.closeQuickview();
      });
    }
    modal
      .querySelector("[data-findly-quickview-close]")
      .addEventListener("click", function () {
        self.closeQuickview();
      });
    if (!this._onQuickviewKey) {
      this._onQuickviewKey = function (event) {
        if (event.key === "Escape") self.closeQuickview();
      };
    }
    this._quickviewEl = modal;
    return modal;
  };

  Widget.prototype.closeQuickview = function () {
    var modal = this._quickviewEl;
    if (!modal) return;
    modal.hidden = true;
    document.removeEventListener("keydown", this._onQuickviewKey);
  };

  Widget.prototype.openQuickview = function (card) {
    if (!card) return;
    var modal = this.ensureQuickviewModal();
    var body = modal.querySelector("[data-findly-quickview-body]");
    if (!body) return;
    body.innerHTML = "";
    var custom = card.querySelector("[data-findly-quickview]");
    if (custom) {
      body.appendChild(custom.cloneNode(true));
    } else {
      var img = card.querySelector("img");
      var heading = card.querySelector(
        ".card__heading, .card__title, .product-card-title, h3, h2, h1",
      );
      var priceEl = card.querySelector(
        ".price, .product-card__price, [data-price], .sf-app-card-price, .sf-app-card-price",
      );
      var link = card.querySelector('a[href*="/products/"]');
      if (img) {
        var media = document.createElement("div");
        media.className = "sf-quickview-image";
        var photo = document.createElement("img");
        photo.src = img.currentSrc || img.src || "";
        photo.alt = img.alt || "";
        media.appendChild(photo);
        body.appendChild(media);
      }
      var title = document.createElement("div");
      title.className = "sf-quickview-title";
      title.textContent =
        (heading && heading.textContent.trim()) ||
        (link && link.textContent.trim()) ||
        "";
      body.appendChild(title);
      if (priceEl && priceEl.textContent.trim()) {
        var price = document.createElement("div");
        price.className = "sf-quickview-price";
        price.textContent = priceEl.textContent.trim();
        body.appendChild(price);
      }
      if (link) {
        var view = document.createElement("a");
        view.className = "sf-quickview-product";
        view.href = link.getAttribute("href") || "";
        view.textContent = this.t("product.view_details", "View product");
        body.appendChild(view);
      }
    }
    modal.hidden = false;
    document.addEventListener("keydown", this._onQuickviewKey);
  };

  Widget.prototype.ensureQuickviewButtons = function () {
    var config = this.embedConfig || readEmbedConfig();
    if (!config.useQuickviewTemplate) return;
    var parent = this.ensureGridParent();
    if (!parent) return;
    var self = this;
    eachProductCard(parent, function (handle, card) {
      if (!card || card.hidden) return;
      if (card.getAttribute && card.getAttribute("data-smart-filter-hidden") === "true") {
        return;
      }
      if (card.closest) {
        var hiddenHost = card.closest("[hidden], [data-smart-filter-hidden='true']");
        if (hiddenHost && hiddenHost !== card) return;
      }
      if (card.querySelector && card.querySelector("[data-findly-quickview-open]")) {
        return;
      }
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "sf-quickview-btn";
      btn.setAttribute("data-findly-quickview-open", "");
      btn.textContent = self.t("product.quick_view", "Quick view");
      card.appendChild(btn);
    });
    if (!this._quickviewClickBound) {
      this._quickviewClickBound = true;
      document.addEventListener(
        "click",
        function (event) {
          var node = event.target;
          if (node && node.nodeType !== 1) node = node.parentElement;
          var btn =
            node && node.closest && node.closest("[data-findly-quickview-open]");
          if (!btn) return;
          event.preventDefault();
          var card =
            (btn.closest && btn.closest(".sf-app-card")) ||
            closestProductCard(btn);
          self.openQuickview(card);
        },
        true,
      );
    }
  };

  Widget.prototype.restoreFromHash = function () {
    var parsed = parseHash(window.location.hash);
    if (!parsed) return;
    this.selected = parsed.selected || {};
    this.price = parsed.price || { min: "", max: "" };
    if (parsed.sort) this.sortKey = parsed.sort;
    if (
      (this.collectionId || this.collectionHandle || this.isCollectionListing()) &&
      parsed.query
    ) {
      this.collectionQuery = parsed.query;
    }
  };

  Widget.prototype.buildProxyUrl = function () {
    var params = new URLSearchParams();
    var onCollection = this.isCollectionListing();
    if (this.collectionId) {
      params.set("collection_id", this.collectionId);
    }
    if (onCollection && this.collectionQuery) {
      params.set("q", this.collectionQuery);
    } else if (!onCollection && this.searchQuery) {
      params.set("q", this.searchQuery);
    }
    if (this.collectionHandle) {
      params.set("collection_handle", this.collectionHandle);
    } else if (onCollection) {
      var inferredHandle = inferCollectionHandle();
      if (inferredHandle) params.set("collection_handle", inferredHandle);
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

    this._sentPagingParams = true;
    this.ensurePageSize();
    params.set("page", String(Math.max(1, this.page || 1)));
    params.set("pageSize", String(this.pageSize || 16));

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
    var nodes = document.querySelectorAll(THEME_COUNT_SELECTOR);
    for (var j = 0; j < nodes.length; j++) {
      var el = nodes[j];
      if (!el || (el.closest && el.closest(".smart-filter"))) continue;
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
  };

  Widget.prototype.updateStatus = function (payload, handles) {
    var total =
      payload && typeof payload.total === "number"
        ? payload.total
        : payload && typeof payload.count === "number"
          ? payload.count
          : null;
    var count = total != null ? total : (handles && handles.length) || 0;
    var empty =
      count === 0 ||
      (typeof total === "number" ? total === 0 : !(handles && handles.length));

    if (
      empty &&
      (this.hasActiveFilters() || this.searchQuery || this.collectionQuery)
    ) {
      setStatus(this.statusEl, this.t("no_match", MSG_NO_MATCH), false);
      this.syncThemeProductCount(0);
      return;
    }
    setStatus(this.statusEl, "", false);
    this.syncThemeProductCount(count);
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
    if (this.isAppGridMode()) return true;
    if (this._pagingFallback) return false;
    return this.hasNonThemeMatching();
  };

  Widget.prototype.ensureGridParent = function () {
    if (
      this._gridParent &&
      this._gridParent.parentNode &&
      this._gridParent.isConnected !== false &&
      !isSkippedRegion(this._gridParent)
    ) {
      return this._gridParent;
    }
    var selected = null;
    try {
      selected = gridFromSelector(
        (this.embedConfig || readEmbedConfig()).productGridSelector,
      );
    } catch (err) {
      selected = null;
    }
    this._gridParent = selected || discoverGridParent();
    return this._gridParent;
  };

  Widget.prototype.findLayoutHost = function (grid) {
    if (!grid) return null;
    if (isSkippedRegion(grid)) return null;

    function wrapIfCardGrid(el) {
      if (!el || isDocumentRoot(el) || isSkippedRegion(el)) return null;
      if (isProductCardGrid(el)) {
        var parent = el.parentElement;
        if (
          parent &&
          !isDocumentRoot(parent) &&
          !isSkippedRegion(parent) &&
          !isProductCardGrid(parent)
        ) {
          return parent;
        }
        return null;
      }
      return el;
    }

    var known = document.querySelectorAll(LAYOUT_HOST_SELECTOR);
    var i;
    for (i = 0; i < known.length; i++) {
      var el = known[i];
      if (!el || isDocumentRoot(el) || isSkippedRegion(el)) continue;
      if (!(el === grid || (el.contains && el.contains(grid)))) continue;
      if (ancestorWrapsBanner(el, grid)) continue;
      var host = wrapIfCardGrid(el);
      if (host) return host;
    }

    var closestSafe = null;
    var chromeSafe = null;
    var ancestor = grid.parentElement;
    var levels = 0;
    while (ancestor && !isDocumentRoot(ancestor) && levels < LAYOUT_WALK_MAX) {
      if (isMainLike(ancestor)) break;
      if (isSkippedRegion(ancestor)) {
        ancestor = ancestor.parentElement;
        levels += 1;
        continue;
      }
      if (isProductCardGrid(ancestor)) {
        ancestor = ancestor.parentElement;
        levels += 1;
        continue;
      }
      if (!closestSafe) closestSafe = ancestor;
      if (
        !chromeSafe &&
        hasPaginationOrSort(ancestor) &&
        !ancestorWrapsBanner(ancestor, grid)
      ) {
        chromeSafe = ancestor;
      }
      ancestor = ancestor.parentElement;
      levels += 1;
    }

    if (chromeSafe) return chromeSafe;
    if (closestSafe) return closestSafe;
    if (
      grid.parentElement &&
      !isDocumentRoot(grid.parentElement) &&
      !isSkippedRegion(grid.parentElement)
    ) {
      return wrapIfCardGrid(grid.parentElement) || grid.parentElement;
    }
    return grid;
  };

  Widget.prototype.inheritThemeType = function () {
    if (typeof window.getComputedStyle !== "function") return;
    var grid = this.ensureGridParent();
    var sample = null;
    if (grid && grid.querySelector) {
      sample = grid.querySelector(
        ".card__heading a, .card__heading, .product-card-title, a[href*='/products/']",
      );
    }
    if (!sample) sample = grid;
    if (!sample) sample = document.body;
    if (!sample) return;
    var cs = window.getComputedStyle(sample);
    this.root.style.setProperty("--sf-ink", cs.color);
    var fontMode = this.widgetFontMode || "theme";
    var useThemeFace = fontMode === "theme" || fontMode === "";
    if (useThemeFace) {
      this.root.style.fontFamily = cs.fontFamily;
      this.root.style.fontSize = cs.fontSize;
      var bodyVar = "";
      try {
        var rootCs = window.getComputedStyle(document.documentElement);
        var keys = [
          "--font-body-family",
          "--font-body--family",
          "--font-primary-family",
          "--font-base",
          "--type-body-font-family",
          "--typeBasePrimary",
          "--element-text-font-family--body",
          "--font-stack-body",
          "--body-font-family",
        ];
        var k;
        for (k = 0; k < keys.length; k++) {
          var raw = String(rootCs.getPropertyValue(keys[k]) || "").trim();
          if (
            raw &&
            raw.length <= 180 &&
            !/url\s*\(|expression|@import|[<>]|javascript:/i.test(raw)
          ) {
            bodyVar = raw;
            break;
          }
        }
      } catch (errFont) {
        bodyVar = "";
      }
      if (bodyVar) this.root.style.setProperty("--sf-font-body", bodyVar);
    } else {
      this.root.style.fontFamily = "";
      this.root.style.fontSize = cs.fontSize;
    }
  };

  Widget.prototype.scheduleLayoutRetry = function () {
    var self = this;
    if (this._layoutRetryTimer) return;
    if (this._layoutAttempts >= LAYOUT_RETRY_MAX) return;
    this._layoutRetryTimer = window.setTimeout(function () {
      self._layoutRetryTimer = null;
      self._layoutAttempts += 1;
      self.syncCollectionLayout();
    }, LAYOUT_RETRY_MS);
  };

  Widget.prototype.disconnectLateGridObserver = function () {
    if (this._lateGridObserver) {
      this._lateGridObserver.disconnect();
      this._lateGridObserver = null;
    }
    if (this._lateGridTimer) {
      window.clearTimeout(this._lateGridTimer);
      this._lateGridTimer = null;
    }
  };

  Widget.prototype.observeLateGrid = function () {
    var self = this;
    if (this._lateGridObserver) return;
    if (typeof MutationObserver !== "function") return;
    var target = findMainFallbackEl() || document.body;
    if (!target) return;
    this._lateGridObserver = new MutationObserver(function () {
      var found = null;
      try {
        found = gridFromSelector(
          (self.embedConfig || readEmbedConfig()).productGridSelector,
        );
      } catch (errSel) {
        found = null;
      }
      if (!found) found = discoverGridParent();
      if (!found) return;
      self._gridParent = found;
      self.disconnectLateGridObserver();
      self.syncCollectionLayout();
      self.replayAppGridIfNeeded();
    });
    this._lateGridObserver.observe(target, { childList: true, subtree: true });
    this._lateGridTimer = window.setTimeout(function () {
      self.disconnectLateGridObserver();
    }, LATE_GRID_OBSERVE_MS);
  };

  Widget.prototype.placeAtMainFallback = function (mount) {
    if (!mount || this._layoutFallbackDone) return false;
    var main = findMainFallbackEl();
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

  Widget.prototype.wrapHostWithLayout = function (host, mount, position) {
    if (isFragileLayoutHost(host) && host.parentElement && !isDocumentRoot(host.parentElement)) {
      host = host.parentElement;
    }
    var layout =
      closestLayoutEl(mount) ||
      closestLayoutEl(host) ||
      (host.parentNode &&
      host.parentNode.classList &&
      host.parentNode.classList.contains("sf-collection-layout")
        ? host.parentNode
        : null);
    if (layout && (matchesSel(layout, NATIVE_FACET_HOST_SELECTOR) || isFragileLayoutHost(layout))) {
      layout = null;
    }
    if (!layout) {
      var parent = host.parentNode;
      if (!parent) return null;
      layout = document.createElement("div");
      parent.insertBefore(layout, host);
    }
    applyLayoutPositionClass(layout, position);
    if (host.parentNode !== layout) {
      layout.appendChild(host);
    }
    if (host.classList) host.classList.add("sf-layout-main");
    placeMountInLayout(layout, mount, position);
    return layout;
  };

  Widget.prototype.syncCollectionLayout = function () {
    var mount = widgetMountNode(this.root);
    if (!mount) return;

    var grid = this.ensureGridParent();
    var position = POSITIONS[this.position] ? this.position : "left";
    var existingLayout = closestLayoutEl(mount);
    if (existingLayout) applyLayoutPositionClass(existingLayout, position);

    if (!grid) {
      this.placeAtMainFallback(mount);
      this.observeLateGrid();
      if (this._layoutAttempts >= LAYOUT_RETRY_MAX) {
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
    this.disconnectLateGridObserver();

    var host = this.findLayoutHost(grid);
    if (!host && grid && !isDocumentRoot(grid)) host = grid;
    if (!host) {
      this.placeAtMainFallback(mount);
      this.markFilterPlaced();
      this.replayAppGridIfNeeded();
      return;
    }

    if (isProductCardGrid(host)) {
      var hostParent = host.parentElement;
      if (
        hostParent &&
        !isDocumentRoot(hostParent) &&
        !isSkippedRegion(hostParent)
      ) {
        host = hostParent;
      }
    }

    if (isFragileLayoutHost(host) && host.parentElement && !isDocumentRoot(host.parentElement)) {
      host = host.parentElement;
    }

    var originSection = mount.closest ? mount.closest(".shopify-section") : null;

    if (
      host.classList &&
      host.classList.contains("sf-collection-layout") &&
      !isProductCardGrid(host) &&
      !matchesSel(host, NATIVE_FACET_HOST_SELECTOR) &&
      !isFragileLayoutHost(host)
    ) {
      applyLayoutPositionClass(host, position);
      placeMountInLayout(host, mount, position);
      hideEmptyShopifySection(originSection, mount);
      this.markFilterPlaced();
      this.inheritThemeType();
      this.placeSortOnGrid();
      this.hideThemeDuplicateChrome();
      this.replayAppGridIfNeeded();
      return;
    }

    var layout = this.wrapHostWithLayout(host, mount, position);
    if (!layout) {
      this.placeAtMainFallback(mount);
      this.markFilterPlaced();
      this.placeSortOnGrid();
      this.hideThemeDuplicateChrome();
      this.replayAppGridIfNeeded();
      return;
    }

    hideEmptyShopifySection(originSection, mount);
    this.markFilterPlaced();
    this.inheritThemeType();
    this.placeSortOnGrid();
    this.hideThemeDuplicateChrome();
    this.replayAppGridIfNeeded();
  };

  Widget.prototype.replayAppGridIfNeeded = function () {
    if (!this.isAppGridMode() || this._appGridActive || !this._pendingAppGrid) {
      return;
    }
    if (!this.ensureGridParent()) return;
    var pending = this._pendingAppGrid;
    this.applyAppGrid(pending.data, pending.handles, false);
    this.setThemePagerHidden(true);
    this.renderPager();
    this.ensureQuickviewButtons();
  };

  Widget.prototype.markFilterPlaced = function () {
    this.root.classList.add("is-placed");
    this.root.setAttribute("data-placed", "true");
  };

  Widget.prototype.ensurePageSize = function () {
    if (this._themePageSize >= 8 && this._themePageSize <= 48) {
      this.pageSize = this._themePageSize;
      return this.pageSize;
    }
    this.pageSize = clampPageSize(this.pageSize);
    this._themePageSize = this.pageSize;
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
      setThemeCardImage(img, imageUrl);
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
      var base = String(handle || "").split("::")[0];
      if (base && self._cardCache[base]) return false;
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
          var hasProductLink =
            doc.querySelector && doc.querySelector('a[href*="/products/"]');
          if (!hasProductLink) self._themeNoMore = true;
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
    var lists = document.querySelectorAll("results-list");
    for (i = 0; i < lists.length; i++) {
      el = lists[i];
      if (!el) continue;
      if (hide) {
        if (el.hasAttribute("infinite-scroll")) {
          el.setAttribute("data-sf-infinite", "1");
          el.removeAttribute("infinite-scroll");
        }
      } else if (el.getAttribute("data-sf-infinite") === "1") {
        el.setAttribute("infinite-scroll", "");
        el.removeAttribute("data-sf-infinite");
      }
    }
  };

  Widget.prototype.removeImportedCards = function () {
    var self = this;
    Object.keys(this._importedHandles || {}).forEach(function (handle) {
      var card = self._cardCache[handle];
      if (card && card.parentNode) {
        card.parentNode.removeChild(card);
      }
      delete self._cardCache[handle];
    });
    this._importedHandles = {};
    this._themePagesCached = {};
    this._themeNoMore = false;
  };

  Widget.prototype.restoreThemePaging = function () {
    this.disconnectInfinite();
    this.setThemePagerHidden(false);
    if (this._pagerEl) this._pagerEl.hidden = true;
    this.removeImportedCards();
  };

  Widget.prototype.syncProductGrid = function (handles) {
    applyProductVisibility(handles);
    applyProductOrder(handles);
  };

  Widget.prototype.enterPagingFallback = function (handles, data) {
    this._pagingFallback = true;
    this._loadingPage = false;
    if (this.renderPager) this.renderPager();
    else this.restoreThemePaging();
    if (handles) {
      this._visibleHandles = handles;
      this.syncProductGrid(handles);
      applyVariantImages(
        this.showMatchingVariantImage === false
          ? []
          : data && data.products,
      );
      dispatchUpdate(handles);
      if (data) this.updateStatus(data, handles);
      this.ensureQuickviewButtons();
      this.hideThemeDuplicateChrome();
      this.watchThemeGrid();
    }
  };

  Widget.prototype.applyInterceptGrid = function (handles, append) {
    var parent = this.ensureGridParent();
    if (!parent) return false;
    var next = append ? this._shownHandles.slice() : [];
    uniqueHandleList(handles).forEach(function (handle) {
      if (next.indexOf(handle) === -1) next.push(handle);
    });
    var shown = [];
    var i;
    for (i = 0; i < next.length; i++) {
      var handle = next[i];
      var card = this._cardCache[handle];
      if (!card || (card.isConnected === false && card._sfMounted)) continue;
      shown.push(handle);
      if (card.parentNode !== parent) {
        parent.appendChild(card);
      } else {
        parent.appendChild(card);
      }
      setCardHidden(card, false);
    }
    if (!shown.length && next.length) return false;
    var allowed = allowedHandleMap(shown);
    eachProductCard(parent, function (handle, card) {
      if (handleIsAllowed(allowed, handle)) return;
      setCardHidden(card, true);
    });
    this._shownHandles = shown;
    return true;
  };

  Widget.prototype.disconnectInfinite = function () {
    if (this._infiniteObserver) {
      this._infiniteObserver.disconnect();
      this._infiniteObserver = null;
    }
  };

  Widget.prototype.readPagingMeta = function (data, handles) {
    data = data || {};
    handles = handles || [];
    if (typeof data.page === "number" && data.page >= 1) {
      this.page = Math.floor(data.page);
    }
    this.ensurePageSize();
    var total = Number(data.total);
    if (!Number.isFinite(total) || total < 0) total = Number(data.count);
    var handleCount = Array.isArray(data.handles) ? data.handles.length : 0;
    if (!Number.isFinite(total) || total < 0) {
      total = handleCount || handles.length || 0;
    }
    /* Do not inflate total from page-sliced handles.length */
    this._pageTotal = total;
    if (
      handles.length > this._pageTotal &&
      !(Number.isFinite(Number(data.total)) && Number(data.total) >= 0)
    ) {
      this._pageTotal = handles.length;
    }
    this._statusProductCount = this._pageTotal;
  };

  Widget.prototype.goToPage = function (page) {
    var next = Math.max(1, Math.floor(Number(page) || 1));
    var current = Math.max(1, Number(this.page) || 1);
    if (next === 1 && current === 1 && !this._inflight && !this._loadingPage) {
      return;
    }
    this._loadingPage = true;
    this._sfPaged = true;
    /* Page 2+ takeover only — page 1 default browse must restore Liquid. */
    if (next > 1) {
      this._keepThemeCards = false;
      this._sfNativeListing = false;
      this._sfPaintedReq = -1;
    } else {
      delete this._keepThemeCards;
    }
    this.page = next;
    this.renderPager();
    this.fetchFilters({ page: next });
  };

  Widget.prototype.renderPager = function () {};

  Widget.prototype.finishEnabledFalse = function () {
    this.page = 1;
    this._shownHandles = [];
    this._lastProducts = [];
    if (this._appGridActive) this.restoreNativeGrid();
    this._pendingAppGrid = null;
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
    this.syncProductGrid(handles);
    applyVariantImages(
      this.showMatchingVariantImage === false ? [] : data && data.products,
    );
    dispatchUpdate(handles);
  };

  Widget.prototype.fetchFilters = function (opts) {
    opts = opts || {};
    var append = Boolean(opts.append);
    var attempt = Number(opts._attempt) || 0;
    var fr = window.__FINDLY_FILTER_FETCH;
    if (!append) {
      this.page = opts.page != null ? Math.max(1, Number(opts.page) || 1) : 1;
      this._shownHandles = [];
      this._lastProducts = [];
      this._pagingFallback = false;
      this._loadingPage = true;
      this._importingCards = false;
    }

    if (!append && !this.hasFacetChrome()) {
      setStatus(this.statusEl, this.t("loading", MSG_LOADING), false);
    }
    this.hideThemeDuplicateChrome();
    this.ensurePageSize();
    if (!append) {
      if (!this._deferGridBusy) this.setGridBusy(true);
      this._deferGridBusy = false;
    }
    if (!append && this.autoApplyFilters === false && this.facetsEl) {
      var applyNowBtn = this.facetsEl.querySelector(".sf-apply-now");
      if (applyNowBtn) {
        applyNowBtn.disabled = true;
        applyNowBtn.setAttribute("aria-busy", "true");
      }
    }

    var url = this.buildProxyUrl();
    if (!append && this._inflightUrl === url && this._inflight) {
      return this._inflight;
    }

    var reqId = append ? this._reqId : ++this._reqId;
    if (!append && this._abortCtrl) {
      try {
        this._abortCtrl.abort();
      } catch (err) {
        /* ignore */
      }
    }
    var ctrl =
      !append && typeof AbortController === "function"
        ? new AbortController()
        : null;
    var timedOut = false;
    var timeoutId = 0;
    var fetchMs =
      (fr && fr.ms ? fr.ms : 15000) +
      attempt * (fr && fr.step ? fr.step : 5000);
    if (ctrl) {
      this._abortCtrl = ctrl;
      timeoutId = window.setTimeout(function () {
        timedOut = true;
        try {
          ctrl.abort();
        } catch (ignore) {
          /* ignore */
        }
      }, fetchMs);
    }

    var clearFetchTimer = function () {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
        timeoutId = 0;
      }
    };

    var request = fetch(url, {
      credentials: "same-origin",
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: ctrl ? ctrl.signal : undefined,
    })
      .then(
        function (response) {
          clearFetchTimer();
          if (!response.ok) {
            throw new Error("Request failed (" + response.status + ")");
          }
          var self = this;
          var tJson =
            typeof performance !== "undefined" && performance.now
              ? performance.now()
              : Date.now();
          return response.json().then(function (data) {
            self._findlyJsonMs =
              (typeof performance !== "undefined" && performance.now
                ? performance.now()
                : Date.now()) - tJson;
            return data;
          });
        }.bind(this),
      )
      .then(
        function (data) {
          if (reqId !== this._reqId) {
            return fr && fr.stale ? fr.stale() : Promise.reject();
          }

          if (data && data.enabled === false) {
            this.applyI18n(data);
            this.applySettings(data && data.settings);
            this.applyI18nChrome();
            this.facets = [];
            if (this.facetsEl) this.facetsEl.innerHTML = "";
            this.syncProductGrid(null);
            applyVariantImages([]);
            dispatchUpdate([]);
            writeHash(
              this.selected,
              this.price,
              this.sortKey,
              this.collectionQuery,
              this.defaultSort,
            );
            setStatus(this.statusEl, this.t("disabled", MSG_DISABLED), false);
            this.syncDrawerBadge();
            this.finishEnabledFalse();
            this.setGridBusy(false);
            return;
          }

          this.applyI18n(data);
          this.applySettings(data && data.settings);
          this.applyI18nChrome();

          if (!append) {
            this.facets = dropCollectionFacetUnlessCatalog(
              this,
              normalizeFacets(data),
            );
            this.markFiltersApplied();
            var keepFacets =
              opts.page != null &&
              this.facetsEl &&
              this.facetsEl.querySelector(".sf-facet");
            if (!keepFacets) this.renderFacets();
            setStatus(this.statusEl, "", false);
          }

          var intercept = this.shouldInterceptPaging();
          var allHandles = Array.isArray(data && data.handles)
            ? data.handles.map(String)
            : extractHandles(data);
          var handles = allHandles;
          this.ensurePageSize();
          var pageSize = this.pageSize || 16;
          if (intercept) {
            var fromProducts = extractHandles({
              products: data && data.products ? data.products : [],
            });
            var sliceStart =
              (Math.max(1, this.page) - 1) * pageSize;
            if (fromProducts.length && fromProducts.length <= pageSize) {
              handles = fromProducts;
            } else if (allHandles.length <= pageSize) {
              handles = allHandles;
            } else {
              handles = allHandles.slice(sliceStart, sliceStart + pageSize);
            }
          }
          this._allFilterHandles = allHandles;
          this._lastFilterData = data;
          this.readPagingMeta(data, allHandles);
          if (append) {
            this._lastProducts = (this._lastProducts || []).concat(
              data && data.products ? data.products : [],
            );
          } else {
            this._lastProducts = (data && data.products) || [];
          }
          writeFilterCache(this.filterCacheKey(), data);

          var self = this;

          function afterGrid(visible) {
            writeHash(
              self.selected,
              self.price,
              self.sortKey,
              self.collectionQuery,
              self.defaultSort,
            );
            self._visibleHandles = visible || [];
            self.hideThemeDuplicateChrome();
            if (!(self.isAppGridMode && self.isAppGridMode())) {
              self.syncProductGrid(visible);
            }
            if (!self._importingCards) {
              self.setGridBusy(false);
              self._loadingPage = false;
            }
            self.renderPager();
            self.watchThemeGrid();
            applyVariantImages(
              self.showMatchingVariantImage === false ? [] : self._lastProducts,
            );
            dispatchUpdate(visible);
            self.updateStatus(data, visible);
            self.syncDrawerBadge();
            self.ensureQuickviewButtons();
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

          if (this.isAppGridMode()) {
            this._loadingPage = false;
            this._pendingAppGrid = { data: data, handles: handles };
            this.applyAppGrid(data, handles, append);
            this.setThemePagerHidden(true);
            this.renderPager();
            afterGrid(this._shownHandles.length ? this._shownHandles : handles);
            return;
          }

          if (this._appGridActive) this.restoreNativeGrid();
          this._pendingAppGrid = null;

          if (!intercept) {
            this._loadingPage = false;
            this.ensureVariantCards(this._lastProducts);
            this.applyThemeGridLegacy(data, handles);
            afterGrid(handles);
            return;
          }

          this.ensureVariantCards(this._lastProducts);
          return this.ensureCardsForHandles(handles).then(function (ok) {
            if (reqId !== self._reqId) {
              return fr && fr.stale ? fr.stale() : Promise.reject();
            }
            self._loadingPage = false;
            if (!ok) {
              if (self.applyAppGrid(data, handles, append)) {
                self.setThemePagerHidden(true);
                self.renderPager();
                afterGrid(
                  self._shownHandles.length ? self._shownHandles : handles,
                );
                return;
              }
              self.enterPagingFallback(handles, data);
              afterGrid(handles);
              return;
            }
            var applied = self.applyInterceptGrid(handles, append);
            if (!applied) {
              if (self.applyAppGrid(data, handles, append)) {
                self.setThemePagerHidden(true);
                self.renderPager();
                afterGrid(
                  self._shownHandles.length ? self._shownHandles : handles,
                );
                return;
              }
              self.enterPagingFallback(handles, data);
              afterGrid(handles);
              return;
            }
            self.setThemePagerHidden(true);
            self.renderPager();
            afterGrid(self._shownHandles.length ? self._shownHandles : handles);
          });
        }.bind(this),
      )
      .catch(
        function (err) {
          clearFetchTimer();
          if (reqId !== this._reqId) {
            return fr && fr.stale ? fr.stale() : Promise.reject();
          }
          if (err && err.name === "FindlyStaleRequest") return;
          if (err && err.name === "AbortError" && !timedOut) return;
          if (timedOut) {
            try {
              err._findlyTimedOut = 1;
            } catch (ignore) {
              /* ignore */
            }
          }
          if (append) {
            this.page = Math.max(1, (this.page || 1) - 1);
          } else if (opts.page != null) {
            /* Failed page jump — snap back so the next click is not a no-op. */
            this.page = 1;
          }
          this._loadingPage = false;
          this.setGridBusy(false);
          this.renderPager();
          return Promise.reject(err);
        }.bind(this),
      );

    if (!append) {
      this._inflightUrl = url;
      this._inflight = request.then(
        function (value) {
          if (this._inflightUrl === url) {
            this._inflight = null;
            this._inflightUrl = "";
          }
          return value;
        }.bind(this),
        function (err) {
          if (this._inflightUrl === url) {
            this._inflight = null;
            this._inflightUrl = "";
          }
          throw err;
        }.bind(this),
      );
      return this._inflight;
    }
    return request;
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
    if (event.key === "Escape") {
      this.closeDrawer();
      return;
    }
    if (event.key !== "Tab") return;
    var panel = this.panelEl;
    if (!panel || !panel.querySelectorAll) return;
    var nodes = panel.querySelectorAll(
      "button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])",
    );
    var list = [];
    var i;
    for (i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (!el || el.hidden || el.getAttribute("hidden") != null) continue;
      if (el.closest && el.closest("[hidden]")) continue;
      list.push(el);
    }
    if (!list.length) return;
    var first = list[0];
    var last = list[list.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
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

  Widget.prototype.selectionSnapshot = function () {
    return JSON.stringify({ s: this.selected, p: this.price });
  };

  Widget.prototype.markFiltersApplied = function () {
    this._appliedSnapshot = this.selectionSnapshot();
  };

  Widget.prototype.hasPendingFilterChanges = function () {
    return this.selectionSnapshot() !== this._appliedSnapshot;
  };

  Widget.prototype.commitFilters = function (keepFacets) {
    writeHash(
      this.selected,
      this.price,
      this.sortKey,
      this.collectionQuery,
    );
    if (this.autoApplyFilters !== false) {
      this.fetchFilters();
      return;
    }
    if (keepFacets) {
      this.renderApplyBar();
    } else {
      this.renderFacets();
    }
    this.syncDrawerBadge();
    this.syncClearAll();
  };

  Widget.prototype.applyPendingFilters = function () {
    this.fetchFilters();
  };

  Widget.prototype.shouldNavigateCollectionFacet = function () {
    var facet = (this.facets || []).find(isCollectionFacet);
    if (isCollectionRedirectFacet(facet)) return true;
    if (this.searchQuery) return false;
    if (facet && facet.displayType && facet.displayType !== "collection") {
      return false;
    }
    var handle = String(this.collectionHandle || inferCollectionHandle() || "");
    if (isAllProductsCollectionHandle(handle)) return false;
    return Boolean(this.collectionId || handle);
  };

  Widget.prototype.permalinkForCollectionValue = function (value) {
    var wanted = String(value == null ? "" : value);
    if (!wanted) return "";
    var facet = (this.facets || []).find(isCollectionFacet);
    if (!facet) return "";
    var found = null;
    function walk(items) {
      if (found || !items || !items.length) return;
      items.forEach(function (item) {
        if (found || !item) return;
        var itemValue = String(item.value != null ? item.value : "");
        var itemHandle = String(item.handle != null ? item.handle : "");
        if (itemValue === wanted || itemHandle === wanted) {
          found = item;
          return;
        }
        walk(item.children);
      });
    }
    walk(facet.values);
    if (!found) return "";
    var href =
      found.url ||
      (found.handle
        ? "/collections/" + String(found.handle).replace(/^\/+|\/+$/g, "")
        : "");
    return storefrontCollectionUrl(href);
  };

  Widget.prototype.navigateToCollectionValue = function (value) {
    if (!this.shouldNavigateCollectionFacet()) return false;
    var href = this.permalinkForCollectionValue(value);
    if (!href) return false;
    if (isCurrentStorefrontPath(href)) return false;
    window.location.assign(href);
    return true;
  };

  Widget.prototype.isCurrentCollectionNavItem = function (item, href) {
    var currentHandle = normalizeCollectionHandle(
      this.collectionHandle || inferCollectionHandle(),
    );
    var itemHandle = normalizeCollectionHandle(item && item.handle);
    if (currentHandle && itemHandle && currentHandle === itemHandle) return true;
    var currentId = collectionNumericId(this.collectionId);
    var itemId = collectionNumericId(item && item.value);
    if (currentId && itemId && currentId === itemId) return true;
    return Boolean(href && isCurrentStorefrontPath(href));
  };

  Widget.prototype.toggleValue = function (key, value, checked) {
    if (checked && isCollectionFilterKey(key) && this.navigateToCollectionValue(value)) {
      return;
    }
    if (!this.selected[key]) this.selected[key] = [];
    var list = this.selected[key];
    var index = list.indexOf(value);
    if (checked && index === -1) {
      list.push(value);
    } else if (!checked && index !== -1) {
      list.splice(index, 1);
    }
    if (!list.length) delete this.selected[key];
    this.commitFilters();
  };

  Widget.prototype.clearFilters = function () {
    this.selected = {};
    this.price = { min: "", max: "" };
    this._importingCards = false;
    this.fetchFilters();
  };

  Widget.prototype.bindClearAll = function () {
    if (!this.clearAllEl) return;
    this.clearAllEl.addEventListener(
      "click",
      function () {
        this.clearFilters();
      }.bind(this),
    );
    this.syncClearAll();
  };

  Widget.prototype.syncClearAll = function () {
    var el = this.clearAllEl;
    if (!el) return;
    el.textContent = this.t(
      "clear",
      (el.textContent || "").trim() || MSG_CLEAR,
    );
    var active = this.hasActiveFilters();
    el.disabled = !active;
    el.hidden = !active;
    el.classList.toggle("is-disabled", !active);
    el.setAttribute("aria-disabled", String(!active));
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
    wrap.className = "sf-chips";
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
        rangeChip.className = "sf-chip";
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
          '</span><span class="sf-chip-remove" aria-hidden="true">×</span>';
        rangeChip.addEventListener("click", function () {
          delete self.selected[key];
          self.commitFilters();
        });
        wrap.appendChild(rangeChip);
        return;
      }
      vals.forEach(function (value) {
        var chipLabel = chipDisplayLabel(self.facets, key, value);
        if (!chipLabel || String(chipLabel).indexOf("gid://") === 0) return;
        var chip = document.createElement("button");
        chip.type = "button";
        chip.className = "sf-chip";
        chip.setAttribute("aria-label", "Remove " + chipLabel);
        chip.innerHTML =
          "<span>" +
          String(chipLabel).replace(/</g, "&lt;") +
          '</span><span class="sf-chip-remove" aria-hidden="true">×</span>';
        chip.addEventListener("click", function () {
          self.toggleValue(key, value, false);
        });
        wrap.appendChild(chip);
      });
    });

    if (this.price.min || this.price.max) {
      var priceChip = document.createElement("button");
      priceChip.type = "button";
      priceChip.className = "sf-chip";
      priceChip.innerHTML =
        "<span>" +
        (this.price.min !== ""
          ? formatMoney(this.price.min, this.currency)
          : "Min") +
        " – " +
        (this.price.max !== ""
          ? formatMoney(this.price.max, this.currency)
          : "Max") +
        '</span><span class="sf-chip-remove" aria-hidden="true">×</span>';
      priceChip.addEventListener("click", function () {
        self.price = { min: "", max: "" };
        self.commitFilters();
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
        wrap.className = "sf-facet";
        wrap.setAttribute("data-facet-key", facet.key);
        if (this.isFacetCollapsed(facet.key)) {
          wrap.classList.add("is-collapsed");
        }

        var label = document.createElement("button");
        label.type = "button";
        label.className = "sf-facet-label";
        label.setAttribute("aria-expanded", String(!wrap.classList.contains("is-collapsed")));

        var labelText = document.createElement("span");
        labelText.className = "sf-facet-text";
        labelText.appendChild(document.createTextNode(facet.label));
        var chevron = document.createElement("span");
        chevron.className = "sf-chevron";
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
        } else if (
          isCollectionRedirectFacet(facet) ||
          (isCollectionFacet(facet) && this.shouldNavigateCollectionFacet())
        ) {
          wrap.appendChild(this.renderCollectionFacet(facet));
        } else if (facet.displayType === "dropdown") {
          wrap.appendChild(this.renderDropdownFacet(facet));
        } else {
          wrap.appendChild(this.renderListFacet(facet));
        }
        this.facetsEl.appendChild(wrap);
      }.bind(this),
    );

    this.syncClearAll();
    this.renderApplyBar();
  };

  Widget.prototype.renderApplyBar = function () {
    if (!this.facetsEl) return;
    var existing = this.facetsEl.querySelectorAll(".sf-apply-bar");
    for (var i = 0; i < existing.length; i += 1) {
      existing[i].parentNode.removeChild(existing[i]);
    }
    if (this.autoApplyFilters !== false) return;

    var bar = document.createElement("div");
    bar.className = "sf-apply-bar";
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className =
      "sf-btn sf-btn-primary sf-apply-now";
    btn.textContent = this.t("apply_now", MSG_APPLY_NOW);
    btn.disabled = !this.hasPendingFilterChanges();
    btn.addEventListener(
      "click",
      function () {
        this.applyPendingFilters();
      }.bind(this),
    );
    bar.appendChild(btn);
    this.facetsEl.appendChild(bar);
  };

  Widget.prototype.renderDropdownFacet = function (facet) {
    var wrap = document.createElement("div");
    wrap.className = "sf-dropdown-wrap";
    var select = document.createElement("select");
    select.className = "sf-dropdown";
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
        if (
          select.value &&
          isCollectionFacet(facet) &&
          this.navigateToCollectionValue(select.value)
        ) {
          return;
        }
        if (!select.value) delete this.selected[facet.key];
        else this.selected[facet.key] = [select.value];
        this.commitFilters();
      }.bind(this),
    );
    wrap.appendChild(select);
    return wrap;
  };

  Widget.prototype.renderCollectionFacet = function (facet) {
    var list = document.createElement("ul");
    list.className =
      "sf-options sf-options-collection-nav" +
      (facet.collectionTree ? " sf-options-collection-tree" : "");
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
        var href = storefrontCollectionUrl(
          item.url ||
            (item.handle
              ? "/collections/" + String(item.handle).replace(/^\/+|\/+$/g, "")
              : ""),
        );
        var count = item.count;
        var li = document.createElement("li");
        if (item.children && item.children.length) {
          li.classList.add("sf-tree-node");
        }
        var link = document.createElement("a");
        link.className = "sf-option sf-collection-link";
        link.href = href || "#";
        if (this.isCurrentCollectionNavItem(item, href)) {
          li.classList.add("is-current");
          link.classList.add("is-current");
          link.setAttribute("aria-current", "page");
        }
        var text = document.createElement("span");
        text.className = "sf-option-text";
        text.textContent = labelText;
        link.appendChild(text);
        if (this.showCounts && typeof count === "number") {
          var countEl = document.createElement("span");
          countEl.className = "sf-option-count";
          countEl.textContent = String(count);
          link.appendChild(countEl);
        }
        if (href) {
          link.addEventListener(
            "click",
            function (event) {
              if (event.button !== 0) return;
              if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
                return;
              }
              event.preventDefault();
              if (isCurrentStorefrontPath(href)) return;
              window.location.assign(href);
            }.bind(this),
          );
        }
        li.appendChild(link);
        if (item.children && item.children.length) {
          var toggle = document.createElement("button");
          toggle.type = "button";
          toggle.className = "sf-tree-toggle";
          toggle.setAttribute("aria-expanded", "true");
          toggle.setAttribute("aria-label", "Toggle " + labelText);
          toggle.addEventListener("click", function (event) {
            event.preventDefault();
            event.stopPropagation();
            var collapsed = li.classList.toggle("is-tree-collapsed");
            toggle.setAttribute("aria-expanded", String(!collapsed));
          });
          li.appendChild(toggle);
          var nested = document.createElement("ul");
          nested.className = "sf-tree-children";
          this.appendCollectionNavItems(nested, item.children);
          li.appendChild(nested);
        }
        list.appendChild(li);
      }.bind(this),
    );
  };

  Widget.prototype.renderBooleanFacet = function (facet) {
    var list = this.renderListFacet(facet);
    list.className = "sf-options sf-options-boolean";
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
      "sf-options" +
      (asColor ? " sf-options-swatches" : "") +
      (asSize ? " sf-options-pills" : "") +
      (asBoolean ? " sf-options-boolean" : "") +
      (asRating ? " sf-options-stars" : "") +
      (asSwatchText ? " sf-options-swatch-text" : "") +
      (asPlainList ? " sf-options-list" : "") +
      (facet.collectionTree ||
      facet.source === "collection" ||
      valuesHaveChildren(facet.values)
        ? " sf-options-collection-tree"
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
        if (item.children && item.children.length) {
          li.classList.add("sf-tree-node");
        }
        var label = document.createElement("label");
        label.className = "sf-option";
        if (asColor) label.className += " sf-swatch";
        if (asSwatchText) label.className += " sf-swatch-text";
        if (asSize) label.className += " sf-pill";
        label.title = labelText + (typeof count === "number" ? " (" + count + ")" : "");

        if (asColor) applyFacetSwatch(label, item, labelText, value);

        var memberValues = Array.isArray(item.memberValues) ? item.memberValues : [];
        var isPathGroup =
          Boolean(item.synthetic) || String(value).indexOf("path:") === 0;
        var selectedMembers = memberValues.filter(function (member) {
          return selected.indexOf(member) !== -1;
        });
        var input = document.createElement("input");
        input.type = asRadio ? "radio" : "checkbox";
        input.name = "sf." + facet.key;
        input.value = value;
        if (isPathGroup && memberValues.length) {
          input.checked = selectedMembers.length === memberValues.length;
          input.indeterminate =
            selectedMembers.length > 0 && selectedMembers.length < memberValues.length;
        } else {
          input.checked = selected.indexOf(value) !== -1;
        }
        input.disabled = isBinary && empty && !input.checked;
        if (asPlainList) input.className = "sf-sr-only";
        input.addEventListener(
          "change",
          function (event) {
            if (asRadio) {
              if (
                event.target.checked &&
                isCollectionFacet(facet) &&
                this.navigateToCollectionValue(value)
              ) {
                return;
              }
              this.selected[facet.key] = event.target.checked ? [value] : [];
              if (!this.selected[facet.key].length) delete this.selected[facet.key];
              this.commitFilters();
              return;
            }
            if (isPathGroup && memberValues.length) {
              var next = (this.selected[facet.key] || []).slice();
              memberValues.forEach(function (member) {
                var index = next.indexOf(member);
                if (event.target.checked && index === -1) next.push(member);
                if (!event.target.checked && index !== -1) next.splice(index, 1);
              });
              if (!next.length) delete this.selected[facet.key];
              else this.selected[facet.key] = next;
              this.commitFilters();
              return;
            }
            this.toggleValue(facet.key, value, event.target.checked);
          }.bind(this),
        );

        var text = document.createElement("span");
        text.className = "sf-option-text";
        if (asRating) {
          var filled = Math.max(0, Math.min(5, Math.round(Number(value) || 0)));
          text.className += " sf-stars";
          text.setAttribute(
            "aria-label",
            filled + " stars " + this.t("and_up", "and up"),
          );
          for (var s = 1; s <= 5; s += 1) {
            var star = document.createElement("span");
            star.className =
              "sf-star" + (s <= filled ? " is-on" : "");
            star.textContent = s <= filled ? "★" : "☆";
            text.appendChild(star);
          }
        } else {
          text.textContent = labelText;
        }
        label.appendChild(input);
        label.appendChild(text);

        if (showCounts && typeof count === "number" && !asSize) {
          var countEl = document.createElement("span");
          countEl.className = "sf-option-count";
          countEl.textContent = String(count);
          label.appendChild(countEl);
        }

        li.appendChild(label);
        if (item.children && item.children.length) {
          var toggle = document.createElement("button");
          toggle.type = "button";
          toggle.className = "sf-tree-toggle";
          toggle.setAttribute("aria-expanded", "true");
          toggle.setAttribute("aria-label", "Toggle " + labelText);
          toggle.addEventListener("click", function (event) {
            event.preventDefault();
            event.stopPropagation();
            var collapsed = li.classList.toggle("is-tree-collapsed");
            toggle.setAttribute("aria-expanded", String(!collapsed));
          });
          li.appendChild(toggle);
          var nested = document.createElement("ul");
          nested.className = "sf-tree-children";
          addItems(nested, item.children);
          li.appendChild(nested);
        }
        targetList.appendChild(li);
      }.bind(this),
    );
    }.bind(this);
    addItems(list, items);

    return list;
  };

  Widget.prototype.applyRangeValues = function (facet, min, max, isProductPrice) {
    var nextMin = String(min || "");
    var nextMax = String(max || "");
    if (isProductPrice) {
      var boundMin = Number(facet && facet.min);
      var boundMax = Number(facet && facet.max);
      if (
        Number.isFinite(boundMin) &&
        Number.isFinite(boundMax) &&
        nextMin !== "" &&
        nextMax !== "" &&
        Number(nextMin) === boundMin &&
        Number(nextMax) === boundMax
      ) {
        nextMin = "";
        nextMax = "";
      }
      if (this.price.min === nextMin && this.price.max === nextMax) return;
      this.price.min = nextMin;
      this.price.max = nextMax;
    } else {
      var current = this.selected[facet.key] || ["", ""];
      if (
        !nextMin &&
        !nextMax &&
        !this.selected[facet.key]
      ) {
        return;
      }
      if (current[0] === nextMin && current[1] === nextMax) return;
      if (!nextMin && !nextMax) delete this.selected[facet.key];
      else this.selected[facet.key] = [nextMin, nextMax];
    }
    this.commitFilters(true);
  };

  Widget.prototype.renderPriceFacet = function (facet) {
    var wrap = document.createElement("div");
    wrap.className = "sf-price";
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

    var minField = document.createElement("div");
    minField.className = "sf-price-field";
    var minInput = document.createElement("input");
    minInput.type = "number";
    minInput.inputMode = "decimal";
    minInput.setAttribute("aria-label", this.t("min", MSG_MIN));
    if (hasBounds) {
      minInput.min = String(boundMin);
      minInput.max = String(boundMax);
      minInput.placeholder = String(Math.round(boundMin));
    } else {
      minInput.placeholder = this.t("min", MSG_MIN);
    }
    minInput.value =
      current[0] !== "" && current[0] != null
        ? String(current[0])
        : hasBounds
          ? String(Math.round(boundMin))
          : "";
    minField.appendChild(minInput);

    var sep = document.createElement("span");
    sep.className = "sf-price-sep";
    sep.setAttribute("aria-hidden", "true");
    sep.textContent = "–";

    var maxField = document.createElement("div");
    maxField.className = "sf-price-field";
    var maxInput = document.createElement("input");
    maxInput.type = "number";
    maxInput.inputMode = "decimal";
    maxInput.setAttribute("aria-label", this.t("max", MSG_MAX));
    if (hasBounds) {
      maxInput.min = String(boundMin);
      maxInput.max = String(boundMax);
      maxInput.placeholder = String(Math.round(boundMax));
    } else {
      maxInput.placeholder = this.t("max", MSG_MAX);
    }
    maxInput.value =
      current[1] !== "" && current[1] != null
        ? String(current[1])
        : hasBounds
          ? String(Math.round(boundMax))
          : "";
    maxField.appendChild(maxInput);

    wrap.appendChild(minField);
    wrap.appendChild(sep);
    wrap.appendChild(maxField);

    var self = this;
    var debounceId = 0;
    var commitFromInputs = function () {
      self.applyRangeValues(
        facet,
        minInput.value.trim(),
        maxInput.value.trim(),
        isProductPrice,
      );
    };

    if (hasBounds) {
      var slider = document.createElement("div");
      slider.className = "sf-slider";
      var track = document.createElement("div");
      track.className = "sf-slider-track";
      var fill = document.createElement("div");
      fill.className = "sf-slider-fill";
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

      var bounds = document.createElement("div");
      bounds.className = "sf-price-bounds";
      var boundLow = document.createElement("span");
      boundLow.textContent = formatMoney(boundMin, this.currency);
      var boundHigh = document.createElement("span");
      boundHigh.textContent = formatMoney(boundMax, this.currency);
      bounds.appendChild(boundLow);
      bounds.appendChild(boundHigh);
      wrap.appendChild(bounds);

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
        if (self.autoApplyFilters === false) {
          self.applyRangeValues(facet, String(a), String(b), isProductPrice);
          return;
        }
        window.clearTimeout(debounceId);
        debounceId = window.setTimeout(function () {
          self.applyRangeValues(facet, String(a), String(b), isProductPrice);
        }, DEBOUNCE_MS);
      };
      low.addEventListener("input", commitFromSlider);
      high.addEventListener("input", commitFromSlider);
    }

    if (this.autoApplyFilters === false) {
      minInput.addEventListener("input", commitFromInputs);
      maxInput.addEventListener("input", commitFromInputs);
      minInput.addEventListener("change", commitFromInputs);
      maxInput.addEventListener("change", commitFromInputs);
    } else {
      var onNumberCommit = function () {
        window.clearTimeout(debounceId);
        debounceId = window.setTimeout(commitFromInputs, DEBOUNCE_MS);
      };
      minInput.addEventListener("input", onNumberCommit);
      maxInput.addEventListener("input", onNumberCommit);
      minInput.addEventListener("change", function () {
        window.clearTimeout(debounceId);
        commitFromInputs();
      });
      maxInput.addEventListener("change", function () {
        window.clearTimeout(debounceId);
        commitFromInputs();
      });
    }
    return wrap;
  };

  Widget.prototype.filterCacheKey = function () {
    return (
      FILTER_CACHE_PREFIX +
      shopDomain() +
      ":" +
      (this.collectionId ||
        this.collectionHandle ||
        "q:" + this.searchQuery) +
      ":" +
      JSON.stringify({
        s: this.selected,
        p: this.price,
        sort: this.sortKey || "",
        q: this.collectionQuery || "",
      })
    );
  };

  Widget.prototype.failFilterLoad = function (err) {
    this.setGridBusy(false);
    this._loadingPage = false;
    if (this.facetsEl) this.facetsEl.innerHTML = "";
    setStatus(this.statusEl, this.t("error", MSG_ERROR), true);
    logFilterError(this.t("error", MSG_ERROR), err);
    if (this.placeCollectionSearchOnGrid) this.placeCollectionSearchOnGrid();
  };

  Widget.prototype.hasFacetChrome = function () {
    if (!this.facetsEl) return false;
    return Boolean(
      this.facetsEl.querySelector(".sf-facet, [data-skeleton]"),
    );
  };

  Widget.prototype.hydrateFromCache = function () {
    var cached = readFilterCache(this.filterCacheKey());
    if (!cached || cached.enabled === false) return false;
    this._hydratedFromCache = true;
    this.applyI18n(cached);
    this.applySettings(cached.settings);
    this.applyI18nChrome();
    this.facets = dropCollectionFacetUnlessCatalog(this, normalizeFacets(cached));
    this.markFiltersApplied();
    this.renderFacets();
    setStatus(this.statusEl, "", false);
    return true;
  };

  Widget.prototype.init = function () {
    if (!this.collectionId && !this.searchQuery && !this.collectionHandle) {
      logFilterError(this.t("error", MSG_ERROR));
      return;
    }
    this.restoreFromHash();
    var loc = new URL(window.location.href);
    if (stripNativeCollectionParams(loc)) {
      window.history.replaceState(
        window.history.state,
        "",
        loc.pathname + loc.search + window.location.hash,
      );
    }
    this.markFiltersApplied();
    this.hydrateFromCache();
    this._deferGridBusy = !hasPersistableHashState(
      this.selected,
      this.price,
      this.sort,
      this.collectionQuery || this.searchQuery,
      this.defaultSort || "manual",
    );
    this.fetchFilters();
    this.syncCollectionLayout();
    this.inheritThemeType();
  };

  function boot() {
    if (window.__FINDLY_FILTER_BOOTED) return;
    ensureThemeBridgeStyles();
    bindNativeFacetGuard();
    var block = document.getElementById("smart-filter-root");
    var embed = document.getElementById("smart-filter-embed");
    if (block && embed && embed !== block) {
      if (embed.parentNode) embed.parentNode.removeChild(embed);
    }
    var root = block || embed;
    if (!root) return;
    if (root.getAttribute("data-findly-ready") === "1") return;
    window.__FINDLY_FILTER_BOOTED = true;
    root.setAttribute("data-findly-ready", "1");
    new Widget(root).init();
  }

  function scheduleBoot() {
    var api = window.__FINDLY_DOM;
    if (api && api.runWhenIdle) {
      api.runWhenIdle(boot);
      return;
    }
    if (typeof window.requestIdleCallback === "function") {
      window.requestIdleCallback(boot, { timeout: 1500 });
      return;
    }
    window.setTimeout(boot, 0);
  }

  document.addEventListener("shopify:section:load", function (event) {
    var scope = event && event.target;
    if (!scope || !scope.querySelector) return;
    if (
      scope.querySelector(
        "#smart-filter-root, #smart-filter-embed, .smart-filter",
      )
    ) {
      window.__FINDLY_FILTER_BOOTED = false;
      var next =
        document.getElementById("smart-filter-root") ||
        document.getElementById("smart-filter-embed");
      if (next) next.removeAttribute("data-findly-ready");
      scheduleBoot();
      return;
    }
    var widget = window.__FINDLY_FILTER_WIDGET;
    if (widget && scope.querySelector(GRID_HINT_SELECTOR)) {
      widget._gridParent = null;
      if (Array.isArray(widget._visibleHandles)) {
        widget.syncProductGrid(widget._visibleHandles);
      }
      widget.hideThemeDuplicateChrome();
      widget.watchThemeGrid();
    }
  });

  document.addEventListener("shopify:section:unload", function (event) {
    var scope = event && event.target;
    if (
      !scope ||
      !scope.querySelector ||
      !scope.querySelector(
        "#smart-filter-root, #smart-filter-embed, .smart-filter",
      )
    ) {
      return;
    }
    window.__FINDLY_FILTER_BOOTED = false;
    var current = window.__FINDLY_FILTER_WIDGET;
    if (current && current.root && scope.contains(current.root)) {
      try {
        if (current._gridObserver) current._gridObserver.disconnect();
        if (current._lateGridObserver) current._lateGridObserver.disconnect();
        if (current._infiniteObserver) current._infiniteObserver.disconnect();
        if (current._findlyGridObserver) current._findlyGridObserver.disconnect();
      } catch (err) {
        /* ignore */
      }
    }
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", scheduleBoot);
  } else {
    scheduleBoot();
  }
})();
