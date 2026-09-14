import { useEffect, useRef, useState } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import {
  useFetcher,
  useLoaderData,
  useNavigation,
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
import { authenticateAdminAllowReviewBot } from "../lib/admin-auth.server";
import { ensureShopAccess } from "../services/billing.server";
import { isNavigatingTo } from "../components/admin-loading";
import {
  importValueGroups,
  listValueGroups,
} from "../services/value-groups.server";
import { useEmbeddedNavigate } from "../hooks/use-embedded-navigate";
import { slicePage } from "../utils/admin-list-page";
import { indexTablePagination } from "../components/admin-list-pagination";
import { downloadCsv, parseJsonOrCsvRecords, recordsToCsv } from "../utils/csv";

export { GroupsListSkeleton as HydrateFallback } from "../components/admin-skeletons";

function labelForSourceKey(key: string) {
  if (key === "vendor") return "Vendor";
  if (key === "productType") return "Product type";
  if (key === "tags") return "Tag";
  if (key.startsWith("opt_")) {
    return key.slice(4).replace(/[-_]+/g, " ");
  }
  if (key.startsWith("option:")) {
    return key.slice(7).replace(/[-_]+/g, " ");
  }
  return key;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const auth = await authenticateAdminAllowReviewBot(request);
  if (auth.bot) {
    return { groups: [] };
  }
  const { session } = auth;
  const { shop } = await ensureShopAccess(session.shop);
  const groups = await listValueGroups(shop.id);
  return {
    groups: groups.map((group) => ({
      id: group.id,
      name: group.name,
      sourceKey: group.sourceKey,
      sourceLabel: labelForSourceKey(group.sourceKey),
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
    parsed = parseJsonOrCsvRecords(raw);
  } catch {
    return { error: "Invalid CSV or JSON file." };
  }

  const result = await importValueGroups(shop.id, parsed);
  if ("error" in result) return { error: result.error };
  return { ok: true as const, imported: result.imported };
};

export function shouldRevalidate({
  currentUrl,
  nextUrl,
  formMethod,
  defaultShouldRevalidate,
}: {
  currentUrl: URL;
  nextUrl: URL;
  formMethod?: string;
  defaultShouldRevalidate: boolean;
}) {
  const method = formMethod?.toUpperCase();
  if (method && method !== "GET") return defaultShouldRevalidate;
  if (currentUrl.pathname === nextUrl.pathname) {
    const restUnchanged = [...new Set([
      ...currentUrl.searchParams.keys(),
      ...nextUrl.searchParams.keys(),
    ])].every((key) => {
      if (key === "notice") return true;
      return currentUrl.searchParams.get(key) === nextUrl.searchParams.get(key);
    });
    if (restUnchanged) return false;
  }
  return defaultShouldRevalidate;
}

export default function ValueGroupsPage() {
  const { groups } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const navigate = useEmbeddedNavigate();
  const navigation = useNavigation();
  const shopify = useAppBridge();
  const [searchParams, setSearchParams] = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const handledImport = useRef<typeof fetcher.data>();

  useEffect(() => {
    const notice = searchParams.get("notice");
    if (notice === "saved") shopify.toast.show("Group saved");
    if (notice === "deleted") shopify.toast.show("Group deleted");
    if (notice) {
      const next = new URLSearchParams(searchParams);
      next.delete("notice");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams, shopify]);

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
    }
  }, [fetcher.data, fetcher.state, shopify]);

  const creating = isNavigatingTo(navigation, "/app/groups/new");
  const [page, setPage] = useState(0);
  const slice = slicePage(groups, page);
  if (page !== slice.safePage) setPage(slice.safePage);

  const exportGroups = () => {
    downloadCsv(
      "findly-groups.csv",
      recordsToCsv(
        groups.map(({ name, sourceKey, values }) => ({
          name,
          sourceKey,
          values,
        })),
        ["name", "sourceKey", "values"],
      ),
    );
  };

  const rows = slice.paged.map((group, index) => {
    const href = `/app/groups/${group.id}`;
    return (
      <IndexTable.Row
        id={group.id}
        key={group.id}
        position={slice.start + index}
      >
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
        content: "Filters",
        onAction: () => navigate("/app/filters"),
      }}
      primaryAction={{
        content: "Add group",
        onAction: () => navigate("/app/groups/new"),
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
        accept=".csv,.json,text/csv,application/json"
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
          <BlockStack gap="400">
            {groups.length === 0 ? (
            <Card>
              <BlockStack gap="300">
                <Text as="p">
                  Light Blue, Dark Blue, Midnight Blue to Blue
                </Text>
                <Button
                  variant="primary"
                  onClick={() => navigate("/app/groups/new")}
                >
                  Add group
                </Button>
              </BlockStack>
            </Card>
          ) : (
            <Card padding="0">
              <IndexTable
                resourceName={{ singular: "group", plural: "groups" }}
                itemCount={slice.total}
                pagination={indexTablePagination(slice, setPage)}
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
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
