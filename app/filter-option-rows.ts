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
  enableKey?: BuiltinEnableKey;
};

export const GLOBO_ADMIN_OPTION_KEYS = [
  "collection",
  "category",
  "readyToShip",
  "location",
] as const;

export type GloboAdminOptionKey = (typeof GLOBO_ADMIN_OPTION_KEYS)[number];

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
  { key: "location", label: "Location", source: "Location" },
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

type EnableFlags = Record<BuiltinEnableKey, boolean>;

export function isGloboAdminOptionKey(key: string): key is GloboAdminOptionKey {
  return (GLOBO_ADMIN_OPTION_KEYS as readonly string[]).includes(key);
}

export function withGloboAdminOptionKeys(order: string[]): string[] {
  const seenAdmin = new Set<string>();
  const next: string[] = [];
  for (const key of order) {
    if (isGloboAdminOptionKey(key)) {
      if (seenAdmin.has(key)) continue;
      seenAdmin.add(key);
    }
    next.push(key);
  }
  if (GLOBO_ADMIN_OPTION_KEYS.some((key) => next.includes(key))) {
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
    if (visible.has(def.key) || (def.key === "tags" && visible.has("tag"))) {
      continue;
    }
    if (
      !def.enableKey ||
      def.key === "sale" ||
      def.key === "rating" ||
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
    if (isGloboAdminOptionKey(key) || key === "sale") return false;
    return true;
  });
  return [...visibleKeys, ...leftover];
}

export function displayChoicesForRow(
  row: FilterOptionRow,
): FacetDisplayType[] {
  return displayTypeChoicesForKey(row.key, row.filterType);
}
