import type { LoaderFunctionArgs } from "react-router";
import {
  getCollectionFilterPayload,
  getSearchFilterPayload,
  parseFilterPage,
  parseFilterPageSize,
  parseSelectedFromSearchParams,
  isAppProxySignatureBypassEnabled,
  verifyAppProxySignature,
} from "../services/proxy.server";
import { createStorefrontTimer } from "../lib/storefront-timing.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const timer = createStorefrontTimer("filters");
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
    const result = await timer.measure("payloadMs", () =>
      searchQuery.trim() && !hasCollection
        ? getSearchFilterPayload({
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
        : getCollectionFilterPayload({
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
          }),
    );

    if ("error" in result && result.error) {
      const serializeStarted = performance.now();
      const body = JSON.stringify({ error: result.error });
      timer.mark("serializeMs", serializeStarted);
      timer.finish({ status: result.status, bytes: body.length });
      return new Response(body, {
        status: result.status,
        headers: { "Content-Type": "application/json" },
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
        "Content-Type": "application/json",
        "Cache-Control": "private, no-store",
      },
    });
  });
};
