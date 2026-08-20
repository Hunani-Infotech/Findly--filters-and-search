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
import { parseRedirects } from "../instant-search";
import { getAppSettings, saveSearchSettings } from "../settings.server";

type RedirectDraft = {
  id: string;
  query: string;
  url: string;
};

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const { shop } = await ensureShopAccess(session.shop);
  const settings = await getAppSettings(shop.id);
  return {
    rows: settings.searchExtras.redirects.map((row) => ({
      id: newId(),
      query: row.query,
      url: row.url,
    })),
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const { shop } = await ensureShopAccess(session.shop);
  const form = await request.formData();
  const current = await getAppSettings(shop.id);
  let parsed: unknown = [];
  const raw = form.get("redirects");
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
      redirects: parseRedirects(parsed),
    },
  });
  return { ok: true };
};

export default function SearchRedirectsPage() {
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const submit = useSubmit();
  const shopify = useAppBridge();
  const [rows, setRows] = useState<RedirectDraft[]>(data.rows);
  const [loaderRows, setLoaderRows] = useState(data.rows);
  if (data.rows !== loaderRows) {
    setLoaderRows(data.rows);
    setRows(data.rows);
  }

  const saving = isMutationBusy(navigation);

  useEffect(() => {
    if (actionData && "ok" in actionData && actionData.ok) {
      shopify.toast.show("Redirects saved");
    }
  }, [actionData, shopify]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData();
    formData.set(
      "redirects",
      JSON.stringify(
        rows.map((row) => ({
          query: row.query,
          url: row.url,
        })),
      ),
    );
    submit(formData, { method: "POST" });
  };

  return (
    <Page
      title="Redirects"
      backAction={{ content: "Search", url: "/app/search" }}
      primaryAction={{
        content: saving ? "Saving…" : "Save",
        loading: saving,
        disabled: saving,
        onAction: () => {
          const form = document.getElementById(
            "search-redirects-form",
          ) as HTMLFormElement | null;
          form?.requestSubmit();
        },
      }}
    >
      <Layout>
        <Layout.Section>
          <Form id="search-redirects-form" method="post" onSubmit={handleSubmit}>
            <Card>
              <BlockStack gap="400">
                <Text as="p" variant="bodySm" tone="subdued">
                  Send a search to a specific URL. Use a store path like
                  /collections/sale or a full https URL. Incomplete rows are
                  dropped on save.
                </Text>
                {rows.length === 0 ? (
                  <Text as="p" variant="bodySm" tone="subdued">
                    No redirects yet.
                  </Text>
                ) : null}
                {rows.map((row, index) => (
                  <BlockStack key={row.id} gap="200">
                    <InlineStack align="space-between" blockAlign="center">
                      <Text as="h3" variant="headingSm">
                        Redirect {index + 1}
                      </Text>
                      <Button
                        variant="plain"
                        tone="critical"
                        disabled={saving}
                        onClick={() =>
                          setRows((current) =>
                            current.filter((item) => item.id !== row.id),
                          )
                        }
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
                      label="URL"
                      value={row.url}
                      autoComplete="off"
                      disabled={saving}
                      onChange={(value) =>
                        setRows((current) =>
                          current.map((item) =>
                            item.id === row.id ? { ...item, url: value } : item,
                          ),
                        )
                      }
                    />
                  </BlockStack>
                ))}
                <Button
                  disabled={saving}
                  onClick={() =>
                    setRows((current) => [
                      ...current,
                      { id: newId(), query: "", url: "" },
                    ])
                  }
                >
                  Add redirect
                </Button>
              </BlockStack>
            </Card>
          </Form>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

export const headers: HeadersFunction = (headersArgs) =>
  boundary.headers(headersArgs);
