import crypto from "node:crypto";
import { Prisma, type FilterConfig, type MetafieldMapping } from "@prisma/client";
import prisma from "./db.server";
import {
  applyHideOutOfStock,
  buildFacetAggregations,
  excludeHiddenTaggedProducts,
  expandFacetsWithOptions,
  facetsFromConfig,
  matchingVariantImageUrl,
  parseRangeBounds,
  parseValueSort,
  parseVariantImages,
  productMatchesFilters,
  selectedOptionFilterGroups,
  type ProductFacetRow,
  type SelectedFilters,
} from "./filters.server";
import { applyFacetValueFilter, applyFacetValueLabel, parseFacetSettings } from "./facet-settings";
import {
  listMetafieldSortOptions,
  resolveStorefrontSort,
  sortProductRows,
} from "./sort.server";
import {
  normalizeHideProductTags,
  normalizeSearchFields,
  normalizeSortOptions,
  parsePaginationStyle,
  parseSortOption,
} from "./app-settings";
import { getFilterConfig, getMetafieldMappings, normalizeMetafieldOwnerType } from "./shop.server";
import { mappingAppliesToFilter } from "./metafield-applies";
import { swatchMapForShop } from "./color-swatches.server";
import {
  expandSelectedWithGroups,
  listValueGroups,
  mergeFacetValuesWithGroups,
  sourceKeyForFacet,
} from "./value-groups.server";
import { optionKeyFromName } from "./filter-catalog";
import {
  expandProductsAsVariants,
  parseStoredVariants,
  shopifyNumericId,
  variantCardKey,
} from "./variants-as-products";
import { getAppSettings, settingsFromRow } from "./settings.server";
import { sanitizeCustomCss, sanitizeProductListLiquid, scopeCustomCss } from "./widget-code";
import { resolveFilterLimit } from "./billing.server";
import { getAdminNavExtras, type AdminNavExtras } from "./admin-nav-extras.server";
import { resolveWidgetChrome } from "./widget-i18n";
import { withWidgetChrome } from "./filters.server";
import {
  COLLECTION_FACET_KEY,
  isAllProductsCollectionHandle,
  nestCollectionValues,
  parseCollectionParents,
  withCollectionMeta,
  type ShopCollection,
} from "./collection-facet";
import {
  enabledMetafieldPaths,
  normalizeSearchQuery,
  getPinnedSearchSuggestions,
  popularQuerySuggestions,
  productMatchesKeyword,
  searchCollections,
  searchPages,
  searchArticles,
  searchProductFacets,
  searchProductsWithMeta,
} from "./search.server";
import {
  normalizeSearchQueryKey,
  parseSearchExtras,
  stripStopWordsFromQuery,
} from "./instant-search";
import { applyMarketPricesToRow, parseMarketContext } from "./markets.server";
import { getCatalogGeneration } from "./catalog-cache.server";
import { findShopByIdCached, findShopCached } from "./shop-cache.server";
import { createTtlCache } from "./read-cache.server";

/** Verify Shopify App Proxy signature (HMAC SHA256 of sorted query params). */
function hmacMessageFromSearchParams(searchParams: URLSearchParams): string {
  const params: string[] = [];
  searchParams.forEach((value, key) => {
    if (key !== "signature") params.push(`${key}=${value}`);
  });
  params.sort();
  return params.join("");
}

function hmacMessageFromRawQuery(search: string): string {
  const raw = search.startsWith("?") ? search.slice(1) : search;
  const params: string[] = [];
  for (const part of raw.split("&")) {
    if (!part) continue;
    const eq = part.indexOf("=");
    const encodedKey = eq === -1 ? part : part.slice(0, eq);
    const encodedValue = eq === -1 ? "" : part.slice(eq + 1);
    let key = encodedKey;
    let value = encodedValue;
    try {
      key = decodeURIComponent(encodedKey.replace(/\+/g, " "));
      value = decodeURIComponent(encodedValue.replace(/\+/g, " "));
    } catch {
      key = encodedKey;
      value = encodedValue;
    }
    if (key === "signature") continue;
    params.push(`${key}=${value}`);
  }
  params.sort();
  return params.join("");
}

function hmacMessageFromRawQueryEncoded(search: string): string {
  const raw = search.startsWith("?") ? search.slice(1) : search;
  const params: string[] = [];
  for (const part of raw.split("&")) {
    if (!part) continue;
    const eq = part.indexOf("=");
    const encodedKey = eq === -1 ? part : part.slice(0, eq);
    const encodedValue = eq === -1 ? "" : part.slice(eq + 1);
    if (encodedKey === "signature") continue;
    params.push(`${encodedKey}=${encodedValue}`);
  }
  params.sort();
  return params.join("");
}

function signaturesMatch(digest: string, signature: string): boolean {
  try {
    const left = Buffer.from(digest, "utf8");
    const right = Buffer.from(signature, "utf8");
    if (left.length !== right.length) return false;
    return crypto.timingSafeEqual(left, right);
  } catch {
    return false;
  }
}

export function verifyAppProxySignature(url: URL): boolean {
  const secret = process.env.SHOPIFY_API_SECRET;
  if (!secret) return false;

  const signature = url.searchParams.get("signature");
  if (!signature) return false;

  const messages = [
    hmacMessageFromSearchParams(url.searchParams),
    hmacMessageFromRawQuery(url.search),
    hmacMessageFromRawQueryEncoded(url.search),
  ];
  return messages.some((message) => {
    const digest = crypto.createHmac("sha256", secret).update(message).digest("hex");
    return signaturesMatch(digest, signature);
  });
}

export const FILTER_PAGE_SIZE_MAX = 48;
export const FILTER_PAGE_SIZE_DEFAULT = 24;

