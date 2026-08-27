/**
 * Cross-cutting numeric limits used by sync, search, filters, and storefront payloads.
 * Prefer these over bare literals so related call sites stay in sync.
 */

/** Truncate free-text samples (metafields, URLs, selected values). */
export const SAMPLE_TEXT_MAX = 500;

/** Debounce collection rebuilds after product membership churn. */
export const COLLECTION_REBUILD_DELAY_MS = 2000;

/** BullMQ exponential backoff base delay. */
export const QUEUE_BACKOFF_DELAY_MS = 2000;

/** Standard delay for admin search / typeahead that hits the server. */
export const SEARCH_DEBOUNCE_MS = 300;

/**
 * Treat a facet as size-like when this fraction of values parse as apparel sizes.
 * Mirrored in the theme widget (`SIZE_FACET_MATCH_RATIO`).
 */
export const SIZE_FACET_MATCH_RATIO = 0.6;

/** Offset so numeric sizes (e.g. "32") sort after letter sizes (XS–XXL). */
export const SIZE_NUMERIC_RANK_BASE = 1000;

/** Cap for manually ordered facet values stored on a filter option. */
export const VALUE_SORT_MANUAL_MAX = 200;

/** Search candidate pool: at least floor, else take × multiplier, capped by CANDIDATE_TAKE. */
export const SEARCH_CANDIDATE_MULTIPLIER = 10;
export const SEARCH_CANDIDATE_FLOOR = 80;

export const MS_PER_DAY = 86_400_000;
