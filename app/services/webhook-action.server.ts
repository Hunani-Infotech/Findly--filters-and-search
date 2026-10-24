import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { log } from "../lib/log.server";
import { ackWebhookBatch } from "../lib/queues.server";
import { planCatalogWebhookJob } from "./webhooks.server";
import { resolveCatalogWebhookDeliveryId } from "./webhook-delivery.server";

/**
 * HMAC-authenticated adapters shared by catalog webhook routes.
 * A burst shares one QueueJob + WebhookDelivery commit (ackWebhookBatch).
 * 200 only after that commit. A failed commit rejects and Shopify retries.
 * Dedupe is the unique WebhookDelivery row (same rule as tryRecordWebhookDelivery).
 */
export async function catalogWebhookAction({ request }: ActionFunctionArgs) {
  const { shop, topic, payload } = await authenticate.webhook(request);
  const body = payload as Record<string, unknown>;

  const webhookId = resolveCatalogWebhookDeliveryId({
    request,
    topic,
    shopDomain: shop,
    payload: body,
  });

  const plan = planCatalogWebhookJob(shop, topic, body);
  const recorded = await ackWebhookBatch({
    delivery: { webhookId, shopDomain: shop, topic },
    job: plan ?? undefined,
  });
  if (recorded.delivery === "duplicate") {
    log.info(
      `[webhooks] duplicate ${topic} for ${shop} webhookId=${webhookId}; ack 200`,
    );
  }

  return new Response();
}
