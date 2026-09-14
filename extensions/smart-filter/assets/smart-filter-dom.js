/**
 * Shared DOM / money helpers for theme extension widgets.
 * Load via Liquid asset_url before schema JS. Callers must keep local
 * fallbacks when a helper is safety-critical (e.g. partner reinit).
 */
(function (global) {
  "use strict";

  var IDLE_TIMEOUT_MS = 1500;

  function qs(root, selector) {
    return root.querySelector(selector);
  }

  function shopDomain() {
    return (global.Shopify && global.Shopify.shop) || "";
  }

  function setHidden(el, hidden) {
    if (!el) return;
    if (hidden) el.setAttribute("hidden", "");
    else el.removeAttribute("hidden");
  }

  function formatPrice(value, currencyCode) {
    if (value == null || value === "") return "";
    var n = Number(value);
    if (!Number.isFinite(n)) return String(value);
    var currency =
      currencyCode ||
      (global.Shopify &&
        global.Shopify.currency &&
        global.Shopify.currency.active) ||
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

  function runWhenIdle(fn) {
    if (typeof global.requestIdleCallback !== "function") {
      global.setTimeout(fn, 0);
      return;
    }
    global.requestIdleCallback(
      function () {
        fn();
      },
      { timeout: IDLE_TIMEOUT_MS },
    );
  }

  /** Re-init optional theme partner widgets after Findly re-renders product cards. */
  function reinitPartnerWidgets() {
    try {
      if (global.jdgm && typeof global.jdgm.customizeBadges === "function") {
        global.jdgm.customizeBadges();
      } else if (global.jdgm && typeof global.jdgm.preLoader === "function") {
        global.jdgm.preLoader();
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
        global.frcp &&
        global.frcp.wishlist &&
        typeof global.frcp.wishlist.attachOnCollection === "function"
      ) {
        global.frcp.wishlist.attachOnCollection();
      }
    } catch (err) {
      /* optional partner widget */
    }

    try {
      if (global._swat && typeof global._swat.initializeActionButtons === "function") {
        global._swat.initializeActionButtons();
      }
    } catch (err) {
      /* optional partner widget */
    }

    try {
      if (global.Weglot && typeof global.Weglot.refresh === "function") {
        global.Weglot.refresh();
      }
    } catch (err) {
      /* optional partner widget */
    }

    try {
      if (global.Currency && typeof global.Currency.convertAll === "function") {
        global.Currency.convertAll(
          global.Currency.currentCurrency ||
            (global.Shopify &&
              global.Shopify.currency &&
              global.Shopify.currency.active) ||
            "USD",
        );
      }
    } catch (err) {
      /* optional currency converter */
    }
  }

  global.__FINDLY_DOM = {
    qs: qs,
    shopDomain: shopDomain,
    setHidden: setHidden,
    formatPrice: formatPrice,
    runWhenIdle: runWhenIdle,
    reinitPartnerWidgets: reinitPartnerWidgets,
  };
})(typeof window !== "undefined" ? window : this);
