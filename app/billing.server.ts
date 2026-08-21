import prisma from "./db.server";

export const PLANS = {
  free: {
    key: "free",
    name: "Free",
    amount: 0,
    productLimit: 200,
    filterLimit: 5,
    trialDays: 0,
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

export function isBillingTestMode() {
  return (process.env.BILLING_TEST_MODE ?? "true").toLowerCase() === "true";
}

/** Local/dev only: Free plan uses Pro product/filter caps without a paid subscription. */
export function isDevUnlockLimits() {
  return (process.env.DEV_UNLOCK_LIMITS ?? "false").toLowerCase() === "true";
}

async function getOrCreateShop(domain: string) {
  return prisma.shop.upsert({
    where: { domain },
    create: { domain, plan: PLANS.free.key },
    update: { uninstalledAt: null },
    include: { subscription: true },
  });
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
  if (hasActivePaidSubscription(shop.subscription ?? null)) {
    return "pro";
  }
  return "free";
}

export async function enforcePlanLimits(shopId: string) {
  const shop = await prisma.shop.findUnique({
    where: { id: shopId },
    include: { subscription: true },
  });
  if (!shop) {
    throw new Error(`Shop not found: ${shopId}`);
  }

  const planKey = getShopPlan(shop);
  const unlocked = isDevUnlockLimits();
  const plan = unlocked ? PLANS.pro : PLANS[planKey];
  const productLimit = unlocked
    ? PLANS.pro.productLimit
    : planKey === "pro" && shop.subscription?.productLimit
      ? shop.subscription.productLimit
      : plan.productLimit;
  const filterLimit = unlocked
    ? PLANS.pro.filterLimit
    : planKey === "pro" && shop.subscription?.filterLimit
      ? shop.subscription.filterLimit
      : plan.filterLimit;

  const [productCount, filterCount] = await Promise.all([
    prisma.productFacet.count({ where: { shopId } }),
    prisma.metafieldMapping.count({ where: { shopId, enabled: true } }),
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

/**
 * Free plan always has access; paid Pro unlocks higher limits.
 * App use is never hard-blocked for billing — limits are enforced elsewhere.
 */
export async function ensureShopAccess(shopDomain: string) {
  const shop = await getOrCreateShop(shopDomain);
  const plan = getShopPlan(shop);

  if (shop.plan !== plan) {
    await prisma.shop.update({
      where: { id: shop.id },
      data: { plan },
    });
    shop.plan = plan;
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
) {
  const plan = PLANS.pro;
  const response = await admin.graphql(
    `#graphql
    mutation AppSubscriptionCreate(
      $name: String!
      $returnUrl: URL!
      $trialDays: Int
      $test: Boolean
      $lineItems: [AppSubscriptionLineItemInput!]!
    ) {
      appSubscriptionCreate(
        name: $name
        returnUrl: $returnUrl
        trialDays: $trialDays
        test: $test
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
      productLimit: PLANS.pro.productLimit,
      filterLimit: PLANS.pro.filterLimit,
    },
    update: {
      shopifySubscriptionId: active.id,
      planName,
      status: active.status,
      test: Boolean(active.test),
      trialEndsAt,
      productLimit: PLANS.pro.productLimit,
      filterLimit: PLANS.pro.filterLimit,
    },
  });

  await prisma.shop.update({
    where: { id: shopId },
    data: { plan: isPaid ? PLANS.pro.key : PLANS.free.key },
  });

  return subscription;
}
