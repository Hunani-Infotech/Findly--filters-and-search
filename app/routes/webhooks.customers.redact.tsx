import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { logComplianceEvent } from "../compliance.server";
import { log } from "../log.server";

/** GDPR: app does not store customer PII — log request only. */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, payload } = await authenticate.webhook(request);

  log.info(`Received ${topic} webhook for ${shop}`);
  await logComplianceEvent(shop, topic, payload);

  return new Response(null, { status: 200 });
};
