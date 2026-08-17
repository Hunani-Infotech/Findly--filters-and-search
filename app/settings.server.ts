import prisma from "./db.server";
import {
  DEFAULT_APP_SETTINGS,
  parseWidgetFontMode,
  parseWidgetRadius,
  parseWidgetTitleSize,
  sanitizeFontFamily,
  sanitizeWidgetTitle,
  sanitizeWidgetTitleColor,
} from "./app-settings";

export { DEFAULT_APP_SETTINGS };

export type AppSettingsInput = {
  widgetPosition?: "left" | "right" | "top";
  accentColor?: string;
  showProductCounts?: boolean;
  collapseByDefault?: boolean;
  widgetShadow?: boolean;
  widgetRadius?: number;
  widgetFontMode?: "theme" | "heading" | "body" | "custom";
  widgetFontFamily?: string;
  widgetTitle?: string;
  widgetTitleSize?: number;
  widgetTitleColor?: string;
};

export async function getAppSettings(shopId: string) {
  return prisma.appSettings.upsert({
    where: { shopId },
    create: { shopId },
    update: {},
  });
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

  return prisma.appSettings.upsert({
    where: { shopId },
    create: {
      shopId,
      widgetPosition,
      accentColor,
      showProductCounts: input.showProductCounts ?? true,
      collapseByDefault: input.collapseByDefault ?? false,
      widgetShadow: input.widgetShadow ?? true,
      widgetRadius,
      widgetFontMode,
      widgetFontFamily,
      widgetTitle,
      widgetTitleSize,
      widgetTitleColor,
    },
    update: {
      widgetPosition,
      accentColor,
      showProductCounts: input.showProductCounts,
      collapseByDefault: input.collapseByDefault,
      widgetShadow: input.widgetShadow,
      widgetRadius,
      widgetFontMode,
      widgetFontFamily,
      widgetTitle,
      widgetTitleSize,
      widgetTitleColor,
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
