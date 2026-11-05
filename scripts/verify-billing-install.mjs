/**
 * INSTALL duplicate-charge fix gate (T1/T3-style static review).
 * Proves billing lock, pre-create Shopify check, PENDING reuse, B-9 banner,
 * cache clear, empty-list PENDING preserve, webhook enqueue-only, Pricing already_active.
 * Usage: npm run verify:billing-install
 *
 * Static file greps only — no Prisma / Postgres.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { log } from "./terminal-log.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function fail(message) {
  throw new Error(message);
}

function read(relPath) {
  return readFileSync(join(ROOT, relPath), "utf8");
}

/**
 * Slice export function body by name until the next top-level export
 * (or end of file). Good enough for order checks inside one function.
 */
function exportBody(src, fnName) {
  const re = new RegExp(
    `export\\s+async\\s+function\\s+${fnName}\\s*\\(`,
  );
  const m = re.exec(src);
  if (!m) fail(`billing.server.ts missing export async function ${fnName}`);
  const start = m.index;
  const nextExport = src.indexOf("\nexport ", start + m[0].length);
  return nextExport === -1 ? src.slice(start) : src.slice(start, nextExport);
}

function assertBillingLock(billing) {
  if (!billing.includes("withBillingLock")) {
    fail("billing.server.ts missing withBillingLock");
  }
  if (!billing.includes("pg_advisory_xact_lock")) {
    fail("billing.server.ts missing pg_advisory_xact_lock");
  }
  log.info("1. withBillingLock + pg_advisory_xact_lock present");
}

function assertFetchBeforeCreate(billing) {
  const body = exportBody(billing, "startStandardSubscriptionIfLive");
  const fetchIdx = body.indexOf("fetchActiveSubscriptions");
  const decideIdx = body.indexOf("decideChargeFromActiveSubscriptions");
  const createIdx = body.indexOf("createAppSubscription");
  if (fetchIdx === -1 || decideIdx === -1) {
    fail(
      "startStandardSubscriptionIfLive must call fetchActiveSubscriptions / decideChargeFromActiveSubscriptions",
    );
  }
  if (createIdx === -1) {
    fail("startStandardSubscriptionIfLive must call createAppSubscription");
  }
  if (!(fetchIdx < createIdx && decideIdx < createIdx)) {
    fail(
      "startStandardSubscriptionIfLive must fetch/decide BEFORE createAppSubscription",
    );
  }
  log.info(
    "2. startStandardSubscriptionIfLive fetches/decides before createAppSubscription",
  );
}

function assertPendingReuse(billing) {
  const body = exportBody(billing, "startStandardSubscriptionIfLive");
  const reused =
    body.includes("reused: true") || body.includes("reused:true");
  const urlReuse =
    body.includes("local.confirmationUrl") &&
    body.includes("isLocalPendingStatus");
  if (!reused && !urlReuse) {
    fail(
      "startStandardSubscriptionIfLive must reuse PENDING confirmationUrl (reused: true)",
    );
  }
  log.info("3. PENDING confirmationUrl reuse present");
}

function assertPersistConfirmationUrl(billing) {
  if (!billing.includes("persistPendingSubscription")) {
    fail("billing.server.ts missing persistPendingSubscription");
  }
  const persistMatch = billing.match(
    /(?:async\s+)?function\s+persistPendingSubscription[\s\S]*?(?=\n(?:export\s+)?(?:async\s+)?function\s+\w|\nexport\s+)/,
  );
  const persist = persistMatch?.[0] ?? "";
  if (
    !persist.includes("confirmationUrl") ||
    !persist.includes("subscription.upsert")
  ) {
    fail(
      "persistPendingSubscription upsert must include confirmationUrl",
    );
  }
  log.info("4. persistPendingSubscription upsert stores confirmationUrl");
}

