import type { AppSettings } from "@prisma/client";
import prisma from "../db.server";
import {
  DEFAULT_APP_SETTINGS,
  normalizeHandleList,
  normalizeHideProductTags,
  normalizeSearchFields,
  normalizeSortOptions,
  parsePaginationStyle,
  parseSortOption,
  parseWidgetFontMode,
  parseWidgetPosition,
  parseWidgetRadius,
  parseWidgetTitleSize,
  pinSoldOutToEnd,
  resolveHideOutOfStock,
  sanitizeFontFamily,
  sanitizeWidgetTitle,
  sanitizeWidgetTitleColor,
  type HideOutOfStockMode,
  type PaginationStyle,
  type SearchFieldKey,
  type SortOptionKey,
  type WidgetPosition,
} from "../utils/app-settings";
import {
  DEFAULT_SEARCH_EXTRAS,
  parseSearchExtras,
  type SearchExtras,
} from "../utils/instant-search";
import {
  sanitizeCustomCss,
  sanitizeProductListLiquid,
} from "../utils/widget-code";
import { createTtlCache } from "../lib/read-cache.server";
import { bumpStorefrontConfigGenerationForShopId } from "../lib/catalog-cache.server";

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
  autoApplyFilters?: boolean;
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

async function mapAppSettings(shopId: string, row: AppSettings) {
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
    hideOutOfStock: resolveHideOutOfStock(row),
    inStockOnTop: pinSoldOutToEnd(row),
    soldOutToBottom: pinSoldOutToEnd(row),
    paginationStyle: parsePaginationStyle(
      (row as { paginationStyle?: unknown }).paginationStyle,
    ),
    showTotalProductCount:
      (row as { showTotalProductCount?: boolean }).showTotalProductCount !==
      false,
    searchExtras: await loadSearchExtrasColumn(shopId, row),
  };
}

export type HydratedAppSettings = Awaited<ReturnType<typeof mapAppSettings>>;

const appSettingsCache = createTtlCache<HydratedAppSettings>(30_000);

/** Read-only hydrate for storefront proxy — never upserts. */
export async function settingsFromRow(
  shopId: string,
  row: AppSettings | null,
): Promise<HydratedAppSettings> {
  if (!row) {
    return {
      id: "",
      shopId,
      ...DEFAULT_APP_SETTINGS,
      searchExtras: parseSearchExtras(undefined),
    } as HydratedAppSettings;
  }
  return mapAppSettings(shopId, row);
}

export async function getAppSettings(shopId: string) {
  return appSettingsCache.wrap(shopId, async () => {
    let row = await prisma.appSettings.findUnique({ where: { shopId } });
    if (!row) {
      row = await prisma.appSettings.create({
        data: {
          shopId,
          searchFields: [...DEFAULT_APP_SETTINGS.searchFields],
        },
      });
    }
    return mapAppSettings(shopId, row);
  });
}

/** Include `value` in the Prisma update only when the client sent the field. */
function patchIfPresent<T>(
  present: boolean,
  key: string,
  value: T,
): Record<string, T> {
  return present ? { [key]: value } : {};
}

