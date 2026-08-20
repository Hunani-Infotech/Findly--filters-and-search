import type { LoaderFunctionArgs } from "react-router";
import { getInstantSearchWidgetPayload, getSearchPayload, verifyAppProxySignature } from "../proxy.server";

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
  const locale =
    url.searchParams.get("locale") || url.searchParams.get("locale_code") || "";
  const widget = url.searchParams.get("widget") === "1";
  const takeRaw = Number(url.searchParams.get("limit"));
  const take = Number.isFinite(takeRaw) ? takeRaw : undefined;

  if (widget && !query.trim()) {
    const bootstrap = await getInstantSearchWidgetPayload({
      shopDomain,
    });
    if ("error" in bootstrap && bootstrap.error) {
      return new Response(JSON.stringify({ error: bootstrap.error }), {
        status: bootstrap.status,
        headers: corsHeaders,
      });
    }
    return new Response(JSON.stringify(bootstrap.data), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Cache-Control": "private, max-age=30",
      },
    });
  }

  const result = await getSearchPayload({
    shopDomain,
    query,
    locale,
    take,
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
