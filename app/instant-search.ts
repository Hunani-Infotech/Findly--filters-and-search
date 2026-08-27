import { SAMPLE_TEXT_MAX } from "./limits";
import { DEFAULT_STOP_WORDS, STOP_WORD_MAX } from "./search-query";

export const INSTANT_LAYOUTS = [
  "overlay",
  "dropdown_two",
  "dropdown_one",
] as const;

export type InstantLayout = (typeof INSTANT_LAYOUTS)[number];

export const INSTANT_LAYOUT_LABELS: Record<InstantLayout, string> = {
  overlay: "Overlay full width",
  dropdown_two: "Dropdown two columns",
  dropdown_one: "Dropdown one column",
};

export const INSTANT_PRODUCT_STYLES = ["grid", "carousel"] as const;

export type InstantProductStyle = (typeof INSTANT_PRODUCT_STYLES)[number];

export const INSTANT_PRODUCT_STYLE_LABELS: Record<InstantProductStyle, string> = {
  grid: "Grid view",
  carousel: "Carousel view",
};

export type InstantSearchWidget = {
  enabled: boolean;
  layout: InstantLayout;
  productStyle: InstantProductStyle;
  maxProducts: number;
  showPrice: boolean;
  showVendor: boolean;
  showProducts: boolean;
  showCollections: boolean;
  showBlogPosts: boolean;
  showPages: boolean;
};

export type SearchPinning = {
  query: string;
  handles: string[];
};

export type SearchSynonymGroup = {
  terms: string[];
  mode: "equivalence" | "inferred";
};

export type SearchRedirect = {
  query: string;
  url: string;
};

export type SearchExtras = {
  fuzzyTextSearch: boolean;
  spellCheck: boolean;
  fallbackSearch: boolean;
  stopWords: string[];
  popularSearchTerms: string[];
  instant: InstantSearchWidget;
  pinnings: SearchPinning[];
  synonyms: SearchSynonymGroup[];
  redirects: SearchRedirect[];
};

export const INSTANT_MAX_PRODUCTS_MIN = 1;
export const INSTANT_MAX_PRODUCTS_MAX = 24;
export const POPULAR_TERM_MAX = 24;
export const MERCH_LIST_MAX = 40;

/** Used when `stopWords` is omitted from stored extras. Default extras keep `[]`. */
export const DEFAULT_ENGLISH_STOP_WORDS = DEFAULT_STOP_WORDS;

export const DEFAULT_INSTANT_SEARCH: InstantSearchWidget = {
  enabled: false,
  layout: "dropdown_one",
  productStyle: "grid",
  maxProducts: 6,
  showPrice: true,
  showVendor: false,
  showProducts: true,
  showCollections: true,
  showBlogPosts: false,
  showPages: false,
};

export const DEFAULT_SEARCH_EXTRAS: SearchExtras = {
  fuzzyTextSearch: true,
  spellCheck: true,
  fallbackSearch: true,
  stopWords: [],
  popularSearchTerms: [],
  instant: { ...DEFAULT_INSTANT_SEARCH },
  pinnings: [],
  synonyms: [],
  redirects: [],
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function parseInstantLayout(value: unknown): InstantLayout {
  return INSTANT_LAYOUTS.includes(value as InstantLayout)
    ? (value as InstantLayout)
    : DEFAULT_INSTANT_SEARCH.layout;
}

export function parseInstantProductStyle(value: unknown): InstantProductStyle {
  return INSTANT_PRODUCT_STYLES.includes(value as InstantProductStyle)
    ? (value as InstantProductStyle)
    : DEFAULT_INSTANT_SEARCH.productStyle;
}

export function parseMaxProducts(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return DEFAULT_INSTANT_SEARCH.maxProducts;
  return Math.round(
    Math.min(
      INSTANT_MAX_PRODUCTS_MAX,
      Math.max(INSTANT_MAX_PRODUCTS_MIN, n),
    ),
  );
}

export function normalizeSearchQueryKey(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, " ").slice(0, 80).toLowerCase();
}

/** Admin form input — no pattern validation; search runtime uses `normalizeStopWords`. */
export function normalizeStopWordList(value: unknown): string[] {
  const parts = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[\n,]+/)
      : [];
  const seen = new Set<string>();
  const next: string[] = [];
  for (const part of parts) {
    if (typeof part !== "string") continue;
    const word = part.trim().toLowerCase().replace(/\s+/g, " ");
    if (!word || seen.has(word)) continue;
    seen.add(word);
    next.push(word);
    if (next.length >= STOP_WORD_MAX) break;
  }
  return next;
}

export function stripStopWordsFromQuery(
  query: string,
  stopWords: readonly string[],
): string {
  const raw = query.trim().replace(/\s+/g, " ");
  if (!raw || stopWords.length === 0) return raw;
  const stops = new Set(stopWords.map((word) => word.toLowerCase()));
  const tokens = raw.split(" ").filter(Boolean);
  const kept = tokens.filter((token) => !stops.has(token.toLowerCase()));
  return (kept.length ? kept : tokens).join(" ");
}

export function normalizePopularTerms(value: unknown): string[] {
  const parts = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[\n,]+/)
      : [];
  const seen = new Set<string>();
  const next: string[] = [];
  for (const part of parts) {
    if (typeof part !== "string") continue;
    const term = part.trim().replace(/\s+/g, " ").slice(0, 60);
    if (!term) continue;
    const key = term.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    next.push(term);
    if (next.length >= POPULAR_TERM_MAX) break;
  }
  return next;
}

