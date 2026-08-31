/**
 * Filter fetch retry + stale-request helpers (companion — not schema JS cap).
 * Loaded before smart-filter.min.js via Liquid asset_url.
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
    if (err && err.name === "AbortError") return false;
    if (err instanceof TypeError) return true;
    return /failed to fetch|networkerror|load failed/i.test(
      String(err && err.message || ""),
    );
  }

  function failFilterUi(widget, err) {
    if (widget && widget.failFilterLoad) widget.failFilterLoad(err);
    if (widget.autoApplyFilters === false && widget.renderApplyBar) {
      widget.renderApplyBar();
    }
    if (Array.isArray(widget._visibleHandles)) {
      if (widget.syncProductGrid) widget.syncProductGrid(widget._visibleHandles);
      if (widget.hideThemeDuplicateChrome) widget.hideThemeDuplicateChrome();
    } else if (widget.enterPagingFallback) {
      widget.enterPagingFallback(null);
    }
  }

  function patchProto(proto) {
    if (!proto || proto.__findlyFetchRetry) return;
    proto.__findlyFetchRetry = true;
    var orig = proto.fetchFilters;
    if (!orig) return;
    proto.fetchFilters = function (opts) {
      opts = opts || {};
      var attempt = Number(opts._attempt) || 0;
      var self = this;
      return Promise.resolve(orig.apply(this, arguments)).catch(function (err) {
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
        if (!opts.append) failFilterUi(self, err);
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
  if (held) patchWidget(held);
})();
