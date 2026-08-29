/**
 * Storefront App Proxy performance audit (700ms p95 budget).
 *
 * Seeds a 500-product catalog, exercises filters + search loaders with
 * PROXY_SIGNATURE_BYPASS, reports cold + concurrent p50/p95/p99, and dumps
 * timing breakdowns from STOREFRONT_TIMING logs.
 *
 * Usage:
 *   node --import tsx scripts/perf-audit.mjs
 *   node --import tsx scripts/perf-audit.mjs --phase=1
 *   node --import tsx scripts/perf-audit.mjs --phase=3 --label=after
 */
import "tsx/esm";
import { createServer } from "node:http";
import { PrismaClient } from "@prisma/client";
import { log } from "./terminal-log.mjs";
import { seedFilterConfig } from "./seed-filter-config.mjs";

process.env.NODE_ENV = "development";
process.env.PROXY_SIGNATURE_BYPASS = "true";
process.env.STOREFRONT_TIMING = process.env.STOREFRONT_TIMING || "1";
process.env.DEV_UNLOCK_LIMITS = "true";

const SHOP = "findly-perf-audit.myshopify.com";
const COL_GID = "gid://shopify/Collection/900001";
const COL_ID = "900001";
const PRODUCT_COUNT = 500;
const CONCURRENCY = 15;
const DURATION_MS = 45_000;
const WARMUP = 5;
const SPARSE = process.argv.includes("--sparse");
const GAP_MS = Number(
  process.argv.find((a) => a.startsWith("--gap-ms="))?.slice(9) || 20000,
);
const SPARSE_SAMPLES = Number(
  process.argv.find((a) => a.startsWith("--samples="))?.slice(10) || 8,
);

const prisma = new PrismaClient();
const phase = process.argv.find((a) => a.startsWith("--phase="))?.slice(8) || "1";
const label =
  process.argv.find((a) => a.startsWith("--label="))?.slice(8) ||
  (phase === "3" ? "after" : "baseline");

const VENDORS = ["Acme", "Northwind", "Globex", "Initech", "Umbrella"];
const TYPES = ["Jacket", "Boots", "Bag", "Tent", "Bottle"];
const COLORS = ["Red", "Blue", "Green", "Black", "Navy"];
const SIZES = ["S", "M", "L", "XL"];
const MATERIALS = ["Cotton", "Nylon", "Wool", "Leather", "Polyester"];

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, idx)];
}

function stats(samples) {
  const sorted = [...samples].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  return {
    n: sorted.length,
    min: sorted[0] ?? 0,
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
    max: sorted[sorted.length - 1] ?? 0,
    mean: sorted.length ? Math.round((sum / sorted.length) * 10) / 10 : 0,
  };
}

async function cleanupPerfShop() {
  await prisma.shop.deleteMany({ where: { domain: SHOP } });
  await prisma.cacheGeneration.deleteMany({
    where: { key: { in: [`catalog:${SHOP}`, `config:${SHOP}`] } },
  });
}

async function ensureCatalog() {
  if (process.argv.includes("--reuse-seed")) {
    const existing = await prisma.shop.findUnique({
      where: { domain: SHOP },
      select: { id: true },
    });
    if (existing) {
      const products = await prisma.productFacet.count({
        where: { shopId: existing.id },
      });
      if (products >= PRODUCT_COUNT) {
        log.info(`Reusing seed shop ${SHOP} (${products} products)`);
        return existing;
      }
    }
  }
  return seedCatalog();
}

