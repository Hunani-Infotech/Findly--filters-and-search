import type { FilterConfig, Prisma } from "@prisma/client";
import prisma from "./db.server";
import { DEFAULT_DISPLAY_ORDER, mappedFacetsForAdmin } from "./filters.server";
import {
  nextDisplayOrderForMetafieldSync,
  withAdminOptionKeys,
} from "./filter-option-rows";
import {
  parseFacetSettings,
  parseKnownMetafieldKeys,
  withFilterTreeMeta,
} from "./facet-settings";

export type FilterTreeWithCollections = FilterConfig & {
  treeCollections: Array<{ collectionGid: string }>;
};

function newest(trees: FilterConfig[]): FilterConfig | null {
  if (!trees.length) return null;
  return [...trees].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  )[0];
}

export async function listFilterTrees(
  shopId: string,
): Promise<FilterTreeWithCollections[]> {
  return prisma.filterConfig.findMany({
    where: { shopId },
    include: { treeCollections: { select: { collectionGid: true } } },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });
}

export async function getFilterTree(
  shopId: string,
  treeId: string,
): Promise<FilterTreeWithCollections | null> {
  return prisma.filterConfig.findFirst({
    where: { id: treeId, shopId },
    include: { treeCollections: { select: { collectionGid: true } } },
  });
}

async function treesAssignedToCollection(shopId: string, collectionGid: string) {
  const joins = await prisma.filterTreeCollection.findMany({
    where: { shopId, collectionGid },
    include: { tree: true },
  });
  const fromJoin = joins.map((row) => row.tree);
  const fromLegacy = await prisma.filterConfig.findMany({
    where: { shopId, collectionGid },
  });
  const byId = new Map<string, FilterConfig>();
  for (const tree of [...fromJoin, ...fromLegacy]) {
    byId.set(tree.id, tree);
  }
  return [...byId.values()];
}

async function unassignedTrees(shopId: string) {
  return prisma.filterConfig.findMany({
    where: {
      shopId,
      collectionGid: "",
      treeCollections: { none: {} },
    },
  });
}

/** Collection page: last-created assigned tree, else last-created unassigned default. */
export async function resolveFilterTreeForCollection(
  shopId: string,
  collectionGid: string,
): Promise<FilterConfig | null> {
  const assigned = newest(await treesAssignedToCollection(shopId, collectionGid));
  if (assigned) return assigned;
  return newest(await unassignedTrees(shopId));
}

/** Search page: last-created tree with appliesToSearch. */
export async function resolveFilterTreeForSearch(
  shopId: string,
): Promise<FilterConfig | null> {
  const trees = await prisma.filterConfig.findMany({
    where: { shopId, appliesToSearch: true },
  });
  const searchTree = newest(trees);
  if (searchTree) return searchTree;
  return newest(await unassignedTrees(shopId));
}

export async function hasCollectionAssignment(
  shopId: string,
  collectionGid: string,
) {
  const join = await prisma.filterTreeCollection.findFirst({
    where: { shopId, collectionGid },
    select: { id: true },
  });
  if (join) return true;
  const legacy = await prisma.filterConfig.findFirst({
    where: { shopId, collectionGid },
    select: { id: true },
  });
  return Boolean(legacy);
}

export function isAbandonedDraftName(name: string) {
  const trimmed = name.trim().toLowerCase();
  return !trimmed || trimmed === "untitled" || trimmed === "untitled tree";
}

export function defaultFilterTreeDisplayOrder() {
  return withAdminOptionKeys([...DEFAULT_DISPLAY_ORDER]);
}

