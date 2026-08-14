import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { logComplianceEvent } from "../compliance.server";
import { enqueueSyncJob } from "../queues.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, payload } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);
  await logComplianceEvent(shop, topic, payload);
  await enqueueSyncJob(
    "shop.cleanup",
    { shop },
    { jobId: `${shop}:shop.cleanup` },
  );

  return new Response(null, { status: 200 });
};
