import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

/** CLI-required Events delivery. Catalog sync remains on product webhooks. */
export const action = async ({ request }: ActionFunctionArgs) => {
  await authenticate.webhook(request);
  return new Response();
};
