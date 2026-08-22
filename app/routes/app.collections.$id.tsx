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
  useRouteError,
  useSubmit,
} from "react-router";
import {
  Banner,
  BlockStack,
  Card,
  Checkbox,
  ChoiceList,
  FormLayout,
  InlineStack,
  Layout,
  Page,
  Text,
  TextField,
} from "@shopify/polaris";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { ensureShopAccess } from "../billing.server";
import { mappedFacetsForAdmin, normalizeDisplayOrder, parseDisplayTypes, parseMatchModes, parseRangeBounds, parseValueSort, rangeBoundsToForm, type RangeBoundFormMap, type ValueSortMap } from "../filters.server";
import { storedFilterDisplayOrder } from "../filter-option-rows";
import { getFilterConfig, getListFacetValueCatalog, getMetafieldMappings, saveFilterConfig, filterConfigPriceFields, hasCollectionAssignment } from "../shop.server";
import { toCollectionGid } from "../settings.server";
import { isMutationBusy } from "../components/admin-loading";
import { DisplayOrderList } from "../components/display-order-list";
import { FacetValueSortEditor } from "../components/facet-value-sort";
import { FilterOptionsGuide } from "../components/filter-options-guide";
import { NumericRangeBounds } from "../components/numeric-range-bounds";
import { useEmbeddedNavigate } from "../admin-path";

