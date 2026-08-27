import { Prisma, type FilterConfig, type MetafieldMapping } from "@prisma/client";
import prisma from "./db.server";
import { parseVariantImages, type ProductFacetRow } from "./filters.server";
import { mappingAppliesToFilter } from "./metafield-applies";
import { normalizeMetafieldOwnerType } from "./shop.server";
import { parseStoredVariants } from "./variants-as-products";
import { getCatalogGeneration } from "./catalog-cache.server";
import { findShopByIdCached } from "./shop-cache.server";
import { createTtlCache } from "./read-cache.server";

export function productFacetSelectForRequest(opts: {
  config: FilterConfig;
  mappings: MetafieldMapping[];
  enableMarkets: boolean;
  needsKeywordSearch: boolean;
  searchFields: string[];
  sort?: string | null;
}): Prisma.ProductFacetSelect {
  const variantSplit = Boolean(opts.config.enableVariantsAsProducts);
  const filterMappings = opts.mappings.filter((mapping) =>
    mappingAppliesToFilter(mapping),
  );
  const needMetafields =
    Boolean(opts.config.enableRating) ||
    filterMappings.length > 0 ||
    (opts.needsKeywordSearch && opts.searchFields.includes("metafields")) ||
    Boolean(opts.sort && String(opts.sort).startsWith("mf_"));
  const needVariantMetafields = filterMappings.some(
    (mapping) => normalizeMetafieldOwnerType(mapping.ownerType) === "VARIANT",
  );
  const select: Record<string, true> = {
    productGid: true,
    handle: true,
    title: true,
    vendor: true,
    productType: true,
    tags: true,
    options: true,
    priceMin: true,
    priceMax: true,
    available: true,
    status: true,
  };
  if (opts.config.enableSale) select.salePct = true;
  if (opts.config.enableLocation) select.inventoryLocations = true;
  if (needMetafields) select.metafields = true;
  if (needVariantMetafields) select.variantMetafields = true;
  if (opts.enableMarkets) select.marketPrices = true;
  if (variantSplit) select.variants = true;
  if (opts.needsKeywordSearch && opts.searchFields.includes("skus")) {
    select.skus = true;
  }
  if (opts.sort === "date_asc" || opts.sort === "date_desc") {
    select.publishedAt = true;
  }
  select.imageUrl = true;
  return select as Prisma.ProductFacetSelect;
}

function selectFingerprint(select: Prisma.ProductFacetSelect) {
  return Object.entries(select)
    .filter(([, enabled]) => Boolean(enabled))
    .map(([key]) => key)
    .sort()
    .join(",");
}

/** Whitelist of ProductFacet columns allowed in the collection JOIN. */
const FACET_SQL_COLUMNS: Record<string, string> = {
  productGid: 'pf."productGid"',
  handle: 'pf."handle"',
  title: 'pf."title"',
  vendor: 'pf."vendor"',
  productType: 'pf."productType"',
  tags: 'pf."tags"',
  skus: 'pf."skus"',
  options: 'pf."options"',
  priceMin: 'pf."priceMin"',
  priceMax: 'pf."priceMax"',
  compareAtMin: 'pf."compareAtMin"',
  compareAtMax: 'pf."compareAtMax"',
  salePct: 'pf."salePct"',
  available: 'pf."available"',
  inventoryLocations: 'pf."inventoryLocations"',
  status: 'pf."status"',
  imageUrl: 'pf."imageUrl"',
  variantImages: 'pf."variantImages"',
  variants: 'pf."variants"',
  metafields: 'pf."metafields"',
  variantMetafields: 'pf."variantMetafields"',
  marketPrices: 'pf."marketPrices"',
  publishedAt: 'pf."publishedAt"',
};

export type CollectionFacetDbRow = {
  productGid: string;
  handle?: string;
  title?: string;
  vendor?: string;
  productType?: string;
  tags?: string[];
  skus?: string[];
  options?: unknown;
  priceMin?: string | number | { toNumber?: () => number } | null;
  priceMax?: string | number | { toNumber?: () => number } | null;
  compareAtMin?: string | number | { toNumber?: () => number } | null;
  compareAtMax?: string | number | { toNumber?: () => number } | null;
  salePct?: string | number | { toNumber?: () => number } | null;
  available?: boolean;
  inventoryLocations?: unknown;
  status?: string | null;
  imageUrl?: string | null;
  variantImages?: unknown;
  variants?: unknown;
  metafields?: unknown;
  variantMetafields?: unknown;
  marketPrices?: unknown;
  publishedAt?: Date | null;
  position: number | null;
};

function selectedFacetColumnSql(select: Prisma.ProductFacetSelect): Prisma.Sql[] {
  const cols: Prisma.Sql[] = [];
  const seen = new Set<string>();
  for (const [key, enabled] of Object.entries(select)) {
    if (!enabled) continue;
    const expr = FACET_SQL_COLUMNS[key];
    if (!expr || seen.has(expr)) continue;
    seen.add(expr);
    cols.push(Prisma.raw(expr));
  }
  if (!seen.has(FACET_SQL_COLUMNS.productGid)) {
    cols.unshift(Prisma.raw(FACET_SQL_COLUMNS.productGid));
  }
  return cols;
}

