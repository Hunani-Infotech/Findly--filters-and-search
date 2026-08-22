import type { Prisma, ProductFacet } from "@prisma/client";
import {
  normalizeHandleList,
  normalizeHideProductTags,
  normalizeSearchFields,
  type SearchFieldKey,
} from "./app-settings";
import prisma from "./db.server";
import { excludeHiddenTaggedProducts, metafieldListValues } from "./filters.server";
import {
  expandQueryWithSynonyms,
  matchingPopularTerms,
  normalizeSearchQueryKey,
  parseSearchExtras,
} from "./instant-search";
import { getAppSettings } from "./settings.server";
import { mappingAppliesToSearch } from "./metafield-applies";
import {
  DEFAULT_STOP_WORDS,
  editDistance,
  maxTypoDistance,
  normalizeStopWords,
  prepareSearchTokens,
  searchableTextFromProduct,
  tokenMatchesHaystack,
  type SearchMatchMode,
} from "./search-query";
import { getMetafieldMappings } from "./shop.server";
import { createTtlCache } from "./read-cache.server";

export {
  DEFAULT_STOP_WORDS,
  editDistance,
  maxTypoDistance,
  prepareSearchTokens,
} from "./search-query";

const DEFAULT_TAKE = 24;
const MAX_TAKE = 48;
const FACET_DEFAULT_TAKE = 200;
const FACET_MAX_TAKE = 500;
const MAX_QUERY_LENGTH = 80;
const CANDIDATE_TAKE = 500;

function toNumber(value: { toNumber?: () => number } | number | string | null | undefined): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  if (value && typeof value.toNumber === "function") return value.toNumber();
  return Number(value);
}

export function normalizeSearchQuery(q: string): string {
  return q.trim().replace(/\s+/g, " ").slice(0, MAX_QUERY_LENGTH);
}

