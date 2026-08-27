import prisma from "../db.server";
import {
  normalizeCollectionPickerPage,
  normalizeCollectionPickerPageSize,
  normalizeCollectionPickerQuery,
  type CollectionChoice,
  type CollectionPickerPage,
} from "../utils/collections-picker";

export {
  COLLECTION_PICKER_BROWSE_SIZE,
  COLLECTION_PICKER_PAGE_SIZE,
  normalizeCollectionPickerPage,
  normalizeCollectionPickerPageSize,
  normalizeCollectionPickerQuery,
  type CollectionChoice,
  type CollectionPickerPage,
} from "../utils/collections-picker";

function toChoice(row: {
  collectionGid: string;
  title: string;
  handle: string;
}): CollectionChoice {
  return {
    collectionGid: row.collectionGid,
    title: row.title,
    handle: row.handle,
  };
}

export async function listCollectionsForPicker(
  shopId: string,
  options: {
    query?: string;
    page?: number;
    pageSize?: number;
    includeGids?: string[];
  } = {},
): Promise<CollectionPickerPage> {
  const query = normalizeCollectionPickerQuery(options.query);
  const page = normalizeCollectionPickerPage(options.page);
  const pageSize = normalizeCollectionPickerPageSize(options.pageSize);
  const includeGids = [
    ...new Set(
      (options.includeGids || []).filter(
        (gid) => typeof gid === "string" && gid.length > 0,
      ),
    ),
  ];

  const where = {
    shopId,
    ...(query
      ? {
          OR: [
            { title: { contains: query, mode: "insensitive" as const } },
            { handle: { contains: query, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [total, pageRows, includedRows] = await Promise.all([
    prisma.collection.count({ where }),
    prisma.collection.findMany({
      where,
      orderBy: { title: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: { collectionGid: true, title: true, handle: true },
    }),
    includeGids.length
      ? prisma.collection.findMany({
          where: { shopId, collectionGid: { in: includeGids } },
          select: { collectionGid: true, title: true, handle: true },
        })
      : Promise.resolve([]),
  ]);

  return {
    collections: pageRows.map(toChoice),
    included: includedRows.map(toChoice),
    page,
    pageSize,
    total,
    hasNext: page * pageSize < total,
    query,
  };
}
