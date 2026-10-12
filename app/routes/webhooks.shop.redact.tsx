import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import {
  ensureShopPurged,
  logComplianceEvent,
} from "../services/compliance.server";
import { log } from "../lib/log.server";
import {
  resolveShopScopedWebhookId,
  tryRecordWebhookDelivery,
  webhookDeliveryExists,
} from "../services/webhook-delivery.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic } = await authenticate.webhook(request);

  log.info(`Received ${topic} webhook for ${shop}`);

  const webhookId = resolveShopScopedWebhookId({
    request,
    topic,
    shopDomain: shop,
  });

  if (await webhookDeliveryExists(webhookId)) {
    log.info(
      `[compliance] duplicate ${topic} for ${shop} webhookId=${webhookId}; ack 200`,
    );
    return new Response(null, { status: 200 });
  }

  try {
    const purged = await ensureShopPurged(shop, "shop/redact");
    const status =
      purged.mode === "queued" ? "queued" : "skipped_reinstalled";
    await logComplianceEvent(shop, topic, {
      requestId: webhookId,
      status,
    });
  } catch (error) {
    try {
      await logComplianceEvent(shop, topic, {
        requestId: webhookId,
        status: "failed",
      });
    } catch (logError) {
      log.error(
        `[compliance] shop/redact: could not persist failed audit for ${shop}`,
        logError,
      );
    }
    throw error;
  }

  await tryRecordWebhookDelivery({
    webhookId,
    shopDomain: shop,
    topic,
  });

  return new Response(null, { status: 200 });
};
