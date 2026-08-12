import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { handleWebhookTopic } from "../webhooks.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, payload } = await authenticate.webhook(request);
  await handleWebhookTopic(shop, topic, payload as Record<string, unknown>);
  return new Response();
};
