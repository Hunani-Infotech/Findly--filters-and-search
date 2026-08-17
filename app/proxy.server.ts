import crypto from "node:crypto";
import prisma from "./db.server";
import {
  buildFacetAggregations,
  expandFacetsWithOptions,
  facetsFromConfig,
  productMatchesFilters,
  type ProductFacetRow,
  type SelectedFilters,
} from "./filters.server";
import { getFilterConfig, getMetafieldMappings } from "./shop.server";
import { getAppSettings } from "./settings.server";

/** Verify Shopify App Proxy signature (HMAC SHA256 of sorted query params). */
export function verifyAppProxySignature(url: URL): boolean {
  const secret = process.env.SHOPIFY_API_SECRET;
  if (!secret) return false;

  const signature = url.searchParams.get("signature");
  if (!signature) return false;

  const params: string[] = [];
  url.searchParams.forEach((value, key) => {
    if (key !== "signature") {
      params.push(`${key}=${value}`);
    }
  });
  params.sort();
  const message = params.join("");
  const digest = crypto
    .createHmac("sha256", secret)
    .update(message)
    .digest("hex");

  try {
    return crypto.timingSafeEqual(
      Buffer.from(digest, "utf8"),
      Buffer.from(signature, "utf8"),
    );
  } catch {
    return false;
  }
}

function toRow(p: {
  productGid: string;
  handle: string;
  title: string;
  vendor: string;
  productType: string;
  tags: string[];
  options: unknown;
  priceMin: { toNumber?: () => number } | number | string;
  priceMax: { toNumber?: () => number } | number | string;
  available: boolean;
  status?: string | null;
  imageUrl: string | null;
  metafields: unknown;
}): ProductFacetRow {
  const num = (v: { toNumber?: () => number } | number | string) => {
    if (typeof v === "number") return v;
    if (typeof v === "string") return Number(v);
    if (v && typeof v.toNumber === "function") return v.toNumber();
    return Number(v);
  };

  return {
    productGid: p.productGid,
    handle: p.handle,
    title: p.title,
    vendor: p.vendor,
    productType: p.productType,
    tags: p.tags,
    options: (p.options as Record<string, string[]>) || {},
    priceMin: num(p.priceMin),
    priceMax: num(p.priceMax),
    available: p.available,
    status: p.status || "ACTIVE",
    imageUrl: p.imageUrl,
    metafields: (p.metafields as Record<string, string>) || {},
  };
}

export async function getCollectionFilterPayload(input: {
  shopDomain: string;
  collectionId?: string | null;
  collectionGid?: string | null;
  selected: SelectedFilters;
}) {
  const shop = await prisma.shop.findUnique({
    where: { domain: input.shopDomain },
  });
  if (!shop) {
    return { error: "Shop not synced", status: 404 as const };
  }

  const collectionGid =
    input.collectionGid ||
    (input.collectionId
      ? `gid://shopify/Collection/${input.collectionId}`
      : null);

  if (!collectionGid) {
    return { error: "collection_id required", status: 400 as const };
  }

  const config = await getFilterConfig(shop.id, collectionGid);
  if (!config?.enabled) {
    return {
      data: { enabled: false, facets: [], products: [], total: 0 },
      status: 200 as const,
    };
  }

  const mappings = await getMetafieldMappings(shop.id);
  const appSettings = await getAppSettings(shop.id);
  const settings = {
    showProductCounts: appSettings.showProductCounts,
    collapseByDefault: appSettings.collapseByDefault,
    widgetPosition: appSettings.widgetPosition,
    accentColor: appSettings.accentColor,
    widgetShadow: appSettings.widgetShadow,
    widgetRadius: appSettings.widgetRadius,
    widgetFontMode: appSettings.widgetFontMode,
    widgetFontFamily: appSettings.widgetFontFamily,
    widgetTitle: appSettings.widgetTitle,
    widgetTitleSize: appSettings.widgetTitleSize,
    widgetTitleColor: appSettings.widgetTitleColor,
  };

  const memberships = await prisma.collectionMembership.findMany({
    where: { shopId: shop.id, collectionGid },
    select: { productGid: true },
  });
  const productGids = memberships.map((m) => m.productGid);

  const productsDb = productGids.length
    ? await prisma.productFacet.findMany({
        where: { shopId: shop.id, productGid: { in: productGids } },
      })
    : [];

  const allRows = productsDb
    .filter((product) => (product.status || "ACTIVE") === "ACTIVE")
    .map(toRow);
  const facets = expandFacetsWithOptions(
    facetsFromConfig(config, mappings),
    allRows,
  );
  const filtered = allRows.filter((product) =>
    productMatchesFilters(product, facets, input.selected),
  );
  const aggregations = buildFacetAggregations(allRows, facets, {
    mode: config.priceRangeMode,
    customMin: config.customPriceMin,
    customMax: config.customPriceMax,
  });

  const data = {
    enabled: true,
    settings,
    facets: aggregations,
    products: filtered.map((product) => ({
      id: product.productGid,
      handle: product.handle,
      title: product.title,
      available: product.available,
      priceMin: product.priceMin,
      priceMax: product.priceMax,
      imageUrl: product.imageUrl,
    })),
    total: filtered.length,
    collectionGid,
  };

  return { data, status: 200 as const };
}

export function parseSelectedFromSearchParams(
  searchParams: URLSearchParams,
): SelectedFilters {
  const selected: SelectedFilters = {};
  searchParams.forEach((value, key) => {
    if (!key.startsWith("f.")) return;
    const facetKey = key.slice(2);
    const parts = value.split(",");
    // Keep empty price/range bounds ("50," or ",100"). List facets drop blanks.
    if (facetKey === "price" || facetKey.startsWith("mf_")) {
      selected[facetKey] = parts;
      return;
    }
    selected[facetKey] = parts.filter(Boolean);
  });
  return selected;
}
