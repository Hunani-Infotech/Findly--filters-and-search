import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { redirect } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { withEmbeddedParamsFromRequest } from "../admin-path";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  throw redirect(withEmbeddedParamsFromRequest(request, "/app?sync=1"));
};

export const action = async ({ request }: ActionFunctionArgs) => {
  await authenticate.admin(request);
  throw redirect(withEmbeddedParamsFromRequest(request, "/app?sync=1"));
};

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};

export default function SyncRedirect() {
  return null;
}
