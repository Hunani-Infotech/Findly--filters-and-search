import { Prisma, type FilterConfig, type MetafieldMapping } from "@prisma/client";
import prisma from "../db.server";
import {
  applyHideOutOfStock,
  buildFacetAggregations,
  excludeHiddenTaggedProducts,
  expandFacetsWithOptions,
  facetsFromConfig,
  matchingVariantImageUrl,
  parseRangeBounds,
  parseValueSort,
  productMatchesFilters,
  selectedOptionFilterGroups,
  type ProductFacetRow,
  type SelectedFilters,
} from "./filters.server";
import {
  applyFacetValueFilter,
  applyFacetValueLabel,
  parseFacetSettings,
  settingForFacetKey,
} from "../utils/facet-settings";
import {
  listMetafieldSortOptions,
  resolveStorefrontSort,
  sortProductRows,
} from "./sort.server";
import {
  normalizeHideProductTags,
  normalizeSearchFields,
  pinSoldOutToEnd,
} from "../utils/app-settings";
import { getFilterConfig, getMetafieldMappings } from "./shop.server";
import { mappingAppliesToFilter } from "../utils/metafield-applies";
import { swatchMapForShop } from "./color-swatches.server";
import {
  expandSelectedWithGroups,
  listValueGroups,
  mergeFacetValuesWithGroups,
  sourceKeyForFacet,
} from "./value-groups.server";
import { optionKeyFromName } from "../utils/filter-catalog";
import {
  expandProductsAsVariants,
  shopifyNumericId,
  variantCardKey,
} from "../utils/variants-as-products";
import { getAppSettings, settingsFromRow } from "./settings.server";
import { resolveFilterLimit } from "./billing.server";
import { getAdminNavExtras, type AdminNavExtras } from "./admin-extras.server";
import { resolveWidgetChrome } from "../utils/widget-i18n";
import { withWidgetChrome } from "./filters.server";
import {
  COLLECTION_FACET_KEY,
  isAllProductsCollectionHandle,
  shouldShowCollectionFacet,
  nestCollectionValues,
  parseCollectionParents,
  withCollectionMeta,
  type ShopCollection,
} from "../utils/collection-facet";
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
} from "../utils/instant-search";
import { applyMarketPricesToRow, parseMarketContext } from "./markets.server";
import { getStorefrontCacheGens } from "../lib/catalog-cache.server";
import { findShopCached } from "../lib/shop-cache.server";
import { createTtlCache } from "../lib/read-cache.server";
import { measureStorefrontStep } from "../lib/storefront-timing.server";
import {
  catalogGenerationForShopId,
  facetDbRowToProductRow,
  loadCollectionProductFacets,
  loadShopProductFacets,
  productFacetSelectForRequest,
} from "./proxy-facet-load.server";
import { buildStorefrontWidgetSettings } from "./widget-settings.server";
export {
  isAppProxySignatureBypassEnabled,
  verifyAppProxySignature,
} from "./proxy-signature.server";

export const FILTER_PAGE_SIZE_MAX = 48;

const FILTER_PAYLOAD_CACHE_TTL_MS = 45_000;
const FILTER_PAYLOAD_CACHE_MAX = 80;
const shopCollectionsCache = createTtlCache<ShopCollection[]>(45_000);
const collectionProductCountsCache = createTtlCache<Map<string, number>>(45_000);
/** productGid → collectionGids — avoids per-request CollectionMembership round-trips. */
const collectionMembershipIndexCache = createTtlCache<Map<string, string[]>>(
  45_000,
);

type CachedFilterPayload = {
  freshUntil: number;
  result: Awaited<ReturnType<typeof loadCollectionFilterPayload>>;
};

const filterPayloadCache = new Map<string, CachedFilterPayload>();

