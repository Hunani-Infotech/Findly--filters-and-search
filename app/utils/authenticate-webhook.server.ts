import { authenticate } from "../shopify.server";
import { log } from "../lib/log.server";
import {
  authenticateWebhookHmacOnly,
  isLikelyTokenRefreshFailure,
  readWebhookHeaders,
} from "./webhook-hmac.server";

export {
  authenticateWebhookHmacOnly,
  isLikelyTokenRefreshFailure,
  readWebhookHeaders,
  verifyShopifyWebhookHmac,
} from "./webhook-hmac.server";

/**
 * Safe webhook auth for `expiringOfflineAccessTokens: true`.
 *
 * `@shopify/shopify-app-react-router` ≤1.2.1 can throw 500 from
 * `authenticate.webhook()` after HMAC succeeds when offline-token refresh
 * fails (revoked on uninstall). Fall back to HMAC-only context (no
 * session/admin) so compliance and catalog handlers can still ack.
 *
 * Invalid HMAC still returns 401. Method / malformed requests still 405 / 400.
 */

export type SafeWebhookContext = {
  shop: string;
  topic: string;
  webhookId: string;
  apiVersion: string;
  payload: Record<string, unknown>;
  session: Awaited<ReturnType<typeof authenticate.webhook>>["session"];
  admin: Awaited<ReturnType<typeof authenticate.webhook>>["admin"];
  /** True when library refresh failed and we authenticated via HMAC only. */
  usedHmacFallback: boolean;
};

function isWebhookAuthRejection(error: unknown): error is Response {
  return (
    error instanceof Response &&
    (error.status === 401 || error.status === 400 || error.status === 405)
  );
}

/**
 * Prefer library `authenticate.webhook` (HMAC + optional offline session).
 * If token refresh fails after a valid HMAC, continue without session/admin.
 */
export async function authenticateWebhookSafe(
  request: Request,
): Promise<SafeWebhookContext> {
  const fallbackRequest = request.clone();

  try {
    const ctx = await authenticate.webhook(request);
    return {
      shop: ctx.shop,
      topic: String(ctx.topic || ""),
      webhookId: ctx.webhookId,
      apiVersion: ctx.apiVersion,
      payload: (ctx.payload || {}) as Record<string, unknown>,
      session: ctx.session,
      admin: ctx.admin,
      usedHmacFallback: false,
    };
  } catch (error) {
    if (isWebhookAuthRejection(error)) {
      throw error;
    }

    if (!isLikelyTokenRefreshFailure(error)) {
      throw error;
    }

    const headers = readWebhookHeaders(fallbackRequest.headers);
    log.warn(
      `[webhook-auth] offline token refresh failed after HMAC; continuing without session shop=${headers.shop || "?"} topic=${headers.topic || "?"} webhookId=${headers.webhookId || "?"}`,
    );

    return authenticateWebhookHmacOnly(fallbackRequest);
  }
}
