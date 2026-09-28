/**
 * Backfill ProductFacet.options.__labels for Metaobject GIDs found in
 * options AND metafields (e.g. shopify.size / shopify.color-pattern).
 */
import { createPrismaClient } from "./prisma-runtime.mjs";

const OPTION_VALUE_LABELS_KEY = "__labels";
const METAOBJECT_GID_RE = /gid:\/\/shopify\/Metaobject\/\d+/gi;

const METAOBJECT_NODES_QUERY = `#graphql
  query FindlyBackfillMetaobjectLabels($ids: [ID!]!) {
    nodes(ids: $ids) {
      ... on Metaobject {
        id
        displayName
        handle
        type
        fields { key value }
      }
    }
  }
`;

function isMetaobjectGid(value) {
  return Boolean(value && /^gid:\/\/shopify\/Metaobject\//i.test(String(value)));
}

function labelFromMetaobject(node) {
  const display = String(node.displayName || "").trim();
  if (display && !isMetaobjectGid(display)) return display;
  const preferred = [
    "label",
    "name",
    "title",
    "display_name",
    "color",
    "colour",
    "size",
    "value",
  ];
  for (const key of preferred) {
    const hit = (node.fields || []).find(
      (f) => String(f.key || "").toLowerCase() === key,
    );
    const value = String(hit?.value || "").trim();
    if (value && !isMetaobjectGid(value)) return value;
  }
  for (const field of node.fields || []) {
    const value = String(field.value || "").trim();
    if (value && !isMetaobjectGid(value) && value.length < 80) return value;
  }
  const handle = String(node.handle || "").trim();
  return handle ? handle.replace(/[-_]+/g, " ") : null;
}

function collectGidsFromJson(value, out) {
  const text = typeof value === "string" ? value : JSON.stringify(value || {});
  for (const match of text.matchAll(METAOBJECT_GID_RE)) {
    out.add(match[0]);
  }
}

async function main() {
  const shopFilter = process.argv[2] || "prime-nurse-degpbycs.myshopify.com";
  const prisma = createPrismaClient();
  try {
    const shop = await prisma.shop.findFirst({ where: { domain: shopFilter } });
    if (!shop) {
      console.error("Shop not found:", shopFilter);
      process.exit(1);
    }
    console.log("shop", shop.domain, shop.id);

    const rows = await prisma.productFacet.findMany({
      where: { shopId: shop.id },
      select: { id: true, options: true, metafields: true, variantMetafields: true },
    });
    const gids = new Set();
    for (const row of rows) {
      collectGidsFromJson(row.options, gids);
      collectGidsFromJson(row.metafields, gids);
      collectGidsFromJson(row.variantMetafields, gids);
    }
    console.log("unique metaobject gids", gids.size);
    if (!gids.size) return;

    const { unauthenticated } = await import("../app/shopify.server.ts");
    const { admin } = await unauthenticated.admin(shop.domain);
    const labelMap = new Map();
    const ids = [...gids];
    for (let i = 0; i < ids.length; i += 50) {
      const chunk = ids.slice(i, i + 50);
      const response = await admin.graphql(METAOBJECT_NODES_QUERY, {
        variables: { ids: chunk },
      });
      const json = await response.json();
      if (json.errors?.length) {
        console.warn(
          "GraphQL errors:",
          json.errors.map((e) => e.message).join("; "),
        );
      }
      for (const node of json.data?.nodes || []) {
        if (!node?.id) {
          console.log("  null node in chunk");
          continue;
        }
        const label = labelFromMetaobject(node);
        console.log(
          " ",
          node.id,
          "type=",
          node.type,
          "displayName=",
          JSON.stringify(node.displayName),
          "→",
          JSON.stringify(label),
          "fields=",
          JSON.stringify(node.fields || []).slice(0, 200),
        );
        if (label) labelMap.set(node.id, label);
      }
    }
    console.log("resolved labels", labelMap.size);
    if (!labelMap.size) {
      console.error("No labels resolved — check read_metaobjects scope / re-auth.");
      process.exit(2);
    }

    let updated = 0;
    for (const row of rows) {
      const options =
        row.options && typeof row.options === "object" && !Array.isArray(row.options)
          ? { ...row.options }
          : {};
      const existing =
        options[OPTION_VALUE_LABELS_KEY] &&
        typeof options[OPTION_VALUE_LABELS_KEY] === "object" &&
        !Array.isArray(options[OPTION_VALUE_LABELS_KEY])
          ? { ...options[OPTION_VALUE_LABELS_KEY] }
          : {};
      const haystack = JSON.stringify({
        options: row.options,
        metafields: row.metafields,
        variantMetafields: row.variantMetafields,
      });
      let changed = false;
      for (const [gid, label] of labelMap) {
        if (!haystack.includes(gid)) continue;
        if (existing[gid] === label) continue;
        existing[gid] = label;
        changed = true;
      }
      if (!changed) continue;
      options[OPTION_VALUE_LABELS_KEY] = existing;
      await prisma.productFacet.update({
        where: { id: row.id },
        data: { options },
      });
      updated += 1;
    }
    console.log("updated ProductFacet rows", updated);
    console.log("sample labels", [...labelMap.entries()].slice(0, 12));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
