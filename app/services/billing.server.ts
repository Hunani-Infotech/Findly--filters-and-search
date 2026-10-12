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
  findShopCached,
  forgetShop,
  forgetShopById,
  rememberShop,
} from "../lib/shop-cache.server";
import { createTtlCache } from "../lib/read-cache.server";

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

/** Plan caps only — no catalog COUNT. Use on storefront/admin reads. */
export async function resolvePlanCaps(shopId: string): Promise<{
  plan: PlanKey;
  filterLimit: number;
  productLimit: number;
}> {
  const shop = await findShopByIdCached(shopId);
  if (!shop) {
    return {
      plan: "free",
      filterLimit: PLANS.free.filterLimit,
      productLimit: PLANS.free.productLimit,
    };
  }
  const planKey = getShopPlan(shop);
  const caps = resolveNumericCaps(shop, planKey);
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
  const shop = await findShopByIdCached(shopId);
  if (!shop) {
    throw new Error(`Shop not found: ${shopId}`);
  }

  const planKey = getShopPlan(shop);
  const caps = resolveNumericCaps(shop, planKey);
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
}) {
  const plan = PLANS[opts.planKey];
  await prisma.subscription.upsert({
    where: { shopId: opts.shopId },
    create: {
      shopId: opts.shopId,
      shopifySubscriptionId: opts.shopifySubscriptionId,
      planName: plan.name,
      status: opts.status || "PENDING",
      test: isBillingTestMode(),
      productLimit: plan.productLimit,
      filterLimit: plan.filterLimit,
      confirmationUrl: opts.confirmationUrl,
    },
    update: {
      shopifySubscriptionId: opts.shopifySubscriptionId,
      planName: plan.name,
      status: opts.status || "PENDING",
      test: isBillingTestMode(),
      productLimit: plan.productLimit,
      filterLimit: plan.filterLimit,
      confirmationUrl: opts.confirmationUrl,
    },
  });
  await prisma.shop.update({
    where: { id: opts.shopId },
    data: { plan: plan.key },
  });
}

/**
 * Live shops must start Standard immediately (no trial). Development stores stay free.
 * Shopify-truth ACTIVE → null (no create/redirect). Local PENDING with saved URL → reuse.
 */
