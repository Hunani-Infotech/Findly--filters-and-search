import { randomUUID } from "node:crypto";
import prisma from "../db.server";
import {
  LIVE_UNPAID_PLAN_LABEL,
  PLANS,
  isPaidPlanKey,
  planDisplayName,
  planKeyFromName,
  type PaidPlanKey,
  type PlanKey,
} from "../constants/plans";
import {
  findShopByIdCached,
  findShopByIdFresh,
  findShopCached,
  forgetShop,
  forgetShopById,
  rememberShop,
} from "../lib/shop-cache.server";
import { createTtlCache } from "../lib/read-cache.server";
import { log } from "../lib/log.server";

/** D-3: keep last-known paid storefront caps for 24h after a paid→empty sync. */
const LIMITS_GRACE_MS = 24 * 60 * 60 * 1000;

/**
 * PENDING app charges are NOT returned by currentAppInstallation.activeSubscriptions.
 * If sync treats "empty list" as cancel, it clears confirmationUrl and the next kickoff
 * creates a duplicate charge. Preserve fresh local PENDING+URL until Shopify pending
 * typically expires (~2 days), then allow wipe so the merchant can create a new charge.
 */
const PENDING_CHARGE_PRESERVE_MS = 48 * 60 * 60 * 1000;

export type BillingAuditAction = "create" | "sync" | "cancel" | "demote";

/** D-4: structured billing audit line (shop, sub id, status, request id). */
export function logBillingAudit(fields: {
  shop: string;
  action: BillingAuditAction;
  shopifySubscriptionId?: string | null;
  status: string;
  requestId?: string | null;
}) {
  const requestId =
    (fields.requestId && String(fields.requestId).trim()) || "none";
  log.info(
    `[billing-audit] shop=${fields.shop} action=${fields.action} shopifySubscriptionId=${fields.shopifySubscriptionId ?? "none"} status=${fields.status} requestId=${requestId}`,
  );
}

/** Correlate multi-step admin billing writes when no Shopify webhook id exists. */
export function newBillingRequestId(): string {
  return randomUUID().slice(0, 8);
}

export {
  LIVE_UNPAID_PLAN_LABEL,
  PLANS,
  isPaidPlanKey,
  planDisplayName,
  planKeyFromName,
};
export type { PaidPlanKey, PlanKey };

export function isBillingTestMode() {
  // Production-safe default: real charges unless explicitly enabled.
  return (process.env.BILLING_TEST_MODE ?? "false").toLowerCase() === "true";
}

/**
 * Development stores can only approve or decline a test charge.
 * A live charge makes Shopify's approval page fail Approve and Cancel with
 * "The shop cannot accept the provided charge."
 * Live shops follow BILLING_TEST_MODE.
 */
export function subscriptionChargeIsTest(partnerDevelopment: boolean): boolean {
  return isBillingTestMode() || partnerDevelopment;
}

/** Pending row whose saved approval URL matches the charge mode we would create. */
export function pendingChargeMatchesMode(
  subscription: {
    status?: string | null;
    test?: boolean | null;
    confirmationUrl?: string | null;
  } | null,
  testCharge: boolean,
): boolean {
  if (!subscription || !isLocalPendingStatus(subscription.status)) return false;
  if (Boolean(subscription.test) !== testCharge) return false;
  return Boolean(
    subscription.confirmationUrl &&
      isAllowedShopifyConfirmationUrl(subscription.confirmationUrl),
  );
}

/** Defense in depth: only follow Shopify-hosted billing confirmation URLs. */
export function isAllowedShopifyConfirmationUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    const host = parsed.hostname.toLowerCase();
    return (
      host === "admin.shopify.com" ||
      host === "shopify.com" ||
      host.endsWith(".shopify.com") ||
      host.endsWith(".myshopify.com")
    );
  } catch {
    return false;
  }
}

/** Local/dev only: Development plan uses full catalog caps without a paid subscription. */
export function isDevUnlockLimits() {
  return (process.env.DEV_UNLOCK_LIMITS ?? "false").toLowerCase() === "true";
}

/** Development stores get the full product, not live Standard/Pro caps. */
const DEVELOPMENT_STORE_CAPS = {
  productLimit: 5000,
  filterLimit: 25,
} as const;

function resolveNumericCaps(
  shop: {
    partnerDevelopment?: boolean;
    subscription?: {
      productLimit?: number | null;
      filterLimit?: number | null;
    } | null;
  } | null,
  planKey: PlanKey,
): { productLimit: number; filterLimit: number; unlocked: boolean } {
  if (isDevUnlockLimits() || (planKey === "free" && shop?.partnerDevelopment)) {
    return {
      productLimit: DEVELOPMENT_STORE_CAPS.productLimit,
      filterLimit: DEVELOPMENT_STORE_CAPS.filterLimit,
      unlocked: true,
    };
  }
  const plan = PLANS[planKey];
  if (planKey === "free") {
    return {
      productLimit: plan.productLimit,
      filterLimit: plan.filterLimit,
      unlocked: false,
    };
  }
  const storedProducts = shop?.subscription?.productLimit ?? 0;
  const storedFilters = shop?.subscription?.filterLimit ?? 0;
  return {
    productLimit: Math.max(storedProducts, plan.productLimit),
    filterLimit: Math.max(storedFilters, plan.filterLimit),
    unlocked: false,
  };
}

