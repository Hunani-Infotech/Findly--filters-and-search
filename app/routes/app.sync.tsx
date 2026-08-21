import { useEffect, useRef } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import {
  useFetcher,
  useLoaderData,
  useRevalidator,
  useSearchParams,
} from "react-router";
import {
  Banner,
  BlockStack,
  Card,
  InlineStack,
  Layout,
  Link,
  List,
  Page,
  Spinner,
  Text,
} from "@shopify/polaris";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { enforcePlanLimits, ensureShopAccess } from "../billing.server";
import { enqueueSyncJob } from "../queues.server";
import { useEmbeddedNavigate, withEmbeddedParams } from "../admin-path";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const { shop } = await ensureShopAccess(session.shop);
  const syncJob = await prisma.syncJob.findUnique({
    where: { shopId: shop.id },
  });
  const limits = await enforcePlanLimits(shop.id);

  return {
    syncJob,
    productCount: limits.productCount,
    productLimit: limits.productLimit,
    plan: limits.plan,
    overProductLimit: limits.overProductLimit,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  await ensureShopAccess(session.shop);

  try {
    await enqueueSyncJob(
      "shop.fullSync",
      { shop: session.shop },
      { jobId: `${session.shop}:shop.fullSync` },
    );
    return { ok: true };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to queue full sync",
    };
  }
};

export default function SyncPage() {
  const data = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const revalidator = useRevalidator();
  const shopify = useAppBridge();
  const navigate = useEmbeddedNavigate();
  const [searchParams] = useSearchParams();
  const revalidatorRef = useRef(revalidator);
  useEffect(() => {
    revalidatorRef.current = revalidator;
  });

  const queueing =
    ["loading", "submitting"].includes(fetcher.state) &&
    fetcher.formMethod === "POST";
  const syncing = data.syncJob?.status === "SYNCING";
  const queuedOk = Boolean(
    fetcher.data && "ok" in fetcher.data && fetcher.data.ok,
  );
  const status = data.syncJob?.status;
  const shouldPoll =
    syncing || (queuedOk && status !== "READY" && status !== "ERROR");
  const busy = queueing || shouldPoll;

  useEffect(() => {
    if (fetcher.data && "ok" in fetcher.data && fetcher.data.ok) {
      shopify.toast.show("Full sync queued");
    }
    if (fetcher.data && "error" in fetcher.data && fetcher.data.error) {
      shopify.toast.show(fetcher.data.error, { isError: true });
    }
  }, [fetcher.data, shopify]);

  useEffect(() => {
    if (!shouldPoll) return;

    const intervalId = window.setInterval(() => {
      if (revalidatorRef.current.state === "loading") return;
      void revalidatorRef.current.revalidate();
    }, 4000);

    return () => window.clearInterval(intervalId);
  }, [shouldPoll]);

  const job = data.syncJob;

  return (
    <Page
      title="Sync"
      primaryAction={{
        content: queueing ? "Queueing…" : shouldPoll ? "Syncing…" : "Run full sync",
        loading: busy,
        disabled: busy,
        onAction: () => fetcher.submit({}, { method: "POST" }),
      }}
    >
      <Layout>
        <Layout.Section>
          <BlockStack gap="400">
            {data.overProductLimit && (
              <Banner tone="warning">
                <p>
                  Product limit reached ({data.productCount}/
                  {data.productLimit} on {data.plan}). Upgrade on{" "}
                  <Link url={withEmbeddedParams("/app/billing", searchParams)}>
                    Billing
                  </Link>{" "}
                  for a higher cap.
                </p>
              </Banner>
            )}

            {job?.status === "READY" && !data.overProductLimit ? (
              <Banner
                tone="success"
                action={{
                  content: "Set default filters",
                  onAction: () => navigate("/app/collections/default"),
                }}
              >
                <p>
                  Catalog is ready. Next:{" "}
                  <Link
                    url={withEmbeddedParams("/app/settings?tab=metafields", searchParams)}
                  >
                    map metafields
                  </Link>{" "}
                  if you use custom attributes, then set shop-wide default
                  filters, then open{" "}
                  <Link
                    url={withEmbeddedParams("/app/settings", searchParams)}
                  >
                    Settings
                  </Link>{" "}
                  for layout,
                  search, and sort.
                </p>
              </Banner>
            ) : null}

            <Card>
              <BlockStack gap="200">
                <Text as="h2" variant="headingMd">
                  Status
                </Text>
                {syncing ? (
                  <InlineStack gap="200" blockAlign="center">
                    <Spinner accessibilityLabel="Syncing catalog" size="small" />
                    <Text as="p">Catalog sync in progress…</Text>
                  </InlineStack>
                ) : null}
                <Text as="p">Plan: {data.plan}</Text>
                <Text as="p">Status: {job?.status ?? "PENDING"}</Text>
                <Text as="p">
                  Last full sync:{" "}
                  {job?.lastFullSyncAt
                    ? new Date(job.lastFullSyncAt).toLocaleString()
                    : "Never"}
                </Text>
                <Text as="p">
                  Last incremental sync:{" "}
                  {job?.lastIncrementalSyncAt
                    ? new Date(job.lastIncrementalSyncAt).toLocaleString()
                    : "Never"}
                </Text>
                <Text as="p">
                  Indexed products: {data.productCount} / {data.productLimit}
                </Text>
                {job?.errorLog ? (
                  <Banner tone="critical">
                    <p>{job.errorLog}</p>
                  </Banner>
                ) : null}
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="200">
                <Text as="h2" variant="headingMd">
                  What to do next
                </Text>
                <List type="number">
                  <List.Item>
                    Map metafields if you use custom attributes
                  </List.Item>
                  <List.Item>
                    Set shop-wide default filter options
                  </List.Item>
                  <List.Item>Settings → layout, search, sort</List.Item>
                  <List.Item>
                    Add Collection filters + Product search blocks in the theme
                    editor
                  </List.Item>
                </List>
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
