import { useEffect } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { redirect, useFetcher, useLoaderData } from "react-router";
import {
  Banner,
  BlockStack,
  Button,
  Card,
  InlineGrid,
  Layout,
  Page,
  Text,
} from "@shopify/polaris";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import {
  PLANS,
  createAppSubscription,
  enforcePlanLimits,
  ensureShopAccess,
  isBillingTestMode,
  isDevUnlockLimits,
  syncActiveSubscriptions,
} from "../billing.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const { shop } = await ensureShopAccess(session.shop);

  try {
    await syncActiveSubscriptions(admin, shop.id);
  } catch {
    // ignore refresh errors in loader
  }

  const refreshed = await ensureShopAccess(session.shop);
  const limits = await enforcePlanLimits(refreshed.shop.id);

  return {
    plans: PLANS,
    currentPlan: limits.plan,
    testMode: isBillingTestMode(),
    devUnlockLimits: isDevUnlockLimits(),
    subscription: refreshed.shop.subscription,
    usage: {
      productCount: limits.productCount,
      productLimit: limits.productLimit,
      filterCount: limits.filterCount,
      filterLimit: limits.filterLimit,
      withinLimits: limits.withinLimits,
    },
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const { shop } = await ensureShopAccess(session.shop);

  // Free plan: no AppSubscriptionCreate — only Pro creates a charge.
  const returnUrl = `${process.env.SHOPIFY_APP_URL}/app/billing/callback?shop=${encodeURIComponent(session.shop)}`;

  const result = await createAppSubscription(admin, returnUrl);
  const errors = result?.userErrors ?? [];
  if (errors.length || !result?.confirmationUrl) {
    return {
      error:
        errors.map((e: { message: string }) => e.message).join("; ") ||
        "Could not create subscription",
    };
  }

  if (result.appSubscription?.id) {
    await prisma.subscription.upsert({
      where: { shopId: shop.id },
      create: {
        shopId: shop.id,
        shopifySubscriptionId: result.appSubscription.id,
        planName: PLANS.pro.name,
        status: result.appSubscription.status || "PENDING",
        test: isBillingTestMode(),
        productLimit: PLANS.pro.productLimit,
        filterLimit: PLANS.pro.filterLimit,
      },
      update: {
        shopifySubscriptionId: result.appSubscription.id,
        planName: PLANS.pro.name,
        status: result.appSubscription.status || "PENDING",
        test: isBillingTestMode(),
        productLimit: PLANS.pro.productLimit,
        filterLimit: PLANS.pro.filterLimit,
      },
    });
    await prisma.shop.update({
      where: { id: shop.id },
      data: { plan: PLANS.pro.key },
    });
  }

  return redirect(result.confirmationUrl);
};

export default function BillingPage() {
  const data = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();

  useEffect(() => {
    if (fetcher.data && "error" in fetcher.data && fetcher.data.error) {
      shopify.toast.show(String(fetcher.data.error), { isError: true });
    }
  }, [fetcher.data, shopify]);

  const loading = ["loading", "submitting"].includes(fetcher.state);
  const isPro = data.currentPlan === "pro";
  const free = data.plans.free;
  const pro = data.plans.pro;

  return (
    <Page title="Billing">
      <Layout>
        <Layout.Section>
          <BlockStack gap="400">
            {data.testMode && (
              <Banner tone="info">
                <p>Test mode is on (no real charges).</p>
              </Banner>
            )}

            {data.devUnlockLimits && (
              <Banner tone="info">
                <p>
                  Dev unlock is on: Free plan uses Pro product/filter caps for
                  local testing ({data.usage.productLimit} products /{" "}
                  {data.usage.filterLimit} metafield filters).
                </p>
              </Banner>
            )}

            {!data.usage.withinLimits && (
              <Banner tone="warning">
                <p>
                  You are over plan limits ({data.usage.productCount}/
                  {data.usage.productLimit} products, {data.usage.filterCount}/
                  {data.usage.filterLimit} metafield filters). Upgrade to Pro or
                  reduce usage.
                </p>
              </Banner>
            )}

            <Card>
              <BlockStack gap="200">
                <Text as="h2" variant="headingMd">
                  Current usage
                </Text>
                <Text as="p">
                  Plan: {isPro ? pro.name : free.name}
                </Text>
                <Text as="p">
                  Products: {data.usage.productCount}/{data.usage.productLimit}
                </Text>
                <Text as="p">
                  Filters: {data.usage.filterCount}/{data.usage.filterLimit}
                </Text>
                <Text as="p" tone="subdued">
                  Subscription status:{" "}
                  {data.subscription?.status
                    ? data.subscription.status
                    : "None (Free)"}
                </Text>
              </BlockStack>
            </Card>

            <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
              <Card>
                <BlockStack gap="300">
                  <Text as="h2" variant="headingMd">
                    {free.name}
                  </Text>
                  <Text as="p">
                    $0 — up to {free.productLimit} products and{" "}
                    {free.filterLimit} metafield filters.
                  </Text>
                  <Text as="p" tone="subdued">
                    {isPro
                      ? "Available if you cancel Pro in Shopify billing."
                      : "You are on the Free plan — no charge. Free does not create a subscription."}
                  </Text>
                  {!isPro && (
                    <Button disabled>Current plan</Button>
                  )}
                </BlockStack>
              </Card>

              <Card>
                <BlockStack gap="300">
                  <Text as="h2" variant="headingMd">
                    {pro.name}
                  </Text>
                  <Text as="p">
                    ${pro.amount.toFixed(2)} {pro.currencyCode} every 30 days
                    with a {pro.trialDays}-day trial. Up to {pro.productLimit}{" "}
                    products and {pro.filterLimit} metafield filters.
                  </Text>
                  <Button
                    variant="primary"
                    loading={loading}
                    onClick={() => fetcher.submit({}, { method: "POST" })}
                  >
                    {isPro ? "Manage / resubscribe" : "Upgrade to Pro"}
                  </Button>
                </BlockStack>
              </Card>
            </InlineGrid>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
