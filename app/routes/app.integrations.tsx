import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import {
  Badge,
  BlockStack,
  Button,
  Card,
  InlineStack,
  Layout,
  Page,
  Text,
  TextField,
} from "@shopify/polaris";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { useEmbeddedNavigate } from "../hooks/use-embedded-navigate";
import { authenticate } from "../shopify.server";
import { ensureShopAccess } from "../services/billing.server";
import {
  FINDLY_FILTER_RENDER_COMPLETED,
  PARTNER_INTEGRATIONS,
  PARTNER_LISTENER_SNIPPET,
  SMART_FILTER_UPDATE_EVENT,
  type PartnerIntegration,
  type PartnerIntegrationCategory,
} from "../utils/partner-integrations";

export { IntegrationsPageSkeleton as HydrateFallback } from "../components/admin-skeletons";

const CATEGORY_ORDER: PartnerIntegrationCategory[] = [
  "reviews",
  "wishlist",
  "translation",
  "currency",
  "badges",
];

const CATEGORY_LABEL: Record<PartnerIntegrationCategory, string> = {
  reviews: "Reviews",
  wishlist: "Wishlist",
  translation: "Translation",
  currency: "Currency",
  badges: "Badges",
};

function groupedIntegrations() {
  return CATEGORY_ORDER.map((category) => ({
    category,
    items: PARTNER_INTEGRATIONS.filter((item) => item.category === category),
  })).filter((group) => group.items.length > 0);
}

function statusTone(status: PartnerIntegration["status"]) {
  return status === "built-in" ? "success" : "info";
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  await ensureShopAccess(session.shop);
  return null;
};

export default function IntegrationsPage() {
  const navigate = useEmbeddedNavigate();
  const shopify = useAppBridge();

  async function copySnippet() {
    try {
      await navigator.clipboard.writeText(PARTNER_LISTENER_SNIPPET);
      shopify.toast.show("Copied listener snippet");
    } catch {
      shopify.toast.show("Could not copy snippet");
    }
  }

  return (
    <Page
      title="Integrations"
      subtitle="Partner apps that stay in sync after collection filters"
      backAction={{ content: "Home", onAction: () => navigate("/app") }}
    >
      <Layout>
        <Layout.Section>
          <BlockStack gap="400">
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  Filter render events
                </Text>
                <Text as="p">
                  After Ajax hide/show of the theme product grid, Findly
                  dispatches these events so review, wishlist, translation, and
                  badge apps can re-init on remaining cards.
                </Text>
                <BlockStack gap="200">
                  <Text as="p">
                    <Text as="span" fontWeight="semibold">
                      {FINDLY_FILTER_RENDER_COMPLETED}
                    </Text>
                    {" — "}
                    Findly native event. Listen on window.
                  </Text>
                  <Text as="p">
                    <Text as="span" fontWeight="semibold">
                      {SMART_FILTER_UPDATE_EVENT}
                    </Text>
                    {" — "}
                    existing Findly event with a payload of {"{ handles }"}.
                  </Text>
                </BlockStack>
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="300">
                <InlineStack align="space-between" blockAlign="center" wrap>
                  <Text as="h2" variant="headingMd">
                    Theme.liquid listener snippet
                  </Text>
                  <Button onClick={() => void copySnippet()}>Copy</Button>
                </InlineStack>
                <Text as="p" tone="subdued">
                  Paste before {"</body>"} so partners can listen for
                  findlyFilterRenderCompleted.
                </Text>
                <TextField
                  label="Partner listener snippet"
                  labelHidden
                  value={PARTNER_LISTENER_SNIPPET}
                  onChange={() => undefined}
                  multiline={12}
                  autoComplete="off"
                  readOnly
                />
              </BlockStack>
            </Card>

            {groupedIntegrations().map((group) => (
              <Card key={group.category}>
                <BlockStack gap="300">
                  <Text as="h2" variant="headingMd">
                    {CATEGORY_LABEL[group.category]}
                  </Text>
                  {group.items.map((item) => (
                    <BlockStack key={item.id} gap="100">
                      <InlineStack gap="200" blockAlign="center" wrap>
                        <Text as="h3" variant="headingSm">
                          {item.name}
                        </Text>
                        <Badge tone={statusTone(item.status)}>
                          {item.status}
                        </Badge>
                      </InlineStack>
                      <Text as="p">{item.notes}</Text>
                    </BlockStack>
                  ))}
                </BlockStack>
              </Card>
            ))}

            <Card>
              <BlockStack gap="200">
                <Text as="h2" variant="headingMd">
                  How to verify
                </Text>
                <Text as="p">
                  Apply a collection filter; wishlist hearts and Judge.me stars
                  must still show. Wishlist Hero buttons on remaining cards
                  should stay clickable after the grid updates.
                </Text>
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

export const headers: HeadersFunction = (headersArgs) =>
  boundary.headers(headersArgs);
