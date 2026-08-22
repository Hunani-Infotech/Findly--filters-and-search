import prisma from "./db.server";
import { getAdminNavExtras } from "./admin-nav-extras.server";
import {
  isRecWidgetId,
  parseHandleList,
  type RecWidgetId,
  type RecsConfig,
} from "./recs";

export type RecProduct = {
  handle: string;
  title: string;
  imageUrl: string;
  url: string;
  available: boolean;
  priceMin: number;
};

function toProduct(row: {
  handle: string;
  title: string;
  imageUrl: string | null;
  available: boolean;
  priceMin: { toNumber?: () => number } | number | string;
}): RecProduct {
  const price =
    typeof row.priceMin === "number"
      ? row.priceMin
      : typeof row.priceMin === "string"
        ? Number(row.priceMin)
        : row.priceMin.toNumber?.() ?? 0;
  return {
    handle: row.handle,
    title: row.title,
    imageUrl: row.imageUrl ?? "",
    url: `/products/${row.handle}`,
    available: row.available,
    priceMin: Number.isFinite(price) ? price : 0,
  };
}

async function productsByHandles(
  shopId: string,
  handles: string[],
  exclude: string,
  limit: number,
): Promise<RecProduct[]> {
  if (!handles.length || limit <= 0) return [];
  const rows = await prisma.productFacet.findMany({
    where: {
      shopId,
      status: "ACTIVE",
      handle: { in: handles },
    },
  });
  const byHandle = new Map(rows.map((row) => [row.handle.toLowerCase(), row]));
  const out: RecProduct[] = [];
  for (const handle of handles) {
    if (handle === exclude) continue;
    const row = byHandle.get(handle);
    if (!row) continue;
    out.push(toProduct(row));
    if (out.length >= limit) break;
  }
  return out;
}

async function newestProducts(
  shopId: string,
  exclude: string,
  limit: number,
): Promise<RecProduct[]> {
  const rows = await prisma.productFacet.findMany({
    where: { shopId, status: "ACTIVE" },
    orderBy: [{ publishedAt: "desc" }, { updatedAt: "desc" }],
    take: Math.min(40, Math.max(limit + 8, limit)),
  });
  const out: RecProduct[] = [];
  for (const row of rows) {
    if (row.handle.toLowerCase() === exclude) continue;
    out.push(toProduct(row));
    if (out.length >= limit) break;
  }
  return out;
}

async function bestsellerProducts(
  shopId: string,
  exclude: string,
  limit: number,
): Promise<RecProduct[]> {
  const rows = await prisma.productFacet.findMany({
    where: { shopId, status: "ACTIVE" },
    orderBy: [{ salePct: "desc" }, { publishedAt: "desc" }],
    take: Math.min(40, Math.max(limit + 8, limit)),
  });
  const out: RecProduct[] = [];
  for (const row of rows) {
    if (row.handle.toLowerCase() === exclude) continue;
    out.push(toProduct(row));
    if (out.length >= limit) break;
  }
  return out;
}

function relatedHandles(recs: RecsConfig, currentHandle: string): string[] {
  if (!currentHandle) return recs.picks["hand-picked-related-products"] ?? recs.picks.home ?? [];
  return (
    recs.related[currentHandle] ??
    recs.picks["hand-picked-related-products"] ??
    []
  );
}

export async function recsPayload(input: {
  shopDomain: string;
  type: string;
  productHandle?: string;
  handles?: string[];
  limit?: number;
}) {
  const shop = await prisma.shop.findUnique({ where: { domain: input.shopDomain } });
  if (!shop) return { error: "Shop not synced", status: 404 as const };

  const extras = await getAdminNavExtras(shop.id);
  const recs = extras.recs;
  const type = isRecWidgetId(input.type) ? input.type : "new-products";
  const enabled = recs.on[type] === true;
  const exclude = (input.productHandle ?? "").trim().toLowerCase();
  const limit = Math.min(12, Math.max(1, input.limit ?? recs.counts.desktop));

  if (!enabled) {
    return {
      status: 200 as const,
      data: {
        enabled: false,
        type,
        products: [] as RecProduct[],
        counts: recs.counts,
      },
    };
  }

  let products: RecProduct[] = [];

  if (type === "recently-viewed-products") {
    products = await productsByHandles(
      shop.id,
      parseHandleList(input.handles ?? [], 24),
      exclude,
      limit,
    );
  } else if (type === "hand-picked-related-products" || type === "frequently-bought-together") {
    products = await productsByHandles(
      shop.id,
      relatedHandles(recs, exclude),
      exclude,
      limit,
    );
  } else if (type === "new-products" || type === "trending-products") {
    const picked = recs.picks[type];
    products = picked?.length
      ? await productsByHandles(shop.id, picked, exclude, limit)
      : await newestProducts(shop.id, exclude, limit);
  } else if (type === "best-sellers") {
    const picked = recs.picks[type];
    products = picked?.length
      ? await productsByHandles(shop.id, picked, exclude, limit)
      : await bestsellerProducts(shop.id, exclude, limit);
  } else {
    const picked = recs.picks[type];
    products = picked?.length
      ? await productsByHandles(shop.id, picked, exclude, limit)
      : await newestProducts(shop.id, exclude, limit);
  }

  return {
    status: 200 as const,
    data: {
      enabled: true,
      type,
      products,
      counts: recs.counts,
    },
  };
}

export function parseRecType(raw: string | null): RecWidgetId {
  const value = String(raw || "").trim();
  return isRecWidgetId(value) ? value : "new-products";
}
