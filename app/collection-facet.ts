export const COLLECTION_FACET_KEY = "collection";

export type ShopCollection = {
  collectionGid: string;
  title: string;
  handle: string;
};

export type CollectionFacetValue = {
  value: string;
  label: string;
  count: number;
  handle?: string;
  url?: string;
  children?: CollectionFacetValue[];
};

export function collectionStorefrontPath(handle: string): string {
  const cleaned = String(handle || "")
    .trim()
    .replace(/^\/+|\/+$/g, "")
    .replace(/^collections\//i, "");
  return cleaned ? `/collections/${cleaned}` : "";
}

export function parseCollectionParents(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, string> = {};
  for (const [child, parent] of Object.entries(raw as Record<string, unknown>)) {
    if (!child || typeof parent !== "string" || !parent || parent === child) {
      continue;
    }
    out[child] = parent;
  }
  return out;
}

function wouldCycle(
  child: string,
  parent: string,
  parents: Record<string, string>,
): boolean {
  let current: string | undefined = parent;
  const seen = new Set<string>();
  while (current) {
    if (current === child) return true;
    if (seen.has(current)) return true;
    seen.add(current);
    current = parents[current];
  }
  return false;
}

/** Shop-wide collection sizes when provided; otherwise overlap with `products`. */
export function collectionFacetCounts(
  products: Array<{ collectionGids?: string[] }>,
  shopTotals?: Map<string, number> | null,
): Map<string, number> {
  if (shopTotals) return new Map(shopTotals);
  const counts = new Map<string, number>();
  for (const product of products) {
    for (const gid of product.collectionGids || []) {
      if (!gid) continue;
      counts.set(gid, (counts.get(gid) || 0) + 1);
    }
  }
  return counts;
}

export function nestCollectionValues(
  values: CollectionFacetValue[],
  parents: Record<string, string>,
): CollectionFacetValue[] {
  if (!values.length || !Object.keys(parents).length) return values;

  const byId = new Map(
    values.map((item) => [
      item.value,
      { ...item, children: [] as CollectionFacetValue[] },
    ]),
  );
  const childSet = new Set<string>();
  for (const [child, parent] of Object.entries(parents)) {
    if (!byId.has(child) || !byId.has(parent)) continue;
    if (wouldCycle(child, parent, parents)) continue;
    byId.get(parent)!.children!.push(byId.get(child)!);
    childSet.add(child);
  }

  const order = new Map(values.map((item, index) => [item.value, index]));
  const sortNodes = (nodes: CollectionFacetValue[]) => {
    nodes.sort(
      (a, b) => (order.get(a.value) ?? 0) - (order.get(b.value) ?? 0),
    );
    for (const node of nodes) {
      if (node.children?.length) sortNodes(node.children);
      else delete node.children;
    }
  };

  const roots = values
    .filter((item) => !childSet.has(item.value))
    .map((item) => byId.get(item.value)!);
  sortNodes(roots);
  return roots;
}

export function productInSelectedCollections(
  collectionGids: string[] | undefined,
  selected: string[],
  matchMode: "or" | "and" = "or",
): boolean {
  if (!selected.length) return true;
  const have = new Set(collectionGids || []);
  if (!have.size) return false;
  if (matchMode === "and") return selected.every((id) => have.has(id));
  return selected.some((id) => have.has(id));
}

export function withCollectionMeta(
  values: Array<{ value: string; label: string; count: number }>,
  catalog: ShopCollection[],
): CollectionFacetValue[] {
  const byGid = new Map(catalog.map((row) => [row.collectionGid, row]));
  return values.map((item) => {
    const row = byGid.get(item.value);
    const handle = row?.handle || "";
    return {
      ...item,
      label: row?.title || item.label,
      handle,
      url: collectionStorefrontPath(handle),
    };
  });
}
