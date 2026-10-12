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

function hashWebhookFallback(material: string): string {
  return createHash("sha256").update(material).digest("hex");
}

function stringField(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function resourceGidFromPayload(
  payload: unknown,
  resource: "Product" | "Collection",
): string {
  const body = asRecord(payload);
  if (!body) return "";
  const gid = stringField(body.admin_graphql_api_id);
  if (gid.startsWith("gid://")) return gid;
  const id = stringField(body.id);
  if (id.startsWith("gid://")) return id;
  if (id) return `gid://shopify/${resource}/${id}`;
  return "";
}

function catalogResourceKey(topic: string, payload: unknown): string {
  const normalized = topic.toUpperCase().replace(/\//g, "_");
  const body = asRecord(payload) ?? {};
  const updatedAt = stringField(body.updated_at);

  if (normalized.startsWith("PRODUCTS_")) {
    const gid = resourceGidFromPayload(payload, "Product");
    return updatedAt ? `${gid}:${updatedAt}` : gid;
  }
  if (normalized.startsWith("COLLECTIONS_")) {
    const gid = resourceGidFromPayload(payload, "Collection");
    return updatedAt ? `${gid}:${updatedAt}` : gid;
  }
  if (normalized === "INVENTORY_LEVELS_UPDATE") {
    const nested = asRecord(body.inventory_level) ?? body;
    const levelGid = stringField(
      nested.admin_graphql_api_id ?? body.admin_graphql_api_id,
    );
    if (levelGid) return updatedAt ? `${levelGid}:${updatedAt}` : levelGid;
    const itemId = stringField(
      nested.inventory_item_id ?? body.inventory_item_id,
    );
    const locationId = stringField(nested.location_id ?? body.location_id);
    const key = `${itemId}:${locationId}`;
    return updatedAt ? `${key}:${updatedAt}` : key;
  }
  if (normalized === "BULK_OPERATIONS_FINISH") {
    return (
      stringField(body.admin_graphql_api_id) ||
      stringField(body.id)
    );
  }
  if (normalized.startsWith("METAFIELDS_")) {
    const gid =
      stringField(body.admin_graphql_api_id) ||
      (stringField(body.id)
        ? `gid://shopify/Metafield/${stringField(body.id)}`
        : "");
    return updatedAt ? `${gid}:${updatedAt}` : gid;
  }

  const fallback =
    stringField(body.admin_graphql_api_id) || stringField(body.id);
  return updatedAt ? `${fallback}:${updatedAt}` : fallback;
}

/** Shop-scoped topics (uninstall / shop/redact) when header is absent. */
export function stableShopScopedWebhookFallbackId(
  topic: string,
  shopDomain: string,
): string {
  return hashWebhookFallback(`${topic}:${shopDomain}`);
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
  return hashWebhookFallback(`${topic}:${shopDomain}:${gqlId}:${status}`);
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
  return hashWebhookFallback(`${topic}:${shopDomain}:${idStr}`);
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

export function stableCatalogWebhookFallbackId(
  topic: string,
  shopDomain: string,
  payload: unknown,
): string {
  const resourceKey = catalogResourceKey(topic, payload);
  return hashWebhookFallback(`${topic}:${shopDomain}:${resourceKey}`);
}

export function resolveCatalogWebhookDeliveryId(opts: {
  request: Request;
  topic: string;
  shopDomain: string;
  payload: unknown;
}): string {
  const headerId = shopifyWebhookId(opts.request);
  if (headerId) return headerId;
  return stableCatalogWebhookFallbackId(
    opts.topic,
    opts.shopDomain,
    opts.payload,
  );
}

export function stableScopesUpdateWebhookFallbackId(
  topic: string,
  shopDomain: string,
  payload: unknown,
): string {
  const body = asRecord(payload);
  const updatedAt = stringField(body?.updated_at);
  const current = Array.isArray(body?.current)
    ? [...body.current].map(String).sort().join(",")
    : "";
  const previous = Array.isArray(body?.previous)
    ? [...body.previous].map(String).sort().join(",")
    : "";
  return hashWebhookFallback(
    `${topic}:${shopDomain}:${previous}:${current}:${updatedAt}`,
  );
}

export function resolveScopesUpdateWebhookId(opts: {
  request: Request;
  topic: string;
  shopDomain: string;
  payload: unknown;
}): string {
  const headerId = shopifyWebhookId(opts.request);
  if (headerId) return headerId;
  return stableScopesUpdateWebhookFallbackId(
    opts.topic,
    opts.shopDomain,
    opts.payload,
  );
}

/** Header or sha256(topic:shop) — used by app/uninstalled and shop/redact. */
export function resolveShopScopedWebhookId(opts: {
  request: Request;
  topic: string;
  shopDomain: string;
}): string {
  const headerId = shopifyWebhookId(opts.request);
  if (headerId) return headerId;
  return stableShopScopedWebhookFallbackId(opts.topic, opts.shopDomain);
}

export function stableCustomersDataRequestWebhookFallbackId(
  topic: string,
  shopDomain: string,
  payload: unknown,
): string {
  const body = asRecord(payload);
  const dataRequest = asRecord(body?.data_request);
  const dataRequestId = stringField(dataRequest?.id);
  if (dataRequestId) {
    return hashWebhookFallback(`${topic}:${shopDomain}:${dataRequestId}`);
  }
  const customer = asRecord(body?.customer);
  const customerId = stringField(customer?.id);
  return hashWebhookFallback(`${topic}:${shopDomain}:${customerId}`);
}

export function resolveCustomersDataRequestWebhookId(opts: {
  request: Request;
  topic: string;
  shopDomain: string;
  payload: unknown;
}): string {
  const headerId = shopifyWebhookId(opts.request);
  if (headerId) return headerId;
  return stableCustomersDataRequestWebhookFallbackId(
    opts.topic,
    opts.shopDomain,
    opts.payload,
  );
}

/** True when this Shopify delivery id was already accepted (durable enqueue succeeded). */
export async function webhookDeliveryExists(webhookId: string): Promise<boolean> {
  const id = webhookId.trim().slice(0, 128);
  if (!id) return false;
  const row = await prisma.webhookDelivery.findUnique({
    where: { webhookId: id },
    select: { webhookId: true },
  });
  return Boolean(row);
}

/**
 * Insert a delivery row. Unique on webhookId → duplicate deliveries are skipped.
 * Call only after durable enqueue succeeds so a 5xx retry is not swallowed.
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
