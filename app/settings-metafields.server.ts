import type { MetafieldFilterType } from "@prisma/client";
import prisma from "./db.server";
import { resolvePlanCaps } from "./billing.server";
import {
  DEFAULT_NEW_APPLIES,
  appliesToForMapping,
  isValidMetafieldPart,
  mappingAppliesToFilter,
  normalizeMetafieldAppliesTo,
  type MetafieldApplyKey,
} from "./metafield-applies";
import {
  normalizeMetafieldOwnerType,
  type MetafieldOwnerTypeValue,
} from "./metafield-owner";
import { getMetafieldMappings, saveMetafieldMappings } from "./shop.server";
import { metafieldFacetKey } from "./filters";
import { syncMappedMetafieldKeysOnTrees } from "./filter-trees.server";

const VALID_FILTER_TYPES = new Set(["LIST", "RANGE", "BOOLEAN"]);

export type SettingsMetafieldRow = {
  clientId: string;
  ownerType: MetafieldOwnerTypeValue;
  namespace: string;
  key: string;
  displayLabel: string;
  filterType: MetafieldFilterType;
  appliesTo: MetafieldApplyKey[];
};

type GraphqlAdmin = {
  graphql: (
    query: string,
    options?: { variables?: Record<string, unknown> },
  ) => Promise<Response>;
};

function mappingRowId(
  ownerType: MetafieldOwnerTypeValue,
  namespace: string,
  key: string,
) {
  return `${ownerType}:${namespace}.${key}`;
}

function filterTypeFromShopify(typeName: string): MetafieldFilterType {
  const name = typeName.toLowerCase();
  if (name === "boolean") return "BOOLEAN";
  if (
    name === "number_integer" ||
    name === "number_decimal" ||
    name === "weight" ||
    name === "volume" ||
    name === "dimension" ||
    name === "rating"
  ) {
    return "RANGE";
  }
  return "LIST";
}

export function declaredMetafieldsFromMappings(
  mappings: Awaited<ReturnType<typeof getMetafieldMappings>>,
): SettingsMetafieldRow[] {
  return mappings.map((mapping, index) => {
    const ownerType = normalizeMetafieldOwnerType(mapping.ownerType);
    return {
      clientId: mappingRowId(ownerType, mapping.namespace, mapping.key) || `row-${index}`,
      ownerType,
      namespace: mapping.namespace,
      key: mapping.key,
      displayLabel: mapping.displayLabel || mapping.key,
      filterType: mapping.filterType,
      appliesTo: appliesToForMapping(mapping),
    };
  });
}

export async function loadSettingsMetafields(shopId: string) {
  const [mappings, caps] = await Promise.all([
    getMetafieldMappings(shopId),
    resolvePlanCaps(shopId),
  ]);
  const filterCount = mappings.filter((mapping) =>
    mappingAppliesToFilter(mapping),
  ).length;
  return {
    rows: declaredMetafieldsFromMappings(mappings),
    filterCount,
    filterLimit: caps.filterLimit,
    plan: caps.plan,
    overFilterLimit: filterCount > caps.filterLimit,
  };
}

export function parseDeclaredMetafieldRows(raw: string): {
  ok: true;
  rows: SettingsMetafieldRow[];
} | { ok: false; error: string } {
  try {
    const parsed = JSON.parse(raw || "[]") as unknown;
    if (!Array.isArray(parsed)) {
      return { ok: false, error: "Invalid metafield list. Refresh and try again." };
    }
    const rows: SettingsMetafieldRow[] = [];
    parsed.forEach((item, index) => {
      if (!item || typeof item !== "object") return;
      const rec = item as Record<string, unknown>;
      const namespace = String(rec.namespace || "").trim();
      const key = String(rec.key || "").trim();
      if (!namespace || !key) return;
      if (!isValidMetafieldPart(namespace) || !isValidMetafieldPart(key)) {
        throw new Error(
          `Invalid metafield ${namespace}.${key}. Use letters, numbers, hyphen, or underscore.`,
        );
      }
      const ownerType = normalizeMetafieldOwnerType(rec.ownerType);
      const filterType = VALID_FILTER_TYPES.has(String(rec.filterType))
        ? (rec.filterType as MetafieldFilterType)
        : "LIST";
      rows.push({
        clientId: String(rec.clientId || mappingRowId(ownerType, namespace, key) || `row-${index}`),
        ownerType,
        namespace,
        key,
        displayLabel: String(rec.displayLabel || key),
        filterType,
        appliesTo: normalizeMetafieldAppliesTo(rec.appliesTo),
      });
    });
    return { ok: true, rows };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Invalid metafield list. Refresh and try again.",
    };
  }
}

