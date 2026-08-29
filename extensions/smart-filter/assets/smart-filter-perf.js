/**
 * Storefront client timing for filter → grid paint.
 * Load via Liquid asset_url (not schema JS). Does not change behavior.
 *
 * Logs only the final UI load-time summary (cycle#N UI …ms).
 * Force-log even when fast: ?findly_perf=1 or localStorage.findly_perf=1
 * Summary always logs when post-API / busy work exceeds 250ms.
 */
(function () {
  "use strict";

  var TAG = "[FindlyPerf]";
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

  function emit(level, msg, detail) {
    if (typeof console === "undefined") return;
    var fn =
      level === "warn" && console.warn
        ? console.warn
        : console.info || console.log;
    if (!fn) return;
    if (detail != null) fn.call(console, TAG, msg, detail);
    else fn.call(console, TAG, msg);
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

  function finishCycle(widget, reason) {
    var cycle = activeCycle(widget);
    if (!cycle) return;
    var t1 = now();
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
    var summary = {
      cycle: cycle.id,
      reason: reason || "settle",
      totalMs: round(total),
      themePageFetches: cycle.themePages.length,
      themePagesMs: round(themeMs),
      ensureCardsMs: ensureMs != null ? round(ensureMs) : null,
      gridBusyMs: busyMs != null ? round(busyMs) : null,
      themePages: enabled() ? cycle.themePages : undefined,
    };
    markPerf("findly-filter-cycle-" + cycle.id + "-end");
    if (enabled() || total >= SLOW_MS || themeMs >= SLOW_MS) {
      emit(
        total >= 1000 || themeMs >= 800 ? "warn" : "info",
        "cycle#" +
          cycle.id +
          " UI " +
          summary.totalMs +
          "ms (theme HTML " +
          summary.themePagesMs +
          "ms × " +
          summary.themePageFetches +
          " pages) — Network 'filters' is only the API; skeletons stay until theme cards import finishes",
        summary,
      );
    }
    session(widget).active = null;
  }

  function patchWidget(widget) {
    if (!widget || widget.__findlyPerfPatched) return;
    widget.__findlyPerfPatched = true;
    patchProto(Object.getPrototypeOf(widget));
  }

  function patchProto(proto) {
    if (!proto) return;

    if (!proto.fetchFilters || !proto.fetchFilters.__findlyPerf) {
      var origFetch = proto.fetchFilters;
      proto.fetchFilters = function (opts) {
        var self = this;
        startCycle(self, opts || {});
        var result = origFetch ? origFetch.apply(this, arguments) : undefined;
        if (result && typeof result.then === "function") {
          return result.then(
            function (value) {
              finishCycle(self, "fetchFilters-ok");
              return value;
            },
            function (err) {
              finishCycle(self, "fetchFilters-err");
              throw err;
            },
          );
        }
        finishCycle(self, "fetchFilters-sync");
        return result;
      };
      proto.fetchFilters.__findlyPerf = true;
    }

    if (
      proto.ensureCardsForHandles &&
      !proto.ensureCardsForHandles.__findlyPerf
    ) {
      var origEnsure = proto.ensureCardsForHandles;
      proto.ensureCardsForHandles = function (handles) {
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
      function setWrapped(widget) {
        prevSet.call(this, widget);
        if (widget) patchWidget(widget);
      }
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
      function setDirect(widget) {
        held = widget;
        if (widget) patchWidget(widget);
      }
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
