import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { log } from "../lib/log.server";
import { COLLECTION_REBUILD_DELAY_MS } from "../constants/limits";
import {
  enqueueSyncJobWithTimeout,
  type SyncJobName,
} from "../lib/queues.server";

/** Fast-ack webhook handling — enqueue BullMQ jobs, run inline if Redis is down. */
export function webhookGraphqlId(
  payload: Record<string, unknown>,
  resource: "Product" | "Collection",
): string {
  const gid = payload.admin_graphql_api_id;
  if (typeof gid === "string" && gid.startsWith("gid://")) return gid;
  const id = payload.id;
  if (id == null || id === "") {
    throw new Error(`Webhook ${resource} payload missing id and admin_graphql_api_id`);
  }
  if (typeof id === "string" && id.startsWith("gid://")) return id;
  return `gid://shopify/${resource}/${id}`;
}

/**
 * Product GID from REST webhooks, GraphQL-style payloads, or Shopify Events.
 */
export function catalogProductGid(
  payload: Record<string, unknown>,
): string | null {
  const vars = payload.query_variables;
  if (vars && typeof vars === "object") {
    const pid = (vars as Record<string, unknown>).productId;
    if (typeof pid === "string" && pid.startsWith("gid://shopify/Product/")) {
      return pid;
    }
  }

  const data = payload.data;
  const dataProduct =
    data && typeof data === "object"
      ? (data as Record<string, unknown>).product
      : undefined;
  const nestedProduct =
    payload.product && typeof payload.product === "object"
      ? payload.product
      : dataProduct;

  const candidates: unknown[] = [nestedProduct, payload];
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "object") continue;
    try {
      return webhookGraphqlId(candidate as Record<string, unknown>, "Product");
    } catch {
      /* try next */
    }
  }
  return null;
}

