import type { FilterConfig, MetafieldFilterType, MetafieldMapping } from "@prisma/client";
import { parseKnownMetafieldKeys } from "./facet-settings";
import { mappingAppliesToFilter } from "./metafield-applies";
import {
  COLLECTION_FACET_KEY,
  collectionFacetCounts,
  collectionStorefrontPath,
  productInSelectedCollections,
  type ShopCollection,
} from "./collection-facet";
import {
  SIZE_FACET_MATCH_RATIO,
  SIZE_NUMERIC_RANK_BASE,
  VALUE_SORT_MANUAL_MAX,
} from "../constants/limits";

export type FacetSource =
  | "vendor"
  | "productType"
  | "tag"
  | "price"
  | "sale"
  | "rating"
  | "availability"
  | "location"
  | "collection"
  | "metafield"
  | "option";

export const FACET_DISPLAY_TYPES = [
  "list",
  "dropdown",
  "checkbox",
  "swatch",
  "swatch-text",
  "slider",
  "radio",
  "box",
  "collection",
] as const;

export type FacetDisplayType = (typeof FACET_DISPLAY_TYPES)[number];

export const FACET_MATCH_MODES = ["or", "and"] as const;

export type FacetMatchMode = (typeof FACET_MATCH_MODES)[number];

export const FACET_DISPLAY_TYPE_LABELS: Record<FacetDisplayType, string> = {
  list: "List",
  dropdown: "Dropdown",
  checkbox: "Checkbox",
  swatch: "Swatch",
  "swatch-text": "Swatch-text",
  slider: "Slider",
  radio: "Radio",
  box: "Box",
  collection: "Collection redirect",
};

export type FacetDef = {
  key: string;
  source: FacetSource;
  label: string;
  type: "checkbox" | "range" | "boolean";
  metafieldNamespace?: string;
  metafieldKey?: string;
  metafieldOwner?: "PRODUCT" | "VARIANT";
  optionName?: string;
  optionNames?: string[];
  enabled: boolean;
  displayType?: FacetDisplayType;
  matchMode?: FacetMatchMode;
};

export const UNSPECIFIED_VALUE = "__unspecified__";
export const UNSPECIFIED_LABEL = "Unspecified";
export const BOOLEAN_TRUE = "true";
export const BOOLEAN_FALSE = "false";
export const BOOLEAN_TRUE_LABEL = "Yes";
export const BOOLEAN_FALSE_LABEL = "No";

/** Shopify/Judge.me standard rating plus documented Loox/Stamped averages. */
export const RATING_METAFIELD_PATHS = [
  "reviews.rating",
  "loox.avg_rating",
  "stamped.reviews_average",
  "app--2519111--reviews.review_average_rating",
] as const;

export const RATING_STAR_VALUES = ["5", "4", "3", "2", "1"] as const;

export function parseReviewRating(raw: string | undefined | null): number | null {
  if (raw == null || raw === "") return null;
  const trimmed = String(raw).trim();
  if (!trimmed || trimmed.startsWith("<")) return null;
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed) as {
        value?: unknown;
        rating?: unknown;
      };
      const inner = parsed.value ?? parsed.rating;
      const nested =
        inner != null && typeof inner === "object" && inner && "value" in inner
          ? Number((inner as { value: unknown }).value)
          : Number(inner);
      if (Number.isFinite(nested)) return nested;
    } catch {
      return null;
    }
  }
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

export function productReviewRating(product: {
  metafields?: Record<string, string> | null;
}): number | null {
  const bag = product.metafields || {};
  for (const path of RATING_METAFIELD_PATHS) {
    const rating = parseReviewRating(bag[path]);
    if (rating != null) return rating;
  }
  return null;
}

export function ratingStarLabel(stars: string | number): string {
  const n = Math.max(0, Math.min(5, Math.round(Number(stars) || 0)));
  return `${"★".repeat(n)}${"☆".repeat(5 - n)}`;
}

/** Canonical Shopify boolean strings, plus common 1/0/yes/no variants. */
export function normalizeBooleanMetafieldValue(
  raw: string | undefined | null,
): typeof BOOLEAN_TRUE | typeof BOOLEAN_FALSE | null {
  if (raw == null) return null;
  const trimmed = String(raw).trim().toLowerCase();
  if (trimmed === "true" || trimmed === "1" || trimmed === "yes") {
    return BOOLEAN_TRUE;
  }
  if (trimmed === "false" || trimmed === "0" || trimmed === "no") {
    return BOOLEAN_FALSE;
  }
  return null;
}

export const DEFAULT_DISPLAY_ORDER = [
  "availability",
  "location",
  "price",
  "sale",
  "rating",
  "vendor",
  "productType",
  "tags",
  "options",
] as const;

export function optionFacetKey(optionName: string) {
  return `opt_${optionName.replace(/[^\w]+/g, "_")}`;
}

export function parseBound(value: string | undefined | null) {
  if (value == null || value === "") return Number.NaN;
  return Number(value);
}

export function metafieldListValues(raw: string | undefined | null): string[] {
  if (!raw) return [];
  const trimmed = raw.trim();
  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item)).filter(Boolean);
      }
    } catch {
      // Keep the raw string when JSON is malformed.
    }
  }
  return [raw];
}

export function metafieldFacetKey(
  namespace: string,
  key: string,
  ownerType: "PRODUCT" | "VARIANT" = "PRODUCT",
) {
  return ownerType === "VARIANT"
    ? `mf_v_${namespace}_${key}`
    : `mf_${namespace}_${key}`;
}

export function mappedFacetsForAdmin(
  mappings: Array<{
    enabled?: boolean;
    appliesTo?: unknown;
    namespace: string;
    key: string;
    displayLabel: string;
    filterType: MetafieldFilterType;
    ownerType?: string | null;
    sortOrder?: number;
  }>,
) {
  return mappings
    .filter((mapping) => mappingAppliesToFilter(mapping))
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .map((mapping) => {
      const ownerType = mapping.ownerType === "VARIANT" ? "VARIANT" as const : "PRODUCT" as const;
      return {
        key: metafieldFacetKey(mapping.namespace, mapping.key, ownerType),
        label: mapping.displayLabel || mapping.key,
        filterType: mapping.filterType,
        namespace: mapping.namespace,
        metafieldKey: mapping.key,
        ownerType,
      };
    });
}

