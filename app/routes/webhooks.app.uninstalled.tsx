import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { markShopUninstalled } from "../services/compliance.server";
import {
  resolveShopScopedWebhookId,
  tryRecordWebhookDelivery,
  webhookDeliveryExists,
} from "../services/webhook-delivery.server";
import { log } from "../lib/log.server";

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

  // Soft-offboard only — revoke sessions, set uninstalledAt. Hard-delete waits
  // for shop/redact / shop.cleanup (skipped if an offline Session exists again).
  const result = await markShopUninstalled(shop);
  log.success(
    `[compliance] app/uninstalled: ${
      result.marked ? "marked uninstalled" : "no Shop row (sessions revoked)"
    } for ${shop}`,
  );

  // Record only after soft-offboard succeeds so a 5xx retry is not swallowed.
  await tryRecordWebhookDelivery({
    webhookId,
    shopDomain: shop,
    topic,
  });

  return new Response(null, { status: 200 });
};