const FILTER_PAYLOAD_CACHE_TTL_MS = 45_000;
const FILTER_PAYLOAD_CACHE_MAX = 80;
const shopCollectionsCache = createTtlCache<ShopCollection[]>(45_000);
const collectionProductCountsCache = createTtlCache<Map<string, number>>(45_000);

function productFacetSelectForRequest(opts: {
  config: FilterConfig;
  mappings: MetafieldMapping[];
  enableMarkets: boolean;
  needsKeywordSearch: boolean;
  searchFields: string[];
  sort?: string | null;
}): Prisma.ProductFacetSelect {
  const variantSplit = Boolean(opts.config.enableVariantsAsProducts);
  const filterMappings = opts.mappings.filter((mapping) =>
    mappingAppliesToFilter(mapping),
  );
  const needMetafields =
    Boolean(opts.config.enableRating) ||
    filterMappings.length > 0 ||
    (opts.needsKeywordSearch && opts.searchFields.includes("metafields")) ||
    Boolean(opts.sort && String(opts.sort).startsWith("mf_"));
  const needVariantMetafields = filterMappings.some(
    (mapping) => normalizeMetafieldOwnerType(mapping.ownerType) === "VARIANT",
  );
  const select: Record<string, true> = {
    productGid: true,
    handle: true,
    title: true,
    vendor: true,
    productType: true,
    tags: true,
    options: true,
    priceMin: true,
    priceMax: true,
    available: true,
    status: true,
  };
  if (opts.config.enableSale) select.salePct = true;
  if (opts.config.enableLocation) select.inventoryLocations = true;
  if (needMetafields) select.metafields = true;
  if (needVariantMetafields) select.variantMetafields = true;
  if (opts.enableMarkets) select.marketPrices = true;
  if (variantSplit) select.variants = true;
  if (opts.needsKeywordSearch && opts.searchFields.includes("skus")) {
    select.skus = true;
  }
  if (opts.sort === "date_asc" || opts.sort === "date_desc") {
    select.publishedAt = true;
  }
  select.imageUrl = true;
  return select as Prisma.ProductFacetSelect;
}

function selectFingerprint(select: Prisma.ProductFacetSelect) {
  return Object.entries(select)
    .filter(([, enabled]) => Boolean(enabled))
    .map(([key]) => key)
    .sort()
    .join(",");
}

/** Whitelist of ProductFacet columns allowed in the collection JOIN. */
const FACET_SQL_COLUMNS: Record<string, string> = {
  productGid: 'pf."productGid"',
  handle: 'pf."handle"',
  title: 'pf."title"',
  vendor: 'pf."vendor"',
  productType: 'pf."productType"',
  tags: 'pf."tags"',
  skus: 'pf."skus"',
  options: 'pf."options"',
  priceMin: 'pf."priceMin"',
  priceMax: 'pf."priceMax"',
  compareAtMin: 'pf."compareAtMin"',
  compareAtMax: 'pf."compareAtMax"',
  salePct: 'pf."salePct"',
  available: 'pf."available"',
  inventoryLocations: 'pf."inventoryLocations"',
  status: 'pf."status"',
  imageUrl: 'pf."imageUrl"',
  variantImages: 'pf."variantImages"',
  variants: 'pf."variants"',
  metafields: 'pf."metafields"',
  variantMetafields: 'pf."variantMetafields"',
  marketPrices: 'pf."marketPrices"',
  publishedAt: 'pf."publishedAt"',
};

type CollectionFacetDbRow = {
  productGid: string;
  handle?: string;
  title?: string;
  vendor?: string;
  productType?: string;
  tags?: string[];
  skus?: string[];
  options?: unknown;
  priceMin?: string | number | { toNumber?: () => number } | null;
  priceMax?: string | number | { toNumber?: () => number } | null;
  compareAtMin?: string | number | { toNumber?: () => number } | null;
  compareAtMax?: string | number | { toNumber?: () => number } | null;
  salePct?: string | number | { toNumber?: () => number } | null;
  available?: boolean;
  inventoryLocations?: unknown;
  status?: string | null;
  imageUrl?: string | null;
  variantImages?: unknown;
  variants?: unknown;
  metafields?: unknown;
  variantMetafields?: unknown;
  marketPrices?: unknown;
  publishedAt?: Date | null;
  position: number | null;
};

function selectedFacetColumnSql(select: Prisma.ProductFacetSelect): Prisma.Sql[] {
  const cols: Prisma.Sql[] = [];
  const seen = new Set<string>();
  for (const [key, enabled] of Object.entries(select)) {
    if (!enabled) continue;
    const expr = FACET_SQL_COLUMNS[key];
    if (!expr || seen.has(expr)) continue;
    seen.add(expr);
    cols.push(Prisma.raw(expr));
  }
  if (!seen.has(FACET_SQL_COLUMNS.productGid)) {
    cols.unshift(Prisma.raw(FACET_SQL_COLUMNS.productGid));
  }
  return cols;
}

async function loadCollectionProductFacetsUncached(
  shopId: string,
  collectionGid: string,
  select: Prisma.ProductFacetSelect,
): Promise<CollectionFacetDbRow[]> {
  const columns = selectedFacetColumnSql(select);
  if (!columns.length) return [];
  return prisma.$queryRaw<CollectionFacetDbRow[]>(Prisma.sql`
    SELECT ${Prisma.join(columns)}, cm."position" AS "position"
    FROM "CollectionMembership" cm
    INNER JOIN "ProductFacet" pf
      ON pf."shopId" = cm."shopId" AND pf."productGid" = cm."productGid"
    WHERE cm."shopId" = ${shopId}
      AND cm."collectionGid" = ${collectionGid}
  `);
}

const collectionFacetCache = createTtlCache<CollectionFacetDbRow[]>(45_000);
const shopProductFacetCache = createTtlCache<CollectionFacetDbRow[]>(45_000);

