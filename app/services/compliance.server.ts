import { createHash } from "node:crypto";
import prisma from "../db.server";
import {
  catalogCacheKey,
  configCacheKey,
  forgetShopCacheGenerations,
} from "../lib/catalog-cache.server";
import { forgetShop } from "../lib/shop-cache.server";
import { log } from "../lib/log.server";
import { enqueueSyncJobWithTimeout } from "../lib/queues.server";
import { applyLocalFreePlan, clearBillingCaches } from "./billing.server";

export type ComplianceLogStatus = "received" | "acknowledged";

export type ComplianceLogMeta = {
  requestId?: string;
  status?: ComplianceLogStatus | string;
};

/**
 * QueueJob.payload always includes `{ shop: "<domain>" }` (see enqueueSyncJob
 * callers + processors). No Shop FK — must delete by JSON path.
 */
async function deleteShopQueueJobs(shopDomain: string) {
  return prisma.queueJob.deleteMany({
    where: {
      payload: {
        path: ["shop"],
        equals: shopDomain,
      },
    },
  });
}

/**
 * CacheGeneration keys are `catalog:{domain}` / `config:{domain}`
 * (catalog-cache.server.ts). Not Shop-FK — delete by exact key.
 */
async function deleteShopCacheGenerations(shopDomain: string) {
  forgetShopCacheGenerations(shopDomain);
  return prisma.cacheGeneration.deleteMany({
    where: {
      key: {
        in: [catalogCacheKey(shopDomain), configCacheKey(shopDomain)],
      },
    },
  });
}

/**
 * APP_UNINSTALLED soft-offboard: revoke tokens and mark the shop uninstalled.
 * Does NOT hard-delete Shop, Subscription, catalog, or settings — those wait
 * for shop/redact / shop.cleanup. Late cleanup skips if an offline Session
 * exists again (merchant reinstalled).
 *
 * I-4: demote the local billing mirror to free/CANCELLED so a reinstall cannot
 * inherit stale ACTIVE paid access before Shopify sync runs. The Subscription
 * row itself is kept until purge.
 */
export async function markShopUninstalled(shopDomain: string) {
  await prisma.session.deleteMany({ where: { shop: shopDomain } });

  const shop = await prisma.shop.findUnique({
    where: { domain: shopDomain },
    select: { id: true, domain: true, uninstalledAt: true },
  });

  if (!shop) {
    forgetShop(shopDomain);
    log.info(
      `[compliance] markShopUninstalled: no Shop row for ${shopDomain}; sessions revoked`,
    );
    return { marked: false as const };
  }

  clearBillingCaches({ id: shop.id, domain: shop.domain });

  const queueDeleted = await deleteShopQueueJobs(shopDomain);

  await prisma.shop.updateMany({
    where: { domain: shopDomain },
    data: { uninstalledAt: new Date() },
  });

  // Keep the Subscription row; stop trusting pre-uninstall paid status (I-4).
  await applyLocalFreePlan(shop.id);

  log.success(
    `[compliance] markShopUninstalled: marked ${shopDomain} uninstalledAt (queueJobs=${queueDeleted.count}${
      shop.uninstalledAt ? "; already marked" : ""
    }; billing demoted to free)`,
  );
  return { marked: true as const, shopId: shop.id };
}

/**
 * Hard-delete all tenant data for a shop domain (shop/redact / shop.cleanup).
 * ComplianceRequest rows are kept (keyed by shopDomain, no FK) for audit.
 * Those rows never contain the raw customer webhook body.
 * WebhookDelivery rows for the domain are scrubbed (shop-scoped, no Shop FK).
 *
 * Reinstall guard: abort only when an offline Session exists (proof the app
 * was reinstalled). Do not require uninstalledAt — shop/redact must still
 * erase data if the uninstall soft-mark webhook was missed.
 *
 * Order: re-check offline Session immediately before any destructive delete;
 * drop QueueJobs / CacheGeneration / WebhookDelivery; then FK-cascaded Shop.
 */
