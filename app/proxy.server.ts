import crypto from "node:crypto";
import type { FilterConfig } from "@prisma/client";
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
import { getFilterConfig, getMetafieldMappings } from "./shop.server";
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
import { getAppSettings } from "./settings.server";
import { sanitizeCustomCss, sanitizeProductListLiquid, scopeCustomCss } from "./widget-code";
import { enforcePlanLimits } from "./billing.server";
import { getAdminNavExtras } from "./admin-nav-extras.server";
import { resolveWidgetChrome } from "./widget-i18n";
import { withWidgetChrome } from "./filters.server";
import {
  COLLECTION_FACET_KEY,
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

/** Verify Shopify App Proxy signature (HMAC SHA256 of sorted query params). */
export function verifyAppProxySignature(url: URL): boolean {
  const secret = process.env.SHOPIFY_API_SECRET;
  if (!secret) return false;

  const signature = url.searchParams.get("signature");
  if (!signature) return false;

  const params: string[] = [];
  url.searchParams.forEach((value, key) => {
    if (key !== "signature") {
      params.push(`${key}=${value}`);
    }
  });
  params.sort();
  const message = params.join("");
  const digest = crypto
    .createHmac("sha256", secret)
    .update(message)
    .digest("hex");

  try {
    return crypto.timingSafeEqual(
      Buffer.from(digest, "utf8"),
      Buffer.from(signature, "utf8"),
    );
  } catch {
    return false;
  }
}

export const FILTER_PAGE_SIZE_MAX = 48;

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
  handle: string;
  title: string;
  vendor: string;
  productType: string;
  tags: string[];
  options: unknown;
  priceMin: { toNumber?: () => number } | number | string;
  priceMax: { toNumber?: () => number } | number | string;
  compareAtMin?: { toNumber?: () => number } | number | string | null;
  compareAtMax?: { toNumber?: () => number } | number | string | null;
  salePct?: { toNumber?: () => number } | number | string | null;
  available: boolean;
  inventoryLocations?: unknown;
  status?: string | null;
  imageUrl: string | null;
  variantImages?: unknown;
  variants?: unknown;
  metafields: unknown;
  variantMetafields?: unknown;
  publishedAt?: Date | null;
}): ProductFacetRow {
  const num = (v: { toNumber?: () => number } | number | string) => {
    if (typeof v === "number") return v;
    if (typeof v === "string") return Number(v);
    if (v && typeof v.toNumber === "function") return v.toNumber();
    return Number(v);
  };

  return {
    productGid: p.productGid,
    handle: p.handle,
    title: p.title,
    vendor: p.vendor,
    productType: p.productType,
    tags: p.tags,
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
    available: p.available,
    inventoryLocations: Array.isArray(p.inventoryLocations)
      ? p.inventoryLocations.filter((n) => typeof n === "string" && n)
      : [],
    status: p.status || "ACTIVE",
    imageUrl: p.imageUrl,
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
  const rows = await prisma.collection.findMany({
    where: { shopId },
    select: { collectionGid: true, title: true, handle: true },
    orderBy: { title: "asc" },
  });
  return rows.map((row) => ({
    collectionGid: row.collectionGid,
    title: row.title,
    handle: row.handle,
  }));
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

export async function getCollectionFilterPayload(input: {
  shopDomain: string;
  collectionId?: string | null;
  collectionGid?: string | null;
  selected: SelectedFilters;
  sort?: string | null;
  query?: string | null;
  locale?: string | null;
  page?: number;
  pageSize?: number;
} & MarketRequestFields) {
  const shop = await prisma.shop.findUnique({
    where: { domain: input.shopDomain },
  });
  if (!shop) {
    return { error: "Shop not synced", status: 404 as const };
  }

  const collectionGid =
    input.collectionGid ||
    (input.collectionId
      ? `gid://shopify/Collection/${input.collectionId}`
      : null);

  if (!collectionGid) {
    return { error: "collection_id required", status: 400 as const };
  }

  const config = await getFilterConfig(shop.id, collectionGid);
  if (!config?.enabled) {
    const extras = await getAdminNavExtras(shop.id);
    const resolved = resolveWidgetChrome(extras.i18n, input.locale);
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

  const memberships = await prisma.collectionMembership.findMany({
    where: { shopId: shop.id, collectionGid },
    select: { productGid: true, position: true },
  });
  const productGids = memberships.map((m) => m.productGid);
  const positionByGid = new Map(
    memberships.map((m) => [m.productGid, m.position]),
  );

  const productsDb = productGids.length
    ? await prisma.productFacet.findMany({
        where: { shopId: shop.id, productGid: { in: productGids } },
      })
    : [];

  const appSettings = await getAppSettings(shop.id);
  const extras = parseSearchExtras(appSettings.searchExtras);
  const collectionQuery = appSettings.enableCollectionSearch
    ? normalizeSearchQuery(input.query ?? "")
    : "";
  const searchFields = normalizeSearchFields(appSettings.searchFields);
  const metafieldPaths = searchFields.includes("metafields")
    ? enabledMetafieldPaths(await getMetafieldMappings(shop.id))
    : [];

  const scopedProducts = collectionQuery
    ? productsDb.filter((product) =>
        productMatchesKeyword(
          product,
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

  const enableMarkets = appSettings.enableMarkets !== false;
  const context = parseMarketContext(input);
  const allRows = scopedProducts
    .filter((product) => (product.status || "ACTIVE") === "ACTIVE")
    .map((product) => ({
      ...applyMarketPricesToRow(
        toRow(product),
        product.marketPrices,
        context,
        enableMarkets,
      ),
      sortPosition: positionByGid.get(product.productGid) ?? 0,
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
}) {
  const [mappings, appSettings, limits, valueGroups, swatches, extras] = await Promise.all([
    getMetafieldMappings(input.shopId),
    getAppSettings(input.shopId),
    enforcePlanLimits(input.shopId),
    listValueGroups(input.shopId),
    swatchMapForShop(input.shopId),
    getAdminNavExtras(input.shopId),
  ]);
  const { locale, chrome } = resolveWidgetChrome(extras.i18n, input.locale);
  const cappedMappings = mappings
    .filter((mapping) => mappingAppliesToFilter(mapping))
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .slice(0, limits.filterLimit);
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
  let visibleRows = visibleBase;
  let collectionCatalog: ShopCollection[] = [];
  if (wantsCollection) {
    const [withGids, catalog] = await Promise.all([
      attachCollectionGids(input.shopId, visibleBase),
      loadShopCollections(input.shopId),
    ]);
    visibleRows = withGids;
    collectionCatalog = catalog;
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
    ), collectionCatalog),
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
      values: nextValues,
    };
  });

  const data = {
    enabled: true as const,
    locale,
    i18n: chrome,
    settings,
    facets: aggregations,
    products: filtered.map((product) => {
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
    }),
    sort: resolved.sort,
    ...(input.collectionGid != null ? { collectionGid: input.collectionGid } : {}),
    ...(input.query != null ? { query: input.query } : {}),
  };

  const paged = sliceFilterProducts(data.products, input.page, input.pageSize);

  return {
    data: {
      ...data,
      products: paged.products,
      total: paged.total,
      ...(paged.pageSize != null
        ? {
            page: paged.page,
            pageSize: paged.pageSize,
            hasNext: paged.hasNext,
          }
        : {}),
    },
    status: 200 as const,
  };
}

export async function getSearchFilterPayload(input: {
  shopDomain: string;
  query: string;
  selected: SelectedFilters;
  sort?: string | null;
  locale?: string | null;
  page?: number;
  pageSize?: number;
} & MarketRequestFields) {
  const shop = await prisma.shop.findUnique({
    where: { domain: input.shopDomain },
  });
  if (!shop) {
    return { error: "Shop not synced", status: 404 as const };
  }

  const appSettings = await getAppSettings(shop.id);
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

  const config = await getFilterConfig(shop.id, "");
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
  });
}

export async function getInstantSearchWidgetPayload(
  input: {
    shopDomain: string;
  } & MarketRequestFields,
) {
  const shop = await prisma.shop.findUnique({
    where: { domain: input.shopDomain },
  });
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
  const shop = await prisma.shop.findUnique({
    where: { domain: input.shopDomain },
  });
  if (!shop) {
    return { error: "Shop not synced", status: 404 as const };
  }

  const settings = await getAppSettings(shop.id);
  const extras = parseSearchExtras(settings.searchExtras);
  const normalizedQuery = normalizeSearchQuery(input.query);
  const queryKey = normalizeSearchQueryKey(normalizedQuery);
  const redirect = extras.redirects.find((row) => row.query === queryKey);

  const take = Math.min(Math.max(input.take ?? 24, 1), 48);
  const { products, meta } = await searchProductsWithMeta(
    shop.id,
    input.query,
    { take },
  );
  const collectionQuery = stripStopWordsFromQuery(
    input.query,
    extras.stopWords,
  );

  const fields = normalizeSearchFields(settings.searchFields);
  const liveCollections =
    extras.instant.showCollections || fields.includes("collectionTitle")
      ? await searchCollections(shop.id, collectionQuery, { take: 6 })
      : [];

  const pages = extras.instant.showPages
    ? await searchPages(shop.id, input.query, { take: 6 })
    : [];
  const articles = extras.instant.showBlogPosts
    ? await searchArticles(shop.id, input.query, { take: 6 })
    : [];

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

  const extrasNav = await getAdminNavExtras(shop.id);
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
