import type { FilterConfig } from "@prisma/client";
import {
  normalizeHideProductTags,
  normalizeSortOptions,
  parsePaginationStyle,
  parseSortOption,
} from "./app-settings";
import type { HydratedAppSettings } from "./settings.server";
import type { MetafieldSortOption } from "./sort.server";
import { sanitizeCustomCss, sanitizeProductListLiquid, scopeCustomCss } from "./widget-code";

/** Storefront filter widget settings sent in proxy JSON payloads. */
export function buildStorefrontWidgetSettings(
  appSettings: HydratedAppSettings,
  config: FilterConfig,
  metafieldSortOptions: MetafieldSortOption[],
  currency?: string | null,
) {
  return {
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
      (config as { enableVariantsAsProducts?: boolean }).enableVariantsAsProducts,
    ),
    ...(currency ? { currency } : {}),
  };
}
