import {
  displayTypeChoicesForKey,
  type FacetDisplayType,
} from "./filters";
import type { FacetSettingsMap } from "./facet-settings";

export type BuiltinEnableKey =
  | "enablePrice"
  | "enableSale"
  | "enableRating"
  | "enableLocation"
  | "enableAvailability"
  | "enableVendor"
  | "enableProductType"
  | "enableTags"
  | "enableOptions";

export type FilterOptionDef = {
  key: string;
  label: string;
  source: string;
  enableKey?: BuiltinEnableKey;
};

export const ADMIN_OPTION_KEYS = [
  "collection",
  "category",
  "readyToShip",
  "location",
] as const;

export type AdminOptionKey = (typeof ADMIN_OPTION_KEYS)[number];

export const FILTER_OPTION_DEFS: FilterOptionDef[] = [
  { key: "collection", label: "Collection", source: "Collection" },
  { key: "category", label: "Category", source: "Category" },
  { key: "vendor", label: "Vendor", source: "Vendor", enableKey: "enableVendor" },
  {
    key: "productType",
    label: "Product Type",
    source: "Product type",
    enableKey: "enableProductType",
  },
  { key: "price", label: "Price", source: "Price", enableKey: "enablePrice" },
  {
    key: "sale",
    label: "Percent Sale",
    source: "Percent Sale",
    enableKey: "enableSale",
  },
  {
    key: "availability",
    label: "Availability",
    source: "Availability",
    enableKey: "enableAvailability",
  },
  { key: "tags", label: "Tag", source: "Tag", enableKey: "enableTags" },
  { key: "readyToShip", label: "Ready To Ship", source: "Ready to ship" },
  { key: "location", label: "Location", source: "Location", enableKey: "enableLocation" },
  { key: "rating", label: "Rating", source: "Rating", enableKey: "enableRating" },
];

export type FilterOptionRow = {
  key: string;
  label: string;
  source: string;
  sourceKind: "builtin" | "admin" | "option" | "metafield";
  enableKey?: BuiltinEnableKey;
  filterType?: string;
};

export type EnableFlags = Record<BuiltinEnableKey, boolean>;

export const VALUE_PICKER_SKIP_KEYS = new Set([
  "price",
  "sale",
  "rating",
  "availability",
  "category",
  "readyToShip",
  "location",
]);

export function facetSupportsValuePicker(key: string, filterType?: string) {
  if (VALUE_PICKER_SKIP_KEYS.has(key)) return false;
  if (filterType === "RANGE" || filterType === "BOOLEAN") return false;
  return true;
}

export function enableFlagsFromConfig(config: {
  enablePrice?: boolean | null;
  enableSale?: boolean | null;
  enableRating?: boolean | null;
  enableLocation?: boolean | null;
  enableAvailability?: boolean | null;
  enableVendor?: boolean | null;
  enableProductType?: boolean | null;
  enableTags?: boolean | null;
  enableOptions?: boolean | null;
}): EnableFlags {
  return {
    enablePrice: config.enablePrice ?? true,
    enableSale: config.enableSale ?? false,
    enableRating: config.enableRating ?? false,
    enableLocation: config.enableLocation ?? false,
    enableAvailability: config.enableAvailability ?? true,
    enableVendor: config.enableVendor ?? true,
    enableProductType: config.enableProductType ?? true,
    enableTags: config.enableTags ?? true,
    enableOptions: config.enableOptions ?? true,
  };
}

export function resolveFilterOptionRow(
  key: string,
  catalogOptions: Array<{ key: string; label: string }>,
  mappedFacets: Array<{ key: string; label: string; filterType: string }>,
): FilterOptionRow | null {
  const def = builtinDefForKey(key);
  if (def) return { ...def, sourceKind: sourceKindForDef(def) };
  const option = catalogOptions.find((row) => row.key === key);
  if (option || key === "options") {
    return {
      key,
      label: option?.label ?? "Variant options",
      source: option?.label ?? "options",
      sourceKind: "option",
      enableKey: "enableOptions",
    };
  }
  const mapped = mappedFacets.find((facet) => facet.key === key);
  if (mapped) {
    return {
      key: mapped.key,
      label: mapped.label,
      source: mapped.label,
      sourceKind: "metafield",
      filterType: mapped.filterType,
    };
  }
  return null;
}

export function catalogValuesForKey(
  catalog: Array<{ key: string; values: string[] }>,
  key: string,
): string[] {
  const exact = catalog.find((item) => item.key === key);
  if (exact) return exact.values;
  if (key === "tags") {
    return catalog.find((item) => item.key === "tag")?.values ?? [];
  }
  if (key === "tag") {
    return catalog.find((item) => item.key === "tags")?.values ?? [];
  }
  return [];
}

