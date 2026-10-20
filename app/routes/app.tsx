import type {
  HeadersFunction,
  LinksFunction,
  LoaderFunctionArgs,
} from "react-router";
import { lazy, Suspense, useEffect } from "react";
import {
  isRouteErrorResponse,
  Outlet,
  useFetcher,
  useLoaderData,
  useRouteError,
} from "react-router";
import { NavMenu, useAppBridge } from "@shopify/app-bridge-react";
import {
  AppProvider as PolarisAppProvider,
  Banner,
  BlockStack,
  Button,
  Card,
  Page,
} from "@shopify/polaris";
import enTranslations from "@shopify/polaris/locales/en.json";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider as ShopifyAppProvider } from "@shopify/shopify-app-react-router/react";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";
import adminStyles from "../styles/admin.css?url";

import {
  AdminLoadRetry,
  AdminPendingScreen,
  clearAdminLoadRetry,
  hardRefreshAdmin,
  ShopifyLoadingBar,
} from "../components/admin-loading";
import {
  adminApiKey,
  authenticateAdminAllowReviewBot,
} from "../lib/admin-auth.server";
import { log } from "../lib/log.server";
import { ensureShop } from "../services/shop.server";
import {
  ensureShopAccess,
  isAllowedShopifyConfirmationUrl,
  reconcileBillingFromShopify,
  resolveBillingApproveGate,
  startStandardSubscriptionIfLive,
  type BillingApproveGate,
} from "../services/billing.server";
import { findShopCached } from "../lib/shop-cache.server";
import { appUrl } from "../shopify.server";
import { embeddedAdminAppUrl } from "../utils/admin-path";

const BILLING_GATE_BOT: BillingApproveGate = {
  show: false,
  reason: null,
  confirmationUrl: null,
  title: "",
  message: "",
  ctaLabel: "Choose plan",
};

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
    return {
      apiKey: adminApiKey(),
      bot: true as const,
      billingGate: BILLING_GATE_BOT,
    };
  }

  let billingGate: BillingApproveGate = BILLING_GATE_BOT;
  try {
    await ensureShop(auth.session.shop);
    // I-4 backup if afterAuth reconcile missed: Shopify → local before kickoff/access.
    const shopRow = await findShopCached(auth.session.shop);
    if (shopRow) {
      try {
        await reconcileBillingFromShopify(auth.admin, shopRow.id);
      } catch (error) {
        log.warn(
          `[app] billing reconcile skipped shop=${auth.session.shop}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
    const path = new URL(request.url).pathname;
    const skipBillingKickoff =
      path.includes("/billing") ||
      new URL(request.url).searchParams.has("charge_id");

    let kickoffUrl: string | null = null;
    if (!skipBillingKickoff) {
      const returnUrl =
        embeddedAdminAppUrl(auth.session.shop, "/app/billing") ??
        `${appUrl.replace(/\/$/, "")}/app/billing?shop=${encodeURIComponent(auth.session.shop)}`;
      // Create/reuse charge once — do NOT auto-redirect (B-9: in-app banner only).
      const started = await startStandardSubscriptionIfLive(
        auth.admin,
        auth.session.shop,
        returnUrl,
      );
      if (
        started?.confirmationUrl &&
        isAllowedShopifyConfirmationUrl(started.confirmationUrl)
      ) {
        kickoffUrl = started.confirmationUrl;
      }
    }

    const { shop } = await ensureShopAccess(auth.session.shop);
    billingGate = resolveBillingApproveGate(shop);
    // Prefer kickoff URL if shop cache is briefly stale after create/reuse.
    if (kickoffUrl) {
      billingGate = {
        ...billingGate,
        show: true,
        reason: "pending",
        confirmationUrl: kickoffUrl,
        title: billingGate.reason === "pending" ? billingGate.title : "Approve your plan",
        message:
          billingGate.reason === "pending"
            ? billingGate.message
            : "Shopify is waiting for you to approve the Findly subscription charge. Open the approval page to finish setup — nothing is locked until you decide.",
        ctaLabel: "Approve plan",
      };
    }
  } catch (error) {
    if (error instanceof Response) throw error;
    // Stay on 200. Child loaders call ensureShopAccess again.
    log.error(
      `[app] ensureShop failed shop=${auth.session.shop}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  return {
    apiKey: adminApiKey(),
    bot: false as const,
    billingGate,
  };
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
  const { apiKey, billingGate } = useLoaderData<typeof loader>();

  useEffect(() => {
    clearAdminLoadRetry();
  }, []);

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
          <a href="/app/analytics">Analytics</a>
          <a href="/app/billing">Pricing plans</a>
          <a href="/app/contact">Contact</a>
        </NavMenu>
        <div className="findly-admin-shell">
          <AdminPendingScreen>
            {billingGate.show ? (
              <div style={{ padding: "16px 16px 0" }}>
                <Banner tone="warning" title={billingGate.title}>
                  <BlockStack gap="200">
                    <p>{billingGate.message}</p>
                    {billingGate.confirmationUrl ? (
                      <ApprovePlanButton label={billingGate.ctaLabel} />
                    ) : (
                      <Button url="/app/billing" variant="primary">
                        {billingGate.ctaLabel}
                      </Button>
                    )}
                  </BlockStack>
                </Banner>
              </div>
            ) : null}
            <Outlet />
          </AdminPendingScreen>
        </div>
      </PolarisAppProvider>
    </ShopifyAppProvider>
  );
}

function ApprovePlanButton({ label }: { label: string }) {
  const fetcher = useFetcher<{ error?: string }>();
  const shopify = useAppBridge();
  const approving = ["loading", "submitting"].includes(fetcher.state);

  useEffect(() => {
    const error =
      fetcher.data && "error" in fetcher.data ? fetcher.data.error : null;
    if (error) shopify.toast.show(String(error), { isError: true });
  }, [fetcher.data, shopify]);

  return (
    <Button
      variant="primary"
      loading={approving}
      onClick={() =>
        fetcher.submit(
          { intent: "approve_pending" },
          { method: "POST", action: "/app/billing" },
        )
      }
    >
      {label}
    </Button>
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

  const retry =
    !isRouteErrorResponse(error) ||
    error.status >= 500 ||
    error.status === 408 ||
    error.status === 429;

  return (
    <PolarisAppProvider i18n={enTranslations}>
      <AdminLoadRetry
        enabled={retry}
        fallback={
          <div className="findly-admin-shell">
            <Page title="Server under maintenance">
              <Card>
                <BlockStack gap="300">
                  <Banner tone="warning" title="Findly is temporarily unavailable">
                    <p>
                      Our server is under maintenance. Please try again in a few
                      minutes, or reopen Findly from Shopify Admin.
                    </p>
                  </Banner>
                  <Button onClick={hardRefreshAdmin}>Try again</Button>
                </BlockStack>
              </Card>
            </Page>
          </div>
        }
      />
    </PolarisAppProvider>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
