import prisma from "./db.server";
import {
  DEFAULT_APP_SETTINGS,
  WIDGET_RADIUS_OPTIONS,
} from "./app-settings";

export { DEFAULT_APP_SETTINGS, WIDGET_RADIUS_OPTIONS };

export type AppSettingsInput = {
  widgetPosition?: "left" | "right" | "top";
  accentColor?: string;
  showProductCounts?: boolean;
  collapseByDefault?: boolean;
  widgetShadow?: boolean;
  widgetRadius?: number;
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
  const widgetRadius = WIDGET_RADIUS_OPTIONS.some(
    (value) => value === input.widgetRadius,
  )
    ? Number(input.widgetRadius)
    : DEFAULT_APP_SETTINGS.widgetRadius;

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
    },
    update: {
      widgetPosition,
      accentColor,
      showProductCounts: input.showProductCounts,
      collapseByDefault: input.collapseByDefault,
      widgetShadow: input.widgetShadow,
      widgetRadius,
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
