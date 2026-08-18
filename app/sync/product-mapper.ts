import type { Prisma } from "@prisma/client";

type JsonObject = Prisma.InputJsonValue;

type ShopifyProduct = {
  id: string;
  handle: string;
  title: string;
  vendor?: string | null;
  productType?: string | null;
  tags?: string[] | string | null;
  status?: string | null;
  featuredImage?: { url?: string | null } | null;
  options?: Array<{ name: string; values: string[] }> | null;
  variants?: {
    edges?: Array<{
      node: {
        sku?: string | null;
        price?: string | null;
        availableForSale?: boolean | null;
      };
    }>;
  } | null;
  metafields?: {
    edges?: Array<{
      node: { namespace: string; key: string; value: string };
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

  const metafields: Record<string, string> = {};
  for (const edge of product.metafields?.edges ?? []) {
    const { namespace, key, value } = edge.node;
    metafields[`${namespace}.${key}`] = value;
  }

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
      metafields: metafields as JsonObject,
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

    const variants = kids.filter((k) =>
      String((k as { id?: string }).id || "").includes("/ProductVariant/"),
    );
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
      metafields: {
        edges: metafields.map((node) => ({ node })),
      },
      collections: {
        edges: collections.map((node) => ({ node })),
      },
    } as ShopifyProduct;
  });
}
