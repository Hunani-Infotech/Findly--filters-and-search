/**
 * Remap Metaobject GID facet labels using Liquid-injected
 * window.__FINDLY_METAOBJECT_LABELS (display names from the theme).
 * Companion — not under the schema 100 KB cap.
 */
(function () {
  "use strict";

  function isMetaobjectGid(value) {
    return (
      typeof value === "string" &&
      /^gid:\/\/shopify\/Metaobject\//i.test(value.trim())
    );
  }

  function labelMap() {
    var map = window.__FINDLY_METAOBJECT_LABELS;
    return map && typeof map === "object" ? map : null;
  }

  function resolveLabel(raw) {
    var s = String(raw == null ? "" : raw).trim();
    if (!s) return s;
    var map = labelMap();
    if (!map) return s;
    if (map[s]) return String(map[s]);
    return s;
  }

  function walkValues(items) {
    if (!Array.isArray(items)) return items;
    return items.map(function (item) {
      if (!item || typeof item !== "object") return item;
      var next = Object.assign({}, item);
      var value = next.value != null ? String(next.value) : "";
      var label = next.label != null ? String(next.label) : "";
      if (value && labelMap() && labelMap()[value]) {
        next.label = String(labelMap()[value]);
      } else if (isMetaobjectGid(label)) {
        var mapped = resolveLabel(label);
        if (mapped && mapped !== label) next.label = mapped;
      } else if (isMetaobjectGid(value)) {
        var fromValue = resolveLabel(value);
        if (fromValue && fromValue !== value) next.label = fromValue;
      }
      if (next.children) next.children = walkValues(next.children);
      return next;
    });
  }

  function applyLabels(facets) {
    if (!labelMap() || !Array.isArray(facets)) return facets;
    return facets.map(function (facet) {
      if (!facet || typeof facet !== "object") return facet;
      return Object.assign({}, facet, {
        values: walkValues(facet.values),
      });
    });
  }

  function patchWidget(Widget) {
    if (!Widget || !Widget.prototype || Widget.prototype.__findlyMetaLabelsPatched) {
      return;
    }
    Widget.prototype.__findlyMetaLabelsPatched = true;
    var proto = Widget.prototype;

    function wrap(name) {
      var original = proto[name];
      if (typeof original !== "function") return;
      proto[name] = function () {
        if (Array.isArray(this.facets)) {
          this.facets = applyLabels(this.facets);
        }
        return original.apply(this, arguments);
      };
    }

    wrap("renderFacets");
    wrap("renderChips");

    var renderListFacet = proto.renderListFacet;
    if (typeof renderListFacet === "function") {
      proto.renderListFacet = function (facet) {
        if (facet && Array.isArray(facet.values)) {
          facet = Object.assign({}, facet, {
            values: walkValues(facet.values),
          });
        }
        return renderListFacet.call(this, facet);
      };
    }

    var renderDropdownFacet = proto.renderDropdownFacet;
    if (typeof renderDropdownFacet === "function") {
      proto.renderDropdownFacet = function (facet) {
        if (facet && Array.isArray(facet.values)) {
          facet = Object.assign({}, facet, {
            values: walkValues(facet.values),
          });
        }
        return renderDropdownFacet.call(this, facet);
      };
    }

    Widget.applyMetaobjectLabels = applyLabels;
  }

  function boot() {
    var W = window.__FINDLY_FILTER_WIDGET;
    if (W) patchWidget(W);
  }

  var current = window.__FINDLY_FILTER_WIDGET;
  Object.defineProperty(window, "__FINDLY_FILTER_WIDGET", {
    configurable: true,
    enumerable: true,
    get: function () {
      return current;
    },
    set: function (Widget) {
      current = Widget;
      patchWidget(Widget);
    },
  });
  boot();
})();
