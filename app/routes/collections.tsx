import { redirect, type HeadersFunction, type LoaderFunctionArgs } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { withEmbeddedParamsFromRequest } from "../utils/admin-path";

/**
 * Shopify Admin sometimes opens `/collections` (no `/app` prefix).
 * Send merchants into the Polaris Collections index instead of the marketing 404.
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  throw redirect(withEmbeddedParamsFromRequest(request, "/app/collections"));
};

export default function CollectionsRedirect() {
  return null;
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
