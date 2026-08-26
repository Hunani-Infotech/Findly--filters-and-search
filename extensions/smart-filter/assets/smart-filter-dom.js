/**
 * Shared DOM / money helpers for theme extension widgets.
 * Load via Liquid asset_url before schema JS. Callers may keep local
 * fallbacks; lookup is at call time so load order does not matter.
 */
(function (global) {
  "use strict";

  var DEBOUNCE_MS = 300;
  var IDLE_TIMEOUT_MS = 2000;

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

  global.__FINDLY_DOM = {
    DEBOUNCE_MS: DEBOUNCE_MS,
    qs: qs,
    shopDomain: shopDomain,
    setHidden: setHidden,
    formatPrice: formatPrice,
    runWhenIdle: runWhenIdle,
  };
})(typeof window !== "undefined" ? window : this);
