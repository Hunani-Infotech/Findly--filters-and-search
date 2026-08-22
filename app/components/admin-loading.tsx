import type { ReactNode } from "react";
import { useEffect } from "react";
import {
  useFetchers,
  useLocation,
  useNavigation,
} from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { AdminRouteSkeleton } from "./admin-skeletons";

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
export function isPageSwitch(
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

/**
 * While a GET navigation to another admin path is in flight, swap the current
 * page for a destination skeleton so the iframe never goes blank.
 */
export function AdminPendingScreen({ children }: { children: ReactNode }) {
  const navigation = useNavigation();
  const location = useLocation();
  if (!isPageSwitch(navigation, location.pathname)) return children;

  return (
    <div aria-busy="true" aria-live="polite">
      <AdminRouteSkeleton pathname={navigation.location?.pathname} />
    </div>
  );
}
