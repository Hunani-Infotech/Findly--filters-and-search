/**
 * Console verification script (NO network — cannot hang on fetch)
 * Paste in DevTools on the filtered collection page.
 * Then run: copy(window.__FINDLY_LAST_VERIFY)
 */
(() => {
  const w = window.__FINDLY_FILTER_WIDGET;
  const root = document.querySelector("#smart-filter-root, #smart-filter-embed");
  const data = w && w._lastFilterData;
  const statusEl = document.querySelector(
    ".sf-total-count, .product-count, #ProductCount, [data-product-count]",
  );

  const handles = [
    ...document.querySelectorAll(
      '#product-grid [data-product-handle], #ProductGrid [data-product-handle], .sf-app-card[data-product-handle], #product-grid a[href*="/products/"]',
    ),
  ]
    .filter((el) => {
      const cs = getComputedStyle(el);
      return (
        cs.display !== "none" &&
        cs.visibility !== "hidden" &&
        el.getAttribute("data-smart-filter-hidden") !== "true" &&
        el.getAttribute("data-findly-theme-hidden") !== "1"
      );
    })
    .map((el) => {
      const h = el.getAttribute("data-product-handle");
      if (h) return h;
      const href = el.getAttribute("href") || "";
      const m = href.match(/\/products\/([^/?#]+)/);
      return m && m[1];
    })
    .filter(Boolean);

  const uniqueHandles = [...new Set(handles)];

  const pagers = [
    ...document.querySelectorAll(
      'nav.pagination, .pagination-wrapper, .pagination, [data-pagination], load-more-button, .load-more-button, .pagination__load-more, [data-load-more], #AjaxinatePagination, #infinite-loader, [data-next-url], .sf-pager',
    ),
  ].map((el) => {
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return {
      id: el.id || null,
      className: String(el.className || "").slice(0, 80),
      nextUrl: el.getAttribute("data-next-url"),
      display: cs.display,
      visibility: cs.visibility,
      suppressed: el.getAttribute("data-sf-pager-suppressed"),
      w: Math.round(r.width),
      h: Math.round(r.height),
      visible:
        cs.display !== "none" &&
        cs.visibility !== "hidden" &&
        r.width > 0 &&
        r.height > 0,
    };
  });

  let proxyUrl = null;
  try {
    proxyUrl = w && w.buildProxyUrl ? w.buildProxyUrl() : null;
  } catch (e) {
    proxyUrl = "buildProxyUrl_error:" + String(e && e.message || e);
  }

  const total = data ? Number(data.total) : null;
  const pageSize = Number((data && data.pageSize) || (w && w.pageSize) || 0);
  const hasNext = data ? Boolean(data.hasNext) : null;

  let verdict = "CHECK_MANUALLY";
  if (!w) verdict = "NO_WIDGET";
  else if (total != null && pageSize > 0 && total > pageSize && hasNext && !pagers.some((p) => p.visible)) {
    verdict = "FILTER_OK__NO_VISIBLE_PAGER";
  } else if (total != null && pageSize > 0 && total > pageSize && hasNext) {
    verdict = "FILTER_OK__PAGING_NEEDED";
  } else if (total != null && pageSize > 0 && total <= pageSize) {
    verdict = "FILTER_OK__SINGLE_PAGE";
  } else if (total != null && uniqueHandles.length < total && !hasNext) {
    verdict = "POSSIBLE_TOTAL_OR_GRID_MISMATCH";
  }

  const out = {
    href: location.href,
    hash: location.hash,
    hasRoot: Boolean(root),
    selected: w && w.selected,
    sortKey: w && w.sortKey,
    page: w && w.page,
    pageSize: w && w.pageSize,
    themePageSize: w && w._themePageSize,
    statusText: statusEl
      ? (statusEl.textContent || "").replace(/\s+/g, " ").trim()
      : null,
    visibleCards: uniqueHandles.length,
    visibleHandles: uniqueHandles,
    lastFilterData: data
      ? {
          total: data.total,
          hasNext: data.hasNext,
          page: data.page,
          pageSize: data.pageSize,
          products: (data.products || []).length,
          handles: (data.handles || []).length,
          titles: (data.products || []).slice(0, 12).map((p) => p.title || p.handle),
        }
      : null,
    widget: w
      ? {
          pageTotal: w._pageTotal,
          statusProductCount: w._statusProductCount,
          shownHandles: (w._shownHandles || []).length,
          allFilterHandles: (w._allFilterHandles || []).length,
        }
      : null,
    proxyUrl,
    htmlFlags: {
      sfFewResults: document.documentElement.classList.contains("sf-few-results"),
      sfPagerUnneeded: document.documentElement.classList.contains("sf-pager-unneeded"),
      sfFilterLoading: document.documentElement.classList.contains("sf-filter-loading"),
    },
    pagers,
    visiblePagers: pagers.filter((p) => p.visible),
    verdict,
  };

  window.__FINDLY_LAST_VERIFY = out;
  window.__FINDLY_LAST_VERIFY_JSON = JSON.stringify(out, null, 2);
  console.log("Findly verify DONE");
  console.log(out);
  console.log("Next: click page once, then run → copy(window.__FINDLY_LAST_VERIFY)");
  return out;
})();
