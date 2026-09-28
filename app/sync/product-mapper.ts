import type { Prisma } from "@prisma/client";
import { buildStoredVariants } from "../utils/variants-as-products";
import { mergeProductMarketPrices } from "../services/markets.server";
import {
  normalizeProductTypeValue,
  OPTION_VALUE_LABELS_KEY,
} from "../utils/filters";
import { isMetaobjectGid } from "../services/metaobject-labels.server";

type JsonObject = Prisma.InputJsonValue;

type ShopifyMetafieldNode = { namespace: string; key: string; value: string };

type ShopifyInventoryQuantity = { name?: string | null; quantity?: number | null };
type ShopifyInventoryLevelNode = {
  id?: string;
  available?: number | null;
  quantities?: ShopifyInventoryQuantity[] | null;
  location?: { id?: string | null; name?: string | null; isActive?: boolean | null } | null;
};

type ShopifyOptionValue = {
  name?: string | null;
  linkedMetafieldValue?: string | null;
};

type ShopifyVariantNode = {
  id?: string;
  sku?: string | null;
  price?: string | null;
  compareAtPrice?: string | null;
  availableForSale?: boolean | null;
  inventoryQuantity?: number | null;
  sellableOnlineQuantity?: number | null;
  inventoryPolicy?: string | null;
  image?: { url?: string | null } | null;
  selectedOptions?: Array<{ name?: string | null; value?: string | null }> | null;
  metafields?: {
    edges?: Array<{
      node: ShopifyMetafieldNode;
    }>;
  } | null;
  inventoryItem?: {
    id?: string | null;
    tracked?: boolean | null;
    inventoryLevels?: {
      edges?: Array<{ node: ShopifyInventoryLevelNode }>;
      nodes?: ShopifyInventoryLevelNode[];
    } | null;
  } | null;
};

type ShopifyProduct = {
  id: string;
  handle: string;
  title: string;
  vendor?: string | null;
  productType?: string | null;
  product_type?: string | null;
  /** Shopify Admin Category (taxonomy). Used when legacy productType is blank. */
  category?: { name?: string | null; fullName?: string | null } | null;
  tags?: string[] | string | null;
  status?: string | null;
  createdAt?: string | null;
  publishedAt?: string | null;
  featuredImage?: { url?: string | null } | null;
  options?: Array<{
    name: string;
    values?: string[] | null;
    optionValues?: ShopifyOptionValue[] | null;
  }> | null;
  variants?: {
    edges?: Array<{
      node: ShopifyVariantNode;
    }>;
    nodes?: ShopifyVariantNode[];
  } | null;
  metafields?: {
    edges?: Array<{
      node: ShopifyMetafieldNode;
    }>;
  } | null;
  reviewsRating?: ShopifyMetafieldNode | null;
  looxAvgRating?: ShopifyMetafieldNode | null;
  stampedAvgRating?: ShopifyMetafieldNode | null;
  collections?: {
    edges?: Array<{ node: { id: string } }>;
  } | null;
};

