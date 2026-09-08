import type { ReactNode } from "react";
import { lazy, Suspense, useEffect } from "react";
import {
  useFetchers,
  useLocation,
  useNavigation,
} from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";

type NavigationState = {
  state: string;
  formMethod?: string | undefined;
  location?: { pathname: string } | undefined;
};

/** True while a POST/PUT/PATCH/DELETE form is in flight (not a GET page load). */
export function isMutationBusy(navigation: NavigationState) {
  if (navigation.state === "idle") return false;
  const method = navigation.formMethod?.toUpperCase();
  return Boolean(method && method !== "GET");
}

/** True while navigating to a new admin page (loader GET). */
function isPageNavigation(navigation: NavigationState) {
  if (navigation.state !== "loading") return false;
  const method = navigation.formMethod?.toUpperCase();
  return !method || method === "GET";
}

/** True when the destination pathname is different (not tab/search-param revalidation). */
function isPageSwitch(
  navigation: NavigationState,
  currentPathname: string,
) {
  if (!isPageNavigation(navigation)) return false;
  const nextPath = navigation.location?.pathname;
  if (!nextPath) return false;
  return nextPath !== currentPathname;
}

export function isNavigatingTo(navigation: NavigationState, pathname: string) {
  return (
    isPageNavigation(navigation) && navigation.location?.pathname === pathname
  );
}

/** Shopify admin top loading bar for every navigation and fetcher request. */
export function ShopifyLoadingBar() {
  const navigation = useNavigation();
  const fetchers = useFetchers();
  const shopify = useAppBridge();
  const busy =
    navigation.state !== "idle" || fetchers.some((fetcher) => fetcher.state !== "idle");

  useEffect(() => {
    shopify.loading(busy);
    return () => {
      shopify.loading(false);
    };
  }, [busy, shopify]);

  return null;
}

const LazyAdminRouteSkeleton = lazy(() =>
  import("./admin-skeletons").then((m) => ({
    default: m.AdminRouteSkeleton,
  })),
);

/**
 * Destination skeleton for GET page switches. Sibling of `<Outlet />` so
 * `useNavigation()` updates do not re-render the active page (mutations /
 * revalidation). Skeletons load on demand (~131KB off the layout critical path).
 */
function AdminPendingSkeleton() {
  const navigation = useNavigation();
  const location = useLocation();
  if (!isPageSwitch(navigation, location.pathname)) return null;

  return (
    <div
      className="findly-pending-overlay"
      aria-busy="true"
      aria-live="polite"
    >
      <Suspense fallback={null}>
        <LazyAdminRouteSkeleton pathname={navigation.location?.pathname} />
      </Suspense>
    </div>
  );
}

/**
 * While a GET navigation to another admin path is in flight, cover the current
 * page with a destination skeleton so the iframe never goes blank.
 */
export function AdminPendingScreen({ children }: { children: ReactNode }) {
  return (
    <div className="findly-pending-root">
      <AdminPendingSkeleton />
      {children}
    </div>
  );
}

const LOAD_RETRY_KEY = "findly-admin-load-retry";
const LOAD_RETRY_WINDOW_MS = 20_000;
const LOAD_RETRY_MAX = 2;

function readLoadRetryCount() {
  try {
    const raw = sessionStorage.getItem(LOAD_RETRY_KEY);
    if (!raw) return 0;
    const parsed = JSON.parse(raw) as { count?: number; at?: number };
    if (Date.now() - (parsed.at ?? 0) > LOAD_RETRY_WINDOW_MS) return 0;
    return Number(parsed.count) || 0;
  } catch {
    return 0;
  }
}

function bumpLoadRetryCount() {
  const count = readLoadRetryCount() + 1;
  try {
    sessionStorage.setItem(
      LOAD_RETRY_KEY,
      JSON.stringify({ count, at: Date.now() }),
    );
  } catch {
    /* private mode */
  }
  return count;
}

/** Clear after a successful admin render so a later blip can retry again. */
export function clearAdminLoadRetry() {
  try {
    sessionStorage.removeItem(LOAD_RETRY_KEY);
  } catch {
    /* private mode */
  }
}

/**
 * Transient loader/auth blips show the page skeleton and reload instead of the
 * error card. After a couple of failed reloads, `fallback` is shown.
 */
export function AdminLoadRetry({
  fallback,
  enabled = true,
}: {
  fallback: ReactNode;
  enabled?: boolean;
}) {
  const location = useLocation();
  const gaveUp = !enabled || readLoadRetryCount() >= LOAD_RETRY_MAX;

  useEffect(() => {
    if (!enabled || gaveUp) return;
    const timer = window.setTimeout(() => {
      bumpLoadRetryCount();
      window.location.reload();
    }, 250);
    return () => window.clearTimeout(timer);
  }, [enabled, gaveUp]);

  if (gaveUp) return <>{fallback}</>;

  return (
    <div className="findly-admin-shell" aria-busy="true" aria-live="polite">
      <Suspense fallback={null}>
        <LazyAdminRouteSkeleton pathname={location.pathname} />
      </Suspense>
    </div>
  );
}
