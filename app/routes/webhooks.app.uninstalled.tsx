import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { enqueueSyncJob } from "../queues.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  // Background purge — ack fast for Shopify retries
  await enqueueSyncJob(
    "shop.cleanup",
    { shop },
    { jobId: `${shop}:shop.cleanup` },
  );

  return new Response(null, { status: 200 });
};