export function metafieldValuesForProduct(
  product: {
    metafields?: Record<string, string>;
    variantMetafields?: Record<string, string>;
  },
  facet: Pick<
    FacetDef,
    "metafieldNamespace" | "metafieldKey" | "metafieldOwner"
  >,
) {
  const path = `${facet.metafieldNamespace}.${facet.metafieldKey}`;
  const bag =
    facet.metafieldOwner === "VARIANT"
      ? product.variantMetafields
      : product.metafields;
  return metafieldListValues(bag?.[path]);
}

export function normalizeDisplayOrder(order?: string[] | null) {
  const next = order?.length ? [...order] : [...DEFAULT_DISPLAY_ORDER];
  const hasExplicitOptions = next.some((key) => key.startsWith("opt_"));
  for (const key of DEFAULT_DISPLAY_ORDER) {
    if (key === "options" && hasExplicitOptions) continue;
    if (!next.includes(key) && !next.includes(key === "tags" ? "tag" : key)) {
      next.push(key);
    }
  }
  return next;
}

export function parseDisplayTypes(raw: unknown): Record<string, FacetDisplayType> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const allowed = new Set<string>(FACET_DISPLAY_TYPES);
  const out: Record<string, FacetDisplayType> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value !== "string" || !allowed.has(value)) continue;
    out[key] = coerceDisplayType(key, value as FacetDisplayType);
  }
  return out;
}

export function parseMatchModes(raw: unknown): Record<string, FacetMatchMode> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, FacetMatchMode> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (value === "and" || value === "or") out[key] = value;
  }
  return out;
}

export function matchModeForFacet(
  facet: Pick<FacetDef, "key" | "source">,
  map: Record<string, FacetMatchMode>,
): FacetMatchMode {
  if (facet.source === "tag") {
    if (map.tag === "and" || map.tags === "and") return "and";
    return "or";
  }
  if (facet.source === "location") {
    if (map.location === "and") return "and";
    return "or";
  }
  if (facet.source === "option") {
    if (map[facet.key] === "and" || map.options === "and") return "and";
    return "or";
  }
  if (facet.source === "metafield") {
    return map[facet.key] === "and" ? "and" : "or";
  }
  if (facet.source === "collection") {
    return map[facet.key] === "and" ? "and" : "or";
  }
  return "or";
}

function selectedMatchList(
  selected: string[],
  actual: string[],
  mode: FacetMatchMode = "or",
) {
  if (!selected.length) return true;
  if (mode === "and") return selected.every((value) => actual.includes(value));
  return selected.some((value) => actual.includes(value));
}

function isRangeDisplayKey(key: string, kind?: string) {
  if (key === "price" || key === "sale") return true;
  const normalized = String(kind || "").toUpperCase();
  return normalized === "RANGE";
}

function coerceDisplayType(
  key: string,
  value: FacetDisplayType,
  kind?: string,
): FacetDisplayType {
  if (isRangeDisplayKey(key, kind) || key === "price" || key === "sale") return "slider";
  if (value === "slider" && !key.startsWith("mf_")) return "checkbox";
  return value;
}

export function displayTypeChoicesForKey(
  key: string,
  kind?: string,
): FacetDisplayType[] {
  if (isRangeDisplayKey(key, kind)) return ["slider"];
  if (key === "rating") return ["checkbox"];
  if (key === COLLECTION_FACET_KEY) {
    return ["checkbox", "list", "dropdown", "radio", "box", "collection"];
  }
  if (
    key === "options" ||
    key.startsWith("opt_") ||
    key === "tags" ||
    key === "tag" ||
    key.startsWith("mf_")
  ) {
    return ["list", "dropdown", "checkbox", "swatch", "swatch-text", "radio", "box"];
  }
  return ["list", "dropdown", "checkbox", "radio", "box"];
}

function isApparelSizeFacet(facet: Pick<FacetDef, "key" | "label">): boolean {
  const text = `${facet.label || ""} ${facet.key || ""}`;
  return /\bsizes?\b/i.test(text) && !/length|width|weight/i.test(text);
}

export function displayTypeForFacet(
  facet: Pick<FacetDef, "key" | "source" | "label" | "type">,
  map: Record<string, FacetDisplayType>,
): FacetDisplayType {
  if (facet.type === "range" || facet.source === "price" || facet.source === "sale") {
    return "slider";
  }
  if (facet.source === "rating") return "checkbox";
  if (facet.source === "collection") {
    return map[facet.key] || "checkbox";
  }
  if (facet.type === "boolean") return map[facet.key] || "checkbox";
  const stored =
    map[facet.key] ||
    (facet.source === "option" ? map.options : undefined) ||
    (facet.source === "tag" ? map.tags || map.tag : undefined);
  if (stored === "slider") return "checkbox";
  if (stored === "swatch" && facet.source === "option") {
    if (isApparelSizeFacet(facet)) return "box";
    if (/length|width|weight/i.test(String(facet.label || ""))) return "checkbox";
    return "swatch";
  }
  if (stored) return stored;
  if (/colou?r|hue|shade/i.test(facet.label) || /colou?r|hue|shade/i.test(facet.key)) {
    return "swatch";
  }
  if (isApparelSizeFacet(facet)) return "box";
  return "checkbox";
}

function configDisplayTypes(config: FilterConfig | null) {
  return parseDisplayTypes(
    config && "displayTypes" in config ? config.displayTypes : {},
  );
}

function configMatchModes(config: FilterConfig | null) {
  return parseMatchModes(
    config && "matchModes" in config ? config.matchModes : {},
  );
}

export const VALUE_SORT_MODES = ["auto", "alpha", "manual"] as const;
export type ValueSortMode = (typeof VALUE_SORT_MODES)[number];