/** Drop Filter on newly synced rows until the shop is within plan limits. */
export function mergeSyncedMetafields(
  existing: SettingsMetafieldRow[],
  extras: SettingsMetafieldRow[],
  filterLimit: number,
): SettingsMetafieldRow[] {
  const extraIds = new Set(
    extras.map((row) => mappingRowId(row.ownerType, row.namespace, row.key)),
  );
  const merged = [...existing, ...extras];
  let filterCount = merged.filter((row) => mappingAppliesToFilter(row)).length;
  if (filterCount <= filterLimit) return merged;
  return merged.map((row) => {
    const id = mappingRowId(row.ownerType, row.namespace, row.key);
    if (
      filterCount <= filterLimit ||
      !extraIds.has(id) ||
      !mappingAppliesToFilter(row)
    ) {
      return row;
    }
    filterCount -= 1;
    return {
      ...row,
      appliesTo: row.appliesTo.filter((key) => key !== "filter"),
    };
  });
}

export async function saveDeclaredMetafields(
  shopId: string,
  rows: SettingsMetafieldRow[],
) {
  const unique = new Map<string, SettingsMetafieldRow>();
  for (const row of rows) {
    unique.set(mappingRowId(row.ownerType, row.namespace, row.key), row);
  }
  const declared = [...unique.values()];
  const filterRows = declared.filter((row) => mappingAppliesToFilter(row));
  const caps = await resolvePlanCaps(shopId);
  if (filterRows.length > caps.filterLimit) {
    return {
      error: `Your ${caps.plan} plan allows up to ${caps.filterLimit} metafield filters (selected ${filterRows.length}). Remove Filter from some rows or upgrade on Billing.`,
    };
  }

  await saveMetafieldMappings(
    shopId,
    declared.map((row, index) => ({
      namespace: row.namespace,
      key: row.key,
      displayLabel: row.displayLabel || row.key,
      filterType: row.filterType,
      enabled: mappingAppliesToFilter(row),
      appliesTo: row.appliesTo,
      sortOrder: index,
      ownerType: row.ownerType,
    })),
  );

  await Promise.all(
    declared.map((row) =>
      prisma.discoveredMetafield.upsert({
        where: {
          shopId_namespace_key_ownerType: {
            shopId,
            namespace: row.namespace,
            key: row.key,
            ownerType: row.ownerType,
          },
        },
        create: {
          shopId,
          namespace: row.namespace,
          key: row.key,
          ownerType: row.ownerType,
          sampleValue: null,
        },
        update: {},
      }),
    ),
  );

  await syncFilterTreeMetafieldKeys(shopId, filterRows);

  return { ok: true as const, rows: (await loadSettingsMetafields(shopId)).rows };
}

async function syncFilterTreeMetafieldKeys(
  shopId: string,
  filterRows: SettingsMetafieldRow[],
) {
  const keepKeys = filterRows.map((row) =>
    metafieldFacetKey(row.namespace, row.key, row.ownerType),
  );
  await syncMappedMetafieldKeysOnTrees(shopId, keepKeys);
}

const DEFINITIONS_QUERY = `#graphql
  query FindlyMetafieldDefinitions($ownerType: MetafieldOwnerType!, $cursor: String) {
    metafieldDefinitions(first: 100, ownerType: $ownerType, after: $cursor) {
      pageInfo { hasNextPage endCursor }
      nodes {
        namespace
        key
        name
        type { name }
      }
    }
  }
`;

