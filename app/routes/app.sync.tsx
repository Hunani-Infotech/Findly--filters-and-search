import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { redirect } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { withEmbeddedParamsFromRequest } from "../utils/admin-path";
import { queueFullSync } from "../sync/queue-full-sync";
import { log } from "../lib/log.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  throw redirect(withEmbeddedParamsFromRequest(request, "/app?sync=1"));
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  try {
    await queueFullSync(session.shop);
  } catch (error) {
    log.warn("[sync] /app/sync POST could not start catalog sync", error);
  }
  throw redirect(withEmbeddedParamsFromRequest(request, "/app?sync=1"));
};

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};

export default function SyncRedirect() {
  return null;
}
