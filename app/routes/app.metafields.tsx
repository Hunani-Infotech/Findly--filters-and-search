import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { withEmbeddedParamsFromRequest } from "../utils/admin-path";
import { authenticateAdminAllowReviewBot } from "../lib/admin-auth.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticateAdminAllowReviewBot(request);
  throw redirect(
    withEmbeddedParamsFromRequest(request, "/app/settings?tab=metafields"),
  );
};

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