async function getOrCreateShop(domain: string) {
  const cached = await findShopCached(domain);
  if (cached && !cached.uninstalledAt) return cached;

  const shop = await prisma.shop.upsert({
    where: { domain },
    create: { domain, plan: PLANS.free.key },
    update: { uninstalledAt: null },
    include: { subscription: true },
  });
  rememberShop(shop);
  return shop;
}

export function hasActivePaidSubscription(subscription: {
  status: string;
  trialEndsAt: Date | null;
} | null) {
  if (!subscription) return false;
  const status = subscription.status.toUpperCase();
  if (status === "ACTIVE" || status === "TRIAL") return true;
  if (status === "PENDING" || status === "ACCEPTED") {
    if (subscription.trialEndsAt && subscription.trialEndsAt > new Date()) {
      return true;
    }
  }
  return false;
}

export function getShopPlan(shop: {
  plan?: string | null;
  subscription?: {
    status: string;
    trialEndsAt: Date | null;
    planName?: string | null;
  } | null;
}): PlanKey {
  if (!hasActivePaidSubscription(shop.subscription ?? null)) {
    return "free";
  }
  const fromName = planKeyFromName(shop.subscription?.planName);
  return fromName === "free" ? "pro" : fromName;
}

/**
 * D-3: when plan is free but limitsGraceUntil is in the future, keep last paid caps.
 * Does not treat the shop as paid for billing UI / approve gates.
 */
function resolveCapsWithGrace(
  shop: {
    partnerDevelopment?: boolean;
    subscription?: {
      productLimit?: number | null;
      filterLimit?: number | null;
      limitsGraceUntil?: Date | null;
    } | null;
  } | null,
  planKey: PlanKey,
): { productLimit: number; filterLimit: number; unlocked: boolean } {
  const caps = resolveNumericCaps(shop, planKey);
  if (planKey !== "free" || caps.unlocked) return caps;
  const graceUntil = shop?.subscription?.limitsGraceUntil;
  if (!graceUntil || graceUntil <= new Date()) return caps;
  const storedProducts = shop?.subscription?.productLimit ?? 0;
  const storedFilters = shop?.subscription?.filterLimit ?? 0;
  if (
    storedProducts <= PLANS.free.productLimit &&
    storedFilters <= PLANS.free.filterLimit
  ) {
    return caps;
  }
  return {
    productLimit: storedProducts,
    filterLimit: storedFilters,
    unlocked: false,
  };
}

/** Plan caps only — no catalog COUNT. Use on storefront/admin reads. */
export async function resolvePlanCaps(shopId: string): Promise<{
  plan: PlanKey;
  filterLimit: number;
  productLimit: number;
}> {
  // D-2: read Shop+Subscription from DB (not per-process shop cache).
  const shop = await findShopByIdFresh(shopId);
  if (!shop) {
    return {
      plan: "free",
      filterLimit: PLANS.free.filterLimit,
      productLimit: PLANS.free.productLimit,
    };
  }
  const planKey = getShopPlan(shop);
  const caps = resolveCapsWithGrace(shop, planKey);
  return {
    plan: planKey,
    filterLimit: caps.filterLimit,
    productLimit: caps.productLimit,
  };
}

export async function resolveFilterLimit(shopId: string): Promise<number> {
  return (await resolvePlanCaps(shopId)).filterLimit;
}

async function loadPlanLimits(shopId: string) {
  // D-2: plan enforcement uses fresh DB row (shared across web/worker).
  const shop = await findShopByIdFresh(shopId);
  if (!shop) {
    throw new Error(`Shop not found: ${shopId}`);
  }

  const planKey = getShopPlan(shop);
  const caps = resolveCapsWithGrace(shop, planKey);
  const productLimit = caps.productLimit;
  const filterLimit = caps.filterLimit;
  const unlocked = caps.unlocked;
  const plan = PLANS[planKey];

  const [productCount, filterCount] = await Promise.all([
    prisma.productFacet.count({ where: { shopId } }),
    prisma.metafieldMapping.count({
      where: {
        shopId,
        OR: [
          { appliesTo: { has: "filter" } },
          { AND: [{ appliesTo: { isEmpty: true } }, { enabled: true }] },
        ],
      },
    }),
  ]);

  const withinLimits =
    productCount <= productLimit && filterCount <= filterLimit;

  return {
    productCount,
    productLimit,
    filterCount,
    filterLimit,
    withinLimits,
    overProductLimit: productCount > productLimit,
    overFilterLimit: filterCount > filterLimit,
    plan: planKey,
    planDetails: plan,
    devUnlockLimits: unlocked,
  };
}

const planUsageCache = createTtlCache<Awaited<ReturnType<typeof loadPlanLimits>>>(
  30_000,
);

export async function enforcePlanLimits(shopId: string) {
  return planUsageCache.wrap(shopId, () => loadPlanLimits(shopId));
}

/** Drop shop + plan-usage caches after any billing write. */
export function clearBillingCaches(shop: { id: string; domain: string }) {
  forgetShop(shop.domain);
  forgetShopById(shop.id);
  planUsageCache.del(shop.id);
}

/**
 * Per-shop Postgres advisory lock around billing create/cancel/sync writes.
 * Callers may run GraphQL + prisma writes inside `fn`; the xact lock is held
 * until the transaction (and thus `fn`) completes.
 */
export async function withBillingLock<T>(
  shopId: string,
  fn: () => Promise<T>,
): Promise<T> {
  const lockKey = `billing:${shopId}`;
  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;
      return fn();
    },
    { maxWait: 10_000, timeout: 60_000 },
  );
}

