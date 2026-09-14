/**
 * Shopify Customer Privacy gate for storefront analytics.
 * Loaded from Liquid via asset_url (not counted against the 100 KB schema cap).
 *
 * Analytics beacons and findly:vid persist only when
 * Shopify.customerPrivacy.analyticsProcessingAllowed() is true.
 */
(function (global) {
  "use strict";

  var VID_KEY = "findly:vid";
  var LOAD_RETRY_MS = 100;
  var LOAD_RETRY_MAX = 40;
  var apiReady = false;
  var allowed = false;
  var pending = [];
  var loadStarted = false;

  function uuidish() {
    if (global.crypto && typeof global.crypto.randomUUID === "function") {
      return global.crypto.randomUUID();
    }
    return (
      String(Date.now()) +
      "-" +
      Math.random().toString(16).slice(2) +
      "-" +
      Math.random().toString(16).slice(2)
    );
  }

  function analyticsAllowed() {
    try {
      var api = global.Shopify && global.Shopify.customerPrivacy;
      if (!api || typeof api.analyticsProcessingAllowed !== "function") {
        return false;
      }
      return api.analyticsProcessingAllowed() === true;
    } catch (err) {
      return false;
    }
  }

  function clearVisitorId() {
    try {
      global.localStorage.removeItem(VID_KEY);
    } catch (err) {
      /* private mode */
    }
  }

  function visitorId() {
    if (!allowed) return "";
    try {
      var existing = global.localStorage.getItem(VID_KEY);
      if (existing) return existing;
      var created = uuidish();
      global.localStorage.setItem(VID_KEY, created);
      return created;
    } catch (err) {
      return uuidish();
    }
  }

  function flushPending() {
    if (!allowed) {
      pending = [];
      return;
    }
    var queued = pending;
    pending = [];
    for (var i = 0; i < queued.length; i++) {
      try {
        queued[i]();
      } catch (err) {
        /* keep later callbacks */
      }
    }
  }

  function applyConsent(flushQueued) {
    var next = analyticsAllowed();
    allowed = next;
    if (!next) clearVisitorId();
    if (flushQueued) flushPending();
  }

  function markReady(ok) {
    if (apiReady) {
      applyConsent(false);
      return;
    }
    apiReady = true;
    if (!ok) {
      allowed = false;
      pending = [];
      return;
    }
    applyConsent(true);
  }

  function onConsentCollected() {
    var wasAllowed = allowed;
    applyConsent(false);
    if (!wasAllowed && allowed) {
      pending = [];
    }
  }

  function subscribeConsent() {
    try {
      document.addEventListener("visitorConsentCollected", onConsentCollected);
    } catch (err) {
      /* ignore */
    }
  }

  function loadConsentApi(attempt) {
    if (apiReady) return;
    var shopify = global.Shopify;
    if (
      shopify &&
      shopify.customerPrivacy &&
      typeof shopify.customerPrivacy.analyticsProcessingAllowed === "function"
    ) {
      subscribeConsent();
      markReady(true);
      return;
    }
    if (!shopify || typeof shopify.loadFeatures !== "function") {
      if (attempt >= LOAD_RETRY_MAX) {
        markReady(false);
        return;
      }
      global.setTimeout(function () {
        loadConsentApi(attempt + 1);
      }, LOAD_RETRY_MS);
      return;
    }
    shopify.loadFeatures(
      [{ name: "consent-tracking-api", version: "0.1" }],
      function (error) {
        if (error) {
          markReady(false);
          return;
        }
        subscribeConsent();
        markReady(true);
      },
    );
  }

  function start() {
    if (loadStarted) return;
    loadStarted = true;
    loadConsentApi(0);
  }

  function run(fn) {
    if (typeof fn !== "function") return;
    start();
    if (!apiReady) {
      pending.push(fn);
      return;
    }
    if (allowed) fn();
  }

  var prior = global.__FINDLY_PRIVACY;
  global.__FINDLY_PRIVACY = {
    run: run,
    visitorId: visitorId,
    canTrack: function () {
      return allowed;
    },
  };

  start();
  if (prior && prior._q && prior._q.length) {
    var queued = prior._q.slice();
    for (var i = 0; i < queued.length; i++) run(queued[i]);
  }
})(window);
