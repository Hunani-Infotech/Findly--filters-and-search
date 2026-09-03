import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticateAdminAllowReviewBot } from "../lib/admin-auth.server";
import { ensureShopAccess } from "../services/billing.server";
import {
  emptyCatalogValuesPage,
  getCatalogValuesPage,
  listMatchingCatalogValues,
} from "../services/value-groups.server";

/** JSON page (or full match set) of catalog values for Add/Edit group. */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const auth = await authenticateAdminAllowReviewBot(request);
  const url = new URL(request.url);
  const source = String(url.searchParams.get("source") || "");
  const query = String(url.searchParams.get("q") || "");
  const requestId = String(url.searchParams.get("r") || "");
  if (auth.bot) {
    if (url.searchParams.get("all") === "1") {
      return {
        all: true as const,
        requestId,
        sourceKey: source,
        query,
        values: [] as string[],
        total: 0,
      };
    }
    return {
      all: false as const,
      requestId,
      ...emptyCatalogValuesPage(source),
      query,
    };
  }
  const { session } = auth;
  const { shop } = await ensureShopAccess(session.shop);
  if (url.searchParams.get("all") === "1") {
    const match = await listMatchingCatalogValues(shop.id, source, query);
    return { all: true as const, requestId, ...match };
  }
  const page = await getCatalogValuesPage(shop.id, source, {
    query,
    page: Number(url.searchParams.get("page") || "0") || 0,
  });
  return { all: false as const, requestId, ...page };
};

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
