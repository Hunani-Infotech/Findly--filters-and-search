/**
 * Runs before smart-filter-theme.js. Owns the loading class and, if the
 * theme file is late or missing, the selectors and analytics hooks that
 * used to live in smart-filter.js.
 */
(function () {
  "use strict";
  if (!window.__FINDLY_FACET_HIDE_SELECTOR) {
  window.__FINDLY_FACET_HIDE_SELECTOR = [
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
  window.__FINDLY_SORT_HIDE_SELECTOR = [
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
  window.__FINDLY_PAGER_SELECTOR = [
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
  window.__FINDLY_COUNT_SELECTOR = [
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
  window.__FINDLY_GRID_HINT = [
    "ul#product-grid",
    "ol#product-grid",
    "ul.product-grid",
    "ol.product-grid",
    "ul[id*='product-grid']",
    "ul[class*='product-grid']",
    "[data-id='product-grid']",
    "[data-product-grid]",
    "[product-grid-view]",
    ".grid.product-grid",
    "#product-grid",
    ".product-grid",
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
  }
  if (!window.__FINDLY_FIRE_ANALYTICS) {
  function installMovedHooks() {
    var lastAnalyticsStamp = "";
    var lastAnalyticsAt = 0;
    var partnerUpdateTimer = null;
    var partnerUpdateHandles = [];

    function shopDomain() {
      var api = window.__FINDLY_DOM;
      if (api && api.shopDomain) return api.shopDomain();
      return (window.Shopify && window.Shopify.shop) || "";
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
      } catch (err2) {
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
      } catch (err3) {
        /* optional partner widget */
      }
      try {
        if (window._swat && typeof window._swat.initializeActionButtons === "function") {
          window._swat.initializeActionButtons();
        }
      } catch (err4) {
        /* optional partner widget */
      }
      try {
        if (window.Weglot && typeof window.Weglot.refresh === "function") {
          window.Weglot.refresh();
        }
      } catch (err5) {
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
      } catch (err6) {
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
    window.__FINDLY_FIRE_ANALYTICS = function (proxyBase, fields) {
      var privacy = window.__FINDLY_PRIVACY;
      if (!privacy || typeof privacy.run !== "function") return;
      privacy.run(function () {
        sendAnalytics(proxyBase, fields);
      });
    };
    window.__FINDLY_ACTIVE_FILTER_COMBO = function (selected, price) {
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
    };
    window.__FINDLY_DISPATCH_UPDATE = function (handles) {
      document.dispatchEvent(
        new CustomEvent("smart-filter:update", {
          bubbles: true,
          detail: { handles: handles || [] },
        }),
      );
      partnerUpdateHandles = handles || [];
      if (partnerUpdateTimer) clearTimeout(partnerUpdateTimer);
      partnerUpdateTimer = setTimeout(function () {
        partnerUpdateTimer = null;
        dispatchPartnerRenderEvents(partnerUpdateHandles);
      }, 0);
    };
  }
    installMovedHooks();
  }
  if (window.__findlyGridBoot) return;
  window.__findlyGridBoot = true;
  if (window.__FINDLY_LOADING_SETTLED) return;
  var root = document.documentElement;
  if (!root || !root.classList) return;
  if (
    document.getElementById("smart-filter-root") ||
    document.getElementById("smart-filter-embed")
  ) {
    var bootRoot =
      document.getElementById("smart-filter-root") ||
      document.getElementById("smart-filter-embed");
    var bootHideOff =
      bootRoot &&
      bootRoot.getAttribute("data-findly-disable-native-hide") === "true";
    var bootRefine = false;
    try {
      var bootPath = String(window.location.pathname || "");
      var bootSearch = /\/search(\/|$)/i.test(bootPath);
      var bootParts = (
        String(window.location.search || "").replace(/^\?/, "") +
        "&" +
        String(window.location.hash || "").replace(/^#/, "")
      ).split("&");
      var bootI;
      for (bootI = 0; bootI < bootParts.length; bootI++) {
        var bootRawKey = String(bootParts[bootI].split("=")[0] || "").replace(/\+/g, " ");
        var bootKey = bootRawKey;
        try {
          bootKey = decodeURIComponent(bootRawKey);
        } catch (bootKeyErr) {
          bootKey = bootRawKey;
        }
        if (!bootKey) continue;
        if (
          bootKey.indexOf("f.") === 0 ||
          bootKey.indexOf("filter.") === 0 ||
          bootKey === "sort_by"
        ) {
          bootRefine = true;
        }
        var bootRawVal = String(bootParts[bootI].split("=").slice(1).join("=") || "");
        var bootVal = bootRawVal;
        try {
          bootVal = decodeURIComponent(bootRawVal.replace(/\+/g, " "));
        } catch (bootValErr) {
          bootVal = bootRawVal;
        }
        if (bootKey === "sf" && String(bootVal || "").trim()) {
          bootRefine = true;
        }
        if (bootSearch && bootKey === "q" && String(bootVal || "").trim()) {
          bootRefine = true;
        }
      }
    } catch (bootErr) {
      bootRefine = false;
    }
    if (!bootHideOff && bootRefine) {
      root.classList.add("sf-filter-loading");
      root.classList.remove("sf-filter-ready");
    }
  }
})();
