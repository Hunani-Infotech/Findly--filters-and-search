import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { logComplianceEvent } from "../compliance.server";

/** GDPR: app does not store customer PII — log + confirm. */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, payload } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);
  await logComplianceEvent(shop, topic, payload);

  return Response.json(
    {
      message:
        "This app does not store customer personally identifiable information.",
      shop,
      customerId:
        (payload as { customer?: { id?: number | string } })?.customer?.id ??
        null,
    },
    { status: 200 },
  );
};
