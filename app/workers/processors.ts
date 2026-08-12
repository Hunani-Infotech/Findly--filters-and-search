import type { Job } from "bullmq";
import { purgeShopData } from "../compliance.server";
import {
  deleteProduct,
  ingestBulkOperation,
  rebuildCollection,
  startFullSync,
  upsertProduct,
} from "../sync/sync.server";

export async function processSyncJob(job: Job) {
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
    case "product.upsert":
      return upsertProduct(shop, String(job.data.productGid));
    case "product.delete":
      return deleteProduct(shop, String(job.data.productGid));
    case "collection.rebuild":
      return rebuildCollection(shop, String(job.data.collectionGid));
    case "shop.cleanup":
      return purgeShopData(shop);
    default:
      throw new Error(`Unknown sync job: ${job.name}`);
  }
}
