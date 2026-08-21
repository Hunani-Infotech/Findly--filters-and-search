export const METAFIELD_APPLY_KEYS = [
  "display",
  "search",
  "filter",
  "sort",
] as const;

export type MetafieldApplyKey = (typeof METAFIELD_APPLY_KEYS)[number];

const APPLY_SET = new Set<string>(METAFIELD_APPLY_KEYS);

/**
 * New rows participate in launch filters + search. Display is on so the
 * metafield is declared; Sort stays off (storefront sort-by-metafield is later).
 */
export const DEFAULT_NEW_APPLIES: MetafieldApplyKey[] = [
  "display",
  "search",
  "filter",
];

/** Legacy enabled mappings had no appliesTo column — they filtered and searched. */
export const LEGACY_ENABLED_APPLIES: MetafieldApplyKey[] = [
  "display",
  "search",
  "filter",
];

export function normalizeMetafieldAppliesTo(
  value: unknown,
): MetafieldApplyKey[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<MetafieldApplyKey>();
  const next: MetafieldApplyKey[] = [];
  for (const item of value) {
    if (typeof item !== "string" || !APPLY_SET.has(item)) continue;
    const key = item as MetafieldApplyKey;
    if (seen.has(key)) continue;
    seen.add(key);
    next.push(key);
  }
  return next;
}

export function appliesToForMapping(mapping: {
  enabled?: boolean;
  appliesTo?: unknown;
}): MetafieldApplyKey[] {
  const listed = normalizeMetafieldAppliesTo(mapping.appliesTo);
  if (listed.length > 0) return listed;
  return mapping.enabled ? [...LEGACY_ENABLED_APPLIES] : [];
}

export function mappingAppliesToFilter(mapping: {
  enabled?: boolean;
  appliesTo?: unknown;
}): boolean {
  const listed = normalizeMetafieldAppliesTo(mapping.appliesTo);
  if (listed.length > 0) return listed.includes("filter");
  return Boolean(mapping.enabled);
}

export function mappingAppliesToSearch(mapping: {
  enabled?: boolean;
  appliesTo?: unknown;
}): boolean {
  const listed = normalizeMetafieldAppliesTo(mapping.appliesTo);
  if (listed.length > 0) return listed.includes("search");
  return Boolean(mapping.enabled);
}

/**
 * Shopify metafield namespace/key: letters, numbers, hyphen, underscore.
 * App-owned definitions use `$app` or `$app:custom-namespace`.
 */
export function isValidMetafieldPart(value: string): boolean {
  const part = value.trim();
  if (!part || part.length > 255) return false;
  if (part.startsWith("$app")) {
    return /^\$app(?::[a-zA-Z0-9][a-zA-Z0-9_-]{0,62})?$/.test(part);
  }
  return /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,254}$/.test(part);
}

export function metafieldPath(namespace: string, key: string): string {
  return `${namespace.trim()}.${key.trim()}`;
}
