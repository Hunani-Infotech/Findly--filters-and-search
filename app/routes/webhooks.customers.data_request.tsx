import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { logComplianceEvent } from "../services/compliance.server";
import { log } from "../lib/log.server";
import {
  resolveCustomersDataRequestWebhookId,
  tryRecordWebhookDelivery,
  webhookDeliveryExists,
} from "../services/webhook-delivery.server";

/** GDPR: app does not store customer PII — audit row only (no webhook body). */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, payload } = await authenticate.webhook(request);

  log.info(`Received ${topic} webhook for ${shop}`);

  const webhookId = resolveCustomersDataRequestWebhookId({
    request,
    topic,
    shopDomain: shop,
    payload,
  });

  if (await webhookDeliveryExists(webhookId)) {
    log.info(
      `[compliance] duplicate ${topic} for ${shop} webhookId=${webhookId}; ack 200`,
    );
    return Response.json(
      {
        message:
          "This app does not store customer personally identifiable information.",
        shop,
      },
      { status: 200 },
    );
  }

  await logComplianceEvent(shop, topic, {
    requestId: webhookId,
    status: "acknowledged",
  });

  await tryRecordWebhookDelivery({
    webhookId,
    shopDomain: shop,
    topic,
  });

  return Response.json(
    {
      message:
        "This app does not store customer personally identifiable information.",
      shop,
    },
    { status: 200 },
  );
};