async function seedCatalog() {
  log.info(`Seeding ${PRODUCT_COUNT} products for ${SHOP}…`);
  await cleanupPerfShop();

  const shop = await prisma.shop.create({
    data: { domain: SHOP, plan: "pro" },
  });

  await prisma.appSettings.upsert({
    where: { shopId: shop.id },
    create: {
      shopId: shop.id,
      enableFiltersOnSearch: true,
      enableCollectionSearch: true,
      searchFields: ["title", "vendor", "productType", "tags", "metafields"],
    },
    update: {
      enableFiltersOnSearch: true,
      enableCollectionSearch: true,
    },
  });

  await prisma.collection.create({
    data: {
      shopId: shop.id,
      collectionGid: COL_GID,
      title: "Perf All Gear",
      handle: "perf-all-gear",
    },
  });

  await seedFilterConfig(prisma, shop.id, {
    collectionGid: COL_GID,
    name: "Perf collection",
    enabled: true,
    enablePrice: true,
    enableAvailability: true,
    enableVendor: true,
    enableProductType: true,
    enableTags: true,
    enableOptions: true,
    displayOrder: [
      "availability",
      "price",
      "vendor",
      "productType",
      "tags",
      "options",
      "mf_custom.material",
    ],
  });

  await seedFilterConfig(prisma, shop.id, {
    collectionGid: "",
    name: "Perf search",
    appliesToSearch: true,
    enabled: true,
    enablePrice: true,
    enableAvailability: true,
    enableVendor: true,
    enableProductType: true,
    enableTags: true,
    enableOptions: true,
  });

  await prisma.metafieldMapping.create({
    data: {
      shopId: shop.id,
      namespace: "custom",
      key: "material",
      displayLabel: "Material",
      ownerType: "PRODUCT",
      enabled: true,
      appliesTo: ["filter", "search"],
      sortOrder: 0,
    },
  });

  const products = [];
  const memberships = [];
  for (let i = 1; i <= PRODUCT_COUNT; i++) {
    const vendor = VENDORS[i % VENDORS.length];
    const productType = TYPES[i % TYPES.length];
    const color = COLORS[i % COLORS.length];
    const size = SIZES[i % SIZES.length];
    const material = MATERIALS[i % MATERIALS.length];
    const price = 19.99 + (i % 40) * 5;
    const productGid = `gid://shopify/Product/${9_000_000 + i}`;
    products.push({
      shopId: shop.id,
      productGid,
      handle: `perf-item-${i}`,
      title: `${vendor} ${productType} ${color} ${i}`,
      vendor,
      productType,
      tags: [`perf`, `series-${i % 10}`, material.toLowerCase()],
      options: { Color: [color], Size: [size] },
      priceMin: price,
      priceMax: price + 10,
      available: i % 7 !== 0,
      status: "ACTIVE",
      imageUrl: null,
      metafields: { "custom.material": material },
      skus: [`SKU-${i}`],
    });
    memberships.push({
      shopId: shop.id,
      collectionGid: COL_GID,
      productGid,
      position: i,
    });
  }

  const BATCH = 100;
  for (let i = 0; i < products.length; i += BATCH) {
    await prisma.productFacet.createMany({ data: products.slice(i, i + BATCH) });
    await prisma.collectionMembership.createMany({
      data: memberships.slice(i, i + BATCH),
    });
  }

  log.success(
    `Seeded shop ${SHOP}: ${PRODUCT_COUNT} products, 1 collection, metafield Material`,
  );
  return shop;
}

async function startProxyServer() {
  const { loader: filtersLoader } = await import(
    "../app/routes/apps.smart-filter.filters.tsx"
  );
  const { loader: searchLoader } = await import(
    "../app/routes/apps.smart-filter.search.tsx"
  );

  const server = createServer(async (req, res) => {
    try {
      const host = req.headers.host || "127.0.0.1";
      const url = new URL(req.url || "/", `http://${host}`);
      const request = new Request(url, { method: "GET" });
      const args = { request, params: {}, context: {} };
      let response;
      if (url.pathname.endsWith("/filters") || url.pathname.includes("/filters")) {
        response = await filtersLoader(args);
      } else if (
        url.pathname.endsWith("/search") ||
        url.pathname.includes("/search")
      ) {
        response = await searchLoader(args);
      } else {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "not found" }));
        return;
      }
      const body = Buffer.from(await response.arrayBuffer());
      const headers = {};
      response.headers.forEach((value, key) => {
        headers[key] = value;
      });
      res.writeHead(response.status, headers);
      res.end(body);
    } catch (error) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: String(error) }));
    }
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address();
  const port = typeof addr === "object" && addr ? addr.port : 0;
  return { server, port };
}

async function timedFetch(url) {
  const t0 = performance.now();
  const res = await fetch(url);
  const text = await res.text();
  const ms = Math.round((performance.now() - t0) * 10) / 10;
  return { ms, status: res.status, bytes: text.length, ok: res.ok };
}