function assertNoAutoRedirectBanner(appTsx) {
  if (
    /auth\.redirect\s*\(/.test(appTsx) ||
    /redirect\s*\(\s*started\.confirmationUrl/.test(appTsx) ||
    /redirect\s*\(\s*kickoffUrl/.test(appTsx)
  ) {
    fail(
      "app.tsx must NOT auto-redirect to confirmationUrl on kickoff (B-9 banner only)",
    );
  }
  if (!appTsx.includes("resolveBillingApproveGate")) {
    fail("app.tsx missing resolveBillingApproveGate (B-9 Approve banner)");
  }
  if (!appTsx.includes("Approve plan")) {
    fail("app.tsx missing Approve plan CTA label");
  }
  if (!appTsx.includes("approve_pending")) {
    fail(
      "app.tsx Approve plan must submit approve_pending so Shopify's redirect leaves the iframe",
    );
  }
  if (/confirmationUrl[\s\S]{0,180}external/.test(appTsx)) {
    fail("app.tsx must not mark the charge URL as external (Polaris forces target=_blank)");
  }
  log.info("5. app.tsx uses B-9 Approve banner (no kickoff redirect)");
}

function assertClearCachesAfterWrite(billing) {
  const body = exportBody(billing, "startStandardSubscriptionIfLive");
  const hasClear =
    body.includes("clearBillingCaches") || body.includes("forgetShop");
  if (!hasClear) {
    fail(
      "startStandardSubscriptionIfLive kickoff path must clearBillingCaches or forgetShop after billing write",
    );
  }
  const persistIdx = body.indexOf("persistPendingSubscription");
  const clearIdx = Math.max(
    body.indexOf("clearBillingCaches"),
    body.indexOf("forgetShop"),
  );
  if (persistIdx !== -1 && clearIdx !== -1 && clearIdx < persistIdx) {
    fail(
      "clearBillingCaches/forgetShop should run after persistPendingSubscription in kickoff path",
    );
  }
  log.info("6. kickoff clears billing caches after write");
}

function assertPendingPreserve(billing) {
  const hasConst = billing.includes("PENDING_CHARGE_PRESERVE");
  const hasLog = /preserve PENDING/i.test(billing);
  if (!hasConst && !hasLog) {
    fail(
      "billing.server.ts must preserve PENDING when activeSubscriptions empty (PENDING_CHARGE_PRESERVE or preserve PENDING)",
    );
  }
  log.info("7. empty activeSubscriptions preserve PENDING");
}

function assertWebhookEnqueueOnly(webhook) {
  if (!webhook.includes("billing.syncFromShopify")) {
    fail(
      "webhooks.app_subscriptions.update.tsx must enqueue billing.syncFromShopify",
    );
  }
  if (!webhook.includes("mirrorAppSubscriptionWebhook")) {
    fail(
      "subscription webhook must mirror terminal statuses via mirrorAppSubscriptionWebhook",
    );
  }
  if (
    /prisma\.subscription\.upsert/.test(webhook) ||
    /subscription\.upsert\s*\(/.test(webhook)
  ) {
    fail(
      "subscription webhook must NOT blind upsert payload status (enqueue sync only)",
    );
  }
  log.info(
    "8. subscription webhook mirrors terminal statuses then enqueues sync",
  );
}

function assertUninstallCancelsBeforeSessionRevoke(compliance) {
  const start = compliance.indexOf(
    "export async function markShopUninstalled",
  );
  if (start === -1) fail("compliance.server.ts missing markShopUninstalled");
  const nextExport = compliance.indexOf("\nexport ", start + 10);
  const body =
    nextExport === -1
      ? compliance.slice(start)
      : compliance.slice(start, nextExport);
  const cancelIdx = body.indexOf(
    "cancelShopifySubscriptionsBestEffortOnUninstall",
  );
  const deleteIdx = body.indexOf("prisma.session.deleteMany");
  if (cancelIdx === -1) {
    fail(
      "markShopUninstalled must call cancelShopifySubscriptionsBestEffortOnUninstall",
    );
  }
  if (deleteIdx === -1) {
    fail("markShopUninstalled must prisma.session.deleteMany");
  }
  if (!(cancelIdx < deleteIdx)) {
    fail(
      "markShopUninstalled must cancel Shopify subscriptions BEFORE prisma.session.deleteMany",
    );
  }
  if (!body.includes("applyLocalFreePlan")) {
    fail("markShopUninstalled must applyLocalFreePlan (local CANCELLED)");
  }
  log.info(
    "8b. uninstall cancels Shopify charge before session revoke + demotes local plan",
  );
}

function assertPendingNeverPaid(billing) {
  const body = billing.slice(
    billing.indexOf("export function hasActivePaidSubscription"),
  );
  const fn = body.slice(0, body.indexOf("\nexport "));
  if (/PENDING[\s\S]{0,120}return true/.test(fn)) {
    fail(
      "hasActivePaidSubscription must never treat PENDING/ACCEPTED as paid",
    );
  }
  if (!fn.includes('status === "ACTIVE"') || !fn.includes('status === "TRIAL"')) {
    fail("hasActivePaidSubscription must allow ACTIVE/TRIAL only");
  }
  log.info("8c. PENDING is never treated as paid access");
}

function assertUninstallDeclinedReinstall(billing, shopServer, processors) {
  if (
    !billing.includes('status === "DECLINED"') ||
    !billing.includes("mirrorAppSubscriptionWebhook")
  ) {
    fail("mirrorAppSubscriptionWebhook must handle DECLINED");
  }
  if (
    !billing.includes("cancelShopifySubscriptionsBestEffortOnUninstall") ||
    !billing.includes("applyLocalFreePlan")
  ) {
    fail("uninstall path must cancel Shopify + applyLocalFreePlan");
  }
  // ensureShop / getOrCreateShop must not blindly clear uninstalledAt.
  if (
    !shopServer.includes("clearUninstalled") ||
    !shopServer.includes("isOnline: false")
  ) {
    fail(
      "ensureShop must only clear uninstalledAt when an offline session proves reinstall",
    );
  }
  if (
    !billing.includes("clearUninstalled") ||
    !/getOrCreateShop[\s\S]{0,500}clearUninstalled/.test(billing)
  ) {
    fail(
      "getOrCreateShop must only clear uninstalledAt when an offline session proves reinstall",
    );
  }
  if (
    !processors.includes("shop marked uninstalled") ||
    !processors.includes("syncFromShopify skipped")
  ) {
    fail(
      "billing.syncFromShopify worker must skip when shop.uninstalledAt is set",
    );
  }
  // Reinstall must not reuse a cancelled subscription id / confirmation URL.
  const freePlan = billing.slice(billing.indexOf("export async function applyLocalFreePlan"));
  const freeBody = freePlan.slice(0, freePlan.indexOf("\nexport "));
  if (
    !freeBody.includes("shopifySubscriptionId: null") ||
    !freeBody.includes("confirmationUrl: null") ||
    !freeBody.includes('status: "CANCELLED"')
  ) {
    fail(
      "applyLocalFreePlan must clear shopifySubscriptionId + confirmationUrl and set CANCELLED",
    );
  }
  log.info(
    "8d. uninstall / DECLINED / reinstall: session-gated uninstalledAt + cleared cancelled charge",
  );
}

function assertDevStoreTestCharge(billing) {
  if (!billing.includes("function subscriptionChargeIsTest")) {
    fail("billing.server.ts missing subscriptionChargeIsTest");
  }
  const fn = billing.slice(billing.indexOf("function subscriptionChargeIsTest"));
  const body = fn.slice(0, fn.indexOf("\n}"));
  if (!body.includes("partnerDevelopment") || !body.includes("isBillingTestMode")) {
    fail(
      "subscriptionChargeIsTest must force test charges on partner development stores",
    );
  }
  const reuse = billing.slice(
    billing.indexOf("export async function startOrReusePaidSubscription"),
  );
  if (!reuse.includes("subscriptionChargeIsTest")) {
    fail("startOrReusePaidSubscription must use subscriptionChargeIsTest");
  }
  log.info("10. development stores create test charges so Cancel can decline them");
}

function assertPricingAlreadyActive(billingPage) {
  if (!billingPage.includes("already_active")) {
    fail("app.billing.tsx missing already_active handling");
  }
  if (!billingPage.includes("Current plan") || !billingPage.includes("disabled")) {
    fail(
      "app.billing.tsx must disable Current plan button (already_active pattern)",
    );
  }
  const approveIdx = billingPage.indexOf('intent === "approve_pending"');
  const createIdx = billingPage.indexOf("await startOrReusePaidSubscription");
  if (approveIdx === -1 || createIdx === -1 || approveIdx > createIdx) {
    fail(
      "approve_pending must redirect the saved charge before startOrReusePaidSubscription",
    );
  }
  if (!billingPage.includes('shopifyRedirect(')) {
    fail(
      "app.billing.tsx must use authenticate.admin redirect for the Shopify charge screen",
    );
  }
  if (/pendingConfirmationUrl[\s\S]{0,250}external/.test(billingPage)) {
    fail(
      "app.billing.tsx must not mark the charge URL as external (Polaris forces target=_blank)",
    );
  }
  log.info("9. Pricing already_active / Current plan disabled");
}

try {
  const billing = read("app/services/billing.server.ts");
  const appTsx = read("app/routes/app.tsx");
  const webhook = read("app/routes/webhooks.app_subscriptions.update.tsx");
  const billingPage = read("app/routes/app.billing.tsx");
  const compliance = read("app/services/compliance.server.ts");
  const shopServer = read("app/services/shop.server.ts");
  const processors = read("app/workers/processors.ts");

  assertBillingLock(billing);
  assertFetchBeforeCreate(billing);
  assertPendingReuse(billing);
  assertPersistConfirmationUrl(billing);
  assertNoAutoRedirectBanner(appTsx);
  assertClearCachesAfterWrite(billing);
  assertPendingPreserve(billing);
  assertWebhookEnqueueOnly(webhook);
  assertUninstallCancelsBeforeSessionRevoke(compliance);
  assertPendingNeverPaid(billing);
  assertUninstallDeclinedReinstall(billing, shopServer, processors);
  assertPricingAlreadyActive(billingPage);
  assertDevStoreTestCharge(billing);

  log.success("VERIFY_BILLING_INSTALL_OK install duplicate-charge fix markers present");
} catch (error) {
  log.error(
    `VERIFY_BILLING_INSTALL_FAIL ${error instanceof Error ? error.message : String(error)}`,
  );
  if (error instanceof Error && error.stack) console.error(error.stack);
  process.exitCode = 1;
}