export function addFilterOptionKeys(
  row: FilterOptionRow,
  visibleKeys: string[],
  flags: EnableFlags,
): { visibleKeys: string[]; flags: EnableFlags } {
  const nextFlags = { ...flags };
  const nextVisible = [...visibleKeys];

  if (row.enableKey && row.enableKey !== "enableOptions") {
    nextFlags[row.enableKey] = true;
    if (!nextVisible.includes(row.key)) nextVisible.push(row.key);
    return { visibleKeys: nextVisible, flags: nextFlags };
  }

  if (row.sourceKind === "option") {
    nextFlags.enableOptions = true;
    const withoutOptions = nextVisible.filter((item) => !isOptionRowKey(item));
    const currentOpts = nextVisible.filter(
      (item) => isOptionRowKey(item) && item !== "options",
    );
    const nextOpts = currentOpts.includes(row.key)
      ? currentOpts
      : [...currentOpts, row.key];
    const insertAt = nextVisible.findIndex(isOptionRowKey);
    const rebuilt = [...withoutOptions];
    if (insertAt >= 0) rebuilt.splice(Math.min(insertAt, rebuilt.length), 0, ...nextOpts);
    else rebuilt.push(...nextOpts);
    return { visibleKeys: rebuilt, flags: nextFlags };
  }

  if (!nextVisible.includes(row.key)) nextVisible.push(row.key);
  return { visibleKeys: nextVisible, flags: nextFlags };
}

export function removeFilterOptionKeys(
  key: string,
  visibleKeys: string[],
  flags: EnableFlags,
): { visibleKeys: string[]; flags: EnableFlags } {
  const remaining = visibleKeys.filter((item) => item !== key);
  const nextFlags = { ...flags };
  const def = builtinDefForKey(key);
  if (def?.enableKey && def.enableKey !== "enableOptions") {
    nextFlags[def.enableKey] = false;
  }
  if (key === "sale") nextFlags.enableSale = remaining.includes("sale");
  if (isOptionRowKey(key)) {
    nextFlags.enableOptions = remaining.some(isOptionRowKey);
  }
  return { visibleKeys: remaining, flags: nextFlags };
}

export function isAdminOptionKey(key: string): key is AdminOptionKey {
  return (ADMIN_OPTION_KEYS as readonly string[]).includes(key);
}

export function withAdminOptionKeys(order: string[]): string[] {
  const seenAdmin = new Set<string>();
  const next: string[] = [];
  for (const key of order) {
    if (isAdminOptionKey(key)) {
      if (seenAdmin.has(key)) continue;
      seenAdmin.add(key);
    }
    next.push(key);
  }
  if (ADMIN_OPTION_KEYS.some((key) => next.includes(key))) {
    return next;
  }

  const preferred = [
    "collection",
    "category",
    "vendor",
    "productType",
    "price",
    "sale",
    "availability",
    "tags",
    "readyToShip",
    "location",
  ];
  const seen = new Set<string>();
  const rebuilt: string[] = [];
  for (const key of preferred) {
    rebuilt.push(key);
    seen.add(key);
    if (key === "tags") seen.add("tag");
  }
  for (const key of next) {
    if (seen.has(key) || (key === "tag" && seen.has("tags"))) continue;
    rebuilt.push(key);
    seen.add(key);
  }
  return rebuilt;
}

export function builtinDefForKey(key: string) {
  if (key === "tag") return FILTER_OPTION_DEFS.find((def) => def.key === "tags");
  return FILTER_OPTION_DEFS.find((def) => def.key === key);
}

export function isOptionRowKey(key: string) {
  return key === "options" || key.startsWith("opt_");
}

function sourceKindForDef(def: FilterOptionDef): FilterOptionRow["sourceKind"] {
  return def.enableKey ? "builtin" : "admin";
}

function isDefVisible(
  def: FilterOptionDef,
  flags: EnableFlags,
  order: string[],
) {
  if (!def.enableKey || def.key === "sale") {
    return order.includes(def.key);
  }
  return flags[def.enableKey];
}

export function buildVisibleFilterRows(
  displayOrder: string[],
  flags: EnableFlags,
  catalogOptions: Array<{ key: string; label: string }>,
  mappedFacets: Array<{ key: string; label: string; filterType: string }>,
): FilterOptionRow[] {
  const order = displayOrder;
  const explicitOpts = order.filter((key) => key.startsWith("opt_"));
  const optionRows: FilterOptionRow[] = [];
  if (flags.enableOptions) {
    if (explicitOpts.length) {
      for (const key of explicitOpts) {
        const found = catalogOptions.find((option) => option.key === key);
        optionRows.push({
          key,
          label: found?.label ?? key.replace(/^opt_/, "").replace(/_/g, " "),
          source: found?.label ?? "option",
          sourceKind: "option",
          enableKey: "enableOptions",
        });
      }
    } else {
      for (const option of catalogOptions) {
        optionRows.push({
          key: option.key,
          label: option.label,
          source: option.label,
          sourceKind: "option",
          enableKey: "enableOptions",
        });
      }
      if (!catalogOptions.length) {
        optionRows.push({
          key: "options",
          label: "Variant options",
          source: "options",
          sourceKind: "option",
          enableKey: "enableOptions",
        });
      }
    }
  }

  const rows: FilterOptionRow[] = [];
  let optionsInserted = false;
  for (const key of order) {
    if (isOptionRowKey(key)) {
      if (!optionsInserted) {
        rows.push(...optionRows);
        optionsInserted = true;
      }
      continue;
    }
    const def = builtinDefForKey(key);
    if (def) {
      if (isDefVisible(def, flags, order)) {
        rows.push({ ...def, sourceKind: sourceKindForDef(def) });
      }
      continue;
    }
    const mapped = mappedFacets.find((facet) => facet.key === key);
    if (mapped) {
      rows.push({
        key: mapped.key,
        label: mapped.label,
        source: mapped.label,
        sourceKind: "metafield",
        filterType: mapped.filterType,
      });
    }
  }
  if (!optionsInserted) rows.push(...optionRows);
  return rows;
}

