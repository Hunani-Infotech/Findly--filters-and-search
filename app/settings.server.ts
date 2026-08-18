import prisma from "./db.server";
import {
  DEFAULT_APP_SETTINGS,
  normalizeSearchFields,
  parseHideOutOfStock,
  parseWidgetFontMode,
  parseWidgetRadius,
  parseWidgetTitleSize,
  sanitizeFontFamily,
  sanitizeWidgetTitle,
  sanitizeWidgetTitleColor,
  type HideOutOfStockMode,
  type SearchFieldKey,
} from "./app-settings";

export { DEFAULT_APP_SETTINGS };

export type AppSettingsInput = {
  widgetPosition?: "left" | "right" | "top";
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
  };
}

export async function saveAppSettings(shopId: string, input: AppSettingsInput) {
  const widgetPosition =
    input.widgetPosition === "right" || input.widgetPosition === "top"
      ? input.widgetPosition
      : "left";
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
