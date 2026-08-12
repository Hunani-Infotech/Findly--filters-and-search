import prisma from "./db.server";

export type AppSettingsInput = {
  widgetPosition?: "left" | "right" | "top";
  accentColor?: string;
  showProductCounts?: boolean;
  collapseByDefault?: boolean;
};

export async function getAppSettings(shopId: string) {
  return prisma.appSettings.upsert({
    where: { shopId },
    create: { shopId },
    update: {},
  });
}

export async function saveAppSettings(shopId: string, input: AppSettingsInput) {
  return prisma.appSettings.upsert({
    where: { shopId },
    create: {
      shopId,
      widgetPosition: input.widgetPosition ?? "left",
      accentColor: input.accentColor ?? "#1c1917",
      showProductCounts: input.showProductCounts ?? true,
      collapseByDefault: input.collapseByDefault ?? false,
    },
    update: {
      widgetPosition: input.widgetPosition,
      accentColor: input.accentColor,
      showProductCounts: input.showProductCounts,
      collapseByDefault: input.collapseByDefault,
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