/**
 * Unpaid shops resolve to plan key `free`. Development-store unlocks require
 * Shopify `partnerDevelopment` (or local DEV_UNLOCK_LIMITS) — not the plan key alone.
 * Paid Standard/Pro unlock live catalog limits. Limits are enforced elsewhere.
 */
export async function ensureShopAccess(shopDomain: string) {
  const shop = await getOrCreateShop(shopDomain);
  const plan = getShopPlan(shop);

  if (shop.plan !== plan) {
    shop.plan = plan;
    rememberShop(shop);
  }

  return {
    shop,
    plan,
  };
}

/** True when this shop may use free Development features (not live unpaid). */
export function isDevelopmentStoreAccess(shop: {
  partnerDevelopment?: boolean | null;
}): boolean {
  return Boolean(shop.partnerDevelopment) || isDevUnlockLimits();
}

export type BillingApproveGate = {
  show: boolean;
  reason: "pending" | "declined" | "live_unpaid" | null;
  confirmationUrl: string | null; // only when pending + allowed URL
  title: string;
  message: string;
  ctaLabel: "Approve plan" | "Choose plan";
};

const BILLING_GATE_HIDDEN: BillingApproveGate = {
  show: false,
  reason: null,
  confirmationUrl: null,
  title: "",
  message: "",
  ctaLabel: "Choose plan",
};

/**
 * In-app banner for unpaid/declined/pending charges (B-9).
 * ACTIVE and partner/development stores stay hidden — no silent lock-out.
 */
export function resolveBillingApproveGate(shop: {
  partnerDevelopment?: boolean | null;
  subscription?: {
    status: string;
    trialEndsAt: Date | null;
    confirmationUrl?: string | null;
    planName?: string | null;
  } | null;
}): BillingApproveGate {
  if (isDevelopmentStoreAccess(shop)) return BILLING_GATE_HIDDEN;
  if (hasActivePaidSubscription(shop.subscription ?? null)) {
    return BILLING_GATE_HIDDEN;
  }

  const status = String(shop.subscription?.status || "").toUpperCase();
  const confirmationUrl =
    shop.subscription?.confirmationUrl &&
    isAllowedShopifyConfirmationUrl(shop.subscription.confirmationUrl)
      ? shop.subscription.confirmationUrl
      : null;

  if (isLocalPendingStatus(status) && confirmationUrl) {
    return {
      show: true,
      reason: "pending",
      confirmationUrl,
      title: "Approve your plan",
      message:
        "Shopify is waiting for you to approve the Findly subscription charge. Open the approval page to finish setup — nothing is locked until you decide.",
      ctaLabel: "Approve plan",
    };
  }

  if (status === "DECLINED") {
    return {
      show: true,
      reason: "declined",
      confirmationUrl: null,
      title: "Plan declined",
      message:
        "The previous subscription charge was declined. Choose Standard or Pro on the pricing page to continue indexing your catalog.",
      ctaLabel: "Choose plan",
    };
  }

  // Live unpaid (not partner): no active paid, not pending-with-URL.
  return {
    show: true,
    reason: "live_unpaid",
    confirmationUrl: null,
    title: "Choose a plan",
    message:
      "Live stores use Standard or Pro. Choose a plan to index your catalog — Findly stays open so you can pick when ready.",
    ctaLabel: "Choose plan",
  };
}

/** Admin-facing plan label for a shop row (Development vs No paid plan). */
export function shopPlanDisplayName(shop: {
  partnerDevelopment?: boolean | null;
  subscription?: {
    status: string;
    trialEndsAt: Date | null;
    planName?: string | null;
  } | null;
}): string {
  const plan = getShopPlan(shop);
  return planDisplayName(plan, {
    partnerDevelopment: Boolean(shop.partnerDevelopment),
    unlocked: isDevUnlockLimits(),
  });
}

type GraphqlAdmin = {
  graphql: (
    query: string,
    options?: { variables?: Record<string, unknown> },
  ) => Promise<Response>;
};

export type ShopifyActiveSubscription = {
  id: string;
  name: string;
  status: string;
  test: boolean;
  trialDays: number | null;
  createdAt: string;
  currentPeriodEnd: string | null;
};

const ACTIVE_SUBSCRIPTIONS_QUERY = `#graphql
query ActiveSubscriptions {
  currentAppInstallation {
    activeSubscriptions {
      id
      name
      status
      test
      trialDays
      createdAt
      currentPeriodEnd
    }
  }
}`;

/** Map Shopify subscription name → PaidPlanKey (unknown names → pro). */
export function paidPlanKeyFromShopifyName(
  name: string | null | undefined,
): PaidPlanKey {
  const resolved = planKeyFromName(name);
  return resolved === "free" ? "pro" : resolved;
}

function shopifySubStatus(sub: { status?: string | null }): string {
  return String(sub.status || "").toUpperCase();
}

function isShopifyActivePaid(sub: {
  status?: string | null;
  trialDays?: number | null;
  createdAt?: string | null;
}): boolean {
  const status = shopifySubStatus(sub);
  if (status === "ACTIVE" || status === "TRIAL") return true;
  if (sub.trialDays && sub.createdAt) {
    const trialEndsAt = new Date(
      new Date(sub.createdAt).getTime() +
        Number(sub.trialDays) * 24 * 60 * 60 * 1000,
    );
    if (trialEndsAt > new Date()) return true;
  }
  return false;
}

function isLocalPendingStatus(status: string | null | undefined): boolean {
  const s = String(status || "").toUpperCase();
  return s === "PENDING" || s === "ACCEPTED";
}

