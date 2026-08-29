import { randomUUID } from "node:crypto";
import prisma from "../db.server";
import { forgetShop } from "../lib/shop-cache.server";
import { log } from "../lib/log.server";
import { enqueueSyncJobWithTimeout } from "../lib/queues.server";

export type ComplianceLogStatus = "received" | "acknowledged";

export type ComplianceLogMeta = {
  requestId?: string;
  status?: ComplianceLogStatus | string;
};

/**
 * Hard-delete all tenant data for a shop domain (APP_UNINSTALLED / shop/redact).
 * ComplianceRequest rows are kept (keyed by shopDomain, no FK) for audit.
 * Those rows never contain the raw customer webhook body.
 */
export async function purgeShopData(shopDomain: string) {
  const shop = await prisma.shop.findUnique({ where: { domain: shopDomain } });

  await prisma.session.deleteMany({ where: { shop: shopDomain } });
  forgetShop(shopDomain);

  if (!shop) {
    log.info(`[compliance] purgeShopData: no Shop row for ${shopDomain}`);
    return { deleted: false as const };
  }

  // Explicit deletes for clarity; Shop CASCADE covers relations if any remain.
  await prisma.$transaction([
    prisma.productFacet.deleteMany({ where: { shopId: shop.id } }),
    prisma.collectionMembership.deleteMany({ where: { shopId: shop.id } }),
    prisma.collection.deleteMany({ where: { shopId: shop.id } }),
    prisma.discoveredMetafield.deleteMany({ where: { shopId: shop.id } }),
    prisma.filterConfig.deleteMany({ where: { shopId: shop.id } }),
    prisma.metafieldMapping.deleteMany({ where: { shopId: shop.id } }),
    prisma.appSettings.deleteMany({ where: { shopId: shop.id } }),
    prisma.syncJob.deleteMany({ where: { shopId: shop.id } }),
    prisma.subscription.deleteMany({ where: { shopId: shop.id } }),
    prisma.shop.delete({ where: { id: shop.id } }),
  ]);

  log.success(
    `[compliance] purgeShopData: deleted tenant data for ${shopDomain}`,
  );
  return { deleted: true as const, shopId: shop.id };
}

export type ShopPurgeMode = "queued" | "inline";

/**
 * GDPR / uninstall deletion must not depend on the background worker being up.
 *
 * Failure modes:
 * 1. Postgres queue accepts the job within 2s → worker runs purgeShopData. 200.
 * 2. Enqueue throws or times out (DB blip) → purgeShopData runs in this
 *    process, then 200. Logged as "enqueue failed … running inline purge".
 * 3. Inline purge also throws (Postgres down) → error is rethrown so the
 *    webhook returns 5xx and Shopify retries. Logged as "inline purge FAILED".
 *
 * purgeShopData is idempotent, so a late queue add after a timeout is safe.
 */
export async function ensureShopPurged(
  shopDomain: string,
  source: "app/uninstalled" | "shop/redact",
): Promise<{ mode: ShopPurgeMode; deleted?: boolean }> {
  try {
    await enqueueSyncJobWithTimeout(
      "shop.cleanup",
      { shop: shopDomain },
      { jobId: `${shopDomain}:shop.cleanup`, timeoutMs: 2000 },
    );
    log.success(
      `[compliance] ${source}: queued shop.cleanup for ${shopDomain}`,
    );
    return { mode: "queued" };
  } catch (enqueueError) {
    const reason =
      enqueueError instanceof Error ? enqueueError.message : String(enqueueError);
    log.warn(
      `[compliance] ${source}: enqueue failed for ${shopDomain} (${reason}); running inline purge`,
    );
    try {
      const result = await purgeShopData(shopDomain);
      log.success(
        `[compliance] ${source}: inline purge ${
          result.deleted ? "deleted tenant data" : "no Shop row (already gone)"
        } for ${shopDomain}`,
      );
      return { mode: "inline", deleted: result.deleted };
    } catch (purgeError) {
      log.error(
        `[compliance] ${source}: inline purge FAILED for ${shopDomain} — webhook will 5xx so Shopify retries`,
        purgeError,
      );
      throw purgeError;
    }
  }
}