export async function startStandardSubscriptionIfLive(
  admin: GraphqlAdmin,
  shopDomain: string,
  returnUrl: string,
): Promise<{ confirmationUrl: string } | null> {
  const { shop } = await ensureShopAccess(shopDomain);
  await refreshPartnerDevelopment(admin, shop.id);
  const latest = await findShopByIdCached(shop.id);
  if (!latest) return null;
  if (isDevelopmentStoreAccess(latest)) return null;

  return withBillingLock(latest.id, async () => {
    // B-1: query Shopify before any appSubscriptionCreate.
    const shopifySubs = await fetchActiveSubscriptions(admin);
    const decision = decideChargeFromActiveSubscriptions(shopifySubs);
    if (decision.action === "stop_any_active") {
      // Any ACTIVE paid → never create another install kickoff charge.
      await syncActiveSubscriptionsUnlocked(admin, latest.id, shopifySubs);
      return null;
    }

    const local = await prisma.subscription.findUnique({
      where: { shopId: latest.id },
    });
    if (
      local &&
      isLocalPendingStatus(local.status) &&
      local.confirmationUrl &&
      isAllowedShopifyConfirmationUrl(local.confirmationUrl)
    ) {
      return { confirmationUrl: local.confirmationUrl };
    }
    if (local && isLocalPendingStatus(local.status)) {
      // Pending charge exists but URL missing/invalid — never create another.
      return null;
    }

    const result = await createAppSubscription(admin, returnUrl, "standard");
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
      });
      clearBillingCaches({ id: latest.id, domain: shopDomain });
    }

    return { confirmationUrl: result.confirmationUrl };
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
  return withBillingLock(shopId, async () => {
    // B-1: query Shopify before any appSubscriptionCreate.
    const shopifySubs = await fetchActiveSubscriptions(admin);
    const decision = decideChargeFromActiveSubscriptions(shopifySubs, planKey);

    if (decision.action === "stop_same_plan") {
      await syncActiveSubscriptionsUnlocked(admin, shopId, shopifySubs);
      return { kind: "already_active" };
    }

    const hasActivePaid = decision.action === "replace_other_plan";
    // replace_other_plan: fall through to createAppSubscription (STANDARD replacement).

    const local = await prisma.subscription.findUnique({
      where: { shopId },
    });
    if (
      !hasActivePaid &&
      local &&
      isLocalPendingStatus(local.status) &&
      local.confirmationUrl &&
      isAllowedShopifyConfirmationUrl(local.confirmationUrl)
    ) {
      return { kind: "pending", confirmationUrl: local.confirmationUrl };
    }
    if (!hasActivePaid && local && isLocalPendingStatus(local.status)) {
      return {
        kind: "error",
        error:
          "A subscription approval is already pending. Finish or cancel it in Shopify Billing, then try again.",
      };
    }

    const result = await createAppSubscription(admin, returnUrl, planKey);
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
        test: isBillingTestMode(),
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
  prefetched?: ShopifyActiveSubscription[],
) {
  const subs =
    prefetched ?? (await fetchActiveSubscriptions(admin));
  const active = subs[0];
  const domain = await loadShopDomain(shopId);

  if (!active) {
    await prisma.subscription.upsert({
      where: { shopId },
      create: {
        shopId,
        planName: PLANS.free.name,
        status: "CANCELLED",
        test: isBillingTestMode(),
        productLimit: PLANS.free.productLimit,
        filterLimit: PLANS.free.filterLimit,
        confirmationUrl: null,
      },
      update: {
        status: "CANCELLED",
        planName: PLANS.free.name,
        shopifySubscriptionId: null,
        productLimit: PLANS.free.productLimit,
        filterLimit: PLANS.free.filterLimit,
        confirmationUrl: null,
      },
    });
    await prisma.shop.update({
      where: { id: shopId },
      data: { plan: PLANS.free.key },
    });
    if (domain) clearBillingCaches({ id: shopId, domain });
    else planUsageCache.del(shopId);
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
    },
    update: {
      shopifySubscriptionId: active.id,
      planName,
      status: active.status,
      test: Boolean(active.test),
      trialEndsAt,
      productLimit: paidPlan.productLimit,
      filterLimit: paidPlan.filterLimit,
      ...(clearPendingUrl ? { confirmationUrl: null } : {}),
    },
  });

  await prisma.shop.update({
    where: { id: shopId },
    data: { plan: isPaid ? paidKey : PLANS.free.key },
  });

  if (domain) clearBillingCaches({ id: shopId, domain });
  else planUsageCache.del(shopId);
  return subscription;
}

export async function syncActiveSubscriptions(
  admin: GraphqlAdmin,
  shopId: string,
) {
  return withBillingLock(shopId, () =>
    syncActiveSubscriptionsUnlocked(admin, shopId),
  );
}

/** Reset local billing to Free (same shape as a fresh install / cancelled sync). */
export async function applyLocalFreePlan(shopId: string) {
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
    },
    update: {
      status: "CANCELLED",
      planName: PLANS.free.name,
      shopifySubscriptionId: null,
      productLimit: PLANS.free.productLimit,
      filterLimit: PLANS.free.filterLimit,
      trialEndsAt: null,
      confirmationUrl: null,
    },
  });
  await prisma.shop.update({
    where: { id: shopId },
    data: { plan: PLANS.free.key },
  });
  const domain = await loadShopDomain(shopId);
  if (domain) clearBillingCaches({ id: shopId, domain });
  else planUsageCache.del(shopId);
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
      await applyLocalFreePlan(shopId);
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

    await applyLocalFreePlan(shopId);
    // Re-read Shopify so a failed cancel that still left an active sub is corrected.
    await syncActiveSubscriptionsUnlocked(admin, shopId);
    return { ok: true };
  });
}
