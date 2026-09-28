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
import { authenticateAdminAllowReviewBot } from "../lib/admin-auth.server";
import { ensureShopAccess } from "../services/billing.server";
import { isMutationBusy } from "../components/admin-loading";
import { useConfirmDelete } from "../components/confirm-delete-modal";
import { parseSynonyms } from "../utils/instant-search";
import { getAppSettings, saveSearchSettings } from "../services/settings.server";
import { lastPageIndex, slicePage } from "../utils/admin-list-page";
import { AdminListPagination } from "../components/admin-list-pagination";
import { useEmbeddedNavigate } from "../hooks/use-embedded-navigate";
import {
  ContextualSaveBar,
  isDirtySnapshot,
  requestFormSubmit,
} from "../components/contextual-save-bar";

export { SynonymsPageSkeleton as HydrateFallback } from "../components/admin-skeletons";

type SynonymDraft = {
  id: string;
  terms: string;
  mode: "equivalence" | "inferred";
};

/** Persistable fields only — omit UI-only id from dirty compare. */
function synonymsPersistSnapshot(rows: SynonymDraft[]) {
  return rows.map(({ terms, mode }) => ({ terms, mode }));
}

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const auth = await authenticateAdminAllowReviewBot(request);
  if (auth.bot) {
    return { rows: [] as SynonymDraft[] };
  }
  const { session } = auth;
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
  const navigate = useEmbeddedNavigate();
  const { ask, dialog } = useConfirmDelete();
  const [rows, setRows] = useState<SynonymDraft[]>(data.rows);
  const [loaderRows, setLoaderRows] = useState(data.rows);
  const [page, setPage] = useState(0);
  if (data.rows !== loaderRows) {
    setLoaderRows(data.rows);
    setRows(data.rows);
  }

  const slice = slicePage(rows, page);
  if (page !== slice.safePage) setPage(slice.safePage);

  const saving = isMutationBusy(navigation);
  const dirty = isDirtySnapshot(
    synonymsPersistSnapshot(rows),
    synonymsPersistSnapshot(data.rows),
  );

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
    <>
    <ContextualSaveBar
      id="search-synonyms-save-bar"
      open={dirty}
      saving={saving}
      onSave={() => {
        requestFormSubmit("search-synonyms-form");
      }}
      onDiscard={() => setRows(data.rows)}
    />
    <Page
      title="Synonyms"
      backAction={{ content: "Search", onAction: () => navigate("/app/search") }}
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
                {slice.paged.map((row, index) => (
                  <BlockStack key={row.id} gap="200">
                    <InlineStack align="space-between" blockAlign="center">
                      <Text as="h3" variant="headingSm">
                        Group {slice.start + index + 1}
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
                <AdminListPagination
                  slice={slice}
                  onPageChange={setPage}
                  noun="group"
                />
                <Button
                  disabled={saving}
                  onClick={() => {
                    setRows((current) => [
                      ...current,
                      { id: newId(), terms: "", mode: "equivalence" },
                    ]);
                    setPage(lastPageIndex(rows.length + 1));
                  }}
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
    </>
  );
}

export const headers: HeadersFunction = (headersArgs) =>
  boundary.headers(headersArgs);
