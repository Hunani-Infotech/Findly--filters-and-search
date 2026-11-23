import type { ActionFunctionArgs } from "react-router";
import { authenticateWebhookSafe } from "../utils/authenticate-webhook.server";
import { processShopRedact } from "../utils/webhook-shop-redact.server";
import {
  ensureShopPurged,
  logComplianceEvent,
  shopExists,
  shopLooksReinstalled,
} from "../services/compliance.server";
import {
  claimWebhookDelivery,
  releaseWebhookDelivery,
} from "../services/webhook-delivery.server";

/**
 * shop/redact — queue hard purge. No Admin API / offline token dependency.
 * Already-purged or reinstalled shops ack 200. Real purge/enqueue failure → 5xx.
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const ctx = await authenticateWebhookSafe(request);

  return processShopRedact(
    {
      shop: ctx.shop,
      topic: ctx.topic,
      webhookId: ctx.webhookId,
    },
    {
      claimDelivery: claimWebhookDelivery,
      releaseDelivery: releaseWebhookDelivery,
      shopExists,
      shopLooksReinstalled,
      purgeShopData: async (shopDomain) => {
        await ensureShopPurged(shopDomain, "shop/redact");
      },
      audit: async ({ shopDomain, requestId, topic, status }) => {
        await logComplianceEvent(shopDomain, topic, { requestId, status });
      },
    },
  );
};
