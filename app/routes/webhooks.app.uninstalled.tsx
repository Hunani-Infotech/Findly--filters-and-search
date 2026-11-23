import type { ActionFunctionArgs } from "react-router";
import { authenticateWebhookSafe } from "../utils/authenticate-webhook.server";
import { processAppUninstalled } from "../utils/webhook-app-uninstalled.server";
import {
  cancelShopifySubscriptionsBestEffortOnUninstall,
} from "../services/billing.server";
import { softUninstallShop } from "../services/compliance.server";
import {
  claimWebhookDelivery,
  releaseWebhookDelivery,
} from "../services/webhook-delivery.server";

/**
 * app/uninstalled — soft uninstall only.
 * Delete sessions + set uninstalledAt. Hard purge waits for shop/redact.
 * Shopify subscription cancel is best-effort and never causes a non-2xx
 * after soft uninstall.
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const ctx = await authenticateWebhookSafe(request);
  let capturedAdmin: unknown = ctx.admin ?? null;

  return processAppUninstalled(
    {
      shop: ctx.shop,
      topic: ctx.topic,
      webhookId: ctx.webhookId,
      admin: ctx.admin ?? null,
    },
    {
      claimDelivery: claimWebhookDelivery,
      releaseDelivery: releaseWebhookDelivery,
      softUninstall: async (shopDomain) => {
        const result = await softUninstallShop(shopDomain);
        if (!capturedAdmin) capturedAdmin = result.adminForCancel;
      },
      cleanupBestEffort: async ({ shopDomain, admin }) => {
        await cancelShopifySubscriptionsBestEffortOnUninstall(shopDomain, {
          admin: admin ?? capturedAdmin,
          // Timeout is owned by processAppUninstalled's Promise.race.
          timeoutMs: 0,
        });
      },
    },
  );
};