async function catalogGenerationForShopId(shopId: string): Promise<string> {
  const shop = await findShopByIdCached(shopId);
  if (!shop) return "0";
  return getCatalogGeneration(shop.domain);
}

async function loadCollectionProductFacets(
  shopId: string,
  collectionGid: string,
  select: Prisma.ProductFacetSelect,
) {
  const gen = await catalogGenerationForShopId(shopId);
  return collectionFacetCache.wrap(
    `${gen}:${shopId}:${collectionGid}:${selectFingerprint(select)}`,
    () => loadCollectionProductFacetsUncached(shopId, collectionGid, select),
  );
}

async function loadShopProductFacetsUncached(
  shopId: string,
  select: Prisma.ProductFacetSelect,
): Promise<CollectionFacetDbRow[]> {
  const columns = selectedFacetColumnSql(select);
  if (!columns.length) return [];
  return prisma.$queryRaw<CollectionFacetDbRow[]>(Prisma.sql`
    SELECT ${Prisma.join(columns)}, 0 AS "position"
    FROM "ProductFacet" pf
    WHERE pf."shopId" = ${shopId}
  `);
}

async function loadShopProductFacets(
  shopId: string,
  select: Prisma.ProductFacetSelect,
) {
  const gen = await catalogGenerationForShopId(shopId);
  return shopProductFacetCache.wrap(
    `${gen}:${shopId}:all:${selectFingerprint(select)}`,
    () => loadShopProductFacetsUncached(shopId, select),
  );
}

type CachedFilterPayload = {
  expires: number;
  result: Awaited<ReturnType<typeof loadCollectionFilterPayload>>;
};

const filterPayloadCache = new Map<string, CachedFilterPayload>();

function pruneFilterPayloadCache() {
  const now = Date.now();
  for (const [key, entry] of filterPayloadCache) {
    if (entry.expires <= now) filterPayloadCache.delete(key);
  }
  if (filterPayloadCache.size <= FILTER_PAYLOAD_CACHE_MAX) return;
  const extra = filterPayloadCache.size - FILTER_PAYLOAD_CACHE_MAX;
  const keys = filterPayloadCache.keys();
  for (let i = 0; i < extra; i += 1) {
    const key = keys.next().value;
    if (key == null) break;
    filterPayloadCache.delete(key);
  }
}

export function clearFilterPayloadCache() {
  filterPayloadCache.clear();
  collectionProductCountsCache.deletePrefix("");
}

function collectionFilterCacheKey(input: {
  shopDomain: string;
  collectionId?: string | null;
  collectionGid?: string | null;
  collectionHandle?: string | null;
  selected: SelectedFilters;
  sort?: string | null;
  query?: string | null;
  locale?: string | null;
  page?: number;
  pageSize?: number;
  country?: string | null;
  currency?: string | null;
  companyLocationId?: string | null;
  company_location?: string | null;
}) {
  return JSON.stringify({
    shop: input.shopDomain,
    cid: input.collectionId || "",
    gid: input.collectionGid || "",
    handle: input.collectionHandle || "",
    selected: input.selected,
    sort: input.sort || "",
    query: input.query || "",
    locale: input.locale || "",
    page: input.page || 1,
    pageSize: input.pageSize || 0,
    country: input.country || "",
    currency: input.currency || "",
    loc: input.companyLocationId || input.company_location || "",
  });
}

/** 1-based page; invalid values become 1. */
export function parseFilterPage(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.floor(n);
}

/**
 * Omitted, empty, or 0 → no paging (return all matches).
 * Otherwise clamp to 1–48.
 */
export function parseFilterPageSize(value: unknown): number | undefined {
  if (value == null || value === "") return undefined;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return Math.min(FILTER_PAGE_SIZE_MAX, Math.max(1, Math.floor(n)));
}

function sliceFilterProducts<T>(
  products: T[],
  page: number | undefined,
  pageSize: number | undefined,
): {
  products: T[];
  total: number;
  page?: number;
  pageSize?: number;
  hasNext?: boolean;
} {
  const total = products.length;
  if (pageSize == null || pageSize <= 0) {
    return { products, total };
  }
  const size = Math.min(FILTER_PAGE_SIZE_MAX, Math.max(1, Math.floor(pageSize)));
  const p = Math.max(1, Math.floor(page ?? 1));
  const start = (p - 1) * size;
  const sliced = products.slice(start, start + size);
  return {
    products: sliced,
    total,
    page: p,
    pageSize: size,
    hasNext: start + size < total,
  };
}

type MarketRequestFields = {
  country?: string | null;
  currency?: string | null;
  companyLocationId?: string | null;
  company_location?: string | null;
};

function payloadCurrency(
  context: { currency?: string | null },
  rows: Array<{ currency?: string }>,
): string | undefined {
  if (context.currency) return context.currency;
  for (const row of rows) {
    if (row.currency) return row.currency;
  }
  return undefined;
}