function normalizeSettingsWrite(input: AppSettingsInput) {
  const widgetFontMode = parseWidgetFontMode(input.widgetFontMode);
  const searchFields =
    input.searchFields !== undefined
      ? normalizeSearchFields(input.searchFields)
      : [...DEFAULT_APP_SETTINGS.searchFields];
  const sortOptionsEnabled =
    input.sortOptionsEnabled !== undefined
      ? normalizeSortOptions(input.sortOptionsEnabled)
      : [...DEFAULT_APP_SETTINGS.sortOptionsEnabled];

  return {
    widgetPosition: parseWidgetPosition(input.widgetPosition),
    accentColor: sanitizeWidgetTitleColor(input.accentColor),
    widgetRadius: parseWidgetRadius(input.widgetRadius),
    widgetFontMode,
    widgetFontFamily:
      widgetFontMode === "custom"
        ? sanitizeFontFamily(input.widgetFontFamily)
        : "",
    widgetTitle: sanitizeWidgetTitle(input.widgetTitle),
    widgetTitleSize: parseWidgetTitleSize(input.widgetTitleSize),
    widgetTitleColor: sanitizeWidgetTitleColor(input.widgetTitleColor),
    searchFields,
    hideOutOfStock: resolveHideOutOfStock({
      hideOutOfStock:
        input.hideOutOfStock ?? DEFAULT_APP_SETTINGS.hideOutOfStock,
      inStockOnTop: input.inStockOnTop,
      soldOutToBottom: input.soldOutToBottom,
    }),
    paginationStyle: parsePaginationStyle(
      input.paginationStyle ?? DEFAULT_APP_SETTINGS.paginationStyle,
    ),
    sortOptionsEnabled,
    defaultSort: parseSortOption(
      input.defaultSort ?? DEFAULT_APP_SETTINGS.defaultSort,
    ),
    hideSortDropdown:
      input.hideSortDropdown ?? DEFAULT_APP_SETTINGS.hideSortDropdown,
    inStockOnTop: pinSoldOutToEnd({
      hideOutOfStock: input.hideOutOfStock,
      inStockOnTop: input.inStockOnTop,
      soldOutToBottom: input.soldOutToBottom,
    }),
    soldOutToBottom: pinSoldOutToEnd({
      hideOutOfStock: input.hideOutOfStock,
      inStockOnTop: input.inStockOnTop,
      soldOutToBottom: input.soldOutToBottom,
    }),
    enableCollectionSearch:
      input.enableCollectionSearch ??
      DEFAULT_APP_SETTINGS.enableCollectionSearch,
    enableMarkets: input.enableMarkets ?? DEFAULT_APP_SETTINGS.enableMarkets,
    enableFiltersOnSearch:
      input.enableFiltersOnSearch ??
      DEFAULT_APP_SETTINGS.enableFiltersOnSearch,
    hideSingleValueFacets:
      input.hideSingleValueFacets ??
      DEFAULT_APP_SETTINGS.hideSingleValueFacets,
    showMatchingVariantImage:
      input.showMatchingVariantImage ??
      DEFAULT_APP_SETTINGS.showMatchingVariantImage,
    showRefineBy: input.showRefineBy ?? DEFAULT_APP_SETTINGS.showRefineBy,
    autoApplyFilters:
      input.autoApplyFilters ?? DEFAULT_APP_SETTINGS.autoApplyFilters,
    showSuggestionsOnEmptyQuery:
      input.showSuggestionsOnEmptyQuery ??
      DEFAULT_APP_SETTINGS.showSuggestionsOnEmptyQuery,
    showSuggestionsOnNoResults:
      input.showSuggestionsOnNoResults ??
      DEFAULT_APP_SETTINGS.showSuggestionsOnNoResults,
    suggestionProductHandles: normalizeHandleList(
      input.suggestionProductHandles ??
        DEFAULT_APP_SETTINGS.suggestionProductHandles,
    ),
    suggestionCollectionHandles: normalizeHandleList(
      input.suggestionCollectionHandles ??
        DEFAULT_APP_SETTINGS.suggestionCollectionHandles,
    ),
    hideProductTags: normalizeHideProductTags(
      input.hideProductTags ?? DEFAULT_APP_SETTINGS.hideProductTags,
    ),
    showTotalProductCount:
      input.showTotalProductCount ?? DEFAULT_APP_SETTINGS.showTotalProductCount,
    searchExtras: parseSearchExtras(
      input.searchExtras ?? DEFAULT_SEARCH_EXTRAS,
    ),
    customCss: sanitizeCustomCss(
      input.customCss ?? DEFAULT_APP_SETTINGS.customCss,
    ),
    productListLiquid: sanitizeProductListLiquid(
      input.productListLiquid ?? DEFAULT_APP_SETTINGS.productListLiquid,
    ),
  };
}

