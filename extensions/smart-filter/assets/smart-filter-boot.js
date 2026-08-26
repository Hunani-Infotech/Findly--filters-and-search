/**
 * First-paint collection-grid loading. Loaded with defer (Theme Check
 * ParserBlockingScript). Liquid sets html.sf-filter-loading inline so
 * products stay hidden until this script mounts skeletons + overlay.
 * Markup matches mountGridSkeletons in smart-filter-grid.js — do not restyle.
 */
(function () {
  "use strict";
  if (window.__findlyGridBoot) return;
  window.__findlyGridBoot = true;
  var SKEL = "data-findly-skel";
  var SKEL_HOST = "data-findly-skel-host";
  var OVERLAY_ID = "findly-grid-busy-overlay";
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
  function positionOverlay(host, overlay) {
    if (!overlay) return;
    var vh = window.innerHeight || 800;
    var vw = window.innerWidth || 1200;
    var top = 0;
    var left = 0;
    var width = vw;
    var height = Math.max(352, vh);
    var rect;
    var el = host;
    if (el && el.getBoundingClientRect) {
      rect = el.getBoundingClientRect();
      if (rect.width > 40 && rect.height > 20) {
        top = Math.max(0, rect.top);
        left = Math.max(0, rect.left);
        width = Math.max(160, rect.width);
        height = Math.max(
          352,
          Math.min(Math.max(rect.bottom - top, 0), Math.max(120, vh - top)),
        );
        overlay.style.top = top + "px";
        overlay.style.left = left + "px";
        overlay.style.width = width + "px";
        overlay.style.height = height + "px";
        return;
      }
    }
    el =
      document.getElementById("smart-filter-root") ||
      document.getElementById("smart-filter-embed");
    if (el && el.getBoundingClientRect) {
      rect = el.getBoundingClientRect();
      if (rect.width < vw * 0.48 && rect.left < vw * 0.42) {
        left = Math.max(0, rect.right);
        top = Math.max(0, rect.top);
        width = Math.max(160, vw - left);
        height = Math.max(352, vh - top);
      } else {
        top = Math.max(0, rect.bottom);
        left = 0;
        width = vw;
        height = Math.max(352, vh - top);
      }
    }
    overlay.style.top = top + "px";
    overlay.style.left = left + "px";
    overlay.style.width = width + "px";
    overlay.style.height = height + "px";
  }
  function ensureOverlay(host) {
    var overlay = document.getElementById(OVERLAY_ID);
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = OVERLAY_ID;
      overlay.setAttribute("aria-hidden", "true");
      (document.body || root).appendChild(overlay);
    }
    positionOverlay(host, overlay);
  }
  function mountSkeletons(host) {
    if (!host || !host.appendChild) return false;
    if (document.querySelector("[" + SKEL + "='1']")) return true;
    if (hostHasSkel(host)) return true;
    if (host.classList) host.classList.add("findly-grid-is-busy");
    host.setAttribute("aria-busy", "true");
    host.setAttribute(SKEL_HOST, "1");
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
  function paint() {
    var host = pickHost();
    if (host) mountSkeletons(host);
    ensureOverlay(host);
    return Boolean(host);
  }
  paint();
  if (!window.__findlyBootOverlayBound) {
    window.__findlyBootOverlayBound = true;
    var relayout = function () {
      var overlay = document.getElementById(OVERLAY_ID);
      if (!overlay) return;
      positionOverlay(pickHost(), overlay);
    };
    window.addEventListener("scroll", relayout, true);
    window.addEventListener("resize", relayout);
  }
  if (pickHost()) return;
  if (typeof MutationObserver !== "function") return;
  var obs = new MutationObserver(function () {
    if (paint()) obs.disconnect();
  });
  obs.observe(root || document, { childList: true, subtree: true });
})();
