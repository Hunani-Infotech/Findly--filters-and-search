import type { ProductFacetRow } from "../types/filters";
import {
  SORT_OPTION_KEYS,
  parseSortOption,
  type SortOptionKey,
} from "../utils/app-settings";
import { mappingAppliesToSort } from "../utils/metafield-applies";

export const METAFIELD_SORT_PREFIX = "mfsort_";

export type MetafieldSortOption = {
  key: string; // mfsort_p_custom.release_date or mfsort_v_custom.material
  label: string;
  path: string; // namespace.key as stored on ProductFacet.metafields
  ownerType: "PRODUCT" | "VARIANT";
};

export function metafieldSortKey(
  ownerType: string,
  namespace: string,
  key: string,
): string {
  const owner = ownerType === "VARIANT" ? "v" : "p";
  return `${METAFIELD_SORT_PREFIX}${owner}_${namespace.trim()}.${key.trim()}`;
}

export function listMetafieldSortOptions(
  mappings: Array<{
    namespace: string;
    key: string;
    displayLabel?: string | null;
    ownerType?: string;
    enabled?: boolean;
    appliesTo?: unknown;
  }>,
): MetafieldSortOption[] {
  const options: MetafieldSortOption[] = [];
  const seen = new Set<string>();
  for (const mapping of mappings) {
    if (!mappingAppliesToSort(mapping)) continue;
    const namespace = mapping.namespace?.trim() ?? "";
    const key = mapping.key?.trim() ?? "";
    if (!namespace || !key) continue;
    const ownerType =
      mapping.ownerType === "VARIANT" ? "VARIANT" : "PRODUCT";
    const sortKey = metafieldSortKey(ownerType, namespace, key);
    if (seen.has(sortKey)) continue;
    seen.add(sortKey);
    options.push({
      key: sortKey,
      label: (mapping.displayLabel?.trim() || key) as string,
      path: `${namespace}.${key}`,
      ownerType,
    });
  }
  return options;
}

function bagValue(
  bag: Record<string, string> | undefined,
  path: string,
): string {
  if (!bag || typeof bag !== "object") return "";
  const raw = bag[path];
  if (raw == null) return "";
  return String(raw).trim();
}

function metafieldRawForSort(
  product: ProductFacetRow,
  option: MetafieldSortOption,
): string {
  if (option.ownerType === "VARIANT") {
    const fromVariant = bagValue(product.variantMetafields, option.path);
    if (fromVariant) return fromVariant;
    return bagValue(product.metafields, option.path);
  }
  return bagValue(product.metafields, option.path);
}

type SortableMetafield =
  | { kind: "empty" }
  | { kind: "num"; n: number }
  | { kind: "date"; t: number }
  | { kind: "str"; s: string };

function parseSortableMetafield(raw: string): SortableMetafield {
  const s = raw.trim();
  if (!s) return { kind: "empty" };

  if (s.startsWith("{")) {
    try {
      const parsed = JSON.parse(s) as { value?: unknown };
      if (parsed && typeof parsed === "object" && parsed.value != null) {
        const n = Number(parsed.value);
        if (Number.isFinite(n)) return { kind: "num", n };
      }
    } catch {
      /* not JSON */
    }
  }

  if (/^-?\d+(\.\d+)?$/.test(s)) {
    const n = Number(s);
    if (Number.isFinite(n)) return { kind: "num", n };
  }

  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const t = Date.parse(s);
    if (!Number.isNaN(t)) return { kind: "date", t };
  }

  return { kind: "str", s };
}

function compareSortable(a: SortableMetafield, b: SortableMetafield): number {
  if (a.kind === "empty" && b.kind === "empty") return 0;
  if (a.kind === "empty") return 1;
  if (b.kind === "empty") return -1;
  if (a.kind === "num" && b.kind === "num") return a.n - b.n;
  if (a.kind === "date" && b.kind === "date") return a.t - b.t;
  const as = a.kind === "str" ? a.s : a.kind === "num" ? String(a.n) : String(a.t);
  const bs = b.kind === "str" ? b.s : b.kind === "num" ? String(b.n) : String(b.t);
  return as.localeCompare(bs, undefined, { sensitivity: "base" });
}