export type FacetValueSort = {
  mode: ValueSortMode;
  values?: string[];
};

export type ValueSortMap = Record<string, FacetValueSort>;

export const VALUE_SORT_MODE_LABELS: Record<ValueSortMode, string> = {
  auto: "Automatic (A–Z, size order for Size)",
  alpha: "Alphabetical (A–Z)",
  manual: "Manual",
};

export function parseValueSort(raw: unknown): ValueSortMap {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const allowed = new Set<string>(VALUE_SORT_MODES);
  const out: ValueSortMap = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!key || typeof key !== "string") continue;
    if (typeof value === "string" && allowed.has(value)) {
      out[key] = { mode: value as ValueSortMode };
      continue;
    }
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const rec = value as { mode?: unknown; values?: unknown };
    if (typeof rec.mode !== "string" || !allowed.has(rec.mode)) continue;
    const values = Array.isArray(rec.values)
      ? rec.values
          .filter((item): item is string => typeof item === "string" && item.length > 0)
          .slice(0, VALUE_SORT_MANUAL_MAX)
      : [];
    out[key] = {
      mode: rec.mode as ValueSortMode,
      ...(rec.mode === "manual" && values.length ? { values } : {}),
    };
  }
  return out;
}

export function valueSortForFacet(
  facet: Pick<FacetDef, "key" | "source">,
  map: ValueSortMap,
): FacetValueSort {
  if (map[facet.key]) return map[facet.key];
  if (facet.source === "tag") return map.tags || map.tag || { mode: "auto" };
  return { mode: "auto" };
}

/** Size rank: XS/S/M/L then numbered sizes. Unranked values sort after. */
export function sizeRank(raw: string): number | null {
  const value = String(raw || "").trim().toLowerCase();
  if (!value) return null;
  const numeric = value.match(/^(\d+(\.\d+)?)/);
  if (numeric) return SIZE_NUMERIC_RANK_BASE + Number(numeric[1]);
  const small = value.match(/^(x*)s$/);
  if (small) return 40 - small[1].length;
  if (value === "m") return 50;
  const large = value.match(/^(x*)l$/);
  if (large) return 60 + large[1].length;
  const numbered = value.match(/^(\d+)\s*x?l$/);
  if (numbered) return 60 + Number(numbered[1]);
  return null;
}

export function isSizeLikeFacet(
  facet: Pick<FacetDef, "key" | "label">,
  values: string[],
): boolean {
  if (/size|length|width/i.test(facet.label) || /size|length|width/i.test(facet.key)) {
    return true;
  }
  if (!values.length) return false;
  const sized = values.filter((value) => sizeRank(value) != null).length;
  return sized / values.length >= SIZE_FACET_MATCH_RATIO;
}

export function mergeManualValueOrder(saved: string[] | undefined, catalog: string[]): string[] {
  const allowed = new Set(catalog);
  const seen = new Set<string>();
  const next: string[] = [];
  for (const value of saved ?? []) {
    if (!allowed.has(value) || seen.has(value)) continue;
    next.push(value);
    seen.add(value);
  }
  const rest = catalog.filter((value) => !seen.has(value));
  rest.sort((a, b) => {
    if (a === UNSPECIFIED_VALUE) return 1;
    if (b === UNSPECIFIED_VALUE) return -1;
    return a.localeCompare(b);
  });
  return [...next, ...rest];
}

