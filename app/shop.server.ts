import { Prisma, type MetafieldFilterType } from "@prisma/client";
import prisma from "./db.server";
import { enforcePlanLimits } from "./billing.server";
import { listFacetValueCatalog, normalizeDisplayOrder, parseDisplayTypes, parseMatchModes, parseRangeBounds, parseValueSort, type ProductFacetRow, type ValueSortMap } from "./filters.server";
import {
  ensureDefaultFilterTree,
  findOrCreateDefaultTree,
  findOrCreateTreeForCollection,
  hasCollectionAssignment,
  resolveFilterTreeForCollection,
  resolveFilterTreeForSearch,
  replaceTreeCollections,
} from "./filter-trees.server";
import { mappingAppliesToFilter } from "./metafield-applies";
import {
  normalizeMetafieldOwnerType,
  type MetafieldOwnerTypeValue,
} from "./metafield-owner";

export { normalizeMetafieldOwnerType, type MetafieldOwnerTypeValue };
export {
  hasCollectionAssignment,
  resolveFilterTreeForCollection,
  resolveFilterTreeForSearch,
};

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
    await ensureDefaultFilterTree(shop.id);
  } catch (error) {
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
    return resolveFilterTreeForCollection(shopId, gid);
  }
  return resolveFilterTreeForSearch(shopId);
}

export async function getMetafieldMappings(shopId: string) {
  return prisma.metafieldMapping.findMany({
    where: { shopId },
    orderBy: { sortOrder: "asc" },
  });
}

export type FilterConfigInput = {
  collectionGid?: string;
  name?: string;
  appliesToSearch?: boolean;
  collectionGids?: string[];
  enabled?: boolean;
  enablePrice?: boolean;
  enableSale?: boolean;
  enableRating?: boolean;
  enableLocation?: boolean;
  enableAvailability?: boolean;
  enableVendor?: boolean;
  enableProductType?: boolean;
  enableTags?: boolean;
  enableOptions?: boolean;
  enableVariantsAsProducts?: boolean;
  variantAsProductOptions?: string[];
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
  const tree = collectionGid
    ? await findOrCreateTreeForCollection(shopId, collectionGid)
    : await findOrCreateDefaultTree(shopId);

  const data = {
    enabled: input.enabled,
    enablePrice: input.enablePrice,
    enableSale: input.enableSale,
    enableRating: input.enableRating,
    enableLocation: input.enableLocation,
    enableAvailability: input.enableAvailability,
    enableVendor: input.enableVendor,
    enableProductType: input.enableProductType,
    enableTags: input.enableTags,
    enableOptions: input.enableOptions,
    enableVariantsAsProducts: input.enableVariantsAsProducts,
    variantAsProductOptions: input.variantAsProductOptions,
    priceRangeMode,
    customPriceMin: input.customPriceMin ?? null,
    customPriceMax: input.customPriceMax ?? null,
    displayOrder: input.displayOrder
      ? normalizeDisplayOrder(input.displayOrder)
      : undefined,
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
    ...(input.name !== undefined ? { name: input.name.trim() || tree.name } : {}),
    ...(input.appliesToSearch !== undefined
      ? { appliesToSearch: input.appliesToSearch }
      : collectionGid
        ? {}
        : { appliesToSearch: true }),
  };

  const updated = await prisma.filterConfig.update({
    where: { id: tree.id },
    data,
  });

  if (input.collectionGids) {
    await replaceTreeCollections(shopId, tree.id, input.collectionGids);
  }

  return updated;
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
    appliesTo?: string[];
  }>,
) {
  await prisma.$transaction(async (tx) => {
    await tx.metafieldMapping.deleteMany({ where: { shopId } });
    if (!mappings.length) return;
    await tx.metafieldMapping.createMany({
      data: mappings.map((m) => ({
        shopId,
        namespace: m.namespace,
        key: m.key,
        displayLabel: m.displayLabel,
        filterType: m.filterType,
        enabled: m.enabled,
        appliesTo: Array.isArray(m.appliesTo) ? m.appliesTo : [],
        sortOrder: m.sortOrder,
        ownerType: normalizeMetafieldOwnerType(m.ownerType),
      })) as Prisma.MetafieldMappingCreateManyInput[],
    });
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
  const [mappings, config, limits] = await Promise.all([
    getMetafieldMappings(shopId),
    getFilterConfig(shopId, collectionGid || ""),
    enforcePlanLimits(shopId),
  ]);
  const cappedMappings = mappings
    .filter((mapping) => mappingAppliesToFilter(mapping))
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .slice(0, limits.filterLimit);
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
    compareAtMin:
      product.compareAtMin == null ? null : Number(product.compareAtMin),
    compareAtMax:
      product.compareAtMax == null ? null : Number(product.compareAtMax),
    salePct: Number(product.salePct),
    available: product.available,
    inventoryLocations: product.inventoryLocations ?? [],
    status: product.status,
    imageUrl: product.imageUrl,
    metafields: (product.metafields as Record<string, string>) || {},
    variantMetafields: (product.variantMetafields as Record<string, string>) || {},
  }));

  return listFacetValueCatalog(rows, config, cappedMappings);
}
