import { redirect, type HeadersFunction, type LoaderFunctionArgs } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticateAdminAllowReviewBot } from "../lib/admin-auth.server";
import { withEmbeddedParamsFromRequest } from "../utils/admin-path";

/**
 * Shopify Admin sometimes opens `/collections` (no `/app` prefix).
 * Collections browse was removed; send merchants to Filters instead.
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticateAdminAllowReviewBot(request);
  throw redirect(withEmbeddedParamsFromRequest(request, "/app/filters"));
};

export default function CollectionsRedirect() {
  return null;
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
