import prisma from "./db.server";
import { getAdminNavExtras } from "./admin-nav-extras.server";
import {
  cascadeOptions,
  parseFitmentBag,
  uniqueHandles,
  type VehicleFinderAdmin,
  type YmmFitmentRow,
} from "./ymm";

export type YmmProductHit = {
  handle: string;
  title: string;
  imageUrl: string;
  url: string;
  available: boolean;
  priceMin: number;
};

function metafieldMap(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return raw as Record<string, unknown>;
}

function fitmentsFromProduct(
  handle: string,
  metafields: unknown,
  variantMetafields: unknown,
  path: string,
): YmmFitmentRow[] {
  const key = path.trim();
  if (!key || !handle) return [];
  const bag = { ...metafieldMap(metafields), ...metafieldMap(variantMetafields) };
  const tuples = parseFitmentBag(bag[key] ?? bag[key.toLowerCase()]);
  return tuples.map((values) => ({ handle, values }));
}

export async function loadYmmFitments(
  shopId: string,
  ymm: VehicleFinderAdmin,
): Promise<Array<YmmFitmentRow & { title?: string; imageUrl?: string; available?: boolean; priceMin?: number }>> {
  const products = await prisma.productFacet.findMany({
    where: { shopId, status: "ACTIVE" },
    select: {
      handle: true,
      title: true,
      imageUrl: true,
      available: true,
      priceMin: true,
      metafields: true,
      variantMetafields: true,
    },
  });
  const byHandle = new Map(products.map((product) => [product.handle.toLowerCase(), product]));
  const rows: Array<
    YmmFitmentRow & {
      title?: string;
      imageUrl?: string;
      available?: boolean;
      priceMin?: number;
    }
  > = [];

  for (const product of products) {
    const fromMf = fitmentsFromProduct(
      product.handle,
      product.metafields,
      product.variantMetafields,
      ymm.metafieldPath,
    );
    for (const row of fromMf) {
      rows.push({
        ...row,
        handle: product.handle,
        title: product.title,
        imageUrl: product.imageUrl ?? "",
        available: product.available,
        priceMin: Number(product.priceMin),
      });
    }
  }

  for (const row of ymm.rows) {
    const product = byHandle.get(row.handle.toLowerCase());
    rows.push({
      handle: product?.handle ?? row.handle,
      values: row.values,
      title: product?.title,
      imageUrl: product?.imageUrl ?? "",
      available: product?.available,
      priceMin: product ? Number(product.priceMin) : undefined,
    });
  }

  return rows;
}

export async function ymmConfigPayload(shopDomain: string) {
  const shop = await prisma.shop.findUnique({ where: { domain: shopDomain } });
  if (!shop) return { error: "Shop not synced", status: 404 as const };
  const extras = await getAdminNavExtras(shop.id);
  const ymm = extras.ymm;
  return {
    status: 200 as const,
    data: {
      enabled: ymm.enabled,
      heading: ymm.heading,
      showSearch: ymm.showSearch,
      fields: ymm.fields.map((field) => ({
        id: field.id,
        label: field.label,
      })),
      styles: {
        radius: ymm.radius,
        bg: ymm.bg,
        headingColor: ymm.headingColor,
        labelColor: ymm.labelColor,
        borderColor: ymm.borderColor,
        selectBg: ymm.selectBg,
        btnText: ymm.btnText,
        btnBg: ymm.btnBg,
      },
    },
  };
}

export async function ymmOptionsPayload(shopDomain: string, selected: string[]) {
  const shop = await prisma.shop.findUnique({ where: { domain: shopDomain } });
  if (!shop) return { error: "Shop not synced", status: 404 as const };
  const extras = await getAdminNavExtras(shop.id);
  const ymm = extras.ymm;
  if (!ymm.enabled) {
    return { status: 200 as const, data: { enabled: false, options: [] as const } };
  }
  const fitments = await loadYmmFitments(shop.id, ymm);
  const options = cascadeOptions(ymm.fields, fitments, selected);
  return { status: 200 as const, data: { enabled: true, options } };
}

export async function ymmSearchPayload(shopDomain: string, selected: string[]) {
  const shop = await prisma.shop.findUnique({ where: { domain: shopDomain } });
  if (!shop) return { error: "Shop not synced", status: 404 as const };
  const extras = await getAdminNavExtras(shop.id);
  const ymm = extras.ymm;
  if (!ymm.enabled) {
    return {
      status: 200 as const,
      data: { enabled: false, products: [] as YmmProductHit[], handles: [] as string[] },
    };
  }
  const fitments = await loadYmmFitments(shop.id, ymm);
  const handles = uniqueHandles(fitments, selected);
  const handleSet = new Set(handles);
  const productsDb = await prisma.productFacet.findMany({
    where: { shopId: shop.id, status: "ACTIVE", handle: { in: [...handleSet] } },
  });
  const byHandle = new Map(
    productsDb.map((product) => [product.handle.toLowerCase(), product]),
  );
  const products: YmmProductHit[] = [];
  for (const handle of handles) {
    const product = byHandle.get(handle);
    if (!product) continue;
    products.push({
      handle: product.handle,
      title: product.title,
      imageUrl: product.imageUrl ?? "",
      url: `/products/${product.handle}`,
      available: product.available,
      priceMin: Number(product.priceMin),
    });
  }
  return {
    status: 200 as const,
    data: { enabled: true, products, handles: products.map((item) => item.handle) },
  };
}

export function parseSelectedValues(searchParams: URLSearchParams, fieldCount: number): string[] {
  const listed = searchParams.getAll("v").map((item) => item.trim());
  if (listed.length) return listed.slice(0, Math.max(fieldCount, listed.length));
  const selected: string[] = [];
  for (let i = 0; i < fieldCount; i++) {
    selected.push(
      (
        searchParams.get(`f${i}`) ||
        searchParams.get(`v${i}`) ||
        ""
      ).trim(),
    );
  }
  while (selected.length && !selected[selected.length - 1]) selected.pop();
  return selected;
}
