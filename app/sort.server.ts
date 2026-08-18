import type { ProductFacetRow } from "./filters.server";
import {
  SORT_OPTION_KEYS,
  parseSortOption,
  type SortOptionKey,
} from "./app-settings";

export function sortProductRows(
  products: ProductFacetRow[],
  sort: SortOptionKey,
  options?: {
    preserveOrder?: boolean;
    inStockOnTop?: boolean;
    soldOutToBottom?: boolean;
  },
): ProductFacetRow[] {
  let ordered: ProductFacetRow[];
  if (options?.preserveOrder && sort === "manual") {
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
}): { sort: SortOptionKey; preserveOrder: boolean } {
  const fallback = parseSortOption(input.defaultSort);
  const requestedRaw =
    typeof input.requested === "string" ? input.requested.trim() : "";
  const requested = SORT_OPTION_KEYS.includes(requestedRaw as SortOptionKey)
    ? (requestedRaw as SortOptionKey)
    : null;
  const enabled = input.enabled;
  const sort = requested && (!enabled.length || enabled.includes(requested))
    ? requested
    : enabled.length
      ? enabled.includes(fallback)
        ? fallback
        : enabled[0]
      : fallback;
  const preserveOrder = Boolean(input.isSearch) && sort === "manual";
  return { sort, preserveOrder };
}