export { FilterEditorSkeleton as HydrateFallback } from "../components/admin-skeletons";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const { shop } = await ensureShopAccess(session.shop);

  const id = params.id;
  if (!id) {
    throw new Response("Collection id required", { status: 400 });
  }

  const collectionGid = toCollectionGid(id);
  const collection = await prisma.collection.findUnique({
    where: {
      shopId_collectionGid: {
        shopId: shop.id,
        collectionGid,
      },
    },
  });

  if (!collection) {
    return {
      notFound: true as const,
      collectionGid,
      collection: null,
      usingDefault: true,
      config: {
        enabled: true,
        enablePrice: true,
        enableSale: false,
        enableRating: false,
        enableLocation: false,
        enableAvailability: true,
        enableVendor: true,
        enableProductType: true,
        enableTags: true,
        enableOptions: true,
        displayOrder: normalizeDisplayOrder(),
        displayTypes: {},
        matchModes: {},
        valueSort: {},
        rangeBounds: {},
        ...filterConfigPriceFields(null),
      },
      valueCatalog: [] as Array<{ key: string; label: string; values: string[] }>,
      listMetafields: [] as Array<{ key: string; label: string }>,
      mappedFacets: [] as Array<{ key: string; label: string; filterType: string }>,
    };
  }

  const [config, hasSpecific, valueCatalog, mappings] = await Promise.all([
    getFilterConfig(shop.id, collectionGid),
    hasCollectionAssignment(shop.id, collectionGid),
    getListFacetValueCatalog(shop.id, collectionGid),
    getMetafieldMappings(shop.id),
  ]);
  const mappedFacets = mappedFacetsForAdmin(mappings);
  const listMetafields = mappedFacets.filter(
    (mapping) => mapping.filterType === "LIST",
  );

  return {
    notFound: false as const,
    collectionGid,
    collection: {
      title: collection.title,
      handle: collection.handle,
      collectionGid: collection.collectionGid,
    },
    usingDefault: !hasSpecific,
    valueCatalog,
    listMetafields,
    mappedFacets,
    config: {
      enabled: config?.enabled ?? true,
      enablePrice: config?.enablePrice ?? true,
      enableSale: config?.enableSale ?? false,
      enableRating: config?.enableRating ?? false,
      enableLocation: config?.enableLocation ?? false,
      enableAvailability: config?.enableAvailability ?? true,
      enableVendor: config?.enableVendor ?? true,
      enableProductType: config?.enableProductType ?? true,
      enableTags: config?.enableTags ?? true,
      enableOptions: config?.enableOptions ?? true,
      displayOrder: storedFilterDisplayOrder(
        config?.displayOrder,
        config?.enableSale,
      ),
      displayTypes: parseDisplayTypes(
        config && "displayTypes" in config ? config.displayTypes : {},
      ),
      matchModes: parseMatchModes(
        config && "matchModes" in config ? config.matchModes : {},
      ),
      valueSort: parseValueSort(
        config && "valueSort" in config ? config.valueSort : {},
      ),
      rangeBounds: rangeBoundsToForm(
        parseRangeBounds(
          config && "rangeBounds" in config ? config.rangeBounds : {},
        ),
      ),
      ...filterConfigPriceFields(config),
    },
  };
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const { shop } = await ensureShopAccess(session.shop);

  const id = params.id;
  if (!id) {
    return { error: "Collection id required" };
  }

  const collectionGid = toCollectionGid(id);
  const form = await request.formData();

  const bool = (key: string) => form.get(key) === "true" || form.get(key) === "on";

  let displayOrder: string[] = normalizeDisplayOrder();
  const orderRaw = form.get("displayOrder");
  if (typeof orderRaw === "string" && orderRaw) {
    try {
      const parsed = JSON.parse(orderRaw) as string[];
      if (Array.isArray(parsed) && parsed.length) {
        displayOrder = normalizeDisplayOrder(parsed);
      }
    } catch {
      // keep default
    }
  }

  let displayTypes = parseDisplayTypes({});
  const typesRaw = form.get("displayTypes");
  if (typeof typesRaw === "string" && typesRaw) {
    try {
      displayTypes = parseDisplayTypes(JSON.parse(typesRaw));
    } catch {
      // keep empty
    }
  }

  let matchModes = parseMatchModes({});
  const modesRaw = form.get("matchModes");
  if (typeof modesRaw === "string" && modesRaw) {
    try {
      matchModes = parseMatchModes(JSON.parse(modesRaw));
    } catch {
      // keep empty
    }
  }

  let valueSort = parseValueSort({});
  const sortRaw = form.get("valueSort");
  if (typeof sortRaw === "string" && sortRaw) {
    try {
      valueSort = parseValueSort(JSON.parse(sortRaw));
    } catch {
      // keep empty
    }
  }

  let rangeBounds = parseRangeBounds({});
  const boundsRaw = form.get("rangeBounds");
  if (typeof boundsRaw === "string" && boundsRaw) {
    try {
      rangeBounds = parseRangeBounds(JSON.parse(boundsRaw));
    } catch {
      // keep empty
    }
  }

  const parseMoney = (key: string) => {
    const raw = form.get(key);
    if (typeof raw !== "string" || !raw.trim()) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  };

  let customMin = parseMoney("customPriceMin");
  let customMax = parseMoney("customPriceMax");
  if (customMin != null && customMax != null && customMin > customMax) {
    const swap = customMin;
    customMin = customMax;
    customMax = swap;
  }

  const priceRangeMode =
    form.get("priceRangeMode") === "custom" ? "custom" : "auto";
  if (priceRangeMode === "custom" && (customMin == null || customMax == null)) {
    return { error: "Custom price range needs both a min and a max." };
  }

  for (const [key, entry] of Object.entries(rangeBounds)) {
    if (entry.mode === "custom" && (entry.min == null || entry.max == null)) {
      return { error: `Custom range for ${key} needs both a min and a max.` };
    }
  }

  await saveFilterConfig(shop.id, {
    collectionGid,
    enabled: bool("enabled"),
    enablePrice: bool("enablePrice"),
    enableSale: bool("enableSale"),
    enableRating: bool("enableRating"),
    enableLocation: bool("enableLocation"),
    enableAvailability: bool("enableAvailability"),
    enableVendor: bool("enableVendor"),
    enableProductType: bool("enableProductType"),
    enableTags: bool("enableTags"),
    enableOptions: bool("enableOptions"),
    priceRangeMode,
    customPriceMin: customMin,
    customPriceMax: customMax,
    displayOrder,
    displayTypes,
    matchModes,
    valueSort,
    rangeBounds,
  });

  return { ok: true };
};