function toRow(p: {
  productGid: string;
  handle?: string | null;
  title?: string | null;
  vendor?: string | null;
  productType?: string | null;
  tags?: string[] | null;
  options?: unknown;
  priceMin?: { toNumber?: () => number } | number | string | null;
  priceMax?: { toNumber?: () => number } | number | string | null;
  compareAtMin?: { toNumber?: () => number } | number | string | null;
  compareAtMax?: { toNumber?: () => number } | number | string | null;
  salePct?: { toNumber?: () => number } | number | string | null;
  available?: boolean | null;
  inventoryLocations?: unknown;
  status?: string | null;
  imageUrl?: string | null;
  variantImages?: unknown;
  variants?: unknown;
  metafields?: unknown;
  variantMetafields?: unknown;
  publishedAt?: Date | null;
}): ProductFacetRow {
  const num = (v: { toNumber?: () => number } | number | string | null | undefined) => {
    if (v == null || v === "") return 0;
    if (typeof v === "number") return v;
    if (typeof v === "string") return Number(v);
    if (typeof v.toNumber === "function") return v.toNumber();
    return Number(v);
  };

  return {
    productGid: p.productGid,
    handle: p.handle || "",
    title: p.title || "",
    vendor: p.vendor || "",
    productType: p.productType || "",
    tags: Array.isArray(p.tags) ? p.tags : [],
    options: (p.options as Record<string, string[]>) || {},
    priceMin: num(p.priceMin),
    priceMax: num(p.priceMax),
    compareAtMin:
      p.compareAtMin == null || p.compareAtMin === ""
        ? null
        : num(p.compareAtMin),
    compareAtMax:
      p.compareAtMax == null || p.compareAtMax === ""
        ? null
        : num(p.compareAtMax),
    salePct: p.salePct == null || p.salePct === "" ? 0 : num(p.salePct),
    available: Boolean(p.available),
    inventoryLocations: Array.isArray(p.inventoryLocations)
      ? p.inventoryLocations.filter((n) => typeof n === "string" && n)
      : [],
    status: p.status || "ACTIVE",
    imageUrl: p.imageUrl ?? null,
    variantImages: parseVariantImages(p.variantImages),
    variants: parseStoredVariants(p.variants),
    metafields: (p.metafields as Record<string, string>) || {},
    variantMetafields: (p.variantMetafields as Record<string, string>) || {},
    publishedAt: p.publishedAt ?? null,
    sortPosition: 0,
    collectionGids: [],
  };
}

async function loadShopCollections(shopId: string): Promise<ShopCollection[]> {
  const gen = await catalogGenerationForShopId(shopId);
  return shopCollectionsCache.wrap(`${gen}:${shopId}`, async () => {
    const rows = await prisma.collection.findMany({
      where: { shopId },
      select: { collectionGid: true, title: true, handle: true },
      orderBy: { title: "asc" },
      take: 400,
    });
    return rows.map((row) => ({
      collectionGid: row.collectionGid,
      title: row.title,
      handle: row.handle,
    }));
  });
}

/** Full product counts per collection (not overlap with the current page). */
async function loadCollectionProductCounts(
  shopId: string,
): Promise<Map<string, number>> {
  const gen = await catalogGenerationForShopId(shopId);
  return collectionProductCountsCache.wrap(`${gen}:${shopId}`, async () => {
    const rows = await prisma.$queryRaw<
      Array<{ collectionGid: string; count: number | bigint }>
    >(Prisma.sql`
      SELECT cm."collectionGid", COUNT(*)::int AS count
      FROM "CollectionMembership" cm
      INNER JOIN "ProductFacet" pf
        ON pf."shopId" = cm."shopId" AND pf."productGid" = cm."productGid"
      WHERE cm."shopId" = ${shopId}
        AND pf.status = 'ACTIVE'
      GROUP BY cm."collectionGid"
    `);
    const counts = new Map<string, number>();
    for (const row of rows) {
      counts.set(row.collectionGid, Number(row.count) || 0);
    }
    return counts;
  });
}

async function attachCollectionGids(
  shopId: string,
  rows: ProductFacetRow[],
): Promise<ProductFacetRow[]> {
  if (!rows.length) return rows;
  const memberships = await prisma.collectionMembership.findMany({
    where: {
      shopId,
      productGid: { in: rows.map((row) => row.productGid) },
    },
    select: { productGid: true, collectionGid: true },
  });
  const byProduct = new Map<string, string[]>();
  for (const row of memberships) {
    const list = byProduct.get(row.productGid) || [];
    list.push(row.collectionGid);
    byProduct.set(row.productGid, list);
  }
  return rows.map((row) => ({
    ...row,
    collectionGids: byProduct.get(row.productGid) || [],
  }));
}

const filterPayloadInflight = new Map<
  string,
  Promise<Awaited<ReturnType<typeof loadCollectionFilterPayload>>>
>();

export async function getCollectionFilterPayload(input: {
  shopDomain: string;
  collectionId?: string | null;
  collectionGid?: string | null;
  collectionHandle?: string | null;
  selected: SelectedFilters;
  sort?: string | null;
  query?: string | null;
  locale?: string | null;
  page?: number;
  pageSize?: number;
} & MarketRequestFields) {
  pruneFilterPayloadCache();
  const gen = await getCatalogGeneration(input.shopDomain);
  const cacheKey = `${gen}:${collectionFilterCacheKey(input)}`;
  const cached = filterPayloadCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    return cached.result;
  }
  const pending = filterPayloadInflight.get(cacheKey);
  if (pending) return pending;
  const promise = loadCollectionFilterPayload(input)
    .then((result) => {
      if (!("error" in result && result.error)) {
        filterPayloadCache.set(cacheKey, {
          expires: Date.now() + FILTER_PAYLOAD_CACHE_TTL_MS,
          result,
        });
      }
      filterPayloadInflight.delete(cacheKey);
      return result;
    })
    .catch((error) => {
      filterPayloadInflight.delete(cacheKey);
      throw error;
    });
  filterPayloadInflight.set(cacheKey, promise);
  return promise;
}

