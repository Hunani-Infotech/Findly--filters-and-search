import crypto from "node:crypto";

/** App Proxy signatures include `timestamp` (unix seconds). Reject stale/replayed URLs. */
export const APP_PROXY_TIMESTAMP_MAX_SKEW_SEC = 90;

/**
 * Local HMAC skip for App Proxy routes. Production (and unset NODE_ENV) never
 * bypasses — Hostinger `npm start` must not honor PROXY_SIGNATURE_BYPASS.
 */
export function isAppProxySignatureBypassEnabled(): boolean {
  return (
    process.env.NODE_ENV === "development" &&
    process.env.PROXY_SIGNATURE_BYPASS === "true"
  );
}

function hmacMessageFromSearchParams(searchParams: URLSearchParams): string {
  const params: string[] = [];
  searchParams.forEach((value, key) => {
    if (key !== "signature") params.push(`${key}=${value}`);
  });
  params.sort();
  return params.join("");
}

function hmacMessageFromRawQuery(search: string): string {
  const raw = search.startsWith("?") ? search.slice(1) : search;
  const params: string[] = [];
  for (const part of raw.split("&")) {
    if (!part) continue;
    const eq = part.indexOf("=");
    const encodedKey = eq === -1 ? part : part.slice(0, eq);
    const encodedValue = eq === -1 ? "" : part.slice(eq + 1);
    let key = encodedKey;
    let value = encodedValue;
    try {
      key = decodeURIComponent(encodedKey.replace(/\+/g, " "));
      value = decodeURIComponent(encodedValue.replace(/\+/g, " "));
    } catch {
      key = encodedKey;
      value = encodedValue;
    }
    if (key === "signature") continue;
    params.push(`${key}=${value}`);
  }
  params.sort();
  return params.join("");
}

function hmacMessageFromRawQueryEncoded(search: string): string {
  const raw = search.startsWith("?") ? search.slice(1) : search;
  const params: string[] = [];
  for (const part of raw.split("&")) {
    if (!part) continue;
    const eq = part.indexOf("=");
    const encodedKey = eq === -1 ? part : part.slice(0, eq);
    const encodedValue = eq === -1 ? "" : part.slice(eq + 1);
    if (encodedKey === "signature") continue;
    params.push(`${encodedKey}=${encodedValue}`);
  }
  params.sort();
  return params.join("");
}

function signaturesMatch(digest: string, signature: string): boolean {
  try {
    const left = Buffer.from(digest, "utf8");
    const right = Buffer.from(signature, "utf8");
    if (left.length !== right.length) return false;
    return crypto.timingSafeEqual(left, right);
  } catch {
    return false;
  }
}

/** Verify Shopify App Proxy signature (HMAC SHA256 of sorted query params). */
export function verifyAppProxySignature(url: URL): boolean {
  const secret = process.env.SHOPIFY_API_SECRET?.trim();
  if (!secret) return false;

  const signature = url.searchParams.get("signature");
  if (!signature) return false;

  const timestampRaw = url.searchParams.get("timestamp");
  if (!timestampRaw) return false;
  const timestamp = Number(timestampRaw);
  if (!Number.isFinite(timestamp)) return false;
  const skewSec = Math.abs(Date.now() / 1000 - timestamp);
  if (skewSec > APP_PROXY_TIMESTAMP_MAX_SKEW_SEC) return false;

  const messages = [
    hmacMessageFromSearchParams(url.searchParams),
    hmacMessageFromRawQuery(url.search),
    hmacMessageFromRawQueryEncoded(url.search),
  ];
  return messages.some((message) => {
    const digest = crypto
      .createHmac("sha256", secret)
      .update(message)
      .digest("hex");
    return signaturesMatch(digest, signature);
  });
}
