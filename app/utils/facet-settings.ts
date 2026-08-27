import { SAMPLE_TEXT_MAX } from "../constants/limits";

export const FACET_VALUE_MODES = ["all", "manual", "prefix"] as const;
export type FacetValueMode = (typeof FACET_VALUE_MODES)[number];

export const FACET_VALUE_SORT_MODES = ["az", "za", "count", "manual"] as const;
export type FacetValueSortMode = (typeof FACET_VALUE_SORT_MODES)[number];

export const FACET_SHOW_MORE_MODES = ["scrollbar", "button", "all"] as const;
export type FacetShowMoreMode = (typeof FACET_SHOW_MORE_MODES)[number];

export const FACET_TEXT_TRANSFORMS = [
  "global",
  "none",
  "capitalize",
  "uppercase",
  "lowercase",
] as const;
export type FacetTextTransform = (typeof FACET_TEXT_TRANSFORMS)[number];

export type FacetSetting = {
  label?: string;
  valueMode?: FacetValueMode;
  prefix?: string;
  removePrefix?: boolean;
  selectedValues?: string[];
  urlHandle?: string;
  collectionTree?: boolean;
  collectionParents?: Record<string, string>;
  valueSortMode?: FacetValueSortMode;
  collapseByDefault?: boolean;
  enableValueSearch?: boolean;
  showMore?: FacetShowMoreMode;
  textTransform?: FacetTextTransform;
  autoRemovePrefixes?: string;
  tooltip?: string;
};

export type FacetSettingsMap = Record<string, FacetSetting>;

/** Reserved facetSettings key for tree-level meta (not a filter option). */
export const TREE_FACET_META_KEY = "__tree";

function asRecord(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  return raw as Record<string, unknown>;
}

function parseGidList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value.filter(
        (item): item is string => typeof item === "string" && item.length > 0,
      ),
    ),
  ];
}

export function parseExcludeCollectionGids(raw: unknown): string[] {
  const rec = asRecord(raw);
  if (!rec) return [];
  const tree = asRecord(rec[TREE_FACET_META_KEY]);
  if (!tree) return [];
  return parseGidList(tree.excludeCollectionGids);
}

export function parseAppliesToAllProducts(raw: unknown): boolean {
  const rec = asRecord(raw);
  const tree = rec ? asRecord(rec[TREE_FACET_META_KEY]) : null;
  return tree?.appliesToAllProducts === true;
}

/** `null` means this tree has never been synced with Settings metafields. */
export function parseKnownMetafieldKeys(raw: unknown): string[] | null {
  const rec = asRecord(raw);
  const tree = rec ? asRecord(rec[TREE_FACET_META_KEY]) : null;
  if (!tree || !("knownMetafieldKeys" in tree)) return null;
  return parseGidList(tree.knownMetafieldKeys);
}

function parseEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
): T | undefined {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : undefined;
}

/** Lowercase label; drop non-alphanumerics (spaces become nothing). */
export function defaultUrlHandle(label: string, key = ""): string {
  const fromLabel = label.toLowerCase().replace(/[^a-z0-9]+/g, "");
  if (fromLabel) return fromLabel;
  const fromKey = key.toLowerCase().replace(/[^a-z0-9]+/g, "");
  return fromKey || key;
}