async function loadTest(name, url, { concurrency, durationMs }) {
  const samples = [];
  const errors = [];
  const endAt = Date.now() + durationMs;
  let inFlight = 0;
  let started = 0;

  await new Promise((resolve) => {
    const launch = () => {
      while (inFlight < concurrency && Date.now() < endAt) {
        inFlight += 1;
        started += 1;
        timedFetch(url)
          .then((row) => {
            samples.push(row.ms);
            if (!row.ok) errors.push(row.status);
          })
          .catch((err) => {
            errors.push(String(err));
          })
          .finally(() => {
            inFlight -= 1;
            if (Date.now() >= endAt && inFlight === 0) resolve();
            else launch();
          });
      }
      if (Date.now() >= endAt && inFlight === 0) resolve();
    };
    launch();
  });

  const s = stats(samples);
  return { name, ...s, errors: errors.length, rps: Math.round((s.n / (durationMs / 1000)) * 10) / 10 };
}

async function coldRequest(name, url) {
  // Force process cold-ish path: first hit after seed / before warm cache for this URL shape
  const row = await timedFetch(url);
  return { name, coldMs: row.ms, status: row.status, bytes: row.bytes, ok: row.ok };
}

async function sparseLoadTest(name, url, { gapMs, samples }) {
  const sampleMs = [];
  const errors = [];
  for (let i = 0; i < samples; i++) {
    if (i > 0) {
      log.info(`  sparse gap ${gapMs}ms before ${name} #${i + 1}…`);
      await new Promise((r) => setTimeout(r, gapMs));
    }
    const row = await timedFetch(url);
    sampleMs.push(row.ms);
    if (!row.ok) errors.push(row.status);
    log.info(`  ${name} #${i + 1}: ${row.ms}ms`);
  }
  const s = stats(sampleMs);
  const elapsedSec = (samples - 1) * (gapMs / 1000) + s.mean / 1000;
  return {
    name: `${name} sparse`,
    ...s,
    errors: errors.length,
    rps: elapsedSec > 0 ? Math.round((samples / elapsedSec) * 10) / 10 : samples,
  };
}

function printTable(rows) {
  log.info("");
  log.info(
    "endpoint".padEnd(28) +
      "n".padStart(6) +
      "p50".padStart(10) +
      "p95".padStart(10) +
      "p99".padStart(10) +
      "max".padStart(10) +
      "rps".padStart(8) +
      "err".padStart(6),
  );
  for (const row of rows) {
    log.info(
      String(row.name).padEnd(28) +
        String(row.n).padStart(6) +
        `${row.p50}ms`.padStart(10) +
        `${row.p95}ms`.padStart(10) +
        `${row.p99}ms`.padStart(10) +
        `${row.max}ms`.padStart(10) +
        String(row.rps).padStart(8) +
        String(row.errors).padStart(6),
    );
  }
}