async function fetchDefinitionOwner(
  admin: GraphqlAdmin,
  ownerType: "PRODUCT" | "PRODUCTVARIANT",
) {
  const nodes: Array<{
    namespace: string;
    key: string;
    name?: string;
    type?: { name?: string };
  }> = [];
  let cursor: string | null = null;
  let hasNext = true;
  while (hasNext) {
    const response = await admin.graphql(DEFINITIONS_QUERY, {
      variables: { ownerType, cursor },
    });
    const json = (await response.json()) as {
      data?: {
        metafieldDefinitions?: {
          pageInfo?: { hasNextPage?: boolean; endCursor?: string | null };
          nodes?: typeof nodes;
        };
      };
      errors?: Array<{ message?: string }>;
    };
    if (json.errors?.length) {
      throw new Error(json.errors[0]?.message || "Could not read metafield definitions.");
    }
    const conn = json.data?.metafieldDefinitions;
    nodes.push(...(conn?.nodes || []));
    hasNext = Boolean(conn?.pageInfo?.hasNextPage);
    cursor = conn?.pageInfo?.endCursor || null;
    if (!cursor) hasNext = false;
  }
  return nodes;
}

export async function syncShopifyMetafieldDefinitions(
  shopId: string,
  admin: GraphqlAdmin,
  existing: SettingsMetafieldRow[],
) {
  const [productDefs, variantDefs] = await Promise.all([
    fetchDefinitionOwner(admin, "PRODUCT"),
    fetchDefinitionOwner(admin, "PRODUCTVARIANT"),
  ]);

  const discovered: Record<"PRODUCT" | "VARIANT", Record<string, string>> = {
    PRODUCT: {},
    VARIANT: {},
  };
  const extras: SettingsMetafieldRow[] = [];
  const seen = new Set(
    existing
      .filter((row) => row.namespace.trim() && row.key.trim())
      .map((row) => mappingRowId(row.ownerType, row.namespace.trim(), row.key.trim())),
  );

  const ingest = (
    ownerType: MetafieldOwnerTypeValue,
    defs: Awaited<ReturnType<typeof fetchDefinitionOwner>>,
  ) => {
    for (const def of defs) {
      const namespace = String(def.namespace || "").trim();
      const key = String(def.key || "").trim();
      if (!namespace || !key) continue;
      const path = `${namespace}.${key}`;
      discovered[ownerType][path] = String(def.name || key);
      const id = mappingRowId(ownerType, namespace, key);
      if (seen.has(id)) continue;
      seen.add(id);
      extras.push({
        clientId: id,
        ownerType,
        namespace,
        key,
        displayLabel: String(def.name || key),
        filterType: filterTypeFromShopify(String(def.type?.name || "")),
        appliesTo: [...DEFAULT_NEW_APPLIES],
      });
    }
  };

  ingest("PRODUCT", productDefs);
  ingest("VARIANT", variantDefs);

  const discoveredRows = await prisma.discoveredMetafield.findMany({
    where: { shopId },
    orderBy: [{ namespace: "asc" }, { key: "asc" }],
    take: 200,
  });
  for (const row of discoveredRows) {
    const ownerType = normalizeMetafieldOwnerType(row.ownerType);
    const namespace = row.namespace.trim();
    const key = row.key.trim();
    if (!namespace || !key) continue;
    const id = `${ownerType}:${namespace}.${key}`;
    if (seen.has(id)) continue;
    seen.add(id);
    extras.push({
      clientId: id,
      ownerType,
      namespace,
      key,
      displayLabel: key,
      filterType: "LIST",
      appliesTo: [...DEFAULT_NEW_APPLIES],
    });
  }

  for (const [ownerType, bag] of Object.entries(discovered) as Array<
    ["PRODUCT" | "VARIANT", Record<string, string>]
  >) {
    for (const [path, sampleValue] of Object.entries(bag)) {
      const dot = path.indexOf(".");
      if (dot <= 0) continue;
      const namespace = path.slice(0, dot);
      const key = path.slice(dot + 1);
      await prisma.discoveredMetafield.upsert({
        where: {
          shopId_namespace_key_ownerType: { shopId, namespace, key, ownerType },
        },
        create: { shopId, namespace, key, ownerType, sampleValue: sampleValue.slice(0, 500) },
        update: { sampleValue: sampleValue.slice(0, 500) },
      });
    }
  }

  return { added: extras.length, extras };
}
