import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import {
  Badge,
  Banner,
  BlockStack,
  Button,
  Card,
  IndexTable,
  InlineStack,
  Layout,
  Page,
  Text,
} from "@shopify/polaris";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { ensureShopAccess } from "../billing.server";
import { ensureShop } from "../shop.server";
import { collectionNumericId } from "../settings.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await ensureShop(session.shop);
  await ensureShopAccess(session.shop);

  const [collections, filterConfigs, defaultConfig] = await Promise.all([
    prisma.collection.findMany({
      where: { shopId: shop.id },
      orderBy: { title: "asc" },
    }),
    prisma.filterConfig.findMany({
      where: {
        shopId: shop.id,
        collectionGid: { not: "" },
      },
    }),
    prisma.filterConfig.findUnique({
      where: {
        shopId_collectionGid: { shopId: shop.id, collectionGid: "" },
      },
    }),
  ]);

  const configByGid = new Map(
    filterConfigs.map((c) => [c.collectionGid, c] as const),
  );

  const rows = collections.map((collection) => {
    const config = configByGid.get(collection.collectionGid);
    const configured = Boolean(config);
    const enabled = config?.enabled ?? false;
    return {
      id: collection.id,
      title: collection.title,
      handle: collection.handle,
      collectionGid: collection.collectionGid,
      numericId: collectionNumericId(collection.collectionGid),
      configured,
      enabled,
    };
  });

  return {
    collections: rows,
    defaultConfig: {
      exists: Boolean(defaultConfig),
      enabled: defaultConfig?.enabled ?? false,
    },
  };
};

export default function Index() {
  const data = useLoaderData<typeof loader>();
  const { collections, defaultConfig } = data;

  const rowMarkup = collections.map((collection, index) => (
    <IndexTable.Row id={collection.id} key={collection.id} position={index}>
      <IndexTable.Cell>
        <Text as="span" variant="bodyMd" fontWeight="semibold">
          {collection.title}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span" tone="subdued">
          {collection.handle || "—"}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        {collection.configured ? (
          <Badge tone={collection.enabled ? "success" : "attention"}>
            {collection.enabled ? "Configured" : "Configured (disabled)"}
          </Badge>
        ) : (
          <Badge>Not configured</Badge>
        )}
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Button url={`/app/collections/${collection.numericId}`}>
          Configure
        </Button>
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  return (
    <Page
      title="Findly: Smart Filters & Search"
      secondaryActions={[{ content: "Sync", url: "/app/sync" }]}
    >
      <Layout>
        <Layout.Section>
          <BlockStack gap="400">
            <Banner tone="info">
              <p>
                Shop-wide default filters:{" "}
                {defaultConfig.exists
                  ? defaultConfig.enabled
                    ? "enabled"
                    : "disabled"
                  : "not set"}
                . Collections without their own config inherit the default.
              </p>
            </Banner>

            {collections.length === 0 ? (
              <Banner
                title="No collections synced yet"
                tone="warning"
                action={{ content: "Run sync", url: "/app/sync" }}
              >
                <p>
                  Run a full sync to import collections, then configure filters
                  for each one.
                </p>
              </Banner>
            ) : (
              <Card padding="0">
                <IndexTable
                  resourceName={{
                    singular: "collection",
                    plural: "collections",
                  }}
                  itemCount={collections.length}
                  headings={[
                    { title: "Collection" },
                    { title: "Handle" },
                    { title: "Filter status" },
                    { title: "Actions" },
                  ]}
                  selectable={false}
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
