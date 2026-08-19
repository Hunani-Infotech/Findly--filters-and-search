export const REC_WIDGET_IDS = [
  "frequently-bought-together",
  "trending-products",
  "recently-purchased-products",
  "hand-picked-related-products",
  "most-added-products",
  "best-sellers",
  "recently-viewed-products",
  "most-viewed-products",
  "new-products",
] as const;

export type RecWidgetId = (typeof REC_WIDGET_IDS)[number];

export type RecsCounts = {
  mobile: number;
  tablet: number;
  desktop: number;
};

export type RecsConfig = {
  on: Record<string, boolean>;
  counts: RecsCounts;
  picks: Record<string, string[]>;
  related: Record<string, string[]>;
};

export const DEFAULT_RECS_COUNTS: RecsCounts = {
  mobile: 2,
  tablet: 3,
  desktop: 4,
};

export const DEFAULT_RECS: RecsConfig = {
  on: {},
  counts: DEFAULT_RECS_COUNTS,
  picks: {},
  related: {},
};

function clampCount(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(12, Math.max(1, Math.round(n)));
}

function parseHandle(raw: string): string {
  let value = raw.trim().toLowerCase();
  value = value.replace(/^https?:\/\/[^/]+\//i, "");
  value = value.replace(/^\/+/, "");
  value = value.replace(/^products\//, "");
  value = value.split(/[?#]/)[0] ?? "";
  value = value.replace(/\/+$/, "");
  if (!/^[a-z0-9][a-z0-9-]*$/.test(value)) return "";
  return value.slice(0, 100);
}

export function parseHandleList(raw: unknown, max = 40): string[] {
  const parts = Array.isArray(raw)
    ? raw
    : typeof raw === "string"
      ? raw.split(/[\n,]+/)
      : [];
  const seen = new Set<string>();
  const next: string[] = [];
  for (const part of parts) {
    if (typeof part !== "string") continue;
    const handle = parseHandle(part);
    if (!handle || seen.has(handle)) continue;
    seen.add(handle);
    next.push(handle);
    if (next.length >= max) break;
  }
  return next;
}

function parseHandleMap(raw: unknown): Record<string, string[]> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const source = parseHandle(key) || key.trim().toLowerCase();
    if (!source) continue;
    const list = parseHandleList(value);
    if (list.length) out[source] = list;
  }
  return out;
}

export function isRecWidgetId(value: string): value is RecWidgetId {
  return (REC_WIDGET_IDS as readonly string[]).includes(value);
}

export function parseRecsConfig(raw: unknown, recOnFallback?: unknown): RecsConfig {
  const o =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const on: Record<string, boolean> = {};
  const onRaw =
    o.on && typeof o.on === "object" && !Array.isArray(o.on)
      ? (o.on as Record<string, unknown>)
      : recOnFallback && typeof recOnFallback === "object" && !Array.isArray(recOnFallback)
        ? (recOnFallback as Record<string, unknown>)
        : {};
  for (const id of REC_WIDGET_IDS) {
    if (onRaw[id] === true) on[id] = true;
  }
  const countsRaw =
    o.counts && typeof o.counts === "object" && !Array.isArray(o.counts)
      ? (o.counts as Record<string, unknown>)
      : {};
  const picksRaw =
    o.picks && typeof o.picks === "object" && !Array.isArray(o.picks)
      ? (o.picks as Record<string, unknown>)
      : {};
  const picks: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(picksRaw)) {
    if (!isRecWidgetId(key) && key !== "home") continue;
    picks[key] = parseHandleList(value);
  }
  return {
    on,
    counts: {
      mobile: clampCount(countsRaw.mobile, DEFAULT_RECS_COUNTS.mobile),
      tablet: clampCount(countsRaw.tablet, DEFAULT_RECS_COUNTS.tablet),
      desktop: clampCount(countsRaw.desktop, DEFAULT_RECS_COUNTS.desktop),
    },
    picks,
    related: parseHandleMap(o.related),
  };
}

export function recLimitForWidth(counts: RecsCounts, width: number): number {
  if (width < 750) return counts.mobile;
  if (width < 990) return counts.tablet;
  return counts.desktop;
}
