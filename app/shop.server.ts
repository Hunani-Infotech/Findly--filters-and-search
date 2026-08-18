import { Prisma, type MetafieldFilterType } from "@prisma/client";
import prisma from "./db.server";
import { DEFAULT_DISPLAY_ORDER, listFacetValueCatalog, normalizeDisplayOrder, parseDisplayTypes, parseMatchModes, parseRangeBounds, parseValueSort, type ProductFacetRow, type ValueSortMap } from "./filters.server";
import {
  normalizeMetafieldOwnerType,
  type MetafieldOwnerTypeValue,
} from "./metafield-owner";

export { normalizeMetafieldOwnerType, type MetafieldOwnerTypeValue };

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
  displayTypes?: Record<string, string>;
  matchModes?: Record<string, string>;
  valueSort?: ValueSortMap;
  rangeBounds?: Record<string, { mode?: string; min?: unknown; max?: unknown }>;
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
      displayTypes: parseDisplayTypes(input.displayTypes),
      matchModes: parseMatchModes(input.matchModes),
      valueSort: parseValueSort(input.valueSort),
      rangeBounds: parseRangeBounds(input.rangeBounds),
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
      displayTypes:
        input.displayTypes !== undefined
          ? parseDisplayTypes(input.displayTypes)
          : undefined,
      matchModes:
        input.matchModes !== undefined
          ? parseMatchModes(input.matchModes)
          : undefined,
      valueSort:
        input.valueSort !== undefined ? parseValueSort(input.valueSort) : undefined,
      rangeBounds:
        input.rangeBounds !== undefined
          ? parseRangeBounds(input.rangeBounds)
          : undefined,
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
    ownerType?: MetafieldOwnerTypeValue | string;
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
      ownerType: normalizeMetafieldOwnerType(m.ownerType),
    })) as Prisma.MetafieldMappingCreateManyInput[],
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

export async function getListFacetValueCatalog(
  shopId: string,
  collectionGid = "",
) {
  const mappings = await getMetafieldMappings(shopId);
  const config = await getFilterConfig(shopId, collectionGid || "");
  let products;
  if (collectionGid) {
    const memberships = await prisma.collectionMembership.findMany({
      where: { shopId, collectionGid },
      take: 500,
      select: { productGid: true },
    });
    products = await prisma.productFacet.findMany({
      where: {
        shopId,
        productGid: { in: memberships.map((row) => row.productGid) },
      },
    });
  } else {
    products = await prisma.productFacet.findMany({
      where: { shopId, status: "ACTIVE" },
      take: 500,
    });
  }

  const rows: ProductFacetRow[] = products.map((product) => ({
    productGid: product.productGid,
    handle: product.handle,
    title: product.title,
    vendor: product.vendor,
    productType: product.productType,
    tags: product.tags,
    options: (product.options as Record<string, string[]>) || {},
    priceMin: Number(product.priceMin),
    priceMax: Number(product.priceMax),
    available: product.available,
    status: product.status,
    imageUrl: product.imageUrl,
    metafields: (product.metafields as Record<string, string>) || {},
  }));

  return listFacetValueCatalog(rows, config, mappings);
}