function normalizeUrl(value: unknown): string {
  if (typeof value !== "string") return "";
  const raw = value.trim();
  if (!raw) return "";
  if (raw.startsWith("/")) return raw.slice(0, SAMPLE_TEXT_MAX);
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    return url.toString().slice(0, SAMPLE_TEXT_MAX);
  } catch {
    return "";
  }
}

export function parseInstantWidget(value: unknown): InstantSearchWidget {
  const o = asRecord(value);
  return {
    enabled: o.enabled === true,
    layout: parseInstantLayout(o.layout),
    productStyle: parseInstantProductStyle(o.productStyle),
    maxProducts: parseMaxProducts(o.maxProducts),
    showPrice: o.showPrice !== false,
    showVendor: o.showVendor === true,
    showProducts: o.showProducts !== false,
    showCollections: o.showCollections !== false,
    showBlogPosts: o.showBlogPosts === true,
    showPages: o.showPages === true,
  };
}

export function parsePinnings(value: unknown): SearchPinning[] {
  if (!Array.isArray(value)) return [];
  const next: SearchPinning[] = [];
  const seen = new Set<string>();
  for (const row of value) {
    const o = asRecord(row);
    const query = normalizeSearchQueryKey(o.query);
    if (!query || seen.has(query)) continue;
    const handles = Array.isArray(o.handles)
      ? o.handles
          .filter((h): h is string => typeof h === "string")
          .map((h) => h.trim().toLowerCase())
          .filter((h) => /^[a-z0-9][a-z0-9-]*$/.test(h))
          .slice(0, 12)
      : [];
    if (handles.length === 0) continue;
    seen.add(query);
    next.push({ query, handles });
    if (next.length >= MERCH_LIST_MAX) break;
  }
  return next;
}

export function parseSynonyms(value: unknown): SearchSynonymGroup[] {
  if (!Array.isArray(value)) return [];
  const next: SearchSynonymGroup[] = [];
  for (const row of value) {
    const o = asRecord(row);
    const terms = Array.isArray(o.terms)
      ? o.terms
          .filter((t): t is string => typeof t === "string")
          .map((t) => t.trim().replace(/\s+/g, " ").slice(0, 60))
          .filter(Boolean)
      : [];
    const unique: string[] = [];
    const seen = new Set<string>();
    for (const term of terms) {
      const key = term.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(term);
    }
    if (unique.length < 2) continue;
    next.push({
      terms: unique.slice(0, 12),
      mode: o.mode === "inferred" ? "inferred" : "equivalence",
    });
    if (next.length >= MERCH_LIST_MAX) break;
  }
  return next;
}

export function parseRedirects(value: unknown): SearchRedirect[] {
  if (!Array.isArray(value)) return [];
  const next: SearchRedirect[] = [];
  const seen = new Set<string>();
  for (const row of value) {
    const o = asRecord(row);
    const query = normalizeSearchQueryKey(o.query);
    const url = normalizeUrl(o.url);
    if (!query || !url || seen.has(query)) continue;
    seen.add(query);
    next.push({ query, url });
    if (next.length >= MERCH_LIST_MAX) break;
  }
  return next;
}

export function parseSearchExtras(value: unknown): SearchExtras {
  const o = asRecord(value);
  return {
    fuzzyTextSearch: o.fuzzyTextSearch !== false,
    spellCheck: o.spellCheck !== false,
    fallbackSearch: o.fallbackSearch !== false,
    stopWords: Array.isArray(o.stopWords)
      ? normalizeStopWordList(o.stopWords)
      : [...DEFAULT_ENGLISH_STOP_WORDS],
    popularSearchTerms: normalizePopularTerms(o.popularSearchTerms),
    instant: parseInstantWidget(o.instant),
    pinnings: parsePinnings(o.pinnings),
    synonyms: parseSynonyms(o.synonyms),
    redirects: parseRedirects(o.redirects),
  };
}

export function expandQueryWithSynonyms(
  query: string,
  groups: SearchSynonymGroup[],
): string[] {
  const normalized = normalizeSearchQueryKey(query);
  if (!normalized) return [];
  const variants = new Set<string>([normalized]);
  for (const group of groups) {
    const keys = group.terms.map((t) => t.toLowerCase());
    const hitIndex = keys.indexOf(normalized);
    if (hitIndex < 0) {
      const tokenHit = keys.find((key) =>
        normalized.split(" ").includes(key),
      );
      if (!tokenHit) continue;
      const source = group.mode === "inferred" ? keys[0] : tokenHit;
      if (group.mode === "inferred" && tokenHit !== source) continue;
      for (const term of group.terms) {
        variants.add(
          normalized
            .split(" ")
            .map((tok) => (tok === tokenHit ? term.toLowerCase() : tok))
            .join(" "),
        );
      }
      continue;
    }
    if (group.mode === "inferred" && hitIndex !== 0) continue;
    for (const term of group.terms) {
      variants.add(term.toLowerCase());
    }
  }
  return [...variants];
}

export function matchingPopularTerms(
  query: string,
  terms: string[],
  limit = 6,
): string[] {
  const q = normalizeSearchQueryKey(query);
  if (!q) return terms.slice(0, limit);
  return terms
    .filter((term) => term.toLowerCase().includes(q) || q.includes(term.toLowerCase()))
    .slice(0, limit);
}
