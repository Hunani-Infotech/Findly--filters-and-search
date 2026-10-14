/**
 * Storefront client UI timing (filter → grid paint).
 * Load via Liquid asset_url (not schema JS). Does not change behavior.
 *
 * Single browser log to share: console → [FindlyUI] { … }
 * Also: window.__FINDLY_UI_LAST
 * Console only when enabled: ?findly_perf=1, localStorage.findly_perf=1, or window.__FINDLY_PERF
 */
(function () {
  "use strict";

  var TAG = "[FindlyUI]";
  var STALE_FILTER_ERR = "FindlyStaleRequest";

  function now() {
    return typeof performance !== "undefined" && performance.now
      ? performance.now()
      : Date.now();
  }

  function enabled() {
    try {
      if (window.__FINDLY_PERF) return true;
      if (/[?&]findly_perf=1(?:&|$)/.test(window.location.search || "")) {
        return true;
      }
      if (window.localStorage && localStorage.getItem("findly_perf") === "1") {
        return true;
      }
    } catch (err) {
      /* ignore */
    }
    return false;
  }

  function round(ms) {
    return Math.round(ms * 10) / 10;
  }

  function emitUi(summary) {
    if (typeof console === "undefined") return;
    try {
      window.__FINDLY_UI_LAST = summary;
    } catch (err) {
      /* ignore */
    }
    var fn = console.info || console.log;
    if (!fn) return;
    fn.call(console, TAG, summary);
  }

  function markPerf(name) {
    try {
      if (performance && performance.mark) performance.mark(name);
    } catch (err) {
      /* ignore */
    }
  }

  function session(widget) {
    if (!widget.__findlyPerfSession) {
      widget.__findlyPerfSession = {
        id: 0,
        active: null,
      };
    }
    return widget.__findlyPerfSession;
  }

  function startCycle(widget, opts) {
    var s = session(widget);
    s.id += 1;
    var cycle = {
      id: s.id,
      t0: now(),
      append: Boolean(opts && opts.append),
      themePages: [],
      marks: {},
    };
    s.active = cycle;
    markPerf("findly-filter-cycle-" + cycle.id + "-start");
    return cycle;
  }

  function activeCycle(widget) {
    var s = session(widget);
    return s.active;
  }

  function stamp(cycle, key) {
    if (!cycle || cycle.marks[key] != null) return;
    cycle.marks[key] = now();
  }

  function filtersNetworkStats(cycle) {
    var empty = { ms: null, totalMs: null, count: 0 };
    if (!cycle || typeof performance === "undefined") return empty;
    try {
      var entries = performance.getEntriesByType("resource");
      var i;
      var count = 0;
      var total = 0;
      var lastMs = null;
      var lastStart = -1;
      for (i = 0; i < entries.length; i++) {
        var e = entries[i];
        if (!e || !e.name) continue;
        if (e.name.indexOf("/filters") === -1 && e.name.indexOf("filters?") === -1) {
          continue;
        }
        if (e.startTime + 1 < cycle.t0) continue;
        if (cycle.t1 != null && e.startTime > cycle.t1 + 1) continue;
        var ms = e.responseEnd - e.startTime;
        if (!Number.isFinite(ms) || ms < 0) continue;
        count += 1;
        total += ms;
        if (e.startTime >= lastStart) {
          lastStart = e.startTime;
          lastMs = ms;
        }
      }
      if (!count) return empty;
      return {
        ms: lastMs != null ? round(lastMs) : null,
        totalMs: round(total),
        count: count,
      };
    } catch (err) {
      return empty;
    }
  }

  function finishCycle(widget, reason, cycle) {
    cycle = cycle || activeCycle(widget);
    if (!cycle) return;
    var t1 = now();
    cycle.t1 = t1;
    var total = t1 - cycle.t0;
    var themeMs = 0;
    var i;
    for (i = 0; i < cycle.themePages.length; i++) {
      themeMs += cycle.themePages[i].ms || 0;
    }
    var busyMs =
      cycle.busyOn != null && cycle.busyOff != null
        ? cycle.busyOff - cycle.busyOn
        : null;
    var ensureMs =
      cycle.marks.ensureStart != null && cycle.marks.ensureEnd != null
        ? cycle.marks.ensureEnd - cycle.marks.ensureStart
        : null;
    var net = filtersNetworkStats(cycle);
    var applyMs =
      net.totalMs != null ? round(Math.max(0, total - net.totalMs)) : null;
    var jsonMs =
      widget && widget._findlyJsonMs != null
        ? round(widget._findlyJsonMs)
        : cycle.marks.jsonMs != null
          ? round(cycle.marks.jsonMs)
          : null;
    var facetsMs =
      cycle.marks.facetsMs != null ? round(cycle.marks.facetsMs) : null;
    var gridMs = cycle.marks.gridMs != null ? round(cycle.marks.gridMs) : null;
    var settingsMs =
      cycle.marks.settingsMs != null ? round(cycle.marks.settingsMs) : null;
    var chromeMs =
      cycle.marks.chromeMs != null ? round(cycle.marks.chromeMs) : null;
    var ensureMsRounded = ensureMs != null ? round(ensureMs) : null;
    var accounted = 0;
    if (jsonMs != null) accounted += jsonMs;
    if (facetsMs != null) accounted += facetsMs;
    if (gridMs != null) accounted += gridMs;
    if (ensureMsRounded != null) accounted += ensureMsRounded;
    if (settingsMs != null) accounted += settingsMs;
    if (chromeMs != null) accounted += chromeMs;
    var otherMs =
      applyMs != null ? round(Math.max(0, applyMs - accounted)) : null;
    var summary = {
      cycle: cycle.id,
      reason: reason || "settle",
      totalMs: round(total),
      filtersNetworkMs: net.totalMs,
      filtersNetworkCount: net.count,
      applyMs: applyMs,
      jsonMs: jsonMs,
      settingsMs: settingsMs,
      chromeMs: chromeMs,
      facetsMs: facetsMs,
      gridMs: gridMs,
      otherMs: otherMs,
      themePageFetches: cycle.themePages.length,
      themePagesMs: round(themeMs),
      ensureCardsMs: ensureMsRounded,
      gridBusyMs: busyMs != null ? round(busyMs) : null,
    };
    try {
      if (widget) widget._findlyJsonMs = null;
    } catch (err) {
      /* ignore */
    }
    markPerf("findly-filter-cycle-" + cycle.id + "-end");
    if (enabled()) {
      emitUi(summary);
    }
    var s = session(widget);
    if (s.active === cycle) s.active = null;
  }

  function patchWidget(widget) {
    if (!widget) return;
    /* Always re-run patchProto: grid.js may replace methods after the first boot. */
    patchProto(Object.getPrototypeOf(widget));
    widget.__findlyPerfPatched = true;
  }

  function patchProto(proto) {
    if (!proto) return;

    if (!proto.fetchFilters || !proto.fetchFilters.__findlyPerf) {
      var origFetch = proto.fetchFilters;
      proto.fetchFilters = function (opts) {
        var self = this;
        var reuse =
          Boolean(self._inflight) && !(opts && opts.append) && activeCycle(self);
        var cycle = reuse ? activeCycle(self) : startCycle(self, opts || {});
        var result = origFetch ? origFetch.apply(this, arguments) : undefined;
        if (result && typeof result.then === "function") {
          return result.then(
            function (value) {
              finishCycle(self, "fetchFilters-ok", cycle);
              return value;
            },
            function (err) {
              if (err && err.name === STALE_FILTER_ERR) return;
              finishCycle(self, "fetchFilters-err", cycle);
              throw err;
            },
          );
        }
        finishCycle(self, "fetchFilters-sync", cycle);
        return result;
      };
      proto.fetchFilters.__findlyPerf = true;
    }

    if (
      proto.ensureCardsForHandles &&
      !proto.ensureCardsForHandles.__findlyPerf
    ) {
      var origEnsure = proto.ensureCardsForHandles;
      proto.ensureCardsForHandles = function () {
        var cycle = activeCycle(this);
        stamp(cycle, "ensureStart");
        return Promise.resolve(origEnsure.apply(this, arguments)).then(
          function (ok) {
            stamp(cycle, "ensureEnd");
            return ok;
          },
        );
      };
      proto.ensureCardsForHandles.__findlyPerf = true;
    }

    if (proto.fetchThemePage && !proto.fetchThemePage.__findlyPerf) {
      var origTheme = proto.fetchThemePage;
      proto.fetchThemePage = function (page) {
        var cycle = activeCycle(this);
        var t0 = now();
        return Promise.resolve(origTheme.apply(this, arguments)).then(
          function (ok) {
            var ms = round(now() - t0);
            if (cycle) {
              cycle.themePages.push({ page: page, ms: ms, ok: ok });
            }
            return ok;
          },
        );
      };
      proto.fetchThemePage.__findlyPerf = true;
    }

    if (proto.setGridBusy && !proto.setGridBusy.__findlyPerf) {
      var origBusy = proto.setGridBusy;
      proto.setGridBusy = function (busy) {
        var cycle = activeCycle(this);
        if (cycle) {
          if (busy && cycle.busyOn == null) cycle.busyOn = now();
          if (!busy) cycle.busyOff = now();
        }
        if (origBusy) return origBusy.apply(this, arguments);
      };
      proto.setGridBusy.__findlyPerf = true;
    }

    if (proto.renderFacets && !proto.renderFacets.__findlyPerf) {
      var origFacets = proto.renderFacets;
      proto.renderFacets = function () {
        var cycle = activeCycle(this);
        var t0 = now();
        var result = origFacets.apply(this, arguments);
        if (cycle) {
          cycle.marks.facetsMs =
            (cycle.marks.facetsMs || 0) + (now() - t0);
        }
        return result;
      };
      proto.renderFacets.__findlyPerf = true;
    }

    if (proto.applyInterceptGrid && !proto.applyInterceptGrid.__findlyPerf) {
      var origIntercept = proto.applyInterceptGrid;
      proto.applyInterceptGrid = function () {
        var cycle = activeCycle(this);
        var t0 = now();
        var result = origIntercept.apply(this, arguments);
        if (cycle) {
          cycle.marks.gridMs = (cycle.marks.gridMs || 0) + (now() - t0);
        }
        return result;
      };
      proto.applyInterceptGrid.__findlyPerf = true;
    }

    if (proto.syncProductGrid && !proto.syncProductGrid.__findlyPerf) {
      var origSync = proto.syncProductGrid;
      proto.syncProductGrid = function () {
        var cycle = activeCycle(this);
        var t0 = now();
        var result = origSync.apply(this, arguments);
        if (cycle) {
          cycle.marks.gridMs = (cycle.marks.gridMs || 0) + (now() - t0);
        }
        return result;
      };
      proto.syncProductGrid.__findlyPerf = true;
    }

    if (proto.applySettings && !proto.applySettings.__findlyPerf) {
      var origSettings = proto.applySettings;
      proto.applySettings = function () {
        var cycle = activeCycle(this);
        var t0 = now();
        var result = origSettings.apply(this, arguments);
        if (cycle) {
          cycle.marks.settingsMs =
            (cycle.marks.settingsMs || 0) + (now() - t0);
        }
        return result;
      };
      proto.applySettings.__findlyPerf = true;
    }

    if (
      proto.hideThemeDuplicateChrome &&
      !proto.hideThemeDuplicateChrome.__findlyPerf
    ) {
      var origChrome = proto.hideThemeDuplicateChrome;
      proto.hideThemeDuplicateChrome = function () {
        var cycle = activeCycle(this);
        var t0 = now();
        var result = origChrome.apply(this, arguments);
        if (cycle) {
          cycle.marks.chromeMs =
            (cycle.marks.chromeMs || 0) + (now() - t0);
        }
        return result;
      };
      proto.hideThemeDuplicateChrome.__findlyPerf = true;
    }
  }

  function installSetter() {
    var held = window.__FINDLY_FILTER_WIDGET;
    var desc = Object.getOwnPropertyDescriptor(
      window,
      "__FINDLY_FILTER_WIDGET",
    );
    if (desc && desc.set && desc.set.__findlyPerfWrapped) {
      if (held) patchWidget(held);
      return;
    }
    if (desc && desc.get && desc.set) {
      var prevSet = desc.set;
      var prevGet = desc.get;
      var setWrapped = function (widget) {
        prevSet.call(this, widget);
        if (widget) patchWidget(widget);
      };
      setWrapped.__findlyPerfWrapped = true;
      Object.defineProperty(window, "__FINDLY_FILTER_WIDGET", {
        configurable: true,
        enumerable: true,
        get: function () {
          return prevGet.call(this);
        },
        set: setWrapped,
      });
    } else {
      var setDirect = function (widget) {
        held = widget;
        if (widget) patchWidget(widget);
      };
      setDirect.__findlyPerfWrapped = true;
      Object.defineProperty(window, "__FINDLY_FILTER_WIDGET", {
        configurable: true,
        enumerable: true,
        get: function () {
          return held;
        },
        set: setDirect,
      });
    }
    if (held) patchWidget(held);
  }

  /* Re-patch after grid.js — run on idle and briefly poll once. */
  function boot() {
    installSetter();
    var w = window.__FINDLY_FILTER_WIDGET;
    if (w) patchWidget(w);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
  setTimeout(boot, 0);
  setTimeout(boot, 500);
})();

/**
 * Grid blink / reload paint probe.
 * Survives reload because it ships with the theme extension (not a console paste).
 *
 * Enable:  ?findly_blink=1  OR  localStorage.findly_blink=1
 * Share:   __FINDLY_BLINK_SHARE()   → copies JSON summary to clipboard
 * Disable: __FINDLY_BLINK_OFF()
 */
(function () {
  "use strict";

  var TAG = "[Findly blink]";
  var FLAG = "findly_blink";
  var REPORT_KEY = "findly_blink_report";

  function blinkOn() {
    try {
      if (window.__FINDLY_BLINK) return true;
      if (new RegExp("[?&]" + FLAG + "=1(?:&|$)").test(window.location.search || "")) {
        return true;
      }
      if (window.localStorage && localStorage.getItem(FLAG) === "1") return true;
    } catch (err) {
      /* ignore */
    }
    return false;
  }

  if (!blinkOn()) {
    window.__FINDLY_BLINK_ON = function () {
      try {
        localStorage.setItem(FLAG, "1");
      } catch (err) {
        /* ignore */
      }
      console.log(TAG, "Armed. Hard-reload this page now.");
    };
    window.__FINDLY_BLINK_SHARE = function () {
      var raw = null;
      try {
        raw = localStorage.getItem(REPORT_KEY);
      } catch (err) {
        /* ignore */
      }
      if (!raw) {
        console.log(TAG, "No report yet. Run __FINDLY_BLINK_ON() then hard-reload.");
        return null;
      }
      console.log(TAG, raw);
      try {
        if (typeof copy === "function") copy(raw);
        console.log(TAG, "Copied last report to clipboard — paste in chat.");
      } catch (err2) {
        /* ignore */
      }
      try {
        return JSON.parse(raw);
      } catch (err3) {
        return raw;
      }
    };
    window.__FINDLY_BLINK_OFF = function () {
      try {
        localStorage.removeItem(FLAG);
        localStorage.removeItem(REPORT_KEY);
      } catch (err) {
        /* ignore */
      }
      console.log(TAG, "Disarmed.");
    };
    return;
  }

  try {
    localStorage.setItem(FLAG, "1");
  } catch (err) {
    /* ignore */
  }

  if (window.__FINDLY_BLINK_PROBE) return;
  window.__FINDLY_BLINK_PROBE = true;

  var log = [];
  var t0 =
    typeof performance !== "undefined" && performance.now
      ? performance.now()
      : Date.now();
  var settleTimer = 0;
  var shared = false;

  function nowMs() {
    return typeof performance !== "undefined" && performance.now
      ? performance.now()
      : Date.now();
  }

  function persist() {
    var syncN = 0;
    var busyN = 0;
    var clsN = 0;
    var i;
    for (i = 0; i < log.length; i++) {
      if (log[i].event === "syncProductGrid") syncN += 1;
      else if (log[i].event === "setGridBusy") busyN += 1;
      else if (log[i].event === "html-class") clsN += 1;
    }
    var payload = {
      url: String(window.location.href || ""),
      when: new Date().toISOString(),
      summary: {
        syncProductGrid: syncN,
        setGridBusy: busyN,
        htmlClass: clsN,
        total: log.length,
      },
      events: log,
    };
    var text = JSON.stringify(payload, null, 2);
    try {
      localStorage.setItem(REPORT_KEY, text);
    } catch (err) {
      /* ignore */
    }
    try {
      window.__FINDLY_BLINK_LAST = payload;
    } catch (err2) {
      /* ignore */
    }
    return { payload: payload, text: text };
  }

  function recordBlink(event, extra) {
    var row = {
      ms: Math.round(nowMs() - t0),
      event: event,
      loading: Boolean(
        document.documentElement &&
          document.documentElement.classList &&
          document.documentElement.classList.contains("sf-filter-loading"),
      ),
      ready: Boolean(
        document.documentElement &&
          document.documentElement.classList &&
          document.documentElement.classList.contains("sf-filter-ready"),
      ),
      busy: Boolean(document.querySelector(".findly-grid-is-busy")),
      skel: document.querySelectorAll("[data-findly-skel='1']").length,
      extra: extra || null,
    };
    log.push(row);
    if (typeof console !== "undefined" && console.log) {
      console.log(TAG, row.ms + "ms", event, row);
    }
    persist();
    if (settleTimer) window.clearTimeout(settleTimer);
    settleTimer = window.setTimeout(function () {
      settleTimer = 0;
      autoShare();
    }, 2500);
  }

  function autoShare() {
    if (shared) return;
    shared = true;
    var out = persist();
    var s = out.payload.summary;
    var line =
      TAG +
      " SETTLED syncProductGrid:" +
      s.syncProductGrid +
      " setGridBusy:" +
      s.setGridBusy +
      " html-class:" +
      s.htmlClass +
      " total:" +
      s.total +
      ". Run __FINDLY_BLINK_SHARE() to copy JSON.";
    if (typeof console !== "undefined" && console.info) {
      console.info(line);
    } else if (typeof console !== "undefined" && console.log) {
      console.log(line);
    }
  }

  recordBlink("probe-start");

  if (document.documentElement && document.documentElement.classList) {
    try {
      new MutationObserver(function () {
        recordBlink(
          "html-class",
          String(document.documentElement.className || ""),
        );
      }).observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["class"],
      });
    } catch (err) {
      /* ignore */
    }
  }

  function wrapWidget(widget) {
    if (!widget || widget.__findlyBlinkWrapped) return;
    widget.__findlyBlinkWrapped = true;
    if (typeof widget.syncProductGrid === "function") {
      var origSync = widget.syncProductGrid;
      widget.syncProductGrid = function (handles) {
        recordBlink("syncProductGrid", {
          handles: Array.isArray(handles)
            ? handles.length
            : handles == null
              ? null
              : 1,
        });
        return origSync.apply(this, arguments);
      };
    }
    if (typeof widget.setGridBusy === "function") {
      var origBusy = widget.setGridBusy;
      widget.setGridBusy = function (busy) {
        recordBlink("setGridBusy", { busy: Boolean(busy) });
        return origBusy.apply(this, arguments);
      };
    }
  }

  function installWidgetHook() {
    var held = window.__FINDLY_FILTER_WIDGET;
    if (held) wrapWidget(held);
    try {
      var desc = Object.getOwnPropertyDescriptor(
        window,
        "__FINDLY_FILTER_WIDGET",
      );
      if (desc && desc.set && desc.set.__findlyBlinkHook) {
        if (held) wrapWidget(held);
        return;
      }
      if (desc && desc.get && desc.set) {
        var prevSet = desc.set;
        var prevGet = desc.get;
        var setWrapped = function (widget) {
          prevSet.call(this, widget);
          wrapWidget(widget);
        };
        setWrapped.__findlyBlinkHook = true;
        Object.defineProperty(window, "__FINDLY_FILTER_WIDGET", {
          configurable: true,
          enumerable: true,
          get: function () {
            return prevGet.call(this);
          },
          set: setWrapped,
        });
      } else {
        var box = held;
        var setDirect = function (widget) {
          box = widget;
          wrapWidget(widget);
        };
        setDirect.__findlyBlinkHook = true;
        Object.defineProperty(window, "__FINDLY_FILTER_WIDGET", {
          configurable: true,
          enumerable: true,
          get: function () {
            return box;
          },
          set: setDirect,
        });
      }
    } catch (err) {
      /* ignore */
    }
    if (held) wrapWidget(held);
  }

  installWidgetHook();
  setTimeout(installWidgetHook, 0);
  setTimeout(installWidgetHook, 500);
  setTimeout(installWidgetHook, 1500);

  window.__FINDLY_BLINK_SHARE = function () {
    var out = persist();
    if (typeof console !== "undefined" && console.log) {
      console.log(TAG, "report", out.payload.summary);
      console.log(out.text);
    }
    try {
      if (typeof copy === "function") {
        copy(out.text);
        console.log(TAG, "Copied to clipboard — paste in chat.");
      }
    } catch (err) {
      console.log(TAG, "Select the JSON above and paste it in chat.");
    }
    return out.payload;
  };

  window.__FINDLY_BLINK_OFF = function () {
    try {
      localStorage.removeItem(FLAG);
    } catch (err) {
      /* ignore */
    }
    console.log(TAG, "Disarmed. Reload once; probe will not run again.");
  };

  console.info(
    TAG,
    "Recording this page load (built-in). Wait ~3s after products settle, then run __FINDLY_BLINK_SHARE()",
  );
})();
