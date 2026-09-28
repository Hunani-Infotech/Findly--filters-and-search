import { log } from "../lib/log.server";

const METAOBJECT_GID_RE = /^gid:\/\/shopify\/Metaobject\//i;

export function isMetaobjectGid(value: string | null | undefined): boolean {
  return Boolean(value && METAOBJECT_GID_RE.test(String(value)));
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

type MetaobjectNode = {
  id?: string | null;
  displayName?: string | null;
  handle?: string | null;
  fields?: Array<{ key?: string | null; value?: string | null }> | null;
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

/** Resolve Metaobject GIDs → human labels via Admin API (offline session). */
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

  try {
    const { unauthenticated } = await import("../shopify.server");
    const { admin } = await unauthenticated.admin(shopDomain);
    const chunkSize = 50;
    for (let i = 0; i < unique.length; i += chunkSize) {
      const chunk = unique.slice(i, i + chunkSize);
      const response = await admin.graphql(METAOBJECT_NODES_QUERY, {
        variables: { ids: chunk },
      });
      const json = (await response.json()) as {
        data?: { nodes?: Array<MetaobjectNode | null> };
        errors?: Array<{ message?: string }>;
      };
      if (json.errors?.length) {
        log.warn(
          `[metaobject-labels] GraphQL errors for ${shopDomain}: ${json.errors
            .map((e) => e.message)
            .join("; ")}`,
        );
      }
      for (const node of json.data?.nodes || []) {
        if (!node?.id) continue;
        const label = labelFromMetaobject(node);
        if (label) out.set(node.id, label);
      }
    }
  } catch (error) {
    log.warn(
      `[metaobject-labels] resolve failed for ${shopDomain}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
  return out;
}
