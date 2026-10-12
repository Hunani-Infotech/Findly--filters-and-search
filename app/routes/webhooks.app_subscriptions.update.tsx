import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { enqueueSyncJobWithTimeout } from "../lib/queues.server";
import { log } from "../lib/log.server";
import {
  resolveWebhookDeliveryId,
  tryRecordWebhookDelivery,
  webhookDeliveryExists,
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

  if (await webhookDeliveryExists(webhookId)) {
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
    log.error(
      `[billing] enqueue failed for ${shop} (${reason}) — webhook will 5xx so Shopify retries`,
      enqueueError,
    );
    throw enqueueError;
  }

  // Record only after durable enqueue so a 5xx retry is not swallowed as duplicate.
  await tryRecordWebhookDelivery({
    webhookId,
    shopDomain: shop,
    topic,
  });

  return new Response(null, { status: 200 });
};
