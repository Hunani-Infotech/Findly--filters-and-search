import type { LoaderFunctionArgs } from "react-router";
import { getSearchPayload, verifyAppProxySignature } from "../proxy.server";

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
  const query =
    url.searchParams.get("q") || url.searchParams.get("query") || "";

  const result = await getSearchPayload({
    shopDomain,
    query,
  });

  if ("error" in result && result.error) {
    return new Response(JSON.stringify({ error: result.error }), {
      status: result.status,
      headers: corsHeaders,
    });
  }

  return new Response(JSON.stringify(result.data), {
    status: 200,
    headers: {
      ...corsHeaders,
      "Cache-Control": "private, max-age=15",
    },
  });
};
