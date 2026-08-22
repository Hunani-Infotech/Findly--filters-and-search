/** Default page size for admin tables (filters, groups, merch rows). */
export const ADMIN_TABLE_PAGE_SIZE = 10;

/** Catalog value pickers (tags, vendors, metafield values). */
export const ADMIN_CATALOG_PAGE_SIZE = 50;

export type PagedSlice<T> = {
  pageCount: number;
  safePage: number;
  start: number;
  paged: T[];
  showingFrom: number;
  showingTo: number;
  total: number;
};

export function slicePage<T>(
  items: T[],
  page: number,
  pageSize = ADMIN_TABLE_PAGE_SIZE,
): PagedSlice<T> {
  const size = Math.max(1, pageSize);
  const total = items.length;
  const pageCount = Math.max(1, Math.ceil(total / size));
  const safePage = Math.min(Math.max(0, page), pageCount - 1);
  const start = safePage * size;
  const paged = items.slice(start, start + size);
  return {
    pageCount,
    safePage,
    start,
    paged,
    showingFrom: paged.length === 0 ? 0 : start + 1,
    showingTo: start + paged.length,
    total,
  };
}

/** Reorder a visible page, then write that subset back into the full list. */
export function reorderWithinSubset(
  full: string[],
  subset: string[],
  from: number,
  to: number,
): string[] {
  if (from === to || from < 0 || to < 0 || to >= subset.length) return full;
  const nextVisible = [...subset];
  const [item] = nextVisible.splice(from, 1);
  nextVisible.splice(to, 0, item);
  const visSet = new Set(subset);
  let index = 0;
  return full.map((id) => (visSet.has(id) ? nextVisible[index++] : id));
}

export function lastPageIndex(count: number, pageSize = ADMIN_TABLE_PAGE_SIZE) {
  if (count <= 0) return 0;
  return Math.max(0, Math.ceil(count / pageSize) - 1);
}
