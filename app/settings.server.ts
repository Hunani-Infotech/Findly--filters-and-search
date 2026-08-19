import prisma from "./db.server";
import {
  DEFAULT_APP_SETTINGS,
  normalizeHandleList,
  normalizeSearchFields,
  normalizeSortOptions,
  parseHideOutOfStock,
  parseSortOption,
  parseWidgetFontMode,
  parseWidgetPosition,
  parseWidgetRadius,
  parseWidgetTitleSize,
  sanitizeFontFamily,
  sanitizeWidgetTitle,
  sanitizeWidgetTitleColor,
  type HideOutOfStockMode,
  type SearchFieldKey,
  type SortOptionKey,
  type WidgetPosition,
} from "./app-settings";

export { DEFAULT_APP_SETTINGS };

export type AppSettingsInput = {
  widgetPosition?: WidgetPosition;
  accentColor?: string;
  showProductCounts?: boolean;
  collapseByDefault?: boolean;
  hideOutOfStock?: HideOutOfStockMode | string;
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
  enableFiltersOnSearch?: boolean;
  hideSingleValueFacets?: boolean;
  showMatchingVariantImage?: boolean;
  showRefineBy?: boolean;
  showSuggestionsOnEmptyQuery?: boolean;
  showSuggestionsOnNoResults?: boolean;
  suggestionProductHandles?: string[] | string;
  suggestionCollectionHandles?: string[] | string;
};

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
  };
}

export async function saveAppSettings(shopId: string, input: AppSettingsInput) {
  const widgetPosition = parseWidgetPosition(input.widgetPosition); // left | right | top | offcanvas
  const accentColor =
    typeof input.accentColor === "string" && input.accentColor.trim()
      ? input.accentColor.trim().slice(0, 64)
      : DEFAULT_APP_SETTINGS.accentColor;
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

  return prisma.appSettings.upsert({
    where: { shopId },
    create: {
      shopId,
      widgetPosition,
      accentColor,
      showProductCounts: input.showProductCounts ?? true,
      collapseByDefault: input.collapseByDefault ?? false,
      hideOutOfStock,
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
      enableFiltersOnSearch,
      hideSingleValueFacets,
      showMatchingVariantImage,
      showRefineBy,
      showSuggestionsOnEmptyQuery,
      showSuggestionsOnNoResults,
      suggestionProductHandles,
      suggestionCollectionHandles,
    },
    update: {
      widgetPosition,
      accentColor,
      showProductCounts: input.showProductCounts,
      collapseByDefault: input.collapseByDefault,
      ...(input.hideOutOfStock !== undefined ? { hideOutOfStock } : {}),
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
    },
  });
}

export function collectionNumericId(collectionGid: string) {
  const match = collectionGid.match(/Collection\/(\d+)/);
  return match?.[1] ?? collectionGid;
}

export function toCollectionGid(idOrGid: string) {
  if (idOrGid.startsWith("gid://")) return idOrGid;
  return `gid://shopify/Collection/${idOrGid}`;
}
