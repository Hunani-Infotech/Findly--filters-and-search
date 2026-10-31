/**
 * Filter fetch retry + stale/abort UI guards (companion — not schema JS cap).
 * Loaded before smart-filter.min.js via Liquid asset_url.
 *
 * Theme-agnostic: only wraps Widget.fetchFilters / failFilterLoad. No theme DOM,
 * Dawn/Horizon selectors, or product-grid logic.
 */
(function () {
  "use strict";

  var STALE = "FindlyStaleRequest";
  var API = {
    STALE: STALE,
    ms: 15000,
    step: 5000,
    max: 2,
    wait: 800,
    stale: stale,
    retry: retry,
  };

  function stale() {
    var err = new Error("stale");
    err.name = STALE;
    return Promise.reject(err);
  }

  function retry(err, timedOut) {
    if (timedOut) return true;
    if (err && err.name === STALE) return false;
    if (err && err._findlySoftCancel) return false;
    if (err && err.name === "AbortError") return false;
    if (err instanceof TypeError) return true;
    return /failed to fetch|networkerror|load failed/i.test(
      String(err && err.message || ""),
    );
  }

  /** Races from rapid price/filter edits must not wipe facets or flash errors. */
  function shouldSkipFailUi(err) {
    if (!err) return true;
    if (err.name === STALE) return true;
    if (err._findlySoftCancel) return true;
    if (err.name === "AbortError" && !err._findlyTimedOut) return true;
    return false;
  }

  function failFilterUi(widget, err, reqId) {
    if (!widget) return;
    if (window.__FINDLY_IS_STALE && window.__FINDLY_IS_STALE(widget, reqId)) return;
    if (widget.failFilterLoad) widget.failFilterLoad(err, reqId);
    if (window.__FINDLY_IS_STALE && window.__FINDLY_IS_STALE(widget, reqId)) return;
    if (widget._sfLeaveNative) return;
    if (widget.autoApplyFilters === false && widget.renderApplyBar) {
      widget.renderApplyBar();
    }
    if (Array.isArray(widget._visibleHandles)) {
      if (widget.syncProductGrid) widget.syncProductGrid(widget._visibleHandles);
      if (widget.hideThemeDuplicateChrome) widget.hideThemeDuplicateChrome();
    } else if (widget.enterPagingFallback) {
      widget.enterPagingFallback(null, null, reqId);
    }
  }

  function patchProto(proto) {
    if (!proto || proto.__findlyFetchRetry) return;
    proto.__findlyFetchRetry = true;

    var origFail = proto.failFilterLoad;
    if (origFail && !origFail.__findlyFetchGuard) {
      proto.failFilterLoad = function (err) {
        /* Newer request already running — leave its UI alone. */
        if (this._inflight) return;
        if (shouldSkipFailUi(err)) return;
        return origFail.apply(this, arguments);
      };
      proto.failFilterLoad.__findlyFetchGuard = true;
    }

    var orig = proto.fetchFilters;
    if (!orig) return;
    proto.fetchFilters = function (opts) {
      opts = opts || {};
      var attempt = Number(opts._attempt) || 0;
      var self = this;
      var pending = orig.apply(this, arguments);
      var reqId = self._reqId;
      return Promise.resolve(pending).catch(function (err) {
        if (
          !opts.append &&
          attempt < API.max &&
          API.retry(err, err && err._findlyTimedOut)
        ) {
          var next = Object.assign({}, opts, { _attempt: attempt + 1 });
          return new Promise(function (resolve, reject) {
            window.setTimeout(function () {
              self.fetchFilters(next).then(resolve, reject);
            }, API.wait * (attempt + 1));
          });
        }
        /*
          Only the latest non-append request may show the error UI.
          Superseded races (typing price, rapid facet clicks) are ignored.
        */
        if (
          !opts.append &&
          reqId === self._reqId &&
          !shouldSkipFailUi(err) &&
          !self._inflight
        ) {
          failFilterUi(self, err, reqId);
        }
        throw err;
      });
    };
  }

  function patchWidget(widget) {
    if (!widget) return;
    patchProto(Object.getPrototypeOf(widget));
  }

  function installSetter() {
    var held = window.__FINDLY_FILTER_WIDGET;
    var desc = Object.getOwnPropertyDescriptor(window, "__FINDLY_FILTER_WIDGET");
    var prevSet = desc && desc.set;
    var prevGet = desc && desc.get;
    try {
      Object.defineProperty(window, "__FINDLY_FILTER_WIDGET", {
        configurable: true,
        enumerable: true,
        get: function () {
          return prevGet ? prevGet() : held;
        },
        set: function (next) {
          if (prevSet) prevSet.call(window, next);
          else held = next;
          patchWidget(next);
        },
      });
    } catch (err) {
      /* ignore */
    }
  }

  window.__FINDLY_FILTER_FETCH = API;
  installSetter();
  var existing = window.__FINDLY_FILTER_WIDGET;
  if (existing) patchWidget(existing);
})();
