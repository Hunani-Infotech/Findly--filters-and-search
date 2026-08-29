/**
 * First-paint layout stub only (LCP-safe). Does NOT hide Liquid product
 * cards or inject grid skeletons — that competed with LCP. Filter panel
 * skeleton lives in Liquid; interactive Widget boots via requestIdleCallback.
 * setGridBusy() in smart-filter-grid.js still mounts skeletons when the
 * shopper applies filters after hydrate.
 */
(function () {
  "use strict";
  if (window.__findlyGridBoot) return;
  window.__findlyGridBoot = true;
  var root = document.documentElement;
  if (root && root.classList) {
    root.classList.remove("sf-filter-loading");
    root.classList.add("sf-filter-ready");
  }
})();
