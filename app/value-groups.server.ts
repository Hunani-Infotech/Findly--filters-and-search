import prisma from "./db.server";
import { collectCatalogFromProducts } from "./filter-catalog";

export type ValueGroupRow = {
  id: string;
  name: string;
  sourceKey: string;
  values: string[];
};

export async function getFilterValueCatalog(shopId: string) {
  const products = await prisma.productFacet.findMany({
    where: { shopId, status: "ACTIVE" },
    select: { vendor: true, productType: true, tags: true, options: true },
    take: 2000,
  });
  return collectCatalogFromProducts(products);
}

export async function listValueGroups(shopId: string): Promise<ValueGroupRow[]> {
  const rows = await prisma.valueGroup.findMany({
    where: { shopId },
    orderBy: { updatedAt: "desc" },
  });
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    sourceKey: row.sourceKey,
    values: row.values,
  }));
}

export async function getValueGroup(shopId: string, id: string) {
  return prisma.valueGroup.findFirst({ where: { id, shopId } });
}

export async function createValueGroup(
  shopId: string,
  input: { name: string; sourceKey: string; values: string[] },
) {
  const name = input.name.trim().slice(0, 80);
  if (!name) return { error: "Enter a group name." as const };
  const values = [...new Set(input.values.map((value) => value.trim()).filter(Boolean))];
  if (!values.length) return { error: "Pick at least one value." as const };
  const row = await prisma.valueGroup.create({
    data: {
      shopId,
      name,
      sourceKey: input.sourceKey.trim().slice(0, 80),
      values,
    },
  });
  return { ok: true as const, id: row.id };
}

export async function updateValueGroup(
  shopId: string,
  id: string,
  input: { name: string; sourceKey: string; values: string[] },
) {
  const existing = await getValueGroup(shopId, id);
  if (!existing) return { error: "Group not found." as const };
  const name = input.name.trim().slice(0, 80);
  if (!name) return { error: "Enter a group name." as const };
  const values = [...new Set(input.values.map((value) => value.trim()).filter(Boolean))];
  if (!values.length) return { error: "Pick at least one value." as const };
  await prisma.valueGroup.update({
    where: { id },
    data: { name, sourceKey: input.sourceKey.trim().slice(0, 80), values },
  });
  return { ok: true as const };
}

export async function deleteValueGroup(shopId: string, id: string) {
  await prisma.valueGroup.deleteMany({ where: { id, shopId } });
}

export async function importValueGroups(shopId: string, payload: unknown) {
  const rows = Array.isArray(payload)
    ? payload
    : payload &&
        typeof payload === "object" &&
        Array.isArray((payload as { groups?: unknown }).groups)
      ? (payload as { groups: unknown[] }).groups
      : null;
  if (!rows) return { error: "JSON must be an array of groups." as const };
  let imported = 0;
  for (const item of rows) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const values = Array.isArray(row.values)
      ? row.values.map((value) => String(value))
      : [];
    const result = await createValueGroup(shopId, {
      name: String(row.name || ""),
      sourceKey: String(row.sourceKey || ""),
      values,
    });
    if ("ok" in result && result.ok) imported += 1;
  }
  return { ok: true as const, imported };
}

export function expandSelectedWithGroups(
  selected: string[],
  groups: ValueGroupRow[],
  sourceKey: string,
) {
  const relevant = groups.filter((group) => group.sourceKey === sourceKey);
  if (!relevant.length) return selected;
  const next = new Set(selected);
  for (const group of relevant) {
    if (selected.includes(group.name)) {
      for (const value of group.values) next.add(value);
    }
    if (group.values.some((value) => selected.includes(value))) {
      next.add(group.name);
      for (const value of group.values) next.add(value);
    }
  }
  return [...next];
}

export function mergeFacetValuesWithGroups(
  values: Array<{ value: string; label: string; count: number }>,
  groups: ValueGroupRow[],
  sourceKey: string,
) {
  const relevant = groups.filter((group) => group.sourceKey === sourceKey);
  if (!relevant.length) return values;
  const memberToGroup = new Map<string, ValueGroupRow>();
  for (const group of relevant) {
    for (const value of group.values) memberToGroup.set(value, group);
  }
  const counts = new Map<string, { label: string; count: number }>();
  for (const item of values) {
    const group = memberToGroup.get(item.value);
    const key = group ? group.name : item.value;
    const label = group ? group.name : item.label;
    const prev = counts.get(key);
    counts.set(key, {
      label,
      count: (prev?.count ?? 0) + item.count,
    });
  }
  return [...counts.entries()].map(([value, row]) => ({
    value,
    label: row.label,
    count: row.count,
  }));
}

export function sourceKeyForFacet(facet: {
  source?: string;
  optionName?: string;
  key?: string;
}) {
  if (facet.source === "vendor") return "vendor";
  if (facet.source === "productType") return "productType";
  if (facet.source === "tag") return "tags";
  if (facet.source === "option") {
    const name = facet.optionName || String(facet.key || "").replace(/^opt_/, "");
    return `option:${name.trim().toLowerCase().replace(/\s+/g, "-")}`;
  }
  return "";
}
