import fs from "node:fs";

/**
 * Flag-off snapshot. Paste snapshot() into the browser console on a collection
 * page and on a search page, once on the live theme and once on this build
 * with the flag off. Save each JSON result. Then:
 *   node scripts/flag-off-golden.mjs live.json next.json
 * This file does not load a store. A run against a live theme is unverified
 * until you do that.
 */
export function snapshot() {
  var html = document.documentElement;
  var hidden = document.querySelectorAll(
    "[data-findly-theme-hidden='1'], [data-findly-native-chrome='1']",
  );
  var cards = document.querySelectorAll(
    "#product-grid > li, ul.product-grid > li, ol.product-grid > li, #ResultsList li, #ResultsList .product-card",
  );
  var visible = 0;
  var i;
  for (i = 0; i < cards.length; i++) {
    var rect = cards[i].getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) visible += 1;
  }
  return {
    path: location.pathname + location.search,
    htmlClass: html.className,
    loading: html.classList.contains("sf-filter-loading"),
    v2: html.classList.contains("sf-storefront-v2"),
    hidden: hidden.length,
    cards: cards.length,
    visibleCards: visible,
  };
}

const livePath = process.argv[2];
const nextPath = process.argv[3];
if (!livePath || !nextPath) {
  console.log("Paste snapshot() from this file into the console on each build.");
  console.log("node scripts/flag-off-golden.mjs live.json next.json");
  process.exit(0);
}

const live = JSON.parse(fs.readFileSync(livePath, "utf8"));
const next = JSON.parse(fs.readFileSync(nextPath, "utf8"));
const keys = ["loading", "v2", "hidden", "cards", "visibleCards"];
let failed = 0;
for (const key of keys) {
  if (live[key] !== next[key]) {
    failed += 1;
    console.log(key + " live=" + String(live[key]) + " next=" + String(next[key]));
  }
}
if (String(next.htmlClass).indexOf("sf-storefront-v2") !== -1) {
  failed += 1;
  console.log("flag-off page has sf-storefront-v2");
}
if (failed) {
  console.log("DIFF " + failed);
  process.exit(1);
}
console.log("match");
