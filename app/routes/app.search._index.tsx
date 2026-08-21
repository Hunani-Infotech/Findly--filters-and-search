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
  ChoiceList,
  InlineStack,
  Layout,
  Page,
  ResourceItem,
  ResourceList,
  Tabs,
  Tag,
  Text,
  TextField,
} from "@shopify/polaris";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { ensureShopAccess } from "../billing.server";
import { isMutationBusy } from "../components/admin-loading";
import { CheckboxOrderList } from "../components/checkbox-order-list";
import { InstantLayoutPicker } from "../components/instant-layout-picker";
import {
  SEARCH_FIELD_KEYS,
  SEARCH_FIELD_LABELS,
  SUGGESTION_LIST_MAX,
  normalizeHandleList,
  normalizeSearchFields,
  type SearchFieldKey,
} from "../app-settings";
import {
  INSTANT_MAX_PRODUCTS_MAX,
  INSTANT_MAX_PRODUCTS_MIN,
  INSTANT_PRODUCT_STYLE_LABELS,
  INSTANT_PRODUCT_STYLES,
  POPULAR_TERM_MAX,
  normalizePopularTerms,
  parseMaxProducts,
  parseSearchExtras,
  type InstantProductStyle,
  type SearchExtras,
} from "../instant-search";
import { getAppSettings, saveSearchSettings } from "../settings.server";
import { useEmbeddedNavigate } from "../admin-path";

const SEARCH_TABS = [
  { id: "settings", content: "Settings", panelID: "search-settings" },
  { id: "instant", content: "Instant search widget", panelID: "search-instant" },
] as const;

type SearchTabId = (typeof SEARCH_TABS)[number]["id"];

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

function parseSearchTab(value: unknown): SearchTabId {
  return value === "instant" ? "instant" : "settings";
}

