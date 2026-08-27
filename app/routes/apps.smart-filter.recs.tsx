import type { LoaderFunctionArgs } from "react-router";
import { verifyAppProxySignature } from "../services/proxy.server";
import { parseRecType, recsPayload } from "../services/recommendations.server";
import { parseHandleList } from "../utils/recommendations";

const corsHeaders = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const bypass =
    process.env.NODE_ENV !== "production" &&
    process.env.PROXY_SIGNATURE_BYPASS === "true";

  if (!bypass && !verifyAppProxySignature(url)) {
    return new Response(JSON.stringify({ error: "Invalid signature" }), {
      status: 401,
      headers: corsHeaders,
    });
  }

  const shopDomain =
    url.searchParams.get("shop") || url.searchParams.get("shop_domain") || "";
  const type = parseRecType(url.searchParams.get("type"));
  const productHandle =
    url.searchParams.get("product") ||
    url.searchParams.get("handle") ||
    "";
  const limitRaw = Number(url.searchParams.get("limit") || "");
  const handles = parseHandleList(
    url.searchParams.get("handles") || url.searchParams.getAll("h"),
    24,
  );

  const result = await recsPayload({
    shopDomain,
    type,
    productHandle,
    handles,
    limit: Number.isFinite(limitRaw) ? limitRaw : undefined,
  });

  if ("error" in result) {
    return new Response(JSON.stringify({ error: result.error }), {
      status: result.status,
      headers: corsHeaders,
    });
  }

  return new Response(JSON.stringify(result.data), {
    status: 200,
    headers: { ...corsHeaders, "Cache-Control": "private, max-age=30" },
  });
};
