import type { Prisma, ProductFacet } from "@prisma/client";
import {
  normalizeHandleList,
  normalizeSearchFields,
  type SearchFieldKey,
} from "./app-settings";
import prisma from "./db.server";
import { metafieldListValues } from "./filters.server";
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
  const fields = normalizeSearchFields(settings.searchFields);
  if (fields.length === 0) return [];

  const metafieldPaths = fields.includes("metafields")
    ? enabledMetafieldPaths(await getMetafieldMappings(shopId))
    : [];

  const rows = await prisma.productFacet.findMany({
    where: keywordSearchWhere(shopId, query, fields),
    take: Math.max(take, CANDIDATE_TAKE),
  });

  return rankHits(rows, query, fields, metafieldPaths).slice(0, take);
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
