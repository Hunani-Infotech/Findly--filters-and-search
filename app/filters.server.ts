import type { FilterConfig, MetafieldFilterType, MetafieldMapping } from "@prisma/client";

export type FacetSource =
  | "vendor"
  | "productType"
  | "tag"
  | "price"
  | "availability"
  | "metafield"
  | "option";

export type FacetDef = {
  key: string;
  source: FacetSource;
  label: string;
  type: "checkbox" | "range" | "boolean";
  metafieldNamespace?: string;
  metafieldKey?: string;
  optionName?: string;
  optionNames?: string[];
  enabled: boolean;
};

export const UNSPECIFIED_VALUE = "__unspecified__";
export const UNSPECIFIED_LABEL = "Unspecified";
export const BOOLEAN_TRUE = "true";
export const BOOLEAN_FALSE = "false";
export const BOOLEAN_TRUE_LABEL = "Yes";
export const BOOLEAN_FALSE_LABEL = "No";

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
  "price",
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

export function normalizeDisplayOrder(order?: string[] | null) {
  const next = order?.length ? [...order] : [...DEFAULT_DISPLAY_ORDER];
  for (const key of DEFAULT_DISPLAY_ORDER) {
    if (!next.includes(key) && !next.includes(key === "tags" ? "tag" : key)) {
      next.push(key);
    }
  }
  return next;
}

export function facetsFromConfig(
  config: FilterConfig | null,
  mappings: MetafieldMapping[] = [],
): FacetDef[] {
  const order = normalizeDisplayOrder(config?.displayOrder);

  const builtIns: Record<string, FacetDef> = {
    availability: {
      key: "availability",
      source: "availability",
      label: "Availability",
      type: "checkbox",
      enabled: config?.enableAvailability ?? true,
    },
    price: {
      key: "price",
      source: "price",
      label: "Price",
      type: "range",
      enabled: config?.enablePrice ?? true,
    },
    vendor: {
      key: "vendor",
      source: "vendor",
      label: "Vendor",
      type: "checkbox",
      enabled: config?.enableVendor ?? true,
    },
    productType: {
      key: "productType",
      source: "productType",
      label: "Product type",
      type: "checkbox",
      enabled: config?.enableProductType ?? true,
    },
    tags: {
      key: "tag",
      source: "tag",
      label: "Tags",
      type: "checkbox",
      enabled: config?.enableTags ?? true,
    },
    options: {
      key: "options",
      source: "option",
      label: "Options",
      type: "checkbox",
      enabled: config?.enableOptions ?? true,
    },
  };

  const ordered: FacetDef[] = [];
  for (const key of order) {
    const facet = builtIns[key] ?? builtIns[key === "tag" ? "tags" : key];
    if (facet && !ordered.some((item) => item.key === facet.key)) {
      ordered.push(facet);
    }
  }

  for (const facet of Object.values(builtIns)) {
    if (!ordered.some((item) => item.key === facet.key)) ordered.push(facet);
  }

  const metafieldFacets = mappings
    .filter((mapping) => mapping.enabled)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((mapping) => ({
      key: `mf_${mapping.namespace}_${mapping.key}`,
      source: "metafield" as const,
      label: mapping.displayLabel,
      type: metafieldTypeToFacetType(mapping.filterType),
      metafieldNamespace: mapping.namespace,
      metafieldKey: mapping.key,
      enabled: true,
    }));

  return [...ordered, ...metafieldFacets];
}

function metafieldTypeToFacetType(
  filterType: MetafieldFilterType,
): FacetDef["type"] {
  if (filterType === "RANGE") return "range";
  if (filterType === "BOOLEAN") return "boolean";
  return "checkbox";
}

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
  available: boolean;
  status: string;
  imageUrl: string | null;
  metafields: Record<string, string>;
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

