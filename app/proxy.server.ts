import crypto from "node:crypto";
import type { FilterConfig } from "@prisma/client";
import prisma from "./db.server";
import {
  applyHideOutOfStock,
  buildFacetAggregations,
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
import { resolveStorefrontSort, sortProductRows } from "./sort.server";
import { normalizeSearchFields, normalizeSortOptions, parseSortOption } from "./app-settings";
import { getFilterConfig, getMetafieldMappings } from "./shop.server";
import { getAppSettings } from "./settings.server";
import { enforcePlanLimits } from "./billing.server";
import {
  enabledMetafieldPaths,
  normalizeSearchQuery,
  productMatchesKeyword,
  getPinnedSearchSuggestions,
  searchProductFacets,
  searchProducts,
} from "./search.server";

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
  available: boolean;
  status?: string | null;
  imageUrl: string | null;
  variantImages?: unknown;
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
    available: p.available,
    status: p.status || "ACTIVE",
    imageUrl: p.imageUrl,
    variantImages: parseVariantImages(p.variantImages),
    metafields: (p.metafields as Record<string, string>) || {},
    variantMetafields: (p.variantMetafields as Record<string, string>) || {},
    publishedAt: p.publishedAt ?? null,
    sortPosition: 0,
  };
}

export async function getCollectionFilterPayload(input: {
  shopDomain: string;
  collectionId?: string | null;
  collectionGid?: string | null;
  selected: SelectedFilters;
  sort?: string | null;
  query?: string | null;
}) {
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
    return {
      data: { enabled: false, facets: [], products: [], total: 0 },
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
        ),
      )
    : productsDb;

  const allRows = scopedProducts
    .filter((product) => (product.status || "ACTIVE") === "ACTIVE")
    .map((product) => ({
      ...toRow(product),
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
}) {
  const [mappings, appSettings, limits] = await Promise.all([
    getMetafieldMappings(input.shopId),
    getAppSettings(input.shopId),
    enforcePlanLimits(input.shopId),
  ]);
  const cappedMappings = mappings
    .filter((mapping) => mapping.enabled)
    .slice(0, limits.filterLimit);
  const settings = {
    showProductCounts: appSettings.showProductCounts,
    collapseByDefault: appSettings.collapseByDefault,
    hideOutOfStock: appSettings.hideOutOfStock,
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
  };

  const resolved = resolveStorefrontSort({
    requested: input.sort,
    enabled: settings.sortOptionsEnabled,
    defaultSort: settings.defaultSort,
    isSearch: input.isSearch,
  });

  const facets = expandFacetsWithOptions(
    facetsFromConfig(input.config, cappedMappings),
    input.rows,
  );
  const matched = input.rows.filter((product) =>
    productMatchesFilters(product, facets, input.selected),
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
    },
  );
  const optionGroups = selectedOptionFilterGroups(facets, input.selected);
  const aggregations = buildFacetAggregations(input.rows, facets, {
    mode: input.config.priceRangeMode,
    customMin: input.config.customPriceMin,
    customMax: input.config.customPriceMax,
  }, parseValueSort(
    input.config && "valueSort" in input.config ? input.config.valueSort : {},
  ), parseRangeBounds(
    input.config && "rangeBounds" in input.config ? input.config.rangeBounds : {},
  ));

  const data = {
    enabled: true as const,
    settings,
    facets: aggregations,
    products: filtered.map((product) => ({
      id: product.productGid,
      handle: product.handle,
      title: product.title,
      available: product.available,
      priceMin: product.priceMin,
      priceMax: product.priceMax,
      imageUrl: product.imageUrl,
      variantImageUrl: matchingVariantImageUrl(
        product.variantImages ?? [],
        optionGroups,
      ),
    })),
    total: filtered.length,
    sort: resolved.sort,
    ...(input.collectionGid != null ? { collectionGid: input.collectionGid } : {}),
    ...(input.query != null ? { query: input.query } : {}),
  };

  return { data, status: 200 as const };
}

export async function getSearchFilterPayload(input: {
  shopDomain: string;
  query: string;
  selected: SelectedFilters;
  sort?: string | null;
}) {
  const shop = await prisma.shop.findUnique({
    where: { domain: input.shopDomain },
  });
  if (!shop) {
    return { error: "Shop not synced", status: 404 as const };
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
  const allRows = productsDb.map(toRow);

  return buildFacetPayload({
    shopId: shop.id,
    config,
    rows: allRows,
    selected: input.selected,
    query,
    sort: input.sort,
    isSearch: true,
  });
}

export async function getSearchPayload(input: {
  shopDomain: string;
  query: string;
}) {
  const shop = await prisma.shop.findUnique({
    where: { domain: input.shopDomain },
  });
  if (!shop) {
    return { error: "Shop not synced", status: 404 as const };
  }

  const products = await searchProducts(shop.id, input.query);
  const settings = await getAppSettings(shop.id);
  const normalizedQuery = normalizeSearchQuery(input.query);
  const wantSuggestions =
    (!normalizedQuery && settings.showSuggestionsOnEmptyQuery) ||
    (Boolean(normalizedQuery) &&
      products.length === 0 &&
      settings.showSuggestionsOnNoResults);
  const pinned = wantSuggestions
    ? await getPinnedSearchSuggestions(shop.id)
    : { products: [], collections: [] };

  const data = {
    query: normalizedQuery,
    products: products.map((product) => ({
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
    })),
    total: products.length,
    suggestions: pinned.products.map((product) => ({
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
    })),
    collections: pinned.collections,
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
