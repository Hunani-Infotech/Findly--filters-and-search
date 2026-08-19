import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { redirect, useLoaderData, useNavigate, useNavigation, useSubmit } from "react-router";
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
import { isMutationBusy, isNavigatingTo } from "../components/admin-loading";
import { SetupGuide } from "../components/setup-guide";
import { getSetupProgress } from "../setup-progress.server";
import {
  createFilterTree,
  listFilterTrees,
  resolveFilterTreeForCollection,
} from "../filter-trees.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await ensureShop(session.shop);
  await ensureShopAccess(session.shop);

  const [collections, trees, progress] = await Promise.all([
    prisma.collection.findMany({
      where: { shopId: shop.id },
      orderBy: { title: "asc" },
    }),
    listFilterTrees(shop.id),
    getSetupProgress(shop.id, session.shop),
  ]);

  const collectionRows = await Promise.all(
    collections.map(async (collection) => {
      const tree = await resolveFilterTreeForCollection(
        shop.id,
        collection.collectionGid,
      );
      return {
        id: collection.id,
        title: collection.title,
        handle: collection.handle,
        collectionGid: collection.collectionGid,
        numericId: collectionNumericId(collection.collectionGid),
        treeName: tree?.name ?? "—",
        treeEnabled: tree?.enabled ?? false,
        treeId: tree?.id ?? null,
      };
    }),
  );

  return {
    trees: trees.map((tree) => ({
      id: tree.id,
      name: tree.name,
      enabled: tree.enabled,
      appliesToSearch: tree.appliesToSearch,
      collectionCount: tree.treeCollections.length,
      createdAt: tree.createdAt.toISOString(),
    })),
    collections: collectionRows,
    setup: progress,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await ensureShop(session.shop);
  await ensureShopAccess(session.shop);
  const form = await request.formData();
  if (String(form.get("intent")) !== "create") {
    return { ok: false };
  }
  const tree = await createFilterTree(shop.id, { name: "Untitled tree" });
  return redirect(`/app/filters/${tree.id}`);
};

export default function Index() {
  const data = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const navigate = useNavigate();
  const submit = useSubmit();
  const { collections, trees, setup } = data;
  const syncing = isNavigatingTo(navigation, "/app/sync");
  const settingsLoading = isNavigatingTo(navigation, "/app/settings");
  const creating = isMutationBusy(navigation);

  const treeMarkup = trees.map((tree, index) => {
    const href = `/app/filters/${tree.id}`;
    return (
      <IndexTable.Row id={tree.id} key={tree.id} position={index}>
        <IndexTable.Cell>
          <Text as="span" variant="bodyMd" fontWeight="semibold">
            {tree.name}
          </Text>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Badge tone={tree.enabled ? "success" : "attention"}>
            {tree.enabled ? "Enabled" : "Disabled"}
          </Badge>
        </IndexTable.Cell>
        <IndexTable.Cell>
          {tree.appliesToSearch ? "Search + " : ""}
          {tree.collectionCount
            ? `${tree.collectionCount} collection${tree.collectionCount === 1 ? "" : "s"}`
            : "Shop default"}
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Button
            onClick={() => navigate(href)}
            loading={isNavigatingTo(navigation, href)}
          >
            Edit
          </Button>
        </IndexTable.Cell>
      </IndexTable.Row>
    );
  });

  const collectionMarkup = collections.map((collection, index) => {
    const href = collection.treeId
      ? `/app/filters/${collection.treeId}`
      : `/app/collections/${collection.numericId}`;
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
          <Badge tone={collection.treeEnabled ? "success" : "attention"}>
            {collection.treeName}
          </Badge>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Button
            onClick={() => navigate(href)}
            loading={isNavigatingTo(navigation, href)}
          >
            Open tree
          </Button>
        </IndexTable.Cell>
      </IndexTable.Row>
    );
  });

  return (
    <Page
      title="Findly filters and search"
      subtitle="Named filter trees apply to collections and/or search. Last created wins if two trees share a page."
      secondaryActions={[
        { content: "Sync", url: "/app/sync", loading: syncing },
        { content: "Settings", url: "/app/settings", loading: settingsLoading },
      ]}
      primaryAction={{
        content: creating ? "Creating…" : "Create filter tree",
        loading: creating,
        onAction: () => {
          const formData = new FormData();
          formData.set("intent", "create");
          submit(formData, { method: "POST" });
        },
      }}
    >
      <Layout>
        <Layout.Section>
          <SetupGuide progress={setup} />
        </Layout.Section>
        <Layout.Section>
          <BlockStack gap="400">
            <InlineStack align="space-between" blockAlign="center">
              <Text as="h2" variant="headingMd">
                Filter trees
              </Text>
            </InlineStack>
            <Text as="p" variant="bodySm" tone="subdued">
              Duplicate, disable, or delete a tree from its editor. Search uses
              the newest tree marked for search results.
            </Text>
            {trees.length === 0 ? (
              <Banner title="No filter trees yet" tone="warning">
                <p>Create a tree to configure collection and search filters.</p>
              </Banner>
            ) : (
              <Card padding="0">
                <IndexTable
                  resourceName={{ singular: "tree", plural: "trees" }}
                  itemCount={trees.length}
                  headings={[
                    { title: "Name" },
                    { title: "Status" },
                    { title: "Applies to" },
                    { title: "Actions" },
                  ]}
                  selectable={false}
                >
                  {treeMarkup}
                </IndexTable>
              </Card>
            )}

            <Text as="h2" variant="headingMd">
              Collections
            </Text>
            {collections.length === 0 ? (
              <Banner
                title="No collections synced yet"
                tone="warning"
                action={{ content: "Run sync", url: "/app/sync" }}
              >
                <p>Run a full sync, then assign collections on a filter tree.</p>
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
                    { title: "Active tree" },
                    { title: "Actions" },
                  ]}
                  selectable={false}
                >
                  {collectionMarkup}
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