async function loadCollectionProductFacetsUncached(
  shopId: string,
  collectionGid: string,
  select: Prisma.ProductFacetSelect,
): Promise<CollectionFacetDbRow[]> {
  const columns = selectedFacetColumnSql(select);
  if (!columns.length) return [];
  return prisma.$queryRaw<CollectionFacetDbRow[]>(Prisma.sql`
    SELECT ${Prisma.join(columns)}, cm."position" AS "position"
    FROM "CollectionMembership" cm
    INNER JOIN "ProductFacet" pf
      ON pf."shopId" = cm."shopId" AND pf."productGid" = cm."productGid"
    WHERE cm."shopId" = ${shopId}
      AND cm."collectionGid" = ${collectionGid}
  `);
}

const collectionFacetCache = createTtlCache<CollectionFacetDbRow[]>(45_000);
const shopProductFacetCache = createTtlCache<CollectionFacetDbRow[]>(45_000);

async function catalogGenerationForShopId(shopId: string): Promise<string> {
  const shop = await findShopByIdCached(shopId);
  if (!shop) return "0";
  return getCatalogGeneration(shop.domain);
}

export { catalogGenerationForShopId };

export async function loadCollectionProductFacets(
  shopId: string,
  collectionGid: string,
  select: Prisma.ProductFacetSelect,
) {
  const gen = await catalogGenerationForShopId(shopId);
  return collectionFacetCache.wrap(
    `${gen}:${shopId}:${collectionGid}:${selectFingerprint(select)}`,
    () => loadCollectionProductFacetsUncached(shopId, collectionGid, select),
  );
}

async function loadShopProductFacetsUncached(
  shopId: string,
  select: Prisma.ProductFacetSelect,
): Promise<CollectionFacetDbRow[]> {
  const columns = selectedFacetColumnSql(select);
  if (!columns.length) return [];
  return prisma.$queryRaw<CollectionFacetDbRow[]>(Prisma.sql`
    SELECT ${Prisma.join(columns)}, 0 AS "position"
    FROM "ProductFacet" pf
    WHERE pf."shopId" = ${shopId}
  `);
}

export async function loadShopProductFacets(
  shopId: string,
  select: Prisma.ProductFacetSelect,
) {
  const gen = await catalogGenerationForShopId(shopId);
  return shopProductFacetCache.wrap(
    `${gen}:${shopId}:all:${selectFingerprint(select)}`,
    () => loadShopProductFacetsUncached(shopId, select),
  );
}

function decimalField(
  v: { toNumber?: () => number } | number | string | null | undefined,
): number {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return v;
  if (typeof v === "string") return Number(v);
  if (typeof v.toNumber === "function") return v.toNumber();
  return Number(v);
}

/** Map a raw SQL ProductFacet row into the filter engine shape. */
export function facetDbRowToProductRow(p: {
  productGid: string;
  handle?: string | null;
  title?: string | null;
  vendor?: string | null;
  productType?: string | null;
  tags?: string[] | null;
  options?: unknown;
  priceMin?: { toNumber?: () => number } | number | string | null;
  priceMax?: { toNumber?: () => number } | number | string | null;
  compareAtMin?: { toNumber?: () => number } | number | string | null;
  compareAtMax?: { toNumber?: () => number } | number | string | null;
  salePct?: { toNumber?: () => number } | number | string | null;
  available?: boolean | null;
  inventoryLocations?: unknown;
  status?: string | null;
  imageUrl?: string | null;
  variantImages?: unknown;
  variants?: unknown;
  metafields?: unknown;
  variantMetafields?: unknown;
  publishedAt?: Date | null;
}): ProductFacetRow {
  return {
    productGid: p.productGid,
    handle: p.handle || "",
    title: p.title || "",
    vendor: p.vendor || "",
    productType: p.productType || "",
    tags: Array.isArray(p.tags) ? p.tags : [],
    options: (p.options as Record<string, string[]>) || {},
    priceMin: decimalField(p.priceMin),
    priceMax: decimalField(p.priceMax),
    compareAtMin:
      p.compareAtMin == null || p.compareAtMin === ""
        ? null
        : decimalField(p.compareAtMin),
    compareAtMax:
      p.compareAtMax == null || p.compareAtMax === ""
        ? null
        : decimalField(p.compareAtMax),
    salePct: p.salePct == null || p.salePct === "" ? 0 : decimalField(p.salePct),
    available: Boolean(p.available),
    inventoryLocations: Array.isArray(p.inventoryLocations)
      ? p.inventoryLocations.filter((n) => typeof n === "string" && n)
      : [],
    status: p.status || "ACTIVE",
    imageUrl: p.imageUrl ?? null,
    variantImages: parseVariantImages(p.variantImages),
    variants: parseStoredVariants(p.variants),
    metafields: (p.metafields as Record<string, string>) || {},
    variantMetafields: (p.variantMetafields as Record<string, string>) || {},
    publishedAt: p.publishedAt ?? null,
    sortPosition: 0,
    collectionGids: [],
  };
}
