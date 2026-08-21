export const WIDGET_I18N_KEYS = [
  "filter",
  "apply",
  "clear",
  "min",
  "max",
  "any",
  "in_stock",
  "out_of_stock",
  "loading",
  "error",
  "no_match",
  "disabled",
  "products",
  "and_up",
  "sort_manual",
  "sort_title_asc",
  "sort_title_desc",
  "sort_price_asc",
  "sort_price_desc",
  "sort_date_desc",
  "sort_date_asc",
  "sort_sale_pct_desc",
  "search_loading",
  "search_error",
  "search_empty",
  "search_empty_copy",
  "search_clear",
  "search_submit",
  "suggested",
  "did_you_mean",
  "load_more",
  "loading_more",
] as const;

export type WidgetI18nKey = (typeof WIDGET_I18N_KEYS)[number];

export const DEFAULT_WIDGET_I18N: Record<WidgetI18nKey, string> = {
  filter: "Filter:",
  apply: "Apply",
  clear: "Clear filters",
  min: "Min",
  max: "Max",
  any: "Any",
  in_stock: "In stock",
  out_of_stock: "Out of stock",
  loading: "Loading filters…",
  error: "Filters could not be loaded. Please try again.",
  no_match: "No matching products.",
  disabled: "Filters are not enabled for this collection.",
  products: "{n} products",
  and_up: "and up",
  sort_manual: "Featured",
  sort_title_asc: "Alphabetically, A-Z",
  sort_title_desc: "Alphabetically, Z-A",
  sort_price_asc: "Price, low to high",
  sort_price_desc: "Price, high to low",
  sort_date_desc: "Date, new to old",
  sort_date_asc: "Date, old to new",
  sort_sale_pct_desc: "% Sale off",
  search_loading: "Searching…",
  search_error: "Search could not be loaded. Please try again.",
  search_empty: "No products found",
  search_empty_copy: "Your search did not match any products.",
  search_clear: "Clear query",
  search_submit: "Search",
  suggested: "Suggested",
  did_you_mean: "Did you mean",
  load_more: "Load more",
  loading_more: "Loading more…",
};

export const WIDGET_I18N_LABELS: Record<WidgetI18nKey, string> = {
  filter: "Filter title",
  apply: "Apply",
  clear: "Clear filters",
  min: "Min",
  max: "Max",
  any: "Any",
  in_stock: "In stock",
  out_of_stock: "Out of stock",
  loading: "Loading filters",
  error: "Filters error",
  no_match: "No matching products",
  disabled: "Filters disabled",
  products: "Product count ({n} placeholder)",
  and_up: "Rating suffix (and up)",
  sort_manual: "Sort: Featured",
  sort_title_asc: "Sort: A-Z",
  sort_title_desc: "Sort: Z-A",
  sort_price_asc: "Sort: price low to high",
  sort_price_desc: "Sort: price high to low",
  sort_date_desc: "Sort: new to old",
  sort_date_asc: "Sort: old to new",
  sort_sale_pct_desc: "Sort: % Sale off",
  search_loading: "Searching",
  search_error: "Search error",
  search_empty: "No products found",
  search_empty_copy: "Empty search copy",
  search_clear: "Clear query",
  search_submit: "Search button",
  suggested: "Suggested heading",
  did_you_mean: "Did you mean",
  load_more: "Load more button",
  loading_more: "Loading more",
};

export type WidgetI18nMap = Record<string, Record<string, string>>;

export function parseWidgetI18nMap(raw: unknown): WidgetI18nMap {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: WidgetI18nMap = {};
  for (const [locale, strings] of Object.entries(raw as Record<string, unknown>)) {
    if (!locale.trim() || !strings || typeof strings !== "object" || Array.isArray(strings)) {
      continue;
    }
    const row: Record<string, string> = {};
    for (const [key, value] of Object.entries(strings as Record<string, unknown>)) {
      if (typeof value === "string") row[key] = value;
    }
    out[locale] = row;
  }
  return out;
}

/** Match Shopify locale (fr, fr-CA) to a merchant catalog code. */
export function matchWidgetLocale(
  requested: string | null | undefined,
  available: string[],
): string {
  const raw = String(requested || "").trim();
  const codes = available.filter(Boolean);
  if (!codes.length) return "en";
  if (!raw) {
    return codes.includes("en") ? "en" : codes[0]!;
  }
  const lower = raw.toLowerCase();
  const exact = codes.find((code) => code.toLowerCase() === lower);
  if (exact) return exact;
  const lang = lower.split(/[-_]/)[0] || lower;
  const prefix = codes.find((code) => code.toLowerCase() === lang);
  if (prefix) return prefix;
  const prefixDash = codes.find((code) =>
    code.toLowerCase().startsWith(`${lang}-`),
  );
  if (prefixDash) return prefixDash;
  return codes.includes("en") ? "en" : codes[0]!;
}

export function mergeWidgetChrome(
  overrides?: Record<string, string> | null,
): Record<WidgetI18nKey, string> {
  const merged = { ...DEFAULT_WIDGET_I18N };
  if (!overrides) return merged;
  for (const key of WIDGET_I18N_KEYS) {
    const value = overrides[key];
    if (typeof value === "string" && value.trim()) merged[key] = value;
  }
  return merged;
}

export function resolveWidgetChrome(
  i18n: WidgetI18nMap,
  requestedLocale: string | null | undefined,
): { locale: string; chrome: Record<WidgetI18nKey, string> } {
  const available = Object.keys(i18n);
  if (!available.includes("en")) available.unshift("en");
  const locale = matchWidgetLocale(requestedLocale, available);
  return { locale, chrome: mergeWidgetChrome(i18n[locale]) };
}
