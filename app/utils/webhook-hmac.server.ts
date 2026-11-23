import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Narrow classifier for the known library bug: after a valid HMAC, offline-token
 * refresh fails with Response(500) or InvalidJwtError /
 * HttpResponseError(invalid_subject_token). Arbitrary Errors must NOT match.
 */
export function isLikelyTokenRefreshFailure(error: unknown): boolean {
  // refresh-token.mjs wraps non-revocation refresh failures as Response(500).
  if (error instanceof Response) {
    return error.status === 500;
  }
  if (!error || typeof error !== "object") return false;

  const name = "name" in error ? String((error as { name?: string }).name) : "";
  if (name === "InvalidJwtError") return true;

  // refresh-token.mjs rethrows this specific OAuth error instead of Response(500).
  if (name === "HttpResponseError") {
    const response = (error as { response?: { code?: number; body?: unknown } })
      .response;
    if (response?.code !== 400) return false;
    const body = response.body;
    if (body && typeof body === "object" && "error" in body) {
      return (body as { error?: unknown }).error === "invalid_subject_token";
    }
    return false;
  }

  return false;
}

/** Compare X-Shopify-Hmac-Sha256 to HMAC-SHA256(rawBody, client secret). */
export function verifyShopifyWebhookHmac(
  rawBody: Buffer,
  hmacHeader: string | null | undefined,
  secret: string,
): boolean {
  if (!hmacHeader || !secret) return false;
  const digest = createHmac("sha256", secret).update(rawBody).digest("base64");
  const expected = Buffer.from(digest, "utf8");
  const received = Buffer.from(hmacHeader, "utf8");
  if (expected.length !== received.length) return false;
  return timingSafeEqual(expected, received);
}

export function readWebhookHeaders(headers: Headers): {
  shop: string;
  topic: string;
  webhookId: string;
  apiVersion: string;
} {
  return {
    shop: (headers.get("x-shopify-shop-domain") || "").trim().toLowerCase(),
    topic: (headers.get("x-shopify-topic") || "").trim(),
    webhookId: (headers.get("x-shopify-webhook-id") || "").trim(),
    apiVersion: (headers.get("x-shopify-api-version") || "").trim(),
  };
}

export type HmacOnlyWebhookContext = {
  shop: string;
  topic: string;
  webhookId: string;
  apiVersion: string;
  payload: Record<string, unknown>;
  session: undefined;
  admin: undefined;
  usedHmacFallback: true;
};

/**
 * HMAC-only webhook auth (no offline session / token refresh).
 * Used when library `authenticate.webhook` fails after a valid HMAC
 * because the offline token was revoked (uninstall / redact).
 */
export async function authenticateWebhookHmacOnly(
  request: Request,
  secret = process.env.SHOPIFY_API_SECRET || "",
): Promise<HmacOnlyWebhookContext> {
  if (request.method !== "POST") {
    throw new Response(undefined, {
      status: 405,
      statusText: "Method not allowed",
    });
  }

  const rawBody = Buffer.from(await request.arrayBuffer());
  const hmacHeader = request.headers.get("x-shopify-hmac-sha256");

  if (!verifyShopifyWebhookHmac(rawBody, hmacHeader, secret)) {
    throw new Response(undefined, {
      status: 401,
      statusText: "Unauthorized",
    });
  }

  const { shop, topic, webhookId, apiVersion } = readWebhookHeaders(
    request.headers,
  );
  if (!shop || !topic) {
    throw new Response(undefined, {
      status: 400,
      statusText: "Bad Request",
    });
  }

  let payload: Record<string, unknown> = {};
  if (rawBody.length > 0) {
    try {
      payload = JSON.parse(rawBody.toString("utf8")) as Record<string, unknown>;
    } catch {
      payload = {};
    }
  }

  return {
    shop,
    topic,
    webhookId,
    apiVersion,
    payload,
    session: undefined,
    admin: undefined,
    usedHmacFallback: true,
  };
}
