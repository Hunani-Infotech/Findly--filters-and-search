import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticateAdminAllowReviewBot } from "../lib/admin-auth.server";
import { ensureShopAccess } from "../services/billing.server";
import { loadFilterOptionCatalogPage } from "../services/filter-option-editor.server";

/** JSON page (or full match set) of catalog values for Add/Edit filter option. */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const auth = await authenticateAdminAllowReviewBot(request);
  const url = new URL(request.url);
  const source = String(url.searchParams.get("source") || "");
  const query = String(url.searchParams.get("q") || "");
  const requestId = String(url.searchParams.get("r") || "");
  if (auth.bot) {
    return {
      requestId,
      all: url.searchParams.get("all") === "1",
      sourceKey: source,
      query,
      values: [] as string[],
      total: 0,
      page: 0,
      pageCount: 1,
      showingFrom: 0,
      showingTo: 0,
      labels: {} as Record<string, string>,
      collectionTreeItems: [] as Array<{ value: string; label: string }>,
    };
  }
  const { session } = auth;
  const { shop } = await ensureShopAccess(session.shop);
  const page = await loadFilterOptionCatalogPage(shop.id, source, {
    query,
    page: Number(url.searchParams.get("page") || "0") || 0,
    all: url.searchParams.get("all") === "1",
  });
  return { requestId, ...page };
};

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