/**
 * B-1 charge decision from Shopify activeSubscriptions (source of truth).
 *
 * - No ACTIVE paid → may create a new charge.
 * - ACTIVE matching the requested plan → STOP (never re-charge the same plan).
 * - ACTIVE different paid plan → allow create with replacementBehavior (Standard↔Pro).
 *   Kickoff passes no requestedPlan and treats any ACTIVE as stop.
 */
export function decideChargeFromActiveSubscriptions(
  shopifySubs: ShopifyActiveSubscription[],
  requestedPlan?: PaidPlanKey,
):
  | { action: "create" }
  | { action: "stop_same_plan"; active: ShopifyActiveSubscription }
  | { action: "stop_any_active"; active: ShopifyActiveSubscription }
  | {
      action: "replace_other_plan";
      active: ShopifyActiveSubscription;
      activeKey: PaidPlanKey;
    } {
  const activePaid = shopifySubs.find((s) => isShopifyActivePaid(s));
  if (!activePaid) return { action: "create" };

  if (!requestedPlan) {
    return { action: "stop_any_active", active: activePaid };
  }

  const activeKey = paidPlanKeyFromShopifyName(activePaid.name);
  if (activeKey === requestedPlan) {
    return { action: "stop_same_plan", active: activePaid };
  }
  return {
    action: "replace_other_plan",
    active: activePaid,
    activeKey,
  };
}

/** Query Shopify currentAppInstallation.activeSubscriptions (source of truth). */
export async function fetchActiveSubscriptions(
  admin: GraphqlAdmin,
): Promise<ShopifyActiveSubscription[]> {
  const response = await admin.graphql(ACTIVE_SUBSCRIPTIONS_QUERY);
  const json = (await response.json()) as {
    data?: {
      currentAppInstallation?: {
        activeSubscriptions?: ShopifyActiveSubscription[];
      };
    };
  };
  return json.data?.currentAppInstallation?.activeSubscriptions ?? [];
}

const SAVED_APP_SUBSCRIPTION_QUERY = `#graphql
query SavedAppSubscription($id: ID!) {
  node(id: $id) {
    ... on AppSubscription {
      id
      status
    }
  }
}`;

/**
 * Read the saved AppSubscription by id. activeSubscriptions omits charges that
 * are still pending, so it cannot tell a confirmation URL is still open.
 * "unknown" means the lookup failed — callers keep the saved URL so a blip
 * cannot create a second charge. This is Admin API billing, not theme markup.
 */
