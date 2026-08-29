import { purgeShopData } from "../services/compliance.server";
import {
  deleteProduct,
  finalizeFullSync,
  ingestBulkOperation,
  rebuildCollection,
  startFullSync,
  syncInventoryItem,
  syncProductMarkets,
  syncVariant,
  upsertProduct,
} from "../sync/sync.server";

/** Minimal job shape shared by Postgres queue drain and inline webhook fallback. */
export type SyncJobLike = {
  name: string;
  data: Record<string, unknown>;
};

export async function runSyncJobInline(
  name: string,
  data: Record<string, unknown>,
) {
  return processSyncJob({ name, data });
}

export async function processSyncJob(job: SyncJobLike) {
  const shop = String(job.data.shop);

  switch (job.name) {
    case "shop.fullSync":
      return startFullSync(shop);
    case "shop.ingestBulk":
      return ingestBulkOperation(
        shop,
        job.data.bulkOperationId
          ? String(job.data.bulkOperationId)
          : undefined,
      );
    case "shop.finalizeFullSync":
      return finalizeFullSync(shop);
    case "product.upsert":
      return upsertProduct(shop, String(job.data.productGid));
    case "product.markets":
      return syncProductMarkets(shop, String(job.data.productGid));
    case "product.delete":
      return deleteProduct(shop, String(job.data.productGid));
    case "collection.rebuild":
      return rebuildCollection(shop, String(job.data.collectionGid));
    case "inventory.sync":
      return syncInventoryItem(shop, String(job.data.inventoryItemGid));
    case "variant.sync":
      return syncVariant(shop, String(job.data.variantGid));
    case "shop.cleanup":
      return purgeShopData(shop);
    default:
      throw new Error(`Unknown sync job: ${job.name}`);
  }
}