function compareListedValues(
  a: string,
  b: string,
  facet: Pick<FacetDef, "key" | "label" | "source" | "type">,
  sort: FacetValueSort,
): number {
  if (facet.source === "availability") {
    const order = { in_stock: 0, out_of_stock: 1 } as Record<string, number>;
    return (order[a] ?? 9) - (order[b] ?? 9);
  }
  if (facet.type === "boolean") {
    const order = { [BOOLEAN_TRUE]: 0, [BOOLEAN_FALSE]: 1 } as Record<string, number>;
    return (order[a] ?? 9) - (order[b] ?? 9);
  }
  if (a === UNSPECIFIED_VALUE) return 1;
  if (b === UNSPECIFIED_VALUE) return -1;

  if (sort.mode === "manual" && sort.values?.length) {
    const index = new Map(sort.values.map((value, i) => [value, i]));
    const ia = index.has(a) ? (index.get(a) as number) : 10_000;
    const ib = index.has(b) ? (index.get(b) as number) : 10_000;
    if (ia !== ib) return ia - ib;
    return a.localeCompare(b);
  }

  if (sort.mode === "alpha" || sort.mode === "manual") {
    return a.localeCompare(b);
  }

  const values = [a, b];
  if (isSizeLikeFacet(facet, values) || isSizeLikeFacet(facet, sort.values ?? [])) {
    const ar = sizeRank(a);
    const br = sizeRank(b);
    if (ar != null && br != null) return ar - br;
    if (ar != null) return -1;
    if (br != null) return 1;
  }
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

export function facetsFromConfig(
  config: FilterConfig | null,
  mappings: MetafieldMapping[] = [],
): FacetDef[] {
  const order = normalizeDisplayOrder(config?.displayOrder);
  const displayTypes = configDisplayTypes(config);
  const matchModes = configMatchModes(config);

  const builtIns: Record<string, FacetDef> = {
    availability: {
      key: "availability",
      source: "availability",
      label: "Availability",
      type: "checkbox",
      enabled: config?.enableAvailability ?? true,
      displayType: displayTypeForFacet(
        { key: "availability", source: "availability", label: "Availability", type: "checkbox" },
        displayTypes,
      ),
    },
    price: {
      key: "price",
      source: "price",
      label: "Price",
      type: "range",
      enabled: config?.enablePrice ?? true,
      displayType: "slider",
    },
    sale: {
      key: "sale",
      source: "sale",
      label: "% Sale off",
      type: "range",
      enabled: config?.enableSale ?? false,
      displayType: "slider",
    },
    rating: {
      key: "rating",
      source: "rating",
      label: "Rating",
      type: "checkbox",
      enabled: Boolean(config?.enableRating),
      displayType: "checkbox",
    },
    location: {
      key: "location",
      source: "location",
      label: "Location",
      type: "checkbox",
      enabled: Boolean(config?.enableLocation),
      displayType: displayTypeForFacet(
        { key: "location", source: "location", label: "Location", type: "checkbox" },
        displayTypes,
      ),
      matchMode: matchModeForFacet({ key: "location", source: "location" }, matchModes),
    },
    collection: {
      key: COLLECTION_FACET_KEY,
      source: "collection",
      label: "Collection",
      type: "checkbox",
      enabled: order.includes(COLLECTION_FACET_KEY),
      displayType: displayTypeForFacet(
        {
          key: COLLECTION_FACET_KEY,
          source: "collection",
          label: "Collection",
          type: "checkbox",
        },
        displayTypes,
      ),
      matchMode: matchModeForFacet(
        { key: COLLECTION_FACET_KEY, source: "collection" },
        matchModes,
      ),
    },
    vendor: {
      key: "vendor",
      source: "vendor",
      label: "Vendor",
      type: "checkbox",
      enabled: config?.enableVendor ?? true,
      displayType: displayTypeForFacet(
        { key: "vendor", source: "vendor", label: "Vendor", type: "checkbox" },
        displayTypes,
      ),
    },
    productType: {
      key: "productType",
      source: "productType",
      label: "Product type",
      type: "checkbox",
      enabled: config?.enableProductType ?? true,
      displayType: displayTypeForFacet(
        { key: "productType", source: "productType", label: "Product type", type: "checkbox" },
        displayTypes,
      ),
    },
    tags: {
      key: "tag",
      source: "tag",
      label: "Tags",
      type: "checkbox",
      enabled: config?.enableTags ?? true,
      displayType: displayTypeForFacet(
        { key: "tag", source: "tag", label: "Tags", type: "checkbox" },
        displayTypes,
      ),
      matchMode: matchModeForFacet({ key: "tag", source: "tag" }, matchModes),
    },
    options: {
      key: "options",
      source: "option",
      label: "Options",
      type: "checkbox",
      enabled: config?.enableOptions ?? true,
      displayType: displayTypeForFacet(
        { key: "options", source: "option", label: "Options", type: "checkbox" },
        displayTypes,
      ),
      matchMode: matchModeForFacet(
        { key: "options", source: "option" },
        matchModes,
      ),
    },
  };

  const metafieldFacets = mappings
    .filter((mapping) => mappingAppliesToFilter(mapping))
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((mapping) => {
      const ownerType =
        mapping.ownerType === "VARIANT" ? "VARIANT" : "PRODUCT";
      const key = metafieldFacetKey(
        mapping.namespace,
        mapping.key,
        ownerType,
      );
      const type = metafieldTypeToFacetType(mapping.filterType);
      return {
        key,
        source: "metafield" as const,
        label: mapping.displayLabel,
        type,
        metafieldNamespace: mapping.namespace,
        metafieldKey: mapping.key,
        metafieldOwner: ownerType as "PRODUCT" | "VARIANT",
        enabled: true,
        displayType: displayTypeForFacet(
          { key, source: "metafield", label: mapping.displayLabel, type },
          displayTypes,
        ),
        matchMode: matchModeForFacet({ key, source: "metafield" }, matchModes),
      };
    });
  const metafieldByKey = new Map(metafieldFacets.map((facet) => [facet.key, facet]));

  const ordered: FacetDef[] = [];
  for (const key of order) {
    if (key.startsWith("opt_")) {
      if (ordered.some((item) => item.key === key)) continue;
      const label = key.replace(/^opt_/, "").replace(/_/g, " ");
      ordered.push({
        key,
        source: "option",
        label,
        type: "checkbox",
        enabled: config?.enableOptions ?? true,
        optionName: label,
        displayType: displayTypeForFacet(
          { key, source: "option", label, type: "checkbox" },
          displayTypes,
        ),
        matchMode: matchModeForFacet({ key, source: "option" }, matchModes),
      });
      continue;
    }
    const mapped = metafieldByKey.get(key);
    if (mapped) {
      if (!ordered.some((item) => item.key === mapped.key)) ordered.push(mapped);
      continue;
    }
    const facet = builtIns[key] ?? builtIns[key === "tag" ? "tags" : key];
    if (facet && !ordered.some((item) => item.key === facet.key)) {
      ordered.push(facet);
    }
  }

  for (const facet of Object.values(builtIns)) {
    if (
      facet.key === "options" &&
      ordered.some((item) => item.key.startsWith("opt_"))
    ) {
      continue;
    }
    if (!ordered.some((item) => item.key === facet.key)) ordered.push(facet);
  }

  const metafieldsManaged = parseKnownMetafieldKeys(config?.facetSettings) !== null;
  if (!metafieldsManaged) {
    for (const facet of metafieldFacets) {
      if (!ordered.some((item) => item.key === facet.key)) ordered.push(facet);
    }
  }

  return ordered;
}

function metafieldTypeToFacetType(
  filterType: MetafieldFilterType,
): FacetDef["type"] {
  if (filterType === "RANGE") return "range";
  if (filterType === "BOOLEAN") return "boolean";
  return "checkbox";
}

export type VariantImageEntry = {
  options: Record<string, string>;
  imageUrl: string;
};

export type ProductFacetRow = {
  productGid: string;
  handle: string;
  title: string;
  vendor: string;
  productType: string;
  tags: string[];
  options: Record<string, string[]>;
  priceMin: number;
  priceMax: number;
  compareAtMin?: number | null;
  compareAtMax?: number | null;
  salePct?: number;
  available: boolean;
  inventoryLocations?: string[];
  status: string;
  imageUrl: string | null;
  variantImages?: VariantImageEntry[];
  variants?: Array<{
    id: string;
    sku: string;
    title: string;
    options: Record<string, string>;
    imageUrl: string;
    available: boolean;
    price: number;
  }>;
  variantGid?: string;
  metafields: Record<string, string>;
  variantMetafields?: Record<string, string>;
  publishedAt?: Date | null;
  sortPosition?: number;
  collectionGids?: string[];
};

export type SelectedFilters = Record<string, string[]>;

const SIZE_NAME = /^(xxs|xs|s|m|l|xl|xxl|xxxl|2xl|3xl|4xl|size|sizes)$/i;
const COLOR_NAME = /^(colou?rs?|hue|shade)$/i;

export function canonicalOptionLabel(name: string) {
  const trimmed = name.trim();
  if (SIZE_NAME.test(trimmed)) return "Size";
  if (COLOR_NAME.test(trimmed)) return "Color";
  return trimmed;
}

export function parseVariantImages(raw: unknown): VariantImageEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: VariantImageEntry[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const rec = item as { options?: unknown; imageUrl?: unknown };
    if (typeof rec.imageUrl !== "string" || !rec.imageUrl) continue;
    const options: Record<string, string> = {};
    if (rec.options && typeof rec.options === "object" && !Array.isArray(rec.options)) {
      for (const [key, value] of Object.entries(
        rec.options as Record<string, unknown>,
      )) {
        if (typeof value === "string" && value) options[key] = value;
      }
    }
    if (!Object.keys(options).length) continue;
    out.push({ options, imageUrl: rec.imageUrl });
  }
  return out;
}

