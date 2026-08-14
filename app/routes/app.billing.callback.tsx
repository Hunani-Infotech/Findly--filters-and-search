import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { ensureShopAccess, syncActiveSubscriptions } from "../billing.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const { shop } = await ensureShopAccess(session.shop);
  await syncActiveSubscriptions(admin, shop.id);
  return redirect("/app/billing");
};

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
