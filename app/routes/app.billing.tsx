import { useEffect, useState } from "react";
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
  InlineGrid,
  InlineStack,
  Layout,
  List,
  Modal,
  Page,
  ProgressBar,
  Text,
} from "@shopify/polaris";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { appUrl, authenticate } from "../shopify.server";
import { authenticateAdminAllowReviewBot } from "../lib/admin-auth.server";
import prisma from "../db.server";
import { forgetShop } from "../lib/shop-cache.server";
import {
  embeddedAdminAppUrl,
  withEmbeddedParamsFromRequest,
} from "../utils/admin-path";
import {
  PLANS,
  cancelSubscription,
  createAppSubscription,
  enforcePlanLimits,
  ensureShopAccess,
  isAllowedShopifyConfirmationUrl,
  isBillingTestMode,
  isDevUnlockLimits,
  isPaidPlanKey,
  syncActiveSubscriptions,
} from "../services/billing.server";

export { BillingPageSkeleton as HydrateFallback } from "../components/admin-skeletons";

const BILLING_SYNC_TTL_MS = 120_000;
const lastBillingSyncAt = new Map<string, number>();

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const auth = await authenticateAdminAllowReviewBot(request);
  if (auth.bot) {
    return {
      plans: PLANS,
      currentPlan: "free" as const,
      testMode: false,
      devUnlockLimits: false,
      subscription: null,
      usage: {
        productCount: 0,
        productLimit: PLANS.free.productLimit,
        filterCount: 0,
        filterLimit: PLANS.free.filterLimit,
        withinLimits: true,
      },
    };
  }

  const { session, admin } = auth;
  let { shop } = await ensureShopAccess(session.shop);

  const lastSync = lastBillingSyncAt.get(shop.id) ?? 0;
  const fromChargeReturn = new URL(request.url).searchParams.has("charge_id");
  if (fromChargeReturn || Date.now() - lastSync > BILLING_SYNC_TTL_MS) {
    try {
      await syncActiveSubscriptions(admin, shop.id);
      lastBillingSyncAt.set(shop.id, Date.now());
      forgetShop(session.shop);
      shop = (await ensureShopAccess(session.shop)).shop;
    } catch {
      // ignore refresh errors in loader
    }
  }

  const limits = await enforcePlanLimits(shop.id);

  return {
    plans: PLANS,
    currentPlan: limits.plan,
    testMode: isBillingTestMode(),
    devUnlockLimits: isDevUnlockLimits(),
    subscription: shop.subscription,
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
  const { session, admin, redirect: shopifyRedirect } =
    await authenticate.admin(request);
  const { shop } = await ensureShopAccess(session.shop);

  const formData = await request.formData();
  const intent = String(formData.get("intent") || "upgrade");

  if (intent === "cancel_to_free") {
    const subId = shop.subscription?.shopifySubscriptionId;
    if (!subId) {
      return {
        error:
          "No active Shopify subscription id on file. Open Pricing again to refresh, or cancel from Shopify Settings → Billing.",
      };
    }
    const result = await cancelSubscription(admin, shop.id, subId);
    if (!result.ok) {
      return { error: result.error };
    }
    forgetShop(session.shop);
    lastBillingSyncAt.delete(shop.id);
    return redirect(
      withEmbeddedParamsFromRequest(request, "/app/billing?notice=downgraded"),
    );
  }

  const requested = String(formData.get("plan") ?? "");
  if (!isPaidPlanKey(requested)) {
    return { error: "Choose Standard or Pro to start a Shopify charge." };
  }

  const plan = PLANS[requested];
  // Free plan: no AppSubscriptionCreate — Standard and Pro create a charge.
  // Top window must stay on admin.shopify.com (not the Hostinger app origin).
  const returnUrl =
    embeddedAdminAppUrl(session.shop, "/app/billing") ??
    `${appUrl.replace(/\/$/, "")}/app/billing?shop=${encodeURIComponent(session.shop)}`;

  const result = await createAppSubscription(admin, returnUrl, requested);
  const errors = result?.userErrors ?? [];
  if (errors.length || !result?.confirmationUrl) {
    return {
      error:
        errors.map((e: { message: string }) => e.message).join("; ") ||
        "Could not create subscription",
    };
  }

  if (!isAllowedShopifyConfirmationUrl(result.confirmationUrl)) {
    return { error: "Unexpected billing confirmation URL from Shopify." };
  }

  lastBillingSyncAt.delete(shop.id);

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

  return shopifyRedirect(result.confirmationUrl, { target: "_top" });
};

export default function BillingPage() {
  const data = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();
  const [downgradeOpen, setDowngradeOpen] = useState(false);
  const [seenFetcherData, setSeenFetcherData] = useState(fetcher.data);

  if (fetcher.data !== seenFetcherData) {
    setSeenFetcherData(fetcher.data);
    if (fetcher.data && "error" in fetcher.data && fetcher.data.error) {
      setDowngradeOpen(false);
    }
  }

  useEffect(() => {
    if (fetcher.data && "error" in fetcher.data && fetcher.data.error) {
      shopify.toast.show(String(fetcher.data.error), { isError: true });
    }
  }, [fetcher.data, shopify]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("notice") === "downgraded") {
      shopify.toast.show("You are on the Free plan.");
    }
  }, [shopify]);

  const submitting = ["loading", "submitting"].includes(fetcher.state);
  const upgradingPlan =
    submitting && fetcher.formMethod === "POST"
      ? String(fetcher.formData?.get("plan") ?? "")
      : "";
  const cancelling =
    submitting &&
    String(fetcher.formData?.get("intent") ?? "") === "cancel_to_free";
  const free = data.plans.free;
  const standard = data.plans.standard;
  const pro = data.plans.pro;
  const currentPlan = data.plans[data.currentPlan];
  const onPaid = data.currentPlan !== "free";
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
                  {data.currentPlan === "free" ? (
                    <Button disabled>Current plan</Button>
                  ) : (
                    <Button
                      tone="critical"
                      loading={cancelling}
                      disabled={Boolean(upgradingPlan) || cancelling}
                      onClick={() => setDowngradeOpen(true)}
                    >
                      Downgrade to Free
                    </Button>
                  )}
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
                    disabled={Boolean(upgradingPlan) || cancelling}
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
                    disabled={Boolean(upgradingPlan) || cancelling}
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

      <Modal
        open={downgradeOpen}
        onClose={() => setDowngradeOpen(false)}
        title="Downgrade to Free?"
        primaryAction={{
          content: "Downgrade to Free",
          destructive: true,
          loading: cancelling,
          onAction: () =>
            fetcher.submit(
              { intent: "cancel_to_free" },
              { method: "POST" },
            ),
        }}
        secondaryActions={[
          {
            content: "Keep current plan",
            onAction: () => setDowngradeOpen(false),
          },
        ]}
      >
        <Modal.Section>
          <BlockStack gap="200">
            <Text as="p">
              This cancels your Shopify app subscription and moves the shop to
              Free immediately.
            </Text>
            {onPaid ? (
              <Text as="p">
                Free caps are {free.productLimit} products and{" "}
                {free.filterLimit} metafield filters. You currently have{" "}
                {data.usage.productCount} products and {data.usage.filterCount}{" "}
                metafield filters on {currentPlan.name} (limits{" "}
                {data.usage.productLimit} / {data.usage.filterLimit}). Features
                stay available; anything over Free caps is limited until you
                upgrade again or reduce usage.
              </Text>
            ) : null}
          </BlockStack>
        </Modal.Section>
      </Modal>
    </Page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
