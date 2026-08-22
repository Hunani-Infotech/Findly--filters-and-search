import type {
  HeadersFunction,
  LinksFunction,
  LoaderFunctionArgs,
} from "react-router";
import { Outlet, useLoaderData, useRouteError } from "react-router";
import { NavMenu } from "@shopify/app-bridge-react";
import { AppProvider as PolarisAppProvider } from "@shopify/polaris";
import enTranslations from "@shopify/polaris/locales/en.json";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider as ShopifyAppProvider } from "@shopify/shopify-app-react-router/react";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";
import adminStyles from "../admin.css?url";

import { AdminPendingScreen, ShopifyLoadingBar } from "../components/admin-loading";
import { AdminRouteSkeleton } from "../components/admin-skeletons";
import { authenticate } from "../shopify.server";
import { ensureShop } from "../shop.server";

// Keep Polaris CSS on the /app layout so client navigations do not drop styles.
export const links: LinksFunction = () => [
  { rel: "stylesheet", href: polarisStyles },
  { rel: "stylesheet", href: adminStyles },
];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  await ensureShop(session.shop);

  // eslint-disable-next-line no-undef
  return { apiKey: process.env.SHOPIFY_API_KEY || "" };
};

export function shouldRevalidate({
  currentUrl,
  nextUrl,
  formMethod,
}: {
  currentUrl: URL;
  nextUrl: URL;
  formMethod?: string;
  defaultShouldRevalidate: boolean;
}) {
  const method = formMethod?.toUpperCase();
  if (method && method !== "GET") {
    return false;
  }
  if (currentUrl.pathname.startsWith("/app") && nextUrl.pathname.startsWith("/app")) {
    return false;
  }
  return currentUrl.pathname !== nextUrl.pathname;
}

export default function App() {
  const { apiKey } = useLoaderData<typeof loader>();

  return (
    <ShopifyAppProvider embedded apiKey={apiKey}>
      <PolarisAppProvider i18n={enTranslations}>
        <ShopifyLoadingBar />
        <NavMenu>
          <a href="/app" rel="home">
            Home
          </a>
          <a href="/app">Filters</a>
          <a href="/app/search">Search</a>
          <a href="/app/settings">Settings</a>
          <a href="/app/translation">Translation</a>
          <a href="/app/integrations">Integrations</a>
          <a href="/app/analytics">Analytics</a>
          <a href="/app/billing">Pricing plans</a>
          <a href="/app/contact">Contact</a>
          <a href="/app/sync">Sync</a>
        </NavMenu>
        <div className="findly-admin-shell">
          <AdminPendingScreen>
            <Outlet />
          </AdminPendingScreen>
        </div>
      </PolarisAppProvider>
    </ShopifyAppProvider>
  );
}

export function HydrateFallback() {
  return (
    <PolarisAppProvider i18n={enTranslations}>
      <div className="findly-admin-shell">
        <AdminRouteSkeleton />
      </div>
    </PolarisAppProvider>
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