async function loadCollectionFilterPayload(input: {
  shopDomain: string;
  collectionId?: string | null;
  collectionGid?: string | null;
  collectionHandle?: string | null;
  selected: SelectedFilters;
  sort?: string | null;
  query?: string | null;
  locale?: string | null;
  page?: number;
  pageSize?: number;
} & MarketRequestFields) {
  const shop = await findShopCached(input.shopDomain);
  if (!shop) {
    return { error: "Shop not synced", status: 404 as const };
  }

  const collectionHandle = (input.collectionHandle || "").trim();
  const isAll = isAllProductsCollectionHandle(collectionHandle);
  let collectionGid =
    input.collectionGid ||
    (input.collectionId
      ? `gid://shopify/Collection/${input.collectionId}`
      : null);

  if (!collectionGid && collectionHandle) {
    const byHandle = await prisma.collection.findFirst({
      where: { shopId: shop.id, handle: collectionHandle },
      select: { collectionGid: true },
    });
    collectionGid = byHandle?.collectionGid ?? null;
  }

  if (!collectionGid && !isAll) {
    return { error: "collection_id required", status: 400 as const };
  }

  const [
    config,
    appSettings,
    mappings,
    filterLimit,
    valueGroups,
    swatches,
    navExtras,
  ] = await Promise.all([
    getFilterConfig(shop.id, collectionGid || ""),
    getAppSettings(shop.id),
    getMetafieldMappings(shop.id),
    resolveFilterLimit(shop.id),
    listValueGroups(shop.id),
    swatchMapForShop(shop.id),
    getAdminNavExtras(shop.id),
  ]);
  if (!config?.enabled) {
    const resolved = resolveWidgetChrome(navExtras.i18n, input.locale);
    return {
      data: {
        enabled: false,
        facets: [],
        products: [],
        total: 0,
        locale: resolved.locale,
        i18n: resolved.chrome,
      },
      status: 200 as const,
    };
  }

  const searchFields = normalizeSearchFields(appSettings.searchFields);
  const extras = parseSearchExtras(appSettings.searchExtras);
  const collectionQuery = appSettings.enableCollectionSearch
    ? normalizeSearchQuery(input.query ?? "")
    : "";
  const enableMarkets = appSettings.enableMarkets !== false;
  const facetSelect = productFacetSelectForRequest({
    config,
    mappings,
    enableMarkets,
    needsKeywordSearch: Boolean(collectionQuery),
    searchFields,
    sort: input.sort,
  });
  const productsDb = isAll
    ? await loadShopProductFacets(shop.id, facetSelect)
    : await loadCollectionProductFacets(shop.id, collectionGid as string, facetSelect);

  const metafieldPaths = searchFields.includes("metafields")
    ? enabledMetafieldPaths(mappings)
    : [];

  const keywordMatched = collectionQuery
    ? productsDb.filter((product) =>
        productMatchesKeyword(
          {
            title: product.title || "",
            vendor: product.vendor || "",
            productType: product.productType || "",
            tags: product.tags || [],
            skus: product.skus || [],
            options: (product.options as Record<string, string[]>) || {},
            metafields: (product.metafields as Record<string, string>) || {},
            variantMetafields:
              (product.variantMetafields as Record<string, string>) || {},
          },
          collectionQuery,
          searchFields,
          metafieldPaths,
          {
            stopWords: extras.stopWords,
            fuzzy: extras.fuzzyTextSearch,
            fallback: extras.fallbackSearch,
          },
        ),
      )
    : productsDb;

  const context = parseMarketContext(input);
  const allRows = keywordMatched
    .filter((product) => (product.status || "ACTIVE") === "ACTIVE")
    .map((product) => ({
      ...applyMarketPricesToRow(
        toRow(product),
        product.marketPrices,
        context,
        enableMarkets,
      ),
      sortPosition: product.position ?? 0,
    }));

  return buildFacetPayload({
    shopId: shop.id,
    config,
    rows: allRows,
    selected: input.selected,
    collectionGid,
    sort: input.sort,
    query: collectionQuery || null,
    locale: input.locale,
    page: input.page,
    pageSize: input.pageSize,
    currency: payloadCurrency(context, allRows),
    appSettings,
    extras: navExtras,
    mappings,
    filterLimit,
    valueGroups,
    swatches,
  });
}

