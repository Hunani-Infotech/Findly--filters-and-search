import { log } from "./log.server";
import { enqueueSyncJob } from "./queues.server";

/** Fast-ack webhook handling — enqueue BullMQ jobs only. */
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
  return `gid://shopify/${resource}/${id}`;
}

/** inventory_levels/update: admin_graphql_api_id is often InventoryLevel, not InventoryItem. */
export function webhookInventoryItemGid(
  payload: Record<string, unknown>,
): string | null {
  const gid = payload.admin_graphql_api_id;
  if (
    typeof gid === "string" &&
    gid.startsWith("gid://shopify/InventoryItem/")
  ) {
    return gid;
  }
  const id = payload.inventory_item_id ?? payload.id;
  if (id == null || id === "") return null;
  const raw = String(id);
  if (raw.startsWith("gid://shopify/InventoryItem/")) return raw;
  return `gid://shopify/InventoryItem/${raw}`;
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

export async function handleWebhookTopic(
  shop: string,
  topic: string,
  payload: Record<string, unknown>,
) {
  const normalized = topic.toUpperCase().replace(/\//g, "_");

  switch (normalized) {
    case "PRODUCTS_CREATE":
    case "PRODUCTS_UPDATE": {
      const productGid = webhookGraphqlId(payload, "Product");
      await enqueueSyncJobWithTimeout(
        "product.upsert",
        { shop, productGid },
        { jobId: `${shop}:product.upsert:${productGid}`, delay: 500 },
      );
      break;
    }
    case "PRODUCTS_DELETE": {
      const productGid = webhookGraphqlId(payload, "Product");
      await enqueueSyncJobWithTimeout(
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
      await enqueueSyncJobWithTimeout(
        "collection.rebuild",
        { shop, collectionGid },
        { jobId: `${shop}:collection.rebuild:${collectionGid}`, delay: 500 },
      );
      break;
    }
    case "BULK_OPERATIONS_FINISH": {
      const bulkOperationId =
        (payload.admin_graphql_api_id as string) || undefined;
      await enqueueSyncJobWithTimeout(
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
      await enqueueSyncJobWithTimeout(
        "inventory.sync",
        { shop, inventoryItemGid },
        {
          jobId: `${shop}:inventory.sync:${inventoryItemGid}`,
          delay: 2000,
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
        await enqueueSyncJobWithTimeout(
          "product.upsert",
          { shop, productGid },
          { jobId: `${shop}:product.upsert:${productGid}`, delay: 500 },
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
        await enqueueSyncJobWithTimeout(
          "variant.sync",
          { shop, variantGid },
          { jobId: `${shop}:variant.sync:${variantGid}`, delay: 500 },
        );
        break;
      }

      if (ownerResource === "collection") {
        const collectionGid = ownerToGid(ownerId, "Collection");
        if (!collectionGid) break;
        await enqueueSyncJobWithTimeout(
          "collection.rebuild",
          { shop, collectionGid },
          {
            jobId: `${shop}:collection.rebuild:${collectionGid}`,
            delay: 500,
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
