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
  isPaidPlanKey,
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

  const formData = await request.formData();
  const requested = String(formData.get("plan") ?? "");
  if (!isPaidPlanKey(requested)) {
    return { error: "Choose Standard or Pro to start a Shopify charge." };
  }

  const plan = PLANS[requested];
  // Free plan: no AppSubscriptionCreate — Standard and Pro create a charge.
  const returnUrl = `${process.env.SHOPIFY_APP_URL}/app/billing/callback?shop=${encodeURIComponent(session.shop)}`;

  const result = await createAppSubscription(admin, returnUrl, requested);
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
        planName: plan.name,
        status: result.appSubscription.status || "PENDING",
        test: isBillingTestMode(),
        productLimit: plan.productLimit,
        filterLimit: plan.filterLimit,
      },
      update: {
        shopifySubscriptionId: result.appSubscription.id,
        planName: plan.name,
        status: result.appSubscription.status || "PENDING",
        test: isBillingTestMode(),
        productLimit: plan.productLimit,
        filterLimit: plan.filterLimit,
      },
    });
    await prisma.shop.update({
      where: { id: shop.id },
      data: { plan: plan.key },
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

  const upgradingPlan =
    ["loading", "submitting"].includes(fetcher.state) &&
    fetcher.formMethod === "POST"
      ? String(fetcher.formData?.get("plan") ?? "")
      : "";
  const free = data.plans.free;
  const standard = data.plans.standard;
  const pro = data.plans.pro;
  const currentPlan = data.plans[data.currentPlan];
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
                  {data.usage.filterLimit} metafield filters). Upgrade to
                  Standard or Pro, or reduce usage.
                </p>
              </Banner>
            )}

            <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
              <Card>
                <BlockStack gap="200">
                  <Text as="h2" variant="headingMd">
                    Plan details
                  </Text>
                  <Text as="p">{currentPlan.name}</Text>
                  {data.currentPlan === "free" ? (
                    <Text as="p" tone="subdued">
                      Status: {subStatus}. ${free.amount.toFixed(2)}/month — no
                      Shopify charge.
                    </Text>
                  ) : (
                    <Text as="p" tone="subdued">
                      Status: {subStatus}. {currentPlan.trialDays}-day trial,
                      then ${currentPlan.amount.toFixed(2)}{" "}
                      {currentPlan.currencyCode} every 30 days.
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

            <InlineGrid columns={{ xs: 1, md: 3 }} gap="400">
              <Card>
                <BlockStack gap="300">
                  <Text as="h2" variant="headingMd">
                    {free.name}
                  </Text>
                  <Text as="p" variant="headingLg">
                    ${free.amount.toFixed(2)}/month
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
                    {data.currentPlan === "free"
                      ? "Current plan"
                      : "Available on Free"}
                  </Button>
                </BlockStack>
              </Card>

              <Card>
                <BlockStack gap="300">
                  <Text as="h2" variant="headingMd">
                    Standard
                  </Text>
                  <Text as="p" variant="headingLg">
                    ${standard.amount.toFixed(2)} / 30 days
                  </Text>
                  <Text as="p" tone="subdued">
                    More products and metafield filters
                  </Text>
                  <List>
                    <List.Item>Everything in {free.name}</List.Item>
                    <List.Item>
                      Up to {standard.productLimit} products and{" "}
                      {standard.filterLimit} metafield filters
                    </List.Item>
                    <List.Item>
                      {standard.trialDays}-day trial, then billed every 30 days
                    </List.Item>
                  </List>
                  <Button
                    loading={upgradingPlan === "standard"}
                    disabled={Boolean(upgradingPlan)}
                    onClick={() =>
                      fetcher.submit({ plan: "standard" }, { method: "POST" })
                    }
                  >
                    {upgradingPlan === "standard"
                      ? "Redirecting to Shopify…"
                      : data.currentPlan === "standard"
                        ? "Manage / resubscribe"
                        : data.currentPlan === "pro"
                          ? "Switch to Standard"
                          : "Upgrade to Standard"}
                  </Button>
                </BlockStack>
              </Card>

              <Card>
                <BlockStack gap="300">
                  <InlineStack gap="200" blockAlign="center">
                    <Text as="h2" variant="headingMd">
                      Pro
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
                    <List.Item>Everything in Standard</List.Item>
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
                    loading={upgradingPlan === "pro"}
                    disabled={Boolean(upgradingPlan)}
                    onClick={() =>
                      fetcher.submit({ plan: "pro" }, { method: "POST" })
                    }
                  >
                    {upgradingPlan === "pro"
                      ? "Redirecting to Shopify…"
                      : data.currentPlan === "pro"
                        ? "Manage / resubscribe"
                        : "Upgrade to Pro"}
                  </Button>
                </BlockStack>
              </Card>
            </InlineGrid>

            <Banner tone="info">
              <p>
                Compare plans in the three cards above. Standard and Pro include
                a {standard.trialDays}-day trial. There is no 30-day money-back
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