async function buildFacetPayload(input: {
  shopId: string;
  config: FilterConfig;
  rows: ProductFacetRow[];
  selected: SelectedFilters;
  collectionGid?: string | null;
  query?: string | null;
  sort?: string | null;
  isSearch?: boolean;
  locale?: string | null;
  page?: number;
  pageSize?: number;
  currency?: string | null;
  appSettings?: Awaited<ReturnType<typeof getAppSettings>>;
  extras?: AdminNavExtras;
  mappings?: MetafieldMapping[];
  filterLimit?: number;
  valueGroups?: Awaited<ReturnType<typeof listValueGroups>>;
  swatches?: Awaited<ReturnType<typeof swatchMapForShop>>;
}) {
  const [mappings, appSettings, filterLimit, valueGroups, swatches, extras] =
    await Promise.all([
      input.mappings
        ? Promise.resolve(input.mappings)
        : getMetafieldMappings(input.shopId),
      input.appSettings
        ? Promise.resolve(input.appSettings)
        : prisma.appSettings
            .findUnique({ where: { shopId: input.shopId } })
            .then((row) => settingsFromRow(input.shopId, row)),
      input.filterLimit != null
        ? Promise.resolve(input.filterLimit)
        : resolveFilterLimit(input.shopId),
      input.valueGroups
        ? Promise.resolve(input.valueGroups)
        : listValueGroups(input.shopId),
      input.swatches
        ? Promise.resolve(input.swatches)
        : swatchMapForShop(input.shopId),
      input.extras
        ? Promise.resolve(input.extras)
        : getAdminNavExtras(input.shopId),
    ]);
  const { locale, chrome } = resolveWidgetChrome(extras.i18n, input.locale);
  const cappedMappings = mappings
    .filter((mapping) => mappingAppliesToFilter(mapping))
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .slice(0, filterLimit);
  const metafieldSortOptions = listMetafieldSortOptions(mappings);
  const settings = {
    showProductCounts: appSettings.showProductCounts,
    showTotalProductCount: appSettings.showTotalProductCount !== false,
    hideProductTags: normalizeHideProductTags(appSettings.hideProductTags),
    collapseByDefault: appSettings.collapseByDefault,
    hideOutOfStock: appSettings.hideOutOfStock,
    paginationStyle: parsePaginationStyle(
      (appSettings as { paginationStyle?: unknown }).paginationStyle,
    ),
    widgetPosition: appSettings.widgetPosition,
    accentColor: appSettings.accentColor,
    widgetShadow: appSettings.widgetShadow,
    widgetRadius: appSettings.widgetRadius,
    widgetFontMode: appSettings.widgetFontMode,
    widgetFontFamily: appSettings.widgetFontFamily,
    widgetTitle: appSettings.widgetTitle,
    widgetTitleSize: appSettings.widgetTitleSize,
    widgetTitleColor: appSettings.widgetTitleColor,
    sortOptionsEnabled: normalizeSortOptions(appSettings.sortOptionsEnabled),
    defaultSort: parseSortOption(appSettings.defaultSort),
    hideSortDropdown: Boolean(appSettings.hideSortDropdown),
    inStockOnTop: Boolean(appSettings.inStockOnTop),
    soldOutToBottom: Boolean(appSettings.soldOutToBottom),
    enableCollectionSearch: Boolean(appSettings.enableCollectionSearch),
    enableFiltersOnSearch: Boolean(appSettings.enableFiltersOnSearch ?? true),
    hideSingleValueFacets: Boolean(appSettings.hideSingleValueFacets),
    showMatchingVariantImage: Boolean(
      appSettings.showMatchingVariantImage ?? true,
    ),
    showRefineBy: Boolean(appSettings.showRefineBy ?? true),
    autoApplyFilters: appSettings.autoApplyFilters !== false,
    customCss: scopeCustomCss(sanitizeCustomCss(appSettings.customCss)),
    productListLiquid: sanitizeProductListLiquid(appSettings.productListLiquid),
    metafieldSortOptions,
    enableVariantsAsProducts: Boolean(
      (input.config as { enableVariantsAsProducts?: boolean })
        .enableVariantsAsProducts,
    ),
    ...(input.currency ? { currency: input.currency } : {}),
  };

  const visibleBase = excludeHiddenTaggedProducts(
    input.rows,
    normalizeHideProductTags(appSettings.hideProductTags),
  );
  const displayOrder = Array.isArray(input.config.displayOrder)
    ? (input.config.displayOrder as string[])
    : [];
  const wantsCollection = displayOrder.includes(COLLECTION_FACET_KEY);
  const selectedCollection = Boolean(
    input.selected &&
      Array.isArray(input.selected[COLLECTION_FACET_KEY]) &&
      input.selected[COLLECTION_FACET_KEY].length,
  );
  let visibleRows = visibleBase;
  let collectionCatalog: ShopCollection[] = [];
  let collectionTotals: Map<string, number> | null = null;
  if (wantsCollection || selectedCollection) {
    const [withGids, catalog, totals] = await Promise.all([
      attachCollectionGids(input.shopId, visibleBase),
      loadShopCollections(input.shopId),
      input.isSearch
        ? Promise.resolve(null)
        : loadCollectionProductCounts(input.shopId),
    ]);
    visibleRows = withGids;
    collectionCatalog = catalog;
    collectionTotals = totals;
  }
  const variantSplit = Boolean(
    (input.config as { enableVariantsAsProducts?: boolean })
      .enableVariantsAsProducts,
  );
  if (variantSplit && !input.isSearch) {
    visibleRows = expandProductsAsVariants(
      visibleRows,
      (input.config as { variantAsProductOptions?: string[] })
        .variantAsProductOptions || [],
    );
  }
  const resolved = resolveStorefrontSort({
    requested: input.sort,
    enabled: settings.sortOptionsEnabled,
    defaultSort: settings.defaultSort,
    isSearch: input.isSearch,
    metafieldSortKeys: metafieldSortOptions.map((option) => option.key),
  });

  const facetSettings = parseFacetSettings(
    input.config && "facetSettings" in input.config ? input.config.facetSettings : {},
  );
  const facets = expandFacetsWithOptions(
    facetsFromConfig(input.config, cappedMappings),
    visibleRows,
  ).map((facet) => {
    const custom = facetSettings[facet.key]?.label;
    return custom ? { ...facet, label: custom } : facet;
  });
  const selectedForMatch: SelectedFilters = { ...input.selected };
  for (const facet of facets) {
    const current = selectedForMatch[facet.key];
    if (!current?.length) continue;
    if ((facet.matchMode ?? "or") === "and") continue;
    const sourceKey = sourceKeyForFacet(facet);
    if (!sourceKey) continue;
    selectedForMatch[facet.key] = expandSelectedWithGroups(
      current,
      valueGroups,
      sourceKey,
    );
  }
  const matched = visibleRows.filter((product) =>
    productMatchesFilters(product, facets, selectedForMatch),
  );
  const filtered = sortProductRows(
    applyHideOutOfStock(
      matched,
      appSettings.hideOutOfStock,
      input.selected,
    ),
    resolved.sort,
    {
      preserveOrder: resolved.preserveOrder,
      inStockOnTop: appSettings.inStockOnTop,
      soldOutToBottom: appSettings.soldOutToBottom,
      metafieldSort: metafieldSortOptions.find(
        (option) => option.key === resolved.sort,
      ),
    },
  );
  const optionGroups = selectedOptionFilterGroups(facets, input.selected);
  const aggregations = withWidgetChrome(chrome, () =>
    buildFacetAggregations(visibleRows, facets, {
      mode: input.config.priceRangeMode,
      customMin: input.config.customPriceMin,
      customMax: input.config.customPriceMax,
    }, parseValueSort(
      input.config && "valueSort" in input.config ? input.config.valueSort : {},
    ), parseRangeBounds(
      input.config && "rangeBounds" in input.config ? input.config.rangeBounds : {},
    ), collectionCatalog, collectionTotals),
  ).map((facet) => {
    const sourceKey = sourceKeyForFacet(facet);
    const values = facet.values
      ? mergeFacetValuesWithGroups(facet.values, valueGroups, sourceKey)
      : facet.values;
    const optionKey = optionKeyFromName(
      facet.optionName || String(facet.key || "").replace(/^opt_/, ""),
    );
    const shopSwatches = swatches[optionKey] || {};
    const setting = facetSettings[facet.key] || {};
    let nextValues = values
      ?.filter((item) =>
        applyFacetValueFilter(facet.key, [item.value], facetSettings).includes(
          item.value,
        ),
      )
      .map((item) => {
        const labeled = {
          ...item,
          label: applyFacetValueLabel(facet.key, item.label, facetSettings),
        };
        const swatch = shopSwatches[item.value] || shopSwatches[labeled.label];
        return swatch ? { ...labeled, swatch } : labeled;
      });
    if (facet.source === "collection" && nextValues) {
      nextValues = withCollectionMeta(nextValues, collectionCatalog);
      if (setting.collectionTree) {
        nextValues = nestCollectionValues(
          nextValues,
          parseCollectionParents(setting.collectionParents),
        );
      }
    }
    return {
      ...facet,
      label: setting.label || facet.label,
      collectionTree: Boolean(setting.collectionTree),
      hasMergedValues: Boolean(
        valueGroups?.some((group) => group.sourceKey === sourceKey),
      ),
      values: nextValues,
    };
  });

  const productCard = (product: (typeof filtered)[number]) => {
    const variantId = shopifyNumericId(product.variantGid || "");
    const variantImage = product.variantGid
      ? product.imageUrl || ""
      : settings.showMatchingVariantImage
        ? matchingVariantImageUrl(product.variantImages ?? [], optionGroups)
        : "";
    return {
      id: product.variantGid || product.productGid,
      handle: product.handle,
      title: product.title,
      vendor: product.vendor,
      productType: product.productType,
      available: product.available,
      priceMin: product.priceMin,
      priceMax: product.priceMax,
      imageUrl: product.imageUrl,
      variantImageUrl: variantImage,
      variantId: variantId || undefined,
      cardKey: variantId
        ? variantCardKey(product.handle, product.variantGid || "")
        : product.handle,
      url: variantId
        ? `/products/${product.handle}?variant=${variantId}`
        : `/products/${product.handle}`,
    };
  };
  const productHandle = (product: (typeof filtered)[number]) => {
    const variantId = shopifyNumericId(product.variantGid || "");
    return variantId
      ? variantCardKey(product.handle, product.variantGid || "")
      : product.handle;
  };

  const pageSize = input.pageSize ?? FILTER_PAGE_SIZE_DEFAULT;
  const paged = sliceFilterProducts(filtered, input.page, pageSize);

  const data = {
    enabled: true as const,
    locale,
    i18n: chrome,
    settings,
    facets: aggregations,
    handles: filtered.map(productHandle),
    products: paged.products.map(productCard),
    sort: resolved.sort,
    total: paged.total,
    page: paged.page ?? 1,
    pageSize: paged.pageSize ?? pageSize,
    hasNext: paged.hasNext ?? false,
    ...(input.collectionGid != null ? { collectionGid: input.collectionGid } : {}),
    ...(input.query != null ? { query: input.query } : {}),
  };

  return {
    data,
    status: 200 as const,
  };
}

