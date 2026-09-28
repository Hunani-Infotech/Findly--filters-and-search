import { log } from "../lib/log.server";

const METAOBJECT_GID_RE = /^gid:\/\/shopify\/Metaobject\//i;
const PRODUCT_GID_RE = /^gid:\/\/shopify\/Product\//i;
const LABEL_CACHE_TTL_MS = 10 * 60_000;
const LABEL_CACHE_MAX_SHOPS = 50;

export function isMetaobjectGid(value: string | null | undefined): boolean {
  return Boolean(value && METAOBJECT_GID_RE.test(String(value)));
}

function isProductGid(value: string | null | undefined): boolean {
  return Boolean(value && PRODUCT_GID_RE.test(String(value)));
}

type CacheEntry = { freshUntil: number; labels: Map<string, string> };
const shopLabelCache = new Map<string, CacheEntry>();

function cacheGet(shopDomain: string, gid: string): string | undefined {
  const entry = shopLabelCache.get(shopDomain);
  if (!entry || entry.freshUntil < Date.now()) {
    if (entry) shopLabelCache.delete(shopDomain);
    return undefined;
  }
  return entry.labels.get(gid);
}

function cacheSet(shopDomain: string, labels: Map<string, string>) {
  if (!labels.size) return;
  let entry = shopLabelCache.get(shopDomain);
  if (!entry || entry.freshUntil < Date.now()) {
    entry = { freshUntil: Date.now() + LABEL_CACHE_TTL_MS, labels: new Map() };
    shopLabelCache.set(shopDomain, entry);
    if (shopLabelCache.size > LABEL_CACHE_MAX_SHOPS) {
      const first = shopLabelCache.keys().next().value;
      if (first) shopLabelCache.delete(first);
    }
  } else {
    entry.freshUntil = Date.now() + LABEL_CACHE_TTL_MS;
  }
  for (const [gid, label] of labels) entry.labels.set(gid, label);
}

const METAOBJECT_NODES_QUERY = `#graphql
  query FindlyMetaobjectLabels($ids: [ID!]!) {
    nodes(ids: $ids) {
      ... on Metaobject {
        id
        displayName
        handle
        fields {
          key
          value
        }
      }
    }
  }
`;

/** Needs only read_products — used when Metaobject nodes fail (missing read_metaobjects). */
const PRODUCT_OPTION_LABELS_QUERY = `#graphql
  query FindlyProductOptionLabels($ids: [ID!]!) {
    nodes(ids: $ids) {
      ... on Product {
        id
        options {
          name
          values
          optionValues {
            name
            linkedMetafieldValue
          }
        }
      }
    }
  }
`;

type MetaobjectNode = {
  id?: string | null;
  displayName?: string | null;
  handle?: string | null;
  fields?: Array<{ key?: string | null; value?: string | null }> | null;
};

type ProductOptionNode = {
  id?: string | null;
  options?: Array<{
    name?: string | null;
    values?: Array<string | null> | null;
    optionValues?: Array<{
      name?: string | null;
      linkedMetafieldValue?: string | null;
    } | null> | null;
  } | null> | null;
};

function labelFromMetaobject(node: MetaobjectNode): string | null {
  const display = String(node.displayName || "").trim();
  if (display && !isMetaobjectGid(display)) return display;
  const fields = node.fields || [];
  const preferredKeys = [
    "label",
    "name",
    "title",
    "display_name",
    "color",
    "colour",
    "size",
    "value",
  ];
  for (const key of preferredKeys) {
    const hit = fields.find(
      (field) => String(field.key || "").toLowerCase() === key,
    );
    const value = String(hit?.value || "").trim();
    if (value && !isMetaobjectGid(value)) return value;
  }
  for (const field of fields) {
    const value = String(field.value || "").trim();
    if (value && !isMetaobjectGid(value) && value.length < 80) return value;
  }
  const handle = String(node.handle || "").trim();
  if (handle) return handle.replace(/[-_]+/g, " ");
  return null;
}

function collectLabelsFromProductOptions(
  product: ProductOptionNode,
  out: Map<string, string>,
) {
  for (const opt of product.options || []) {
    if (!opt) continue;
    const values = (opt.values || []).filter(
      (value): value is string => typeof value === "string" && Boolean(value),
    );
    const optionValues = opt.optionValues || [];
    for (const ov of optionValues) {
      if (!ov) continue;
      const name = String(ov.name || "").trim();
      if (!name || isMetaobjectGid(name)) continue;
      const linked = String(ov.linkedMetafieldValue || "").trim();
      if (linked && isMetaobjectGid(linked) && !out.has(linked)) {
        out.set(linked, name);
      }
    }
    const max = Math.max(values.length, optionValues.length);
    for (let i = 0; i < max; i++) {
      const raw = values[i] || "";
      if (!isMetaobjectGid(raw) || out.has(raw)) continue;
      const name = String(optionValues[i]?.name || "").trim();
      if (name && !isMetaobjectGid(name)) out.set(raw, name);
    }
  }
}

