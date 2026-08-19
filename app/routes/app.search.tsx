import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useNavigate } from "react-router";
import {
  Banner,
  BlockStack,
  Button,
  Card,
  InlineGrid,
  Layout,
  List,
  Page,
  Text,
} from "@shopify/polaris";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { ensureShopAccess } from "../billing.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  await ensureShopAccess(session.shop);
  return { ok: true };
};

export default function SearchNavPage() {
  const navigate = useNavigate();
  return (
    <Page
      title="Search"
      subtitle="Storefront product search through the Theme App Extension."
      backAction={{ content: "Filters", onAction: () => navigate("/app") }}
    >
      <Layout>
        <Layout.Section>
          <BlockStack gap="400">
            <Banner tone="info">
              <p>
                Search is live on the theme. Configure fields, empty-query pins,
                and in-collection search here, then add the search block on the
                search template.
              </p>
            </Banner>
            <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
              <Card>
                <BlockStack gap="300">
                  <Text as="h2" variant="headingMd">
                    Search settings
                  </Text>
                  <List>
                    <List.Item>Searchable fields (title, vendor, type, tags)</List.Item>
                    <List.Item>Empty-query and no-result suggestions</List.Item>
                    <List.Item>Collection search bar</List.Item>
                  </List>
                  <Button
                    variant="primary"
                    onClick={() => navigate("/app/settings?tab=search")}
                  >
                    Open search settings
                  </Button>
                </BlockStack>
              </Card>
              <Card>
                <BlockStack gap="300">
                  <Text as="h2" variant="headingMd">
                    Theme
                  </Text>
                  <List>
                    <List.Item>App embed for filters and search</List.Item>
                    <List.Item>Search results template block</List.Item>
                  </List>
                  <Button onClick={() => navigate("/app/settings?tab=general")}>
                    Open widget settings
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

export const headers: HeadersFunction = (headersArgs) =>
  boundary.headers(headersArgs);
