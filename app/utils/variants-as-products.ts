import type { ProductFacetRow } from "./filters";
import { OPTION_VALUE_LABELS_KEY } from "./filters";

export type StoredVariant = {
  id: string;
  sku: string;
  title: string;
  options: Record<string, string>;
  imageUrl: string;
  available: boolean;
  price: number;
};

const OPTION_NAME_MAX = 20;

export function shopifyNumericId(gid: string): string {
  const match = String(gid || "").match(/(\d+)\s*$/);
  return match?.[1] || "";
}

export function variantCardKey(handle: string, variantId: string): string {
  const num = shopifyNumericId(variantId);
  const h = String(handle || "").toLowerCase();
  return num ? `${h}::${num}` : h;
}

export function normalizeVariantOptionNames(value: unknown): string[] {
  const parts = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[\n,]+/)
      : [];
  const seen = new Set<string>();
  const next: string[] = [];
  for (const part of parts) {
    if (typeof part !== "string") continue;
    const name = part.trim().slice(0, 80);
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    next.push(name);
    if (next.length >= OPTION_NAME_MAX) break;
  }
  return next;
}

export function parseStoredVariants(raw: unknown): StoredVariant[] {
  if (!Array.isArray(raw)) return [];
  const out: StoredVariant[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const id = typeof rec.id === "string" ? rec.id : "";
    const options: Record<string, string> = {};
    if (rec.options && typeof rec.options === "object" && !Array.isArray(rec.options)) {
      for (const [key, value] of Object.entries(
        rec.options as Record<string, unknown>,
      )) {
        if (typeof value === "string" && value.trim()) options[key] = value.trim();
      }
    }
    const title =
      typeof rec.title === "string" && rec.title.trim()
        ? rec.title.trim()
        : Object.values(options).join(" / ");
    const price = Number(rec.price);
    out.push({
      id,
      sku: typeof rec.sku === "string" ? rec.sku : "",
      title,
      options,
      imageUrl: typeof rec.imageUrl === "string" ? rec.imageUrl : "",
      available: rec.available !== false,
      price: Number.isFinite(price) ? price : 0,
    });
  }
  return out;
}

export function buildStoredVariants(
  variants: Array<{
    id?: string;
    sku?: string | null;
    price?: string | null;
    available?: boolean | null;
    availableForSale?: boolean | null;
    image?: { url?: string | null } | null;
    selectedOptions?: Array<{ name?: string | null; value?: string | null }> | null;
  }>,
): StoredVariant[] {
  return variants.map((variant) => {
    const options: Record<string, string> = {};
    for (const option of variant.selectedOptions ?? []) {
      const name = option.name?.trim();
      const value = option.value?.trim();
      if (name && value) options[name] = value;
    }
    const title = Object.values(options).join(" / ");
    const price = Number(variant.price);
    return {
      id: String(variant.id || ""),
      sku: typeof variant.sku === "string" ? variant.sku.trim() : "",
      title,
      options,
      imageUrl: variant.image?.url || "",
      available:
        typeof variant.available === "boolean"
          ? variant.available
          : variant.availableForSale !== false,
      price: Number.isFinite(price) ? price : 0,
    };
  });
}

function optionKey(name: string) {
  return name.trim().toLowerCase();
}

function groupKey(variant: StoredVariant, names: string[]): string {
  if (!names.length) {
    return variant.id || JSON.stringify(variant.options);
  }
  const parts: string[] = [];
  for (const name of names) {
    const want = optionKey(name);
    let value = "";
    for (const [key, item] of Object.entries(variant.options)) {
      if (optionKey(key) === want) {
        value = item;
        break;
      }
    }
    parts.push(`${want}=${value.toLowerCase()}`);
  }
  return parts.join("|");
}

function mergeGroupOptions(group: StoredVariant[]): Record<string, string[]> {
  const bag: Record<string, Set<string>> = {};
  for (const variant of group) {
    for (const [name, value] of Object.entries(variant.options)) {
      const set = bag[name] ?? new Set<string>();
      set.add(value);
      bag[name] = set;
    }
  }
  const out: Record<string, string[]> = {};
  for (const [name, set] of Object.entries(bag)) {
    out[name] = [...set];
  }
  return out;
}

function rowFromGroup(
  product: ProductFacetRow,
  group: StoredVariant[],
): ProductFacetRow {
  const primary =
    group.find((item) => item.available) || group[0] || {
      id: "",
      sku: "",
      title: "",
      options: {},
      imageUrl: "",
      available: true,
      price: product.priceMin,
    };
  const prices = group.map((item) => item.price).filter((n) => Number.isFinite(n));
  const priceMin = prices.length ? Math.min(...prices) : product.priceMin;
  const priceMax = prices.length ? Math.max(...prices) : product.priceMax;
  const imageUrl =
    group.find((item) => item.imageUrl)?.imageUrl ||
    product.imageUrl ||
    "";
  const label = primary.title || Object.values(primary.options).join(" / ");
  const merged = mergeGroupOptions(group);
  const labels = product.options?.[OPTION_VALUE_LABELS_KEY];
  if (labels && typeof labels === "object" && !Array.isArray(labels)) {
    (merged as Record<string, unknown>)[OPTION_VALUE_LABELS_KEY] = labels;
  }
  return {
    ...product,
    title: label ? `${product.title} – ${label}` : product.title,
    options: merged as ProductFacetRow["options"],
    priceMin,
    priceMax,
    available: group.some((item) => item.available),
    imageUrl: imageUrl || product.imageUrl,
    variantImages: group
      .filter((item) => item.imageUrl)
      .map((item) => ({ options: item.options, imageUrl: item.imageUrl })),
    variants: group,
    variantGid: primary.id,
  };
}

/** One collection card per variant, or per unique combo of optionNames (e.g. Color). */
export function expandProductsAsVariants(
  products: ProductFacetRow[],
  optionNames: string[],
): ProductFacetRow[] {
  const names = normalizeVariantOptionNames(optionNames);
  const out: ProductFacetRow[] = [];
  for (const product of products) {
    const variants = parseStoredVariants(product.variants);
    if (!variants.length) {
      out.push(product);
      continue;
    }
    const buckets = new Map<string, StoredVariant[]>();
    for (const variant of variants) {
      const key = groupKey(variant, names);
      const list = buckets.get(key) ?? [];
      list.push(variant);
      buckets.set(key, list);
    }
    if (buckets.size <= 1 && variants.length <= 1) {
      out.push(product);
      continue;
    }
    for (const group of buckets.values()) {
      out.push(rowFromGroup(product, group));
    }
  }
  return out;
}
