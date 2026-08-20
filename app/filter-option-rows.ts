import {
  displayTypeChoicesForKey,
  type FacetDisplayType,
} from "./filters";

export type BuiltinEnableKey =
  | "enablePrice"
  | "enableSale"
  | "enableRating"
  | "enableAvailability"
  | "enableVendor"
  | "enableProductType"
  | "enableTags"
  | "enableOptions";

export type FilterOptionDef = {
  key: string;
  label: string;
  source: string;
  enableKey: BuiltinEnableKey;
};

export const FILTER_OPTION_DEFS: FilterOptionDef[] = [
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
  { key: "rating", label: "Rating", source: "Rating", enableKey: "enableRating" },
];

export type FilterOptionRow = {
  key: string;
  label: string;
  source: string;
  sourceKind: "builtin" | "option" | "metafield";
  enableKey?: BuiltinEnableKey;
  filterType?: string;
};

type EnableFlags = Record<BuiltinEnableKey, boolean>;

export function builtinDefForKey(key: string) {
  if (key === "tag") return FILTER_OPTION_DEFS.find((def) => def.key === "tags");
  return FILTER_OPTION_DEFS.find((def) => def.key === key);
}

export function isOptionRowKey(key: string) {
  return key === "options" || key.startsWith("opt_");
}

export function buildVisibleFilterRows(
  displayOrder: string[],
  flags: EnableFlags,
  catalogOptions: Array<{ key: string; label: string }>,
  mappedFacets: Array<{ key: string; label: string; filterType: string }>,
): FilterOptionRow[] {
  const explicitOpts = displayOrder.filter((key) => key.startsWith("opt_"));
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
  for (const key of displayOrder) {
    if (isOptionRowKey(key)) {
      if (!optionsInserted) {
        rows.push(...optionRows);
        optionsInserted = true;
      }
      continue;
    }
    const def = builtinDefForKey(key);
    if (def) {
      if (flags[def.enableKey]) {
        rows.push({ ...def, sourceKind: "builtin" });
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
  for (const mapped of mappedFacets) {
    if (!rows.some((row) => row.key === mapped.key)) {
      rows.push({
        key: mapped.key,
        label: mapped.label,
        source: mapped.label,
        sourceKind: "metafield",
        filterType: mapped.filterType,
      });
    }
  }
  return rows;
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
    if (!flags[def.enableKey]) {
      available.push({ ...def, sourceKind: "builtin" });
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
    return true;
  });
  return [...visibleKeys, ...leftover];
}

export function displayChoicesForRow(
  row: FilterOptionRow,
): FacetDisplayType[] {
  return displayTypeChoicesForKey(row.key, row.filterType);
}