function pruneFilterPayloadCache() {
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
  collectionMembershipIndexCache.deletePrefix("");
  shopCollectionsCache.deletePrefix("");
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

async function loadCollectionMembershipIndex(
  shopId: string,
): Promise<Map<string, string[]>> {
  const gen = await catalogGenerationForShopId(shopId);
  return collectionMembershipIndexCache.wrap(`${gen}:${shopId}`, async () => {
    const memberships = await prisma.collectionMembership.findMany({
      where: { shopId },
      select: { productGid: true, collectionGid: true },
    });
    const byProduct = new Map<string, string[]>();
    for (const row of memberships) {
      const list = byProduct.get(row.productGid);
      if (list) list.push(row.collectionGid);
      else byProduct.set(row.productGid, [row.collectionGid]);
    }
    return byProduct;
  });
}

async function attachCollectionGids(
  shopId: string,
  rows: ProductFacetRow[],
): Promise<ProductFacetRow[]> {
  if (!rows.length) return rows;
  const byProduct = await loadCollectionMembershipIndex(shopId);
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
  const gens = await measureStorefrontStep("cacheGenMs", () =>
    getStorefrontCacheGens(input.shopDomain),
  );
  const cacheKey = `${gens.catalog}:${gens.config}:${collectionFilterCacheKey(input)}`;
  const cached = filterPayloadCache.get(cacheKey);
  if (cached) {
    if (cached.freshUntil <= Date.now() && !filterPayloadInflight.has(cacheKey)) {
      const refresh = loadCollectionFilterPayload(input)
        .then((result) => {
          if (!("error" in result && result.error)) {
            filterPayloadCache.set(cacheKey, {
              freshUntil: Date.now() + FILTER_PAYLOAD_CACHE_TTL_MS,
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
      filterPayloadInflight.set(cacheKey, refresh);
      void refresh.catch(() => {
        /* keep serving stale */
      });
    }
    return cached.result;
  }
  const pending = filterPayloadInflight.get(cacheKey);
  if (pending) return pending;
  const promise = loadCollectionFilterPayload(input)
    .then((result) => {
      if (!("error" in result && result.error)) {
        filterPayloadCache.set(cacheKey, {
          freshUntil: Date.now() + FILTER_PAYLOAD_CACHE_TTL_MS,
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
  let isAll = isAllProductsCollectionHandle(collectionHandle);
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
  } else if (!isAll && !collectionHandle && collectionGid) {
    const byGid = await prisma.collection.findFirst({
      where: { shopId: shop.id, collectionGid },
      select: { handle: true },
    });
    isAll = isAllProductsCollectionHandle(byGid?.handle);
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
  ] = await measureStorefrontStep("configDbMs", () =>
    Promise.all([
      getFilterConfig(shop.id, collectionGid || ""),
      getAppSettings(shop.id),
      getMetafieldMappings(shop.id),
      resolveFilterLimit(shop.id),
      listValueGroups(shop.id),
      swatchMapForShop(shop.id),
      getAdminNavExtras(shop.id),
    ]),
  );
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
  const productsDb = await measureStorefrontStep("facetQueryMs", () =>
    isAll
      ? loadShopProductFacets(shop.id, facetSelect)
      : loadCollectionProductFacets(shop.id, collectionGid as string, facetSelect),
  );

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
        facetDbRowToProductRow(product),
        product.marketPrices,
        context,
        enableMarkets,
      ),
      sortPosition: product.position ?? 0,
    }));

  return measureStorefrontStep("aggregateMs", () =>
    buildFacetPayload({
      shopId: shop.id,
      config,
      rows: allRows,
      selected: input.selected,
      collectionGid,
      isAllProductsCollection: isAll,
      shopWideCollectionCounts: isAll,
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
    }),
  );
}

async function buildFacetPayload(input: {
  shopId: string;
  config: FilterConfig;
  rows: ProductFacetRow[];
  selected: SelectedFilters;
  collectionGid?: string | null;
  isAllProductsCollection?: boolean;
  shopWideCollectionCounts?: boolean;
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
  const settings = buildStorefrontWidgetSettings(
    appSettings,
    input.config,
    metafieldSortOptions,
    input.currency,
  );

  const visibleBase = excludeHiddenTaggedProducts(
    input.rows,
    normalizeHideProductTags(appSettings.hideProductTags),
  );
  const displayOrder = Array.isArray(input.config.displayOrder)
    ? (input.config.displayOrder as string[])
    : [];
  const showCollectionFacet = shouldShowCollectionFacet({
    isSearch: input.isSearch,
    collectionHandle: input.isAllProductsCollection ? "all" : "",
  });
  const wantsCollection =
    showCollectionFacet && displayOrder.includes(COLLECTION_FACET_KEY);
  const selectedCollection = Boolean(
    showCollectionFacet &&
      input.selected &&
      Array.isArray(input.selected[COLLECTION_FACET_KEY]) &&
      input.selected[COLLECTION_FACET_KEY].length,
  );
  let visibleRows = visibleBase;
  let collectionCatalog: ShopCollection[] = [];
  let collectionTotals: Map<string, number> | null = null;
  if (wantsCollection || selectedCollection) {
    const [withGids, catalog, totals] = await measureStorefrontStep(
      "collectionJoinMs",
      () =>
        Promise.all([
          attachCollectionGids(input.shopId, visibleBase),
          loadShopCollections(input.shopId),
          input.isSearch || input.shopWideCollectionCounts === false
            ? Promise.resolve(null)
            : loadCollectionProductCounts(input.shopId),
        ]),
    );
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
  )
    .map((facet) => {
      const custom = settingForFacetKey(facetSettings, facet.key).label;
      return custom ? { ...facet, label: custom } : facet;
    })
    .filter(
      (facet) =>
        showCollectionFacet ||
        (facet.source !== "collection" && facet.key !== COLLECTION_FACET_KEY),
    );
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
      inStockOnTop: pinSoldOutToEnd(appSettings),
      soldOutToBottom: pinSoldOutToEnd(appSettings),
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
    const setting = settingForFacetKey(facetSettings, facet.key);
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
      enableValueSearch: Boolean(setting.enableValueSearch),
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

  const paged = sliceFilterProducts(filtered, input.page, input.pageSize);

  const data = {
    enabled: true as const,
    locale,
    i18n: chrome,
    settings,
    facets: aggregations,
    /* Page-sliced handles only — full catalog list bloated JSON parse on the client.
       Pager/total use `total` + `hasNext`; next page refetches the next handle slice. */
    handles: paged.products.map(productHandle),
    products: paged.products.map(productCard),
    sort: resolved.sort,
    total: paged.total,
    hasNext: paged.hasNext ?? false,
    ...(paged.pageSize
      ? { page: paged.page ?? 1, pageSize: paged.pageSize }
      : {}),
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
  ] = await measureStorefrontStep("configDbMs", () =>
    Promise.all([
      getAppSettings(shop.id),
      getFilterConfig(shop.id, ""),
      getMetafieldMappings(shop.id),
      resolveFilterLimit(shop.id),
      listValueGroups(shop.id),
      swatchMapForShop(shop.id),
      getAdminNavExtras(shop.id),
    ]),
  );
  if (!(appSettings.enableFiltersOnSearch ?? true)) {
    const resolved = resolveWidgetChrome(navExtras.i18n, input.locale);
    return {
      data: {
        enabled: false,
        facets: [],
        products: [],
        total: 0,
        locale: resolved.locale,
        i18n: resolved.chrome,
        settings: { enableFiltersOnSearch: false },
      },
      status: 200 as const,
    };
  }

  const query = normalizeSearchQuery(input.query);
  if (!query) {
    const resolved = resolveWidgetChrome(navExtras.i18n, input.locale);
    return {
      data: {
        enabled: true,
        query: "",
        facets: [],
        products: [],
        total: 0,
        locale: resolved.locale,
        i18n: resolved.chrome,
      },
      status: 200 as const,
    };
  }

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

  const productsDb = await measureStorefrontStep("facetQueryMs", () =>
    searchProductFacets(shop.id, query),
  );
  const enableMarkets = appSettings.enableMarkets !== false;
  const context = parseMarketContext(input);
  const allRows = productsDb.map((product) =>
    applyMarketPricesToRow(
      facetDbRowToProductRow(product),
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
type InstantSearchPayload = Awaited<ReturnType<typeof loadSearchPayload>>;
const instantSearchPayloadCache = createTtlCache<InstantSearchPayload>(45_000);

export async function getSearchFilterPayload(
  input: Parameters<typeof loadSearchFilterPayload>[0],
) {
  const gens = await measureStorefrontStep("cacheGenMs", () =>
    getStorefrontCacheGens(input.shopDomain),
  );
  const cacheKey = `${gens.catalog}:${gens.config}:search:${collectionFilterCacheKey({
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
  listing?: boolean;
} & MarketRequestFields) {
  const gens = await measureStorefrontStep("cacheGenMs", () =>
    getStorefrontCacheGens(input.shopDomain),
  );
  const cacheKey = `${gens.catalog}:${gens.config}:instant:${JSON.stringify({
    shop: input.shopDomain,
    q: input.query,
    locale: input.locale || "",
    take: input.take ?? 24,
    listing: Boolean(input.listing),
    country: input.country || "",
    currency: input.currency || "",
    loc: input.companyLocationId || input.company_location || "",
  })}`;
  return instantSearchPayloadCache.wrap(cacheKey, () =>
    loadSearchPayload(input),
  );
}

async function loadSearchPayload(input: {
  shopDomain: string;
  query: string;
  locale?: string | null;
  take?: number;
  listing?: boolean;
} & MarketRequestFields) {
  const shop = await findShopCached(input.shopDomain);
  if (!shop) {
    return { error: "Shop not synced", status: 404 as const };
  }

  const settings = await getAppSettings(shop.id);
  const extras = parseSearchExtras(settings.searchExtras);
  const normalizedQuery = normalizeSearchQuery(input.query);
  const queryKey = normalizeSearchQueryKey(normalizedQuery);
  const redirect = input.listing
    ? undefined
    : extras.redirects.find((row) => row.query === queryKey);

  const take = Math.min(Math.max(input.take ?? 24, 1), 48);
  const collectionQuery = stripStopWordsFromQuery(
    input.query,
    extras.stopWords,
  );
  const fields = normalizeSearchFields(settings.searchFields);
  const wantCollections =
    input.listing === true ||
    extras.instant.showCollections ||
    fields.includes("collectionTitle");

  const [{ products, meta }, liveCollections, pages, articles, extrasNav] =
    await measureStorefrontStep("searchQueryMs", () =>
      Promise.all([
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
      ]),
    );

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
