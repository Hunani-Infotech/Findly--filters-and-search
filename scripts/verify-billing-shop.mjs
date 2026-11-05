/**
 * Compare local Subscription mirror vs Shopify activeSubscriptions for one shop.
 *
 * Usage:
 *   node ./scripts/verify-billing-shop.mjs <shop.myshopify.com>
 *
 * Uses the stored offline Session token. If the app is uninstalled / token
 * revoked, GraphQL fails gracefully and only the DB row is reported.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createPrismaClient } from "./prisma-runtime.mjs";
import { log } from "./terminal-log.mjs";

const API_VERSION = "2026-07";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function loadDotEnv() {
  try {
    const raw = readFileSync(join(ROOT, ".env"), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = value;
    }
  } catch {
    /* DATABASE_URL may already be in the environment */
  }
}

const ACTIVE_SUBSCRIPTIONS_QUERY = `query ActiveSubscriptions {
  currentAppInstallation {
    activeSubscriptions {
      id
      name
      status
      createdAt
      currentPeriodEnd
      test
    }
  }
}`;

loadDotEnv();

/**
 * Static uninstall / DECLINED / reinstall guards (no Shopify / DB needed).
 * Usage: node ./scripts/verify-billing-shop.mjs --static
 */
function runStaticUninstallDeclinedReinstallChecks() {
  function fail(message) {
    throw new Error(message);
  }
  function read(rel) {
    return readFileSync(join(ROOT, rel), "utf8");
  }
  const billing = read("app/services/billing.server.ts");
  const shopServer = read("app/services/shop.server.ts");
  const processors = read("app/workers/processors.ts");
  const compliance = read("app/services/compliance.server.ts");
  const webhook = read("app/routes/webhooks.app_subscriptions.update.tsx");

  if (!webhook.includes("mirrorAppSubscriptionWebhook")) {
    fail("subscription webhook must call mirrorAppSubscriptionWebhook");
  }
  if (!billing.includes('status === "DECLINED"')) {
    fail("mirror must handle DECLINED");
  }
  if (
    !compliance.includes("cancelShopifySubscriptionsBestEffortOnUninstall") ||
    !compliance.includes("applyLocalFreePlan")
  ) {
    fail("uninstall must applyLocalFreePlan and attempt Shopify cancel");
  }
  const markStart = compliance.indexOf("export async function markShopUninstalled");
  const markBody = compliance.slice(markStart, markStart + 3500);
  const freeIdx = markBody.indexOf("applyLocalFreePlan");
  const cancelIdx = markBody.lastIndexOf(
    "cancelShopifySubscriptionsBestEffortOnUninstall",
  );
  if (freeIdx === -1 || cancelIdx === -1 || !(freeIdx < cancelIdx)) {
    fail("uninstall must applyLocalFreePlan before capped Shopify cancel");
  }
  if (!markBody.includes("timeoutMs")) {
    fail("uninstall Shopify cancel must pass timeoutMs");
  }
  if (
    !shopServer.includes("clearUninstalled") ||
    !shopServer.includes("isOnline: false")
  ) {
    fail("ensureShop must gate uninstalledAt clear on offline session");
  }
  if (
    !billing.includes("clearUninstalled") ||
    !/getOrCreateShop[\s\S]{0,500}clearUninstalled/.test(billing)
  ) {
    fail("getOrCreateShop must gate uninstalledAt clear on offline session");
  }
  if (
    !processors.includes("shop marked uninstalled") ||
    !processors.includes("syncFromShopify skipped")
  ) {
    fail("syncFromShopify must skip when shop.uninstalledAt is set");
  }
  const freePlan = billing.slice(
    billing.indexOf("export async function applyLocalFreePlan"),
  );
  const freeBody = freePlan.slice(0, freePlan.indexOf("\nexport "));
  if (
    !freeBody.includes("shopifySubscriptionId: null") ||
    !freeBody.includes("confirmationUrl: null") ||
    !freeBody.includes('status: "CANCELLED"')
  ) {
    fail(
      "applyLocalFreePlan must clear cancelled charge ids so reinstall cannot reuse them",
    );
  }
  log.success(
    "VERIFY_BILLING_SHOP_STATIC_OK uninstall/DECLINED/reinstall markers present",
  );
}

