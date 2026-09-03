import type {
  HeadersFunction,
  LinksFunction,
  LoaderFunctionArgs,
} from "react-router";
import { lazy, Suspense } from "react";
import {
  isRouteErrorResponse,
  Outlet,
  useLoaderData,
  useRouteError,
} from "react-router";
import { NavMenu } from "@shopify/app-bridge-react";
import {
  AppProvider as PolarisAppProvider,
  Banner,
  BlockStack,
  Card,
  Page,
  Text,
} from "@shopify/polaris";
import enTranslations from "@shopify/polaris/locales/en.json";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider as ShopifyAppProvider } from "@shopify/shopify-app-react-router/react";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";
import adminStyles from "../styles/admin.css?url";

import { AdminPendingScreen, ShopifyLoadingBar } from "../components/admin-loading";
import {
  adminApiKey,
  authenticateAdminAllowReviewBot,
} from "../lib/admin-auth.server";
import { log } from "../lib/log.server";
import { ensureShop } from "../services/shop.server";

const LazyAdminRouteSkeleton = lazy(() =>
  import("../components/admin-skeletons").then((m) => ({
    default: m.AdminRouteSkeleton,
  })),
);

// Keep Polaris CSS on the /app layout so client navigations do not drop styles.
export const links: LinksFunction = () => [
  { rel: "stylesheet", href: polarisStyles },
  { rel: "stylesheet", href: adminStyles },
];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const auth = await authenticateAdminAllowReviewBot(request);
  if (auth.bot) {
    return { apiKey: adminApiKey(), bot: true as const };
  }

  try {
    await ensureShop(auth.session.shop);
  } catch (error) {
    // Stay on 200. Child loaders call ensureShopAccess again.
    log.error(
      `[app] ensureShop failed shop=${auth.session.shop}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  return { apiKey: adminApiKey(), bot: false as const };
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
          <a href="/app/filters">Filters</a>
          <a href="/app/search">Search</a>
          <a href="/app/settings">Settings</a>
          <a href="/app/translation">Translation</a>
          <a href="/app/integrations">Integrations</a>
          <a href="/app/analytics">Analytics</a>
          <a href="/app/billing">Pricing plans</a>
          <a href="/app/contact">Contact</a>
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
      <div className="findly-admin-shell" aria-busy="true">
        <Suspense fallback={null}>
          <LazyAdminRouteSkeleton />
        </Suspense>
      </div>
    </PolarisAppProvider>
  );
}

/**
 * App Bridge reauth needs boundary.error. Other errors get a Polaris page —
 * boundary.error also swallows 410/404/500 with no Shopify HTML.
 */
function isShopifyHtmlAuthResponse(error: unknown) {
  if (!isRouteErrorResponse(error)) return false;
  if (error.status === 401 || error.status === 302 || error.status === 303) {
    return true;
  }
  return typeof error.data === "string" && /<\s*(script|html|body)/i.test(error.data);
}

export function ErrorBoundary() {
  const error = useRouteError();

  if (isShopifyHtmlAuthResponse(error)) {
    try {
      return boundary.error(error);
    } catch {
      /* non-HTML Responses fall through */
    }
  }

  const detail = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`.trim()
    : error instanceof Error
      ? error.message
      : null;

  return (
    <PolarisAppProvider i18n={enTranslations}>
      <div className="findly-admin-shell">
        <Page title="Something went wrong">
          <Card>
            <BlockStack gap="300">
              <Banner tone="critical" title="Findly could not load this page">
                <p>
                  Try again, or reopen Findly from Shopify Admin. If this keeps
                  happening, contact support.
                </p>
              </Banner>
              {detail ? (
                <Text as="p" tone="subdued" variant="bodySm">
                  {detail}
                </Text>
              ) : null}
            </BlockStack>
          </Card>
        </Page>
      </div>
    </PolarisAppProvider>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
