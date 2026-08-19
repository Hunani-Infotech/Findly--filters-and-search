import type { LoaderFunctionArgs } from "react-router";
import {
  parseSelectedValues,
  ymmConfigPayload,
  ymmOptionsPayload,
  ymmSearchPayload,
} from "../ymm.server";
import { verifyAppProxySignature } from "../proxy.server";
import { getAdminNavExtras } from "../admin-nav-extras.server";
import prisma from "../db.server";

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
  const intent = url.searchParams.get("intent") || "config";

  if (intent === "config") {
    const result = await ymmConfigPayload(shopDomain);
    if ("error" in result && result.error) {
      return new Response(JSON.stringify({ error: result.error }), {
        status: result.status,
        headers: corsHeaders,
      });
    }
    return new Response(JSON.stringify(result.data), {
      status: 200,
      headers: { ...corsHeaders, "Cache-Control": "private, max-age=15" },
    });
  }

  const shop = await prisma.shop.findUnique({ where: { domain: shopDomain } });
  const fieldCount = shop
    ? (await getAdminNavExtras(shop.id)).ymm.fields.length
    : 3;
  const selected = parseSelectedValues(url.searchParams, fieldCount);

  if (intent === "options") {
    const result = await ymmOptionsPayload(shopDomain, selected);
    if ("error" in result && result.error) {
      return new Response(JSON.stringify({ error: result.error }), {
        status: result.status,
        headers: corsHeaders,
      });
    }
    return new Response(JSON.stringify(result.data), {
      status: 200,
      headers: { ...corsHeaders, "Cache-Control": "private, max-age=15" },
    });
  }

  const result = await ymmSearchPayload(shopDomain, selected);
  if ("error" in result && result.error) {
    return new Response(JSON.stringify({ error: result.error }), {
      status: result.status,
      headers: corsHeaders,
    });
  }
  return new Response(JSON.stringify(result.data), {
    status: 200,
    headers: { ...corsHeaders, "Cache-Control": "private, max-age=15" },
  });
};