function tabPanelStyle(visible: boolean) {
  return visible ? undefined : { display: "none" as const };
}

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

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const { shop } = await ensureShopAccess(session.shop);
  const settings = await getAppSettings(shop.id);
  const searchFields = normalizeSearchFields(settings.searchFields);
  const tab = parseSearchTab(new URL(request.url).searchParams.get("tab"));

  return {
    tab,
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
  const searchExtras = parseSearchExtras(parseJsonField(form.get("searchExtras")));

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
    searchExtras,
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
  const [selectedTab, setSelectedTab] = useState<SearchTabId>(data.tab);
  const [popularDraft, setPopularDraft] = useState("");

  if (data.settings !== loaderSettings) {
    setLoaderSettings(data.settings);
    setState(data.settings);
  }

  const saving = isMutationBusy(navigation);
  const selectedTabIndex = SEARCH_TABS.findIndex((tab) => tab.id === selectedTab);
  const embedEditor = `https://${data.shopDomain}/admin/themes/current/editor?context=apps`;

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
    <Page
      title="Search"
      primaryAction={{
        content: saving ? "Saving…" : "Save",
        loading: saving,
        disabled: saving,
        onAction: () => {
          const form = document.getElementById(
            "search-form",
          ) as HTMLFormElement | null;
          form?.requestSubmit();
        },
      }}
    >
      <Layout>
        <Layout.Section>
          <BlockStack gap="400">
            <Tabs
              tabs={[...SEARCH_TABS]}
              selected={selectedTabIndex < 0 ? 0 : selectedTabIndex}
              onSelect={(index) => {
                const next = SEARCH_TABS[index];
                if (!next) return;
                setSelectedTab(next.id);
              }}
            />
            <Form id="search-form" method="post" onSubmit={handleSubmit}>
              <div
                id="search-settings"
                role="tabpanel"
                style={tabPanelStyle(selectedTab === "settings")}
              >
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
                        helpText="Return results even with small misspellings."
                        onChange={(checked) =>
                          patchExtras({ fuzzyTextSearch: checked })
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
                        helpText="Field order sets simple relevance; no synonym engine here. Drag a row to change priority. Arrow keys also work when a handle is focused."
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
                        Popular search terms
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
              </div>

              <div
                id="search-instant"
                role="tabpanel"
                style={tabPanelStyle(selectedTab === "instant")}
              >
                <BlockStack gap="400">
                  <Card>
                    <BlockStack gap="300">
                      <Checkbox
                        label="Enable Instant Search widget"
                        checked={state.searchExtras.instant.enabled}
                        disabled={saving}
                        helpText="Shows live results while customers type in the store search bar."
                        onChange={(checked) =>
                          setState((s) => ({
                            ...s,
                            searchExtras: {
                              ...s.searchExtras,
                              instant: {
                                ...s.searchExtras.instant,
                                enabled: checked,
                              },
                            },
                          }))
                        }
                      />
                    </BlockStack>
                  </Card>

                  <Card>
                    <BlockStack gap="300">
                      <Text as="h2" variant="headingMd">
                        Search widget layout
                      </Text>
                      <InstantLayoutPicker
                        value={state.searchExtras.instant.layout}
                        disabled={saving}
                        onChange={(layout) =>
                          setState((s) => ({
                            ...s,
                            searchExtras: {
                              ...s.searchExtras,
                              instant: { ...s.searchExtras.instant, layout },
                            },
                          }))
                        }
                      />
                    </BlockStack>
                  </Card>

                  <Card>
                    <BlockStack gap="300">
                      <ChoiceList
                        title="Search results"
                        choices={INSTANT_PRODUCT_STYLES.map((style) => ({
                          label: INSTANT_PRODUCT_STYLE_LABELS[style],
                          value: style,
                        }))}
                        selected={[state.searchExtras.instant.productStyle]}
                        disabled={saving}
                        onChange={(selected) => {
                          const productStyle =
                            (selected[0] as InstantProductStyle) || "grid";
                          setState((s) => ({
                            ...s,
                            searchExtras: {
                              ...s.searchExtras,
                              instant: {
                                ...s.searchExtras.instant,
                                productStyle,
                              },
                            },
                          }));
                        }}
                      />
                      <Text as="h2" variant="headingMd">
                        What to show
                      </Text>
                      <Checkbox
                        label="Products"
                        checked={state.searchExtras.instant.showProducts}
                        disabled={saving}
                        onChange={(checked) =>
                          setState((s) => ({
                            ...s,
                            searchExtras: {
                              ...s.searchExtras,
                              instant: {
                                ...s.searchExtras.instant,
                                showProducts: checked,
                              },
                            },
                          }))
                        }
                      />
                      <Checkbox
                        label="Collections"
                        checked={state.searchExtras.instant.showCollections}
                        disabled={saving}
                        onChange={(checked) =>
                          setState((s) => ({
                            ...s,
                            searchExtras: {
                              ...s.searchExtras,
                              instant: {
                                ...s.searchExtras.instant,
                                showCollections: checked,
                              },
                            },
                          }))
                        }
                      />
                      <Checkbox
                        label="Blog Posts"
                        checked={state.searchExtras.instant.showBlogPosts}
                        disabled={saving}
                        helpText="Can be enabled even if the storefront list is empty for now."
                        onChange={(checked) =>
                          setState((s) => ({
                            ...s,
                            searchExtras: {
                              ...s.searchExtras,
                              instant: {
                                ...s.searchExtras.instant,
                                showBlogPosts: checked,
                              },
                            },
                          }))
                        }
                      />
                      <Checkbox
                        label="Pages"
                        checked={state.searchExtras.instant.showPages}
                        disabled={saving}
                        helpText="Can be enabled even if the storefront list is empty for now."
                        onChange={(checked) =>
                          setState((s) => ({
                            ...s,
                            searchExtras: {
                              ...s.searchExtras,
                              instant: {
                                ...s.searchExtras.instant,
                                showPages: checked,
                              },
                            },
                          }))
                        }
                      />
                      <TextField
                        label="Maximum products"
                        type="number"
                        min={INSTANT_MAX_PRODUCTS_MIN}
                        max={INSTANT_MAX_PRODUCTS_MAX}
                        autoComplete="off"
                        value={String(state.searchExtras.instant.maxProducts)}
                        disabled={saving}
                        helpText={`Show between ${INSTANT_MAX_PRODUCTS_MIN} and ${INSTANT_MAX_PRODUCTS_MAX} products.`}
                        onChange={(value) =>
                          setState((s) => ({
                            ...s,
                            searchExtras: {
                              ...s.searchExtras,
                              instant: {
                                ...s.searchExtras.instant,
                                maxProducts: parseMaxProducts(value),
                              },
                            },
                          }))
                        }
                      />
                      <Checkbox
                        label="Show product price"
                        checked={state.searchExtras.instant.showPrice}
                        disabled={saving}
                        onChange={(checked) =>
                          setState((s) => ({
                            ...s,
                            searchExtras: {
                              ...s.searchExtras,
                              instant: {
                                ...s.searchExtras.instant,
                                showPrice: checked,
                              },
                            },
                          }))
                        }
                      />
                      <Checkbox
                        label="Show product vendor"
                        checked={state.searchExtras.instant.showVendor}
                        disabled={saving}
                        onChange={(checked) =>
                          setState((s) => ({
                            ...s,
                            searchExtras: {
                              ...s.searchExtras,
                              instant: {
                                ...s.searchExtras.instant,
                                showVendor: checked,
                              },
                            },
                          }))
                        }
                      />
                    </BlockStack>
                  </Card>

                  <Banner tone="info">
                    <p>
                      Enable the Instant search app embed in the theme editor
                      (Theme settings → App embeds).
                    </p>
                    <div style={{ marginTop: 12 }}>
                      <Button url={embedEditor} target="_blank">
                        Open app embeds
                      </Button>
                    </div>
                  </Banner>
                </BlockStack>
              </div>
            </Form>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

export const headers: HeadersFunction = (headersArgs) =>
  boundary.headers(headersArgs);
