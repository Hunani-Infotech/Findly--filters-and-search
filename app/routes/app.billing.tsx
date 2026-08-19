import { useEffect } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { redirect, useFetcher, useLoaderData } from "react-router";
import {
  Badge,
  Banner,
  BlockStack,
  Button,
  Card,
  ChoiceList,
  InlineGrid,
  InlineStack,
  Layout,
  List,
  Page,
  ProgressBar,
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

  const upgrading =
    ["loading", "submitting"].includes(fetcher.state) &&
    fetcher.formMethod === "POST";
  const isPro = data.currentPlan === "pro";
  const free = data.plans.free;
  const pro = data.plans.pro;
  const planLabel = isPro ? "Professional" : "Basic";
  const subStatus = data.subscription?.status
    ? data.subscription.status
    : "None (Free)";
  const productPct =
    data.usage.productLimit > 0
      ? Math.min(
          100,
          Math.round(
            (data.usage.productCount / data.usage.productLimit) * 100,
          ),
        )
      : 0;

  return (
    <Page
      title="Pricing"
      secondaryActions={[
        {
          content: "Apply discount code",
          onAction: () =>
            shopify.toast.show(
              "Shopify handles discounts on checkout, not in-app",
            ),
        },
      ]}
    >
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

            <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
              <Card>
                <BlockStack gap="200">
                  <Text as="h2" variant="headingMd">
                    Plan details
                  </Text>
                  <Text as="p">
                    {planLabel} ({isPro ? pro.name : free.name})
                  </Text>
                  {isPro ? (
                    <Text as="p" tone="subdued">
                      Status: {subStatus}. {pro.trialDays}-day trial, then $
                      {pro.amount.toFixed(2)} {pro.currencyCode} every 30 days.
                    </Text>
                  ) : (
                    <Text as="p" tone="subdued">
                      Status: {subStatus}. $0/month — no Shopify charge.
                    </Text>
                  )}
                </BlockStack>
              </Card>
              <Card>
                <BlockStack gap="200">
                  <Text as="h2" variant="headingMd">
                    Currently active products
                  </Text>
                  <Text as="p">
                    {data.usage.productCount} of {data.usage.productLimit}{" "}
                    products on this plan
                  </Text>
                  <ProgressBar progress={productPct} size="small" />
                  <Text as="p" tone="subdued">
                    Product cap: {data.usage.productLimit}. Metafield filters:{" "}
                    {data.usage.filterCount}/{data.usage.filterLimit}.
                  </Text>
                </BlockStack>
              </Card>
            </InlineGrid>

            <ChoiceList
              title="Billing cycle"
              choices={[
                { label: "Pay monthly", value: "monthly" },
                {
                  label: "Pay yearly",
                  value: "yearly",
                  disabled: true,
                  helpText: "Yearly billing is not on Findly yet",
                },
              ]}
              selected={["monthly"]}
              onChange={() => undefined}
            />

            <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
              <Card>
                <BlockStack gap="300">
                  <Text as="h2" variant="headingMd">
                    Basic
                  </Text>
                  <Text as="p" variant="headingLg">
                    $0/month
                  </Text>
                  <Text as="p" tone="subdued">
                    Ideal for individuals &amp; small teams
                  </Text>
                  <List>
                    <List.Item>Collection filters (price, availability, vendor, type, tags)</List.Item>
                    <List.Item>Storefront search via Theme App Extension</List.Item>
                    <List.Item>Theme App Extension widget (left, right, or top)</List.Item>
                    <List.Item>
                      Metafield filters up to {free.filterLimit} mappings
                    </List.Item>
                    <List.Item>Up to {free.productLimit} products</List.Item>
                  </List>
                  <Button disabled>
                    {isPro ? "Available on Free" : "Current plan"}
                  </Button>
                </BlockStack>
              </Card>

              <Card>
                <BlockStack gap="300">
                  <InlineStack gap="200" blockAlign="center">
                    <Text as="h2" variant="headingMd">
                      Professional
                    </Text>
                    <Badge tone="success">Recommended</Badge>
                  </InlineStack>
                  <Text as="p" variant="headingLg">
                    ${pro.amount.toFixed(2)} / 30 days
                  </Text>
                  <Text as="p" tone="subdued">
                    Best value for larger catalogs
                  </Text>
                  <List>
                    <List.Item>Everything in Basic</List.Item>
                    <List.Item>
                      Up to {pro.productLimit} products and {pro.filterLimit}{" "}
                      metafield filters
                    </List.Item>
                    <List.Item>
                      {pro.trialDays}-day trial, then billed every 30 days
                    </List.Item>
                  </List>
                  <Button
                    variant="primary"
                    loading={upgrading}
                    disabled={upgrading}
                    onClick={() => fetcher.submit({}, { method: "POST" })}
                  >
                    {upgrading
                      ? "Redirecting to Shopify…"
                      : isPro
                        ? "Manage / resubscribe"
                        : "Upgrade to Pro"}
                  </Button>
                </BlockStack>
              </Card>
            </InlineGrid>

            <Banner tone="info">
              <p>
                Compare plans in the two cards above. Professional includes a{" "}
                {pro.trialDays}-day trial. There is no 30-day money-back
                guarantee in Findly billing.
              </p>
            </Banner>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