async function adminGraphqlJson<T>(
  shopDomain: string,
  query: string,
  ids: string[],
): Promise<T | null> {
  try {
    const { unauthenticated } = await import("../shopify.server");
    const { admin } = await unauthenticated.admin(shopDomain);
    const response = await admin.graphql(query, { variables: { ids } });
    const json = (await response.json()) as T & {
      errors?: Array<{ message?: string }>;
    };
    if (json.errors?.length) {
      log.warn(
        `[metaobject-labels] GraphQL errors for ${shopDomain}: ${json.errors
          .map((e) => e.message)
          .join("; ")}`,
      );
    }
    return json;
  } catch (error) {
    log.warn(
      `[metaobject-labels] resolve failed for ${shopDomain}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return null;
  }
}

/** Resolve Metaobject GIDs → human labels via Admin API (needs read_metaobjects). */
export async function resolveMetaobjectLabels(
  shopDomain: string,
  ids: string[],
): Promise<Map<string, string>> {
  const unique = [
    ...new Set(
      ids
        .map((id) => String(id || "").trim())
        .filter((id) => isMetaobjectGid(id)),
    ),
  ];
  const out = new Map<string, string>();
  if (!unique.length || !shopDomain) return out;

  const chunkSize = 50;
  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize);
    const json = await adminGraphqlJson<{
      data?: { nodes?: Array<MetaobjectNode | null> };
    }>(shopDomain, METAOBJECT_NODES_QUERY, chunk);
    for (const node of json?.data?.nodes || []) {
      if (!node?.id) continue;
      const label = labelFromMetaobject(node);
      if (label) out.set(node.id, label);
    }
  }
  return out;
}

/**
 * Resolve Metaobject GIDs via Product.optionValues (read_products only).
 * Reliable for taxonomy-linked Size/Color options without read_metaobjects.
 */
export async function resolveOptionLabelsFromProducts(
  shopDomain: string,
  productGids: string[],
): Promise<Map<string, string>> {
  const unique = [
    ...new Set(
      productGids
        .map((id) => String(id || "").trim())
        .filter((id) => isProductGid(id)),
    ),
  ];
  const out = new Map<string, string>();
  if (!unique.length || !shopDomain) return out;

  const chunkSize = 25;
  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize);
    const json = await adminGraphqlJson<{
      data?: { nodes?: Array<ProductOptionNode | null> };
    }>(shopDomain, PRODUCT_OPTION_LABELS_QUERY, chunk);
    for (const node of json?.data?.nodes || []) {
      if (!node) continue;
      collectLabelsFromProductOptions(node, out);
    }
  }
  return out;
}

/**
 * Prefer Metaobject nodes, then fall back to Product.optionValues for any
 * remaining GIDs. Works even when the app lacks read_metaobjects.
 */
export async function resolveFilterValueLabels(input: {
  shopDomain: string;
  metaobjectGids: string[];
  productGids?: string[];
}): Promise<Map<string, string>> {
  const wanted = [
    ...new Set(
      input.metaobjectGids
        .map((id) => String(id || "").trim())
        .filter((id) => isMetaobjectGid(id)),
    ),
  ];
  const out = new Map<string, string>();
  if (!wanted.length || !input.shopDomain) return out;

  for (const gid of wanted) {
    const cached = cacheGet(input.shopDomain, gid);
    if (cached) out.set(gid, cached);
  }
  const unresolved = wanted.filter((gid) => !out.has(gid));
  if (!unresolved.length) return out;

  const fromMeta = await resolveMetaobjectLabels(input.shopDomain, unresolved);
  for (const [gid, label] of fromMeta) out.set(gid, label);

  const stillMissing = unresolved.filter((gid) => !out.has(gid));
  if (stillMissing.length) {
    const productGids = (input.productGids || []).slice(0, 100);
    const fromProducts = await resolveOptionLabelsFromProducts(
      input.shopDomain,
      productGids,
    );
    for (const gid of stillMissing) {
      const label = fromProducts.get(gid);
      if (label) out.set(gid, label);
    }
  }

  cacheSet(input.shopDomain, out);
  return out;
}