function inventoryItemGidFromLevelGid(gid: string): string | null {
  const marker = "inventory_item_id=";
  const idx = gid.indexOf(marker);
  if (idx === -1) return null;
  const raw = gid
    .slice(idx + marker.length)
    .split("&")[0]
    .split("#")[0];
  if (!raw || !/^\d+$/.test(raw)) return null;
  return `gid://shopify/InventoryItem/${raw}`;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

/**
 * inventory_levels/update: admin_graphql_api_id is an InventoryLevel GID.
 * The numeric inventory_item_id JSON field can exceed Number.MAX_SAFE_INTEGER —
 * prefer the query-string id on the GID (string-safe).
 */
export function webhookInventoryItemGid(
  payload: Record<string, unknown>,
): string | null {
  const nested = asRecord(payload.inventory_level) ?? payload;
  const gid = nested.admin_graphql_api_id ?? payload.admin_graphql_api_id;
  if (typeof gid === "string") {
    if (gid.startsWith("gid://shopify/InventoryItem/")) return gid;
    const fromLevel = inventoryItemGidFromLevelGid(gid);
    if (fromLevel) return fromLevel;
    if (gid.startsWith("gid://shopify/InventoryLevel/")) return gid;
  }

  const id =
    nested.inventory_item_id ??
    payload.inventory_item_id;
  if (typeof id === "string" && id) {
    if (id.startsWith("gid://shopify/InventoryItem/")) return id;
    if (/^\d+$/.test(id)) return `gid://shopify/InventoryItem/${id}`;
  }
  if (typeof id === "number" && Number.isSafeInteger(id)) {
    return `gid://shopify/InventoryItem/${id}`;
  }
  return null;
}

function ownerResourceFromPayload(payload: Record<string, unknown>): string {
  const raw = payload.owner_resource ?? payload.ownerResource ?? "";
  return String(raw).toLowerCase();
}

function ownerIdFromPayload(payload: Record<string, unknown>): unknown {
  return payload.owner_id ?? payload.ownerId;
}

function ownerToGid(
  ownerId: unknown,
  resource: "Product" | "ProductVariant" | "Collection",
): string | null {
  if (ownerId == null || ownerId === "") return null;
  const raw = String(ownerId);
  const prefix = `gid://shopify/${resource}/`;
  if (raw.startsWith("gid://")) {
    return raw.startsWith(prefix) ? raw : null;
  }
  return `${prefix}${raw}`;
}

async function enqueueCatalogJob(
  name: SyncJobName,
  data: Record<string, unknown>,
  opts?: { jobId?: string; delay?: number },
) {
  try {
    await enqueueSyncJobWithTimeout(name, data, opts);
  } catch (error) {
    log.error(`[webhooks] enqueue ${name} failed; running inline`, error);
    const { runSyncJobInline } = await import("../workers/processors");
    await runSyncJobInline(name, data);
    return;
  }

  const { isSyncWorkerRunning } = await import("../workers/ensure-running.server");
  if (isSyncWorkerRunning()) return;

  log.warn(`[webhooks] worker not running; processing ${name} inline`);
  const { runSyncJobInline } = await import("../workers/processors");
  const heavy =
    name === "shop.fullSync" ||
    name === "shop.ingestBulk" ||
    name === "shop.cleanup";
  if (heavy) {
    void runSyncJobInline(name, data).catch((error) => {
      log.error(`[webhooks] inline ${name} failed`, error);
    });
    return;
  }
  await runSyncJobInline(name, data);
}

export async function handleProductEvent(
  shop: string,
  payload: Record<string, unknown>,
) {
  const action = String(payload.action ?? "").toLowerCase();
  const productGid = catalogProductGid(payload);
  if (!productGid) {
    log.warn("product event missing product id");
    return;
  }
  if (action === "delete") {
    await enqueueCatalogJob(
      "product.delete",
      { shop, productGid },
      { jobId: `${shop}:product.delete:${productGid}` },
    );
    return;
  }
  await enqueueCatalogJob(
    "product.upsert",
    { shop, productGid },
    { jobId: `${shop}:product.upsert:${productGid}`, delay: 600 },
  );
}

export async function handleWebhookTopic(
  shop: string,
  topic: string,
  payload: Record<string, unknown>,
) {
  const normalized = topic.toUpperCase().replace(/\//g, "_");

  switch (normalized) {
    case "PRODUCT":
      await handleProductEvent(shop, payload);
      break;
    case "PRODUCTS_CREATE":
    case "PRODUCTS_UPDATE": {
      const productGid = webhookGraphqlId(payload, "Product");
      await enqueueCatalogJob(
        "product.upsert",
        { shop, productGid },
        { jobId: `${shop}:product.upsert:${productGid}`, delay: 600 },
      );
      break;
    }
    case "PRODUCTS_DELETE": {
      const productGid = webhookGraphqlId(payload, "Product");
      await enqueueCatalogJob(
        "product.delete",
        { shop, productGid },
        { jobId: `${shop}:product.delete:${productGid}` },
      );
      break;
    }
    case "COLLECTIONS_CREATE":
    case "COLLECTIONS_UPDATE":
    case "COLLECTIONS_DELETE": {
      const collectionGid = webhookGraphqlId(payload, "Collection");
      await enqueueCatalogJob(
        "collection.rebuild",
        { shop, collectionGid },
        { jobId: `${shop}:collection.rebuild:${collectionGid}`, delay: COLLECTION_REBUILD_DELAY_MS },
      );
      break;
    }
    case "BULK_OPERATIONS_FINISH": {
      const bulkOperationId =
        (payload.admin_graphql_api_id as string) || undefined;
      await enqueueCatalogJob(
        "shop.ingestBulk",
        { shop, bulkOperationId },
        {
          jobId: `${shop}:shop.ingestBulk:${bulkOperationId || "current"}`,
        },
      );
      break;
    }
    case "INVENTORY_LEVELS_UPDATE": {
      const inventoryItemGid = webhookInventoryItemGid(payload);
      if (!inventoryItemGid) {
        log.warn("inventory_levels/update missing inventory item id");
        break;
      }
      await enqueueCatalogJob(
        "inventory.sync",
        { shop, inventoryItemGid },
        {
          jobId: `${shop}:inventory.sync:${inventoryItemGid}`,
          delay: 500,
        },
      );
      break;
    }
    case "METAFIELDS_CREATE":
    case "METAFIELDS_UPDATE":
    case "METAFIELDS_DELETE": {
      const ownerResource = ownerResourceFromPayload(payload);
      const ownerId = ownerIdFromPayload(payload);

      if (ownerResource === "product") {
        const productGid = ownerToGid(ownerId, "Product");
        if (!productGid) break;
        await enqueueCatalogJob(
          "product.upsert",
          { shop, productGid },
          { jobId: `${shop}:product.upsert:${productGid}`, delay: 600 },
        );
        break;
      }

      if (
        ownerResource === "variant" ||
        ownerResource === "product_variant" ||
        ownerResource === "productvariant"
      ) {
        const variantGid = ownerToGid(ownerId, "ProductVariant");
        if (!variantGid) break;
        await enqueueCatalogJob(
          "variant.sync",
          { shop, variantGid },
          { jobId: `${shop}:variant.sync:${variantGid}`, delay: 500 },
        );
        break;
      }

      if (ownerResource === "collection") {
        const collectionGid = ownerToGid(ownerId, "Collection");
        if (!collectionGid) break;
        await enqueueCatalogJob(
          "collection.rebuild",
          { shop, collectionGid },
          {
            jobId: `${shop}:collection.rebuild:${collectionGid}`,
            delay: COLLECTION_REBUILD_DELAY_MS,
          },
        );
        break;
      }

      break;
    }
    default:
      log.warn(`Unhandled webhook topic: ${topic}`);
  }
}

export async function catalogWebhookAction({ request }: ActionFunctionArgs) {
  const { shop, topic, payload } = await authenticate.webhook(request);
  await handleWebhookTopic(shop, topic, payload as Record<string, unknown>);
  return new Response();
}

export async function productEventWebhookAction({ request }: ActionFunctionArgs) {
  const { shop, payload } = await authenticate.webhook(request);
  await handleProductEvent(shop, payload as Record<string, unknown>);
  return new Response();
}
