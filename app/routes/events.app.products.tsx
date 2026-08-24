import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { handleProductEvent } from "../webhooks.server";

/** Shopify Events Product create/update/delete — same catalog path as webhooks. */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, payload } = await authenticate.webhook(request);
  await handleProductEvent(shop, payload as Record<string, unknown>);
  return new Response();
};
