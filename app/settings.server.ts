import prisma from "./db.server";
import {
  DEFAULT_APP_SETTINGS,
  normalizeHandleList,
  normalizeHideProductTags,
  normalizeSearchFields,
  normalizeSortOptions,
  parseHideOutOfStock,
  parsePaginationStyle,
  parseSortOption,
  parseWidgetFontMode,
  parseWidgetPosition,
  parseWidgetRadius,
  parseWidgetTitleSize,
  sanitizeFontFamily,
  sanitizeWidgetTitle,
  sanitizeWidgetTitleColor,
  type HideOutOfStockMode,
  type PaginationStyle,
  type SearchFieldKey,
  type SortOptionKey,
  type WidgetPosition,
} from "./app-settings";
import {
  DEFAULT_SEARCH_EXTRAS,
  parseSearchExtras,
  type SearchExtras,
} from "./instant-search";
import {
  sanitizeCustomCss,
  sanitizeProductListLiquid,
} from "./widget-code";

export { DEFAULT_APP_SETTINGS };

export type AppSettingsInput = {
  widgetPosition?: WidgetPosition;
  accentColor?: string;
  showProductCounts?: boolean;
  showTotalProductCount?: boolean;
  hideProductTags?: string[] | string;
  collapseByDefault?: boolean;
  hideOutOfStock?: HideOutOfStockMode | string;
  paginationStyle?: PaginationStyle | string;
  widgetShadow?: boolean;
  widgetRadius?: number;
  widgetFontMode?: "theme" | "heading" | "body" | "custom";
  widgetFontFamily?: string;
  widgetTitle?: string;
  widgetTitleSize?: number;
  widgetTitleColor?: string;
  searchFields?: SearchFieldKey[] | string[];
  sortOptionsEnabled?: SortOptionKey[] | string[];
  defaultSort?: SortOptionKey | string;
  hideSortDropdown?: boolean;
  inStockOnTop?: boolean;
  soldOutToBottom?: boolean;
  enableCollectionSearch?: boolean;
  enableMarkets?: boolean;
  enableFiltersOnSearch?: boolean;
  hideSingleValueFacets?: boolean;
  showMatchingVariantImage?: boolean;
  showRefineBy?: boolean;
  showSuggestionsOnEmptyQuery?: boolean;
  showSuggestionsOnNoResults?: boolean;
  suggestionProductHandles?: string[] | string;
  suggestionCollectionHandles?: string[] | string;
  searchExtras?: SearchExtras | Record<string, unknown>;
  customCss?: string;
  productListLiquid?: string;
};

function extrasFromRow(row: object): unknown {
  return (row as { searchExtras?: unknown }).searchExtras;
}

async function loadSearchExtrasColumn(shopId: string, row: object) {
  const fromRow = extrasFromRow(row);
  if (fromRow !== undefined) return parseSearchExtras(fromRow);
  const extraRows = await prisma.$queryRaw<Array<{ searchExtras: unknown }>>`
    SELECT "searchExtras" FROM "AppSettings" WHERE "shopId" = ${shopId}
  `;
  return parseSearchExtras(extraRows[0]?.searchExtras);
}

async function persistSearchExtrasColumn(shopId: string, extras: SearchExtras) {
  await prisma.$executeRawUnsafe(
    `UPDATE "AppSettings" SET "searchExtras" = $1::jsonb WHERE "shopId" = $2`,
    JSON.stringify(extras),
    shopId,
  );
}

export async function getAppSettings(shopId: string) {
  const row = await prisma.appSettings.upsert({
    where: { shopId },
    create: {
      shopId,
      searchFields: [...DEFAULT_APP_SETTINGS.searchFields],
    },
    update: {},
  });
  return {
    ...row,
    searchFields: normalizeSearchFields(row.searchFields),
    sortOptionsEnabled: normalizeSortOptions(row.sortOptionsEnabled),
    defaultSort: parseSortOption(row.defaultSort),
    suggestionProductHandles: normalizeHandleList(row.suggestionProductHandles),
    suggestionCollectionHandles: normalizeHandleList(
      row.suggestionCollectionHandles,
    ),
    hideProductTags: normalizeHideProductTags(
      (row as { hideProductTags?: unknown }).hideProductTags,
    ),
    paginationStyle: parsePaginationStyle(
      (row as { paginationStyle?: unknown }).paginationStyle,
    ),
    showTotalProductCount:
      (row as { showTotalProductCount?: boolean }).showTotalProductCount !==
      false,
    searchExtras: await loadSearchExtrasColumn(shopId, row),
  };
}