function isUselessOption(name: string, values: string[]) {
  if (name.toLowerCase() === "title") return true;
  const meaningful = values.filter(
    (value) => value && value !== "Default Title",
  );
  return meaningful.length === 0;
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
  if (!placeholder?.enabled) {
    return facets.filter(
      (facet) =>
        facet.key !== "options" &&
        !(facet.source === "option" && !facet.optionName),
    );
  }

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

  const optionFacets: FacetDef[] = [...byLabel.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([label, group]) => {
      const names = [...group.names].sort();
      return {
        key: optionFacetKey(label),
        source: "option" as const,
        label,
        type: "checkbox" as const,
        enabled: true,
        optionName: names[0],
        optionNames: names,
      };
    });

  const result: FacetDef[] = [];
  let inserted = false;
  for (const facet of facets) {
    if (facet.key === "options" || (facet.source === "option" && !facet.optionName)) {
      result.push(...optionFacets);
      inserted = true;
    } else {
      result.push(facet);
    }
  }
  if (!inserted) result.push(...optionFacets);
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
        if (!values.some((value) => product.tags.includes(value))) return false;
        break;
      case "availability": {
        const wantIn = values.includes("in_stock");
        const wantOut = values.includes("out_of_stock");
        if (wantIn && wantOut) break;
        if (wantIn && !product.available) return false;
        if (wantOut && product.available) return false;
        break;
      }
      case "price": {
        const min = parseBound(values[0]);
        const max = parseBound(values[1]);
        if (Number.isFinite(min) && product.priceMax < min) return false;
        if (Number.isFinite(max) && product.priceMin > max) return false;
        break;
      }
      case "option": {
        const optionValues = optionValuesFor(product, facet);
        if (!values.some((value) => optionValues.includes(value))) return false;
        break;
      }
      case "metafield": {
        const path = `${facet.metafieldNamespace}.${facet.metafieldKey}`;
        const raw = product.metafields[path];
        const list = metafieldListValues(raw);
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
        } else if (!values.some((value) => list.includes(value))) {
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

function labelFor(facet: FacetDef, value: string) {
  if (facet.source === "availability") {
    return value === "in_stock" ? "In stock" : "Out of stock";
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

export function buildFacetAggregations(
  products: ProductFacetRow[],
  facets: FacetDef[],
  priceSettings?: PriceRangeSettings | null,
) {
  const result: Array<{
    key: string;
    label: string;
    type: FacetDef["type"];
    source: FacetSource;
    values?: Array<{ value: string; label: string; count: number }>;
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
        range: {
          min: bounds?.min ?? null,
          max: bounds?.max ?? null,
        },
      });
      continue;
    }

    if (facet.source === "metafield" && facet.type === "range") {
      const path = `${facet.metafieldNamespace}.${facet.metafieldKey}`;
      let min = Number.POSITIVE_INFINITY;
      let max = Number.NEGATIVE_INFINITY;
      for (const product of products) {
        for (const value of metafieldListValues(product.metafields[path])) {
          const num = Number(value);
          if (!Number.isFinite(num)) continue;
          min = Math.min(min, num);
          max = Math.max(max, num);
        }
      }
      result.push({
        key: facet.key,
        label: facet.label,
        type: facet.type,
        source: facet.source,
        range: {
          min: Number.isFinite(min) ? min : 0,
          max: Number.isFinite(max) ? max : 0,
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
        case "option":
          vals = optionValuesFor(product, facet);
          break;
        case "metafield": {
          const path = `${facet.metafieldNamespace}.${facet.metafieldKey}`;
          const rawValues = metafieldListValues(product.metafields[path]);
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

    const values = [...counts.entries()]
      .filter(([, count]) =>
        facet.source === "availability" || facet.type === "boolean"
          ? true
          : count > 0,
      )
      .sort((a, b) => {
        if (facet.source === "availability") {
          const order = { in_stock: 0, out_of_stock: 1 } as Record<string, number>;
          return (order[a[0]] ?? 9) - (order[b[0]] ?? 9);
        }
        if (facet.type === "boolean") {
          const order = { [BOOLEAN_TRUE]: 0, [BOOLEAN_FALSE]: 1 } as Record<
            string,
            number
          >;
          return (order[a[0]] ?? 9) - (order[b[0]] ?? 9);
        }
        if (a[0] === UNSPECIFIED_VALUE) return 1;
        if (b[0] === UNSPECIFIED_VALUE) return -1;
        return a[0].localeCompare(b[0]);
      })
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
      values,
    });
  }

  return result;
}
