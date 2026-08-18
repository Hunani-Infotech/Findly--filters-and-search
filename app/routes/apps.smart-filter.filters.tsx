import type { LoaderFunctionArgs } from "react-router";
import {
  getCollectionFilterPayload,
  getSearchFilterPayload,
  parseSelectedFromSearchParams,
  verifyAppProxySignature,
} from "../proxy.server";

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
  const searchQuery =
    url.searchParams.get("q") || url.searchParams.get("query") || "";
  const selected = parseSelectedFromSearchParams(url.searchParams);

  const hasCollection = Boolean(collectionId || collectionGid);
  const result =
    searchQuery.trim() && !hasCollection
      ? await getSearchFilterPayload({
          shopDomain,
          query: searchQuery,
          selected,
        })
      : await getCollectionFilterPayload({
          shopDomain,
          collectionId,
          collectionGid,
          selected,
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
      "Cache-Control": "public, max-age=30",
    },
  });
};
