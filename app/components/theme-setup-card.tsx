import { Banner, BlockStack, Button, Card, List, Text } from "@shopify/polaris";

export function ThemeSetupCard({ shopDomain }: { shopDomain: string }) {
  const collectionEditor = `https://${shopDomain}/admin/themes/current/editor?template=collection`;
  const searchEditor = `https://${shopDomain}/admin/themes/current/editor?template=search`;

  return (
    <Card>
      <BlockStack gap="300">
        <Text as="h2" variant="headingMd">
          Theme setup
        </Text>
        <Text as="p" variant="bodySm" tone="subdued">
          Filters and search only appear after you add the app blocks on an
          Online Store 2.0 theme. Admin settings do not replace this step.
        </Text>
        <List type="number">
          <List.Item>
            Open the collection template and add the{" "}
            <Text as="span" fontWeight="semibold">
              Collection filters
            </Text>{" "}
            app block. For Horizontal layout, place it above the product grid.
          </List.Item>
          <List.Item>
            Open the search template and add the same Collection filters block
            so shoppers can filter search results.
          </List.Item>
          <List.Item>
            Add the{" "}
            <Text as="span" fontWeight="semibold">
              Product search
            </Text>{" "}
            app block to the header or search template.
          </List.Item>
          <List.Item>
            Save the theme, then preview a collection on a phone-width window
            (375px) to confirm the off-canvas Filter button.
          </List.Item>
        </List>
        <Banner tone="info">
          <p>
            Layout, counts, colors, search fields, and sort live in this app.
            Theme block toggles are a starting point and follow the Settings
            page after the widget loads.
          </p>
        </Banner>
        <BlockStack gap="200">
          <Button url={collectionEditor} target="_blank">
            Open collection theme editor
          </Button>
          <Button url={searchEditor} target="_blank">
            Open search theme editor
          </Button>
        </BlockStack>
      </BlockStack>
    </Card>
  );
}