function variantOptionValue(
  options: Record<string, string>,
  name: string,
): string | undefined {
  if (options[name]) return options[name];
  const canon = canonicalOptionLabel(name);
  for (const [key, value] of Object.entries(options)) {
    if (canonicalOptionLabel(key) === canon) return value;
  }
  return undefined;
}

export function selectedOptionFilterGroups(
  facets: FacetDef[],
  selected: SelectedFilters,
): Array<{ names: string[]; values: string[] }> {
  const groups: Array<{ names: string[]; values: string[] }> = [];
  for (const facet of facets) {
    if (facet.source !== "option" || !facet.enabled) continue;
    const values = selected[facet.key];
    if (!values?.length) continue;
    const names = [
      ...(facet.optionNames ?? []),
      facet.optionName,
      facet.label,
    ].filter((name): name is string => Boolean(name));
    groups.push({ names, values });
  }
  return groups;
}

export function matchingVariantImageUrl(
  variants: VariantImageEntry[],
  optionGroups: Array<{ names: string[]; values: string[] }>,
): string | null {
  if (!optionGroups.length || !variants.length) return null;
  let best: { score: number; url: string } | null = null;
  for (const variant of variants) {
    let score = 0;
    let conflict = false;
    for (const group of optionGroups) {
      let actual: string | undefined;
      for (const name of group.names) {
        actual = variantOptionValue(variant.options, name);
        if (actual) break;
      }
      if (!actual) continue;
      if (group.values.includes(actual)) score += 1;
      else conflict = true;
    }
    if (conflict || score === 0) continue;
    if (!best || score > best.score) best = { score, url: variant.imageUrl };
  }
  return best?.url ?? null;
}

function isUselessOption(name: string, values: string[]) {
  if (name.toLowerCase() === "title") return true;
  const meaningful = values.filter(
    (value) => value && value !== "Default Title",
  );
  return meaningful.length === 0;
}

export function optionFacetsFromProducts(
  products: Array<{ options?: Record<string, string[]> | null }>,
  template?: Pick<FacetDef, "displayType" | "matchMode">,
  displayTypes: Record<string, FacetDisplayType> = {},
): FacetDef[] {
  const byLabel = new Map<
    string,
    { names: Set<string>; values: Set<string> }
  >();
  for (const product of products) {
    for (const [name, values] of Object.entries(product.options || {})) {
      if (!name || isUselessOption(name, values || [])) continue;
      const label = canonicalOptionLabel(name);
      const group = byLabel.get(label) ?? {
        names: new Set<string>(),
        values: new Set<string>(),
      };
      group.names.add(name);
      for (const value of values || []) {
        if (value) group.values.add(value);
      }
      byLabel.set(label, group);
    }
  }

  return [...byLabel.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([label, group]) => {
      const names = [...group.names].sort();
      const key = optionFacetKey(label);
      return {
        key,
        source: "option" as const,
        label,
        type: "checkbox" as const,
        enabled: true,
        optionName: names[0],
        optionNames: names,
        displayType: displayTypeForFacet(
          { key, source: "option", label, type: "checkbox" },
          {
            ...displayTypes,
            ...(template?.displayType ? { options: template.displayType } : {}),
          },
        ),
        matchMode: matchModeForFacet(
          { key, source: "option" },
          template?.matchMode === "and" ? { options: "and" } : {},
        ),
      };
    });
}

export function catalogOptionRows(
  products: Array<{ options?: Record<string, string[]> | null }>,
): Array<{ key: string; label: string }> {
  return optionFacetsFromProducts(products).map((facet) => ({
    key: facet.key,
    label: facet.label,
  }));
}

function optionValuesFor(
  product: ProductFacetRow,
  facet: FacetDef,
): string[] {
  const names =
    facet.optionNames?.length
      ? facet.optionNames
      : facet.optionName
        ? [facet.optionName]
        : [];
  const values: string[] = [];
  for (const name of names) {
    for (const value of product.options?.[name] || []) {
      if (value) values.push(value);
    }
  }
  return values;
}

export function expandFacetsWithOptions(
  facets: FacetDef[],
  products: ProductFacetRow[],
): FacetDef[] {
  const placeholder = facets.find(
    (facet) => facet.key === "options" || (facet.source === "option" && !facet.optionName),
  );
  const explicit = facets.filter(
    (facet) => facet.key.startsWith("opt_") && facet.enabled,
  );
  const displayTypes: Record<string, FacetDisplayType> = {};
  for (const facet of facets) {
    if (facet.displayType) displayTypes[facet.key] = facet.displayType;
  }
  const catalog = optionFacetsFromProducts(products, placeholder, displayTypes);
  const byKey = new Map(catalog.map((facet) => [facet.key, facet]));

  let selectedOptions: FacetDef[] = [];
  if (explicit.length) {
    for (const facet of explicit) {
      const fromCatalog = byKey.get(facet.key);
      if (!fromCatalog) continue;
      selectedOptions.push({
        ...fromCatalog,
        displayType: facet.displayType || fromCatalog.displayType,
        matchMode: facet.matchMode || fromCatalog.matchMode,
        enabled: true,
      });
    }
  } else if (placeholder?.enabled) {
    selectedOptions = catalog;
  }

  const result: FacetDef[] = [];
  let inserted = false;
  for (const facet of facets) {
    const isOptionSlot =
      facet.key === "options" ||
      facet.key.startsWith("opt_") ||
      (facet.source === "option" && !facet.optionName);
    if (isOptionSlot) {
      if (!inserted) {
        result.push(...selectedOptions);
        inserted = true;
      }
      continue;
    }
    result.push(facet);
  }
  if (!inserted) result.push(...selectedOptions);
  return result;
}

