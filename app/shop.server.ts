import { Prisma, type MetafieldFilterType } from "@prisma/client";
import prisma from "./db.server";
import { DEFAULT_DISPLAY_ORDER, normalizeDisplayOrder } from "./filters.server";

export async function ensureShop(domain: string) {
  const shop = await prisma.shop.upsert({
    where: { domain },
    create: { domain, plan: "free" },
    update: { uninstalledAt: null },
  });

  await prisma.syncJob.upsert({
    where: { shopId: shop.id },
    create: { shopId: shop.id, status: "PENDING" },
    update: {},
  });

  try {
    await prisma.filterConfig.upsert({
      where: {
        shopId_collectionGid: { shopId: shop.id, collectionGid: "" },
      },
      create: {
        shopId: shop.id,
        collectionGid: "",
        displayOrder: [...DEFAULT_DISPLAY_ORDER],
      },
      update: {},
    });
  } catch (error) {
    // Parallel afterAuth + nested /app loaders can still race Prisma upsert.
    if (
      !(error instanceof Prisma.PrismaClientKnownRequestError) ||
      error.code !== "P2002"
    ) {
      throw error;
    }
  }

  return shop;
}

export async function getFilterConfig(
  shopId: string,
  collectionGid?: string | null,
) {
  const gid = collectionGid || "";
  if (gid) {
    const specific = await prisma.filterConfig.findUnique({
      where: { shopId_collectionGid: { shopId, collectionGid: gid } },
    });
    if (specific) return specific;
  }
  return prisma.filterConfig.findUnique({
    where: { shopId_collectionGid: { shopId, collectionGid: "" } },
  });
}

export async function getMetafieldMappings(shopId: string) {
  return prisma.metafieldMapping.findMany({
    where: { shopId },
    orderBy: { sortOrder: "asc" },
  });
}

export type FilterConfigInput = {
  collectionGid?: string;
  enabled?: boolean;
  enablePrice?: boolean;
  enableAvailability?: boolean;
  enableVendor?: boolean;
  enableProductType?: boolean;
  enableTags?: boolean;
  enableOptions?: boolean;
  priceRangeMode?: "auto" | "custom";
  customPriceMin?: number | null;
  customPriceMax?: number | null;
  displayOrder?: string[];
};

export async function saveFilterConfig(shopId: string, input: FilterConfigInput) {
  const collectionGid = input.collectionGid ?? "";
  const priceRangeMode = input.priceRangeMode === "custom" ? "custom" : "auto";
  return prisma.filterConfig.upsert({
    where: { shopId_collectionGid: { shopId, collectionGid } },
    create: {
      shopId,
      collectionGid,
      enabled: input.enabled ?? true,
      enablePrice: input.enablePrice ?? true,
      enableAvailability: input.enableAvailability ?? true,
      enableVendor: input.enableVendor ?? true,
      enableProductType: input.enableProductType ?? true,
      enableTags: input.enableTags ?? true,
      enableOptions: input.enableOptions ?? true,
      priceRangeMode,
      customPriceMin: input.customPriceMin ?? null,
      customPriceMax: input.customPriceMax ?? null,
      displayOrder: normalizeDisplayOrder(
        input.displayOrder ?? [...DEFAULT_DISPLAY_ORDER],
      ),
    },
    update: {
      enabled: input.enabled,
      enablePrice: input.enablePrice,
      enableAvailability: input.enableAvailability,
      enableVendor: input.enableVendor,
      enableProductType: input.enableProductType,
      enableTags: input.enableTags,
      enableOptions: input.enableOptions,
      priceRangeMode,
      customPriceMin: input.customPriceMin ?? null,
      customPriceMax: input.customPriceMax ?? null,
      displayOrder: input.displayOrder
        ? normalizeDisplayOrder(input.displayOrder)
        : input.displayOrder,
    },
  });
}

export async function saveMetafieldMappings(
  shopId: string,
  mappings: Array<{
    namespace: string;
    key: string;
    displayLabel: string;
    filterType: MetafieldFilterType;
    enabled: boolean;
    sortOrder: number;
  }>,
) {
  await prisma.metafieldMapping.deleteMany({ where: { shopId } });
  if (!mappings.length) return [];
  await prisma.metafieldMapping.createMany({
    data: mappings.map((m) => ({
      shopId,
      namespace: m.namespace,
      key: m.key,
      displayLabel: m.displayLabel,
      filterType: m.filterType,
      enabled: m.enabled,
      sortOrder: m.sortOrder,
    })),
  });
  return getMetafieldMappings(shopId);
}

export function filterConfigPriceFields(config: {
  priceRangeMode?: string | null;
  customPriceMin?: unknown;
  customPriceMax?: unknown;
} | null) {
  const toInput = (value: unknown) => {
    if (value == null || value === "") return "";
    const num =
      typeof value === "object" && value && "toNumber" in value
        ? (value as { toNumber: () => number }).toNumber()
        : Number(value);
    return Number.isFinite(num) ? String(num) : "";
  };
  return {
    priceRangeMode:
      config?.priceRangeMode === "custom" ? ("custom" as const) : ("auto" as const),
    customPriceMin: toInput(config?.customPriceMin),
    customPriceMax: toInput(config?.customPriceMax),
  };
}
