import type { FilterConfig, MetafieldFilterType, MetafieldMapping } from "@prisma/client";

type FacetSource =
  | "vendor"
  | "productType"
  | "tag"
  | "price"
  | "availability"
  | "metafield";

type FacetDef = {
  key: string;
  source: FacetSource;
  label: string;
  type: "checkbox" | "range";
  metafieldNamespace?: string;
  metafieldKey?: string;
  enabled: boolean;
};

export const DEFAULT_DISPLAY_ORDER = [
  "availability",
  "price",
  "vendor",
  "productType",
  "tags",
] as const;

export function facetsFromConfig(
  config: FilterConfig | null,
  mappings: MetafieldMapping[] = [],
): FacetDef[] {
  const order =
    config?.displayOrder?.length ? config.displayOrder : [...DEFAULT_DISPLAY_ORDER];

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
      enabled: config?.enableTags ?? false,
    },
  };

  const ordered: FacetDef[] = [];
  for (const key of order) {
    const facet = builtIns[key] ?? builtIns[key === "tag" ? "tags" : key];
    if (facet) ordered.push(facet);
  }

  // Ensure any missing built-ins still appear
  for (const facet of Object.values(builtIns)) {
    if (!ordered.some((f) => f.key === facet.key)) ordered.push(facet);
  }

  const metafieldFacets = mappings
    .filter((m) => m.enabled)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((m) => ({
      key: `mf_${m.namespace}_${m.key}`,
      source: "metafield" as const,
      label: m.displayLabel,
      type: metafieldTypeToFacetType(m.filterType),
      metafieldNamespace: m.namespace,
      metafieldKey: m.key,
      enabled: true,
    }));

  return [...ordered, ...metafieldFacets];
}

function metafieldTypeToFacetType(
  filterType: MetafieldFilterType,
): FacetDef["type"] {
  if (filterType === "RANGE") return "range";
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
  imageUrl: string | null;
  metafields: Record<string, string>;
};

export type SelectedFilters = Record<string, string[]>;

export function productMatchesFilters(
  product: ProductFacetRow,
  facets: FacetDef[],
  selected: SelectedFilters,
) {
  for (const facet of facets.filter((f) => f.enabled)) {
    const values = selected[facet.key];
    if (!values?.length) continue;

    switch (facet.source) {
      case "vendor":
        if (!values.includes(product.vendor)) return false;
        break;
      case "productType":
        if (!values.includes(product.productType)) return false;
        break;
      case "tag":
        if (!values.some((v) => product.tags.includes(v))) return false;
        break;
      case "availability":
        if (values.includes("in_stock") && !product.available) return false;
        if (values.includes("out_of_stock") && product.available) return false;
        break;
      case "price": {
        const min = Number(values[0]);
        const max = Number(values[1] ?? values[0]);
        if (Number.isFinite(min) && product.priceMax < min) return false;
        if (Number.isFinite(max) && product.priceMin > max) return false;
        break;
      }
      case "metafield": {
        const path = `${facet.metafieldNamespace}.${facet.metafieldKey}`;
        const mf = product.metafields[path];
        if (!mf || !values.includes(mf)) return false;
        break;
      }
      default:
        break;
    }
  }
  return true;
}

export function buildFacetAggregations(
  products: ProductFacetRow[],
  facets: FacetDef[],
) {
  const result: Array<{
    key: string;
    label: string;
    type: FacetDef["type"];
    source: FacetSource;
    values?: Array<{ value: string; label: string; count: number }>;
    range?: { min: number; max: number };
  }> = [];

  for (const facet of facets.filter((f) => f.enabled)) {
    if (facet.source === "price" || facet.type === "range") {
      let min = Number.POSITIVE_INFINITY;
      let max = Number.NEGATIVE_INFINITY;
      for (const p of products) {
        min = Math.min(min, p.priceMin);
        max = Math.max(max, p.priceMax);
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
    for (const p of products) {
      let vals: string[] = [];
      switch (facet.source) {
        case "vendor":
          if (p.vendor) vals = [p.vendor];
          break;
        case "productType":
          if (p.productType) vals = [p.productType];
          break;
        case "tag":
          vals = p.tags;
          break;
        case "availability":
          vals = [p.available ? "in_stock" : "out_of_stock"];
          break;
        case "metafield": {
          const path = `${facet.metafieldNamespace}.${facet.metafieldKey}`;
          if (p.metafields[path]) vals = [p.metafields[path]];
          break;
        }
      }
      for (const v of vals) {
        counts.set(v, (counts.get(v) || 0) + 1);
      }
    }

    const labelFor = (value: string) => {
      if (facet.source === "availability") {
        return value === "in_stock" ? "In stock" : "Out of stock";
      }
      return value;
    };

    result.push({
      key: facet.key,
      label: facet.label,
      type: facet.type,
      source: facet.source,
      values: [...counts.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([value, count]) => ({
          value,
          label: labelFor(value),
          count,
        })),
    });
  }

  return result;
}
