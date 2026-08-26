/**
 * First-paint collection-grid loading. Loaded without defer so skeletons
 * appear in the same parse as the filter block. Markup matches
 * mountGridSkeletons in smart-filter-grid.js — do not restyle.
 */
(function () {
  "use strict";
  if (window.__findlyGridBoot) return;
  window.__findlyGridBoot = true;
  var SKEL = "data-findly-skel";
  var HOSTS = [
    ".main-collection-grid",
    "#product-grid",
    "#ProductGrid",
    "ul.product-grid",
    "ol.product-grid",
    ".product-grid",
    ".sf-app-grid",
  ];
  var root = document.documentElement;
  if (root && root.classList) {
    root.classList.add("sf-filter-loading");
    root.classList.remove("sf-filter-ready");
  }
  function tooWide(el) {
    if (!el || el.nodeType !== 1) return true;
    var tag = String(el.tagName || "").toLowerCase();
    if (tag === "html" || tag === "body" || tag === "main") return true;
    if (el.id === "smart-filter-root" || el.id === "smart-filter-embed") {
      return true;
    }
    if (el.classList && el.classList.contains("sf-collection-layout")) {
      return true;
    }
    return Boolean(
      el.querySelector &&
        el.querySelector(
          "#smart-filter-root, #smart-filter-embed, .sf-collection-layout",
        ),
    );
  }
  function matchesHost(el) {
    if (!el || !el.matches) return false;
    var i;
    for (i = 0; i < HOSTS.length; i++) {
      try {
        if (el.matches(HOSTS[i])) return true;
      } catch (err) {
        /* ignore */
      }
    }
    return false;
  }
  function pickHost() {
    var i;
    var n;
    var nodes;
    var el;
    var node;
    var hops;
    var found;
    for (i = 0; i < HOSTS.length; i++) {
      try {
        nodes = document.querySelectorAll(HOSTS[i]);
      } catch (err) {
        continue;
      }
      for (n = 0; n < nodes.length; n++) {
        el = nodes[n];
        if (tooWide(el)) continue;
        found = el;
        node = el;
        hops = 0;
        while (node && hops < 12) {
          node = node.parentElement;
          hops += 1;
          if (!node || tooWide(node)) break;
          if (matchesHost(node)) found = node;
        }
        if (found) return found;
      }
    }
    return null;
  }
  function hostHasSkel(host) {
    if (!host || !host.children) return false;
    var i;
    for (i = 0; i < host.children.length; i++) {
      if (
        host.children[i].getAttribute &&
        host.children[i].getAttribute(SKEL) === "1"
      ) {
        return true;
      }
    }
    return false;
  }
  function mount() {
    if (document.querySelector("[" + SKEL + "='1']")) return true;
    var host = pickHost();
    if (!host || !host.appendChild) return false;
    if (hostHasSkel(host)) return true;
    if (host.classList) host.classList.add("findly-grid-is-busy");
    host.setAttribute("aria-busy", "true");
    var tag = host.tagName === "UL" || host.tagName === "OL" ? "LI" : "DIV";
    var i;
    var el;
    for (i = 0; i < 8; i++) {
      el = document.createElement(tag);
      el.setAttribute(SKEL, "1");
      el.setAttribute("aria-hidden", "true");
      el.innerHTML =
        '<span class="findly-grid-skel__img"></span>' +
        '<span class="findly-grid-skel__line"></span>' +
        '<span class="findly-grid-skel__line is-short"></span>';
      host.appendChild(el);
    }
    return true;
  }
  if (mount()) return;
  if (typeof MutationObserver !== "function") return;
  var obs = new MutationObserver(function () {
    if (mount()) obs.disconnect();
  });
  obs.observe(root || document, { childList: true, subtree: true });
})();
