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
  Banner,
  BlockStack,
  Button,
  Card,
  Checkbox,
  InlineStack,
  Layout,
  Page,
  ResourceItem,
  ResourceList,
  Tag,
  Text,
  TextField,
} from "@shopify/polaris";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { authenticateAdminAllowReviewBot } from "../lib/admin-auth.server";
import { ensureShopAccess } from "../services/billing.server";
import { DEFAULT_SEARCH_EXTRAS } from "../utils/instant-search";
import { isMutationBusy } from "../components/admin-loading";
import { CheckboxOrderList } from "../components/checkbox-order-list";
import {
  SEARCH_FIELD_KEYS,
  SEARCH_FIELD_LABELS,
  SUGGESTION_LIST_MAX,
  normalizeHandleList,
  normalizeSearchFields,
  type SearchFieldKey,
} from "../utils/app-settings";
import {
  POPULAR_TERM_MAX,
  normalizePopularTerms,
  parseSearchExtras,
  normalizeStopWordList,
  type SearchExtras,
} from "../utils/instant-search";
import { getAppSettings, saveSearchSettings } from "../services/settings.server";
import { useEmbeddedNavigate } from "../hooks/use-embedded-navigate";
import {
  ContextualSaveBar,
  isDirtySnapshot,
  requestFormSubmit,
} from "../components/contextual-save-bar";

export { SearchPageSkeleton as HydrateFallback } from "../components/admin-skeletons";

const PREFERENCES = [
  {
    id: "pinnings",
    title: "Pinnings",
    description: "Prioritize products for a search query",
    url: "/app/search/pinnings",
  },
  {
    id: "synonyms",
    title: "Synonyms",
    description: "Map related search terms",
    url: "/app/search/synonyms",
  },
  {
    id: "redirects",
    title: "Redirects",
    description: "Send a search to a specific URL",
    url: "/app/search/redirects",
  },
] as const;

function orderedFieldKeys(enabled: SearchFieldKey[]): SearchFieldKey[] {
  const seen = new Set(enabled);
  return [
    ...enabled,
    ...SEARCH_FIELD_KEYS.filter((key) => !seen.has(key)),
  ];
}

