import "@shopify/shopify-app-react-router/adapters/node";
import {
  ApiVersion,
  AppDistribution,
  LogSeverity,
  shopifyApp,
} from "@shopify/shopify-app-react-router/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import prisma from "./db.server";
import { log } from "./lib/log.server";

function resolveAppUrl() {
  const candidates = [process.env.SHOPIFY_APP_URL, process.env.HOST];
  for (const value of candidates) {
    if (!value) continue;
    const url = value.startsWith("http") ? value : `https://${value}`;
    try {
      const hostname = new URL(url).hostname;
      if (hostname !== "localhost" && hostname !== "127.0.0.1") {
        return url;
      }
    } catch {
      /* ignore invalid */
    }
  }
  return process.env.SHOPIFY_APP_URL || "https://localhost";
}

const appUrl = resolveAppUrl();
log.info(`[shopify] appUrl=${appUrl || "(empty)"}`);

if (process.env.NODE_ENV === "production") {
  if ((process.env.DEV_UNLOCK_LIMITS ?? "").toLowerCase() === "true") {
    log.warn(
      "[security] DEV_UNLOCK_LIMITS=true in production — plan limits are unlocked",
    );
  }
  if ((process.env.BILLING_TEST_MODE ?? "").toLowerCase() === "true") {
    log.warn(
      "[security] BILLING_TEST_MODE=true in production — Shopify charges are test mode",
    );
  }
  if ((process.env.PROXY_SIGNATURE_BYPASS ?? "").toLowerCase() === "true") {
    log.warn(
      "[security] PROXY_SIGNATURE_BYPASS is ignored unless NODE_ENV=development",
    );
  }
}

const apiSecretKey = process.env.SHOPIFY_API_SECRET?.trim() || "";
if (!apiSecretKey) {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "SHOPIFY_API_SECRET is required in production (OAuth, webhooks, App Proxy HMAC).",
    );
  }
  log.warn(
    "[shopify] SHOPIFY_API_SECRET is empty — OAuth, webhooks, and App Proxy HMAC will fail",
  );
}

const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey,
  apiVersion: ApiVersion.July26,
  scopes: process.env.SCOPES?.split(","),
  appUrl,
  authPathPrefix: "/auth",
  sessionStorage: new PrismaSessionStorage(prisma),
  distribution: AppDistribution.AppStore,
  logger: {
    level:
      process.env.NODE_ENV === "production"
        ? LogSeverity.Info
        : LogSeverity.Debug,
    log: (severity, message) => {
      switch (severity) {
        case LogSeverity.Error:
          log.error(message);
          return;
        case LogSeverity.Warning:
          log.warn(message);
          return;
        case LogSeverity.Info:
          if (/\b(valid|authenticated|success|completed)\b/i.test(message)) {
            log.success(message);
            return;
          }
          log.info(message);
          return;
        default:
          log.debug(message);
      }
    },
  },
  future: {
    expiringOfflineAccessTokens: true,
  },
  hooks: {
    afterAuth: async ({ session }) => {
      log.success(
        `[afterAuth] shop=${session.shop} online=${session.isOnline}`,
      );
      const { ensureShop } = await import("./services/shop.server");
      const shop = await ensureShop(session.shop);
      // Audit #11: uninstall→reinstall — diff these two log lines with purge.
      log.info(
        `[afterAuth] billing-audit shop=${session.shop} plan=${shop.plan} subStatus=${shop.subscription?.status ?? "none"} subPlan=${shop.subscription?.planName ?? "none"} shopifySubId=${shop.subscription?.shopifySubscriptionId ?? "none"}`,
      );
      // Queue is Postgres-backed — don't block OAuth if enqueue fails.
      try {
        const { queueFullSync } = await import("./sync/queue-full-sync");
        await queueFullSync(session.shop);
      } catch (error) {
        log.warn(
          `[afterAuth] sync enqueue skipped: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    },
  },
  ...(process.env.SHOP_CUSTOM_DOMAIN
    ? { customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN] }
    : {}),
});

export default shopify;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export { appUrl };
