import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";

/** Old /app/swatches/:option links keep working without dropping Shopify query params. */
export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  const url = new URL(request.url);
  const option = String(params.option || "").trim();
  if (option) url.searchParams.set("option", option);
  const qs = url.searchParams.toString();
  return redirect(qs ? `/app/swatches?${qs}` : "/app/swatches");
};

export default function SwatchOptionRedirect() {
  return null;
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
