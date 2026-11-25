/* eslint-env node */
/**
 * Storefront fail-safe smoke tests.
 *
 * Dev store (skipped unless all of these are set in the environment, never committed):
 *   E2E_STORE_URL          https://your-dev-store.myshopify.com
 *   E2E_COLLECTION_HANDLE  collection handle, for example all
 *   E2E_STORE_PASSWORD     storefront password, if the store has one
 *
 * Local contract tests load the extension source over http://127.0.0.1 and do not
 * need those variables. They are how the init-throw case is checked before deploy.
 */
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test, expect } from "@playwright/test";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FILTERS = "**/apps/smart-filter/filters**";

function contentType(file) {
  if (file.endsWith(".css")) return "text/css; charset=utf-8";
  if (file.endsWith(".js")) return "text/javascript; charset=utf-8";
  return "text/html; charset=utf-8";
}

function pageHtml(lab) {
  const cards = `
    <ul id="product-grid" class="product-grid">
      <li class="grid__item" id="card-a">Alpha tee</li>
      <li class="grid__item" id="card-b" data-smart-filter-hidden="true" style="display:none">Beta tee</li>
      <li class="grid__item" id="card-c">Gamma tee</li>
    </ul>`;
  const root = `
    <div id="smart-filter-root" class="smart-filter"
      data-proxy-base="/apps/smart-filter"
      data-collection-id="1"
      data-collection-handle="all"></div>`;
  if (lab === "reveal") {
    return `<!doctype html><html class="sf-filter-loading"><head>
      <link rel="stylesheet" href="/extensions/smart-filter/assets/smart-filter-check.css">
      <link rel="stylesheet" href="/extensions/smart-filter/assets/smart-filter.css">
      </head><body>${cards}</body></html>`;
  }
  if (lab === "listener") {
    return `<!doctype html><html><head></head><body>${cards}${root}
      <script src="/extensions/smart-filter/assets/smart-filter-boot.js"></script>
      </body></html>`;
  }
  return `<!doctype html><html class="sf-filter-loading"><head>
    <link rel="stylesheet" href="/extensions/smart-filter/assets/smart-filter-check.css">
    <script>
      window.requestIdleCallback = function (cb) { window.setTimeout(cb, 0); };
    </script>
    </head><body>${cards}${root}
    <script src="/extensions/smart-filter/assets/smart-filter-boot.js" defer></script>
    <script src="/extensions/smart-filter/assets/smart-filter-fetch.js" defer></script>
    <script src="/extensions/smart-filter/assets/smart-filter-grid.js" defer></script>
    <script src="/extensions/smart-filter/assets/smart-filter.js" defer></script>
    </body></html>`;
}

function startFixture() {
  const server = createServer((req, res) => {
    const url = new URL(req.url || "/", "http://127.0.0.1");
    if (url.pathname.startsWith("/extensions/")) {
      const rel = decodeURIComponent(url.pathname).replace(/^[/\\]+/, "");
      const file = path.resolve(repoRoot, rel);
      const rootPrefix = repoRoot.endsWith(path.sep) ? repoRoot : repoRoot + path.sep;
      if (file !== repoRoot && !file.startsWith(rootPrefix)) {
        res.writeHead(403);
        res.end("forbidden");
        return;
      }
      try {
        const body = readFileSync(file);
        res.writeHead(200, {
          "Content-Type": contentType(file),
          "Cache-Control": "no-store",
        });
        res.end(body);
      } catch {
        res.writeHead(404);
        res.end("missing");
      }
      return;
    }
    if (url.pathname.startsWith("/collections/")) {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(pageHtml(url.searchParams.get("lab") || "throw"));
      return;
    }
    res.writeHead(404);
    res.end("not found");
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      resolve({
        server,
        base: `http://127.0.0.1:${addr.port}`,
      });
    });
  });
}

function forceInitThrow(source) {
  const needles = [
    "Widget.prototype.init = function () {",
    ".prototype.init=function(){",
  ];
  const needle = needles.find((item) => source.includes(item));
  if (!needle) {
    throw new Error("Could not find Widget.prototype.init to stub");
  }
  return source.replace(needle, needle + 'throw new Error("findly-test-init");');
}

