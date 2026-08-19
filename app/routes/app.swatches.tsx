import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useNavigate } from "react-router";
import {
  Badge,
  Banner,
  BlockStack,
  Card,
  IndexTable,
  Layout,
  Link,
  Page,
  Text,
} from "@shopify/polaris";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { ensureShopAccess } from "../billing.server";
import { listColorOptionKeys } from "../color-swatches.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const { shop } = await ensureShopAccess(session.shop);
  const options = await listColorOptionKeys(shop.id);
  return { options };
};

export default function SwatchesIndexPage() {
  const { options } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  const rowMarkup = options.map((option, index) => (
    <IndexTable.Row
      id={option.optionKey}
      key={option.optionKey}
      position={index}
      onClick={() =>
        navigate(`/app/swatches/${encodeURIComponent(option.optionKey)}`)
      }
    >
      <IndexTable.Cell>
        <Text as="span" fontWeight="semibold">
          {option.label}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span" tone="subdued">
          {option.valueCount} {option.valueCount === 1 ? "value" : "values"}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        {option.missing > 0 ? (
          <Badge tone="warning">{`${option.missing} missing`}</Badge>
        ) : (
          <Badge tone="success">Complete</Badge>
        )}
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  return (
    <Page
      title="Swatch"
      backAction={{ content: "Filters", onAction: () => navigate("/app") }}
    >
      <Layout>
        <Layout.Section>
          <BlockStack gap="400">
            {options.length === 0 ? (
              <Banner tone="info" title="No color options yet">
                <p>
                  Run a{" "}
                  <Link url="/app/sync" removeUnderline>
                    product sync
                  </Link>{" "}
                  so Findly can list variant option names (Color, Finish, and
                  similar). Then open this page again to assign swatches.
                </p>
              </Banner>
            ) : (
              <Card padding="0">
                <IndexTable
                  resourceName={{ singular: "option", plural: "options" }}
                  itemCount={options.length}
                  selectable={false}
                  headings={[
                    { title: "Option" },
                    { title: "Values" },
                    { title: "Status" },
                  ]}
                >
                  {rowMarkup}
                </IndexTable>
              </Card>
            )}
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
