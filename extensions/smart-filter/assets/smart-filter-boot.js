/**
 * Keep the first-paint loading gate until the Widget settles filters.
 * Liquid sets html.sf-filter-loading (hides theme cards via check.css).
 * bootEarlyGridBusy() in smart-filter-grid.js mounts skeletons; the Widget
 * clears loading once on first setGridBusy(false). Failsafe: 2.5s in grid.js.
 */
(function () {
  "use strict";
  if (window.__findlyGridBoot) return;
  window.__findlyGridBoot = true;
  var root = document.documentElement;
  if (!root || !root.classList) return;
  if (
    document.getElementById("smart-filter-root") ||
    document.getElementById("smart-filter-embed")
  ) {
    root.classList.add("sf-filter-loading");
    root.classList.remove("sf-filter-ready");
  }
})();
