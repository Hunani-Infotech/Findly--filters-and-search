import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import {
  logComplianceEvent,
  scrubCustomerData,
  shopifyWebhookRequestId,
} from "../services/compliance.server";
import { log } from "../lib/log.server";

/** GDPR customers/redact: scrub any stored identifiers, then audit (no payload). */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, payload } = await authenticate.webhook(request);

  log.info(`Received ${topic} webhook for ${shop}`);
  const scrubbed = await scrubCustomerData(shop, payload);
  await logComplianceEvent(shop, topic, {
    requestId: shopifyWebhookRequestId(request),
    status: "redacted",
  });
  log.info(
    `[compliance] customers/redact done for ${shop} analyticsDeleted=${scrubbed.analyticsDeleted}`,
  );

  return new Response(null, { status: 200 });
};