function containsInsensitive(haystack: string, needle: string) {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

function flattenedOptionValues(options: unknown): string[] {
  if (!options || typeof options !== "object" || Array.isArray(options)) return [];
  const values: string[] = [];
  for (const entry of Object.values(options as Record<string, unknown>)) {
    if (!Array.isArray(entry)) continue;
    for (const value of entry) {
      if (value != null && String(value)) values.push(String(value));
    }
  }
  return values;
}

export function enabledMetafieldPaths(
  mappings: Array<{
    enabled?: boolean;
    appliesTo?: unknown;
    namespace: string;
    key: string;
  }>,
): string[] {
  return mappings
    .filter((mapping) => mappingAppliesToSearch(mapping))
    .map((mapping) => `${mapping.namespace}.${mapping.key}`);
}

function metafieldRecord(
  metafields: ProductFacet["metafields"],
): Record<string, unknown> {
  if (!metafields || typeof metafields !== "object" || Array.isArray(metafields)) {
    return {};
  }
  return metafields as Record<string, unknown>;
}

function metafieldsMatch(
  row: Pick<ProductFacet, "metafields" | "variantMetafields">,
  query: string,
  paths: string[],
): boolean {
  if (paths.length === 0) return false;
  const records = [
    metafieldRecord(row.metafields),
    metafieldRecord(row.variantMetafields),
  ];
  for (const record of records) {
    for (const path of paths) {
      const raw = record[path];
      const values = metafieldListValues(raw == null ? null : String(raw));
      if (values.some((value) => containsInsensitive(value, query))) {
        return true;
      }
    }
  }
  return false;
}

type SearchableRow = Pick<
  ProductFacet,
  | "title"
  | "vendor"
  | "productType"
  | "tags"
  | "skus"
  | "options"
  | "metafields"
  | "variantMetafields"
>;

export function fieldMatches(
  row: SearchableRow,
  field: SearchFieldKey,
  query: string,
  metafieldPaths: string[] = [],
): boolean {
  switch (field) {
    case "title":
      return containsInsensitive(row.title, query);
    case "vendor":
      return containsInsensitive(row.vendor, query);
    case "productType":
      return containsInsensitive(row.productType, query);
    case "tags":
      return row.tags.some((tag) => containsInsensitive(tag, query));
    case "sku":
      return row.skus.some((sku) => containsInsensitive(sku, query));
    case "options":
      return flattenedOptionValues(row.options).some((value) =>
        containsInsensitive(value, query),
      );
    case "metafields":
      return metafieldsMatch(row, query, metafieldPaths);
    case "collectionTitle":
      return false;
    default:
      return false;
  }
}

function metafieldHaystack(
  row: Pick<ProductFacet, "metafields" | "variantMetafields">,
  paths: string[],
): string {
  if (paths.length === 0) return "";
  const values: string[] = [];
  const records = [
    metafieldRecord(row.metafields),
    metafieldRecord(row.variantMetafields),
  ];
  for (const record of records) {
    for (const path of paths) {
      const raw = record[path];
      values.push(...metafieldListValues(raw == null ? null : String(raw)));
    }
  }
  return values.join(" ");
}

function fieldHaystack(
  row: SearchableRow,
  field: SearchFieldKey,
  metafieldPaths: string[],
): string {
  switch (field) {
    case "title":
      return row.title;
    case "vendor":
      return row.vendor;
    case "productType":
      return row.productType;
    case "tags":
      return row.tags.join(" ");
    case "sku":
      return row.skus.join(" ");
    case "options":
      return flattenedOptionValues(row.options).join(" ");
    case "metafields":
      return metafieldHaystack(row, metafieldPaths);
    default:
      return "";
  }
}

export function rowMatchesSearchTokens(
  row: SearchableRow,
  tokens: string[],
  fields: SearchFieldKey[],
  metafieldPaths: string[],
  fuzzy: boolean,
  mode: SearchMatchMode = "and",
): boolean {
  if (tokens.length === 0 || fields.length === 0) return false;
  const tokenHits = (token: string) =>
    fields.some((field) =>
      fuzzy
        ? tokenMatchesHaystack(
            fieldHaystack(row, field, metafieldPaths),
            token,
            true,
          )
        : fieldMatches(row, field, token, metafieldPaths),
    );
  return mode === "or" ? tokens.some(tokenHits) : tokens.every(tokenHits);
}

/** True when any enabled search field contains the query (C7 collection scope). */
export function productMatchesKeyword(
  row: SearchableRow,
  query: string,
  fields: readonly string[] = [],
  metafieldPaths: string[] = [],
  options?: {
    stopWords?: readonly string[];
    fuzzy?: boolean;
    fallback?: boolean;
  },
): boolean {
  const enabled = normalizeSearchFields(fields);
  const tokens = prepareSearchTokens(
    query,
    options?.stopWords ?? DEFAULT_STOP_WORDS,
  );
  if (tokens.length === 0 || enabled.length === 0) return false;
  if (
    rowMatchesSearchTokens(row, tokens, enabled, metafieldPaths, false, "and")
  ) {
    return true;
  }
  if (
    options?.fuzzy &&
    rowMatchesSearchTokens(row, tokens, enabled, metafieldPaths, true, "and")
  ) {
    return true;
  }
  if (options?.fallback) {
    if (
      rowMatchesSearchTokens(row, tokens, enabled, metafieldPaths, false, "or")
    ) {
      return true;
    }
    if (
      rowMatchesSearchTokens(row, tokens, enabled, metafieldPaths, true, "or")
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Score = weight of the first matching enabled field in merchant order.
 * Weight is (n - index) so earlier fields outrank later ones. Ties sort by title ASC.
 */
function scoreSearchHit(
  row: SearchableRow,
  query: string,
  fields: SearchFieldKey[],
  metafieldPaths: string[],
): number {
  const n = fields.length;
  for (let index = 0; index < fields.length; index++) {
    if (fieldMatches(row, fields[index], query, metafieldPaths)) {
      return n - index;
    }
  }
  return 0;
}

/** Shared Prisma `where` for keyword search (B1–B3). Array fields need post-filter substring match. */
export function keywordSearchWhere(
  shopId: string,
  normalizedQuery: string,
  fields: readonly string[] = [],
): Prisma.ProductFacetWhereInput {
  const tokens = prepareSearchTokens(normalizedQuery);
  if (tokens.length === 0) {
    return { shopId, id: "__no_search_fields__" };
  }
  return keywordSearchWhereForTokens(shopId, tokens, fields, "and");
}

export function keywordSearchWhereForTokens(
  shopId: string,
  tokens: string[],
  fields: readonly string[] = [],
  mode: "and" | "or" = "and",
): Prisma.ProductFacetWhereInput {
  const enabled = normalizeSearchFields(fields);
  if (enabled.length === 0 || tokens.length === 0) {
    return { shopId, id: "__no_search_fields__" };
  }

  const needsScan =
    enabled.includes("tags") ||
    enabled.includes("sku") ||
    enabled.includes("options") ||
    enabled.includes("metafields");

  if (needsScan) {
    return { shopId, status: "ACTIVE" };
  }

  const tokenClauses: Prisma.ProductFacetWhereInput[] = [];
  for (const tok of tokens) {
    const or: Prisma.ProductFacetWhereInput[] = [];
    if (enabled.includes("title")) {
      or.push({ title: { contains: tok, mode: "insensitive" } });
    }
    if (enabled.includes("vendor")) {
      or.push({ vendor: { contains: tok, mode: "insensitive" } });
    }
    if (enabled.includes("productType")) {
      or.push({
        productType: { contains: tok, mode: "insensitive" },
      });
    }
    if (or.length > 0) tokenClauses.push({ OR: or });
  }

  if (tokenClauses.length === 0) {
    return { shopId, id: "__no_search_fields__" };
  }

  if (mode === "or") {
    return { shopId, status: "ACTIVE", OR: tokenClauses };
  }
  if (tokenClauses.length === 1) {
    return { shopId, status: "ACTIVE", ...tokenClauses[0] };
  }
  return { shopId, status: "ACTIVE", AND: tokenClauses };
}

function hitScore(
  row: SearchableRow,
  tokens: string[],
  fields: SearchFieldKey[],
  metafieldPaths: string[],
): number {
  const phrase = tokens.join(" ");
  let best = scoreSearchHit(row, phrase, fields, metafieldPaths);
  for (const token of tokens) {
    const next = scoreSearchHit(row, token, fields, metafieldPaths);
    if (next > best) best = next;
  }
  return best;
}

function rankHits(
  rows: ProductFacet[],
  tokens: string[],
  fields: SearchFieldKey[],
  metafieldPaths: string[],
  fuzzy: boolean,
  mode: SearchMatchMode,
) {
  return rows
    .filter((row) =>
      rowMatchesSearchTokens(row, tokens, fields, metafieldPaths, fuzzy, mode),
    )
    .map((row) => ({
      row,
      score: hitScore(row, tokens, fields, metafieldPaths) || 1,
    }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.row.title.localeCompare(b.row.title);
    });
}

type RankedHitsResult = {
  rows: ProductFacet[];
  tokens: string[];
  usedFallback: boolean;
  didYouMean: string | null;
};

const rankedHitsCache = createTtlCache<RankedHitsResult>(10_000);

function uniqueTokenSets(sets: string[][]): string[][] {
  const seen = new Set<string>();
  const next: string[][] = [];
  for (const tokens of sets) {
    if (tokens.length === 0) continue;
    const key = tokens.join("\0");
    if (seen.has(key)) continue;
    seen.add(key);
    next.push(tokens);
  }
  return next;
}

function mergeRanked(
  merged: Map<string, { row: ProductFacet; score: number }>,
  hits: Array<{ row: ProductFacet; score: number }>,
) {
  for (const hit of hits) {
    const current = merged.get(hit.row.productGid);
    if (!current || hit.score > current.score) {
      merged.set(hit.row.productGid, hit);
    }
  }
}

function sortedMergedRows(
  merged: Map<string, { row: ProductFacet; score: number }>,
): ProductFacet[] {
  return [...merged.values()]
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.row.title.localeCompare(b.row.title);
    })
    .map((hit) => hit.row);
}

function didYouMeanFromHit(
  tokens: string[],
  firstHit: SearchableRow,
): string | null {
  const hay = searchableTextFromProduct({
    title: firstHit.title,
    vendor: firstHit.vendor,
    productType: firstHit.productType,
    tags: firstHit.tags,
    skus: firstHit.skus,
  }).toLowerCase();
  const words = hay.split(/[^a-z0-9']+/).filter(Boolean);
  const corrected: string[] = [];
  let changed = false;
  for (const token of tokens) {
    const tok = token.toLowerCase();
    if (hay.includes(tok)) {
      corrected.push(token);
      continue;
    }
    const max = maxTypoDistance(tok.length);
    let best: string | null = null;
    let bestDist = Infinity;
    for (const word of words) {
      const dist = editDistance(word, tok);
      if (dist <= max && dist < bestDist) {
        bestDist = dist;
        best = word;
      }
    }
    if (best && best !== tok) {
      corrected.push(best);
      changed = true;
    } else {
      corrected.push(token);
    }
  }
  return changed ? corrected.join(" ") : null;
}

async function fetchRankedHits(
  shopId: string,
  query: string,
  take: number,
): Promise<RankedHitsResult> {
  return rankedHitsCache.wrap(`${shopId}:${query}:${take}`, () =>
    fetchRankedHitsUncached(shopId, query, take),
  );
}

async function fetchRankedHitsUncached(
  shopId: string,
  query: string,
  take: number,
): Promise<RankedHitsResult> {
  const empty: RankedHitsResult = {
    rows: [],
    tokens: [],
    usedFallback: false,
    didYouMean: null,
  };
  const settings = await getAppSettings(shopId);
  const extras = parseSearchExtras(settings.searchExtras);
  const stopWords = normalizeStopWords(
    (extras as { stopWords?: unknown }).stopWords,
  );
  const fuzzyOn = extras.fuzzyTextSearch !== false;
  const fallbackOn =
    (extras as { fallbackSearch?: boolean }).fallbackSearch !== false;
  const spellCheckOn =
    (extras as { spellCheck?: boolean }).spellCheck !== false;
  const fields = normalizeSearchFields(settings.searchFields);
  const tokens = prepareSearchTokens(query, stopWords);
  if (fields.length === 0) return { ...empty, tokens };

  const metafieldPaths = fields.includes("metafields")
    ? enabledMetafieldPaths(await getMetafieldMappings(shopId))
    : [];

  const tokenSets = uniqueTokenSets(
    expandQueryWithSynonyms(query, extras.synonyms).map((variant) =>
      prepareSearchTokens(variant, stopWords),
    ),
  );
  if (tokenSets.length === 0) return { ...empty, tokens };

  const candidateTake = Math.max(take, CANDIDATE_TAKE);

  const hitsForTokens = async (
    fuzzy: boolean,
    mode: SearchMatchMode,
  ): Promise<ProductFacet[]> => {
    const merged = new Map<string, { row: ProductFacet; score: number }>();
    let scanned: ProductFacet[] | null = null;
    if (fuzzy) {
      scanned = await prisma.productFacet.findMany({
        where: { shopId, status: "ACTIVE" },
        take: CANDIDATE_TAKE,
      });
    }
    for (const set of tokenSets) {
      const rows =
        scanned ??
        (await prisma.productFacet.findMany({
          where: keywordSearchWhereForTokens(shopId, set, fields, mode),
          take: candidateTake,
        }));
      mergeRanked(
        merged,
        rankHits(rows, set, fields, metafieldPaths, fuzzy, mode),
      );
    }
    return sortedMergedRows(merged);
  };

  let ranked = await hitsForTokens(false, "and");
  let usedFallback = false;
  if (ranked.length === 0 && fuzzyOn) {
    ranked = await hitsForTokens(true, "and");
  }
  if (ranked.length === 0 && fallbackOn) {
    usedFallback = true;
    ranked = await hitsForTokens(false, "or");
    if (ranked.length === 0 && fuzzyOn) {
      ranked = await hitsForTokens(true, "or");
    }
  }

  const pinning = extras.pinnings.find(
    (row) => row.query === normalizeSearchQueryKey(query),
  );
  if (pinning && pinning.handles.length > 0) {
    ranked = await applyPinnedHandles(shopId, ranked, pinning.handles);
  }

  ranked = excludeHiddenTaggedProducts(
    ranked,
    normalizeHideProductTags(settings.hideProductTags),
  );

  const rows = ranked.slice(0, take);
  const didYouMean =
    spellCheckOn && rows[0] ? didYouMeanFromHit(tokens, rows[0]) : null;

  return { rows, tokens, usedFallback, didYouMean };
}

async function applyPinnedHandles(
  shopId: string,
  ranked: ProductFacet[],
  handles: string[],
): Promise<ProductFacet[]> {
  const pinnedRows = await prisma.productFacet.findMany({
    where: { shopId, status: "ACTIVE", handle: { in: handles } },
  });
  const byHandle = new Map(pinnedRows.map((row) => [row.handle, row]));
  const pinned: ProductFacet[] = [];
  const seen = new Set<string>();
  for (const handle of handles) {
    const row = byHandle.get(handle);
    if (!row || seen.has(row.productGid)) continue;
    seen.add(row.productGid);
    pinned.push(row);
  }
  const rest = ranked.filter((row) => !seen.has(row.productGid));
  return [...pinned, ...rest];
}

export async function searchCollections(
  shopId: string,
  query: string,
  options?: { take?: number },
) {
  const normalized = normalizeSearchQuery(query);
  if (!normalized) return [];
  const take = Math.min(Math.max(options?.take ?? 6, 1), 24);
  const rows = await prisma.collection.findMany({
    where: {
      shopId,
      title: { contains: normalized, mode: "insensitive" },
    },
    take,
    orderBy: { title: "asc" },
  });
  return rows.map((row) => ({
    handle: row.handle,
    title: row.title,
    url: `/collections/${row.handle}`,
  }));
}

export async function searchPages(
  shopId: string,
  query: string,
  options?: { take?: number },
) {
  const normalized = normalizeSearchQuery(query);
  if (!normalized) return [];
  const take = Math.min(Math.max(options?.take ?? 6, 1), 24);
  const rows = await prisma.shopPage.findMany({
    where: {
      shopId,
      published: true,
      title: { contains: normalized, mode: "insensitive" },
    },
    take,
    orderBy: { title: "asc" },
  });
  return rows.map((row) => ({
    title: row.title,
    handle: row.handle,
    url: row.handle ? `/pages/${row.handle}` : "/pages",
  }));
}

export async function searchArticles(
  shopId: string,
  query: string,
  options?: { take?: number },
) {
  const normalized = normalizeSearchQuery(query);
  if (!normalized) return [];
  const take = Math.min(Math.max(options?.take ?? 6, 1), 24);
  const rows = await prisma.shopArticle.findMany({
    where: {
      shopId,
      published: true,
      title: { contains: normalized, mode: "insensitive" },
    },
    take,
    orderBy: { title: "asc" },
  });
  return rows.map((row) => ({
    title: row.title,
    handle: row.handle,
    url:
      row.blogHandle && row.handle
        ? `/blogs/${row.blogHandle}/${row.handle}`
        : row.handle
          ? `/blogs/${row.handle}`
          : "/blogs",
  }));
}

export function popularQuerySuggestions(
  query: string,
  terms: string[],
  limit = 6,
) {
  return matchingPopularTerms(query, terms, limit).map((term) => ({
    query: term,
    url: `/search?q=${encodeURIComponent(term)}`,
  }));
}

export type SearchRunMeta = {
  didYouMean: string | null;
  usedFallback: boolean;
  tokens: string[];
};

export async function searchProductsWithMeta(
  shopId: string,
  query: string,
  options?: { take?: number },
): Promise<{
  products: ReturnType<typeof toSearchProductCard>[];
  meta: SearchRunMeta;
}> {
  const normalized = normalizeSearchQuery(query);
  if (!normalized) {
    return {
      products: [],
      meta: { didYouMean: null, usedFallback: false, tokens: [] },
    };
  }

  const take = Math.min(Math.max(options?.take ?? DEFAULT_TAKE, 1), MAX_TAKE);
  const result = await fetchRankedHits(shopId, normalized, take);
  return {
    products: result.rows.map(toSearchProductCard),
    meta: {
      didYouMean: result.didYouMean,
      usedFallback: result.usedFallback,
      tokens: result.tokens,
    },
  };
}

export async function searchProducts(
  shopId: string,
  query: string,
  options?: { take?: number },
) {
  const { products } = await searchProductsWithMeta(shopId, query, options);
  return products;
}

function toSearchProductCard(row: ProductFacet) {
  return {
    productGid: row.productGid,
    handle: row.handle,
    title: row.title,
    vendor: row.vendor,
    productType: row.productType,
    priceMin: toNumber(row.priceMin),
    priceMax: toNumber(row.priceMax),
    imageUrl: row.imageUrl,
    available: row.available,
    marketPrices: row.marketPrices,
  };
}

export type SearchSuggestionProduct = ReturnType<typeof toSearchProductCard>;

export type SearchSuggestionCollection = {
  handle: string;
  title: string;
  url: string;
};

/** Merchant-pinned products/collections for empty focus and zero-result states (C9). */
export async function getPinnedSearchSuggestions(shopId: string): Promise<{
  products: SearchSuggestionProduct[];
  collections: SearchSuggestionCollection[];
}> {
  const settings = await getAppSettings(shopId);
  const productHandles = normalizeHandleList(settings.suggestionProductHandles);
  const collectionHandles = normalizeHandleList(
    settings.suggestionCollectionHandles,
  );

  const products: SearchSuggestionProduct[] = [];
  if (productHandles.length > 0) {
    const rows = await prisma.productFacet.findMany({
      where: {
        shopId,
        status: "ACTIVE",
        handle: { in: productHandles },
      },
    });
    const visible = excludeHiddenTaggedProducts(
      rows,
      normalizeHideProductTags(settings.hideProductTags),
    );
    const byHandle = new Map(visible.map((row) => [row.handle, row]));
    for (const handle of productHandles) {
      const row = byHandle.get(handle);
      if (row) products.push(toSearchProductCard(row));
    }
  }

  const collections: SearchSuggestionCollection[] = [];
  if (collectionHandles.length > 0) {
    const rows = await prisma.collection.findMany({
      where: { shopId, handle: { in: collectionHandles } },
    });
    const byHandle = new Map(rows.map((row) => [row.handle, row]));
    for (const handle of collectionHandles) {
      const row = byHandle.get(handle);
      if (!row) continue;
      collections.push({
        handle: row.handle,
        title: row.title,
        url: `/collections/${row.handle}`,
      });
    }
  }

  return { products, collections };
}

/** Full ProductFacet rows for search-page filters (tags/options/metafields/price). */
export async function searchProductFacets(
  shopId: string,
  query: string,
  options?: { take?: number },
) {
  const normalized = normalizeSearchQuery(query);
  if (!normalized) {
    return [];
  }

  const take = Math.min(
    Math.max(options?.take ?? FACET_DEFAULT_TAKE, 1),
    FACET_MAX_TAKE,
  );
  const result = await fetchRankedHits(shopId, normalized, take);
  return result.rows;
}