function matchesUnspecified(selected: string[], actual: string) {
  const normalized = actual || UNSPECIFIED_VALUE;
  return selected.includes(normalized) || (actual === "" && selected.includes(UNSPECIFIED_VALUE));
}

export function productMatchesFilters(
  product: ProductFacetRow,
  facets: FacetDef[],
  selected: SelectedFilters,
) {
  for (const facet of facets.filter((item) => item.enabled)) {
    const values = selected[facet.key];
    if (!values?.length) continue;

    switch (facet.source) {
      case "vendor":
        if (!matchesUnspecified(values, product.vendor)) return false;
        break;
      case "productType":
        if (!matchesUnspecified(values, product.productType)) return false;
        break;
      case "tag":
        if (
          !selectedMatchList(
            values,
            product.tags,
            facet.matchMode ?? "or",
          )
        ) {
          return false;
        }
        break;
      case "availability": {
        const wantIn = values.includes("in_stock");
        const wantOut = values.includes("out_of_stock");
        if (wantIn && wantOut) break;
        if (wantIn && !product.available) return false;
        if (wantOut && product.available) return false;
        break;
      }
      case "location":
        if (
          !selectedMatchList(
            values,
            product.inventoryLocations ?? [],
            facet.matchMode ?? "or",
          )
        ) {
          return false;
        }
        break;
      case "price": {
        const min = parseBound(values[0]);
        const max = parseBound(values[1]);
        if (Number.isFinite(min) && product.priceMax < min) return false;
        if (Number.isFinite(max) && product.priceMin > max) return false;
        break;
      }
      case "sale": {
        const min = parseBound(values[0]);
        const max = parseBound(values[1]);
        const pct = Number(product.salePct ?? 0);
        if (Number.isFinite(min) && pct < min) return false;
        if (Number.isFinite(max) && pct > max) return false;
        break;
      }
      case "rating": {
        const rating = productReviewRating(product);
        if (rating == null) return false;
        const thresholds = values
          .map((value) => Number(value))
          .filter((n) => Number.isFinite(n));
        if (!thresholds.length) break;
        if (!thresholds.some((n) => rating >= n)) return false;
        break;
      }
      case "collection": {
        if (
          !productInSelectedCollections(
            product.collectionGids,
            values,
            facet.matchMode ?? "or",
          )
        ) {
          return false;
        }
        break;
      }
      case "option": {
        const optionValues = optionValuesFor(product, facet);
        if (
          !selectedMatchList(
            values,
            optionValues,
            facet.matchMode ?? "or",
          )
        ) {
          return false;
        }
        break;
      }
      case "metafield": {
        const list = metafieldValuesForProduct(product, facet);
        if (facet.type === "range") {
          const nums = list.map(Number).filter((n) => Number.isFinite(n));
          const min = parseBound(values[0]);
          const max = parseBound(values[1]);
          if (!nums.length) return false;
          if (Number.isFinite(min) && nums.every((n) => n < min)) return false;
          if (Number.isFinite(max) && nums.every((n) => n > max)) return false;
        } else if (facet.type === "boolean") {
          const wantTrue = values.some(
            (value) => normalizeBooleanMetafieldValue(value) === BOOLEAN_TRUE,
          );
          const wantFalse = values.some(
            (value) => normalizeBooleanMetafieldValue(value) === BOOLEAN_FALSE,
          );
          if (wantTrue && wantFalse) break;
          const actuals = new Set(
            list
              .map((item) => normalizeBooleanMetafieldValue(item))
              .filter((item): item is typeof BOOLEAN_TRUE | typeof BOOLEAN_FALSE =>
                item != null,
              ),
          );
          if (wantTrue && !actuals.has(BOOLEAN_TRUE)) return false;
          if (wantFalse && !actuals.has(BOOLEAN_FALSE)) return false;
        } else if (
          !selectedMatchList(values, list, facet.matchMode ?? "or")
        ) {
          return false;
        }
        break;
      }
      default:
        break;
    }
  }
  return true;
}

export function hasActiveFilterSelection(selected: SelectedFilters): boolean {
  return Object.values(selected).some(
    (values) => Array.isArray(values) && values.length > 0,
  );
}

/** Drop products whose tags intersect the merchant hide-by-tag list (D10). */
export function excludeHiddenTaggedProducts<T extends { tags?: string[] | null }>(
  products: T[],
  hideTags: string[],
): T[] {
  if (!hideTags.length) return products;
  const hidden = new Set(
    hideTags.map((tag) => tag.trim().toLowerCase()).filter(Boolean),
  );
  if (!hidden.size) return products;
  return products.filter((product) => {
    const tags = product.tags;
    if (!Array.isArray(tags) || tags.length === 0) return true;
    return !tags.some((tag) => hidden.has(String(tag).trim().toLowerCase()));
  });
}

/** Merchant hide-OOS policy. Shopper availability=out_of_stock still wins. */
export function applyHideOutOfStock<T extends { available: boolean }>(
  products: T[],
  mode: string,
  selected: SelectedFilters,
): T[] {
  const hideAlways = mode === "hide";
  const hideAfter = mode === "hide_after_filter";
  if (!hideAlways && !hideAfter) return products;
  if ((selected.availability ?? []).includes("out_of_stock")) return products;
  if (hideAfter && !hasActiveFilterSelection(selected)) return products;
  return products.filter((product) => product.available);
}