async function main() {
  log.info(`=== Storefront perf audit (${label}, phase ${phase}) ===`);
  log.info(`Budget: p95 ≤ 700ms | concurrency=${CONCURRENCY} duration=${DURATION_MS}ms`);

  const shop = await ensureCatalog();

  // Clear in-process caches by importing after seed
  const { clearFilterPayloadCache } = await import("../app/services/proxy.server.ts");
  clearFilterPayloadCache();

  const { server, port } = await startProxyServer();
  const base = `http://127.0.0.1:${port}/apps/smart-filter`;
  const filtersUrl = `${base}/filters?shop=${SHOP}&collection_id=${COL_ID}&collection_handle=perf-all-gear&page=1&pageSize=16&locale=en`;
  const searchUrl = `${base}/search?shop=${SHOP}&q=Acme+Jacket&limit=24&locale=en`;

  log.info(`HTTP server on :${port}`);
  log.info("Cold requests (first hit, empty in-process caches)…");

  // Restart timing with fresh caches: clear again right before cold
  clearFilterPayloadCache();
  process.env.STOREFRONT_TIMING = "1";
  const coldFilters = await coldRequest("filters cold", filtersUrl);
  const coldSearch = await coldRequest("search cold", searchUrl);
  log.info(
    `cold filters: ${coldFilters.coldMs}ms status=${coldFilters.status} bytes=${coldFilters.bytes}`,
  );
  log.info(
    `cold search:  ${coldSearch.coldMs}ms status=${coldSearch.status} bytes=${coldSearch.bytes}`,
  );

  log.info(`Warmup ${WARMUP} requests each…`);
  for (let i = 0; i < WARMUP; i++) {
    await timedFetch(filtersUrl);
    await timedFetch(searchUrl);
  }

  // Mute per-request timing logs during load (keeps numbers clean; cold already captured)
  process.env.STOREFRONT_TIMING = "0";

  let filtersLoad;
  let searchLoad;
  if (SPARSE) {
    log.info(
      `Sparse load test (gap=${GAP_MS}ms, samples=${SPARSE_SAMPLES}) — exercises soft-TTL / SWR path…`,
    );
    filtersLoad = await sparseLoadTest("filters", filtersUrl, {
      gapMs: GAP_MS,
      samples: SPARSE_SAMPLES,
    });
    searchLoad = await sparseLoadTest("search", searchUrl, {
      gapMs: GAP_MS,
      samples: SPARSE_SAMPLES,
    });
  } else {
    log.info("Load test filters…");
    filtersLoad = await loadTest("filters", filtersUrl, {
      concurrency: CONCURRENCY,
      durationMs: DURATION_MS,
    });
    log.info("Load test search…");
    searchLoad = await loadTest("search", searchUrl, {
      concurrency: CONCURRENCY,
      durationMs: DURATION_MS,
    });
  }

  printTable([filtersLoad, searchLoad]);

  const verdict = (row) => (row.p95 <= 700 ? "PASS" : "FAIL");
  log.info("");
  log.info(`Budget check (${label}):`);
  log.info(
    `  filters p95=${filtersLoad.p95}ms → ${verdict(filtersLoad)} (cold ${coldFilters.coldMs}ms)`,
  );
  log.info(
    `  search  p95=${searchLoad.p95}ms → ${verdict(searchLoad)} (cold ${coldSearch.coldMs}ms)`,
  );

  // Bundle size check (widget)
  const { statSync } = await import("node:fs");
  const { join, dirname } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const { gzipSync } = await import("node:zlib");
  const { readFileSync } = await import("node:fs");
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const assets = [
    "smart-filter.min.js",
    "smart-filter-dom.min.js",
    "smart-filter-boot.min.js",
    "smart-filter-grid.min.js",
    "smart-filter-pager.min.js",
    "smart-filter-theme.min.js",
    "smart-filter.css",
  ];
  log.info("");
  log.info("Theme extension asset sizes:");
  let schemaJs = 0;
  let companionJs = 0;
  for (const name of assets) {
    const path = join(root, "extensions/smart-filter/assets", name);
    try {
      const raw = readFileSync(path);
      const gz = gzipSync(raw).length;
      const st = statSync(path);
      log.info(
        `  ${name.padEnd(28)} raw=${String(st.size).padStart(7)}B  gzip=${String(gz).padStart(7)}B`,
      );
      if (name === "smart-filter.min.js") schemaJs = st.size;
      else if (name.endsWith(".js")) companionJs += st.size;
    } catch {
      log.warn(`  missing ${name}`);
    }
  }
  log.info(
    `  schema JS (cap 100000): ${schemaJs}B | companion JS raw total: ${companionJs}B`,
  );

  server.close();
  await prisma.$disconnect();

  // Keep seed for phase 3 re-runs unless --cleanup
  if (process.argv.includes("--cleanup")) {
    await cleanupPerfShop();
    log.info("Cleaned perf shop");
  } else {
    log.info(`Left seed shop ${SHOP} (id=${shop.id}) for re-measure`);
  }

  // Write machine-readable summary
  const summary = {
    label,
    phase,
    cold: { filters: coldFilters, search: coldSearch },
    load: { filters: filtersLoad, search: searchLoad },
    budgetMs: 700,
    pass: {
      filters: filtersLoad.p95 <= 700,
      search: searchLoad.p95 <= 700,
    },
    schemaJsBytes: schemaJs,
  };
  const { writeFileSync } = await import("node:fs");
  writeFileSync(
    join(root, `scripts/perf-audit-${label}.json`),
    JSON.stringify(summary, null, 2),
  );
  log.success(`Wrote scripts/perf-audit-${label}.json`);
}

main().catch(async (error) => {
  log.error(error);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
