import prisma from "./db.server";
import { getShopPlan, isDevUnlockLimits, isPaidPlanKey } from "./billing.server";
import { createTtlCache } from "./read-cache.server";
import { findShopCached } from "./shop-cache.server";

export const ANALYTICS_KINDS = ["search", "filter", "click", "visit"] as const;
export type AnalyticsKind = (typeof ANALYTICS_KINDS)[number];
export type AnalyticsRange = "this_month" | "last_7" | "last_30";

export type IngestInput = {
  shopDomain: string;
  kind: string;
  query?: string;
  combo?: string;
  handle?: string;
  resultCount?: number;
  visitor?: string;
  device?: string;
};

function clip(value: string, max: number) {
  return value.trim().slice(0, max);
}

function isKind(value: string): value is AnalyticsKind {
  return (ANALYTICS_KINDS as readonly string[]).includes(value);
}

export function retentionDaysForPlan(plan: string): number {
  if (isDevUnlockLimits()) return 180;
  return isPaidPlanKey(plan) ? 180 : 90;
}

export function rangeStart(range: AnalyticsRange, now = new Date()): Date {
  if (range === "last_7") {
    return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  }
  if (range === "last_30") {
    return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function normalizeHandle(raw: string): string {
  let value = raw.trim().toLowerCase();
  value = value.replace(/^https?:\/\/[^/]+\//i, "");
  value = value.replace(/^\/+/, "");
  value = value.replace(/^products\//, "");
  value = value.split(/[?#]/)[0] ?? "";
  return value.replace(/\/+$/, "").slice(0, 100);
}

const ANALYTICS_PRUNE_TTL_MS = 10 * 60 * 1000;
const lastAnalyticsPrune = new Map<string, number>();

export async function ingestAnalyticsEvent(input: IngestInput) {
  const kind = String(input.kind || "").trim();
  if (!isKind(kind)) return { ok: false as const, error: "Invalid kind" };

  const shop = await findShopCached(input.shopDomain);
  if (!shop) return { ok: false as const, error: "Shop not synced" };

  const query = clip(String(input.query || "").toLowerCase(), 120);
  const combo = clip(String(input.combo || ""), 240);
  const handle = normalizeHandle(String(input.handle || ""));
  const visitor = clip(String(input.visitor || ""), 80);
  const device = String(input.device || "").toLowerCase() === "mobile" ? "mobile" : "desktop";
  const resultCount = Math.max(0, Math.min(100000, Number(input.resultCount) || 0));

  if (kind === "search" && !query) return { ok: true as const, skipped: true };
  if (kind === "filter" && !combo) return { ok: true as const, skipped: true };
  if ((kind === "click" || kind === "visit") && !handle) {
    return { ok: true as const, skipped: true };
  }

  const lastPrune = lastAnalyticsPrune.get(shop.id) ?? 0;
  if (Date.now() - lastPrune > ANALYTICS_PRUNE_TTL_MS) {
    lastAnalyticsPrune.set(shop.id, Date.now());
    const plan = getShopPlan(shop);
    const days = retentionDaysForPlan(plan);
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    void prisma.analyticsEvent.deleteMany({
      where: { shopId: shop.id, createdAt: { lt: cutoff } },
    });
  }

  await prisma.analyticsEvent.create({
    data: {
      shopId: shop.id,
      kind,
      query,
      combo,
      handle,
      resultCount,
      visitor,
      device,
    },
  });
  return { ok: true as const };
}

type CountRow = { label: string; count: number };

function topCounts(
  rows: Array<{ key: string }>,
  limit = 8,
): CountRow[] {
  const map = new Map<string, number>();
  for (const row of rows) {
    const key = row.key.trim();
    if (!key) continue;
    map.set(key, (map.get(key) || 0) + 1);
  }
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([label, count]) => ({ label, count }));
}

async function loadAnalyticsDashboardUncached(
  shopId: string,
  range: AnalyticsRange,
  plan: string,
) {
  const days = retentionDaysForPlan(plan);
  const now = new Date();
  const retentionStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const start = new Date(
    Math.max(rangeStart(range, now).getTime(), retentionStart.getTime()),
  );

  const events = await prisma.analyticsEvent.findMany({
    where: { shopId, createdAt: { gte: start } },
    take: 4000,
    orderBy: { createdAt: "desc" },
    select: {
      kind: true,
      query: true,
      combo: true,
      handle: true,
      resultCount: true,
      visitor: true,
      device: true,
      createdAt: true,
    },
  });

  const searches = events.filter((e) => e.kind === "search");
  const filters = events.filter((e) => e.kind === "filter");
  const clicks = events.filter((e) => e.kind === "click" || e.kind === "visit");
  const zero = searches.filter((e) => e.resultCount === 0);
  const visitors = new Set(events.map((e) => e.visitor).filter(Boolean));
  const desktop = new Set(
    events.filter((e) => e.device === "desktop" && e.visitor).map((e) => e.visitor),
  );
  const mobile = new Set(
    events.filter((e) => e.device === "mobile" && e.visitor).map((e) => e.visitor),
  );

  const searchCount = searches.length;
  const noResultRate = searchCount
    ? Math.round((zero.length / searchCount) * 1000) / 10
    : 0;
  const ctr = searchCount
    ? Math.round((clicks.length / searchCount) * 1000) / 10
    : 0;

  const dayKey = (d: Date) => d.toISOString().slice(0, 10);
  const sessionMap = new Map<string, { filter: number; search: number }>();
  for (const event of events) {
    const key = dayKey(event.createdAt);
    const row = sessionMap.get(key) ?? { filter: 0, search: 0 };
    if (event.kind === "filter") row.filter += 1;
    if (event.kind === "search") row.search += 1;
    sessionMap.set(key, row);
  }
  const sessions = [...sessionMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, counts]) => ({ date, ...counts }));

  const comboParts = filters.flatMap((event) =>
    event.combo
      .split("|")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => ({ key: part })),
  );

  return {
    retentionDays: days,
    range,
    from: start.toISOString(),
    metrics: {
      uniqueVisitors: visitors.size,
      ctr,
      noResultRate,
      uniqueDesktop: desktop.size,
      uniqueMobile: mobile.size,
      searchCount,
      filterCount: filters.length,
    },
    sessions,
    topQueries: topCounts(searches.map((e) => ({ key: e.query }))),
    noResultQueries: topCounts(zero.map((e) => ({ key: e.query }))),
    topFilterValues: topCounts(comboParts),
    filterCombos: topCounts(filters.map((e) => ({ key: e.combo }))),
    mostVisited: topCounts(clicks.map((e) => ({ key: e.handle }))),
  };
}

type AnalyticsDashboard = Awaited<
  ReturnType<typeof loadAnalyticsDashboardUncached>
>;
const analyticsDashCache = createTtlCache<AnalyticsDashboard>(30_000);

export async function loadAnalyticsDashboard(
  shopId: string,
  range: AnalyticsRange,
  plan: string,
) {
  return analyticsDashCache.wrap(`${shopId}:${range}:${plan}`, () =>
    loadAnalyticsDashboardUncached(shopId, range, plan),
  );
}
