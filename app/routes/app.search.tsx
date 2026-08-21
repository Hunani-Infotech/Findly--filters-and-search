import { Outlet } from "react-router";
import type { HeadersFunction } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";

export { SearchPageSkeleton as HydrateFallback } from "../components/admin-skeletons";

export default function SearchLayout() {
  return <Outlet />;
}

export const headers: HeadersFunction = (headersArgs) =>
  boundary.headers(headersArgs);
