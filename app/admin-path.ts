import { useCallback } from "react";
import {
  useNavigate,
  useSearchParams,
  type NavigateOptions,
} from "react-router";

/** Query keys Shopify auth needs on document requests in the admin iframe. */
const EMBEDDED_KEYS = [
  "shop",
  "host",
  "embedded",
  "id_token",
  "hmac",
  "timestamp",
  "session",
  "locale",
] as const;

/**
 * Keep Shopify embedded session params on an in-app path.
 * Polaris `url` / full reloads without these render a blank App Bridge page.
 */
export function withEmbeddedParams(
  pathname: string,
  current: URLSearchParams | string,
): string {
  const [path, extra = ""] = pathname.split("?");
  const next = new URLSearchParams(extra);
  const from =
    typeof current === "string"
      ? new URLSearchParams(
          current.startsWith("?") ? current.slice(1) : current,
        )
      : current;
  for (const key of EMBEDDED_KEYS) {
    const value = from.get(key);
    if (value && !next.has(key)) next.set(key, value);
  }
  const qs = next.toString();
  return qs ? `${path}?${qs}` : path;
}

export function withEmbeddedParamsFromRequest(
  request: Request,
  pathname: string,
): string {
  return withEmbeddedParams(pathname, new URL(request.url).searchParams);
}

/**
 * Client navigate that always keeps shop/host (and related) query params.
 * Use this instead of useNavigate() for in-app /app/... links.
 * Do not put those paths on Polaris `url=` — that does a full reload
 * without params and App Bridge logs `shop: null`.
 */
export function useEmbeddedNavigate() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  return useCallback(
    (to: string, options?: NavigateOptions) => {
      navigate(withEmbeddedParams(to, searchParams), options);
    },
    [navigate, searchParams],
  );
}
