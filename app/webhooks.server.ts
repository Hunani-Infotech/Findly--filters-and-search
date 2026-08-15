import { log } from "./log.server";
import { enqueueSyncJob } from "./queues.server";

/** Fast-ack webhook handling — enqueue BullMQ jobs only. */
export async function handleWebhookTopic(
  shop: string,
  topic: string,
  payload: Record<string, unknown>,
) {
  const normalized = topic.toUpperCase().replace(/\//g, "_");

  switch (normalized) {
    case "PRODUCTS_CREATE":
    case "PRODUCTS_UPDATE": {
      const productGid =
        (payload.admin_graphql_api_id as string) ||
        `gid://shopify/Product/${payload.id}`;
      await enqueueSyncJob(
        "product.upsert",
        { shop, productGid },
        { jobId: `${shop}:product.upsert:${productGid}` },
      );
      break;
    }
    case "PRODUCTS_DELETE": {
      const productGid =
        (payload.admin_graphql_api_id as string) ||
        `gid://shopify/Product/${payload.id}`;
      await enqueueSyncJob(
        "product.delete",
        { shop, productGid },
        { jobId: `${shop}:product.delete:${productGid}` },
      );
      break;
    }
    case "COLLECTIONS_CREATE":
    case "COLLECTIONS_UPDATE":
    case "COLLECTIONS_DELETE": {
      const collectionGid =
        (payload.admin_graphql_api_id as string) ||
        `gid://shopify/Collection/${payload.id}`;
      await enqueueSyncJob(
        "collection.rebuild",
        { shop, collectionGid },
        { jobId: `${shop}:collection.rebuild:${collectionGid}` },
      );
      break;
    }
    case "BULK_OPERATIONS_FINISH": {
      const bulkOperationId =
        (payload.admin_graphql_api_id as string) || undefined;
      await enqueueSyncJob(
        "shop.ingestBulk",
        { shop, bulkOperationId },
        {
          jobId: `${shop}:shop.ingestBulk:${bulkOperationId || "current"}`,
        },
      );
      break;
    }
    default:
      log.warn(`Unhandled webhook topic: ${topic}`);
  }
}
