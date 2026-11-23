import type { ActionFunctionArgs } from "react-router";
import { authenticateWebhookSafe } from "../utils/authenticate-webhook.server";
import { ackWebhookBatch } from "../lib/queues.server";
import { log } from "../lib/log.server";
import { mirrorAppSubscriptionWebhook } from "../services/billing.server";
import { isShopUninstalledOrMissing } from "../services/compliance.server";
import {
  resolveWebhookDeliveryId,
  tryRecordWebhookDelivery,
  webhookDeliveryExists,
} from "../services/webhook-delivery.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, payload, webhookId: authWebhookId } =
    await authenticateWebhookSafe(request);
  log.info(`Received ${topic} webhook for ${shop}`);

  const webhookId =
    authWebhookId ||
    resolveWebhookDeliveryId({
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

  // Mirror CANCELLED/DECLINED/EXPIRED/FROZEN/PENDING locally even if the
  // offline token is already gone (uninstall race). ACTIVE still needs GraphQL.
  const mirrored = await mirrorAppSubscriptionWebhook(shop, payload, {
    requestId: webhookId,
  });
  if (mirrored.applied) {
    log.info(
      `[billing] mirrored app_subscriptions/update for ${shop} status=${mirrored.status} webhookId=${webhookId}`,
    );
  }

  if (await isShopUninstalledOrMissing(shop)) {
    log.info(
      `[billing] app_subscriptions/update: shop missing/uninstalled for ${shop}; ack 200`,
    );
    await tryRecordWebhookDelivery({
      webhookId,
      shopDomain: shop,
      topic,
    });
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