export function isMetafieldFacetKey(key: string) {
  return key.startsWith("mf_");
}

/** Stored tree order for admin — do not re-inject mapped metafields. */
export function storedFilterDisplayOrder(
  displayOrder: string[] | null | undefined,
  enableSale?: boolean | null,
): string[] {
  const stored = Array.isArray(displayOrder) ? displayOrder : [];
  const next = withAdminOptionKeys(stored);
  if (enableSale || stored.includes("sale") || stored.length === 0) {
    return next;
  }
  return next.filter((key) => key !== "sale");
}

/**
 * Settings metafields: add newly declared Filter keys, drop deleted mappings,
 * leave merchant-removed keys off this tree.
 */
export function nextDisplayOrderForMetafieldSync(
  displayOrder: string[],
  keepKeys: string[],
  knownKeys: string[] | null,
): string[] {
  const keepSet = new Set(keepKeys);
  const next = displayOrder.filter(
    (key) => !isMetafieldFacetKey(String(key)) || keepSet.has(String(key)),
  );
  const toAdd =
    knownKeys === null
      ? keepKeys
      : keepKeys.filter((key) => !knownKeys.includes(key));
  for (const key of toAdd) {
    if (key && !next.includes(key)) next.push(key);
  }
  return next;
}

export function applyFacetSettingLabels(
  rows: FilterOptionRow[],
  settings: FacetSettingsMap,
): FilterOptionRow[] {
  return rows.map((row) => ({
    ...row,
    label: settings[row.key]?.label || row.label,
  }));
}

export function availableFilterOptions(
  visibleKeys: string[],
  flags: EnableFlags,
  catalogOptions: Array<{ key: string; label: string }>,
  mappedFacets: Array<{ key: string; label: string; filterType: string }>,
): FilterOptionRow[] {
  const visible = new Set(visibleKeys);
  const available: FilterOptionRow[] = [];
  for (const def of FILTER_OPTION_DEFS) {
    if (visible.has(def.key) || (def.key === "tags" && visible.has("tag"))) {
      continue;
    }
    if (
      !def.enableKey ||
      def.key === "sale" ||
      def.key === "rating" ||
      def.key === "location" ||
      !flags[def.enableKey]
    ) {
      available.push({ ...def, sourceKind: sourceKindForDef(def) });
    }
  }
  if (flags.enableOptions) {
    for (const option of catalogOptions) {
      if (!visible.has(option.key) && !visible.has("options")) {
        available.push({
          key: option.key,
          label: option.label,
          source: option.label,
          sourceKind: "option",
          enableKey: "enableOptions",
        });
      }
    }
  } else {
    for (const option of catalogOptions) {
      available.push({
        key: option.key,
        label: option.label,
        source: option.label,
        sourceKind: "option",
        enableKey: "enableOptions",
      });
    }
    if (!catalogOptions.length) {
      available.push({
        key: "options",
        label: "Variant options",
        source: "options",
        sourceKind: "option",
        enableKey: "enableOptions",
      });
    }
  }
  for (const mapped of mappedFacets) {
    if (!visible.has(mapped.key)) {
      available.push({
        key: mapped.key,
        label: mapped.label,
        source: mapped.label,
        sourceKind: "metafield",
        filterType: mapped.filterType,
      });
    }
  }
  return available;
}

export function persistDisplayOrder(
  visibleKeys: string[],
  previous: string[],
): string[] {
  const visibleSet = new Set(visibleKeys);
  const leftover = previous.filter((key) => {
    if (visibleSet.has(key)) return false;
    if (isOptionRowKey(key) && visibleKeys.some((item) => isOptionRowKey(item))) {
      return false;
    }
    if (isAdminOptionKey(key) || key === "sale") return false;
    if (isMetafieldFacetKey(key)) return false;
    return true;
  });
  return [...visibleKeys, ...leftover];
}

export function displayChoicesForRow(
  row: FilterOptionRow,
): FacetDisplayType[] {
  return displayTypeChoicesForKey(row.key, row.filterType);
}