function sortByMetafield(
  products: ProductFacetRow[],
  option: MetafieldSortOption,
): ProductFacetRow[] {
  return [...products].sort((left, right) => {
    const cmp = compareSortable(
      parseSortableMetafield(metafieldRawForSort(left, option)),
      parseSortableMetafield(metafieldRawForSort(right, option)),
    );
    if (cmp !== 0) return cmp;
    return left.title.localeCompare(right.title, undefined, {
      sensitivity: "base",
    });
  });
}

export function sortProductRows(
  products: ProductFacetRow[],
  sort: string,
  options?: {
    preserveOrder?: boolean;
    inStockOnTop?: boolean;
    soldOutToBottom?: boolean;
    metafieldSort?: MetafieldSortOption;
  },
): ProductFacetRow[] {
  let ordered: ProductFacetRow[];
  if (options?.metafieldSort && options.metafieldSort.key === sort) {
    ordered = sortByMetafield(products, options.metafieldSort);
  } else if (options?.preserveOrder && sort === "manual") {
    ordered = [...products];
  } else {
    const copy = [...products];
    const time = (row: ProductFacetRow) =>
      row.publishedAt ? row.publishedAt.getTime() : 0;
    switch (sort) {
      case "title_asc":
        ordered = copy.sort((a, b) =>
          a.title.localeCompare(b.title, undefined, { sensitivity: "base" }),
        );
        break;
      case "title_desc":
        ordered = copy.sort((a, b) =>
          b.title.localeCompare(a.title, undefined, { sensitivity: "base" }),
        );
        break;
      case "price_asc":
        ordered = copy.sort((a, b) => a.priceMin - b.priceMin);
        break;
      case "price_desc":
        ordered = copy.sort((a, b) => b.priceMax - a.priceMax);
        break;
      case "date_desc":
        ordered = copy.sort((a, b) => time(b) - time(a));
        break;
      case "date_asc":
        ordered = copy.sort((a, b) => time(a) - time(b));
        break;
      case "sale_pct_desc":
        ordered = copy.sort((a, b) => (b.salePct ?? 0) - (a.salePct ?? 0));
        break;
      case "manual":
      default:
        ordered = copy.sort(
          (a, b) => (a.sortPosition ?? 0) - (b.sortPosition ?? 0),
        );
        break;
    }
  }
  return applyStockPinning(ordered, options);
}

/** Keep C4 relative order inside in-stock and OOS groups. */
export function applyStockPinning<T extends { available: boolean }>(
  products: T[],
  options?: { inStockOnTop?: boolean; soldOutToBottom?: boolean },
): T[] {
  const pinTop = Boolean(options?.inStockOnTop);
  const pinBottom = Boolean(options?.soldOutToBottom);
  if (!pinTop && !pinBottom) return products;
  const inStock = products.filter((product) => product.available);
  const soldOut = products.filter((product) => !product.available);
  return [...inStock, ...soldOut];
}

export function resolveStorefrontSort(input: {
  requested?: string | null;
  enabled: SortOptionKey[];
  defaultSort: string;
  isSearch?: boolean;
  metafieldSortKeys?: string[];
}): { sort: string; preserveOrder: boolean } {
  const fallback = parseSortOption(input.defaultSort);
  const requestedRaw =
    typeof input.requested === "string" ? input.requested.trim() : "";
  const metafieldSortKeys = input.metafieldSortKeys ?? [];
  const isBuiltin = SORT_OPTION_KEYS.includes(requestedRaw as SortOptionKey);
  const isMetafieldSort = metafieldSortKeys.includes(requestedRaw);
  const requestedAllowed =
    Boolean(requestedRaw) &&
    ((isBuiltin &&
      (!input.enabled.length ||
        input.enabled.includes(requestedRaw as SortOptionKey))) ||
      isMetafieldSort);
  const enabled = input.enabled;
  const sort = requestedAllowed
    ? requestedRaw
    : enabled.length
      ? enabled.includes(fallback)
        ? fallback
        : enabled[0]
      : fallback;
  const preserveOrder = Boolean(input.isSearch) && sort === "manual";
  return { sort, preserveOrder };
}