const arg2 = String(process.argv[2] || "").trim();
if (arg2 === "--static") {
  try {
    runStaticUninstallDeclinedReinstallChecks();
  } catch (error) {
    log.error(
      `VERIFY_BILLING_SHOP_STATIC_FAIL ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    process.exitCode = 1;
  }
  process.exit(process.exitCode || 0);
}

const shopDomain = arg2
  .toLowerCase()
  .replace(/^https?:\/\//, "")
  .split("/")[0];

if (!shopDomain || !shopDomain.includes(".")) {
  log.error(
    "Usage: node ./scripts/verify-billing-shop.mjs <shop.myshopify.com>\n" +
      "       node ./scripts/verify-billing-shop.mjs --static",
  );
  process.exit(1);
}

const prisma = createPrismaClient();

try {
  const shop = await prisma.shop.findUnique({
    where: { domain: shopDomain },
    include: { subscription: true },
  });

  if (!shop) {
    log.warn(`[db] no Shop row for ${shopDomain}`);
  } else {
    log.info(
      `[db] shop=${shop.domain} plan=${shop.plan} uninstalledAt=${
        shop.uninstalledAt ? shop.uninstalledAt.toISOString() : "null"
      } partnerDevelopment=${shop.partnerDevelopment}`,
    );
    const sub = shop.subscription;
    if (!sub) {
      log.info("[db] subscription=none");
    } else {
      log.info(
        `[db] subscription status=${sub.status} planName=${sub.planName} shopifySubscriptionId=${
          sub.shopifySubscriptionId ?? "none"
        } test=${sub.test} confirmationUrl=${sub.confirmationUrl ? "set" : "null"} trialEndsAt=${
          sub.trialEndsAt ? sub.trialEndsAt.toISOString() : "null"
        } updatedAt=${sub.updatedAt.toISOString()}`,
      );
    }
  }

  const session = await prisma.session.findFirst({
    where: { shop: shopDomain, isOnline: false },
    select: { accessToken: true, scope: true },
  });

  if (!session?.accessToken) {
    log.warn(
      `[shopify] no offline Session for ${shopDomain} — token revoked or app uninstalled; cannot query activeSubscriptions`,
    );
    log.success(
      "VERIFY_BILLING_SHOP_OK (db-only; Shopify query skipped — expected after uninstall)",
    );
    process.exit(0);
  }

  log.info(
    `[shopify] offline Session present scope=${session.scope || "(none)"}; querying activeSubscriptions`,
  );

  const response = await fetch(
    `https://${shopDomain}/admin/api/${API_VERSION}/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": session.accessToken,
      },
      body: JSON.stringify({ query: ACTIVE_SUBSCRIPTIONS_QUERY }),
    },
  );

  const json = await response.json();
  if (!response.ok || json.errors?.length) {
    const msg =
      json.errors?.map((e) => e.message || "error").join("; ") ||
      `HTTP ${response.status}`;
    log.warn(
      `[shopify] activeSubscriptions query failed for ${shopDomain}: ${msg}`,
    );
    log.success(
      "VERIFY_BILLING_SHOP_OK (db logged; Shopify query failed — often means uninstalled/revoked token)",
    );
    process.exit(0);
  }

  const subs =
    json.data?.currentAppInstallation?.activeSubscriptions ?? [];
  if (!subs.length) {
    log.info("[shopify] activeSubscriptions=[] (none)");
  } else {
    for (const sub of subs) {
      log.info(
        `[shopify] active id=${sub.id} name=${sub.name} status=${sub.status} createdAt=${sub.createdAt} currentPeriodEnd=${
          sub.currentPeriodEnd ?? "null"
        } test=${sub.test}`,
      );
    }
  }

  const localStatus = String(shop?.subscription?.status || "").toUpperCase();
  const shopifyActive = subs.some(
    (s) => String(s.status || "").toUpperCase() === "ACTIVE",
  );
  if (shop?.uninstalledAt && shopifyActive) {
    log.warn(
      "[audit] Shop marked uninstalled locally but Shopify still reports an ACTIVE app subscription",
    );
  }
  if (
    localStatus === "PENDING" ||
    localStatus === "ACCEPTED" ||
    localStatus === "CANCELLED" ||
    localStatus === "DECLINED" ||
    localStatus === "EXPIRED" ||
    localStatus === "FROZEN"
  ) {
    if (shopifyActive) {
      log.warn(
        `[audit] local status=${localStatus} but Shopify still has ACTIVE — run sync or check Partner Dashboard`,
      );
    }
  }

  log.success(`VERIFY_BILLING_SHOP_OK shop=${shopDomain}`);
  process.exit(0);
} catch (error) {
  log.error(
    `VERIFY_BILLING_SHOP_FAIL ${error instanceof Error ? error.message : String(error)}`,
  );
  if (error instanceof Error && error.stack) console.error(error.stack);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
