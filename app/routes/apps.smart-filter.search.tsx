import type { LoaderFunctionArgs } from "react-router";
import {
  getInstantSearchWidgetPayload,
  getSearchPayload,
  isAppProxySignatureBypassEnabled,
  verifyAppProxySignature,
} from "../services/proxy.server";
import { createStorefrontTimer } from "../lib/storefront-timing.server";

const corsHeaders = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const timer = createStorefrontTimer("search");
  return timer.run(async () => {
    const url = new URL(request.url);

    const hmacStarted = performance.now();
    const bypass = isAppProxySignatureBypassEnabled();
    const hmacOk = bypass || verifyAppProxySignature(url);
    timer.mark("hmacMs", hmacStarted);

    if (!hmacOk) {
      timer.finish({ status: 401 });
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
    const country = url.searchParams.get("country");
    const currency = url.searchParams.get("currency");
    const companyLocationId =
      url.searchParams.get("companyLocationId") ||
      url.searchParams.get("company_location");

    if (widget && !query.trim()) {
      const bootstrap = await timer.measure("payloadMs", () =>
        getInstantSearchWidgetPayload({
          shopDomain,
          country,
          currency,
          companyLocationId,
        }),
      );
      if ("error" in bootstrap && bootstrap.error) {
        const serializeStarted = performance.now();
        const body = JSON.stringify({ error: bootstrap.error });
        timer.mark("serializeMs", serializeStarted);
        timer.finish({ status: bootstrap.status, bytes: body.length });
        return new Response(body, {
          status: bootstrap.status,
          headers: corsHeaders,
        });
      }
      const serializeStarted = performance.now();
      const body = JSON.stringify(bootstrap.data);
      timer.mark("serializeMs", serializeStarted);
      timer.finish({ status: 200, bytes: body.length, mode: "widget" });
      return new Response(body, {
        status: 200,
        headers: {
          ...corsHeaders,
          "Cache-Control": "private, max-age=30",
        },
      });
    }

    const result = await timer.measure("payloadMs", () =>
      getSearchPayload({
        shopDomain,
        query,
        locale,
        take,
        listing: url.searchParams.get("listing") === "1",
        country,
        currency,
        companyLocationId,
      }),
    );

    if ("error" in result && result.error) {
      const serializeStarted = performance.now();
      const body = JSON.stringify({ error: result.error });
      timer.mark("serializeMs", serializeStarted);
      timer.finish({ status: result.status, bytes: body.length });
      return new Response(body, {
        status: result.status,
        headers: corsHeaders,
      });
    }

    const serializeStarted = performance.now();
    const body = JSON.stringify(result.data);
    timer.mark("serializeMs", serializeStarted);
    timer.finish({
      status: 200,
      bytes: body.length,
      shop: shopDomain || undefined,
    });

    return new Response(body, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Cache-Control": "private, no-store",
      },
    });
  });
};