export async function saveAppSettings(shopId: string, input: AppSettingsInput) {
  const widgetPosition = parseWidgetPosition(input.widgetPosition); // left | right | top | offcanvas
  const accentColor = sanitizeWidgetTitleColor(input.accentColor);
  const widgetRadius = parseWidgetRadius(input.widgetRadius);

  const widgetFontMode = parseWidgetFontMode(input.widgetFontMode);
  const widgetFontFamily =
    widgetFontMode === "custom" ? sanitizeFontFamily(input.widgetFontFamily) : "";
  const widgetTitle = sanitizeWidgetTitle(input.widgetTitle);
  const widgetTitleSize = parseWidgetTitleSize(input.widgetTitleSize);
  const widgetTitleColor = sanitizeWidgetTitleColor(input.widgetTitleColor);
  const searchFields =
    input.searchFields !== undefined
      ? normalizeSearchFields(input.searchFields)
      : [...DEFAULT_APP_SETTINGS.searchFields];
  const hideOutOfStock = parseHideOutOfStock(
    input.hideOutOfStock ?? DEFAULT_APP_SETTINGS.hideOutOfStock,
  );
  const paginationStyle = parsePaginationStyle(
    input.paginationStyle ?? DEFAULT_APP_SETTINGS.paginationStyle,
  );
  const sortOptionsEnabled =
    input.sortOptionsEnabled !== undefined
      ? normalizeSortOptions(input.sortOptionsEnabled)
      : [...DEFAULT_APP_SETTINGS.sortOptionsEnabled];
  const defaultSort = parseSortOption(
    input.defaultSort ?? DEFAULT_APP_SETTINGS.defaultSort,
  );
  const hideSortDropdown =
    input.hideSortDropdown ?? DEFAULT_APP_SETTINGS.hideSortDropdown;
  const inStockOnTop =
    input.inStockOnTop ?? DEFAULT_APP_SETTINGS.inStockOnTop;
  const soldOutToBottom =
    input.soldOutToBottom ?? DEFAULT_APP_SETTINGS.soldOutToBottom;
  const enableCollectionSearch =
    input.enableCollectionSearch ??
    DEFAULT_APP_SETTINGS.enableCollectionSearch;
  const enableMarkets =
    input.enableMarkets ?? DEFAULT_APP_SETTINGS.enableMarkets;
  const enableFiltersOnSearch =
    input.enableFiltersOnSearch ?? DEFAULT_APP_SETTINGS.enableFiltersOnSearch;
  const hideSingleValueFacets =
    input.hideSingleValueFacets ?? DEFAULT_APP_SETTINGS.hideSingleValueFacets;
  const showMatchingVariantImage =
    input.showMatchingVariantImage ??
    DEFAULT_APP_SETTINGS.showMatchingVariantImage;
  const showRefineBy =
    input.showRefineBy ?? DEFAULT_APP_SETTINGS.showRefineBy;
  const showSuggestionsOnEmptyQuery =
    input.showSuggestionsOnEmptyQuery ??
    DEFAULT_APP_SETTINGS.showSuggestionsOnEmptyQuery;
  const showSuggestionsOnNoResults =
    input.showSuggestionsOnNoResults ??
    DEFAULT_APP_SETTINGS.showSuggestionsOnNoResults;
  const suggestionProductHandles = normalizeHandleList(
    input.suggestionProductHandles ??
      DEFAULT_APP_SETTINGS.suggestionProductHandles,
  );
  const suggestionCollectionHandles = normalizeHandleList(
    input.suggestionCollectionHandles ??
      DEFAULT_APP_SETTINGS.suggestionCollectionHandles,
  );
  const hideProductTags = normalizeHideProductTags(
    input.hideProductTags ?? DEFAULT_APP_SETTINGS.hideProductTags,
  );
  const showTotalProductCount =
    input.showTotalProductCount ?? DEFAULT_APP_SETTINGS.showTotalProductCount;
  const searchExtras = parseSearchExtras(
    input.searchExtras ?? DEFAULT_SEARCH_EXTRAS,
  );
  const customCss = sanitizeCustomCss(
    input.customCss ?? DEFAULT_APP_SETTINGS.customCss,
  );
  const productListLiquid = sanitizeProductListLiquid(
    input.productListLiquid ?? DEFAULT_APP_SETTINGS.productListLiquid,
  );

  const row = await prisma.appSettings.upsert({
    where: { shopId },
    create: {
      shopId,
      widgetPosition,
      accentColor,
      showProductCounts: input.showProductCounts ?? true,
      showTotalProductCount,
      hideProductTags,
      collapseByDefault: input.collapseByDefault ?? false,
      hideOutOfStock,
      paginationStyle,
      widgetShadow: input.widgetShadow ?? true,
      widgetRadius,
      widgetFontMode,
      widgetFontFamily,
      widgetTitle,
      widgetTitleSize,
      widgetTitleColor,
      searchFields,
      sortOptionsEnabled,
      defaultSort,
      hideSortDropdown,
      inStockOnTop,
      soldOutToBottom,
      enableCollectionSearch,
      enableMarkets,
      enableFiltersOnSearch,
      hideSingleValueFacets,
      showMatchingVariantImage,
      showRefineBy,
      showSuggestionsOnEmptyQuery,
      showSuggestionsOnNoResults,
      suggestionProductHandles,
      suggestionCollectionHandles,
      customCss,
      productListLiquid,
    },
    update: {
      widgetPosition,
      accentColor,
      showProductCounts: input.showProductCounts,
      ...(input.showTotalProductCount !== undefined
        ? { showTotalProductCount }
        : {}),
      ...(input.hideProductTags !== undefined ? { hideProductTags } : {}),
      collapseByDefault: input.collapseByDefault,
      ...(input.hideOutOfStock !== undefined ? { hideOutOfStock } : {}),
      ...(input.paginationStyle !== undefined ? { paginationStyle } : {}),
      widgetShadow: input.widgetShadow,
      widgetRadius,
      widgetFontMode,
      widgetFontFamily,
      widgetTitle,
      widgetTitleSize,
      widgetTitleColor,
      ...(input.searchFields !== undefined ? { searchFields } : {}),
      ...(input.sortOptionsEnabled !== undefined ? { sortOptionsEnabled } : {}),
      ...(input.defaultSort !== undefined ? { defaultSort } : {}),
      ...(input.hideSortDropdown !== undefined ? { hideSortDropdown } : {}),
      ...(input.inStockOnTop !== undefined ? { inStockOnTop } : {}),
      ...(input.soldOutToBottom !== undefined ? { soldOutToBottom } : {}),
      ...(input.enableCollectionSearch !== undefined
        ? { enableCollectionSearch }
        : {}),
      ...(input.enableMarkets !== undefined ? { enableMarkets } : {}),
      ...(input.enableFiltersOnSearch !== undefined
        ? { enableFiltersOnSearch }
        : {}),
      ...(input.hideSingleValueFacets !== undefined
        ? { hideSingleValueFacets }
        : {}),
      ...(input.showMatchingVariantImage !== undefined
        ? { showMatchingVariantImage }
        : {}),
      ...(input.showRefineBy !== undefined ? { showRefineBy } : {}),
      ...(input.showSuggestionsOnEmptyQuery !== undefined
        ? { showSuggestionsOnEmptyQuery }
        : {}),
      ...(input.showSuggestionsOnNoResults !== undefined
        ? { showSuggestionsOnNoResults }
        : {}),
      ...(input.suggestionProductHandles !== undefined
        ? { suggestionProductHandles }
        : {}),
      ...(input.suggestionCollectionHandles !== undefined
        ? { suggestionCollectionHandles }
        : {}),
      ...(input.customCss !== undefined ? { customCss } : {}),
      ...(input.productListLiquid !== undefined ? { productListLiquid } : {}),
    },
  });
  if (input.searchExtras !== undefined) {
    await persistSearchExtrasColumn(shopId, searchExtras);
  }
  return row;
}