export async function saveAppSettings(shopId: string, input: AppSettingsInput) {
  const n = normalizeSettingsWrite(input);

  const row = await prisma.appSettings.upsert({
    where: { shopId },
    create: {
      shopId,
      widgetPosition: n.widgetPosition,
      accentColor: n.accentColor,
      showProductCounts: input.showProductCounts ?? true,
      showTotalProductCount: n.showTotalProductCount,
      hideProductTags: n.hideProductTags,
      collapseByDefault: input.collapseByDefault ?? false,
      hideOutOfStock: n.hideOutOfStock,
      paginationStyle: n.paginationStyle,
      widgetShadow: input.widgetShadow ?? true,
      widgetRadius: n.widgetRadius,
      widgetFontMode: n.widgetFontMode,
      widgetFontFamily: n.widgetFontFamily,
      widgetTitle: n.widgetTitle,
      widgetTitleSize: n.widgetTitleSize,
      widgetTitleColor: n.widgetTitleColor,
      searchFields: n.searchFields,
      sortOptionsEnabled: n.sortOptionsEnabled,
      defaultSort: n.defaultSort,
      hideSortDropdown: n.hideSortDropdown,
      inStockOnTop: n.inStockOnTop,
      soldOutToBottom: n.soldOutToBottom,
      enableCollectionSearch: n.enableCollectionSearch,
      enableMarkets: n.enableMarkets,
      enableFiltersOnSearch: n.enableFiltersOnSearch,
      hideSingleValueFacets: n.hideSingleValueFacets,
      showMatchingVariantImage: n.showMatchingVariantImage,
      showRefineBy: n.showRefineBy,
      autoApplyFilters: n.autoApplyFilters,
      showSuggestionsOnEmptyQuery: n.showSuggestionsOnEmptyQuery,
      showSuggestionsOnNoResults: n.showSuggestionsOnNoResults,
      suggestionProductHandles: n.suggestionProductHandles,
      suggestionCollectionHandles: n.suggestionCollectionHandles,
      customCss: n.customCss,
      productListLiquid: n.productListLiquid,
    },
    update: {
      widgetPosition: n.widgetPosition,
      accentColor: n.accentColor,
      showProductCounts: input.showProductCounts,
      ...patchIfPresent(
        input.showTotalProductCount !== undefined,
        "showTotalProductCount",
        n.showTotalProductCount,
      ),
      ...patchIfPresent(
        input.hideProductTags !== undefined,
        "hideProductTags",
        n.hideProductTags,
      ),
      collapseByDefault: input.collapseByDefault,
      ...patchIfPresent(
        input.hideOutOfStock !== undefined,
        "hideOutOfStock",
        n.hideOutOfStock,
      ),
      ...patchIfPresent(
        input.paginationStyle !== undefined,
        "paginationStyle",
        n.paginationStyle,
      ),
      widgetShadow: input.widgetShadow,
      widgetRadius: n.widgetRadius,
      widgetFontMode: n.widgetFontMode,
      widgetFontFamily: n.widgetFontFamily,
      widgetTitle: n.widgetTitle,
      widgetTitleSize: n.widgetTitleSize,
      widgetTitleColor: n.widgetTitleColor,
      ...patchIfPresent(
        input.searchFields !== undefined,
        "searchFields",
        n.searchFields,
      ),
      ...patchIfPresent(
        input.sortOptionsEnabled !== undefined,
        "sortOptionsEnabled",
        n.sortOptionsEnabled,
      ),
      ...patchIfPresent(
        input.defaultSort !== undefined,
        "defaultSort",
        n.defaultSort,
      ),
      ...patchIfPresent(
        input.hideSortDropdown !== undefined,
        "hideSortDropdown",
        n.hideSortDropdown,
      ),
      ...patchIfPresent(
        input.inStockOnTop !== undefined || input.hideOutOfStock !== undefined,
        "inStockOnTop",
        n.inStockOnTop,
      ),
      ...patchIfPresent(
        input.soldOutToBottom !== undefined ||
          input.hideOutOfStock !== undefined,
        "soldOutToBottom",
        n.soldOutToBottom,
      ),
      ...patchIfPresent(
        input.enableCollectionSearch !== undefined,
        "enableCollectionSearch",
        n.enableCollectionSearch,
      ),
      ...patchIfPresent(
        input.enableMarkets !== undefined,
        "enableMarkets",
        n.enableMarkets,
      ),
      ...patchIfPresent(
        input.enableFiltersOnSearch !== undefined,
        "enableFiltersOnSearch",
        n.enableFiltersOnSearch,
      ),
      ...patchIfPresent(
        input.hideSingleValueFacets !== undefined,
        "hideSingleValueFacets",
        n.hideSingleValueFacets,
      ),
      ...patchIfPresent(
        input.showMatchingVariantImage !== undefined,
        "showMatchingVariantImage",
        n.showMatchingVariantImage,
      ),
      ...patchIfPresent(
        input.showRefineBy !== undefined,
        "showRefineBy",
        n.showRefineBy,
      ),
      ...patchIfPresent(
        input.autoApplyFilters !== undefined,
        "autoApplyFilters",
        n.autoApplyFilters,
      ),
      ...patchIfPresent(
        input.showSuggestionsOnEmptyQuery !== undefined,
        "showSuggestionsOnEmptyQuery",
        n.showSuggestionsOnEmptyQuery,
      ),
      ...patchIfPresent(
        input.showSuggestionsOnNoResults !== undefined,
        "showSuggestionsOnNoResults",
        n.showSuggestionsOnNoResults,
      ),
      ...patchIfPresent(
        input.suggestionProductHandles !== undefined,
        "suggestionProductHandles",
        n.suggestionProductHandles,
      ),
      ...patchIfPresent(
        input.suggestionCollectionHandles !== undefined,
        "suggestionCollectionHandles",
        n.suggestionCollectionHandles,
      ),
      ...patchIfPresent(input.customCss !== undefined, "customCss", n.customCss),
      ...patchIfPresent(
        input.productListLiquid !== undefined,
        "productListLiquid",
        n.productListLiquid,
      ),
    },
  });
  if (input.searchExtras !== undefined) {
    await persistSearchExtrasColumn(shopId, n.searchExtras);
  }
  appSettingsCache.del(shopId);
  await bumpStorefrontConfigGenerationForShopId(shopId);
  // Drop in-process filter JSON so the next storefront/proxy hit cannot serve
  // a payload built under the previous enableCollectionSearch (etc.) value.
  const { clearFilterPayloadCache } = await import("./proxy.server");
  clearFilterPayloadCache();
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
  appSettingsCache.del(shopId);
  await bumpStorefrontConfigGenerationForShopId(shopId);
  const { clearFilterPayloadCache } = await import("./proxy.server");
  clearFilterPayloadCache();
  return row;
}

export function toCollectionGid(idOrGid: string) {
  if (idOrGid.startsWith("gid://")) return idOrGid;
  return `gid://shopify/Collection/${idOrGid}`;
}
