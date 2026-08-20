import type { Prisma, ProductFacet } from "@prisma/client";
import {
  normalizeHandleList,
  normalizeSearchFields,
  type SearchFieldKey,
} from "./app-settings";
import prisma from "./db.server";
import { metafieldListValues } from "./filters.server";
import {
  expandQueryWithSynonyms,
  matchingPopularTerms,
  normalizeSearchQueryKey,
  parseSearchExtras,
} from "./instant-search";
import { getAppSettings } from "./settings.server";
import { getMetafieldMappings } from "./shop.server";

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
  mappings: Array<{ enabled: boolean; namespace: string; key: string }>,
): string[] {
  return mappings
    .filter((mapping) => mapping.enabled)
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
  row: Pick<ProductFacet, "metafields">,
  query: string,
  paths: string[],
): boolean {
  if (paths.length === 0) return false;
  const record = metafieldRecord(row.metafields);
  for (const path of paths) {
    const raw = record[path];
    const values = metafieldListValues(raw == null ? null : String(raw));
    if (values.some((value) => containsInsensitive(value, query))) {
      return true;
    }
  }
  return false;
}

type SearchableRow = Pick<
  ProductFacet,
  "title" | "vendor" | "productType" | "tags" | "skus" | "options" | "metafields"
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

/** True when any enabled search field contains the query (C7 collection scope). */
export function productMatchesKeyword(
  row: SearchableRow,
  query: string,
  fields: readonly string[] = [],
  metafieldPaths: string[] = [],
): boolean {
  const normalized = normalizeSearchQuery(query);
  const enabled = normalizeSearchFields(fields);
  if (!normalized || enabled.length === 0) return false;
  return enabled.some((field) =>
    fieldMatches(row, field, normalized, metafieldPaths),
  );
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
  const enabled = normalizeSearchFields(fields);
  if (enabled.length === 0) {
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

  const or: Prisma.ProductFacetWhereInput[] = [];
  if (enabled.includes("title")) {
    or.push({ title: { contains: normalizedQuery, mode: "insensitive" } });
  }
  if (enabled.includes("vendor")) {
    or.push({ vendor: { contains: normalizedQuery, mode: "insensitive" } });
  }
  if (enabled.includes("productType")) {
    or.push({
      productType: { contains: normalizedQuery, mode: "insensitive" },
    });
  }

  if (or.length === 0) {
    return { shopId, id: "__no_search_fields__" };
  }

  return { shopId, status: "ACTIVE", OR: or };
}

function rankHits(
  rows: ProductFacet[],
  query: string,
  fields: SearchFieldKey[],
  metafieldPaths: string[],
) {
  return rows
    .map((row) => ({
      row,
      score: scoreSearchHit(row, query, fields, metafieldPaths),
    }))
    .filter((hit) => hit.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.row.title.localeCompare(b.row.title);
    })
    .map((hit) => hit.row);
}

async function fetchRankedHits(
  shopId: string,
  query: string,
  take: number,
): Promise<ProductFacet[]> {
  const settings = await getAppSettings(shopId);
  const extras = parseSearchExtras(settings.searchExtras);
  const fields = normalizeSearchFields(settings.searchFields);
  if (fields.length === 0) return [];

  const metafieldPaths = fields.includes("metafields")
    ? enabledMetafieldPaths(await getMetafieldMappings(shopId))
    : [];

  const variants = expandQueryWithSynonyms(query, extras.synonyms);
  const merged = new Map<string, { row: ProductFacet; score: number }>();

  for (const variant of variants) {
    const rows = await prisma.productFacet.findMany({
      where: keywordSearchWhere(shopId, variant, fields),
      take: Math.max(take, CANDIDATE_TAKE),
    });
    for (const hit of rankHits(rows, variant, fields, metafieldPaths)) {
      const current = merged.get(hit.productGid);
      const score = scoreSearchHit(hit, variant, fields, metafieldPaths);
      if (!current || score > current.score) {
        merged.set(hit.productGid, { row: hit, score });
      }
    }
  }

  let ranked = [...merged.values()]
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.row.title.localeCompare(b.row.title);
    })
    .map((hit) => hit.row);

  if (ranked.length === 0 && extras.fuzzyTextSearch) {
    ranked = await fuzzySearchHits(shopId, query, fields, metafieldPaths, take);
  }

  const pinning = extras.pinnings.find(
    (row) => row.query === normalizeSearchQueryKey(query),
  );
  if (pinning && pinning.handles.length > 0) {
    ranked = await applyPinnedHandles(shopId, ranked, pinning.handles);
  }

  return ranked.slice(0, take);
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

function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > 2) return 99;
  const rows = a.length + 1;
  const cols = b.length + 1;
  const dp: number[] = new Array(rows * cols);
  for (let i = 0; i < rows; i++) dp[i * cols] = i;
  for (let j = 0; j < cols; j++) dp[j] = j;
  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i * cols + j] = Math.min(
        dp[(i - 1) * cols + j] + 1,
        dp[i * cols + j - 1] + 1,
        dp[(i - 1) * cols + j - 1] + cost,
      );
    }
  }
  return dp[a.length * cols + b.length];
}

function fuzzyFieldMatch(haystack: string, query: string): boolean {
  const hay = haystack.toLowerCase();
  const needle = query.toLowerCase();
  if (hay.includes(needle)) return true;
  if (needle.length < 4) return false;
  const words = hay.split(/[^a-z0-9]+/).filter(Boolean);
  return words.some((word) => {
    if (Math.abs(word.length - needle.length) > 2) return false;
    return editDistance(word, needle) <= 1;
  });
}

async function fuzzySearchHits(
  shopId: string,
  query: string,
  fields: SearchFieldKey[],
  metafieldPaths: string[],
  take: number,
): Promise<ProductFacet[]> {
  const rows = await prisma.productFacet.findMany({
    where: { shopId, status: "ACTIVE" },
    take: CANDIDATE_TAKE,
  });
  return rows
    .filter((row) =>
      fields.some((field) => {
        if (field === "title") return fuzzyFieldMatch(row.title, query);
        if (field === "vendor") return fuzzyFieldMatch(row.vendor, query);
        if (field === "productType") {
          return fuzzyFieldMatch(row.productType, query);
        }
        return fieldMatches(row, field, query, metafieldPaths);
      }),
    )
    .slice(0, take);
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

export async function searchProducts(
  shopId: string,
  query: string,
  options?: { take?: number },
) {
  const normalized = normalizeSearchQuery(query);
  if (!normalized) {
    return [];
  }

  const take = Math.min(Math.max(options?.take ?? DEFAULT_TAKE, 1), MAX_TAKE);
  const rows = await fetchRankedHits(shopId, normalized, take);

  return rows.map(toSearchProductCard);
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
    const byHandle = new Map(rows.map((row) => [row.handle, row]));
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
  return fetchRankedHits(shopId, normalized, take);
}