export async function saveSearchSettings(
  shopId: string,
  input: {
    searchFields?: SearchFieldKey[] | string[];
    showSuggestionsOnEmptyQuery?: boolean;
    showSuggestionsOnNoResults?: boolean;
    suggestionProductHandles?: string[] | string;
    suggestionCollectionHandles?: string[] | string;
    searchExtras?: SearchExtras | Record<string, unknown>;
  },
) {
  await getAppSettings(shopId);
  const data: {
    searchFields?: string[];
    showSuggestionsOnEmptyQuery?: boolean;
    showSuggestionsOnNoResults?: boolean;
    suggestionProductHandles?: string[];
    suggestionCollectionHandles?: string[];
  } = {};
  if (input.searchFields !== undefined) {
    data.searchFields = normalizeSearchFields(input.searchFields);
  }
  if (input.showSuggestionsOnEmptyQuery !== undefined) {
    data.showSuggestionsOnEmptyQuery = input.showSuggestionsOnEmptyQuery;
  }
  if (input.showSuggestionsOnNoResults !== undefined) {
    data.showSuggestionsOnNoResults = input.showSuggestionsOnNoResults;
  }
  if (input.suggestionProductHandles !== undefined) {
    data.suggestionProductHandles = normalizeHandleList(
      input.suggestionProductHandles,
    );
  }
  if (input.suggestionCollectionHandles !== undefined) {
    data.suggestionCollectionHandles = normalizeHandleList(
      input.suggestionCollectionHandles,
    );
  }
  const row =
    Object.keys(data).length > 0
      ? await prisma.appSettings.update({
          where: { shopId },
          data,
        })
      : await prisma.appSettings.findUniqueOrThrow({ where: { shopId } });
  if (input.searchExtras !== undefined) {
    await persistSearchExtrasColumn(
      shopId,
      parseSearchExtras(input.searchExtras),
    );
  }
  return row;
}

export function collectionNumericId(collectionGid: string) {
  const match = collectionGid.match(/Collection\/(\d+)/);
  return match?.[1] ?? collectionGid;
}

export function toCollectionGid(idOrGid: string) {
  if (idOrGid.startsWith("gid://")) return idOrGid;
  return `gid://shopify/Collection/${idOrGid}`;
}
