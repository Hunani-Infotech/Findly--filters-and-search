import { redirect, type HeadersFunction, type LoaderFunctionArgs } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticateAdminAllowReviewBot } from "../lib/admin-auth.server";
import { withEmbeddedParamsFromRequest } from "../utils/admin-path";

/**
 * Former Collections browse list — filter setup lives under Filters.
 * Keep this route so bookmarks/nav hits redirect instead of 404.
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticateAdminAllowReviewBot(request);
  throw redirect(withEmbeddedParamsFromRequest(request, "/app/filters"));
};

export default function CollectionsIndexRedirect() {
  return null;
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