let widgetChromeOverride: Partial<Record<string, string>> | null = null;

export function withWidgetChrome<T>(
  chrome: Partial<Record<string, string>> | null | undefined,
  fn: () => T,
): T {
  const prev = widgetChromeOverride;
  widgetChromeOverride = chrome ?? null;
  try {
    return fn();
  } finally {
    widgetChromeOverride = prev;
  }
}

function chromeString(key: string, fallback: string) {
  const value = widgetChromeOverride?.[key];
  return typeof value === "string" && value.trim() ? value : fallback;
}

function labelFor(facet: FacetDef, value: string) {
  if (facet.source === "availability") {
    return value === "in_stock"
      ? chromeString("in_stock", "In stock")
      : chromeString("out_of_stock", "Out of stock");
  }
  if (facet.source === "rating") {
    return `${ratingStarLabel(value)} ${chromeString("and_up", "and up")}`;
  }
  if (facet.type === "boolean") {
    return value === BOOLEAN_TRUE ? BOOLEAN_TRUE_LABEL : BOOLEAN_FALSE_LABEL;
  }
  if (value === UNSPECIFIED_VALUE || value === "") return UNSPECIFIED_LABEL;
  return value;
}

function decimalToNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (typeof value === "object" && value && "toNumber" in value) {
    const parsed = (value as { toNumber: () => number }).toNumber();
    return Number.isFinite(parsed) ? parsed : null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export type PriceRangeSettings = {
  mode?: string | null;
  customMin?: unknown;
  customMax?: unknown;
};

export function catalogPriceBounds(products: ProductFacetRow[]) {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const product of products) {
    if (Number.isFinite(product.priceMin)) min = Math.min(min, product.priceMin);
    if (Number.isFinite(product.priceMax)) max = Math.max(max, product.priceMax);
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
  if (min === 0 && max === 0) return null;
  return { min, max };
}

export function catalogSaleBounds(products: ProductFacetRow[]) {
  let max = 0;
  let any = false;
  for (const product of products) {
    const pct = Number(product.salePct ?? 0);
    if (!Number.isFinite(pct) || pct <= 0) continue;
    any = true;
    max = Math.max(max, pct);
  }
  if (!any) return { min: 0, max: 100 };
  return { min: 0, max: Math.max(100, Math.ceil(max)) };
}

export function resolvePriceBounds(
  products: ProductFacetRow[],
  settings?: PriceRangeSettings | null,
) {
  if (settings?.mode === "custom") {
    const min = decimalToNumber(settings.customMin);
    const max = decimalToNumber(settings.customMax);
    if (min != null && max != null && max >= min) return { min, max };
  }
  return catalogPriceBounds(products);
}

export type RangeBoundEntry = {
  mode: "auto" | "custom";
  min: number | null;
  max: number | null;
};

export type RangeBoundMap = Record<string, RangeBoundEntry>;

export type RangeBoundFormMap = Record<
  string,
  { mode: "auto" | "custom"; min: string; max: string }
>;

export function parseRangeBounds(raw: unknown): RangeBoundMap {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: RangeBoundMap = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!key || typeof value !== "object" || value == null || Array.isArray(value)) {
      continue;
    }
    const rec = value as Record<string, unknown>;
    const mode = rec.mode === "custom" ? "custom" : "auto";
    let min = decimalToNumber(rec.min);
    let max = decimalToNumber(rec.max);
    if (min != null && max != null && min > max) {
      const swap = min;
      min = max;
      max = swap;
    }
    out[key] = { mode, min, max };
  }
  return out;
}

export function rangeBoundsToForm(map: RangeBoundMap): RangeBoundFormMap {
  const out: RangeBoundFormMap = {};
  for (const [key, entry] of Object.entries(map)) {
    out[key] = {
      mode: entry.mode,
      min: entry.min == null ? "" : String(entry.min),
      max: entry.max == null ? "" : String(entry.max),
    };
  }
  return out;
}

export function catalogMetafieldRangeBounds(
  products: ProductFacetRow[],
  facet: Pick<FacetDef, "metafieldNamespace" | "metafieldKey" | "metafieldOwner">,
) {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const product of products) {
    for (const value of metafieldValuesForProduct(product, facet)) {
      const num = Number(value);
      if (!Number.isFinite(num)) continue;
      min = Math.min(min, num);
      max = Math.max(max, num);
    }
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
  return { min, max };
}

export function resolveMetafieldRangeBounds(
  products: ProductFacetRow[],
  facet: Pick<
    FacetDef,
    "key" | "metafieldNamespace" | "metafieldKey" | "metafieldOwner"
  >,
  rangeBounds: RangeBoundMap = {},
) {
  const settings = rangeBounds[facet.key];
  if (settings?.mode === "custom") {
    const min = settings.min;
    const max = settings.max;
    if (min != null && max != null && max >= min) return { min, max };
  }
  return catalogMetafieldRangeBounds(products, facet);
}

