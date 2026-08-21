import { useEffect, useState, type FormEvent } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import {
  Form,
  useActionData,
  useLoaderData,
  useNavigation,
  useSubmit,
} from "react-router";
import {
  BlockStack,
  Button,
  Card,
  InlineStack,
  Layout,
  Page,
  Text,
  TextField,
} from "@shopify/polaris";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { ensureShopAccess } from "../billing.server";
import { isMutationBusy } from "../components/admin-loading";
import { useConfirmDelete } from "../components/confirm-delete-modal";
import { parsePinnings } from "../instant-search";
import { getAppSettings, saveSearchSettings } from "../settings.server";
import { lastPageIndex, slicePage } from "../admin-list-page";
import { AdminListPagination } from "../components/admin-list-pagination";
import { useEmbeddedNavigate } from "../admin-path";

type PinningDraft = {
  id: string;
  query: string;
  handles: string;
};

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const { shop } = await ensureShopAccess(session.shop);
  const settings = await getAppSettings(shop.id);
  return {
    rows: settings.searchExtras.pinnings.map((row) => ({
      id: newId(),
      query: row.query,
      handles: row.handles.join("\n"),
    })),
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const { shop } = await ensureShopAccess(session.shop);
  const form = await request.formData();
  const current = await getAppSettings(shop.id);
  let parsed: unknown = [];
  const raw = form.get("pinnings");
  if (typeof raw === "string" && raw) {
    try {
      parsed = JSON.parse(raw) as unknown;
    } catch {
      parsed = [];
    }
  }
  await saveSearchSettings(shop.id, {
    searchExtras: {
      ...current.searchExtras,
      pinnings: parsePinnings(parsed),
    },
  });
  return { ok: true };
};

export default function SearchPinningsPage() {
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const submit = useSubmit();
  const shopify = useAppBridge();
  const navigate = useEmbeddedNavigate();
  const { ask, dialog } = useConfirmDelete();
  const [rows, setRows] = useState<PinningDraft[]>(data.rows);
  const [loaderRows, setLoaderRows] = useState(data.rows);
  const [page, setPage] = useState(0);
  if (data.rows !== loaderRows) {
    setLoaderRows(data.rows);
    setRows(data.rows);
  }

  const slice = slicePage(rows, page);
  if (page !== slice.safePage) setPage(slice.safePage);

  const saving = isMutationBusy(navigation);

  useEffect(() => {
    if (actionData && "ok" in actionData && actionData.ok) {
      shopify.toast.show("Pinnings saved");
    }
  }, [actionData, shopify]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData();
    formData.set(
      "pinnings",
      JSON.stringify(
        rows.map((row) => ({
          query: row.query,
          handles: row.handles.split(/[\n,]+/),
        })),
      ),
    );
    submit(formData, { method: "POST" });
  };

  return (
    <Page
      title="Pinnings"
      backAction={{ content: "Search", onAction: () => navigate("/app/search") }}
      primaryAction={{
        content: saving ? "Saving…" : "Save",
        loading: saving,
        disabled: saving,
        onAction: () => {
          const form = document.getElementById(
            "search-pinnings-form",
          ) as HTMLFormElement | null;
          form?.requestSubmit();
        },
      }}
    >
      <Layout>
        <Layout.Section>
          <Form id="search-pinnings-form" method="post" onSubmit={handleSubmit}>
            <Card>
              <BlockStack gap="400">
                <Text as="p" variant="bodySm" tone="subdued">
                  Prioritize products for a search query. Use product handles,
                  one per line. Incomplete rows are dropped on save.
                </Text>
                {rows.length === 0 ? (
                  <Text as="p" variant="bodySm" tone="subdued">
                    No pinnings yet.
                  </Text>
                ) : null}
                {slice.paged.map((row, index) => (
                  <BlockStack key={row.id} gap="200">
                    <InlineStack align="space-between" blockAlign="center">
                      <Text as="h3" variant="headingSm">
                        Pinning {slice.start + index + 1}
                      </Text>
                      <Button
                        variant="plain"
                        tone="critical"
                        disabled={saving}
                        onClick={async () => {
                          const ok = await ask({
                            title: "Remove this pinning?",
                            message:
                              "This pinning will be dropped when you save.",
                            confirmLabel: "Remove",
                          });
                          if (!ok) return;
                          setRows((current) =>
                            current.filter((item) => item.id !== row.id),
                          );
                        }}
                      >
                        Remove
                      </Button>
                    </InlineStack>
                    <TextField
                      label="Search query"
                      value={row.query}
                      autoComplete="off"
                      disabled={saving}
                      onChange={(value) =>
                        setRows((current) =>
                          current.map((item) =>
                            item.id === row.id
                              ? { ...item, query: value }
                              : item,
                          ),
                        )
                      }
                    />
                    <TextField
                      label="Product handles"
                      value={row.handles}
                      multiline={3}
                      autoComplete="off"
                      disabled={saving}
                      helpText="One handle per line, for example red-t-shirt"
                      onChange={(value) =>
                        setRows((current) =>
                          current.map((item) =>
                            item.id === row.id
                              ? { ...item, handles: value }
                              : item,
                          ),
                        )
                      }
                    />
                  </BlockStack>
                ))}
                <AdminListPagination
                  slice={slice}
                  onPageChange={setPage}
                  noun="pinning"
                />
                <Button
                  disabled={saving}
                  onClick={() => {
                    setRows((current) => [
                      ...current,
                      { id: newId(), query: "", handles: "" },
                    ]);
                    setPage(lastPageIndex(rows.length + 1));
                  }}
                >
                  Add pinning
                </Button>
              </BlockStack>
            </Card>
          </Form>
        </Layout.Section>
      </Layout>
      {dialog}
    </Page>
  );
}

export const headers: HeadersFunction = (headersArgs) =>
  boundary.headers(headersArgs);