function parseJsonField(raw: unknown): unknown {
  if (typeof raw !== "string" || !raw) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

type SearchPageState = {
  searchFields: SearchFieldKey[];
  fieldOrder: SearchFieldKey[];
  showSuggestionsOnEmptyQuery: boolean;
  showSuggestionsOnNoResults: boolean;
  suggestionProductHandles: string[];
  suggestionCollectionHandles: string[];
  searchExtras: SearchExtras;
};

/** Persistable fields only — omit UI-only fieldOrder from dirty compare. */
function searchPersistSnapshot(state: SearchPageState) {
  return {
    searchFields: state.searchFields,
    showSuggestionsOnEmptyQuery: state.showSuggestionsOnEmptyQuery,
    showSuggestionsOnNoResults: state.showSuggestionsOnNoResults,
    suggestionProductHandles: state.suggestionProductHandles,
    suggestionCollectionHandles: state.suggestionCollectionHandles,
    searchExtras: state.searchExtras,
  };
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const auth = await authenticateAdminAllowReviewBot(request);
  if (auth.bot) {
    const searchFields = normalizeSearchFields(undefined);
    return {
      shopDomain: new URL(request.url).searchParams.get("shop") || "",
      settings: {
        searchFields,
        fieldOrder: orderedFieldKeys(searchFields),
        showSuggestionsOnEmptyQuery: false,
        showSuggestionsOnNoResults: false,
        suggestionProductHandles: [],
        suggestionCollectionHandles: [],
        searchExtras: { ...DEFAULT_SEARCH_EXTRAS },
      } satisfies SearchPageState,
    };
  }

  const { session } = auth;
  const { shop } = await ensureShopAccess(session.shop);
  const settings = await getAppSettings(shop.id);
  const searchFields = normalizeSearchFields(settings.searchFields);

  return {
    shopDomain: session.shop,
    settings: {
      searchFields,
      fieldOrder: orderedFieldKeys(searchFields),
      showSuggestionsOnEmptyQuery: settings.showSuggestionsOnEmptyQuery,
      showSuggestionsOnNoResults: settings.showSuggestionsOnNoResults,
      suggestionProductHandles: settings.suggestionProductHandles,
      suggestionCollectionHandles: settings.suggestionCollectionHandles,
      searchExtras: settings.searchExtras,
    } satisfies SearchPageState,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const { shop } = await ensureShopAccess(session.shop);
  const form = await request.formData();

  const searchFields = normalizeSearchFields(parseJsonField(form.get("searchFields")));
  const current = await getAppSettings(shop.id);
  const incoming = parseSearchExtras(parseJsonField(form.get("searchExtras")));

  await saveSearchSettings(shop.id, {
    searchFields,
    showSuggestionsOnEmptyQuery:
      form.get("showSuggestionsOnEmptyQuery") === "true" ||
      form.get("showSuggestionsOnEmptyQuery") === "on",
    showSuggestionsOnNoResults:
      form.get("showSuggestionsOnNoResults") === "true" ||
      form.get("showSuggestionsOnNoResults") === "on",
    suggestionProductHandles: normalizeHandleList(
      form.get("suggestionProductHandles"),
    ),
    suggestionCollectionHandles: normalizeHandleList(
      form.get("suggestionCollectionHandles"),
    ),
    searchExtras: {
      ...incoming,
      // Keep legacy instant.* settings if present in DB; embed UI is retired.
      instant: current.searchExtras.instant,
      pinnings: current.searchExtras.pinnings,
      synonyms: current.searchExtras.synonyms,
      redirects: current.searchExtras.redirects,
    },
  });

  return { ok: true };
};

export default function SearchPage() {
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const submit = useSubmit();
  const navigate = useEmbeddedNavigate();
  const shopify = useAppBridge();
  const [state, setState] = useState<SearchPageState>(data.settings);
  const [loaderSettings, setLoaderSettings] = useState(data.settings);
  const [popularDraft, setPopularDraft] = useState("");

  if (data.settings !== loaderSettings) {
    setLoaderSettings(data.settings);
    setState(data.settings);
  }

  const saving = isMutationBusy(navigation);
  const dirty = isDirtySnapshot(
    searchPersistSnapshot(state),
    searchPersistSnapshot(data.settings),
  );

  useEffect(() => {
    if (actionData && "ok" in actionData && actionData.ok) {
      shopify.toast.show("Search settings saved");
    }
  }, [actionData, shopify]);

  const patchExtras = (patch: Partial<SearchExtras>) => {
    setState((s) => ({
      ...s,
      searchExtras: { ...s.searchExtras, ...patch },
    }));
  };

  const submitState = (next: SearchPageState) => {
    const formData = new FormData();
    formData.set("searchFields", JSON.stringify(next.searchFields));
    formData.set("searchExtras", JSON.stringify(next.searchExtras));
    formData.set(
      "showSuggestionsOnEmptyQuery",
      String(next.showSuggestionsOnEmptyQuery),
    );
    formData.set(
      "showSuggestionsOnNoResults",
      String(next.showSuggestionsOnNoResults),
    );
    formData.set(
      "suggestionProductHandles",
      next.suggestionProductHandles.join("\n"),
    );
    formData.set(
      "suggestionCollectionHandles",
      next.suggestionCollectionHandles.join("\n"),
    );
    submit(formData, { method: "POST" });
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submitState(state);
  };

  const addPopularTerm = () => {
    setState((s) => ({
      ...s,
      searchExtras: {
        ...s.searchExtras,
        popularSearchTerms: normalizePopularTerms([
          ...s.searchExtras.popularSearchTerms,
          popularDraft,
        ]),
      },
    }));
    setPopularDraft("");
  };

  return (
    <>
    <ContextualSaveBar
      id="search-settings-save-bar"
      open={dirty}
      saving={saving}
      onSave={() => {
        requestFormSubmit("search-form");
      }}
      onDiscard={() => setState(data.settings)}
    />
    <Page title="Search">
      <Layout>
        <Layout.Section>
          <Form id="search-form" method="post" onSubmit={handleSubmit}>
            <BlockStack gap="400">
              <Card>
                <BlockStack gap="300">
                  <Text as="h2" variant="headingMd">
                    Tools
                  </Text>
                  <Checkbox
                    label="AI-Powered Search"
                    checked={false}
                    disabled
                    helpText="Requires a Professional plan upgrade."
                    onChange={() => undefined}
                  />
                  <Checkbox
                    label="Fuzzy text search"
                    checked={state.searchExtras.fuzzyTextSearch}
                    disabled={saving}
                    helpText="Small misspellings still match. Rules: 4–5 letters → 1 edit; 6+ letters → 2 edits. Example: shrt → shirt."
                    onChange={(checked) =>
                      patchExtras({ fuzzyTextSearch: checked })
                    }
                  />
                  <Checkbox
                    label="Spell check"
                    checked={state.searchExtras.spellCheck}
                    disabled={saving}
                    helpText="When a typo is corrected, show Did you mean. This is edit-distance, not AI."
                    onChange={(checked) =>
                      patchExtras({ spellCheck: checked })
                    }
                  />
                  <Checkbox
                    label="Fallback search"
                    checked={state.searchExtras.fallbackSearch}
                    disabled={saving}
                    helpText="If nothing matches all keywords, broaden the query to any remaining keyword."
                    onChange={(checked) =>
                      patchExtras({ fallbackSearch: checked })
                    }
                  />
                  <TextField
                    label="Stop words"
                    value={state.searchExtras.stopWords.join("\n")}
                    multiline={4}
                    autoComplete="off"
                    disabled={saving}
                    helpText="Ignored in search queries (one per line). “the red shirt” searches red + shirt."
                    onChange={(value) =>
                      patchExtras({
                        stopWords: normalizeStopWordList(value),
                      })
                    }
                  />
                </BlockStack>
              </Card>

              <Text as="h2" variant="headingMd">
                Preferences
              </Text>
              <Card padding="0">
                <ResourceList
                  resourceName={{
                    singular: "preference",
                    plural: "preferences",
                  }}
                  items={[...PREFERENCES]}
                  renderItem={(item) => (
                    <ResourceItem
                      id={item.id}
                      accessibilityLabel={`Open ${item.title}`}
                      onClick={() => navigate(item.url)}
                    >
                      <InlineStack
                        align="space-between"
                        blockAlign="center"
                        gap="400"
                        wrap={false}
                      >
                        <BlockStack gap="050">
                          <Text
                            as="span"
                            variant="bodyMd"
                            fontWeight="semibold"
                          >
                            {item.title}
                          </Text>
                          <Text as="span" variant="bodySm" tone="subdued">
                            {item.description}
                          </Text>
                        </BlockStack>
                        <Button
                          variant="plain"
                          onClick={() => navigate(item.url)}
                        >
                          Open
                        </Button>
                      </InlineStack>
                    </ResourceItem>
                  )}
                />
              </Card>

              <Card>
                <BlockStack gap="300">
                  <Text as="h2" variant="headingMd">
                    Search relevance
                  </Text>
                  {state.searchFields.length === 0 ? (
                    <Banner tone="warning">
                      <p>
                        Search will return no products until at least one
                        field is enabled.
                      </p>
                    </Banner>
                  ) : null}
                  <CheckboxOrderList
                    keys={state.fieldOrder}
                    enabled={state.searchFields}
                    labels={SEARCH_FIELD_LABELS}
                    disabled={saving}
                    helpText="Field order sets simple relevance; no synonym engine here. Drag a row to change priority. Arrow keys also work when a handle is focused. When Metafields is ticked, mapped metafields from Settings → Metafields are searched."
                    onReorder={(next) =>
                      setState((s) => {
                        const fieldOrder = next.filter(
                          (key): key is SearchFieldKey =>
                            SEARCH_FIELD_KEYS.includes(
                              key as SearchFieldKey,
                            ),
                        );
                        const enabled = new Set(s.searchFields);
                        return {
                          ...s,
                          fieldOrder,
                          searchFields: fieldOrder.filter((key) =>
                            enabled.has(key),
                          ),
                        };
                      })
                    }
                    onToggle={(key, checked) =>
                      setState((s) => {
                        const field = key as SearchFieldKey;
                        if (!SEARCH_FIELD_KEYS.includes(field)) return s;
                        const searchFields = checked
                          ? s.fieldOrder.filter(
                              (item) =>
                                item === field ||
                                s.searchFields.includes(item),
                            )
                          : s.searchFields.filter((item) => item !== field);
                        return { ...s, searchFields };
                      })
                    }
                  />
                </BlockStack>
              </Card>

              <Card>
                <BlockStack gap="300">
                  <Text as="h2" variant="headingMd">
                    No search result suggestions
                  </Text>
                  <Checkbox
                    label="Show pinned suggestions when a search has no results"
                    checked={state.showSuggestionsOnNoResults}
                    disabled={saving}
                    helpText="When a query matches nothing, keep the empty-results message and list pinned handles underneath."
                    onChange={(checked) =>
                      setState((s) => ({
                        ...s,
                        showSuggestionsOnNoResults: checked,
                      }))
                    }
                  />
                  <TextField
                    label="Pinned product handles"
                    value={state.suggestionProductHandles.join("\n")}
                    multiline={4}
                    autoComplete="off"
                    disabled={saving}
                    helpText={`One handle or product URL per line. First ${SUGGESTION_LIST_MAX} unique handles are kept.`}
                    onChange={(value) =>
                      setState((s) => ({
                        ...s,
                        suggestionProductHandles: normalizeHandleList(value),
                      }))
                    }
                  />
                  <TextField
                    label="Pinned collection handles"
                    value={state.suggestionCollectionHandles.join("\n")}
                    multiline={3}
                    autoComplete="off"
                    disabled={saving}
                    helpText="Optional collection links shown with the same suggestion lists."
                    onChange={(value) =>
                      setState((s) => ({
                        ...s,
                        suggestionCollectionHandles:
                          normalizeHandleList(value),
                      }))
                    }
                  />
                </BlockStack>
              </Card>

              <Card>
                <BlockStack gap="300">
                  <Text as="h2" variant="headingMd">
                    Zero character suggestions
                  </Text>
                  <Checkbox
                    label="Show pinned suggestions when the search box is empty"
                    checked={state.showSuggestionsOnEmptyQuery}
                    disabled={saving}
                    helpText="On focus with no query, show merchant-pinned products and collections — not the full catalog."
                    onChange={(checked) =>
                      setState((s) => ({
                        ...s,
                        showSuggestionsOnEmptyQuery: checked,
                      }))
                    }
                  />
                </BlockStack>
              </Card>

              <Card>
                <BlockStack gap="300">
                  <Text as="h2" variant="headingMd">
                    Suggestion dictionary
                  </Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    Merchant-entered queries returned with Product search
                    results as shoppers type.
                  </Text>
                  <InlineStack gap="200" blockAlign="end" wrap={false}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <TextField
                        label="Keyword"
                        labelHidden
                        placeholder="Shirt"
                        value={popularDraft}
                        autoComplete="off"
                        disabled={
                          saving ||
                          state.searchExtras.popularSearchTerms.length >=
                            POPULAR_TERM_MAX
                        }
                        onChange={setPopularDraft}
                      />
                    </div>
                    <Button
                      disabled={
                        saving ||
                        !popularDraft.trim() ||
                        state.searchExtras.popularSearchTerms.length >=
                          POPULAR_TERM_MAX
                      }
                      onClick={addPopularTerm}
                    >
                      Add
                    </Button>
                  </InlineStack>
                  {state.searchExtras.popularSearchTerms.length === 0 ? (
                    <Text as="p" variant="bodySm" tone="subdued">
                      No keywords selected.
                    </Text>
                  ) : (
                    <InlineStack gap="200" wrap>
                      {state.searchExtras.popularSearchTerms.map((term) => (
                        <Tag
                          key={term}
                          onRemove={
                            saving
                              ? undefined
                              : () =>
                                  patchExtras({
                                    popularSearchTerms:
                                      state.searchExtras.popularSearchTerms.filter(
                                        (item) => item !== term,
                                      ),
                                  })
                          }
                        >
                          {term}
                        </Tag>
                      ))}
                    </InlineStack>
                  )}
                </BlockStack>
              </Card>
            </BlockStack>
          </Form>
        </Layout.Section>
      </Layout>
    </Page>
    </>
  );
}

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
    if (currentUrl.search === nextUrl.search) return false;
  }
  return defaultShouldRevalidate;
}

export const headers: HeadersFunction = (headersArgs) =>
  boundary.headers(headersArgs);
