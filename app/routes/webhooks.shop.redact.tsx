import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import {
  ensureShopPurged,
  logComplianceEvent,
  shopifyWebhookRequestId,
} from "../services/compliance.server";
import { log } from "../lib/log.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic } = await authenticate.webhook(request);

  log.info(`Received ${topic} webhook for ${shop}`);

  const requestId = shopifyWebhookRequestId(request);
  try {
    const purged = await ensureShopPurged(shop, "shop/redact");
    const status =
      purged.mode === "queued"
        ? "queued"
        : purged.mode === "skipped"
          ? "skipped_reinstalled"
          : "redacted";
    await logComplianceEvent(shop, topic, {
      requestId,
      status,
    });
  } catch (error) {
    try {
      await logComplianceEvent(shop, topic, {
        requestId,
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

  return new Response(null, { status: 200 });
};
