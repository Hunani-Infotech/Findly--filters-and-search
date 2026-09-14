import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticateAdminAllowReviewBot } from "../lib/admin-auth.server";
import { ensureShopAccess, syncActiveSubscriptions } from "../services/billing.server";
import { withEmbeddedParamsFromRequest } from "../utils/admin-path";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const auth = await authenticateAdminAllowReviewBot(request);
  if (auth.bot) {
    return redirect(withEmbeddedParamsFromRequest(request, "/app/billing"));
  }
  const { session, admin } = auth;
  const { shop } = await ensureShopAccess(session.shop);
  await syncActiveSubscriptions(admin, shop.id);
  return redirect(withEmbeddedParamsFromRequest(request, "/app/billing"));
};

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