export function parseFacetSettings(raw: unknown): FacetSettingsMap {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: FacetSettingsMap = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (key === TREE_FACET_META_KEY) continue;
    if (!key || !value || typeof value !== "object" || Array.isArray(value)) continue;
    const rec = value as Record<string, unknown>;
    const setting: FacetSetting = {};
    if (typeof rec.label === "string" && rec.label.trim()) {
      setting.label = rec.label.trim();
    }
    const valueMode = parseEnum(rec.valueMode, FACET_VALUE_MODES);
    if (valueMode) setting.valueMode = valueMode;
    if (typeof rec.prefix === "string") setting.prefix = rec.prefix;
    if (typeof rec.removePrefix === "boolean") setting.removePrefix = rec.removePrefix;
    if (Array.isArray(rec.selectedValues)) {
      setting.selectedValues = rec.selectedValues
        .filter((item): item is string => typeof item === "string" && item.length > 0)
        .slice(0, SAMPLE_TEXT_MAX);
    }
    if (typeof rec.urlHandle === "string" && rec.urlHandle.trim()) {
      setting.urlHandle = rec.urlHandle.trim();
    }
    if (typeof rec.collectionTree === "boolean") {
      setting.collectionTree = rec.collectionTree;
    }
    if (rec.collectionParents && typeof rec.collectionParents === "object" && !Array.isArray(rec.collectionParents)) {
      const parents: Record<string, string> = {};
      for (const [child, parent] of Object.entries(
        rec.collectionParents as Record<string, unknown>,
      )) {
        if (child && typeof parent === "string" && parent && parent !== child) {
          parents[child] = parent;
        }
      }
      if (Object.keys(parents).length) setting.collectionParents = parents;
    }
    const valueSortMode = parseEnum(rec.valueSortMode, FACET_VALUE_SORT_MODES);
    if (valueSortMode) setting.valueSortMode = valueSortMode;
    if (typeof rec.collapseByDefault === "boolean") {
      setting.collapseByDefault = rec.collapseByDefault;
    }
    if (typeof rec.enableValueSearch === "boolean") {
      setting.enableValueSearch = rec.enableValueSearch;
    }
    const showMore = parseEnum(rec.showMore, FACET_SHOW_MORE_MODES);
    if (showMore) setting.showMore = showMore;
    const textTransform = parseEnum(rec.textTransform, FACET_TEXT_TRANSFORMS);
    if (textTransform) setting.textTransform = textTransform;
    if (typeof rec.autoRemovePrefixes === "string") {
      setting.autoRemovePrefixes = rec.autoRemovePrefixes;
    }
    if (typeof rec.tooltip === "string") {
      setting.tooltip = rec.tooltip.slice(0, 150);
    }
    if (Object.keys(setting).length) out[key] = setting;
  }
  return out;
}

/** Keep tree-level JSON keys that are not per-option FacetSetting objects. */
export function facetSettingsWithTreeMeta(
  settings: FacetSettingsMap,
  raw: unknown,
): Record<string, unknown> {
  const base: Record<string, unknown> =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? { ...(raw as Record<string, unknown>) }
      : {};
  const previous = parseFacetSettings(raw);
  for (const key of Object.keys(previous)) {
    if (!(key in settings)) delete base[key];
  }
  return { ...base, ...settings };
}

export function withFilterTreeMeta(
  settings: FacetSettingsMap,
  meta: {
    excludeCollectionGids?: string[];
    appliesToAllProducts?: boolean;
    knownMetafieldKeys?: string[] | null;
  },
  raw?: unknown,
): Record<string, unknown> {
  const out = facetSettingsWithTreeMeta(settings, raw);
  const existingTree = asRecord(out[TREE_FACET_META_KEY]) || {};
  const nextTree: Record<string, unknown> = { ...existingTree };
  if (meta.excludeCollectionGids !== undefined) {
    nextTree.excludeCollectionGids = parseGidList(meta.excludeCollectionGids);
  }
  if (meta.appliesToAllProducts !== undefined) {
    nextTree.appliesToAllProducts = Boolean(meta.appliesToAllProducts);
  }
  if (meta.knownMetafieldKeys !== undefined && meta.knownMetafieldKeys !== null) {
    nextTree.knownMetafieldKeys = parseGidList(meta.knownMetafieldKeys);
  }
  out[TREE_FACET_META_KEY] = nextTree;
  return out;
}

export function applyFacetValueFilter(
  key: string,
  values: string[],
  settings: FacetSettingsMap,
): string[] {
  const setting = settings[key] || {};
  const mode = setting.valueMode || "all";
  if (mode === "manual") {
    const allowed = new Set(setting.selectedValues || []);
    if (!allowed.size) return values;
    return values.filter((value) => allowed.has(value));
  }
  if (mode === "prefix") {
    const prefix = setting.prefix || "";
    if (!prefix) return values;
    return values.filter((value) => value.startsWith(prefix));
  }
  return values;
}

function stripAutoPrefixes(value: string, raw: string | undefined): string {
  if (!raw) return value;
  const prefixes = raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
  for (const prefix of prefixes) {
    if (value.startsWith(prefix)) return value.slice(prefix.length);
  }
  return value;
}

export function applyFacetValueLabel(
  key: string,
  value: string,
  settings: FacetSettingsMap,
): string {
  const setting = settings[key] || {};
  if (setting.removePrefix && setting.prefix && value.startsWith(setting.prefix)) {
    return value.slice(setting.prefix.length);
  }
  return stripAutoPrefixes(value, setting.autoRemovePrefixes);
}
