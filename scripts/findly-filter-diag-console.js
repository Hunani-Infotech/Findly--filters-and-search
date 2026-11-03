/**
 * Findly storefront filter / paging diagnostic
 * Paste this WHOLE file into DevTools console on the filtered page.
 *
 * Re-run:  await window.__FINDLY_DIAG_RUN()
 * Page 2:  await window.__FINDLY_DIAG_RUN({ goToPage2: true })
 */
window.__FINDLY_DIAG_RUN = async function findlyFilterDiagRun(opts) {
  opts = opts || {};
  const goToPage2 = opts.goToPage2 === true;
  const timeoutMs = Number(opts.timeoutMs) > 0 ? Number(opts.timeoutMs) : 12000;

  function log(step, extra) {
    if (extra !== undefined) console.log("[findly-diag]", step, extra);
    else console.log("[findly-diag]", step);
  }

  function safe(fn, fallback) {
    try {
      return fn();
    } catch (err) {
      return fallback;
    }
  }

  function rectOf(el) {
    try {
      const r = el.getBoundingClientRect();
      return {
        x: Math.round(r.x),
        y: Math.round(r.y),
        w: Math.round(r.width),
        h: Math.round(r.height),
      };
    } catch (err) {
      return null;
    }
  }

  function textOf(el, max) {
    return String((el && el.textContent) || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, max || 80);
  }

  async function fetchJson(url, label) {
    log("fetch:start", label + " → " + url);
    const ctrl =
      typeof AbortController === "function" ? new AbortController() : null;
    const timer = setTimeout(function () {
      try {
        if (ctrl) ctrl.abort();
      } catch (err) {
        /* ignore */
      }
    }, timeoutMs);
    try {
      const res = await fetch(url, {
        credentials: "same-origin",
        cache: "no-store",
        headers: { Accept: "application/json" },
        signal: ctrl ? ctrl.signal : undefined,
      });
      const json = await res.json();
      log("fetch:ok", label + " status=" + res.status);
      return { ok: res.ok, status: res.status, url: url, json: json };
    } catch (err) {
      const msg = String((err && err.message) || err);
      const timedOut = /abort/i.test(msg);
      log("fetch:fail", label + " " + (timedOut ? "TIMEOUT" : msg));
      return {
        ok: false,
        status: 0,
        url: url,
        error: timedOut ? "TIMEOUT_AFTER_" + timeoutMs + "ms" : msg,
        json: null,
      };
    } finally {
      clearTimeout(timer);
    }
  }

  log("start", { href: location.href, timeoutMs: timeoutMs });

  const w = window.__FINDLY_FILTER_WIDGET;
  if (!w) {
    const missing = {
      ok: false,
      error: "NO_FINDLY_WIDGET",
      href: location.href,
      generatedAt: new Date().toISOString(),
    };
    console.error(missing);
    window.__FINDLY_LAST_DIAG = missing;
    window.__FINDLY_LAST_DIAG_JSON = JSON.stringify(missing, null, 2);
    return missing;
  }

  let proxyUrl = null;
  try {
    proxyUrl = w.buildProxyUrl();
  } catch (err) {
    proxyUrl = null;
  }
  if (!proxyUrl) {
    const bad = {
      ok: false,
      error: "NO_PROXY_URL",
      href: location.href,
      generatedAt: new Date().toISOString(),
    };
    window.__FINDLY_LAST_DIAG = bad;
    window.__FINDLY_LAST_DIAG_JSON = JSON.stringify(bad, null, 2);
    console.error(bad);
    return bad;
  }

  const filtered = await fetchJson(proxyUrl, "filtered");

  let unfilteredUrl = null;
  try {
    const bare = new URL(proxyUrl, location.origin);
    [...bare.searchParams.keys()]
      .filter((k) => k.startsWith("f."))
      .forEach((k) => bare.searchParams.delete(k));
    bare.searchParams.set("page", "1");
    if (w.pageSize) bare.searchParams.set("pageSize", String(w.pageSize));
    unfilteredUrl = bare.toString();
  } catch (err) {
    unfilteredUrl = null;
  }

  const unfiltered = unfilteredUrl
    ? await fetchJson(unfilteredUrl, "unfiltered")
    : {
        ok: false,
        status: 0,
        url: null,
        error: "NO_UNFILTERED_URL",
        json: null,
      };

  log("dom:scan");
  const filteredJson = filtered.json;
  const unfilteredJson = unfiltered.json;
  const selected = safe(() => JSON.parse(JSON.stringify(w.selected || {})), {});
  const activeFacetKeys = Object.keys(selected).filter(
    (k) => selected[k] && selected[k].length,
  );

  function facetSnapshot(payload) {
    return ((payload && payload.facets) || []).map((f) => ({
      key: f.key,
      label: f.label,
      source: f.source,
      values: (f.values || []).slice(0, 30).map((v) => ({
        value: v.value,
        label: v.label,
        count: v.count,
      })),
    }));
  }

  function selectedOptionCounts(payload) {
    const facets = (payload && payload.facets) || [];
    const out = {};
    activeFacetKeys.forEach((key) => {
      const facet = facets.find((f) => f.key === key);
      out[key] = (selected[key] || []).map((val) => {
        const hit =
          (facet &&
            (facet.values || []).find(
              (v) => String(v.value) === String(val),
            )) ||
          null;
        return {
          value: val,
          count: hit ? hit.count : null,
          label: hit ? hit.label : null,
        };
      });
    });
    return out;
  }

  const pagerSel = [
    "nav.pagination",
    ".pagination-wrapper",
    ".pagination",
    "[data-pagination]",
    ".paginate",
    "#pagination",
    ".Pagination",
    "load-more-button",
    ".load-more-button",
    ".pagination__load-more",
    "[data-load-more]",
    "button[name='load-more']",
    ".js-load-more",
    ".btn--load-more",
    "#AjaxinatePagination",
    ".ajaxinate-pagination",
    "#infinite-loader",
    "[data-next-url]",
    ".sf-pager",
  ].join(",");

  const pagers = [...document.querySelectorAll(pagerSel)].map((el) => {
    const cs = getComputedStyle(el);
    const rect = rectOf(el);
    return {
      tag: el.tagName,
      id: el.id || null,
      className: String(el.className || "").slice(0, 140),
      text: textOf(el, 60),
      nextUrl:
        el.getAttribute("data-next-url") ||
        el.getAttribute("data-next") ||
        null,
      hiddenAttr: el.getAttribute("hidden"),
      suppressed: el.getAttribute("data-sf-pager-suppressed"),
      pagerHidden: el.getAttribute("data-sf-pager-hidden"),
      themeHidden: el.getAttribute("data-findly-theme-hidden"),
      display: cs.display,
      visibility: cs.visibility,
      opacity: cs.opacity,
      rect: rect,
      visible:
        cs.display !== "none" &&
        cs.visibility !== "hidden" &&
        Number(cs.opacity) !== 0 &&
        !!rect &&
        rect.h > 0 &&
        rect.w > 0,
    };
  });

  const cardNodes = [
    ...document.querySelectorAll(
      "#product-grid [data-product-handle], #ProductGrid [data-product-handle], .sf-app-card, #product-grid .grid__item, .product-grid .grid__item",
    ),
  ];
  const visibleCards = cardNodes.filter((el) => {
    const cs = getComputedStyle(el);
    return (
      cs.display !== "none" &&
      cs.visibility !== "hidden" &&
      el.getAttribute("data-smart-filter-hidden") !== "true" &&
      el.getAttribute("data-findly-theme-hidden") !== "1"
    );
  });

  const html = document.documentElement;
  const layout = document.querySelector(".sf-collection-layout");
  const statusEl = document.querySelector(
    ".sf-total-count, .product-count, #ProductCount, #ProductCountDesktop, [data-product-count]",
  );

  const facetCountSelected = selectedOptionCounts(unfilteredJson);
  const filteredFacetSelected = selectedOptionCounts(filteredJson);
  const primaryFacetCount = (() => {
    const rows = Object.values(facetCountSelected).flat();
    return rows.length ? rows[0].count : null;
  })();

  const total = filteredJson ? Number(filteredJson.total) : null;
  const pageSize = filteredJson
    ? Number(filteredJson.pageSize || w.pageSize || 0)
    : Number(w.pageSize || 0);
  const hasNext = filteredJson ? Boolean(filteredJson.hasNext) : null;

  let verdict = "CHECK_MANUALLY";
  if (filtered.error) verdict = "FILTER_FETCH_FAILED";
  else if (
    primaryFacetCount != null &&
    total != null &&
    Number(primaryFacetCount) !== Number(total)
  ) {
    verdict = "FACET_VS_FILTER_MISMATCH";
  } else if (
    total != null &&
    pageSize > 0 &&
    total > pageSize &&
    hasNext === true &&
    !pagers.some((p) => p.visible)
  ) {
    verdict = "FILTER_OK__NO_VISIBLE_PAGER";
  } else if (
    total != null &&
    pageSize > 0 &&
    total > pageSize &&
    hasNext === true &&
    pagers.some(
      (p) =>
        p.visible &&
        (p.id === "infinite-loader" ||
          !!p.nextUrl ||
          /load-more|infinite/i.test(String(p.className) + String(p.id || ""))),
    )
  ) {
    verdict = "FILTER_OK__THEME_INFINITE_OR_LOADMORE_PRESENT";
  } else if (
    total != null &&
    pageSize > 0 &&
    total > pageSize &&
    hasNext === true
  ) {
    verdict = "FILTER_OK__PAGING_NEEDED";
  } else if (total != null && pageSize > 0 && total <= pageSize) {
    verdict = "FILTER_OK__SINGLE_PAGE";
  }

  const report = {
    ok: !filtered.error,
    generatedAt: new Date().toISOString(),
    href: location.href,
    hash: location.hash,
    userAgent: navigator.userAgent,
    viewport: { w: window.innerWidth, h: window.innerHeight },
    selected: selected,
    price: safe(function () {
      return { min: w.price.min, max: w.price.max };
    }, null),
    sortKey: w.sortKey || null,
    collectionId: w.collectionId || null,
    collectionHandle: w.collectionHandle || null,
    page: w.page || null,
    pageSize: w.pageSize || null,
    themePageSize: w._themePageSize || null,
    widget: {
      pageTotal: w._pageTotal,
      statusProductCount: w._statusProductCount,
      shownHandles: (w._shownHandles || []).length,
      allFilterHandles: (w._allFilterHandles || []).length,
      lastProducts: (w._lastProducts || []).length,
      hasActiveFilters: safe(function () {
        return w.hasActiveFilters();
      }, null),
      syncThemePager: typeof w.syncThemePager === "function",
      goToPage: typeof w.goToPage === "function",
      lastFilterData: w._lastFilterData
        ? {
            total: w._lastFilterData.total,
            hasNext: w._lastFilterData.hasNext,
            page: w._lastFilterData.page,
            pageSize: w._lastFilterData.pageSize,
            handles: (w._lastFilterData.handles || []).length,
            products: (w._lastFilterData.products || []).length,
          }
        : null,
    },
    statusText: statusEl ? textOf(statusEl, 120) : null,
    htmlFlags: {
      sfFewResults: html.classList.contains("sf-few-results"),
      sfPagerUnneeded: html.classList.contains("sf-pager-unneeded"),
      sfFilterLoading: html.classList.contains("sf-filter-loading"),
      singlePageAttr: layout
        ? layout.getAttribute("data-sf-single-page")
        : null,
    },
    visibleCards: visibleCards.length,
    cardNodes: cardNodes.length,
    proxyUrl: proxyUrl,
    filteredFetch: filteredJson
      ? {
          ok: filtered.ok,
          status: filtered.status,
          total: filteredJson.total,
          hasNext: filteredJson.hasNext,
          page: filteredJson.page,
          pageSize: filteredJson.pageSize,
          handles: (filteredJson.handles || []).length,
          products: (filteredJson.products || []).length,
          indexed_count: filteredJson.indexed_count,
          index_complete: filteredJson.index_complete,
          productTitles: (filteredJson.products || [])
            .slice(0, 20)
            .map(function (p) {
              return p.title || p.handle;
            }),
          selectedOptionCounts: filteredFacetSelected,
        }
      : { error: filtered.error || "NO_JSON" },
    unfilteredFetch: unfilteredJson
      ? {
          ok: unfiltered.ok,
          status: unfiltered.status,
          url: unfiltered.url,
          total: unfilteredJson.total,
          hasNext: unfilteredJson.hasNext,
          pageSize: unfilteredJson.pageSize,
          handles: (unfilteredJson.handles || []).length,
          products: (unfilteredJson.products || []).length,
          selectedOptionCounts: facetCountSelected,
          facets: facetSnapshot(unfilteredJson),
        }
      : { error: unfiltered.error || "NO_JSON", url: unfiltered.url },
    pagers: pagers,
    visiblePagers: pagers.filter(function (p) {
      return p.visible;
    }),
    verdict: verdict,
  };

  const json = JSON.stringify(report, null, 2);
  window.__FINDLY_LAST_DIAG = report;
  window.__FINDLY_LAST_DIAG_JSON = json;

  console.log(
    "%cFindly filter diag DONE — copy JSON below (or window.__FINDLY_LAST_DIAG_JSON)",
    "font-weight:bold;font-size:14px;color:green",
  );
  console.table({
    verdict: report.verdict,
    facetCount: primaryFacetCount,
    filteredTotal: total,
    pageSize: pageSize,
    productsOnPage: filteredJson ? (filteredJson.products || []).length : null,
    visibleCards: report.visibleCards,
    hasNext: hasNext,
    visiblePagers: report.visiblePagers.length,
  });
  console.log(json);
  console.log(
    "%cTo copy: click the page once, then run →  copy(window.__FINDLY_LAST_DIAG_JSON)",
    "color:orange;font-weight:bold",
  );

  if (goToPage2 && typeof w.goToPage === "function" && hasNext) {
    log("goToPage(2)");
    w.goToPage(2);
  }

  log("done", report.verdict);
  return report;
};

// Auto-run without leaving a stuck-looking bare Promise in the console.
window.__FINDLY_DIAG_RUN().then(
  function (report) {
    console.log("[findly-diag] resolved", report && report.verdict);
  },
  function (err) {
    console.error("[findly-diag] rejected", err);
  },
);