/** Drop filters that were created by Add Filter then abandoned (never named). */
export async function deleteAbandonedDraftTrees(shopId: string) {
  const trees = await prisma.filterConfig.findMany({
    where: { shopId },
    select: { id: true, name: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  if (trees.length <= 1) return;
  const drafts = trees.filter((tree) => isAbandonedDraftName(tree.name));
  if (!drafts.length) return;
  const kept = trees.length - drafts.length;
  const toDelete = kept >= 1 ? drafts : drafts.slice(1);
  if (!toDelete.length) return;
  await prisma.filterConfig.deleteMany({
    where: { shopId, id: { in: toDelete.map((tree) => tree.id) } },
  });
}

async function mappedFilterKeysForShop(shopId: string) {
  const mappings = await prisma.metafieldMapping.findMany({
    where: { shopId },
    select: {
      enabled: true,
      appliesTo: true,
      namespace: true,
      key: true,
      displayLabel: true,
      filterType: true,
      ownerType: true,
      sortOrder: true,
    },
  });
  return mappedFacetsForAdmin(mappings).map((facet) => facet.key);
}

export async function syncMappedMetafieldKeysOnTrees(
  shopId: string,
  keepKeys: string[],
) {
  const trees = await prisma.filterConfig.findMany({
    where: { shopId },
    select: { id: true, displayOrder: true, facetSettings: true },
  });
  await Promise.all(
    trees.map((tree) => {
      const current = Array.isArray(tree.displayOrder) ? tree.displayOrder : [];
      const known = parseKnownMetafieldKeys(tree.facetSettings);
      const next = nextDisplayOrderForMetafieldSync(current, keepKeys, known);
      const sameOrder = JSON.stringify(next) === JSON.stringify(current);
      const sameKnown =
        known !== null &&
        known.length === keepKeys.length &&
        known.every((key, index) => key === keepKeys[index]);
      if (sameOrder && sameKnown) return Promise.resolve();
      return prisma.filterConfig.update({
        where: { id: tree.id },
        data: {
          displayOrder: next,
          facetSettings: withFilterTreeMeta(
            parseFacetSettings(tree.facetSettings),
            { knownMetafieldKeys: keepKeys },
            tree.facetSettings,
          ) as Prisma.InputJsonValue,
        },
      });
    }),
  );
}

export async function createFilterTree(
  shopId: string,
  input?: {
    name?: string;
    appliesToSearch?: boolean;
    collectionGids?: string[];
  },
) {
  const count = await prisma.filterConfig.count({ where: { shopId } });
  const keepKeys = await mappedFilterKeysForShop(shopId);
  const displayOrder = nextDisplayOrderForMetafieldSync(
    withAdminOptionKeys([...DEFAULT_DISPLAY_ORDER]),
    keepKeys,
    null,
  );
  const tree = await prisma.filterConfig.create({
    data: {
      shopId,
      name:
        input?.name?.trim() ||
        (count === 0 ? "Default Filter" : ""),
      appliesToSearch: input?.appliesToSearch ?? count === 0,
      collectionGid: "",
      enableSale: true,
      displayOrder,
      facetSettings: withFilterTreeMeta(
        {},
        { knownMetafieldKeys: keepKeys },
      ) as Prisma.InputJsonValue,
      sortOrder: count,
    },
  });
  if (input?.collectionGids?.length) {
    await replaceTreeCollections(shopId, tree.id, input.collectionGids);
  }
  return tree;
}

export async function ensureDefaultFilterTree(shopId: string) {
  const existing = await prisma.filterConfig.findFirst({
    where: { shopId },
    select: { id: true },
  });
  if (existing) return;
  await createFilterTree(shopId, { name: "Default Filter", appliesToSearch: true });
}

export async function replaceTreeCollections(
  shopId: string,
  treeId: string,
  collectionGids: string[],
) {
  const unique = [...new Set(collectionGids.filter((gid) => Boolean(gid)))];
  await prisma.filterTreeCollection.deleteMany({ where: { treeId, shopId } });
  if (unique.length) {
    await prisma.filterTreeCollection.createMany({
      data: unique.map((collectionGid) => ({
        shopId,
        treeId,
        collectionGid,
      })),
    });
  }
  await prisma.filterConfig.update({
    where: { id: treeId },
    data: {
      collectionGid: unique.length === 1 ? unique[0] : "",
    },
  });
}

export async function updateFilterTree(
  shopId: string,
  treeId: string,
  input: {
    name?: string;
    enabled?: boolean;
    appliesToSearch?: boolean;
    collectionGids?: string[];
    facetSettings?: Prisma.InputJsonValue;
  } & Partial<Prisma.FilterConfigUpdateInput>,
) {
  const existing = await getFilterTree(shopId, treeId);
  if (!existing) return null;
  const { collectionGids, name, appliesToSearch, enabled, facetSettings, ...rest } =
    input;
  await prisma.filterConfig.update({
    where: { id: treeId },
    data: {
      ...rest,
      ...(name !== undefined ? { name: name.trim() || existing.name } : {}),
      ...(appliesToSearch !== undefined ? { appliesToSearch } : {}),
      ...(enabled !== undefined ? { enabled } : {}),
      ...(facetSettings !== undefined ? { facetSettings } : {}),
    },
  });
  if (collectionGids) {
    await replaceTreeCollections(shopId, treeId, collectionGids);
  }
  return getFilterTree(shopId, treeId);
}

export async function duplicateFilterTree(shopId: string, treeId: string) {
  const source = await getFilterTree(shopId, treeId);
  if (!source) return null;
  const copy = await prisma.filterConfig.create({
    data: {
      shopId,
      name: `Copy of ${source.name}`,
      appliesToSearch: source.appliesToSearch,
      collectionGid: "",
      enabled: source.enabled,
      enablePrice: source.enablePrice,
      enableSale: source.enableSale,
      enableRating: source.enableRating,
      enableLocation: source.enableLocation,
      enableAvailability: source.enableAvailability,
      enableVendor: source.enableVendor,
      enableProductType: source.enableProductType,
      enableTags: source.enableTags,
      enableOptions: source.enableOptions,
      enableVariantsAsProducts: source.enableVariantsAsProducts,
      variantAsProductOptions: source.variantAsProductOptions,
      priceRangeMode: source.priceRangeMode,
      customPriceMin: source.customPriceMin,
      customPriceMax: source.customPriceMax,
      displayOrder: source.displayOrder,
      displayTypes: source.displayTypes as Prisma.InputJsonValue,
      matchModes: source.matchModes as Prisma.InputJsonValue,
      valueSort: source.valueSort as Prisma.InputJsonValue,
      rangeBounds: source.rangeBounds as Prisma.InputJsonValue,
      facetSettings: source.facetSettings as Prisma.InputJsonValue,
      sortOrder: await prisma.filterConfig.count({ where: { shopId } }),
    },
  });
  await replaceTreeCollections(
    shopId,
    copy.id,
    source.treeCollections.map((row) => row.collectionGid),
  );
  return copy;
}

export async function deleteFilterTree(shopId: string, treeId: string) {
  const remaining = await prisma.filterConfig.count({ where: { shopId } });
  if (remaining <= 1) {
    return { error: "Keep at least one filter tree." as const };
  }
  const existing = await prisma.filterConfig.findFirst({
    where: { id: treeId, shopId },
    select: { id: true },
  });
  if (!existing) return { error: "Filter tree not found." as const };
  await prisma.filterConfig.delete({ where: { id: treeId } });
  return { ok: true as const };
}

export async function reorderFilterTrees(shopId: string, orderedIds: string[]) {
  const existing = await prisma.filterConfig.findMany({
    where: { shopId },
    select: { id: true },
  });
  const allowed = new Set(existing.map((row) => row.id));
  const ids = orderedIds.filter((id) => allowed.has(id));
  for (const row of existing) {
    if (!ids.includes(row.id)) ids.push(row.id);
  }
  await prisma.$transaction(
    ids.map((id, index) =>
      prisma.filterConfig.update({
        where: { id },
        data: { sortOrder: index },
      }),
    ),
  );
  return { ok: true as const };
}

export async function exportFilterTreesPayload(shopId: string) {
  const trees = await listFilterTrees(shopId);
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    trees: trees.map((tree) => ({
      name: tree.name,
      enabled: tree.enabled,
      appliesToSearch: tree.appliesToSearch,
      collectionGids: tree.treeCollections.map((row) => row.collectionGid),
      enablePrice: tree.enablePrice,
      enableSale: tree.enableSale,
      enableRating: tree.enableRating,
      enableLocation: tree.enableLocation,
      enableAvailability: tree.enableAvailability,
      enableVendor: tree.enableVendor,
      enableProductType: tree.enableProductType,
      enableTags: tree.enableTags,
      enableOptions: tree.enableOptions,
      enableVariantsAsProducts: tree.enableVariantsAsProducts,
      variantAsProductOptions: tree.variantAsProductOptions,
      displayOrder: tree.displayOrder,
      displayTypes: tree.displayTypes,
      matchModes: tree.matchModes,
      valueSort: tree.valueSort,
      rangeBounds: tree.rangeBounds,
      sortOrder: tree.sortOrder ?? 0,
    })),
  };
}

export async function findOrCreateTreeForCollection(
  shopId: string,
  collectionGid: string,
) {
  const assigned = newest(await treesAssignedToCollection(shopId, collectionGid));
  if (assigned) return assigned;
  const tree = await prisma.filterConfig.create({
    data: {
      shopId,
      name: "Collection filter",
      collectionGid,
      appliesToSearch: false,
      displayOrder: [...DEFAULT_DISPLAY_ORDER],
      sortOrder: await prisma.filterConfig.count({ where: { shopId } }),
    },
  });
  await replaceTreeCollections(shopId, tree.id, [collectionGid]);
  return tree;
}

export async function findOrCreateDefaultTree(shopId: string) {
  const search = newest(
    await prisma.filterConfig.findMany({
      where: { shopId, appliesToSearch: true },
    }),
  );
  if (search) return search;
  const unassigned = newest(await unassignedTrees(shopId));
  if (unassigned) return unassigned;
  return createFilterTree(shopId, { name: "Default Filter", appliesToSearch: true });
}

function uniqueIds(ids: string[]) {
  return [...new Set(ids.filter((id) => Boolean(id)))];
}

export async function setFilterTreesEnabled(
  shopId: string,
  ids: string[],
  enabled: boolean,
) {
  const unique = uniqueIds(ids);
  if (!unique.length) return { updated: 0 };
  const result = await prisma.filterConfig.updateMany({
    where: { shopId, id: { in: unique } },
    data: { enabled },
  });
  return { updated: result.count };
}

export async function duplicateFilterTrees(shopId: string, ids: string[]) {
  let duplicated = 0;
  for (const id of uniqueIds(ids)) {
    const copy = await duplicateFilterTree(shopId, id);
    if (copy) duplicated += 1;
  }
  return { duplicated };
}

export async function deleteFilterTrees(shopId: string, ids: string[]) {
  let deleted = 0;
  for (const id of uniqueIds(ids)) {
    const result = await deleteFilterTree(shopId, id);
    if ("ok" in result) {
      deleted += 1;
      continue;
    }
    if (result.error === "Keep at least one filter tree.") {
      return {
        error: "Keep at least one filter." as const,
        deleted,
      };
    }
  }
  return { deleted };
}
