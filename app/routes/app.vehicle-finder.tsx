import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { ensureShopAccess } from "../services/billing.server";
import { UnderConstructionGate } from "../components/under-construction";
import { UnderConstructionSkeleton } from "../components/admin-skeletons";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  await ensureShopAccess(session.shop);
  return null;
};

export default function VehicleFinderPage() {
  return <UnderConstructionGate feature="Vehicle Finder" />;
}

export function HydrateFallback() {
  return <UnderConstructionSkeleton title="Vehicle Finder" />;
}

export const headers: HeadersFunction = (headersArgs) =>
  boundary.headers(headersArgs);
