import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { log } from "../lib/log.server";
import { handleWebhookTopic } from "./webhooks.server";
import {
  resolveCatalogWebhookDeliveryId,
  tryRecordWebhookDelivery,
  webhookDeliveryExists,
} from "./webhook-delivery.server";

/** HMAC-authenticated adapters shared by catalog webhook routes. */
export async function catalogWebhookAction({ request }: ActionFunctionArgs) {
  const { shop, topic, payload } = await authenticate.webhook(request);
  const body = payload as Record<string, unknown>;

  const webhookId = resolveCatalogWebhookDeliveryId({
    request,
    topic,
    shopDomain: shop,
    payload: body,
  });

  if (await webhookDeliveryExists(webhookId)) {
    log.info(
      `[webhooks] duplicate ${topic} for ${shop} webhookId=${webhookId}; ack 200`,
    );
    return new Response();
  }

  await handleWebhookTopic(shop, topic, body);

  await tryRecordWebhookDelivery({
    webhookId,
    shopDomain: shop,
    topic,
  });

  return new Response();
}
