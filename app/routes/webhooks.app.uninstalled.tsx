import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { ensureShopPurged } from "../compliance.server";
import { log } from "../log.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic } = await authenticate.webhook(request);

  log.info(`Received ${topic} webhook for ${shop}`);

  // Queue when Redis is up; purge inline if enqueue fails. Throws → 5xx retry.
  await ensureShopPurged(shop, "app/uninstalled");

  return new Response(null, { status: 200 });
};
