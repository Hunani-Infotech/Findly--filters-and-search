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
  Select,
  Text,
  TextField,
} from "@shopify/polaris";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { ensureShopAccess } from "../billing.server";
import { isMutationBusy } from "../components/admin-loading";
import { useConfirmDelete } from "../components/confirm-delete-modal";
import { parseSynonyms } from "../instant-search";
import { getAppSettings, saveSearchSettings } from "../settings.server";

type SynonymDraft = {
  id: string;
  terms: string;
  mode: "equivalence" | "inferred";
};

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const { shop } = await ensureShopAccess(session.shop);
  const settings = await getAppSettings(shop.id);
  return {
    rows: settings.searchExtras.synonyms.map((row) => ({
      id: newId(),
      terms: row.terms.join(", "),
      mode: row.mode,
    })),
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const { shop } = await ensureShopAccess(session.shop);
  const form = await request.formData();
  const current = await getAppSettings(shop.id);
  let parsed: unknown = [];
  const raw = form.get("synonyms");
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
      synonyms: parseSynonyms(parsed),
    },
  });
  return { ok: true };
};

export default function SearchSynonymsPage() {
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const submit = useSubmit();
  const shopify = useAppBridge();
  const { ask, dialog } = useConfirmDelete();
  const [rows, setRows] = useState<SynonymDraft[]>(data.rows);
  const [loaderRows, setLoaderRows] = useState(data.rows);
  if (data.rows !== loaderRows) {
    setLoaderRows(data.rows);
    setRows(data.rows);
  }

  const saving = isMutationBusy(navigation);

  useEffect(() => {
    if (actionData && "ok" in actionData && actionData.ok) {
      shopify.toast.show("Synonyms saved");
    }
  }, [actionData, shopify]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData();
    formData.set(
      "synonyms",
      JSON.stringify(
        rows.map((row) => ({
          terms: row.terms.split(/[\n,]+/).map((term) => term.trim()),
          mode: row.mode,
        })),
      ),
    );
    submit(formData, { method: "POST" });
  };

  return (
    <Page
      title="Synonyms"
      backAction={{ content: "Search", url: "/app/search" }}
      primaryAction={{
        content: saving ? "Saving…" : "Save",
        loading: saving,
        disabled: saving,
        onAction: () => {
          const form = document.getElementById(
            "search-synonyms-form",
          ) as HTMLFormElement | null;
          form?.requestSubmit();
        },
      }}
    >
      <Layout>
        <Layout.Section>
          <Form id="search-synonyms-form" method="post" onSubmit={handleSubmit}>
            <Card>
              <BlockStack gap="400">
                <Text as="p" variant="bodySm" tone="subdued">
                  Map related search terms. Each group needs at least two terms.
                  Equivalence treats every term the same; inferred expands from
                  the first term only.
                </Text>
                {rows.length === 0 ? (
                  <Text as="p" variant="bodySm" tone="subdued">
                    No synonym groups yet.
                  </Text>
                ) : null}
                {rows.map((row, index) => (
                  <BlockStack key={row.id} gap="200">
                    <InlineStack align="space-between" blockAlign="center">
                      <Text as="h3" variant="headingSm">
                        Group {index + 1}
                      </Text>
                      <Button
                        variant="plain"
                        tone="critical"
                        disabled={saving}
                        onClick={async () => {
                          const ok = await ask({
                            title: "Remove this synonym group?",
                            message: "This group will be dropped when you save.",
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
                      label="Terms"
                      value={row.terms}
                      multiline={2}
                      autoComplete="off"
                      disabled={saving}
                      helpText="Separate with commas or new lines."
                      onChange={(value) =>
                        setRows((current) =>
                          current.map((item) =>
                            item.id === row.id
                              ? { ...item, terms: value }
                              : item,
                          ),
                        )
                      }
                    />
                    <Select
                      label="Mode"
                      options={[
                        { label: "Equivalence", value: "equivalence" },
                        { label: "Inferred", value: "inferred" },
                      ]}
                      value={row.mode}
                      disabled={saving}
                      onChange={(value) =>
                        setRows((current) =>
                          current.map((item) =>
                            item.id === row.id
                              ? {
                                  ...item,
                                  mode:
                                    value === "inferred"
                                      ? "inferred"
                                      : "equivalence",
                                }
                              : item,
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
                      { id: newId(), terms: "", mode: "equivalence" },
                    ])
                  }
                >
                  Add synonym group
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
