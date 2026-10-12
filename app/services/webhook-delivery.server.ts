import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import prisma from "../db.server";
import { log } from "../lib/log.server";

/** Trimmed X-Shopify-Webhook-Id (empty string when missing). */
export function shopifyWebhookId(request: Request): string {
  return (request.headers.get("x-shopify-webhook-id") ?? "").trim().slice(0, 128);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

/**
 * Stable identity when X-Shopify-Webhook-Id is absent.
 * Never use randomUUID — that would break dedupe on retries.
 */
export function stableSubscriptionWebhookFallbackId(
  topic: string,
  shopDomain: string,
  payload: unknown,
): string {
  const body = asRecord(payload);
  const sub = asRecord(body?.app_subscription) ?? body;
  const gqlId =
    typeof sub?.admin_graphql_api_id === "string"
      ? sub.admin_graphql_api_id.trim()
      : "";
  const status =
    typeof sub?.status === "string" ? sub.status.trim().toUpperCase() : "";
  const material = `${topic}:${shopDomain}:${gqlId}:${status}`;
  return createHash("sha256").update(material).digest("hex");
}

export function resolveWebhookDeliveryId(opts: {
  request: Request;
  topic: string;
  shopDomain: string;
  payload: unknown;
}): string {
  const headerId = shopifyWebhookId(opts.request);
  if (headerId) return headerId;
  return stableSubscriptionWebhookFallbackId(
    opts.topic,
    opts.shopDomain,
    opts.payload,
  );
}

/**
 * Stable identity when X-Shopify-Webhook-Id is absent on customers/redact.
 * Never use randomUUID — that would break dedupe on retries.
 */
export function stableCustomersRedactWebhookFallbackId(
  topic: string,
  shopDomain: string,
  payload: unknown,
): string {
  const customer = asRecord(asRecord(payload)?.customer);
  const rawId = customer?.id;
  const idStr =
    typeof rawId === "number" || typeof rawId === "string"
      ? String(rawId).trim()
      : "";
  return createHash("sha256")
    .update(`${topic}:${shopDomain}:${idStr}`)
    .digest("hex");
}

export function resolveCustomersRedactWebhookId(opts: {
  request: Request;
  topic: string;
  shopDomain: string;
  payload: unknown;
}): string {
  const headerId = shopifyWebhookId(opts.request);
  if (headerId) return headerId;
  return stableCustomersRedactWebhookFallbackId(
    opts.topic,
    opts.shopDomain,
    opts.payload,
  );
}

/**
 * Insert a delivery row. Unique on webhookId → duplicate deliveries are skipped.
 */
export async function tryRecordWebhookDelivery(opts: {
  webhookId: string;
  shopDomain: string;
  topic: string;
}): Promise<"new" | "duplicate"> {
  const webhookId = opts.webhookId.trim().slice(0, 128);
  if (!webhookId) {
    log.warn(
      `[webhook-delivery] empty webhookId for ${opts.topic} ${opts.shopDomain}; treating as new without dedupe row`,
    );
    return "new";
  }

  try {
    await prisma.webhookDelivery.create({
      data: {
        webhookId,
        shopDomain: opts.shopDomain,
        topic: opts.topic,
      },
    });
    return "new";
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return "duplicate";
    }
    throw error;
  }
}
