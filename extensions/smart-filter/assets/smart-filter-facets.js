/**
 * Facet display helpers (companion — not schema JS cap).
 * Loaded before smart-filter.min.js via Liquid asset_url.
 * Keep __version / FINDLY_EXT_V in sync with smart-filter.js + smart-filter-fetch.js.
 */
(function () {
  "use strict";

  var FINDLY_EXT_V = "8";
  var SIZE_FACET_MATCH_RATIO = 0.6;
  var SIZE_NUMERIC_RANK_BASE = 1000;
  var COLOR_FACET_MATCH_RATIO = 0.5;

  function hashHue(value) {
    var hash = 2166136261;
    var text = String(value || "").toLowerCase();
    for (var i = 0; i < text.length; i++) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return Math.abs(hash) % 360;
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

  var prev = window.__FINDLY_FACET_UTILS;
  /* Never replace a newer real companion with an older stale copy mid-session. */
  if (prev && prev.__version && prev.__version !== FINDLY_EXT_V && !prev.__findlyFallback) {
    try {
      if (/(?:^|[?&])findly_debug=1(?:&|$)/.test(String(window.location.search || ""))) {
        console.info("[findly-ext]", "version-mismatch", {
          facets: FINDLY_EXT_V,
          existing: prev.__version,
        });
      }
    } catch (err) {
      /* ignore */
    }
  }

  window.__FINDLY_EXT_V = window.__FINDLY_EXT_V || FINDLY_EXT_V;
  window.__FINDLY_FACETS_V = FINDLY_EXT_V;
  window.__FINDLY_FACET_UTILS = {
    __version: FINDLY_EXT_V,
    hashHue: hashHue,
    swatchColor: swatchColor,
    escapeCssUrl: escapeCssUrl,
    nestPathLabels: nestPathLabels,
    valuesHaveChildren: valuesHaveChildren,
    applyFacetSwatch: applyFacetSwatch,
    isColorFacet: isColorFacet,
    sizeRank: sizeRank,
    chipDisplayLabel: chipDisplayLabel,
    isSizeFacet: isSizeFacet,
    sortSizeValues: sortSizeValues,
    looksLikeCssColor: looksLikeCssColor,
    looksLikeFontFamily: looksLikeFontFamily,
  };
})();
