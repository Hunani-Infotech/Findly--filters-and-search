import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { handleProductEvent, handleWebhookTopic } from "./webhooks.server";

export async function catalogWebhookAction({ request }: ActionFunctionArgs) {
  const { shop, topic, payload } = await authenticate.webhook(request);
  await handleWebhookTopic(shop, topic, payload as Record<string, unknown>);
  return new Response();
}

export async function productEventWebhookAction({ request }: ActionFunctionArgs) {
  const { shop, payload } = await authenticate.webhook(request);
  await handleProductEvent(shop, payload as Record<string, unknown>);
  return new Response();
}
