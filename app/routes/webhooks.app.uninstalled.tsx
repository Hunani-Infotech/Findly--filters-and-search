import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { ensureShopPurged } from "../services/compliance.server";
import { log } from "../lib/log.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic } = await authenticate.webhook(request);

  log.info(`Received ${topic} webhook for ${shop}`);

  // Queue when possible; purge inline if enqueue fails. Throws → 5xx retry.
  await ensureShopPurged(shop, "app/uninstalled");

  return new Response(null, { status: 200 });
};
