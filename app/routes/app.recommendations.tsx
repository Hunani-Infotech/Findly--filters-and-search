import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { ensureShopAccess } from "../billing.server";
import { UnderConstructionGate } from "../components/under-construction";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  await ensureShopAccess(session.shop);
  return null;
};

export default function RecommendationsPage() {
  return <UnderConstructionGate feature="Recommendations" />;
}

export const headers: HeadersFunction = (headersArgs) =>
  boundary.headers(headersArgs);