async function cardState(page, id) {
  return page.locator(id).evaluate((el) => {
    const cs = getComputedStyle(el);
    return {
      display: cs.display,
      opacity: cs.opacity,
      hiddenAttr: el.getAttribute("data-smart-filter-hidden"),
      text: (el.textContent || "").trim(),
      loading: document.documentElement.classList.contains("sf-filter-loading"),
    };
  });
}

test.describe("local source contract", () => {
  let fixture;

  test.beforeAll(async () => {
    fixture = await startFixture();
  });

  test.afterAll(async () => {
    await new Promise((resolve) => fixture.server.close(resolve));
  });

  test("init throw restores the theme card and clears the loading class", async ({ page }) => {
    const pageErrors = [];
    page.on("pageerror", (err) => pageErrors.push(String(err && err.message)));
    await page.route("**/smart-filter.js", async (route) => {
      const response = await route.fetch();
      const body = forceInitThrow(await response.text());
      await route.fulfill({
        status: 200,
        contentType: "text/javascript; charset=utf-8",
        body,
      });
    });
    await page.goto(`${fixture.base}/collections/all?lab=throw`);
    await expect
      .poll(async () => cardState(page, "#card-b"), { timeout: 4000 })
      .toMatchObject({
        display: "list-item",
        hiddenAttr: null,
        text: "Beta tee",
        loading: false,
      });
    const alpha = await cardState(page, "#card-a");
    expect(alpha.text).toBe("Alpha tee");
    expect(alpha.display).not.toBe("none");
    expect(pageErrors.filter((msg) => msg.includes("findly-test-init"))).toEqual([]);
  });

  test("a failed /filters call restores the grid without an unhandled rejection", async ({
    page,
  }) => {
    const rejected = [];
    await page.addInitScript(() => {
      window.addEventListener("unhandledrejection", (event) => {
        const reason = event && event.reason;
        window.__findlyUnhandled = window.__findlyUnhandled || [];
        window.__findlyUnhandled.push(String((reason && reason.message) || reason));
      });
    });
    page.on("pageerror", (err) => rejected.push(String(err && err.message)));
    let hits = 0;
    await page.route(FILTERS, async (route) => {
      hits += 1;
      await route.abort();
    });
    await page.goto(`${fixture.base}/collections/all?lab=throw`);
    await expect
      .poll(async () => cardState(page, "#card-b"), { timeout: 12000 })
      .toMatchObject({
        display: "list-item",
        hiddenAttr: null,
        loading: false,
      });
    const unhandled = await page.evaluate(() => window.__findlyUnhandled || []);
    expect(unhandled).toEqual([]);
    expect(rejected).toEqual([]);
    expect(hits).toBeGreaterThan(0);
    expect(hits).toBeLessThan(8);
  });

  test("non-v2 loading gate reveals at 3s and a later response does not restart it", async ({
    page,
  }) => {
    await page.goto(`${fixture.base}/collections/all?lab=reveal`);
    const early = await cardState(page, "#card-a");
    expect(early.opacity).toBe("0");
    expect(early.loading).toBe(true);

    await page.waitForTimeout(3200);
    const revealed = await cardState(page, "#card-a");
    expect(revealed.opacity).toBe("1");
    expect(revealed.loading).toBe(true);
    expect(revealed.text).toBe("Alpha tee");

    const trace = await page.evaluate(() => {
      const a = document.getElementById("card-a");
      const b = document.getElementById("card-b");
      const c = document.getElementById("card-c");
      let readded = 0;
      const obs = new MutationObserver(() => {
        if (document.documentElement.classList.contains("sf-filter-loading")) readded += 1;
      });
      obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
      document.documentElement.classList.remove("sf-filter-loading");
      document.documentElement.classList.add("sf-filter-ready");
      b.setAttribute("data-smart-filter-hidden", "true");
      b.style.setProperty("display", "none", "important");
      a.style.setProperty("opacity", "1");
      c.style.setProperty("opacity", "1");
      return new Promise((resolve) => {
        const samples = [];
        const started = performance.now();
        const timer = window.setInterval(() => {
          samples.push({
            t: Math.round(performance.now() - started),
            a: getComputedStyle(a).opacity,
            c: getComputedStyle(c).opacity,
            bDisplay: getComputedStyle(b).display,
            bText: (b.textContent || "").trim(),
            loading: document.documentElement.classList.contains("sf-filter-loading"),
          });
          if (performance.now() - started >= 800) {
            window.clearInterval(timer);
            obs.disconnect();
            resolve({ samples, readded });
          }
        }, 100);
      });
    });

    expect(trace.readded).toBe(0);
    expect(trace.samples.length).toBeGreaterThan(3);
    for (const sample of trace.samples) {
      expect(sample.a).toBe("1");
      expect(sample.c).toBe("1");
      expect(sample.bDisplay).toBe("none");
      expect(sample.bText).toBe("Beta tee");
      expect(sample.loading).toBe(false);
    }
    console.log("reveal-after-response " + JSON.stringify(trace));
  });

  test("a third-party error does not unhide a settled filter", async ({ page }) => {
    await page.goto(`${fixture.base}/collections/all?lab=listener`);
    const result = await page.evaluate(() => {
      window.__FINDLY_FILTER_WIDGET = {
        _sfPaintedReq: 4,
        _reqId: 4,
        _sfLeaveNative: false,
        _inflight: null,
        _loadingPage: false,
      };
      document.documentElement.classList.remove("sf-filter-loading");
      document.documentElement.classList.add("sf-filter-ready");
      const card = document.getElementById("card-b");
      card.setAttribute("data-smart-filter-hidden", "true");
      card.style.setProperty("display", "none", "important");
      window.dispatchEvent(
        new ErrorEvent("error", {
          message: "reviews boom",
          filename: "https://cdn.shopify.com/assets/other-app.js",
          error: new Error("reviews boom"),
        }),
      );
      window.dispatchEvent(
        new ErrorEvent("error", {
          message: "findly after paint",
          filename: "https://cdn.shopify.com/assets/smart-filter.min.js",
          error: new Error("findly after paint"),
        }),
      );
      const settled = {
        display: getComputedStyle(card).display,
        hiddenAttr: card.getAttribute("data-smart-filter-hidden"),
      };
      document.documentElement.classList.add("sf-filter-loading");
      window.__FINDLY_FILTER_WIDGET._sfPaintedReq = -1;
      window.dispatchEvent(
        new ErrorEvent("error", {
          message: "findly during boot",
          filename: "https://cdn.shopify.com/assets/smart-filter.js",
          error: new Error("findly during boot"),
        }),
      );
      return {
        settled,
        afterBootError: {
          display: getComputedStyle(card).display,
          hiddenAttr: card.getAttribute("data-smart-filter-hidden"),
          loading: document.documentElement.classList.contains("sf-filter-loading"),
        },
      };
    });
    expect(result.settled).toEqual({ display: "none", hiddenAttr: "true" });
    expect(result.afterBootError.hiddenAttr).toBeNull();
    expect(result.afterBootError.display).not.toBe("none");
    expect(result.afterBootError.loading).toBe(false);
  });
});

