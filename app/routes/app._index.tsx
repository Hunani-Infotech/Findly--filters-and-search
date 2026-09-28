import { MS_PER_DAY } from "../constants/limits";
import { useEffect, useRef } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import {
  Link,
  useFetcher,
  useLoaderData,
  useRevalidator,
  useSearchParams,
} from "react-router";
import {
  Badge,
  Banner,
  BlockStack,
  Button,
  Card,
  InlineGrid,
  InlineStack,
  Layout,
  Page,
  Text,
} from "@shopify/polaris";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { authenticateAdminAllowReviewBot } from "../lib/admin-auth.server";
import { log } from "../lib/log.server";
import { PLANS, planDisplayName } from "../constants/plans";
import {
  ensureShopAccess,
  resolvePlanCaps,
  shopPlanDisplayName,
} from "../services/billing.server";
import prisma from "../db.server";
import { queueFullSync } from "../sync/queue-full-sync";
import { recoverStuckSyncIfNeeded } from "../sync/sync.server";
import { SetupGuide } from "../components/setup-guide";
import { HomePerformance } from "../components/home-performance";
import {
  SyncDetailsModal,
  catalogSummaryLabel,
  formatSyncTime,
  syncStatusLabel,
} from "../components/sync-details-modal";
import { loadAnalyticsDashboard } from "../services/analytics.server";
import {
  getSetupProgress,
  isSetupMarkId,
  setSetupMark,
  setThemeSetupFlags,
  themeEditorUrls,
} from "../services/setup-progress.server";
import { overlayThemeFlags, type SetupProgress } from "../utils/setup-progress";
import { useEmbeddedHref } from "../hooks/use-embedded-navigate";
import { useThemeExtensionStatus } from "../hooks/use-theme-extension-status";
import { withEmbeddedParams } from "../utils/admin-path";

export { HomePageSkeleton as HydrateFallback } from "../components/admin-skeletons";

const SYNC_STATUS_POLL_MS = 8000;

const EMPTY_PERFORMANCE = {
  uniqueVisitors: 0,
  ctr: 0,
  noResultRate: 0,
  uniqueDesktop: 0,
  uniqueMobile: 0,
  searchCount: 0,
  filterCount: 0,
};