async function loadSearchFilterPayload(input: {
  shopDomain: string;
  query: string;
  selected: SelectedFilters;
  sort?: string | null;
  locale?: string | null;
  page?: number;
  pageSize?: number;
} & MarketRequestFields) {
  const shop = await findShopCached(input.shopDomain);
  if (!shop) {
    return { error: "Shop not synced", status: 404 as const };
  }

  const [
    appSettings,
    config,
    mappings,
    filterLimit,
    valueGroups,
    swatches,
    navExtras,
  ] = await Promise.all([
    getAppSettings(shop.id),
    getFilterConfig(shop.id, ""),
    getMetafieldMappings(shop.id),
    resolveFilterLimit(shop.id),
    listValueGroups(shop.id),
    swatchMapForShop(shop.id),
    getAdminNavExtras(shop.id),
  ]);
  if (!(appSettings.enableFiltersOnSearch ?? true)) {
    return {
      data: {
        enabled: false,
        facets: [],
        products: [],
        total: 0,
        settings: { enableFiltersOnSearch: false },
      },
      status: 200 as const,
    };
  }

  const query = normalizeSearchQuery(input.query);
  if (!query) {
    return {
      data: { enabled: true, query: "", facets: [], products: [], total: 0 },
      status: 200 as const,
    };
  }

  if (!config?.enabled) {
    return {
      data: { enabled: false, facets: [], products: [], total: 0 },
      status: 200 as const,
    };
  }

  const productsDb = await searchProductFacets(shop.id, query);
  const enableMarkets = appSettings.enableMarkets !== false;
  const context = parseMarketContext(input);
  const allRows = productsDb.map((product) =>
    applyMarketPricesToRow(
      toRow(product),
      product.marketPrices,
      context,
      enableMarkets,
    ),
  );

  return buildFacetPayload({
    shopId: shop.id,
    config,
    rows: allRows,
    selected: input.selected,
    query,
    sort: input.sort,
    isSearch: true,
    locale: input.locale,
    page: input.page,
    pageSize: input.pageSize,
    currency: payloadCurrency(context, allRows),
    appSettings,
    extras: navExtras,
    mappings,
    filterLimit,
    valueGroups,
    swatches,
  });
}

type SearchFilterPayload = Awaited<ReturnType<typeof loadSearchFilterPayload>>;
const searchPayloadCache = createTtlCache<SearchFilterPayload>(45_000);

