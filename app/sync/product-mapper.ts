import type { Prisma } from "@prisma/client";

type JsonObject = Prisma.InputJsonValue;

type ShopifyMetafieldNode = { namespace: string; key: string; value: string };

type ShopifyVariantNode = {
  id?: string;
  sku?: string | null;
  price?: string | null;
  availableForSale?: boolean | null;
  image?: { url?: string | null } | null;
  selectedOptions?: Array<{ name?: string | null; value?: string | null }> | null;
  metafields?: {
    edges?: Array<{
      node: ShopifyMetafieldNode;
    }>;
  } | null;
};

type ShopifyProduct = {
  id: string;
  handle: string;
  title: string;
  vendor?: string | null;
  productType?: string | null;
  tags?: string[] | string | null;
  status?: string | null;
  createdAt?: string | null;
  publishedAt?: string | null;
  featuredImage?: { url?: string | null } | null;
  options?: Array<{ name: string; values: string[] }> | null;
  variants?: {
    edges?: Array<{
      node: ShopifyVariantNode;
    }>;
  } | null;
  metafields?: {
    edges?: Array<{
      node: ShopifyMetafieldNode;
    }>;
  } | null;
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

export type VariantImageEntry = {
  options: Record<string, string>;
  imageUrl: string;
};

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
  const variants = product.variants?.edges?.map((e) => e.node) ?? [];
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
  const available =
    product.status === "ACTIVE" &&
    variants.some((v) => v.availableForSale !== false);

  const options: Record<string, string[]> = {};
  for (const opt of product.options ?? []) {
    options[opt.name] = opt.values ?? [];
  }

  const metafields = metafieldBagFromEdges(product.metafields?.edges);
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
      productType: product.productType ?? "",
      tags: normalizeTags(product.tags),
      skus,
      options: options as JsonObject,
      priceMin,
      priceMax,
      available,
      status: product.status ?? "ACTIVE",
      imageUrl: product.featuredImage?.url ?? null,
      variantImages: buildVariantImages(variants) as JsonObject,
      metafields: metafields as JsonObject,
      variantMetafields: variantMetafields as JsonObject,
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

  // Attach nested nodes loosely; bulk product query often flattens differently.
  // For products that already include nested connections in one line, use as-is.
  return [...products.values()].map((p) => {
    const kids = childrenByParent.get(p.id) ?? [];
    if (!kids.length) return p;

    const variantNodes = kids.filter((k) =>
      String((k as { id?: string }).id || "").includes("/ProductVariant/"),
    ) as ShopifyVariantNode[];
    const baseVariants =
      variantNodes.length > 0
        ? variantNodes
        : (p.variants?.edges?.map((edge) => edge.node) ?? []);

    const variants = baseVariants.map((variant) => {
      const variantKids = childrenByParent.get(String(variant.id ?? "")) ?? [];
      const variantMetafields = variantKids.filter((k) =>
        String((k as { id?: string }).id || "").includes("/Metafield/"),
      );
      if (!variantMetafields.length) return variant;
      return {
        ...variant,
        metafields: {
          edges: variantMetafields.map((node) => ({
            node: node as ShopifyMetafieldNode,
          })),
        },
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
