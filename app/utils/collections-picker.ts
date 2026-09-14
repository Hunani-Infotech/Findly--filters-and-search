export const COLLECTION_PICKER_PAGE_SIZE = 50;
export const COLLECTION_PICKER_BROWSE_SIZE = 25;
export const COLLECTION_PICKER_QUERY_MAX = 100;
const PAGE_SIZE_MIN = 10;
const PAGE_SIZE_MAX = 100;

export type CollectionChoice = {
  collectionGid: string;
  title: string;
  handle: string;
};

export type CollectionPickerPage = {
  collections: CollectionChoice[];
  included: CollectionChoice[];
  page: number;
  pageSize: number;
  total: number;
  hasNext: boolean;
  query: string;
};

export function normalizeCollectionPickerPage(value: unknown, fallback = 1) {
  const page = Math.floor(Number(value));
  return Number.isFinite(page) && page >= 1 ? page : fallback;
}

export function normalizeCollectionPickerPageSize(
  value: unknown,
  fallback = COLLECTION_PICKER_PAGE_SIZE,
) {
  const size = Math.floor(Number(value));
  if (!Number.isFinite(size)) return fallback;
  return Math.min(PAGE_SIZE_MAX, Math.max(PAGE_SIZE_MIN, size));
}

export function normalizeCollectionPickerQuery(value: unknown) {
  return String(value || "")
    .trim()
    .slice(0, COLLECTION_PICKER_QUERY_MAX);
}
