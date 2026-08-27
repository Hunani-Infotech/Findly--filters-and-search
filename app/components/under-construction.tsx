import { BlockStack, Card, Icon, Layout, Page, Text } from "@shopify/polaris";
import { AlertTriangleIcon } from "@shopify/polaris-icons";
import { useEmbeddedNavigate } from "../hooks/use-embedded-navigate";

export function UnderConstructionGate({ feature }: { feature: string }) {
  const navigate = useEmbeddedNavigate();

  return (
    <Page
      title={feature}
      backAction={{ content: "Home", onAction: () => navigate("/app") }}
    >
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="300" inlineAlign="center">
              <span className="findly-under-construction-icon">
                <Icon source={AlertTriangleIcon} tone="warning" />
              </span>
              <Text as="h2" variant="headingLg" alignment="center">
                Under construction
              </Text>
              <Text as="p" variant="bodyMd" alignment="center">
                {feature} is not available yet. Launch work is focused on
                collection filters, storefront search, and the theme app
                extension.
              </Text>
              <Text as="p" variant="bodySm" tone="subdued" alignment="center">
                Check back after that launch. This page is not ready to use.
              </Text>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
