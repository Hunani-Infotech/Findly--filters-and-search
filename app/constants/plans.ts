/**
 * Plan catalog shared by admin UI and billing.
 * Keep this file free of `.server` imports so route components can use it.
 *
 * Plan key `free` is the unpaid catalog tier. Its subscription/catalog name
 * stays "Development" for Shopify partner development stores only — never show
 * that label for live unpaid shops (use `planDisplayName` instead).
 */
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

/** Merchant-facing label when a live shop has no paid subscription. */
export const LIVE_UNPAID_PLAN_LABEL = "No paid plan";

export type PlanKey = keyof typeof PLANS;
export type PaidPlanKey = Exclude<PlanKey, "free">;

export function isPaidPlanKey(key: string): key is PaidPlanKey {
  return key === "standard" || key === "pro";
}

/**
 * Display name for admin UI.
 * "Development" only when Shopify `shop.plan.partnerDevelopment` is true
 * (or local DEV_UNLOCK_LIMITS treats the host as unlocked free).
 * Live unpaid shops must not see "Development".
 */
export function planDisplayName(
  planKey: PlanKey | string,
  options?: { partnerDevelopment?: boolean; unlocked?: boolean },
): string {
  const key = (planKey in PLANS ? planKey : "free") as PlanKey;
  if (key === "free") {
    if (options?.partnerDevelopment || options?.unlocked) {
      return PLANS.free.name;
    }
    return LIVE_UNPAID_PLAN_LABEL;
  }
  return PLANS[key].name;
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