function storeEnv() {
  const storeUrl = process.env.E2E_STORE_URL || "";
  const handle = process.env.E2E_COLLECTION_HANDLE || "";
  const password = process.env.E2E_STORE_PASSWORD || "";
  return { storeUrl, handle, password };
}

async function openCollection(page) {
  const { storeUrl, handle, password } = storeEnv();
  const url = new URL(`/collections/${handle}`, storeUrl);
  await page.goto(url.toString(), { waitUntil: "domcontentloaded" });
  const passwordInput = page.locator('form[action*="/password"] input[name="password"]');
  if (await passwordInput.count()) {
    if (!password) {
      throw new Error("Store password page is up. Set E2E_STORE_PASSWORD.");
    }
    await passwordInput.fill(password);
    await Promise.all([
      page.waitForLoadState("domcontentloaded"),
      page.locator('form[action*="/password"] button[type="submit"]').click(),
    ]);
    await page.goto(url.toString(), { waitUntil: "domcontentloaded" });
  }
}

function themeCard(page) {
  return page
    .locator(
      "#product-grid .grid__item, #product-grid li, ul.product-grid > li, .product-grid .grid__item, .grid__item",
    )
    .first();
}

test.describe("dev store", () => {
  test.beforeEach(() => {
    const { storeUrl, handle } = storeEnv();
    test.skip(!storeUrl || !handle, "Set E2E_STORE_URL and E2E_COLLECTION_HANDLE to run dev-store smoke tests.");
  });

  test("collection grid stays visible", async ({ page }) => {
    await openCollection(page);
    await expect(themeCard(page)).toBeVisible({ timeout: 20000 });
  });

  test("abort /filters leaves the theme grid visible", async ({ page }) => {
    let hits = 0;
    await page.route(FILTERS, async (route) => {
      hits += 1;
      await route.abort();
    });
    await openCollection(page);
    await expect(themeCard(page)).toBeVisible({ timeout: 15000 });
    await expect
      .poll(async () => page.locator("html").evaluate((el) => el.classList.contains("sf-filter-loading")))
      .toBe(false);
    expect(hits).toBeGreaterThan(0);
    expect(hits).toBeLessThan(8);
  });

  test("500 from /filters leaves the theme grid visible", async ({ page }) => {
    let hits = 0;
    await page.route(FILTERS, async (route) => {
      hits += 1;
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: '{"error":"injected"}',
      });
    });
    await openCollection(page);
    await expect(themeCard(page)).toBeVisible({ timeout: 15000 });
    expect(hits).toBeGreaterThan(0);
    expect(hits).toBeLessThan(8);
  });

  test("bad JSON from /filters leaves the theme grid visible", async ({ page }) => {
    let hits = 0;
    await page.route(FILTERS, async (route) => {
      hits += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: "not-json",
      });
    });
    await openCollection(page);
    await expect(themeCard(page)).toBeVisible({ timeout: 15000 });
    expect(hits).toBeGreaterThan(0);
    expect(hits).toBeLessThan(8);
  });

  test("a 30s /filters hang leaves the theme grid visible", async ({ page }) => {
    test.setTimeout(50_000);
    let hits = 0;
    await page.route(FILTERS, async (route) => {
      hits += 1;
      await new Promise((resolve) => setTimeout(resolve, 30_000));
      try {
        await route.abort("timedout");
      } catch {
        /* the page may already have aborted the request */
      }
    });
    await openCollection(page);
    await expect(themeCard(page)).toBeVisible({ timeout: 15_000 });
    const stillLoading = await page
      .locator("html")
      .evaluate((el) => el.classList.contains("sf-filter-loading"));
    expect(stillLoading).toBe(false);
    expect(hits).toBeGreaterThan(0);
    expect(hits).toBeLessThan(8);
  });

  test("stubbed Widget.prototype.init throw restores the theme grid", async ({ page }) => {
    await page.route("**/smart-filter.min.js*", async (route) => {
      const response = await route.fetch();
      const body = forceInitThrow(await response.text());
      await route.fulfill({
        status: 200,
        contentType: "text/javascript; charset=utf-8",
        body,
      });
    });
    await page.route("**/smart-filter.js*", async (route) => {
      if (route.request().url().includes(".min.js")) {
        await route.fallback();
        return;
      }
      const response = await route.fetch();
      const body = forceInitThrow(await response.text());
      await route.fulfill({
        status: 200,
        contentType: "text/javascript; charset=utf-8",
        body,
      });
    });
    await openCollection(page);
    await expect(themeCard(page)).toBeVisible({ timeout: 15_000 });
    await expect
      .poll(async () =>
        page.locator("html").evaluate((el) => el.classList.contains("sf-filter-loading")),
      )
      .toBe(false);
  });
});
