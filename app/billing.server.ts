import prisma from "./db.server";
import { findShopByIdCached, findShopCached, rememberShop } from "./shop-cache.server";
import { createTtlCache } from "./read-cache.server";

export const PLANS = {
  free: {
    key: "free",
    name: "Free",
    amount: 0,
    currencyCode: "USD",
    interval: "EVERY_30_DAYS" as const,
    productLimit: 200,
    filterLimit: 5,
    trialDays: 0,
  },
  standard: {
    key: "standard",
    name: "Findly Standard",
    amount: 9.99,
    currencyCode: "USD",
    interval: "EVERY_30_DAYS" as const,
    productLimit: 1000,
    filterLimit: 12,
    trialDays: 7,
  },
  pro: {
    key: "pro",
    name: "Findly Pro",
    amount: 19.99,
    currencyCode: "USD",
    interval: "EVERY_30_DAYS" as const,
    productLimit: 5000,
    filterLimit: 25,
    trialDays: 7,
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
  return (process.env.BILLING_TEST_MODE ?? "true").toLowerCase() === "true";
}

/** Local/dev only: Free plan uses Pro product/filter caps without a paid subscription. */
export function isDevUnlockLimits() {
  return (process.env.DEV_UNLOCK_LIMITS ?? "false").toLowerCase() === "true";
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
  const unlocked = isDevUnlockLimits();
  const plan = unlocked ? PLANS.pro : PLANS[planKey];
  const productLimit = unlocked
    ? PLANS.pro.productLimit
    : planKey !== "free" && shop.subscription?.productLimit
      ? shop.subscription.productLimit
      : plan.productLimit;
  const filterLimit = unlocked
    ? PLANS.pro.filterLimit
    : planKey !== "free" && shop.subscription?.filterLimit
      ? shop.subscription.filterLimit
      : plan.filterLimit;
  return { plan: planKey, filterLimit, productLimit };
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
  const unlocked = isDevUnlockLimits();
  const plan = unlocked ? PLANS.pro : PLANS[planKey];
  const productLimit = unlocked
    ? PLANS.pro.productLimit
    : planKey !== "free" && shop.subscription?.productLimit
      ? shop.subscription.productLimit
      : plan.productLimit;
  const filterLimit = unlocked
    ? PLANS.pro.filterLimit
    : planKey !== "free" && shop.subscription?.filterLimit
      ? shop.subscription.filterLimit
      : plan.filterLimit;

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
 * Free plan always has access; paid Standard/Pro unlock higher limits.
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

  return subscription;
}