function normalizeTags(tags: ShopifyProduct["tags"]): string[] {
  if (!tags) return [];
  if (Array.isArray(tags)) return tags;
  return tags
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

function parseShopifyDate(value?: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Variant-level % off. Never pairs one variant's price with another's compare-at. */
export function variantSalePercent(
  price: number,
  compareAt: number,
): number {
  if (
    !Number.isFinite(price) ||
    !Number.isFinite(compareAt) ||
    compareAt <= 0 ||
    compareAt <= price
  ) {
    return 0;
  }
  return ((compareAt - price) / compareAt) * 100;
}

export function compareAtAndSaleFromVariants(
  variants: Array<{ price?: string | null; compareAtPrice?: string | null }>,
): {
  compareAtMin: number | null;
  compareAtMax: number | null;
  salePct: number;
} {
  const compareAts = variants
    .map((variant) => Number(variant.compareAtPrice))
    .filter((n) => Number.isFinite(n) && n > 0);
  let salePct = 0;
  for (const variant of variants) {
    const price = Number(variant.price);
    const compareAt = Number(variant.compareAtPrice);
    salePct = Math.max(salePct, variantSalePercent(price, compareAt));
  }
  return {
    compareAtMin: compareAts.length ? Math.min(...compareAts) : null,
    compareAtMax: compareAts.length ? Math.max(...compareAts) : null,
    salePct: Math.round(salePct * 100) / 100,
  };
}

export type VariantImageEntry = {
  options: Record<string, string>;
  imageUrl: string;
};

export function inventoryLevelAvailableQuantity(level: {
  available?: number | null;
  quantities?: Array<{ name?: string | null; quantity?: number | null }> | null;
}): number {
  if (typeof level.available === "number" && Number.isFinite(level.available)) {
    return level.available;
  }
  for (const qty of level.quantities ?? []) {
    const name = String(qty.name || "").toLowerCase();
    if (name && name !== "available") continue;
    const n = Number(qty.quantity);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

export function shopifyVariantNodes(
  product: Pick<ShopifyProduct, "variants">,
): ShopifyVariantNode[] {
  const conn = product.variants;
  const fromEdges = conn?.edges?.map((edge) => edge.node) ?? [];
  if (fromEdges.length) return fromEdges;
  return conn?.nodes ?? [];
}

/** True when Shopify included the inventoryLevels connection (even if empty). */
export function variantsIncludeInventoryLevels(
  variants: ShopifyVariantNode[],
): boolean {
  return variants.some(
    (variant) => variant.inventoryItem?.inventoryLevels != null,
  );
}

function variantInventoryLevels(variant: ShopifyVariantNode): ShopifyInventoryLevelNode[] {
  const conn = variant.inventoryItem?.inventoryLevels;
  return [
    ...(conn?.edges?.map((edge) => edge.node) ?? []),
    ...(conn?.nodes ?? []),
  ];
}

/** Sum available units when Shopify returned levels; otherwise use quantity fields. */
export function variantAvailableQuantity(
  variant: ShopifyVariantNode,
): number | null {
  const levels = variantInventoryLevels(variant);
  if (levels.length) {
    return levels.reduce(
      (sum, level) => sum + inventoryLevelAvailableQuantity(level),
      0,
    );
  }
  if (typeof variant.inventoryQuantity === "number") return variant.inventoryQuantity;
  if (typeof variant.sellableOnlineQuantity === "number") {
    return variant.sellableOnlineQuantity;
  }
  if (variant.inventoryItem) return 0;
  return null;
}

/**
 * In-stock when a variant can actually be sold from inventory.
 * Qty 0 is out of stock unless inventory is explicitly untracked, even if
 * "continue selling" keeps availableForSale true. Incomplete payloads (no
 * quantity fields) stay in stock so partial GraphQL/bulk lines do not blank
 * the catalog.
 */
export function variantIsInStock(variant: ShopifyVariantNode): boolean {
  if (variant.availableForSale === false) return false;
  const tracked = variant.inventoryItem?.tracked;
  const qty = variantAvailableQuantity(variant);
  if (qty === 0 && tracked !== false) return false;
  if (qty != null && qty > 0) return true;
  return true;
}

export function productIsAvailable(
  status: string | null | undefined,
  variants: ShopifyVariantNode[],
): boolean {
  if ((status ?? "ACTIVE") !== "ACTIVE") return false;
  if (!variants.length) return true;
  return variants.some(variantIsInStock);
}

export function availableLocationNamesFromVariants(
  variants: Array<{
    inventoryItem?: {
      id?: string | null;
      inventoryLevels?: {
        edges?: Array<{ node: ShopifyInventoryLevelNode }>;
        nodes?: ShopifyInventoryLevelNode[];
      } | null;
    } | null;
  }>,
): string[] {
  const names = new Set<string>();
  for (const variant of variants) {
    const conn = variant.inventoryItem?.inventoryLevels;
    const levels = [
      ...(conn?.edges?.map((e) => e.node) ?? []),
      ...(conn?.nodes ?? []),
    ];
    for (const level of levels) {
      const loc = level?.location;
      const name = loc?.name?.trim();
      if (!name) continue;
      if (loc?.isActive === false) continue;
      if (inventoryLevelAvailableQuantity(level) > 0) names.add(name);
    }
  }
  return [...names].sort((a, b) => a.localeCompare(b));
}

export function buildVariantImages(
  variants: Array<{
    image?: { url?: string | null } | null;
    selectedOptions?: Array<{ name?: string | null; value?: string | null }> | null;
  }>,
): VariantImageEntry[] {
  const out: VariantImageEntry[] = [];
  for (const variant of variants) {
    const imageUrl = variant.image?.url;
    if (!imageUrl) continue;
    const options: Record<string, string> = {};
    for (const option of variant.selectedOptions ?? []) {
      const name = option.name?.trim();
      const value = option.value?.trim();
      if (name && value) options[name] = value;
    }
    if (!Object.keys(options).length) continue;
    out.push({ options, imageUrl });
  }
  return out;
}

function metafieldBagFromEdges(
  edges: Array<{ node: ShopifyMetafieldNode }> | undefined,
): Record<string, string> {
  const bag: Record<string, string> = {};
  for (const edge of edges ?? []) {
    const { namespace, key, value } = edge.node;
    if (!namespace || !key) continue;
    bag[`${namespace}.${key}`] = value;
  }
  return bag;
}

function listFromMetafieldRaw(raw: string | undefined): string[] {
  if (!raw) return [];
  const trimmed = raw.trim();
  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item)).filter(Boolean);
      }
    } catch {
      // keep raw
    }
  }
  return [raw];
}

