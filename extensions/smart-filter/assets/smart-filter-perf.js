/**
 * Storefront client UI timing (filter → grid paint).
 * Load via Liquid asset_url (not schema JS). Does not change behavior.
 *
 * Single browser log to share: console → [FindlyUI] { … }
 * Also: window.__FINDLY_UI_LAST
 * Always on when cycle ≥250ms; force with ?findly_perf=1 or localStorage.findly_perf=1
 */
(function () {
  "use strict";

  var TAG = "[FindlyUI]";
  var SLOW_MS = 250;

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
    var ensureMsRounded = ensureMs != null ? round(ensureMs) : null;
    var accounted = 0;
    if (jsonMs != null) accounted += jsonMs;
    if (facetsMs != null) accounted += facetsMs;
    if (gridMs != null) accounted += gridMs;
    if (ensureMsRounded != null) accounted += ensureMsRounded;
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
    if (enabled() || total >= SLOW_MS || themeMs >= SLOW_MS) {
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
