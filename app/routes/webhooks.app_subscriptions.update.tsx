import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { enqueueSyncJobWithTimeout } from "../lib/queues.server";
import { log } from "../lib/log.server";
import {
  resolveWebhookDeliveryId,
  tryRecordWebhookDelivery,
} from "../services/webhook-delivery.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, payload } = await authenticate.webhook(request);
  log.info(`Received ${topic} webhook for ${shop}`);

  const webhookId = resolveWebhookDeliveryId({
    request,
    topic,
    shopDomain: shop,
    payload,
  });

  const recorded = await tryRecordWebhookDelivery({
    webhookId,
    shopDomain: shop,
    topic,
  });
  if (recorded === "duplicate") {
    log.info(
      `[billing] duplicate ${topic} for ${shop} webhookId=${webhookId}; ack 200`,
    );
    return new Response(null, { status: 200 });
  }

  const jobData = { shop, webhookId };
  const jobId = `${shop}:billing.syncFromShopify`;

  try {
    await enqueueSyncJobWithTimeout("billing.syncFromShopify", jobData, {
      jobId,
      timeoutMs: 800,
    });
    log.success(
      `[billing] queued billing.syncFromShopify for ${shop} webhookId=${webhookId}`,
    );
  } catch (enqueueError) {
    const reason =
      enqueueError instanceof Error
        ? enqueueError.message
        : String(enqueueError);
    log.warn(
      `[billing] enqueue failed for ${shop} (${reason}); fire-and-forget inline sync`,
    );
    const { runSyncJobInline } = await import("../workers/processors");
    void runSyncJobInline("billing.syncFromShopify", jobData).catch((error) => {
      log.error(
        `[billing] inline billing.syncFromShopify failed for ${shop}`,
        error,
      );
    });
  }

  return new Response(null, { status: 200 });
};
