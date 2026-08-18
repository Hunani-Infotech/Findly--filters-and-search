export const SEARCH_FIELD_KEYS = [
  "title",
  "vendor",
  "productType",
  "tags",
  "sku",
  "options",
] as const;

export type SearchFieldKey = (typeof SEARCH_FIELD_KEYS)[number];

export const DEFAULT_SEARCH_FIELDS: SearchFieldKey[] = [
  "title",
  "vendor",
  "productType",
  "tags",
];

export const SEARCH_FIELD_LABELS: Record<SearchFieldKey, string> = {
  title: "Title",
  vendor: "Vendor",
  productType: "Product type",
  tags: "Tags",
  sku: "SKU",
  options: "Options",
};

/** Unique allowed keys, preserving merchant order. Empty array = no fields enabled. */
export function normalizeSearchFields(value: unknown): SearchFieldKey[] {
  if (!Array.isArray(value)) return [];
  const allowed = new Set<string>(SEARCH_FIELD_KEYS);
  const seen = new Set<string>();
  const next: SearchFieldKey[] = [];
  for (const item of value) {
    if (typeof item !== "string" || !allowed.has(item) || seen.has(item)) {
      continue;
    }
    seen.add(item);
    next.push(item as SearchFieldKey);
  }
  return next;
}

export const DEFAULT_APP_SETTINGS = {
  widgetPosition: "left" as const,
  accentColor: "#1c1917",
  showProductCounts: true,
  collapseByDefault: false,
  widgetShadow: true,
  widgetRadius: 12,
  widgetFontMode: "theme" as const,
  widgetFontFamily: "",
  widgetTitle: "Filter:",
  widgetTitleSize: 16,
  widgetTitleColor: "#1c1917",
  searchFields: [...DEFAULT_SEARCH_FIELDS] as SearchFieldKey[],
};

export const WIDGET_RADIUS_PRESETS = [
  { label: "None (0px)", value: 0 },
  { label: "Small (8px)", value: 8 },
  { label: "Default (12px)", value: 12 },
  { label: "Large (20px)", value: 20 },
] as const;

export const WIDGET_RADIUS_MIN = 0;
export const WIDGET_RADIUS_MAX = 40;

export function parseWidgetRadius(value: unknown): number {
  const radius = Number(value);
  if (!Number.isFinite(radius)) return DEFAULT_APP_SETTINGS.widgetRadius;
  return Math.round(
    Math.min(WIDGET_RADIUS_MAX, Math.max(WIDGET_RADIUS_MIN, radius)),
  );
}

export function isPresetRadius(value: number) {
  return WIDGET_RADIUS_PRESETS.some((item) => item.value === value);
}

export const WIDGET_FONT_MODES = ["theme", "heading", "body", "custom"] as const;

export type WidgetFontMode = (typeof WIDGET_FONT_MODES)[number];

export function parseWidgetFontMode(value: unknown): WidgetFontMode {
  return WIDGET_FONT_MODES.includes(value as WidgetFontMode)
    ? (value as WidgetFontMode)
    : "theme";
}

export function sanitizeFontFamily(value: unknown): string {
  if (typeof value !== "string") return "";
  const font = value.trim().slice(0, 120);
  if (!font) return "";
  if (/url\s*\(|expression|@import|[<>]|javascript:/i.test(font)) return "";
  if (!/^[a-zA-Z0-9\s"',._-]+$/.test(font)) return "";
  return font;
}

export const WIDGET_TITLE_SIZE_PRESETS = [
  { label: "Small (14px)", value: 14 },
  { label: "Default (16px)", value: 16 },
  { label: "Large (20px)", value: 20 },
] as const;

export const WIDGET_TITLE_SIZE_MIN = 12;
export const WIDGET_TITLE_SIZE_MAX = 32;

export function parseWidgetTitleSize(value: unknown): number {
  const size = Number(value);
  if (!Number.isFinite(size)) return DEFAULT_APP_SETTINGS.widgetTitleSize;
  return Math.round(
    Math.min(WIDGET_TITLE_SIZE_MAX, Math.max(WIDGET_TITLE_SIZE_MIN, size)),
  );
}

export function isPresetTitleSize(value: number) {
  return WIDGET_TITLE_SIZE_PRESETS.some((item) => item.value === value);
}

export function sanitizeWidgetTitle(value: unknown): string {
  if (typeof value !== "string") return DEFAULT_APP_SETTINGS.widgetTitle;
  return value.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim().slice(0, 40);
}

export function sanitizeWidgetTitleColor(value: unknown): string {
  if (typeof value !== "string") return DEFAULT_APP_SETTINGS.widgetTitleColor;
  const color = value.trim().slice(0, 64);
  if (!color) return DEFAULT_APP_SETTINGS.widgetTitleColor;
  if (
    /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(color) ||
    /^(rgb|rgba|hsl|hsla)\(\s*[\d.%+\-\s,/]+\)$/i.test(color) ||
    /^[a-zA-Z][a-zA-Z-]{1,30}$/.test(color)
  ) {
    return color;
  }
  return DEFAULT_APP_SETTINGS.widgetTitleColor;
}
