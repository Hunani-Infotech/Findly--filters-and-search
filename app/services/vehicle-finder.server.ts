import prisma from "../db.server";
import { getAdminNavExtras } from "./admin-extras.server";
import { createTtlCache } from "../lib/read-cache.server";
import { findShopCached } from "../lib/shop-cache.server";
import {
  cascadeOptions,
  parseFitmentBag,
  uniqueHandles,
  type VehicleFinderAdmin,
  type YmmFitmentRow,
} from "../utils/vehicle-finder";

export type YmmProductHit = {
  handle: string;
  title: string;
  imageUrl: string;
  url: string;
  available: boolean;
  priceMin: number;
};

type LoadedFitment = YmmFitmentRow & {
  title?: string;
  imageUrl?: string;
  available?: boolean;
  priceMin?: number;
};

const ymmFitmentsCache = createTtlCache<LoadedFitment[]>(45_000);

const PRODUCT_SLIM_SELECT = {
  handle: true,
  title: true,
  imageUrl: true,
  available: true,
  priceMin: true,
} as const;

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

function toLoadedFitment(
  handle: string,
  values: string[],
  product?: {
    handle: string;
    title: string;
    imageUrl: string | null;
    available: boolean;
    priceMin: { toNumber?: () => number } | number | string;
  },
): LoadedFitment {
  return {
    handle: product?.handle ?? handle,
    values,
    title: product?.title,
    imageUrl: product?.imageUrl ?? "",
    available: product?.available,
    priceMin: product ? Number(product.priceMin) : undefined,
  };
}

async function loadYmmFitmentsUncached(
  shopId: string,
  ymm: VehicleFinderAdmin,
): Promise<LoadedFitment[]> {
  const path = ymm.metafieldPath.trim();
  const rows: LoadedFitment[] = [];

  if (!path) {
    const handles = [...new Set(ymm.rows.map((row) => row.handle).filter(Boolean))];
    const products = handles.length
      ? await prisma.productFacet.findMany({
          where: { shopId, status: "ACTIVE", handle: { in: handles } },
          select: PRODUCT_SLIM_SELECT,
        })
      : [];
    const byHandle = new Map(products.map((product) => [product.handle.toLowerCase(), product]));
    for (const row of ymm.rows) {
      rows.push(toLoadedFitment(row.handle, row.values, byHandle.get(row.handle.toLowerCase())));
    }
    return rows;
  }

  const products = await prisma.productFacet.findMany({
    where: { shopId, status: "ACTIVE" },
    select: {
      ...PRODUCT_SLIM_SELECT,
      metafields: true,
      variantMetafields: true,
    },
  });
  const byHandle = new Map(products.map((product) => [product.handle.toLowerCase(), product]));

  for (const product of products) {
    const fromMf = fitmentsFromProduct(
      product.handle,
      product.metafields,
      product.variantMetafields,
      path,
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
    rows.push(toLoadedFitment(row.handle, row.values, byHandle.get(row.handle.toLowerCase())));
  }

  return rows;
}

export async function loadYmmFitments(
  shopId: string,
  ymm: VehicleFinderAdmin,
): Promise<LoadedFitment[]> {
  return ymmFitmentsCache.wrap(shopId, () => loadYmmFitmentsUncached(shopId, ymm));
}

export async function ymmConfigPayload(shopDomain: string) {
  const shop = await findShopCached(shopDomain);
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
  const shop = await findShopCached(shopDomain);
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
  const shop = await findShopCached(shopDomain);
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
  const byHandle = new Map<string, LoadedFitment>();
  for (const row of fitments) {
    const key = row.handle.toLowerCase();
    if (!byHandle.has(key)) byHandle.set(key, row);
  }
  const products: YmmProductHit[] = [];
  for (const handle of handles) {
    const row = byHandle.get(handle);
    if (!row) continue;
    const title = row.title?.trim() || row.handle;
    if (!title) continue;
    products.push({
      handle: row.handle,
      title,
      imageUrl: row.imageUrl ?? "",
      url: `/products/${row.handle}`,
      available: row.available ?? false,
      priceMin: Number(row.priceMin ?? 0) || 0,
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
