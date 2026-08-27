import { useCallback } from "react";
import {
  useNavigate,
  useSearchParams,
  type NavigateOptions,
} from "react-router";
import { withEmbeddedParams } from "../utils/admin-path";

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

/** In-app href that keeps Shopify embedded session params. */
export function useEmbeddedHref() {
  const [searchParams] = useSearchParams();
  return useCallback(
    (to: string) => withEmbeddedParams(to, searchParams),
    [searchParams],
  );
}