export function buildFacetAggregations(
  products: ProductFacetRow[],
  facets: FacetDef[],
  priceSettings?: PriceRangeSettings | null,
  valueSort: ValueSortMap = {},
  rangeBounds: RangeBoundMap = {},
  collectionCatalog: ShopCollection[] = [],
  collectionTotals?: Map<string, number> | null,
) {
  const result: Array<{
    key: string;
    label: string;
    type: FacetDef["type"];
    source: FacetSource;
    displayType?: FacetDisplayType;
    matchMode?: FacetMatchMode;
    valueSortMode?: ValueSortMode;
    optionName?: string;
    optionNames?: string[];
    values?: Array<{
      value: string;
      label: string;
      count: number;
      handle?: string;
      url?: string;
      children?: unknown[];
    }>;
    range?: { min: number | null; max: number | null };
  }> = [];

  for (const facet of facets.filter((item) => item.enabled)) {
    if (facet.source === "price") {
      const bounds = resolvePriceBounds(products, priceSettings);
      result.push({
        key: facet.key,
        label: facet.label,
        type: facet.type,
        source: facet.source,
        displayType: facet.displayType ?? "slider",
        range: {
          min: bounds?.min ?? null,
          max: bounds?.max ?? null,
        },
      });
      continue;
    }

    if (facet.source === "sale") {
      const bounds = catalogSaleBounds(products);
      result.push({
        key: facet.key,
        label: facet.label,
        type: facet.type,
        source: facet.source,
        displayType: facet.displayType ?? "slider",
        range: {
          min: bounds.min,
          max: bounds.max,
        },
      });
      continue;
    }

    if (facet.source === "rating") {
      const counts = new Map<string, number>(
        RATING_STAR_VALUES.map((star) => [star, 0]),
      );
      for (const product of products) {
        const rating = productReviewRating(product);
        if (rating == null) continue;
        for (const star of RATING_STAR_VALUES) {
          if (rating >= Number(star)) {
            counts.set(star, (counts.get(star) || 0) + 1);
          }
        }
      }
      result.push({
        key: facet.key,
        label: facet.label,
        type: facet.type,
        source: facet.source,
        displayType: "checkbox",
        matchMode: "or",
        values: RATING_STAR_VALUES.map((star) => ({
          value: star,
          label: labelFor(facet, star),
          count: counts.get(star) || 0,
        })),
      });
      continue;
    }

    if (facet.source === "collection") {
      const counts = collectionFacetCounts(products, collectionTotals);
      const showAll = facet.displayType === "collection";
      const fromCatalog = collectionCatalog.length
        ? collectionCatalog
        : [...counts.keys()].map((gid) => ({
            collectionGid: gid,
            title: gid,
            handle: "",
          }));
      const sort = valueSortForFacet(facet, valueSort);
      const listed = fromCatalog
        .filter((row) => showAll || (counts.get(row.collectionGid) || 0) > 0)
        .sort((a, b) =>
          compareListedValues(a.title || a.collectionGid, b.title || b.collectionGid, facet, sort),
        )
        .map((row) => ({
          value: row.collectionGid,
          label: row.title || row.handle || row.collectionGid,
          count: counts.get(row.collectionGid) || 0,
          handle: row.handle,
          url: collectionStorefrontPath(row.handle),
        }));
      result.push({
        key: facet.key,
        label: facet.label,
        type: facet.type,
        source: facet.source,
        displayType: facet.displayType ?? "checkbox",
        matchMode: facet.matchMode ?? "or",
        valueSortMode: sort.mode,
        values: listed,
      });
      continue;
    }

    if (facet.source === "metafield" && facet.type === "range") {
      const bounds = resolveMetafieldRangeBounds(products, facet, rangeBounds);
      result.push({
        key: facet.key,
        label: facet.label,
        type: facet.type,
        source: facet.source,
        displayType: facet.displayType ?? "slider",
        range: {
          min: bounds?.min ?? 0,
          max: bounds?.max ?? 0,
        },
      });
      continue;
    }

    const counts = new Map<string, number>();
    for (const product of products) {
      let vals: string[] = [];
      switch (facet.source) {
        case "vendor":
          vals = [product.vendor || UNSPECIFIED_VALUE];
          break;
        case "productType":
          vals = [product.productType || UNSPECIFIED_VALUE];
          break;
        case "tag":
          vals = product.tags;
          break;
        case "availability":
          vals = [product.available ? "in_stock" : "out_of_stock"];
          break;
        case "location":
          vals = product.inventoryLocations ?? [];
          break;
        case "option":
          vals = optionValuesFor(product, facet);
          break;
        case "metafield": {
          const rawValues = metafieldValuesForProduct(product, facet);
          if (facet.type === "boolean") {
            vals = rawValues
              .map((item) => normalizeBooleanMetafieldValue(item))
              .filter((item): item is typeof BOOLEAN_TRUE | typeof BOOLEAN_FALSE =>
                item != null,
              );
          } else {
            vals = rawValues;
          }
          break;
        }
      }
      for (const value of vals) {
        if (!value) continue;
        counts.set(value, (counts.get(value) || 0) + 1);
      }
    }

    if (facet.source === "availability") {
      if (!counts.has("in_stock")) counts.set("in_stock", 0);
      if (!counts.has("out_of_stock")) counts.set("out_of_stock", 0);
    }

    if (facet.type === "boolean") {
      if (!counts.has(BOOLEAN_TRUE)) counts.set(BOOLEAN_TRUE, 0);
      if (!counts.has(BOOLEAN_FALSE)) counts.set(BOOLEAN_FALSE, 0);
    }

    const sort = valueSortForFacet(facet, valueSort);
    const values = [...counts.entries()]
      .filter(([, count]) =>
        facet.source === "availability" || facet.type === "boolean"
          ? true
          : count > 0,
      )
      .sort((a, b) => compareListedValues(a[0], b[0], facet, sort))
      .map(([value, count]) => ({
        value,
        label: labelFor(facet, value),
        count,
      }));

    if (!values.length) continue;

    result.push({
      key: facet.key,
      label: facet.label,
      type: facet.type,
      source: facet.source,
      displayType: facet.displayType ?? "checkbox",
      matchMode: facet.matchMode ?? "or",
      valueSortMode: sort.mode,
      optionName: facet.optionName,
      optionNames: facet.optionNames,
      values,
    });
  }

  return result;
}

export function listFacetValueCatalog(
  products: ProductFacetRow[],
  config: FilterConfig | null,
  mappings: MetafieldMapping[] = [],
): Array<{ key: string; label: string; values: string[] }> {
  const facets = expandFacetsWithOptions(
    facetsFromConfig(config, mappings),
    products,
  );
  return buildFacetAggregations(products, facets, null, {})
    .filter(
      (facet) =>
        facet.values?.length &&
        facet.source !== "availability" &&
        facet.type !== "range" &&
        facet.type !== "boolean",
    )
    .map((facet) => ({
      key: facet.key,
      label: facet.label,
      values: (facet.values ?? []).map((item) => item.value),
    }));
}