export async function getSearchFilterPayload(
  input: Parameters<typeof loadSearchFilterPayload>[0],
) {
  const gen = await getCatalogGeneration(input.shopDomain);
  const cacheKey = `${gen}:search:${collectionFilterCacheKey({
    shopDomain: input.shopDomain,
    selected: input.selected,
    sort: input.sort,
    query: input.query,
    locale: input.locale,
    page: input.page,
    pageSize: input.pageSize,
    country: input.country,
    currency: input.currency,
    companyLocationId: input.companyLocationId,
  })}`;
  return searchPayloadCache.wrap(cacheKey, () => loadSearchFilterPayload(input));
}

export async function getInstantSearchWidgetPayload(
  input: {
    shopDomain: string;
  } & MarketRequestFields,
) {
  const shop = await findShopCached(input.shopDomain);
  if (!shop) {
    return { error: "Shop not synced", status: 404 as const };
  }
  const settings = await getAppSettings(shop.id);
  const extras = parseSearchExtras(settings.searchExtras);
  const context = parseMarketContext(input);
  return {
    data: {
      instant: extras.instant,
      fuzzyTextSearch: extras.fuzzyTextSearch,
      showSuggestionsOnEmptyQuery: settings.showSuggestionsOnEmptyQuery,
      showSuggestionsOnNoResults: settings.showSuggestionsOnNoResults,
      minChars: 2,
      ...(context.currency
        ? { settings: { currency: context.currency } }
        : {}),
    },
    status: 200 as const,
  };
}

export async function getSearchPayload(input: {
  shopDomain: string;
  query: string;
  locale?: string | null;
  take?: number;
} & MarketRequestFields) {
  const shop = await findShopCached(input.shopDomain);
  if (!shop) {
    return { error: "Shop not synced", status: 404 as const };
  }

  const settings = await getAppSettings(shop.id);
  const extras = parseSearchExtras(settings.searchExtras);
  const normalizedQuery = normalizeSearchQuery(input.query);
  const queryKey = normalizeSearchQueryKey(normalizedQuery);
  const redirect = extras.redirects.find((row) => row.query === queryKey);

  const take = Math.min(Math.max(input.take ?? 24, 1), 48);
  const collectionQuery = stripStopWordsFromQuery(
    input.query,
    extras.stopWords,
  );
  const fields = normalizeSearchFields(settings.searchFields);
  const wantCollections =
    extras.instant.showCollections || fields.includes("collectionTitle");

  const [{ products, meta }, liveCollections, pages, articles, extrasNav] =
    await Promise.all([
      searchProductsWithMeta(shop.id, input.query, { take }),
      wantCollections
        ? searchCollections(shop.id, collectionQuery, { take: 6 })
        : Promise.resolve([]),
      extras.instant.showPages
        ? searchPages(shop.id, input.query, { take: 6 })
        : Promise.resolve([]),
      extras.instant.showBlogPosts
        ? searchArticles(shop.id, input.query, { take: 6 })
        : Promise.resolve([]),
      getAdminNavExtras(shop.id),
    ]);

  const wantSuggestions =
    (!normalizedQuery && settings.showSuggestionsOnEmptyQuery) ||
    (Boolean(normalizedQuery) &&
      products.length === 0 &&
      settings.showSuggestionsOnNoResults);
  const pinned = wantSuggestions
    ? await getPinnedSearchSuggestions(shop.id)
    : { products: [], collections: [] };

  const collectionMap = new Map<string, (typeof liveCollections)[number]>();
  for (const row of [...liveCollections, ...pinned.collections]) {
    if (!collectionMap.has(row.handle)) collectionMap.set(row.handle, row);
  }

  const queries = popularQuerySuggestions(
    input.query,
    extras.popularSearchTerms,
    6,
  );

  const { locale, chrome } = resolveWidgetChrome(extrasNav.i18n, input.locale);

  const enableMarkets = settings.enableMarkets !== false;
  const context = parseMarketContext(input);
  const pricedProducts = products.map((product) =>
    applyMarketPricesToRow(
      product,
      product.marketPrices,
      context,
      enableMarkets,
    ),
  );
  const pricedSuggestions = pinned.products.map((product) =>
    applyMarketPricesToRow(
      product,
      product.marketPrices,
      context,
      enableMarkets,
    ),
  );
  const currency = payloadCurrency(context, [
    ...pricedProducts,
    ...pricedSuggestions,
  ]);

  const toSearchHit = (product: (typeof pricedProducts)[number]) => ({
    id: product.productGid,
    handle: product.handle,
    title: product.title,
    vendor: product.vendor,
    productType: product.productType,
    available: product.available,
    priceMin: product.priceMin,
    priceMax: product.priceMax,
    imageUrl: product.imageUrl,
    url: `/products/${product.handle}`,
  });

  const data = {
    query: normalizedQuery,
    locale,
    i18n: chrome,
    instant: extras.instant,
    redirect: redirect?.url ?? null,
    didYouMean: meta.didYouMean,
    usedFallback: meta.usedFallback,
    settings: currency ? { currency } : undefined,
    products: pricedProducts.map(toSearchHit),
    total: products.length,
    queries,
    pages,
    articles,
    suggestions: pricedSuggestions.map(toSearchHit),
    collections: [...collectionMap.values()],
  };

  return { data, status: 200 as const };
}

export function parseSelectedFromSearchParams(
  searchParams: URLSearchParams,
): SelectedFilters {
  const selected: SelectedFilters = {};
  searchParams.forEach((value, key) => {
    if (!key.startsWith("f.")) return;
    const facetKey = key.slice(2);
    const parts = value.split(",");
    // Keep empty price/range bounds ("50," or ",100"). List facets drop blanks.
    if (facetKey === "price" || facetKey.startsWith("mf_")) {
      selected[facetKey] = parts;
      return;
    }
    selected[facetKey] = parts.filter(Boolean);
  });
  return selected;
}