type ConfigState = {
  enabled: boolean;
  enablePrice: boolean;
  enableSale: boolean;
  enableRating: boolean;
  enableLocation: boolean;
  enableAvailability: boolean;
  enableVendor: boolean;
  enableProductType: boolean;
  enableTags: boolean;
  enableOptions: boolean;
  priceRangeMode: "auto" | "custom";
  customPriceMin: string;
  customPriceMax: string;
  displayOrder: string[];
  displayTypes: Record<string, string>;
  matchModes: Record<string, "or" | "and">;
  valueSort: ValueSortMap;
  rangeBounds: RangeBoundFormMap;
};

export default function CollectionFilterConfigPage() {
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const navigate = useEmbeddedNavigate();
  const submit = useSubmit();
  const shopify = useAppBridge();
  const [config, setConfig] = useState<ConfigState>(data.config);
  const [loaderConfig, setLoaderConfig] = useState(data.config);
  if (data.config !== loaderConfig) {
    setLoaderConfig(data.config);
    setConfig(data.config);
  }

  const saving = isMutationBusy(navigation);

  useEffect(() => {
    if (actionData && "ok" in actionData && actionData.ok) {
      shopify.toast.show("Filter config saved");
    }
    if (actionData && "error" in actionData && actionData.error) {
      shopify.toast.show(actionData.error, { isError: true });
    }
  }, [actionData, shopify]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData();
    formData.set("enabled", String(config.enabled));
    formData.set("enablePrice", String(config.enablePrice));
    formData.set("enableSale", String(config.enableSale));
    formData.set("enableRating", String(config.enableRating));
    formData.set("enableLocation", String(config.enableLocation));
    formData.set("enableAvailability", String(config.enableAvailability));
    formData.set("enableVendor", String(config.enableVendor));
    formData.set("enableProductType", String(config.enableProductType));
    formData.set("enableTags", String(config.enableTags));
    formData.set("enableOptions", String(config.enableOptions));
    formData.set("priceRangeMode", config.priceRangeMode);
    formData.set("customPriceMin", config.customPriceMin);
    formData.set("customPriceMax", config.customPriceMax);
    formData.set("displayOrder", JSON.stringify(config.displayOrder));
    formData.set("displayTypes", JSON.stringify(config.displayTypes));
    formData.set("matchModes", JSON.stringify(config.matchModes));
    formData.set("valueSort", JSON.stringify(config.valueSort));
    formData.set("rangeBounds", JSON.stringify(config.rangeBounds));
    submit(formData, { method: "POST" });
  };

  if (data.notFound || !data.collection) {
    return (
      <Page
        title="Collection not found"
        backAction={{
          content: "Collections",
          onAction: () => navigate("/app"),
        }}
      >
        <Layout>
          <Layout.Section>
            <Banner
              tone="warning"
              title="This collection is not in the local index"
              action={{
                content: "Go to Sync",
                onAction: () => navigate("/app/sync"),
              }}
            >
              <p>
                Run a full sync, then open Configure again. Looking for{" "}
                {data.collectionGid}.
              </p>
            </Banner>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  return (
    <Page
      title={data.collection.title}
      subtitle={
        data.collection.handle
          ? `Handle: ${data.collection.handle}`
          : data.collection.collectionGid
      }
      backAction={{
        content: "Collections",
        onAction: () => navigate("/app"),
      }}
      primaryAction={{
        content: saving ? "Saving…" : "Save",
        loading: saving,
        disabled: saving,
        onAction: () => {
          const form = document.getElementById(
            "collection-filter-form",
          ) as HTMLFormElement | null;
          form?.requestSubmit();
        },
      }}
    >
      <Layout>
        <Layout.Section>
          <Form id="collection-filter-form" method="post" onSubmit={handleSubmit}>
            <BlockStack gap="400">
              <FilterOptionsGuide variant="collection" />

              <Card>
                <BlockStack gap="300">
                  <Text as="h2" variant="headingMd">
                    1. Filter options
                  </Text>
                  <Text as="p" tone="subdued">
                    Turn on the options shoppers should see. Mapped metafields
                    appear automatically after you enable them on Metafields.
                  </Text>
                  <FormLayout>
                    <Checkbox
                      label="Enable filters for this collection"
                      checked={config.enabled}
                      disabled={saving}
                      onChange={(checked) =>
                        setConfig((c) => ({ ...c, enabled: checked }))
                      }
                    />
                    <Checkbox
                      label="Price"
                      checked={config.enablePrice}
                      disabled={saving}
                      onChange={(checked) =>
                        setConfig((c) => ({ ...c, enablePrice: checked }))
                      }
                    />
                    {config.enablePrice ? (
                      <BlockStack gap="200">
                        <ChoiceList
                          title="Price range"
                          choices={[
                            {
                              label: "From products in this collection",
                              value: "auto",
                              helpText:
                                "Slider min and max come from synced variant prices.",
                            },
                            {
                              label: "Custom min / max",
                              value: "custom",
                              helpText:
                                "You set the slider bounds. Shoppers can still filter inside that range.",
                            },
                          ]}
                          selected={[config.priceRangeMode]}
                          disabled={saving}
                          onChange={(selected) =>
                            setConfig((c) => ({
                              ...c,
                              priceRangeMode:
                                selected[0] === "custom" ? "custom" : "auto",
                            }))
                          }
                        />
                        {config.priceRangeMode === "custom" ? (
                          <InlineStack gap="300" wrap>
                            <TextField
                              label="Custom min"
                              type="number"
                              autoComplete="off"
                              value={config.customPriceMin}
                              disabled={saving}
                              onChange={(value) =>
                                setConfig((c) => ({
                                  ...c,
                                  customPriceMin: value,
                                }))
                              }
                            />
                            <TextField
                              label="Custom max"
                              type="number"
                              autoComplete="off"
                              value={config.customPriceMax}
                              disabled={saving}
                              onChange={(value) =>
                                setConfig((c) => ({
                                  ...c,
                                  customPriceMax: value,
                                }))
                              }
                            />
                          </InlineStack>
                        ) : null}
                      </BlockStack>
                    ) : null}
                    <Checkbox
                      label="% Sale off"
                      helpText="Slider uses real variant compare-at vs price. Turn on after catalog sync."
                      checked={config.enableSale}
                      disabled={saving}
                      onChange={(checked) =>
                        setConfig((c) => ({ ...c, enableSale: checked }))
                      }
                    />
                    <Checkbox
                      label="Rating stars"
                      helpText="Uses Shopify reviews.rating (Judge.me, Loox, Stamped). N stars means that rating and up."
                      checked={config.enableRating}
                      disabled={saving}
                      onChange={(checked) =>
                        setConfig((c) => ({ ...c, enableRating: checked }))
                      }
                    />
                    <Checkbox
                      label="Inventory locations"
                      helpText="Shows location names where a product has available stock. Re-sync the catalog after changing Shopify locations."
                      checked={config.enableLocation}
                      disabled={saving}
                      onChange={(checked) =>
                        setConfig((c) => ({ ...c, enableLocation: checked }))
                      }
                    />
                    <NumericRangeBounds
                      fields={(data.mappedFacets ?? []).filter(
                        (facet) => facet.filterType === "RANGE",
                      )}
                      value={config.rangeBounds}
                      disabled={saving}
                      onChange={(rangeBounds) =>
                        setConfig((c) => ({ ...c, rangeBounds }))
                      }
                    />
                    <Checkbox
                      label="Availability"
                      checked={config.enableAvailability}
                      disabled={saving}
                      onChange={(checked) =>
                        setConfig((c) => ({
                          ...c,
                          enableAvailability: checked,
                        }))
                      }
                    />
                    <Checkbox
                      label="Vendor"
                      checked={config.enableVendor}
                      disabled={saving}
                      onChange={(checked) =>
                        setConfig((c) => ({ ...c, enableVendor: checked }))
                      }
                    />
                    <Checkbox
                      label="Product type"
                      checked={config.enableProductType}
                      disabled={saving}
                      onChange={(checked) =>
                        setConfig((c) => ({
                          ...c,
                          enableProductType: checked,
                        }))
                      }
                    />
                    <Checkbox
                      label="Tags"
                      checked={config.enableTags}
                      disabled={saving}
                      onChange={(checked) =>
                        setConfig((c) => ({ ...c, enableTags: checked }))
                      }
                    />
                    <Checkbox
                      label="Variant options (Size, Color, etc.)"
                      checked={config.enableOptions}
                      disabled={saving}
                      onChange={(checked) =>
                        setConfig((c) => ({ ...c, enableOptions: checked }))
                      }
                    />
                  </FormLayout>
                </BlockStack>
              </Card>

              <Card>
                <BlockStack gap="300">
                  <Text as="h2" variant="headingMd">
                    2. Matching (AND vs OR)
                  </Text>
                  <Banner tone="info">
                    <p>
                      By default, values inside one filter are OR (Red or Blue).
                      Different filters still combine with AND (Color and Size).
                      Tick Use AND condition so a product must match every
                      selected value in that filter (tags, options, or list
                      metafields).
                    </p>
                  </Banner>
                  <FormLayout>
                    <Checkbox
                      label="Use AND condition for Tags"
                      helpText="Product must have every selected tag."
                      checked={config.matchModes.tags === "and"}
                      disabled={saving || !config.enableTags}
                      onChange={(checked) =>
                        setConfig((c) => ({
                          ...c,
                          matchModes: {
                            ...c.matchModes,
                            tags: checked ? "and" : "or",
                          },
                        }))
                      }
                    />
                    <Checkbox
                      label="Use AND condition for Variant options"
                      helpText="Product must include every selected option value (for example Red and Blue variants)."
                      checked={config.matchModes.options === "and"}
                      disabled={saving || !config.enableOptions}
                      onChange={(checked) =>
                        setConfig((c) => ({
                          ...c,
                          matchModes: {
                            ...c.matchModes,
                            options: checked ? "and" : "or",
                          },
                        }))
                      }
                    />
                    {(data.listMetafields ?? []).map((field) => (
                      <Checkbox
                        key={field.key}
                        label={`Use AND condition for ${field.label}`}
                        helpText="List metafield must contain every selected value."
                        checked={config.matchModes[field.key] === "and"}
                        disabled={saving}
                        onChange={(checked) =>
                          setConfig((c) => ({
                            ...c,
                            matchModes: {
                              ...c.matchModes,
                              [field.key]: checked ? "and" : "or",
                            },
                          }))
                        }
                      />
                    ))}
                  </FormLayout>
                </BlockStack>
              </Card>

              <Card>
                <BlockStack gap="300">
                  <Text as="h2" variant="headingMd">
                    3. Display type and order
                  </Text>
                  <DisplayOrderList
                    keys={config.displayOrder}
                    disabled={saving}
                    displayTypes={config.displayTypes}
                    labels={Object.fromEntries(
                      (data.mappedFacets ?? []).map((facet) => [
                        facet.key,
                        facet.label,
                      ]),
                    )}
                    facetKinds={Object.fromEntries(
                      (data.mappedFacets ?? []).map((facet) => [
                        facet.key,
                        facet.filterType,
                      ]),
                    )}
                    onChange={(displayOrder) =>
                      setConfig((c) => ({ ...c, displayOrder }))
                    }
                    onDisplayTypesChange={(displayTypes) =>
                      setConfig((c) => ({ ...c, displayTypes }))
                    }
                  />
                </BlockStack>
              </Card>

              <Card>
                <BlockStack gap="300">
                  <Text as="h2" variant="headingMd">
                    4. Filter value order
                  </Text>
                  <FacetValueSortEditor
                    catalog={data.valueCatalog}
                    valueSort={config.valueSort}
                    disabled={saving}
                    onChange={(valueSort) =>
                      setConfig((c) => ({ ...c, valueSort }))
                    }
                  />
                </BlockStack>
              </Card>
            </BlockStack>
          </Form>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error && "status" in error
        ? `Could not load this collection (${String((error as { status: unknown }).status)})`
        : "Could not load this collection";

  return (
    <Page title="Collection filters">
      <Layout>
        <Layout.Section>
          <Banner tone="critical" title="This page did not load">
            <p>{message}</p>
          </Banner>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
