import { useEffect, useRef } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import {
  useFetcher,
  useLoaderData,
  useNavigate,
  useNavigation,
  useRevalidator,
  useSearchParams,
} from "react-router";
import {
  BlockStack,
  Button,
  Card,
  IndexTable,
  Layout,
  Page,
  Text,
} from "@shopify/polaris";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { ensureShopAccess } from "../billing.server";
import { isNavigatingTo } from "../components/admin-loading";
import {
  getFilterValueCatalog,
  importValueGroups,
  listValueGroups,
} from "../value-groups.server";

function downloadJson(filename: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const { shop } = await ensureShopAccess(session.shop);
  const [groups, catalog] = await Promise.all([
    listValueGroups(shop.id),
    getFilterValueCatalog(shop.id),
  ]);
  const sourceLabels = Object.fromEntries(
    catalog.sources.map((source) => [source.key, source.label]),
  );
  return {
    groups: groups.map((group) => ({
      id: group.id,
      name: group.name,
      sourceKey: group.sourceKey,
      sourceLabel: sourceLabels[group.sourceKey] || group.sourceKey,
      values: group.values,
      valueCount: group.values.length,
    })),
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const { shop } = await ensureShopAccess(session.shop);
  const form = await request.formData();
  const intent = String(form.get("intent") || "");
  if (intent !== "import") return { error: "Unknown action." };

  const raw = String(form.get("json") || "");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { error: "Invalid JSON." };
  }

  const result = await importValueGroups(shop.id, parsed);
  if ("error" in result) return { error: result.error };
  return { ok: true as const, imported: result.imported };
};

export default function ValueGroupsPage() {
  const { groups } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const revalidator = useRevalidator();
  const navigate = useNavigate();
  const navigation = useNavigation();
  const shopify = useAppBridge();
  const [searchParams] = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const handledImport = useRef<typeof fetcher.data>();

  useEffect(() => {
    const notice = searchParams.get("notice");
    if (notice === "saved") shopify.toast.show("Group saved");
    if (notice === "deleted") shopify.toast.show("Group deleted");
    if (notice) navigate("/app/groups", { replace: true });
  }, [navigate, searchParams, shopify]);

  useEffect(() => {
    const data = fetcher.data;
    if (!data || fetcher.state !== "idle") return;
    if (handledImport.current === data) return;
    handledImport.current = data;
    if ("error" in data && data.error) {
      shopify.toast.show(data.error, { isError: true });
      return;
    }
    if ("ok" in data && data.ok) {
      shopify.toast.show(`Imported ${data.imported} groups`);
      revalidator.revalidate();
    }
  }, [fetcher.data, fetcher.state, revalidator, shopify]);

  const creating = isNavigatingTo(navigation, "/app/groups/new");

  const exportGroups = () => {
    downloadJson(
      "findly-groups.json",
      groups.map(({ name, sourceKey, values }) => ({
        name,
        sourceKey,
        values,
      })),
    );
  };

  const rows = groups.map((group, index) => {
    const href = `/app/groups/${group.id}`;
    return (
      <IndexTable.Row id={group.id} key={group.id} position={index}>
        <IndexTable.Cell>
          <Text as="span" variant="bodyMd" fontWeight="semibold">
            {group.name}
          </Text>
        </IndexTable.Cell>
        <IndexTable.Cell>{group.sourceLabel}</IndexTable.Cell>
        <IndexTable.Cell>{group.valueCount}</IndexTable.Cell>
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

  return (
    <Page
      title="Group values"
      backAction={{
        content: "Home",
        onAction: () => navigate("/app"),
      }}
      primaryAction={{
        content: "Add group",
        url: "/app/groups/new",
        loading: creating,
      }}
      secondaryActions={[
        { content: "Export", onAction: exportGroups },
        {
          content: "Import",
          onAction: () => fileInputRef.current?.click(),
        },
      ]}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          void file.text().then((json) => {
            fetcher.submit({ intent: "import", json }, { method: "post" });
          });
        }}
      />
      <Layout>
        <Layout.Section>
          {groups.length === 0 ? (
            <Card>
              <BlockStack gap="300">
                <Text as="p">
                  Light Blue, Dark Blue, Midnight Blue to Blue
                </Text>
                <Button url="/app/groups/new" variant="primary">
                  Add group
                </Button>
              </BlockStack>
            </Card>
          ) : (
            <Card padding="0">
              <IndexTable
                resourceName={{ singular: "group", plural: "groups" }}
                itemCount={groups.length}
                headings={[
                  { title: "Name" },
                  { title: "Source" },
                  { title: "Values count" },
                  { title: "Actions" },
                ]}
                selectable={false}
              >
                {rows}
              </IndexTable>
            </Card>
          )}
        </Layout.Section>
      </Layout>
    </Page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
