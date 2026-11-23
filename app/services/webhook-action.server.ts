import type { ActionFunctionArgs } from "react-router";
import { authenticateWebhookSafe } from "../utils/authenticate-webhook.server";
import { processCatalogWebhook } from "../utils/webhook-catalog.server";
import { ackWebhookBatch } from "../lib/queues.server";
import { isShopUninstalledOrMissing } from "./compliance.server";
import { planCatalogWebhookJob } from "./webhooks.server";
import {
  resolveCatalogWebhookDeliveryId,
  tryRecordWebhookDelivery,
} from "./webhook-delivery.server";

/**
 * HMAC-authenticated adapters shared by catalog webhook routes.
 * A burst shares one QueueJob + WebhookDelivery commit (ackWebhookBatch).
 * 200 only after that commit. A failed commit rejects and Shopify retries.
 * Uninstalled / missing shops ack 200 without enqueue (no useful retry).
 */
export async function catalogWebhookAction({ request }: ActionFunctionArgs) {
  const { shop, topic, payload, webhookId: authWebhookId } =
    await authenticateWebhookSafe(request);
  const body = payload as Record<string, unknown>;

  const webhookId =
    authWebhookId ||
    resolveCatalogWebhookDeliveryId({
      request,
      topic,
      shopDomain: shop,
      payload: body,
    });

  return processCatalogWebhook(
    { shop, topic, webhookId, payload: body },
    {
      isShopInactive: isShopUninstalledOrMissing,
      recordDelivery: tryRecordWebhookDelivery,
      planJob: planCatalogWebhookJob,
      ackBatch: ackWebhookBatch,
    },
  );
}