export async function purgeShopData(shopDomain: string) {
  const offlineSession = await prisma.session.findFirst({
    where: { shop: shopDomain, isOnline: false },
    select: { id: true },
  });
  if (offlineSession) {
    log.warn(
      `[compliance] purgeShopData: abort for ${shopDomain} — offline Session exists (reinstalled)`,
    );
    return { deleted: false as const, skipped: "reinstalled_or_active" as const };
  }

  const shop = await prisma.shop.findUnique({
    where: { domain: shopDomain },
    include: { subscription: true },
  });

  // I-2: re-check right before destructive deletes (reinstall may have landed).
  const reinstalled = await prisma.session.findFirst({
    where: { shop: shopDomain, isOnline: false },
    select: { id: true },
  });
  if (reinstalled) {
    log.warn(
      `[compliance] purgeShopData: abort for ${shopDomain} — offline Session appeared before delete (reinstalled)`,
    );
    return { deleted: false as const, skipped: "reinstalled_or_active" as const };
  }

  await prisma.session.deleteMany({ where: { shop: shopDomain } });
  if (shop) {
    clearBillingCaches({ id: shop.id, domain: shop.domain });
  } else {
    forgetShop(shopDomain);
  }

  // Always scrub non-FK leftovers (idempotent when Shop is already gone).
  const queueDeleted = await deleteShopQueueJobs(shopDomain);
  const cacheDeleted = await deleteShopCacheGenerations(shopDomain);
  const webhookDeleted = await prisma.webhookDelivery.deleteMany({
    where: { shopDomain },
  });

  if (!shop) {
    log.info(
      `[compliance] purgeShopData: no Shop row for ${shopDomain} (queueJobs=${queueDeleted.count} cacheKeys=${cacheDeleted.count} webhookDeliveries=${webhookDeleted.count})`,
    );
    return { deleted: false as const };
  }

  // Audit #11: redact — compare with afterAuth billing-audit line after reinstall.
  log.info(
    `[compliance] billing-audit before-purge shop=${shopDomain} plan=${shop.plan} subStatus=${shop.subscription?.status ?? "none"} subPlan=${shop.subscription?.planName ?? "none"} shopifySubId=${shop.subscription?.shopifySubscriptionId ?? "none"}`,
  );

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
    `[compliance] purgeShopData: deleted tenant data for ${shopDomain} (queueJobs=${queueDeleted.count} cacheKeys=${cacheDeleted.count} webhookDeliveries=${webhookDeleted.count})`,
  );
  return { deleted: true as const, shopId: shop.id };
}

export type ShopPurgeMode = "queued" | "skipped";

/**
 * shop/redact hard-delete path — durable enqueue only (W-3).
 * APP_UNINSTALLED uses markShopUninstalled instead — do not call this on uninstall.
 *
 * Skip only when an offline Session exists (app reinstalled). If uninstall
 * soft-mark was missed but tokens are gone, purge still queues for GDPR.
 *
 * Failure modes when purge proceeds:
 * 1. Postgres queue accepts the job within 800ms (explicit timeout) → worker runs purgeShopData. 200.
 * 2. Enqueue throws or times out → error rethrown so webhook 5xx and Shopify retries.
 *
 * purgeShopData is idempotent, so a late queue add after a timeout is safe.
 */
export async function ensureShopPurged(
  shopDomain: string,
  source: "shop/redact" = "shop/redact",
): Promise<{ mode: ShopPurgeMode; deleted?: boolean }> {
  const offlineSession = await prisma.session.findFirst({
    where: { shop: shopDomain, isOnline: false },
    select: { id: true },
  });
  if (offlineSession) {
    log.warn(
      `[compliance] ${source}: skip purge for ${shopDomain} — offline Session exists (reinstalled)`,
    );
    return { mode: "skipped" };
  }

  try {
    await enqueueSyncJobWithTimeout(
      "shop.cleanup",
      { shop: shopDomain },
      { jobId: `${shopDomain}:shop.cleanup`, timeoutMs: 800 },
    );
    log.success(
      `[compliance] ${source}: queued shop.cleanup for ${shopDomain}`,
    );
    return { mode: "queued" };
  } catch (enqueueError) {
    const reason =
      enqueueError instanceof Error ? enqueueError.message : String(enqueueError);
    log.error(
      `[compliance] ${source}: enqueue failed for ${shopDomain} (${reason}) — webhook will 5xx so Shopify retries`,
      enqueueError,
    );
    throw enqueueError;
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
  // Prefer caller-supplied webhook id. Never randomUUID — retries must upsert
  // the same ComplianceRequest row (Rule 6).
  const trimmed =
    typeof meta.requestId === "string" ? meta.requestId.trim().slice(0, 128) : "";
  const requestId =
    trimmed ||
    createHash("sha256").update(`${topic}:${shopDomain}`).digest("hex");
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