export async function lookupSavedCharge(
  admin: GraphqlAdmin,
  shopifySubscriptionId: string | null | undefined,
): Promise<"pending" | "closed" | "unknown"> {
  const id = shopifySubscriptionId?.trim();
  if (!id) return "unknown";
  try {
    const response = await admin.graphql(SAVED_APP_SUBSCRIPTION_QUERY, {
      variables: { id },
    });
    const json = (await response.json()) as {
      errors?: { message?: string }[];
      data?: {
        node?: { id?: string | null; status?: string | null } | null;
      };
    };
    if (json.errors?.length) {
      log.warn(
        `[billing] saved charge lookup failed id=${id}: ${json.errors
          .map((e) => e.message || "error")
          .join("; ")}`,
      );
      return "unknown";
    }
    const node = json.data?.node;
    if (!node?.id) return "closed";
    return isLocalPendingStatus(node.status) ? "pending" : "closed";
  } catch (error) {
    log.warn(
      `[billing] saved charge lookup failed id=${id}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return "unknown";
  }
}

const SHOP_PARTNER_DEVELOPMENT_QUERY = `#graphql
query ShopPartnerDevelopment {
  shop {
    plan {
      partnerDevelopment
    }
  }
}`;

export async function refreshPartnerDevelopment(
  admin: GraphqlAdmin,
  shopId: string,
) {
  try {
    const response = await admin.graphql(SHOP_PARTNER_DEVELOPMENT_QUERY);
    const json = (await response.json()) as {
      data?: { shop?: { plan?: { partnerDevelopment?: boolean } } };
    };
    const partnerDevelopment = Boolean(
      json.data?.shop?.plan?.partnerDevelopment,
    );
    const current = await findShopByIdCached(shopId);
    if (current?.partnerDevelopment === partnerDevelopment) {
      return partnerDevelopment;
    }
    const shop = await prisma.shop.update({
      where: { id: shopId },
      data: { partnerDevelopment },
      include: { subscription: true },
    });
    rememberShop(shop);
    clearBillingCaches({ id: shop.id, domain: shop.domain });
    return partnerDevelopment;
  } catch {
    return null;
  }
}

async function loadShopDomain(shopId: string): Promise<string | null> {
  const cached = await findShopByIdCached(shopId);
  if (cached) return cached.domain;
  const row = await prisma.shop.findUnique({
    where: { id: shopId },
    select: { domain: true },
  });
  return row?.domain ?? null;
}

async function persistPendingSubscription(opts: {
  shopId: string;
  shopifySubscriptionId: string;
  planKey: PaidPlanKey;
  status: string;
  confirmationUrl: string;
  test: boolean;
  requestId?: string;
}) {
  const plan = PLANS[opts.planKey];
  const status = opts.status || "PENDING";
  await prisma.subscription.upsert({
    where: { shopId: opts.shopId },
    create: {
      shopId: opts.shopId,
      shopifySubscriptionId: opts.shopifySubscriptionId,
      planName: plan.name,
      status,
      test: opts.test,
      productLimit: plan.productLimit,
      filterLimit: plan.filterLimit,
      confirmationUrl: opts.confirmationUrl,
      limitsGraceUntil: null,
    },
    update: {
      shopifySubscriptionId: opts.shopifySubscriptionId,
      planName: plan.name,
      status,
      test: opts.test,
      productLimit: plan.productLimit,
      filterLimit: plan.filterLimit,
      confirmationUrl: opts.confirmationUrl,
      limitsGraceUntil: null,
    },
  });
  await prisma.shop.update({
    where: { id: opts.shopId },
    data: { plan: plan.key },
  });
  const domain = (await loadShopDomain(opts.shopId)) ?? opts.shopId;
  logBillingAudit({
    shop: domain,
    action: "create",
    shopifySubscriptionId: opts.shopifySubscriptionId,
    status,
    requestId: opts.requestId,
  });
}

/**
 * Best-effort cancel of a PENDING charge the shop cannot approve or decline in Admin.
 * Failure is expected for a live charge on a development store; callers still create
 * a replacement test charge.
 */
async function declineShopifySubscriptionBestEffort(
  admin: GraphqlAdmin,
  subscriptionGid: string,
  shopLabel: string,
) {
  try {
    const response = await admin.graphql(
      `#graphql
      mutation AppSubscriptionCancel($id: ID!) {
        appSubscriptionCancel(id: $id) {
          appSubscription {
            id
            status
          }
          userErrors {
            field
            message
          }
        }
      }`,
      { variables: { id: subscriptionGid } },
    );
    const json = await response.json();
    const errors = [
      ...(json.data?.appSubscriptionCancel?.userErrors ?? []),
      ...(json.errors ?? []),
    ];
    if (errors.length) {
      log.warn(
        `[billing] could not decline unusable charge for ${shopLabel} id=${subscriptionGid}: ${errors
          .map((e: { message?: string }) => e.message || "error")
          .join("; ")} — creating a replacement charge`,
      );
      return;
    }
    log.info(
      `[billing] declined unusable charge for ${shopLabel} id=${subscriptionGid} status=${json.data?.appSubscriptionCancel?.appSubscription?.status ?? "unknown"}`,
    );
  } catch (error) {
    log.warn(
      `[billing] decline unusable charge failed for ${shopLabel} id=${subscriptionGid}: ${
        error instanceof Error ? error.message : String(error)
      } — creating a replacement charge`,
    );
  }
}

/**
 * Live shops must start Standard immediately (no trial). Development stores stay free.
 * Shopify-truth ACTIVE → null (no create). Local PENDING with saved URL → reuse.
 * Callers must NOT auto-redirect (B-9); surface confirmationUrl via in-app Approve CTA.
 */
export async function startStandardSubscriptionIfLive(
  admin: GraphqlAdmin,
  shopDomain: string,
  returnUrl: string,
): Promise<{ confirmationUrl: string; reused: boolean } | null> {
  const { shop } = await ensureShopAccess(shopDomain);
  await refreshPartnerDevelopment(admin, shop.id);
  const latest = await findShopByIdCached(shop.id);
  if (!latest) return null;
  if (isDevelopmentStoreAccess(latest)) return null;

  return withBillingLock(latest.id, async () => {
    const requestId = newBillingRequestId();
    // B-1: query Shopify before any appSubscriptionCreate.
    const shopifySubs = await fetchActiveSubscriptions(admin);
    const decision = decideChargeFromActiveSubscriptions(shopifySubs);
    if (decision.action === "stop_any_active") {
      // Any ACTIVE paid → never create another install kickoff charge.
      await syncActiveSubscriptionsUnlocked(admin, latest.id, {
        prefetched: shopifySubs,
        requestId,
      });
      return null;
    }

    const local = await prisma.subscription.findUnique({
      where: { shopId: latest.id },
    });
    const testCharge = isBillingTestMode();
    const savedCharge =
      local && isLocalPendingStatus(local.status)
        ? await lookupSavedCharge(admin, local.shopifySubscriptionId)
        : "closed";
    if (
      local &&
      pendingChargeMatchesMode(local, testCharge) &&
      savedCharge !== "closed"
    ) {
      return { confirmationUrl: local.confirmationUrl!, reused: true };
    }
    if (
      local &&
      isLocalPendingStatus(local.status) &&
      Boolean(local.test) === testCharge &&
      savedCharge !== "closed"
    ) {
      // Pending charge exists but URL missing/invalid — never create another.
      return null;
    }
    if (
      local &&
      isLocalPendingStatus(local.status) &&
      local.shopifySubscriptionId &&
      Boolean(local.test) !== testCharge
    ) {
      await declineShopifySubscriptionBestEffort(
        admin,
        local.shopifySubscriptionId,
        shopDomain,
      );
    }

    const result = await createAppSubscription(
      admin,
      returnUrl,
      "standard",
      testCharge,
    );
    const errors = result?.userErrors ?? [];
    if (errors.length || !result?.confirmationUrl) return null;
    if (!isAllowedShopifyConfirmationUrl(result.confirmationUrl)) return null;

    if (result.appSubscription?.id) {
      await persistPendingSubscription({
        shopId: latest.id,
        shopifySubscriptionId: result.appSubscription.id,
        planKey: "standard",
        status: result.appSubscription.status || "PENDING",
        confirmationUrl: result.confirmationUrl,
        test: testCharge,
        requestId,
      });
      clearBillingCaches({ id: latest.id, domain: shopDomain });
    }

    return { confirmationUrl: result.confirmationUrl, reused: false };
  });
}

export type StartOrReusePaidResult =
  | { kind: "already_active" }
  | { kind: "pending"; confirmationUrl: string }
  | { kind: "created"; confirmationUrl: string }
  | { kind: "error"; error: string };

/**
 * Billing-page upgrade/switch: sync Shopify first, reuse pending URL, or create.
 *
 * B-1: Always fetch activeSubscriptions first.
 * - ACTIVE same plan → already_active (never re-charge).
 * - ACTIVE other plan → create with replacementBehavior (Standard↔Pro switch).
 * - No ACTIVE → create or reuse pending confirmationUrl.
 */
export async function startOrReusePaidSubscription(
  admin: GraphqlAdmin,
  shopId: string,
  shopDomain: string,
  returnUrl: string,
  planKey: PaidPlanKey,
): Promise<StartOrReusePaidResult> {
  const refreshed = await refreshPartnerDevelopment(admin, shopId);
  const shopRow = await findShopByIdCached(shopId);
  const testCharge = subscriptionChargeIsTest(
    typeof refreshed === "boolean"
      ? refreshed
      : Boolean(shopRow?.partnerDevelopment),
  );

  return withBillingLock(shopId, async () => {
    const requestId = newBillingRequestId();
    // B-1: query Shopify before any appSubscriptionCreate.
    const shopifySubs = await fetchActiveSubscriptions(admin);
    const decision = decideChargeFromActiveSubscriptions(shopifySubs, planKey);

    if (decision.action === "stop_same_plan") {
      await syncActiveSubscriptionsUnlocked(admin, shopId, {
        prefetched: shopifySubs,
        requestId,
      });
      return { kind: "already_active" };
    }

    const hasActivePaid = decision.action === "replace_other_plan";
    // replace_other_plan: fall through to createAppSubscription (STANDARD replacement).

    const local = await prisma.subscription.findUnique({
      where: { shopId },
    });
    const savedCharge =
      !hasActivePaid && local && isLocalPendingStatus(local.status)
        ? await lookupSavedCharge(admin, local.shopifySubscriptionId)
        : "closed";
    if (
      !hasActivePaid &&
      local &&
      pendingChargeMatchesMode(local, testCharge) &&
      savedCharge !== "closed"
    ) {
      return { kind: "pending", confirmationUrl: local.confirmationUrl! };
    }
    if (savedCharge === "closed" && local && isLocalPendingStatus(local.status)) {
      log.info(
        `[billing] saved charge is not pending for ${shopDomain} id=${local.shopifySubscriptionId ?? "none"}; creating a replacement`,
      );
    }
    if (
      !hasActivePaid &&
      local &&
      isLocalPendingStatus(local.status) &&
      Boolean(local.test) === testCharge &&
      savedCharge !== "closed"
    ) {
      return {
        kind: "error",
        error:
          "A subscription approval is already pending. Finish or cancel it in Shopify Billing, then try again.",
      };
    }
    if (
      !hasActivePaid &&
      local &&
      isLocalPendingStatus(local.status) &&
      local.shopifySubscriptionId &&
      Boolean(local.test) !== testCharge
    ) {
      // Live charge on a development store: Shopify rejects both Approve and Cancel.
      await declineShopifySubscriptionBestEffort(
        admin,
        local.shopifySubscriptionId,
        shopDomain,
      );
    }

    const result = await createAppSubscription(
      admin,
      returnUrl,
      planKey,
      testCharge,
    );
    const errors = result?.userErrors ?? [];
    if (errors.length || !result?.confirmationUrl) {
      return {
        kind: "error",
        error:
          errors.map((e: { message: string }) => e.message).join("; ") ||
          "Could not create subscription",
      };
    }
    if (!isAllowedShopifyConfirmationUrl(result.confirmationUrl)) {
      return {
        kind: "error",
        error: "Unexpected billing confirmation URL from Shopify.",
      };
    }

    if (result.appSubscription?.id) {
      await persistPendingSubscription({
        shopId,
        shopifySubscriptionId: result.appSubscription.id,
        planKey,
        status: result.appSubscription.status || "PENDING",
        confirmationUrl: result.confirmationUrl,
        test: testCharge,
        requestId,
      });
      clearBillingCaches({ id: shopId, domain: shopDomain });
    }

    return { kind: "created", confirmationUrl: result.confirmationUrl };
  });
}

/**
 * Low-level Shopify mutation only. Callers MUST run fetchActiveSubscriptions +
 * decideChargeFromActiveSubscriptions first (B-1) and hold withBillingLock.
 */
export async function createAppSubscription(
  admin: GraphqlAdmin,
  returnUrl: string,
  planKey: PaidPlanKey = "pro",
  test = isBillingTestMode(),
) {
  const plan = PLANS[planKey];
  const response = await admin.graphql(
    `#graphql
    mutation AppSubscriptionCreate(
      $name: String!
      $returnUrl: URL!
      $trialDays: Int
      $test: Boolean
      $replacementBehavior: AppSubscriptionReplacementBehavior
      $lineItems: [AppSubscriptionLineItemInput!]!
    ) {
      appSubscriptionCreate(
        name: $name
        returnUrl: $returnUrl
        trialDays: $trialDays
        test: $test
        replacementBehavior: $replacementBehavior
        lineItems: $lineItems
      ) {
        appSubscription {
          id
          status
          trialDays
        }
        confirmationUrl
        userErrors {
          field
          message
        }
      }
    }`,
    {
      variables: {
        name: plan.name,
        returnUrl,
        trialDays: plan.trialDays,
        test,
        replacementBehavior: "STANDARD",
        lineItems: [
          {
            plan: {
              appRecurringPricingDetails: {
                price: {
                  amount: plan.amount,
                  currencyCode: plan.currencyCode,
                },
                interval: plan.interval,
              },
            },
          },
        ],
      },
    },
  );

  const json = await response.json();
  return json.data?.appSubscriptionCreate;
}

/** Apply Shopify activeSubscriptions to local DB. Caller must hold withBillingLock. */
async function syncActiveSubscriptionsUnlocked(
  admin: GraphqlAdmin,
  shopId: string,
  options?: {
    prefetched?: ShopifyActiveSubscription[];
    requestId?: string;
  },
) {
  const requestId = options?.requestId ?? newBillingRequestId();
  const subs =
    options?.prefetched ?? (await fetchActiveSubscriptions(admin));
  // Prefer a real ACTIVE/TRIAL row if Shopify returns more than one.
  const active =
    subs.find((s) => isShopifyActivePaid(s)) ?? subs[0] ?? null;
  const domain = await loadShopDomain(shopId);
  const shopLabel = domain ?? shopId;

  if (!active) {
    const existing = await prisma.subscription.findUnique({
      where: { shopId },
    });

    // --- Empty activeSubscriptions: scenario matrix ---
    // ACTIVE merchant cancelled → wipe local to free (+ D-3 grace). Correct.
    // PENDING waiting for approval → NOT in this list; preserve URL or we
    //   duplicate-charge on next kickoff/reconcile. Correct to preserve.
    // PENDING declined/expired hours ago → list still empty; after 48h wipe so
    //   merchant can Choose plan again (Approve URL is likely dead anyway).
    // PENDING without saved URL → wipe so create path can run again.
    // Never-installed / already CANCELLED → wipe/upsert free. Harmless.
    if (
      existing &&
      isLocalPendingStatus(existing.status) &&
      existing.confirmationUrl &&
      isAllowedShopifyConfirmationUrl(existing.confirmationUrl)
    ) {
      const pendingAgeMs = Date.now() - existing.updatedAt.getTime();
      if (pendingAgeMs < PENDING_CHARGE_PRESERVE_MS) {
        logBillingAudit({
          shop: shopLabel,
          action: "sync",
          shopifySubscriptionId: existing.shopifySubscriptionId,
          status: existing.status,
          requestId,
        });
        log.info(
          `[billing] preserve PENDING confirmationUrl for ${shopLabel} (ageMs=${pendingAgeMs}; activeSubscriptions empty — not a cancel)`,
        );
        return existing;
      }
      log.info(
        `[billing] stale PENDING for ${shopLabel} (ageMs=${pendingAgeMs} >= ${PENDING_CHARGE_PRESERVE_MS}); clearing so a new charge can be created`,
      );
    }

    const wasPaid = hasActivePaidSubscription(existing);
    const graceActive =
      existing?.limitsGraceUntil != null &&
      existing.limitsGraceUntil > new Date();

    // D-3: paid→empty keeps last paid limits for 24h; do not refresh an active grace.
    let productLimit: number = PLANS.free.productLimit;
    let filterLimit: number = PLANS.free.filterLimit;
    let limitsGraceUntil: Date | null = null;
    if (wasPaid) {
      productLimit = existing!.productLimit;
      filterLimit = existing!.filterLimit;
      limitsGraceUntil = new Date(Date.now() + LIMITS_GRACE_MS);
    } else if (graceActive) {
      productLimit = existing!.productLimit;
      filterLimit = existing!.filterLimit;
      limitsGraceUntil = existing!.limitsGraceUntil;
    }

    await prisma.subscription.upsert({
      where: { shopId },
      create: {
        shopId,
        planName: PLANS.free.name,
        status: "CANCELLED",
        test: isBillingTestMode(),
        productLimit,
        filterLimit,
        confirmationUrl: null,
        limitsGraceUntil,
      },
      update: {
        status: "CANCELLED",
        planName: PLANS.free.name,
        shopifySubscriptionId: null,
        productLimit,
        filterLimit,
        confirmationUrl: null,
        limitsGraceUntil,
      },
    });
    await prisma.shop.update({
      where: { id: shopId },
      data: { plan: PLANS.free.key },
    });
    if (domain) clearBillingCaches({ id: shopId, domain });
    else planUsageCache.del(shopId);
    logBillingAudit({
      shop: shopLabel,
      action: "sync",
      shopifySubscriptionId: null,
      status: "CANCELLED",
      requestId,
    });
    return null;
  }

  const trialEndsAt =
    active.trialDays && active.createdAt
      ? new Date(
          new Date(active.createdAt).getTime() +
            Number(active.trialDays) * 24 * 60 * 60 * 1000,
        )
      : null;

  const planName = active.name ?? PLANS.pro.name;
  const paidKey = paidPlanKeyFromShopifyName(planName);
  const paidPlan = PLANS[paidKey];
  const status = shopifySubStatus(active);
  const isPaid =
    status === "ACTIVE" ||
    status === "TRIAL" ||
    (trialEndsAt != null && trialEndsAt > new Date());
  // No pending charge once Shopify reports ACTIVE/CANCELLED (or equivalent settled).
  const clearPendingUrl =
    status === "ACTIVE" ||
    status === "CANCELLED" ||
    status === "DECLINED" ||
    status === "EXPIRED" ||
    status === "FROZEN";

  const subscription = await prisma.subscription.upsert({
    where: { shopId },
    create: {
      shopId,
      shopifySubscriptionId: active.id,
      planName,
      status: active.status,
      test: Boolean(active.test),
      trialEndsAt,
      productLimit: paidPlan.productLimit,
      filterLimit: paidPlan.filterLimit,
      confirmationUrl: null,
      limitsGraceUntil: null,
    },
    update: {
      shopifySubscriptionId: active.id,
      planName,
      status: active.status,
      test: Boolean(active.test),
      trialEndsAt,
      productLimit: paidPlan.productLimit,
      filterLimit: paidPlan.filterLimit,
      limitsGraceUntil: null,
      ...(clearPendingUrl ? { confirmationUrl: null } : {}),
    },
  });

  await prisma.shop.update({
    where: { id: shopId },
    data: { plan: isPaid ? paidKey : PLANS.free.key },
  });

  if (domain) clearBillingCaches({ id: shopId, domain });
  else planUsageCache.del(shopId);
  logBillingAudit({
    shop: shopLabel,
    action: "sync",
    shopifySubscriptionId: active.id,
    status: active.status,
    requestId,
  });
  return subscription;
}

export async function syncActiveSubscriptions(
  admin: GraphqlAdmin,
  shopId: string,
  opts?: { requestId?: string },
) {
  return withBillingLock(shopId, () =>
    syncActiveSubscriptionsUnlocked(admin, shopId, {
      requestId: opts?.requestId,
    }),
  );
}

/**
 * I-4: rebuild local billing from Shopify before trusting paid access.
 * No appSubscriptionCreate — partner-dev kickoff / charge create stay separate.
 */
export async function reconcileBillingFromShopify(
  admin: GraphqlAdmin,
  shopId: string,
) {
  await refreshPartnerDevelopment(admin, shopId);
  return syncActiveSubscriptions(admin, shopId);
}

/** Reset local billing to Free (same shape as a fresh install / cancelled sync). */
export async function applyLocalFreePlan(
  shopId: string,
  opts?: { requestId?: string },
) {
  await prisma.subscription.upsert({
    where: { shopId },
    create: {
      shopId,
      planName: PLANS.free.name,
      status: "CANCELLED",
      test: isBillingTestMode(),
      productLimit: PLANS.free.productLimit,
      filterLimit: PLANS.free.filterLimit,
      shopifySubscriptionId: null,
      confirmationUrl: null,
      limitsGraceUntil: null,
    },
    update: {
      status: "CANCELLED",
      planName: PLANS.free.name,
      shopifySubscriptionId: null,
      productLimit: PLANS.free.productLimit,
      filterLimit: PLANS.free.filterLimit,
      trialEndsAt: null,
      confirmationUrl: null,
      limitsGraceUntil: null,
    },
  });
  await prisma.shop.update({
    where: { id: shopId },
    data: { plan: PLANS.free.key },
  });
  const domain = await loadShopDomain(shopId);
  if (domain) clearBillingCaches({ id: shopId, domain });
  else planUsageCache.del(shopId);
  logBillingAudit({
    shop: domain ?? shopId,
    action: "demote",
    shopifySubscriptionId: null,
    status: "CANCELLED",
    requestId: opts?.requestId,
  });
}

/**
 * Cancel an active Shopify app subscription (paid → Free).
 * Resolves GID from Shopify activeSubscriptions (hint optional).
 * Does not use replacementBehavior — that is only for paid ↔ paid switches.
 */
export async function cancelSubscription(
  admin: GraphqlAdmin,
  shopId: string,
  subscriptionGidHint?: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  return withBillingLock(shopId, async () => {
    const requestId = newBillingRequestId();
    const shopLabel = (await loadShopDomain(shopId)) ?? shopId;
    const shopifySubs = await fetchActiveSubscriptions(admin);
    const activePaid = shopifySubs.filter((s) => isShopifyActivePaid(s));

    let gid: string | undefined;
    if (subscriptionGidHint) {
      gid = activePaid.find((s) => s.id === subscriptionGidHint)?.id;
    }
    if (!gid && activePaid.length) {
      gid = activePaid[0].id;
    }

    if (!gid) {
      logBillingAudit({
        shop: shopLabel,
        action: "cancel",
        shopifySubscriptionId: null,
        status: "CANCELLED",
        requestId,
      });
      await applyLocalFreePlan(shopId, { requestId });
      return { ok: true };
    }

    const response = await admin.graphql(
      `#graphql
      mutation AppSubscriptionCancel($id: ID!) {
        appSubscriptionCancel(id: $id) {
          appSubscription {
            id
            status
          }
          userErrors {
            field
            message
          }
        }
      }`,
      { variables: { id: gid } },
    );
    const json = await response.json();
    const payload = json.data?.appSubscriptionCancel;
    const errors = payload?.userErrors ?? [];
    if (errors.length) {
      return {
        ok: false,
        error:
          errors.map((e: { message: string }) => e.message).join("; ") ||
          "Could not cancel subscription",
      };
    }
    if (json.errors?.length) {
      return {
        ok: false,
        error:
          json.errors
            .map((e: { message?: string }) => e.message || "GraphQL error")
            .join("; ") || "Could not cancel subscription",
      };
    }

    const cancelledStatus =
      payload?.appSubscription?.status != null
        ? String(payload.appSubscription.status)
        : "CANCELLED";
    logBillingAudit({
      shop: shopLabel,
      action: "cancel",
      shopifySubscriptionId: gid,
      status: cancelledStatus,
      requestId,
    });
    await applyLocalFreePlan(shopId, { requestId });
    // Re-read Shopify so a failed cancel that still left an active sub is corrected.
    await syncActiveSubscriptionsUnlocked(admin, shopId, { requestId });
    return { ok: true };
  });
}
