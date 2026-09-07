import prisma from "../db.server";
import { findShopByIdCached, findShopCached, rememberShop } from "../lib/shop-cache.server";
import { createTtlCache } from "../lib/read-cache.server";

export const PLANS = {
  free: {
    key: "free",
    name: "Development",
    amount: 0,
    currencyCode: "USD",
    interval: "EVERY_30_DAYS" as const,
    productLimit: 0,
    filterLimit: 0,
    trialDays: 0,
  },
  standard: {
    key: "standard",
    name: "Findly Standard",
    amount: 11.99,
    currencyCode: "USD",
    interval: "EVERY_30_DAYS" as const,
    productLimit: 200,
    filterLimit: 6,
    trialDays: 0,
  },
  pro: {
    key: "pro",
    name: "Findly Pro",
    amount: 19.99,
    currencyCode: "USD",
    interval: "EVERY_30_DAYS" as const,
    productLimit: 1000,
    filterLimit: 15,
    trialDays: 0,
  },
} as const;

export type PlanKey = keyof typeof PLANS;
export type PaidPlanKey = Exclude<PlanKey, "free">;

export function isPaidPlanKey(key: string): key is PaidPlanKey {
  return key === "standard" || key === "pro";
}

/** Map a Shopify subscription name to a plan key (legacy "Findly Pro" still counts as Pro). */
export function planKeyFromName(name: string | null | undefined): PlanKey {
  const normalized = (name ?? "").trim().toLowerCase();
  if (!normalized) return "free";
  for (const key of Object.keys(PLANS) as PlanKey[]) {
    const plan = PLANS[key];
    if (plan.name.toLowerCase() === normalized || plan.key === normalized) {
      return key;
    }
  }
  if (normalized.includes("standard")) return "standard";
  if (normalized === "free" || normalized.includes("development")) {
    return "free";
  }
  if (
    normalized === "professional" ||
    normalized.includes("findly pro") ||
    /\bpro\b/.test(normalized)
  ) {
    return "pro";
  }
  return "free";
}

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

/**
 * Development always has access; paid Standard/Pro unlock live catalog limits.
 * App use is never hard-blocked for billing — limits are enforced elsewhere.
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

type GraphqlAdmin = {
  graphql: (
    query: string,
    options?: { variables?: Record<string, unknown> },
  ) => Promise<Response>;
};

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
    planUsageCache.del(shopId);
    return partnerDevelopment;
  } catch {
    return null;
  }
}

/**
 * Live shops must start Standard immediately (no trial). Development stores stay free.
 * Returns a Shopify confirmation URL once; PENDING shops are not billed again here.
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
  if (latest.partnerDevelopment || isDevUnlockLimits()) return null;
  if (hasActivePaidSubscription(latest.subscription)) return null;
  const status = (latest.subscription?.status ?? "").toUpperCase();
  if (status === "PENDING" || status === "ACCEPTED") return null;

  const plan = PLANS.standard;
  const result = await createAppSubscription(admin, returnUrl, "standard");
  const errors = result?.userErrors ?? [];
  if (errors.length || !result?.confirmationUrl) return null;
  if (!isAllowedShopifyConfirmationUrl(result.confirmationUrl)) return null;

  if (result.appSubscription?.id) {
    await prisma.subscription.upsert({
      where: { shopId: latest.id },
      create: {
        shopId: latest.id,
        shopifySubscriptionId: result.appSubscription.id,
        planName: plan.name,
        status: result.appSubscription.status || "PENDING",
        test: isBillingTestMode(),
        productLimit: plan.productLimit,
        filterLimit: plan.filterLimit,
      },
      update: {
        shopifySubscriptionId: result.appSubscription.id,
        planName: plan.name,
        status: result.appSubscription.status || "PENDING",
        test: isBillingTestMode(),
        productLimit: plan.productLimit,
        filterLimit: plan.filterLimit,
      },
    });
    await prisma.shop.update({
      where: { id: latest.id },
      data: { plan: plan.key },
    });
    planUsageCache.del(latest.id);
  }

  return { confirmationUrl: result.confirmationUrl };
}

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

export async function syncActiveSubscriptions(
  admin: GraphqlAdmin,
  shopId: string,
) {
  const response = await admin.graphql(
    `#graphql
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
    }`,
  );
  const json = await response.json();
  const subs = json.data?.currentAppInstallation?.activeSubscriptions ?? [];
  const active = subs[0];

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
      },
      update: {
        status: "CANCELLED",
        planName: PLANS.free.name,
        shopifySubscriptionId: null,
        productLimit: PLANS.free.productLimit,
        filterLimit: PLANS.free.filterLimit,
      },
    });
    await prisma.shop.update({
      where: { id: shopId },
      data: { plan: PLANS.free.key },
    });
    planUsageCache.del(shopId);
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
  const resolvedKey = planKeyFromName(planName);
  const paidKey: PaidPlanKey = resolvedKey === "free" ? "pro" : resolvedKey;
  const paidPlan = PLANS[paidKey];
  const status = String(active.status || "").toUpperCase();
  const isPaid =
    status === "ACTIVE" ||
    status === "TRIAL" ||
    (trialEndsAt != null && trialEndsAt > new Date());

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
    },
    update: {
      shopifySubscriptionId: active.id,
      planName,
      status: active.status,
      test: Boolean(active.test),
      trialEndsAt,
      productLimit: paidPlan.productLimit,
      filterLimit: paidPlan.filterLimit,
    },
  });

  await prisma.shop.update({
    where: { id: shopId },
    data: { plan: isPaid ? paidKey : PLANS.free.key },
  });

  planUsageCache.del(shopId);
  return subscription;
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
    },
    update: {
      status: "CANCELLED",
      planName: PLANS.free.name,
      shopifySubscriptionId: null,
      productLimit: PLANS.free.productLimit,
      filterLimit: PLANS.free.filterLimit,
      trialEndsAt: null,
    },
  });
  await prisma.shop.update({
    where: { id: shopId },
    data: { plan: PLANS.free.key },
  });
  planUsageCache.del(shopId);
}

/**
 * Cancel an active Shopify app subscription (paid → Free).
 * Does not use replacementBehavior — that is only for paid ↔ paid switches.
 */
export async function cancelSubscription(
  admin: GraphqlAdmin,
  shopId: string,
  subscriptionGid: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
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
        json.errors.map((e: { message?: string }) => e.message || "GraphQL error").join("; ") ||
        "Could not cancel subscription",
    };
  }

  await applyLocalFreePlan(shopId);
  // Re-read Shopify so a failed cancel that still left an active sub is corrected.
  await syncActiveSubscriptions(admin, shopId);
  return { ok: true };
}
