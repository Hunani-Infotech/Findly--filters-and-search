import {
  logComplianceEvent,
  purgeShopData,
  scrubCustomerData,
} from "../services/compliance.server";
import { syncActiveSubscriptions } from "../services/billing.server";
import { ensureShop } from "../services/shop.server";
import { log } from "../lib/log.server";
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

/** Minimal job shape shared by Postgres queue drain and non-webhook inline runners. */
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

function isMissingOfflineSessionError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /could not find.*session|no session|session not found|unauthorized/i.test(
    message,
  );
}

async function syncBillingFromShopify(shopDomain: string, webhookId?: string) {
  const tag = webhookId ? ` webhookId=${webhookId}` : "";
  try {
    const shopRow = await ensureShop(shopDomain);
    const { unauthenticated } = await import("../shopify.server");
    const { admin } = await unauthenticated.admin(shopDomain);
    await syncActiveSubscriptions(admin, shopRow.id);
    log.success(`[billing] syncFromShopify ok for ${shopDomain}${tag}`);
  } catch (error) {
    // Uninstalled / offline session gone — complete job (no useful retry).
    if (isMissingOfflineSessionError(error)) {
      const message =
        error instanceof Error ? error.message : String(error);
      log.warn(
        `[billing] syncFromShopify skipped for ${shopDomain}${tag}: ${message}`,
      );
      return;
    }
    throw error;
  }
}

/** GDPR customers/redact: scrub matching analytics, then non-PII audit. */
async function processCustomersRedact(
  shopDomain: string,
  payload: unknown,
  webhookId?: string,
) {
  const scrubbed = await scrubCustomerData(shopDomain, payload);
  await logComplianceEvent(shopDomain, "customers/redact", {
    requestId: webhookId,
    status: "redacted",
  });
  log.info(
    `[compliance] customers/redact done for ${shopDomain} analyticsDeleted=${scrubbed.analyticsDeleted} shopFound=${scrubbed.shopFound}`,
  );
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
    case "billing.syncFromShopify":
      return syncBillingFromShopify(
        shop,
        job.data.webhookId ? String(job.data.webhookId) : undefined,
      );
    case "compliance.customersRedact":
      return processCustomersRedact(
        shop,
        job.data.payload,
        job.data.webhookId ? String(job.data.webhookId) : undefined,
      );
    default:
      throw new Error(`Unknown sync job: ${job.name}`);
  }
}
