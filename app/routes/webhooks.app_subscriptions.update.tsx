import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { ackWebhookBatch } from "../lib/queues.server";
import { log } from "../lib/log.server";
import {
  resolveWebhookDeliveryId,
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
    await ackWebhookBatch({
      delivery: { webhookId, shopDomain: shop, topic },
      job: {
        name: "billing.syncFromShopify",
        data: jobData,
        jobId,
      },
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

  return new Response(null, { status: 200 });
};
