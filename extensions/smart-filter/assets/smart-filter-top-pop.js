/**
 * Horizontal (top) facet popovers.
 * Floating menus under headings instead of inline expand.
 * Loaded via Liquid asset_url — not counted against the 100 KB schema JS cap.
 *
 * Open panels are ported to document.body with position:fixed (same approach as
 * .sf-sort-menu) so they paint above the product grid despite
 * .smart-filter { isolation: isolate }.
 *
 * Left / right / offcanvas behavior is unchanged.
 */
(function () {
  "use strict";

  var STYLE_ID = "findly-top-pop-v13";
  var PATCHED = "__findlyTopPopPatched";
  var POP_Z = "100060";
  var ignoreDocClick = false;

  function injectCss() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement("style");
    style.id = STYLE_ID;
    /* Spaced wrapping row + popovers — beats base column + ui.css id selectors. */
    style.textContent =
      ".smart-filter--top,.smart-filter--top .sf-panel{overflow:visible!important}" +
      ".smart-filter--top{position:relative;z-index:6;width:100%;max-width:100%}" +
      "#smart-filter-root.smart-filter--top .sf-facets," +
      "#smart-filter-embed.smart-filter--top .sf-facets," +
      ".smart-filter--top .sf-facets{" +
      "display:flex!important;flex-direction:row!important;flex-wrap:wrap!important;" +
      "align-items:center!important;align-content:flex-start!important;" +
      "gap:.75rem 2rem!important;row-gap:.75rem!important;column-gap:2rem!important;" +
      "overflow:visible!important;min-height:0!important;padding:.35rem 0 .65rem!important}" +
      "#smart-filter-root.smart-filter--top .sf-facet," +
      "#smart-filter-embed.smart-filter--top .sf-facet," +
      ".smart-filter--top .sf-facet{" +
      "position:relative;z-index:1;flex:0 1 auto!important;width:auto!important;" +
      "max-width:100%!important;margin:0!important;padding:0!important;" +
      "border:0!important;border-top:none!important;background:transparent!important}" +
      ".smart-filter--top .sf-facet:not(.is-collapsed){z-index:20}" +
      "#smart-filter-root.smart-filter--top .sf-facet-label," +
      "#smart-filter-embed.smart-filter--top .sf-facet-label," +
      ".smart-filter--top .sf-facet-label{" +
      "width:auto!important;min-width:0!important;max-width:100%!important;" +
      "padding:.45rem .15rem!important;gap:.5em;white-space:nowrap}" +
      "#smart-filter-root.smart-filter--top .sf-facet.is-collapsed .sf-chevron," +
      "#smart-filter-embed.smart-filter--top .sf-facet.is-collapsed .sf-chevron," +
      ".smart-filter--top .sf-facet.is-collapsed .sf-chevron{" +
      "transform:rotate(45deg)!important;margin-top:-.28rem!important}" +
      "#smart-filter-root.smart-filter--top .sf-facet:not(.is-collapsed) .sf-chevron," +
      "#smart-filter-embed.smart-filter--top .sf-facet:not(.is-collapsed) .sf-chevron," +
      ".smart-filter--top .sf-facet:not(.is-collapsed) .sf-chevron{" +
      "transform:rotate(225deg)!important;margin-top:.12rem!important}" +
      ".smart-filter--top .sf-header{" +
      "display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;" +
      "grid-template-areas:\"title title\" \"chips clear\"!important;" +
      "align-items:center!important;column-gap:1rem!important;row-gap:.55rem!important;" +
      "margin:0 0 .25rem!important;padding:.1rem 0 .85rem!important;" +
      "border-bottom:1px solid var(--sf-border,#ececec)!important}" +
      ".smart-filter--top .sf-header .sf-title{grid-area:title!important;flex:none!important;margin:0!important}" +
      ".smart-filter--top .sf-header .sf-clear-all{" +
      "grid-area:clear!important;flex:none!important;width:auto!important;max-width:none!important;" +
      "justify-self:end!important;align-self:center!important;margin:0!important}" +
      ".smart-filter--top .sf-header .sf-chips-slot{grid-area:chips!important;width:100%!important;min-width:0!important;margin:0!important}" +
      ".smart-filter--top .sf-header .sf-chips-slot .sf-chips{" +
      "margin:0!important;padding:0!important;border-bottom:0!important;gap:.45rem!important}" +
      ".smart-filter--top .sf-header .sf-close{display:none!important}" +
      ".smart-filter--top .sf-header:has(.sf-chips-slot[hidden]) .sf-clear-all{" +
      "grid-area:title!important;justify-self:end!important}" +
      ".smart-filter--top .sf-facets>.sf-chips,.smart-filter--top .sf-facets>.sf-apply-bar{" +
      "flex:1 1 100%!important;width:100%!important;max-width:100%!important}" +
      ".smart-filter--top .sf-facet.is-collapsed>.sf-facet-pop:not(.is-ported)," +
      ".sf-facet-pop.is-ported[hidden]{display:none!important}" +
      ".smart-filter--top .sf-facet:not(.is-collapsed)>.sf-facet-pop:not(.is-ported)," +
      ".sf-facet-pop.is-ported:not([hidden]){" +
      "display:block!important;box-sizing:border-box;min-width:12.5rem;width:max-content;" +
      "max-width:min(22rem,calc(100vw - 1.5rem));padding:.85rem 1rem;margin:0;" +
      "background:#fff;color:#111;border:0;border-radius:10px;" +
      "box-shadow:0 0 0 1px rgb(28 25 23 / 8%),0 10px 28px rgb(28 25 23 / 14%);" +
      "visibility:visible!important;opacity:1!important;z-index:" +
      POP_Z +
      "}" +
      ".smart-filter--top .sf-facet:not(.is-collapsed)>.sf-facet-pop:not(.is-ported){" +
      "position:absolute;top:calc(100% + .4rem);left:0}" +
      ".sf-facet-pop.is-ported{position:fixed;top:auto;left:auto;right:auto;bottom:auto}" +
      ".smart-filter--top .sf-facet:not(.is-collapsed)>.sf-facet-pop:has(.sf-price)," +
      ".sf-facet-pop.is-ported:has(.sf-price){" +
      "min-width:17.5rem;max-width:min(24rem,calc(100vw - 1.5rem))}" +
      "#smart-filter-root.smart-filter--top .sf-facet-pop>.sf-options," +
      "#smart-filter-embed.smart-filter--top .sf-facet-pop>.sf-options," +
      ".smart-filter--top .sf-facet-pop>.sf-options," +
      ".sf-facet-pop.is-ported>.sf-options{" +
      "height:auto!important;max-height:220px!important;" +
      "overflow-x:hidden!important;overflow-y:auto!important;" +
      "overscroll-behavior:contain;-webkit-overflow-scrolling:touch;" +
      "scrollbar-width:thin;scrollbar-color:#c4c4c4 transparent;scrollbar-gutter:auto}" +
      /* Swatch counts sit outside the chip — px padding matches badge overhang on all themes */
      "#smart-filter-root.smart-filter--top .sf-facet-pop>.sf-options-swatches:not(.sf-options-swatch-text)," +
      "#smart-filter-embed.smart-filter--top .sf-facet-pop>.sf-options-swatches:not(.sf-options-swatch-text)," +
      ".smart-filter--top .sf-facet-pop>.sf-options-swatches:not(.sf-options-swatch-text)," +
      ".sf-facet-pop.is-ported>.sf-options-swatches:not(.sf-options-swatch-text){" +
      "padding:8px 8px 2px 2px!important}" +
      "#smart-filter-root.smart-filter--top .sf-facet-pop>.sf-options-swatches:not(.sf-options-swatch-text)>li," +
      "#smart-filter-embed.smart-filter--top .sf-facet-pop>.sf-options-swatches:not(.sf-options-swatch-text)>li," +
      ".smart-filter--top .sf-facet-pop>.sf-options-swatches:not(.sf-options-swatch-text)>li," +
      ".sf-facet-pop.is-ported>.sf-options-swatches:not(.sf-options-swatch-text)>li{" +
      "overflow:visible!important}" +
      "#smart-filter-root.smart-filter--top .sf-facet-pop>.sf-options::-webkit-scrollbar," +
      "#smart-filter-embed.smart-filter--top .sf-facet-pop>.sf-options::-webkit-scrollbar," +
      ".smart-filter--top .sf-facet-pop>.sf-options::-webkit-scrollbar," +
      ".sf-facet-pop.is-ported>.sf-options::-webkit-scrollbar{width:4px;height:4px}" +
      "#smart-filter-root.smart-filter--top .sf-facet-pop>.sf-options::-webkit-scrollbar-track," +
      "#smart-filter-embed.smart-filter--top .sf-facet-pop>.sf-options::-webkit-scrollbar-track," +
      ".smart-filter--top .sf-facet-pop>.sf-options::-webkit-scrollbar-track," +
      ".sf-facet-pop.is-ported>.sf-options::-webkit-scrollbar-track{" +
      "background:transparent;border-radius:999px}" +
      "#smart-filter-root.smart-filter--top .sf-facet-pop>.sf-options::-webkit-scrollbar-thumb," +
      "#smart-filter-embed.smart-filter--top .sf-facet-pop>.sf-options::-webkit-scrollbar-thumb," +
      ".smart-filter--top .sf-facet-pop>.sf-options::-webkit-scrollbar-thumb," +
      ".sf-facet-pop.is-ported>.sf-options::-webkit-scrollbar-thumb{" +
      "background:#c4c4c4;border-radius:999px}" +
      ".smart-filter--top .sf-facet-pop>.sf-price,.sf-facet-pop.is-ported>.sf-price," +
      ".smart-filter--top .sf-facet-pop>.sf-dropdown-wrap," +
      ".sf-facet-pop.is-ported>.sf-dropdown-wrap{" +
      "height:auto!important;max-height:none!important;overflow:visible!important}" +
      /* Price range chrome when pop is body-ported (outside #smart-filter-root). */
      ".sf-facet-pop .sf-price{" +
      "display:grid!important;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr)!important;" +
      "gap:12px 10px!important;align-items:center!important;width:100%!important;" +
      "min-width:0!important;overflow:visible!important;padding-inline:10px!important;" +
      "box-sizing:border-box!important}" +
      ".sf-facet-pop .sf-slider{" +
      "grid-column:1/-1!important;position:relative!important;display:block!important;" +
      "width:100%!important;height:27px!important;margin:9px 0 3px!important;" +
      "overflow:visible!important;background:transparent!important}" +
      ".sf-facet-pop .sf-slider-track{" +
      "position:absolute!important;left:0!important;right:0!important;top:50%!important;" +
      "width:auto!important;height:2px!important;margin-top:-1px!important;border:0!important;" +
      "border-radius:999px!important;pointer-events:none!important;display:block!important;" +
      "background:#dcdcdc!important;z-index:0!important}" +
      ".sf-facet-pop .sf-slider-fill{" +
      "position:absolute!important;top:50%!important;height:3px!important;margin-top:-1.5px!important;" +
      "border:0!important;border-radius:999px!important;pointer-events:none!important;" +
      "display:block!important;background:var(--sf-accent,#111)!important;z-index:1!important}" +
      ".sf-facet-pop .sf-slider-thumb{" +
      "position:absolute!important;top:50%!important;width:16px!important;height:16px!important;" +
      "margin:0!important;padding:0!important;border:1.5px solid var(--sf-accent,#111)!important;" +
      "border-radius:999px!important;background:#fff!important;" +
      "transform:translate(-50%,-50%)!important;z-index:4!important;pointer-events:auto!important;" +
      "cursor:grab!important;display:block!important}" +
      ".sf-facet-pop .sf-price-bounds{" +
      "grid-column:1/-1!important;display:flex!important;justify-content:space-between!important;" +
      "gap:.5rem!important;font-size:.8125em!important;color:#8a8a8a!important}" +
      ".sf-facet-pop .sf-facet-search-input{" +
      "outline:none!important;box-shadow:none!important}" +
      ".sf-facet-pop .sf-facet-search-input:focus," +
      ".sf-facet-pop .sf-facet-search-input:focus-visible{" +
      "outline:none!important;border-color:#111!important;box-shadow:0 0 0 1px #111!important}";
    (document.head || document.documentElement).appendChild(style);
  }

  function isTop(widget) {
    if (!widget) return false;
    if (widget.position === "top") return true;
    var root = widget.root;
    return Boolean(
      root && root.classList && root.classList.contains("smart-filter--top"),
    );
  }

  function facetLabel(facet) {
    if (!facet || !facet.children) return null;
    var kids = facet.children;
    var i;
    for (i = 0; i < kids.length; i += 1) {
      if (kids[i].classList && kids[i].classList.contains("sf-facet-label")) {
        return kids[i];
      }
    }
    return null;
  }

  function facetPop(facet) {
    if (!facet) return null;
    if (facet._sfFacetPop && facet._sfFacetPop.isConnected) {
      return facet._sfFacetPop;
    }
    var kids = facet.children;
    var i;
    for (i = 0; i < kids.length; i += 1) {
      if (kids[i].classList && kids[i].classList.contains("sf-facet-pop")) {
        facet._sfFacetPop = kids[i];
        return kids[i];
      }
    }
    return facet._sfFacetPop || null;
  }

  function moveOrphansIntoPop(facet, pop) {
    var kids = Array.prototype.slice.call(facet.children);
    var i;
    for (i = 0; i < kids.length; i += 1) {
      var el = kids[i];
      if (el === pop) continue;
      if (el.classList.contains("sf-facet-label")) continue;
      if (el.classList.contains("sf-facet-pop")) continue;
      pop.appendChild(el);
    }
  }

  function wrapFacetPop(facet) {
    if (!facet || !facet.appendChild) return;
    var existing = facetPop(facet);
    if (existing && existing.parentNode === facet) {
      moveOrphansIntoPop(facet, existing);
      return;
    }
    if (existing && existing.classList.contains("is-ported")) {
      return;
    }
    var pop = document.createElement("div");
    pop.className = "sf-facet-pop";
    var nodes = Array.prototype.slice.call(facet.childNodes);
    var i;
    for (i = 0; i < nodes.length; i += 1) {
      var node = nodes[i];
      if (node.nodeType !== 1) continue;
      if (node.classList.contains("sf-facet-label")) continue;
      pop.appendChild(node);
    }
    if (pop.childNodes.length) {
      facet.appendChild(pop);
      facet._sfFacetPop = pop;
    }
  }

  function enhanceTopPops(widget) {
    if (!isTop(widget)) return;
    var root = widget.panelEl || widget.facetsEl || widget.root;
    if (!root || !root.querySelectorAll) return;
    var facets = root.querySelectorAll(".sf-facet");
    var i;
    for (i = 0; i < facets.length; i += 1) wrapFacetPop(facets[i]);
  }

  function resetPopPosition(pop) {
    if (!pop || !pop.style) return;
    pop.style.position = "";
    pop.style.top = "";
    pop.style.left = "";
    pop.style.right = "";
    pop.style.bottom = "";
    pop.style.width = "";
    pop.style.minWidth = "";
    pop.style.maxWidth = "";
    pop.style.margin = "";
    pop.style.zIndex = "";
    pop.style.visibility = "";
  }

  function reparentPop(facet, pop) {
    if (!facet || !pop) return;
    if (pop.parentNode === facet) return;
    facet.appendChild(pop);
  }

  function hidePortedPop(facet, pop) {
    if (!pop) return;
    pop.hidden = true;
    pop.classList.remove("is-ported");
    resetPopPosition(pop);
    reparentPop(facet, pop);
    pop.hidden = false;
  }

  function positionPortedPop(facet, pop) {
    var anchor = facetLabel(facet) || facet;
    var rect = anchor.getBoundingClientRect();
    var viewportW = Math.max(
      document.documentElement.clientWidth || 0,
      window.innerWidth || 0,
    );
    var viewportH = Math.max(
      document.documentElement.clientHeight || 0,
      window.innerHeight || 0,
    );
    var isPrice = Boolean(pop.querySelector && pop.querySelector(".sf-price"));
    var maxWidth = Math.min(
      isPrice ? 384 : 352,
      Math.max(200, viewportW - 24),
    );
    var minWidth = isPrice ? 280 : 200;
    pop.style.minWidth = minWidth + "px";
    pop.style.width = "max-content";
    pop.style.maxWidth = maxWidth + "px";

    var measured = Math.ceil(
      pop.getBoundingClientRect().width || pop.offsetWidth || minWidth,
    );
    var width = Math.min(Math.max(measured, minWidth), maxWidth);
    var left = rect.left;
    if (left + width > viewportW - 12) {
      left = Math.max(12, viewportW - 12 - width);
    }
    if (left < 12) left = 12;

    var gap = 6;
    var top = rect.bottom + gap;
    var height = pop.offsetHeight || 0;
    if (height && top + height > viewportH - 12) {
      var above = rect.top - gap - height;
      if (above >= 12) top = above;
    }

    pop.style.position = "fixed";
    pop.style.top = Math.round(top) + "px";
    pop.style.left = Math.round(left) + "px";
    pop.style.right = "auto";
    pop.style.bottom = "auto";
    pop.style.width = Math.round(width) + "px";
    pop.style.minWidth = minWidth + "px";
    pop.style.maxWidth = maxWidth + "px";
    pop.style.margin = "0";
    pop.style.zIndex = POP_Z;
  }

  function refreshPriceSlider(pop) {
    if (!pop || !pop.querySelector) return;
    var slider = pop.querySelector(".sf-slider");
    if (!slider) return;
    var ranges = slider.querySelectorAll('input[type="range"]');
    if (ranges.length < 2) return;
    var low = ranges[0];
    var high = ranges[1];
    var fill = slider.querySelector(".sf-slider-fill");
    var thumbLow = slider.querySelector(".sf-slider-thumb-min");
    var thumbHigh = slider.querySelector(".sf-slider-thumb-max");
    var min = Number(low.min);
    var max = Number(low.max);
    var span = max - min || 1;
    var left = ((Number(low.value) - min) / span) * 100;
    var right = ((Number(high.value) - min) / span) * 100;
    if (thumbLow) thumbLow.style.left = left + "%";
    if (thumbHigh) thumbHigh.style.left = right + "%";
    if (fill) {
      fill.style.left = Math.min(left, right) + "%";
      fill.style.width = Math.abs(right - left) + "%";
    }
    try {
      low.dispatchEvent(new Event("input", { bubbles: true }));
    } catch (err) {
      /* ignore */
    }
  }

  function openPortedPop(facet) {
    var pop = facetPop(facet);
    if (!pop) return;
    facet._sfFacetPop = pop;
    if (pop.parentNode !== document.body) {
      document.body.appendChild(pop);
    }
    pop.classList.add("is-ported");
    pop.hidden = false;
    pop.style.visibility = "hidden";
    positionPortedPop(facet, pop);
    pop.style.visibility = "";
    refreshPriceSlider(pop);
    ignoreDocClick = true;
    window.setTimeout(function () {
      ignoreDocClick = false;
    }, 0);
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(function () {
        if (
          facet.classList &&
          !facet.classList.contains("is-collapsed") &&
          pop.classList.contains("is-ported")
        ) {
          positionPortedPop(facet, pop);
          refreshPriceSlider(pop);
        }
      });
    }
  }

  function setFacetCollapsed(widget, facet, collapsed) {
    if (!facet || !facet.classList) return;
    var pop = facetPop(facet);
    facet.classList.toggle("is-collapsed", collapsed);
    var key = facet.getAttribute("data-facet-key");
    if (key && widget && widget.collapsedState) {
      widget.collapsedState[key] = collapsed;
    }
    var label = facetLabel(facet);
    if (label) label.setAttribute("aria-expanded", String(!collapsed));
    if (collapsed) {
      hidePortedPop(facet, pop);
    } else if (isTop(widget)) {
      openPortedPop(facet);
    }
  }

  function closeAllTopFacets(widget, except) {
    if (!isTop(widget)) return;
    var root = widget.panelEl || widget.facetsEl || widget.root;
    if (!root || !root.querySelectorAll) return;
    var facets = root.querySelectorAll(".sf-facet");
    var i;
    for (i = 0; i < facets.length; i += 1) {
      if (except && facets[i] === except) continue;
      if (!facets[i].classList.contains("is-collapsed")) {
        setFacetCollapsed(widget, facets[i], true);
      }
    }
    /* Orphan body-ported pops from a prior render — reattach if owner exists. */
    var ported = document.querySelectorAll("body > .sf-facet-pop.is-ported");
    for (i = 0; i < ported.length; i += 1) {
      var ownerKey = ported[i].getAttribute("data-facet-owner");
      if (except && except.getAttribute("data-facet-key") === ownerKey) continue;
      var owner = ownerKey
        ? root.querySelector(
            '.sf-facet[data-facet-key="' +
              String(ownerKey).replace(/\\/g, "\\\\").replace(/"/g, '\\"') +
              '"]',
          )
        : null;
      if (owner) {
        hidePortedPop(owner, ported[i]);
      } else {
        ported[i].classList.remove("is-ported");
        resetPopPosition(ported[i]);
        if (ported[i].parentNode) {
          ported[i].parentNode.removeChild(ported[i]);
        }
      }
    }
  }

  function syncOpenPort(widget, facet) {
    if (!isTop(widget) || !facet) return;
    if (facet.classList.contains("is-collapsed")) {
      hidePortedPop(facet, facetPop(facet));
      return;
    }
    var pop = facetPop(facet);
    if (pop) pop.setAttribute("data-facet-owner", facet.getAttribute("data-facet-key") || "");
    openPortedPop(facet);
  }

  function repositionOpenPops(widget) {
    if (!isTop(widget)) return;
    var root = widget.panelEl || widget.facetsEl || widget.root;
    if (!root || !root.querySelectorAll) return;
    var facets = root.querySelectorAll(".sf-facet:not(.is-collapsed)");
    var i;
    for (i = 0; i < facets.length; i += 1) {
      var pop = facetPop(facets[i]);
      if (pop && pop.classList.contains("is-ported")) {
        positionPortedPop(facets[i], pop);
      }
    }
  }

  function eventInsideOpenPop(event, widget) {
    var target = event.target;
    if (!target || !target.closest) return false;
    var root = widget.root;
    var hitFacet = target.closest(".sf-facet");
    if (hitFacet && root && root.contains(hitFacet)) return true;
    var hitPop = target.closest(".sf-facet-pop");
    if (hitPop && hitPop.classList.contains("is-ported")) return true;
    return false;
  }

  function bindTopPopUi(widget) {
    if (!widget || widget.__findlyTopPopBound) return;
    var root = widget.root;
    if (!root || !root.addEventListener) return;
    widget.__findlyTopPopBound = true;

    root.addEventListener("click", function (event) {
      if (!isTop(widget)) return;
      var target = event.target;
      if (!target || !target.closest) return;
      var label = target.closest(".sf-facet-label");
      if (!label || !root.contains(label)) return;
      var facet = label.closest(".sf-facet");
      if (!facet) return;
      /* Bubble after the label's own toggle. */
      if (!facet.classList.contains("is-collapsed")) {
        closeAllTopFacets(widget, facet);
        syncOpenPort(widget, facet);
      } else {
        hidePortedPop(facet, facetPop(facet));
      }
    });

    document.addEventListener("click", function (event) {
      if (ignoreDocClick) return;
      if (!isTop(widget)) return;
      if (eventInsideOpenPop(event, widget)) return;
      closeAllTopFacets(widget);
    });

    document.addEventListener("keydown", function (event) {
      if (!isTop(widget)) return;
      var key = event.key || event.code;
      if (key !== "Escape" && key !== "Esc" && event.keyCode !== 27) return;
      closeAllTopFacets(widget);
    });

    if (!widget.__findlyTopPopResize) {
      widget.__findlyTopPopResize = true;
      window.addEventListener(
        "resize",
        function () {
          repositionOpenPops(widget);
        },
        { passive: true },
      );
      window.addEventListener(
        "scroll",
        function () {
          repositionOpenPops(widget);
        },
        true,
      );
    }
  }

  function patchWidget(widget) {
    if (!widget) return;
    bindTopPopUi(widget);
    enhanceTopPops(widget);

    var proto = Object.getPrototypeOf(widget);
    if (!proto || proto[PATCHED]) return;
    proto[PATCHED] = true;

    var origRenderFacets = proto.renderFacets;
    proto.renderFacets = function () {
      /* Reparent open pops before facetsEl is wiped. */
      if (isTop(this) && this.facetsEl) {
        var open = this.facetsEl.querySelectorAll(".sf-facet:not(.is-collapsed)");
        var i;
        for (i = 0; i < open.length; i += 1) {
          hidePortedPop(open[i], facetPop(open[i]));
        }
      }
      var result = origRenderFacets
        ? origRenderFacets.apply(this, arguments)
        : undefined;
      enhanceTopPops(this);
      bindTopPopUi(this);
      /* Restore port for facets that stayed expanded across re-render. */
      if (isTop(this) && this.facetsEl) {
        var stillOpen = this.facetsEl.querySelectorAll(
          ".sf-facet:not(.is-collapsed)",
        );
        var j;
        for (j = 0; j < stillOpen.length; j += 1) {
          syncOpenPort(this, stillOpen[j]);
        }
      }
      return result;
    };
  }

  function installSetter(held) {
    var desc = Object.getOwnPropertyDescriptor(
      window,
      "__FINDLY_FILTER_WIDGET",
    );
    var prevSet = desc && desc.set;
    var prevGet = desc && desc.get;
    if (prevGet && held == null) {
      try {
        held = prevGet();
      } catch (err) {
        /* ignore */
      }
    }
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

  function install() {
    injectCss();
    var held = window.__FINDLY_FILTER_WIDGET;
    installSetter(held);
    if (held) patchWidget(held);
  }

  install();
})();
