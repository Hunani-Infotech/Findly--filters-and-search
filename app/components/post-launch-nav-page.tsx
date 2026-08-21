import { Banner, BlockStack, Card, Layout, Page, Text } from "@shopify/polaris";
import { useEmbeddedNavigate } from "../admin-path";

export function PostLaunchNavPage({
  title,
  stepId,
  summary,
}: {
  title: string;
  stepId: string;
  summary: string;
}) {
  const navigate = useEmbeddedNavigate();
  return (
    <Page
      title={title}
      backAction={{ content: "Filters", onAction: () => navigate("/app") }}
    >
      <Layout>
        <Layout.Section>
          <BlockStack gap="400">
            <Banner tone="info" title={`${stepId} — after launch`}>
              <p>
                This matches Globo’s sidebar so the menu is familiar. The
                feature itself is not built yet.
              </p>
            </Banner>
            <Card>
              <BlockStack gap="200">
                <Text as="p">{summary}</Text>
                <Text as="p" tone="subdued">
                  Launch scope stays collection filters, storefront search, and
                  the Theme App Extension. Open this item again after that step
                  is unlocked.
                </Text>
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
