import { useEffect } from "react";
import {
  useFetchers,
  useNavigation,
  type Navigation,
} from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { Spinner } from "@shopify/polaris";

/** True while a POST/PUT/PATCH/DELETE form is in flight (not a GET page load). */
export function isMutationBusy(navigation: Navigation) {
  if (navigation.state === "idle") return false;
  const method = navigation.formMethod?.toUpperCase();
  return Boolean(method && method !== "GET");
}

/** True while navigating to a new admin page (loader GET). */
function isPageNavigation(navigation: Navigation) {
  if (navigation.state !== "loading") return false;
  const method = navigation.formMethod?.toUpperCase();
  return !method || method === "GET";
}

export function isNavigatingTo(navigation: Navigation, pathname: string) {
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

/** Keeps the current page visible while the next route loader runs. */
export function AdminNavigationOverlay() {
  const navigation = useNavigation();
  if (!isPageNavigation(navigation)) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 499,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: 140,
        background: "rgba(255, 255, 255, 0.55)",
      }}
      aria-busy="true"
      aria-live="polite"
    >
      <Spinner accessibilityLabel="Loading page" size="large" />
    </div>
  );
}
