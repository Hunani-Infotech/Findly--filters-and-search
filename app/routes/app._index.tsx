import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useNavigate, useNavigation } from "react-router";
import {
  Badge,
  Banner,
  BlockStack,
  Button,
  Card,
  IndexTable,
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
import { isNavigatingTo } from "../components/admin-loading";
import { SetupGuide } from "../components/setup-guide";
import { getSetupProgress } from "../setup-progress.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await ensureShop(session.shop);
  await ensureShopAccess(session.shop);

  const [collections, filterConfigs, defaultConfig, progress] =
    await Promise.all([
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
      getSetupProgress(shop.id, session.shop),
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
    setup: progress,
  };
};

export default function Index() {
  const data = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const navigate = useNavigate();
  const { collections, defaultConfig, setup } = data;
  const syncing = isNavigatingTo(navigation, "/app/sync");
  const settingsLoading = isNavigatingTo(navigation, "/app/settings");
  const nextStep = setup.nextStep;
  const nextStepLoading = nextStep
    ? isNavigatingTo(navigation, nextStep.href)
    : false;

  const rowMarkup = collections.map((collection, index) => {
    const configureHref = `/app/collections/${collection.numericId}`;
    const configuring = isNavigatingTo(navigation, configureHref);

    return (
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
          <Button
            onClick={() => {
              navigate(configureHref);
            }}
            loading={configuring}
            disabled={configuring}
          >
            Configure
          </Button>
        </IndexTable.Cell>
      </IndexTable.Row>
    );
  });

  return (
    <Page
      title="Findly filters and search"
      subtitle="Collection filters, storefront search, and theme blocks in one place."
      secondaryActions={[
        { content: "Sync", url: "/app/sync", loading: syncing },
        { content: "Settings", url: "/app/settings", loading: settingsLoading },
      ]}
      primaryAction={
        nextStep
          ? {
              content: nextStep.actionLabel,
              url: nextStep.href,
              loading: nextStepLoading,
            }
          : undefined
      }
    >
      <Layout>
        <Layout.Section>
          <SetupGuide progress={setup} />
        </Layout.Section>
        <Layout.Section>
          <BlockStack gap="400">
            <Banner
              tone="info"
              action={{
                content: "Edit defaults",
                onAction: () => navigate("/app/collections/default"),
              }}
            >
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

            <Text as="h2" variant="headingMd">
              Collection overrides
            </Text>
            <Text as="p" variant="bodySm" tone="subdued">
              Most stores only need the shop-wide default. Open a collection
              when it should show different options or stay off.
            </Text>

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