/** Empty home payload when auth is skipped or the shop query fails. */
function emptyHomeData(shopDomain: string) {
  const editorUrls = themeEditorUrls(shopDomain || "example.myshopify.com");
  const steps: SetupProgress["steps"] = [
    {
      id: "sync",
      number: 1,
      title: "Sync your catalog",
      description: "Index products and collections so filters and search stay fast.",
      href: "/app",
      actionLabel: "Sync catalog",
      status: "todo",
    },
    {
      id: "filters",
      number: 2,
      title: "Configure filters",
      description:
        "Keep the default filter, or add one, so collection pages can use Price, Vendor, Type, and Tags.",
      href: "/app/filters",
      actionLabel: "Open filters",
      status: "todo",
    },
    {
      id: "collection-filters",
      number: 3,
      title: "Enable Collection filters",
      description:
        "In the theme editor App embeds panel, turn on Collection filters.",
      href: editorUrls.collectionFiltersEmbed,
      actionLabel: "Open theme editor",
      status: "todo",
      external: true,
    },
    {
      id: "product-search",
      number: 4,
      title: "Add Product search",
      description:
        "In the theme editor, add Product search to the search template (or header), then save.",
      href: editorUrls.productSearch,
      actionLabel: "Open theme editor",
      status: "todo",
      external: true,
    },
    {
      id: "performance",
      number: 5,
      title: "Check performance",
      description:
        "See how shoppers use search and filters. Counts stay at zero until the widgets are live.",
      href: "/app/analytics",
      actionLabel: "View performance",
      status: "todo",
    },
  ];
  const themeSteps = steps.filter(
    (step) => step.id === "collection-filters" || step.id === "product-search",
  );
  const setup: SetupProgress = {
    shopDomain: shopDomain || "example.myshopify.com",
    collectionCount: 0,
    productCount: 0,
    mappedFilterCount: 0,
    discoveredMetafieldCount: 0,
    syncStatus: "PENDING",
    filterConfigured: false,
    steps,
    themeSteps,
    nextStep: steps[0] ?? null,
    completeCount: 0,
    themeComplete: false,
    allComplete: false,
    showGuide: true,
    editorUrls,
  };

  return {
    setup,
    plan: "free" as const,
    planName: planDisplayName("free", { partnerDevelopment: false }),
    partnerDevelopment: false,
    trialDaysLeft: null,
    sync: {
      status: "PENDING",
      lastFullSyncAt: null,
      lastIncrementalSyncAt: null,
      errorLog: null,
      productCount: 0,
      collectionCount: 0,
      productLimit: PLANS.free.productLimit,
      overProductLimit: false,
      indexingBlocked: PLANS.free.productLimit <= 0,
    },
    performance: EMPTY_PERFORMANCE,
    performanceFrom: new Date(0).toISOString(),
  };
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const auth = await authenticateAdminAllowReviewBot(request);
  if (auth.bot) {
    const shop = new URL(request.url).searchParams.get("shop") || "";
    return emptyHomeData(shop);
  }

  const { session } = auth;

  try {
    const { shop, plan } = await ensureShopAccess(session.shop);

    // Unstick admin "Syncing…" if the bulk finish webhook was missed.
    try {
      await recoverStuckSyncIfNeeded(session.shop);
    } catch (error) {
      log.warn(
        `[home] recoverStuckSync skipped: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    const [setup, syncJob, dashboard, caps] = await Promise.all([
      getSetupProgress(shop.id, session.shop),
      prisma.syncJob.findUnique({
        where: { shopId: shop.id },
        select: {
          status: true,
          lastFullSyncAt: true,
          lastIncrementalSyncAt: true,
          errorLog: true,
        },
      }),
      loadAnalyticsDashboard(shop.id, "last_30", plan).catch((error) => {
        log.warn(
          `[home] analytics skipped: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        return {
          metrics: EMPTY_PERFORMANCE,
          from: new Date(Date.now() - 30 * MS_PER_DAY).toISOString(),
        };
      }),
      resolvePlanCaps(shop.id),
    ]);

    const trialEndsAt = shop.subscription?.trialEndsAt ?? null;
    const trialDaysLeft =
      trialEndsAt && trialEndsAt > new Date()
        ? Math.max(
            1,
            Math.ceil((trialEndsAt.getTime() - Date.now()) / MS_PER_DAY),
          )
        : null;

    return {
      setup,
      plan,
      planName: shopPlanDisplayName(shop),
      partnerDevelopment: Boolean(shop.partnerDevelopment),
      trialDaysLeft,
      sync: {
        status: syncJob?.status ?? "PENDING",
        lastFullSyncAt: syncJob?.lastFullSyncAt?.toISOString() ?? null,
        lastIncrementalSyncAt:
          syncJob?.lastIncrementalSyncAt?.toISOString() ?? null,
        errorLog: syncJob?.errorLog ?? null,
        productCount: setup.productCount,
        collectionCount: setup.collectionCount,
        productLimit: caps.productLimit,
        overProductLimit: setup.productCount > caps.productLimit,
        indexingBlocked: caps.productLimit <= 0,
      },
      performance: dashboard.metrics,
      performanceFrom: dashboard.from,
    };
  } catch (error) {
    log.error(
      `[home] loader degraded shop=${session.shop}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return emptyHomeData(session.shop);
  }
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const { shop } = await ensureShopAccess(session.shop);
  const form = await request.formData();
  const intent = String(form.get("intent") || "");

  if (intent === "setup-theme") {
    const step = String(form.get("step") || "");
    if (!isSetupMarkId(step)) {
      return { ok: false, intent: "setup-theme" as const };
    }
    const done = String(form.get("done") || "true") !== "false";
    await setSetupMark(shop.id, step, done);
    return { ok: true, intent: "setup-theme" as const, step, done };
  }

  if (intent === "sync-theme-status") {
    await setThemeSetupFlags(shop.id, {
      "collection-filters": String(form.get("collection-filters")) === "true",
      "product-search": String(form.get("product-search")) === "true",
      "instant-search": String(form.get("instant-search")) === "true",
    });
    return { ok: true, intent: "sync-theme-status" as const };
  }

  if (intent === "sync") {
    try {
      await queueFullSync(session.shop);
      return { ok: true, intent: "sync" as const };
    } catch {
      return { ok: false, intent: "sync" as const };
    }
  }

  return { ok: false };
};

export default function Home() {
  const data = useLoaderData<typeof loader>();
  const hrefFor = useEmbeddedHref();
  const shopify = useAppBridge();
  const [searchParams, setSearchParams] = useSearchParams();
  const revalidator = useRevalidator();
  const revalidatorRef = useRef(revalidator);
  const syncFetcher = useFetcher<typeof action>();
  const statusFetcher = useFetcher<{
    status: string;
    lastFullSyncAt: string | null;
    lastIncrementalSyncAt: string | null;
    errorLog: string | null;
  }>();
  const lastSyncResult = useRef<unknown>(null);
  const { setup: setupLoaded } = data;
  const liveThemeFlags = useThemeExtensionStatus(shopify, setupLoaded);
  const setup = liveThemeFlags
    ? overlayThemeFlags(setupLoaded, liveThemeFlags)
    : setupLoaded;
  const polled = statusFetcher.data;
  const sync = {
    ...data.sync,
    ...(polled
      ? {
          status: polled.status,
          lastFullSyncAt: polled.lastFullSyncAt,
          lastIncrementalSyncAt: polled.lastIncrementalSyncAt,
          errorLog: polled.errorLog,
        }
      : {}),
  };
  const syncOpen = searchParams.get("sync") === "1";
  const embedReady = setup.themeSteps.some(
    (step) => step.id === "collection-filters" && step.status === "complete",
  );
  const searchReady = setup.themeSteps.some(
    (step) => step.id === "product-search" && step.status === "complete",
  );
  const embedStep = setup.themeSteps.find((step) => step.id === "collection-filters");
  const searchStep = setup.themeSteps.find((step) => step.id === "product-search");
  const wasShowingGuide = useRef(setup.showGuide);
  const queuedOk = Boolean(
    syncFetcher.data?.intent === "sync" && syncFetcher.data.ok,
  );
  const shouldPoll =
    sync.status === "SYNCING" ||
    syncFetcher.state !== "idle" ||
    (queuedOk && sync.status !== "READY" && sync.status !== "ERROR");
  const syncBusy = shouldPoll;
  const prevPolledStatus = useRef(sync.status);
  const statusFetcherRef = useRef(statusFetcher);

  useEffect(() => {
    revalidatorRef.current = revalidator;
    statusFetcherRef.current = statusFetcher;
  });

  const openSync = () => {
    const next = new URLSearchParams(searchParams);
    next.set("sync", "1");
    setSearchParams(next, { replace: true });
  };

  const closeSync = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("sync");
    setSearchParams(next, { replace: true });
  };

  useEffect(() => {
    if (wasShowingGuide.current && !setup.showGuide) {
      shopify.toast.show(
        "Setup complete. Filters and search are ready on your storefront.",
      );
    }
    wasShowingGuide.current = setup.showGuide;
  }, [setup.showGuide, shopify]);

  useEffect(() => {
    const result = syncFetcher.data;
    if (!result || syncFetcher.state !== "idle") return;
    if (lastSyncResult.current === result) return;
    lastSyncResult.current = result;
    if (result.intent !== "sync") return;
    shopify.toast.show(
      result.ok ? "Catalog sync started" : "Could not start sync",
      result.ok ? undefined : { isError: true },
    );
  }, [syncFetcher.data, syncFetcher.state, shopify]);

  const startSync = () => {
    if (syncBusy) return;
    const formData = new FormData();
    formData.set("intent", "sync");
    syncFetcher.submit(formData, { method: "POST" });
    if (!syncOpen) openSync();
  };

  const startedRunParam = useRef(false);
  useEffect(() => {
    if (searchParams.get("run") !== "1") return;
    if (startedRunParam.current) return;
    startedRunParam.current = true;
    const formData = new FormData();
    formData.set("intent", "sync");
    syncFetcher.submit(formData, { method: "POST" });
    const next = new URLSearchParams(searchParams);
    next.delete("run");
    next.set("sync", "1");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, syncFetcher]);

  // Light status poll only �?? avoid reloading analytics on the home loader.
  useEffect(() => {
    if (!shouldPoll) return;
    const statusUrl = withEmbeddedParams("/app/sync/status", searchParams);
    const tick = () => {
      if (statusFetcherRef.current.state !== "idle") return;
      statusFetcherRef.current.load(statusUrl);
    };
    tick();
    const intervalId = window.setInterval(tick, SYNC_STATUS_POLL_MS);
    return () => window.clearInterval(intervalId);
  }, [shouldPoll, searchParams]);

  // One full refresh when sync leaves SYNCING so product counts update.
  useEffect(() => {
    const prev = prevPolledStatus.current;
    prevPolledStatus.current = sync.status;
    if (prev === "SYNCING" && sync.status !== "SYNCING") {
      void revalidatorRef.current.revalidate();
    }
  }, [sync.status]);

  return (
    <Page>
      <div className="findly-home-hero">
        <p className="findly-home-hero-kicker">Filters &amp; Search</p>
        <h1 className="findly-home-hero-title">
          Welcome to <span>Findly</span>
        </h1>
        <p className="findly-home-hero-sub">
          {setup.showGuide
            ? "Finish these steps to show filters and search on your store."
            : "Manage filters, search, and catalog sync from here."}
        </p>
      </div>
      <Layout>
        <Layout.Section>
          <BlockStack gap="400">
            {setup.showGuide ? <SetupGuide progress={setup} /> : null}

            {!setup.showGuide && !embedReady ? (
              <Banner
                title="Last step: activate on your theme"
                tone="info"
                action={{
                  content: "Open theme editor",
                  url: setup.editorUrls.collectionFiltersEmbed,
                  target: "_blank",
                }}
              >
                <p>
                  In the theme editor, turn on Collection filters (app embed), or
                  add the Collection filters block to the collection template.
                  Save, then return here — we detect it automatically.
                </p>
              </Banner>
            ) : null}

            {!setup.showGuide ? (
              <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
                <Card>
                  <BlockStack gap="200">
                    <InlineStack align="space-between" blockAlign="center" wrap gap="200">
                      <Text as="h2" variant="headingMd">
                        Collection filters
                      </Text>
                      <Badge tone={embedReady ? "success" : "attention"}>
                        {embedReady ? "Active" : "Inactive"}
                      </Badge>
                    </InlineStack>
                    <Text as="p" variant="bodySm" tone="subdued">
                      {embedReady
                        ? "Collection filters is on for collection pages."
                        : "Add Collection filters to the collection template in the theme editor."}
                    </Text>
                    <InlineStack>
                      <Button
                        url={
                          embedReady
                            ? embedStep?.href || setup.editorUrls.collectionFilters
                            : setup.editorUrls.collectionFiltersEmbed
                        }
                        target="_blank"
                        variant={embedReady ? "secondary" : "primary"}
                      >
                        Open theme editor
                      </Button>
                    </InlineStack>
                  </BlockStack>
                </Card>
                <Card>
                  <BlockStack gap="200">
                    <InlineStack align="space-between" blockAlign="center" wrap gap="200">
                      <Text as="h2" variant="headingMd">
                        Product search
                      </Text>
                      <Badge tone={searchReady ? "success" : "attention"}>
                        {searchReady ? "Added" : "Not added"}
                      </Badge>
                    </InlineStack>
                    <Text as="p" variant="bodySm" tone="subdued">
                      {searchReady
                        ? "Product search is on the search template."
                        : "Add the Product search block in the theme editor."}
                    </Text>
                    <InlineStack>
                      <Button
                        url={searchStep?.href || setup.editorUrls.productSearch}
                        target="_blank"
                        variant={searchReady ? "secondary" : "primary"}
                      >
                        {searchReady ? "Open search editor" : "Add"}
                      </Button>
                    </InlineStack>
                  </BlockStack>
                </Card>
              </InlineGrid>
            ) : null}

            <Card>
              <InlineStack align="space-between" blockAlign="center" wrap gap="300">
                <BlockStack gap="050">
                  <Text as="h2" variant="headingMd">
                    {data.trialDaysLeft ? "Trial" : "Plan"}
                  </Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    {data.trialDaysLeft
                      ? `${data.trialDaysLeft} day${data.trialDaysLeft === 1 ? "" : "s"} left on ${data.planName}.`
                      : data.plan === "free" && !data.partnerDevelopment
                        ? "No paid plan yet. Choose Standard or Pro to index your catalog."
                        : `You are on ${data.planName}.`}
                  </Text>
                </BlockStack>
                <Link to={hrefFor("/app/billing")} className="findly-plain-btn">
                  {data.plan === "free" || data.trialDaysLeft
                    ? "Choose plan"
                    : "Manage plan"}
                </Link>
              </InlineStack>
            </Card>

            <Card>
              <BlockStack gap="300">
                <InlineStack align="space-between" blockAlign="center" wrap gap="200">
                  <Text as="h2" variant="headingMd">
                    Catalog sync
                  </Text>
                  <InlineStack gap="200" wrap>
                    <Button onClick={openSync}>View details</Button>
                    <Button
                      variant="primary"
                      loading={syncFetcher.state !== "idle"}
                      disabled={syncBusy}
                      onClick={startSync}
                    >
                      {syncBusy && syncFetcher.state === "idle"
                        ? "Syncing…"
                        : "Sync now"}
                    </Button>
                  </InlineStack>
                </InlineStack>
                {sync.indexingBlocked ? (
                  <Banner tone="warning" title="Choose a plan to index products">
                    <p>
                      Live stores without a paid plan do not index products.
                      Standard allows {PLANS.standard.productLimit} products;
                      Pro allows {PLANS.pro.productLimit}. Collections can
                      still sync.{" "}
                      <Link
                        to={hrefFor("/app/billing")}
                        className="findly-plain-btn"
                      >
                        Choose a plan
                      </Link>
                    </p>
                  </Banner>
                ) : null}
                {sync.status === "ERROR" ? (
                  <Banner tone="critical" title="Sync needs another try">
                    <p>
                      Click Sync now to run it again, or open View details for
                      the full error.
                    </p>
                  </Banner>
                ) : null}
                <InlineGrid columns={{ xs: 1, sm: 2, md: 4 }} gap="300">
                  <BlockStack gap="050">
                    <Text as="p" variant="bodySm" tone="subdued">
                      Status
                    </Text>
                    <Text as="p" variant="bodyMd" fontWeight="medium">
                      {syncStatusLabel(sync.status, sync.indexingBlocked)}
                    </Text>
                  </BlockStack>
                  <BlockStack gap="050">
                    <Text as="p" variant="bodySm" tone="subdued">
                      Last full sync
                    </Text>
                    <Text as="p" variant="bodyMd" fontWeight="medium">
                      {formatSyncTime(sync.lastFullSyncAt)}
                    </Text>
                  </BlockStack>
                  <BlockStack gap="050">
                    <Text as="p" variant="bodySm" tone="subdued">
                      Last update
                    </Text>
                    <Text as="p" variant="bodyMd" fontWeight="medium">
                      {formatSyncTime(sync.lastIncrementalSyncAt)}
                    </Text>
                  </BlockStack>
                  <BlockStack gap="050">
                    <Text as="p" variant="bodySm" tone="subdued">
                      Catalog
                    </Text>
                    <Text as="p" variant="bodyMd" fontWeight="medium">
                      {catalogSummaryLabel({
                        productCount: setup.productCount,
                        productLimit: sync.productLimit,
                        collectionCount: setup.collectionCount,
                        indexingBlocked: sync.indexingBlocked,
                      })}
                    </Text>
                  </BlockStack>
                </InlineGrid>
              </BlockStack>
            </Card>

            <HomePerformance
              metrics={{ ...data.performance, from: data.performanceFrom }}
              viewHref={hrefFor("/app/analytics")}
            />
          </BlockStack>
        </Layout.Section>
      </Layout>
      <SyncDetailsModal
        open={syncOpen}
        data={{
          status: sync.status,
          lastFullSyncAt: sync.lastFullSyncAt,
          lastIncrementalSyncAt: sync.lastIncrementalSyncAt,
          errorLog: sync.errorLog,
          productCount: sync.productCount,
          collectionCount: sync.collectionCount,
          productLimit: sync.productLimit,
          plan: data.plan,
          planName: data.planName,
          overProductLimit: sync.overProductLimit,
          indexingBlocked: sync.indexingBlocked,
        }}
        billingHref={hrefFor("/app/billing")}
        settingsHref={hrefFor("/app/settings")}
        metafieldsHref={hrefFor("/app/settings?tab=metafields")}
        defaultFiltersHref={hrefFor("/app/collections/default")}
        busy={syncBusy}
        submitting={syncFetcher.state !== "idle"}
        onClose={closeSync}
        onSync={startSync}
      />
    </Page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
