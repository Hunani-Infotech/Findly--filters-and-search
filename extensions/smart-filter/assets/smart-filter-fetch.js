/**
 * Filter fetch retry + stale/abort UI guards (companion — not schema JS cap).
 * Loaded before smart-filter.min.js via Liquid asset_url.
 *
 * Theme-agnostic: only wraps Widget.fetchFilters / failFilterLoad. No theme DOM,
 * Dawn/Horizon selectors, or product-grid logic.
 *
 * Retry policy: max 2 retries (3 attempts), ~6s overall budget, exponential
 * backoff with jitter. Superseded _reqId never retries or paints fail UI.
 */
(function () {
  "use strict";

  var FINDLY_EXT_V = "8";
  window.__FINDLY_FETCH_V = FINDLY_EXT_V;
  window.__FINDLY_EXT_V = window.__FINDLY_EXT_V || FINDLY_EXT_V;

  function findlyDebugExt(kind, detail) {
    try {
      if (!/(?:^|[?&])findly_debug=1(?:&|$)/.test(String(window.location.search || ""))) {
        return;
      }
      console.info("[findly-ext]", kind, detail || "");
    } catch (err) {
      /* ignore */
    }
  }

  if (window.__FINDLY_EXT_V && window.__FINDLY_EXT_V !== FINDLY_EXT_V) {
    findlyDebugExt("version-mismatch", {
      fetch: FINDLY_EXT_V,
      core: window.__FINDLY_EXT_V,
    });
  }

  var FACET_FALLBACK = {
    __version: FINDLY_EXT_V,
    __findlyFallback: 1,
    nestPathLabels: function (v) {
      return v || [];
    },
    valuesHaveChildren: function (values) {
      return (values || []).some(function (item) {
        return item && item.children && item.children.length;
      });
    },
    applyFacetSwatch: function () {},
    isColorFacet: function () {
      return false;
    },
    isSizeFacet: function () {
      return false;
    },
    sortSizeValues: function (v) {
      return (v || []).slice();
    },
    chipDisplayLabel: function (_f, _k, value) {
      var raw = String(value == null ? "" : value);
      return raw.indexOf("gid://") === 0 ? "" : raw;
    },
    looksLikeCssColor: function (value) {
      if (typeof value !== "string") return false;
      var c = value.trim();
      return (
        /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(c) ||
        /^(rgb|rgba|hsl|hsla)\(/i.test(c)
      );
    },
    looksLikeFontFamily: function () {
      return false;
    },
  };

  function armFacetCompanionRetry() {
    if (window.__findlyFacetRetryArmed) return;
    window.__findlyFacetRetryArmed = true;
    function promote() {
      try {
        var api = window.__FINDLY_FACET_UTILS;
        if (!api || api.__findlyFallback || !api.nestPathLabels) return false;
        if (api.__version && api.__version !== FINDLY_EXT_V) {
          findlyDebugExt("version-mismatch", {
            core: FINDLY_EXT_V,
            facets: api.__version,
          });
        }
        var w = window.__FINDLY_FILTER_WIDGET;
        if (w && w.renderFacets && Array.isArray(w.facets) && w.facets.length) {
          w.renderFacets();
        }
        return true;
      } catch (err) {
        return false;
      }
    }
    function once() {
      if (promote()) return;
      window.setTimeout(promote, 0);
    }
    if (document.readyState === "complete") once();
    else window.addEventListener("load", once);
  }

  window.__FINDLY_ENSURE_FACET_UTILS = function () {
    try {
      var api = window.__FINDLY_FACET_UTILS;
      if (!api || typeof api !== "object") {
        window.__FINDLY_FACET_UTILS = FACET_FALLBACK;
        findlyDebugExt("facets-missing", { using: "fallback" });
        armFacetCompanionRetry();
        return FACET_FALLBACK;
      }
      if (api.__findlyFallback) {
        armFacetCompanionRetry();
        return api;
      }
      if (api.__version && api.__version !== FINDLY_EXT_V) {
        findlyDebugExt("version-mismatch", {
          core: window.__FINDLY_EXT_V || FINDLY_EXT_V,
          facets: api.__version,
        });
      }
      return api;
    } catch (err) {
      return FACET_FALLBACK;
    }
  };
  /* Install fallback early if facets companion has not run yet. */
  window.__FINDLY_ENSURE_FACET_UTILS();

  var STALE = "FindlyStaleRequest";
  var API = {
    STALE: STALE,
    /* First attempt ≥4s; retries share the remaining 6s budget. */
    ms: 4000,
    step: 400,
    max: 2,
    budgetMs: 6000,
    waitBase: 200,
    waitCap: 1000,
    stale: stale,
    retry: retry,
    backoff: backoff,
    recordLeave: recordLeave,
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
    if (err instanceof SyntaxError) return true;
    var status = err && err._findlyHttpStatus;
    if (status === 429 || status === 502 || status === 503 || status === 504) {
      return true;
    }
    var msg = String(err && err.message || "");
    if (/\bRequest failed \((429|502|503|504)\)/.test(msg)) return true;
    return /failed to fetch|networkerror|load failed|unexpected token|is not valid json|json\.parse/i.test(
      msg,
    );
  }

  /** Exponential backoff with up to 40% jitter, capped. */
  function backoff(attempt) {
    var exp = Math.min(
      API.waitCap,
      API.waitBase * Math.pow(2, Math.max(0, attempt)),
    );
    var jitter = Math.floor(Math.random() * exp * 0.4);
    return exp + jitter;
  }

  /** Debug-only leave-native / apply-error telemetry. No network, no PII. */
  function recordLeave(reason, detail) {
    try {
      if (!/(?:^|[?&])findly_debug=1(?:&|$)/.test(String(window.location.search || ""))) {
        return;
      }
    } catch (err) {
      return;
    }
    var bag = { reason: String(reason || "leave_native") };
    if (detail && detail.status != null) bag.status = Number(detail.status) || 0;
    if (detail && detail.kind) bag.kind = String(detail.kind).slice(0, 40);
    try {
      console.info("[findly-leave]", bag);
    } catch (err2) {
      /* ignore */
    }
  }

  function leaveReasonFromErr(err) {
    if (!err) return "fetch_fail";
    if (err._findlyHttpStatus) return "http_status";
    if (err instanceof SyntaxError) return "non_json";
    var msg = String(err.message || "");
    if (/unexpected token|is not valid json|json\.parse/i.test(msg)) return "non_json";
    return "fetch_fail";
  }

  /** Races from rapid price/filter edits must not wipe facets or flash errors. */
  function shouldSkipFailUi(err) {
    if (!err) return true;
    if (err.name === STALE) return true;
    if (err._findlySoftCancel) return true;
    if (err.name === "AbortError" && !err._findlyTimedOut) return true;
    return false;
  }

  function isStaleReq(widget, reqId) {
    if (window.__FINDLY_IS_STALE && window.__FINDLY_IS_STALE(widget, reqId)) {
      return true;
    }
    return !!(widget && reqId != null && widget._reqId !== reqId);
  }

  function restoreFacetChrome(widget) {
    if (!widget || !widget.facetsEl || !widget.renderFacets) return;
    if (!Array.isArray(widget.facets) || !widget.facets.length) return;
    try {
      widget.renderFacets();
    } catch (err) {
      /* ignore */
    }
    if (window.__FINDLY_LEAVE_NATIVE_STATUS) {
      window.__FINDLY_LEAVE_NATIVE_STATUS(widget, widget._sfLeaveReason || "fetch_fail");
    } else if (widget.statusEl) {
      var fallback = "Filters couldn't be applied to this page.";
      widget.statusEl.textContent = widget.t
        ? widget.t("applyError", fallback)
        : fallback;
      widget.statusEl.setAttribute("data-error", "true");
    }
  }

  function failFilterUi(widget, err, reqId) {
    if (!widget) return;
    if (isStaleReq(widget, reqId)) return;
    widget._sfLeaveReason = leaveReasonFromErr(err);
    recordLeave(widget._sfLeaveReason, {
      status: err && err._findlyHttpStatus,
    });
    if (widget.failFilterLoad) widget.failFilterLoad(err, reqId);
    if (isStaleReq(widget, reqId)) return;
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
        if (!this._sfLeaveReason) {
          this._sfLeaveReason = leaveReasonFromErr(err);
          recordLeave(this._sfLeaveReason, {
            status: err && err._findlyHttpStatus,
          });
        }
        var keepFacets =
          (Array.isArray(this.facets) && this.facets.length > 0) ||
          this._hydratedFromCache;
        var savedFacets = keepFacets ? this.facets : null;
        var result = origFail.apply(this, arguments);
        if (keepFacets && savedFacets) {
          this.facets = savedFacets;
          restoreFacetChrome(this);
        }
        return result;
      };
      proto.failFilterLoad.__findlyFetchGuard = true;
    }

    var orig = proto.fetchFilters;
    if (!orig) return;
    proto.fetchFilters = function (opts) {
      opts = opts || {};
      var attempt = Number(opts._attempt) || 0;
      var budgetStart = opts._budgetStart || Date.now();
      var elapsed = Date.now() - budgetStart;
      var remaining = API.budgetMs - elapsed;
      var self = this;

      /* Budget exhausted or superseded before a retry attempt — do not call. */
      if (!opts.append && attempt > 0) {
        if (opts._reqId != null && self._reqId !== opts._reqId) {
          return stale();
        }
        if (remaining <= 200) {
          var budgetErr = new Error("Request failed (budget)");
          budgetErr._findlyTimedOut = 1;
          failFilterUi(self, budgetErr, self._reqId);
          return Promise.reject(budgetErr);
        }
      }

      var fetchMs = Math.max(
        400,
        Math.min(API.ms + attempt * API.step, Math.max(400, remaining)),
      );
      var nextOpts = Object.assign({}, opts, {
        _attempt: attempt,
        _budgetStart: budgetStart,
        _fetchMs: fetchMs,
        _reqId: opts._reqId != null ? opts._reqId : undefined,
      });
      var pending = orig.call(this, nextOpts);
      var reqId = self._reqId;
      if (nextOpts._reqId == null) nextOpts._reqId = reqId;

      return Promise.resolve(pending).catch(function (err) {
        if (isStaleReq(self, reqId) || (err && err.name === STALE)) {
          return stale();
        }
        if (shouldSkipFailUi(err)) {
          throw err;
        }

        var left = API.budgetMs - (Date.now() - budgetStart);
        if (
          !opts.append &&
          attempt < API.max &&
          left > 250 &&
          API.retry(err, err && err._findlyTimedOut) &&
          self._reqId === reqId &&
          !self._inflight
        ) {
          var delay = Math.min(backoff(attempt), Math.max(0, left - 200));
          var retryOpts = Object.assign({}, nextOpts, {
            _attempt: attempt + 1,
            _budgetStart: budgetStart,
            _reqId: reqId,
          });
          return new Promise(function (resolve, reject) {
            window.setTimeout(function () {
              if (self._reqId !== reqId) {
                stale().then(resolve, reject);
                return;
              }
              self.fetchFilters(retryOpts).then(resolve, reject);
            }, delay);
          });
        }

        /*
          Only the latest non-append request may show the error UI.
          Superseded races (typing price, rapid facet clicks) are ignored.
        */
        if (
          !opts.append &&
          self._reqId === reqId &&
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
  window.__FINDLY_RECORD_LEAVE = recordLeave;
  installSetter();
  var existing = window.__FINDLY_FILTER_WIDGET;
  if (existing) patchWidget(existing);
})();
