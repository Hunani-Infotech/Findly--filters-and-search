import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import {
  logComplianceEvent,
  shopifyWebhookRequestId,
} from "../compliance.server";
import { log } from "../log.server";

/** GDPR: app does not store customer PII — audit row only (no webhook body). */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic } = await authenticate.webhook(request);

  log.info(`Received ${topic} webhook for ${shop}`);
  await logComplianceEvent(shop, topic, {
    requestId: shopifyWebhookRequestId(request),
    status: "acknowledged",
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