export function shopifyWebhookRequestId(request: Request): string {
  return (request.headers.get("x-shopify-webhook-id") ?? "").trim().slice(0, 128);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

/** Identifiers from a GDPR payload — used only to match stored rows, never persisted. */
export function customerRedactTokens(payload: unknown): string[] {
  const customer = asRecord(asRecord(payload)?.customer);
  const tokens = new Set<string>();

  const email = typeof customer?.email === "string" ? customer.email.trim() : "";
  if (email.length >= 3) tokens.add(email.toLowerCase());

  const phone = typeof customer?.phone === "string" ? customer.phone.trim() : "";
  if (phone.length >= 7) tokens.add(phone.toLowerCase());
  const digits = phone.replace(/\D/g, "");
  if (digits.length >= 7) tokens.add(digits);

  const rawId = customer?.id;
  const idStr =
    typeof rawId === "number" || typeof rawId === "string"
      ? String(rawId).trim()
      : "";
  if (idStr.length >= 4) {
    tokens.add(idStr);
    tokens.add(`gid://shopify/Customer/${idStr}`);
  }

  return [...tokens];
}

/**
 * Delete shopper data that can be matched to a customers/redact payload.
 *
 * Findly does not store Shopify customer profiles. The only shop-scoped table
 * that can hold a shopper identifier is AnalyticsEvent (search query / combo /
 * handle / anonymous visitor string). ComplianceRequest has no customer fields.
 * Session.email and Contact drafts are merchant staff data and are not scrubbed.
 */
export async function scrubCustomerData(shopDomain: string, payload: unknown) {
  const tokens = customerRedactTokens(payload);
  const shop = await prisma.shop.findUnique({ where: { domain: shopDomain } });

  if (!shop) {
    log.info(`[compliance] customers/redact: no Shop row for ${shopDomain}`);
    return { analyticsDeleted: 0 as const, shopFound: false as const };
  }

  if (tokens.length === 0) {
    log.info(
      `[compliance] customers/redact: no customer identifiers on payload for ${shopDomain}`,
    );
    return { analyticsDeleted: 0 as const, shopFound: true as const };
  }

  const matches = tokens.flatMap((token) => [
    { query: { contains: token, mode: "insensitive" as const } },
    { combo: { contains: token, mode: "insensitive" as const } },
    { handle: { contains: token, mode: "insensitive" as const } },
    { visitor: { contains: token, mode: "insensitive" as const } },
  ]);

  const result = await prisma.analyticsEvent.deleteMany({
    where: { shopId: shop.id, OR: matches },
  });

  log.success(
    `[compliance] customers/redact: deleted ${result.count} analytics row(s) for ${shopDomain}`,
  );
  return { analyticsDeleted: result.count, shopFound: true as const };
}

/**
 * Persist a non-PII compliance audit row.
 * Do not pass the webhook JSON body — requestId + status only.
 */
export async function logComplianceEvent(
  shopDomain: string,
  topic: string,
  meta: ComplianceLogMeta = {},
) {
  const requestId =
    (typeof meta.requestId === "string" ? meta.requestId.trim() : "").slice(
      0,
      128,
    ) || randomUUID();
  const status =
    (typeof meta.status === "string" ? meta.status.trim() : "").slice(0, 40) ||
    "acknowledged";

  try {
    const row = await prisma.complianceRequest.upsert({
      where: { requestId },
      create: {
        shopDomain,
        requestId,
        topic,
        status,
      },
      update: {
        status,
      },
    });
    log.success(
      `[compliance] logged ${topic} for ${shopDomain} (id=${row.id} requestId=${row.requestId} status=${row.status})`,
    );
    return row;
  } catch (error) {
    log.error(
      `[compliance] failed to persist ${topic} for ${shopDomain}`,
      error,
    );
    return null;
  }
}
