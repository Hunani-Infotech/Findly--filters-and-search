import type { LoaderFunctionArgs } from "react-router";
import {
  getCollectionFilterPayload,
  getSearchFilterPayload,
  parseFilterPage,
  parseFilterPageSize,
  parseSelectedFromSearchParams,
  verifyAppProxySignature,
} from "../services/proxy.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  // In development, allow missing signature when explicitly enabled
  const bypass =
    process.env.NODE_ENV !== "production" &&
    process.env.PROXY_SIGNATURE_BYPASS === "true";

  if (!bypass && !verifyAppProxySignature(url)) {
    return new Response(JSON.stringify({ error: "Invalid signature" }), {
      status: 401,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }

  const shopDomain =
    url.searchParams.get("shop") || url.searchParams.get("shop_domain") || "";
  const collectionId = url.searchParams.get("collection_id");
  const collectionGid = url.searchParams.get("collection_gid");
  const collectionHandle =
    url.searchParams.get("collection_handle") ||
    url.searchParams.get("handle") ||
    "";
  const searchQuery =
    url.searchParams.get("q") || url.searchParams.get("query") || "";
  const selected = parseSelectedFromSearchParams(url.searchParams);
  const sort = url.searchParams.get("sort");
  const locale =
    url.searchParams.get("locale") || url.searchParams.get("locale_code") || "";
  const page = parseFilterPage(url.searchParams.get("page"));
  const pageSize = parseFilterPageSize(url.searchParams.get("pageSize"));
  const country = url.searchParams.get("country");
  const currency = url.searchParams.get("currency");
  const companyLocationId =
    url.searchParams.get("companyLocationId") ||
    url.searchParams.get("company_location");

  const hasCollection = Boolean(
    collectionId || collectionGid || collectionHandle,
  );
  const result =
    searchQuery.trim() && !hasCollection
      ? await getSearchFilterPayload({
          shopDomain,
          query: searchQuery,
          selected,
          sort,
          locale,
          page,
          pageSize,
          country,
          currency,
          companyLocationId,
        })
      : await getCollectionFilterPayload({
          shopDomain,
          collectionId,
          collectionGid,
          collectionHandle,
          selected,
          sort,
          query: searchQuery,
          locale,
          page,
          pageSize,
          country,
          currency,
          companyLocationId,
        });

  if ("error" in result && result.error) {
    return new Response(JSON.stringify({ error: result.error }), {
      status: result.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify(result.data), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "private, no-store",
    },
  });
};
