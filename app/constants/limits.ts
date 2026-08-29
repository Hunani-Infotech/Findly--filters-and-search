/**
 * Cross-cutting numeric limits used by sync, search, filters, and storefront payloads.
 * Prefer these over bare literals so related call sites stay in sync.
 */

/** Truncate free-text samples (metafields, URLs, selected values). */
export const SAMPLE_TEXT_MAX = 500;

/** Debounce collection rebuilds after product membership churn. */
export const COLLECTION_REBUILD_DELAY_MS = 2000;

/** Queue exponential backoff base delay (matches former BullMQ setting). */
export const QUEUE_BACKOFF_DELAY_MS = 2000;

/** Cap for exponential backoff after repeated failures. */
export const QUEUE_MAX_BACKOFF_MS = 15 * 60 * 1000;

/**
 * Requeue jobs stuck in `processing` longer than this (crashed worker).
 * Matches former BullMQ lockDuration (30m).
 */
export const QUEUE_STALE_LOCK_MS = 30 * 60 * 1000;

/** How often the in-process / nohup worker polls for due jobs. */
export const QUEUE_POLL_INTERVAL_MS = 2000;

/** Soft cap per poll so one Hostinger cron/tick cannot claim more than it can finish. */
export const QUEUE_CLAIM_BATCH_MAX = 5;

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
