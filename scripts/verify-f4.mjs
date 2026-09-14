/**
 * F4 gate: search + filter analytics events and dashboard aggregates.
 * Usage: npm run verify:f4
 */
import "tsx/esm";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createPrismaClient } from "./prisma-runtime.mjs";
import { log } from "./terminal-log.mjs";

const SHOP_DOMAIN = "f4-verify.myshopify.com";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const prisma = createPrismaClient();

function fail(message) {
  throw new Error(message);
}

function readRepo(...parts) {
  return readFileSync(join(ROOT, ...parts), "utf8");
}

function assertStaticMarkers() {
  const schema = readRepo("prisma", "schema.prisma");
  if (!schema.includes("model AnalyticsEvent")) {
    fail("schema missing AnalyticsEvent");
  }
  const server = readRepo("app", "services", "analytics.server.ts");
  if (!server.includes("ingestAnalyticsEvent") || !server.includes("loadAnalyticsDashboard")) {
    fail("analytics.server.ts missing ingest/dashboard");
  }
  const route = readRepo("app", "routes", "apps.smart-filter.analytics.tsx");
  if (!route.includes("ingestAnalyticsEvent")) {
    fail("proxy analytics route missing ingest");
  }
  const admin = readRepo("app", "routes", "app.analytics.tsx");
  if (!admin.includes("loadAnalyticsDashboard")) {
    fail("admin analytics page not using live dashboard");
  }
  const searchJs = readRepo("extensions", "smart-filter", "assets", "smart-filter-search.js");
  if (!searchJs.includes('kind: "search"') && !searchJs.includes("kind=search")) {
    fail("search widget missing search beacon");
  }
  const filterJs = readRepo("extensions", "smart-filter", "assets", "smart-filter.js");
  if (!filterJs.includes("facetCount >= 2") || !filterJs.includes('kind: "filter"')) {
    fail("filter widget missing 2-facet combo beacon");
  }
  log.info("F4 static markers present");
}

async function cleanup() {
  await prisma.shop.deleteMany({ where: { domain: SHOP_DOMAIN } });
}

try {
  await cleanup();
  assertStaticMarkers();

  const shop = await prisma.shop.create({
    data: { domain: SHOP_DOMAIN, plan: "free" },
  });

  const { ingestAnalyticsEvent, loadAnalyticsDashboard } = await import("../app/services/analytics.server.ts"
  );

  const search = await ingestAnalyticsEvent({
    shopDomain: SHOP_DOMAIN,
    kind: "search",
    query: "Cotton Shirt",
    resultCount: 3,
    visitor: "v1",
    device: "desktop",
  });
  if (!search.ok) fail("search ingest failed");

  const zero = await ingestAnalyticsEvent({
    shopDomain: SHOP_DOMAIN,
    kind: "search",
    query: "zzzz-no-match",
    resultCount: 0,
    visitor: "v1",
    device: "desktop",
  });
  if (!zero.ok) fail("zero-result ingest failed");

  const combo = await ingestAnalyticsEvent({
    shopDomain: SHOP_DOMAIN,
    kind: "filter",
    combo: "tags=sale|vendor=Acme",
    visitor: "v2",
    device: "mobile",
  });
  if (!combo.ok) fail("filter combo ingest failed");

  const click = await ingestAnalyticsEvent({
    shopDomain: SHOP_DOMAIN,
    kind: "click",
    handle: "cotton-shirt",
    query: "cotton shirt",
    visitor: "v1",
    device: "desktop",
  });
  if (!click.ok) fail("click ingest failed");

  const dashboard = await loadAnalyticsDashboard(shop.id, "this_month", "free");
  const top = dashboard.topQueries.map((row) => row.label);
  if (!top.includes("cotton shirt")) {
    fail(`Top terms missing cotton shirt: ${JSON.stringify(dashboard.topQueries)}`);
  }
  const zeros = dashboard.noResultQueries.map((row) => row.label);
  if (!zeros.includes("zzzz-no-match")) {
    fail(`No results missing zzzz-no-match: ${JSON.stringify(dashboard.noResultQueries)}`);
  }
  const combos = dashboard.filterCombos.map((row) => row.label);
  if (!combos.includes("tags=sale|vendor=Acme")) {
    fail(`Filter combos missing two-facet combo: ${JSON.stringify(dashboard.filterCombos)}`);
  }
  if (dashboard.retentionDays !== 90 && dashboard.retentionDays !== 180) {
    fail(`retention expected 90 or 180, got ${dashboard.retentionDays}`);
  }
  if (dashboard.metrics.uniqueVisitors < 2) {
    fail("expected two unique visitors");
  }

  await cleanup();
  log.info("STEPF4_OK");
} catch (error) {
  await cleanup().catch(() => undefined);
  log.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