export function mergeMetafieldBags(
  ...bags: Array<Record<string, string> | undefined>
): Record<string, string> {
  const merged: Record<string, string[]> = {};
  for (const bag of bags) {
    if (!bag) continue;
    for (const [path, raw] of Object.entries(bag)) {
      const list = merged[path] ?? [];
      const seen = new Set(list);
      for (const value of listFromMetafieldRaw(raw)) {
        if (seen.has(value)) continue;
        seen.add(value);
        list.push(value);
      }
      merged[path] = list;
    }
  }
  const out: Record<string, string> = {};
  for (const [path, list] of Object.entries(merged)) {
    out[path] = list.length <= 1 ? (list[0] ?? "") : JSON.stringify(list);
  }
  return out;
}

export function mapProductToFacet(
  shopId: string,
  product: ShopifyProduct,
): {
  facet: Prisma.ProductFacetUncheckedCreateInput;
  collectionGids: string[];
} {
  const variants = shopifyVariantNodes(product);
  const skus = [
    ...new Set(
      variants
        .map((v) => (typeof v.sku === "string" ? v.sku.trim() : ""))
        .filter(Boolean),
    ),
  ];
  const prices = variants
    .map((v) => Number(v.price))
    .filter((n) => Number.isFinite(n));
  const priceMin = prices.length ? Math.min(...prices) : 0;
  const priceMax = prices.length ? Math.max(...prices) : 0;
  const { compareAtMin, compareAtMax, salePct } =
    compareAtAndSaleFromVariants(variants);
  const available = productIsAvailable(product.status, variants);

  const options: Record<string, string[] | Record<string, string>> = {};
  const optionLabels: Record<string, string> = {};
  for (const opt of product.options ?? []) {
    const values = (opt.values ?? []).filter(
      (value): value is string => typeof value === "string" && Boolean(value),
    );
    options[opt.name] = values;
    const optionValues = opt.optionValues ?? [];
    const max = Math.max(values.length, optionValues.length);
    for (let i = 0; i < max; i++) {
      const ov = optionValues[i];
      const raw = values[i] || "";
      const name = String(ov?.name || "").trim();
      if (!name || isMetaobjectGid(name)) continue;
      const linked = String(ov?.linkedMetafieldValue || "").trim();
      if (linked) optionLabels[linked] = name;
      if (raw && isMetaobjectGid(raw)) optionLabels[raw] = name;
    }
    for (const ov of optionValues) {
      const name = String(ov?.name || "").trim();
      const linked = String(ov?.linkedMetafieldValue || "").trim();
      if (!name || isMetaobjectGid(name)) continue;
      if (linked) optionLabels[linked] = name;
    }
  }
  if (Object.keys(optionLabels).length) {
    options[OPTION_VALUE_LABELS_KEY] = optionLabels;
  }

  const metafields = mergeMetafieldBags(
    metafieldBagFromEdges(product.metafields?.edges),
    metafieldBagFromEdges(
      [
        product.reviewsRating,
        product.looxAvgRating,
        product.stampedAvgRating,
      ]
        .filter((node): node is ShopifyMetafieldNode => Boolean(node?.namespace && node?.key))
        .map((node) => ({ node })),
    ),
  );
  const variantMetafields = mergeMetafieldBags(
    ...variants.map((variant) => metafieldBagFromEdges(variant.metafields?.edges)),
  );

  const collectionGids =
    product.collections?.edges?.map((e) => e.node.id) ?? [];

  return {
    facet: {
      shopId,
      productGid: product.id,
      handle: product.handle,
      title: product.title,
      vendor: product.vendor ?? "",
      productType: normalizeProductTypeValue(
        (product.productType || product.product_type || "").trim() ||
          (product.category?.name || product.category?.fullName || "").trim() ||
          "",
      ),
      tags: normalizeTags(product.tags),
      skus,
      options: options as JsonObject,
      priceMin,
      priceMax,
      compareAtMin,
      compareAtMax,
      salePct,
      available,
      inventoryLocations: availableLocationNamesFromVariants(variants),
      status: product.status ?? "ACTIVE",
      imageUrl: product.featuredImage?.url ?? null,
      variantImages: buildVariantImages(variants) as JsonObject,
      variants: buildStoredVariants(
        variants.map((variant) => ({
          ...variant,
          available: variantIsInStock(variant),
        })),
      ) as JsonObject,
      metafields: metafields as JsonObject,
      variantMetafields: variantMetafields as JsonObject,
      marketPrices: mergeProductMarketPrices(product) as JsonObject,
      publishedAt:
        parseShopifyDate(product.publishedAt) ??
        parseShopifyDate(product.createdAt),
    },
    collectionGids,
  };
}

