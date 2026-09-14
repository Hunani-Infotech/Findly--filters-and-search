/**
 * LCP before/after fixture for collection-filters boot strategy.
 * Uses system Chrome/Edge + --dump-dom (same pattern as verify-loading-states).
 *
 * Headless dump-dom often reports LCP=0; we also record whether the hero
 * product image is layout-visible (offsetParent) — the real LCP regression
 * from the old boot path.
 *
 * Usage: node scripts/measure-lcp.mjs
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { log } from "./terminal-log.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function chromePath() {
  const candidates = [
    "C:\\\\Program Files\\\\Google\\\\Chrome\\\\Application\\\\chrome.exe",
    "C:\\\\Program Files (x86)\\\\Microsoft\\\\Edge\\\\Application\\\\msedge.exe",
    join(process.env.ProgramFiles || "", "Google/Chrome/Application/chrome.exe"),
    join(process.env["ProgramFiles(x86)"] || "", "Microsoft/Edge/Application/msedge.exe"),
    join(process.env.LOCALAPPDATA || "", "Google/Chrome/Application/chrome.exe"),
  ];
  for (const p of candidates) {
    if (p && existsSync(p)) return p;
  }
  return null;
}

function writeFixture(mode) {
  const dir = mkdtempSync(join(tmpdir(), `findly-lcp-${mode}-`));
  const bootUrl = pathToFileURL(
    join(ROOT, "extensions/smart-filter/assets/smart-filter-boot.js"),
  ).href;
  const cssUrl = pathToFileURL(
    join(ROOT, "extensions/smart-filter/assets/smart-filter.css"),
  ).href;
  const checkUrl = pathToFileURL(
    join(ROOT, "extensions/smart-filter/assets/smart-filter-check.css"),
  ).href;

  const beforeBoot = mode === "before";
  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <link rel="stylesheet" href="${checkUrl}" />
  <link rel="stylesheet" href="${cssUrl}" />
  ${
    beforeBoot
      ? `<script>document.documentElement.classList.add("sf-filter-loading");document.documentElement.classList.remove("sf-filter-ready");</script>`
      : `<script>document.documentElement.classList.remove("sf-filter-loading");document.documentElement.classList.add("sf-filter-ready");</script>`
  }
</head>
<body>
  <header style="height:64px;background:#111;color:#fff;padding:1rem">Store</header>
  <div style="display:flex;gap:1rem;max-width:1100px;margin:0 auto">
    <div id="smart-filter-root" class="smart-filter smart-filter--left sf-layout-stub"
      data-collection-id="1" data-collection-handle="all" data-proxy-base="/apps/smart-filter"
      data-position="left" data-show-counts="true">
      <button type="button" class="sf-toggle" data-drawer-toggle>Filter</button>
      <div class="sf-panel" data-drawer-panel>
        <div class="sf-header"><div class="sf-title" data-title>Filter</div></div>
        <div class="sf-facets" data-facets>
          <div class="sf-skeleton" data-skeleton aria-hidden="true">
            <div class="sf-skeleton-facet"><span class="sf-skeleton-label"></span><span class="sf-skeleton-line"></span><span class="sf-skeleton-line is-short"></span></div>
            <div class="sf-skeleton-facet"><span class="sf-skeleton-label"></span><span class="sf-skeleton-line"></span></div>
            <div class="sf-skeleton-facet"><span class="sf-skeleton-label"></span><span class="sf-skeleton-line"></span><span class="sf-skeleton-line is-short"></span></div>
          </div>
        </div>
        <div class="sf-status" data-status></div>
      </div>
    </div>
    <main style="flex:1">
      <div class="main-collection-grid" id="product-grid">
        ${[1, 2, 3, 4]
          .map(
            (n) => `
        <article class="product-card" data-product-handle="item-${n}">
          <img src="data:image/svg+xml,${encodeURIComponent(
            `<svg xmlns='http://www.w3.org/2000/svg' width='800' height='800'><rect fill='%23c8c8c8' width='800' height='800'/><text x='40' y='420' font-size='48'>Product ${n}</text></svg>`,
          )}"
            width="800" height="800" alt="Product ${n}" fetchpriority="${n === 1 ? "high" : "auto"}" />
          <h2>Product ${n}</h2>
        </article>`,
          )
          .join("")}
      </div>
    </main>
  </div>
  ${
    beforeBoot
      ? `<script>
    (function(){
      document.documentElement.classList.add("sf-filter-loading");
      document.documentElement.classList.remove("sf-filter-ready");
      var host = document.getElementById("product-grid");
      for (var i = 0; i < 8; i++) {
        var el = document.createElement("div");
        el.setAttribute("data-findly-skel","1");
        el.className = "findly-grid-skel";
        el.innerHTML = '<span class="findly-grid-skel-img"></span>';
        host.appendChild(el);
      }
    })();
  </script>`
      : `<script src="${bootUrl}"></script>`
  }
  <script>
    window.__LCP = 0;
    window.__CLS = 0;
    window.__FP = 0;
    try {
      new PerformanceObserver(function (list) {
        var entries = list.getEntries();
        var last = entries[entries.length - 1];
        if (last) window.__LCP = Math.round(last.startTime);
      }).observe({ type: "largest-contentful-paint", buffered: true });
      new PerformanceObserver(function (list) {
        list.getEntries().forEach(function (e) {
          if (!e.hadRecentInput) window.__CLS += e.value;
        });
      }).observe({ type: "layout-shift", buffered: true });
    } catch (err) {}
    function finish() {
      var paints = performance.getEntriesByType("paint") || [];
      for (var i = 0; i < paints.length; i++) {
        if (paints[i].name === "first-contentful-paint") {
          window.__FP = Math.round(paints[i].startTime);
        }
      }
      var lcpEntries = performance.getEntriesByType("largest-contentful-paint") || [];
      if (lcpEntries.length) {
        window.__LCP = Math.round(lcpEntries[lcpEntries.length - 1].startTime);
      }
      var img = document.querySelector("#product-grid article img");
      var card = document.querySelector("#product-grid article.product-card");
      var cardDisplay = card ? window.getComputedStyle(card).display : "missing";
      var layoutVisible = Boolean(img && img.offsetParent !== null);
      var stub = document.querySelector(".sf-layout-stub .sf-facets, .sf-layout-stub .sf-skeleton");
      var stubH = stub ? Math.round(stub.getBoundingClientRect().height) : 0;
      document.documentElement.setAttribute("data-lcp", String(window.__LCP || 0));
      document.documentElement.setAttribute("data-fcp", String(window.__FP || 0));
      document.documentElement.setAttribute("data-cls", String(Math.round(window.__CLS * 1000) / 1000));
      document.documentElement.setAttribute("data-img-visible", layoutVisible ? "1" : "0");
      document.documentElement.setAttribute("data-card-display", cardDisplay);
      document.documentElement.setAttribute("data-stub-h", String(stubH));
      document.documentElement.setAttribute("data-lcp-ready", "1");
    }
    if (document.readyState === "complete") setTimeout(finish, 800);
    else window.addEventListener("load", function () { setTimeout(finish, 800); });
  </script>
</body>
</html>`;
  const path = join(dir, "index.html");
  writeFileSync(path, html);
  return path;
}

function run(mode) {
  const chrome = chromePath();
  if (!chrome) throw new Error("Chrome/Edge not found for LCP measure");
  const htmlPath = writeFixture(mode);
  const url = pathToFileURL(htmlPath).href;
  const result = spawnSync(
    chrome,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-first-run",
      "--no-default-browser-check",
      "--allow-file-access-from-files",
      "--virtual-time-budget=12000",
      "--dump-dom",
      url,
    ],
    { encoding: "utf8", timeout: 45000, windowsHide: true, maxBuffer: 10_000_000 },
  );
  if (result.error) throw result.error;
  const dom = String(result.stdout || "") + String(result.stderr || "");
  const pick = (re) => {
    const m = re.exec(dom);
    return m ? m[1] : null;
  };
  return {
    mode,
    lcpMs: Number(pick(/data-lcp="([^"]+)"/) || 0) || null,
    fcpMs: Number(pick(/data-fcp="([^"]+)"/) || 0) || null,
    cls: Number(pick(/data-cls="([^"]+)"/) || 0),
    imgVisible: /data-img-visible="1"/.test(dom),
    cardDisplay: pick(/data-card-display="([^"]+)"/),
    stubHeightPx: Number(pick(/data-stub-h="([^"]+)"/) || 0),
    ready: /data-lcp-ready="1"/.test(dom),
  };
}

const before = run("before");
const after = run("after");
log.info("LCP fixture before: " + JSON.stringify(before));
log.info("LCP fixture after:  " + JSON.stringify(after));
writeFileSync(
  join(ROOT, "scripts/perf-lcp-compare.json"),
  JSON.stringify({ before, after, note: "before=old sf-filter-loading hides Liquid products; after=LCP-safe stub + ready" }, null, 2),
);

if (!after.ready || !before.ready) {
  throw new Error("LCP attributes missing from dump-dom");
}
if (!after.imgVisible) {
  throw new Error("After fixture must keep hero product image layout-visible (LCP candidate)");
}
if (before.imgVisible) {
  throw new Error("Before fixture must hide Liquid product cards under sf-filter-loading");
}
if (after.stubHeightPx < 80) {
  throw new Error("After stub height too small for CLS reservation: " + after.stubHeightPx);
}

log.success(
  `LCP_OK before_imgVisible=${before.imgVisible} after_imgVisible=${after.imgVisible} stubH=${after.stubHeightPx}px cls_after=${after.cls} lcp_before=${before.lcpMs} lcp_after=${after.lcpMs}`,
);
