import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { isAppProxySignatureBypassEnabled, verifyAppProxySignature } from "../services/proxy.server";
import { ingestAnalyticsEvent } from "../services/analytics.server";

const corsHeaders = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
};

function paramsFrom(request: Request) {
  const url = new URL(request.url);
  return url.searchParams;
}

async function handleBeacon(request: Request) {
  const url = new URL(request.url);
  const bypass = isAppProxySignatureBypassEnabled();
  if (!bypass && !verifyAppProxySignature(url)) {
    return new Response(JSON.stringify({ error: "Invalid signature" }), {
      status: 401,
      headers: corsHeaders,
    });
  }

  let body: Record<string, string> = {};
  if (request.method !== "GET") {
    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      try {
        const parsed = (await request.json()) as Record<string, unknown>;
        for (const [key, value] of Object.entries(parsed)) {
          if (value != null) body[key] = String(value);
        }
      } catch {
        body = {};
      }
    } else {
      const form = await request.formData().catch(() => null);
      if (form) {
        form.forEach((value, key) => {
          body[key] = String(value);
        });
      }
    }
  }

  const q = paramsFrom(request);
  const shopDomain = q.get("shop") || q.get("shop_domain") || body.shop || "";
  const result = await ingestAnalyticsEvent({
    shopDomain,
    kind: q.get("kind") || body.kind || "",
    query: q.get("q") || body.q || body.query || "",
    combo: q.get("combo") || body.combo || "",
    handle: q.get("handle") || body.handle || "",
    resultCount: Number(q.get("n") || body.n || body.resultCount || 0),
    visitor: q.get("v") || body.v || body.visitor || "",
    device: q.get("d") || body.d || body.device || "",
  });

  if (!result.ok) {
    return new Response(JSON.stringify({ error: result.error }), {
      status: 400,
      headers: corsHeaders,
    });
  }
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: corsHeaders,
  });
}

export const loader = async ({ request }: LoaderFunctionArgs) =>
  handleBeacon(request);

export const action = async ({ request }: ActionFunctionArgs) =>
  handleBeacon(request);