/** Parse a bulk operation JSONL line that may be a product or nested child. */
export function parseBulkJsonlProducts(lines: string[]) {
  const products = new Map<string, ShopifyProduct & { __children?: unknown[] }>();
  const childrenByParent = new Map<string, unknown[]>();

  for (const line of lines) {
    if (!line.trim()) continue;
    const row = JSON.parse(line) as Record<string, unknown> & {
      id?: string;
      __parentId?: string;
    };
    if (row.__parentId) {
      const list = childrenByParent.get(row.__parentId) ?? [];
      list.push(row);
      childrenByParent.set(row.__parentId, list);
      continue;
    }
    if (row.id && String(row.id).includes("/Product/")) {
      products.set(String(row.id), row as unknown as ShopifyProduct);
    }
  }

  const inventoryLevelsByItemId = new Map<string, ShopifyInventoryLevelNode[]>();
  for (const [parentId, kids] of childrenByParent) {
    const levels = kids.filter((k) =>
      String((k as { id?: string }).id || "").includes("/InventoryLevel/"),
    ) as ShopifyInventoryLevelNode[];
    if (!levels.length) continue;
    const existing = inventoryLevelsByItemId.get(parentId) ?? [];
    inventoryLevelsByItemId.set(parentId, [...existing, ...levels]);
  }

  // Attach nested nodes loosely; bulk product query often flattens differently.
  // For products that already include nested connections in one line, use as-is.
  return [...products.values()].map((p) => {
    const kids = childrenByParent.get(p.id) ?? [];
    const variantNodes = kids.filter((k) =>
      String((k as { id?: string }).id || "").includes("/ProductVariant/"),
    ) as ShopifyVariantNode[];
    const nestedVariants = p.variants?.edges?.map((edge) => edge.node) ?? [];
    const baseVariants = variantNodes.length > 0 ? variantNodes : nestedVariants;

    if (!kids.length && !baseVariants.length) return p;

    const variants = baseVariants.map((variant) => {
      const variantKids = childrenByParent.get(String(variant.id ?? "")) ?? [];
      const variantMetafields = variantKids.filter((k) =>
        String((k as { id?: string }).id || "").includes("/Metafield/"),
      );
      const inventoryItemKids = variantKids.filter((k) =>
        String((k as { id?: string }).id || "").includes("/InventoryItem/"),
      ) as Array<{ id?: string | null }>;

      let inventoryItem = variant.inventoryItem ?? null;
      if (inventoryItemKids.length) {
        const itemNode = inventoryItemKids[0];
        inventoryItem = { ...inventoryItem, ...itemNode };
      }

      const itemId = inventoryItem?.id ? String(inventoryItem.id) : "";
      const levels = itemId ? (inventoryLevelsByItemId.get(itemId) ?? []) : [];
      if (levels.length) {
        inventoryItem = {
          ...inventoryItem,
          inventoryLevels: { edges: levels.map((node) => ({ node })) },
        };
      }

      if (!variantMetafields.length && !inventoryItem) return variant;
      return {
        ...variant,
        ...(variantMetafields.length
          ? {
              metafields: {
                edges: variantMetafields.map((node) => ({
                  node: node as ShopifyMetafieldNode,
                })),
              },
            }
          : {}),
        ...(inventoryItem ? { inventoryItem } : {}),
      };
    });

    const metafields = kids.filter((k) =>
      String((k as { id?: string }).id || "").includes("/Metafield/"),
    );
    const collections = kids.filter((k) =>
      String((k as { id?: string }).id || "").includes("/Collection/"),
    );

    return {
      ...p,
      variants: {
        edges: variants.map((node) => ({ node })),
      },
      metafields: metafields.length
        ? { edges: metafields.map((node) => ({ node })) }
        : p.metafields,
      collections: collections.length
        ? { edges: collections.map((node) => ({ node })) }
        : p.collections,
    } as ShopifyProduct;
  });
}
