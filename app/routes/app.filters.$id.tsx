import { useEffect, useMemo, useState, type FormEvent } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import {
  Form,
  redirect,
  useActionData,
  useLoaderData,
  useNavigate,
  useNavigation,
  useRouteError,
  useSearchParams,
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
import { ensureShopAccess } from "../billing.server";
import { catalogOptionRows, metafieldFacetKey, normalizeDisplayOrder, parseDisplayTypes, parseMatchModes, parseRangeBounds, parseValueSort, rangeBoundsToForm, withMappedFacetKeys, type RangeBoundFormMap, type ValueSortMap } from "../filters.server";
import { parseFacetSettings } from "../facet-settings";
import { getListFacetValueCatalog, getMetafieldMappings, filterConfigPriceFields } from "../shop.server";
import {
  deleteFilterTree,
  duplicateFilterTree,
  getFilterTree,
  listFilterTrees,
  updateFilterTree,
} from "../filter-trees.server";
import prisma from "../db.server";
import { isMutationBusy } from "../components/admin-loading";
import { CollectionAppliesTo } from "../components/collection-applies-to";
import { FilterOptionsTable } from "../components/filter-options-table";
import { FacetValueSortEditor } from "../components/facet-value-sort";
import { NumericRangeBounds } from "../components/numeric-range-bounds";
import {
  applyFacetSettingLabels,
  buildVisibleFilterRows,
  builtinDefForKey,
  isOptionRowKey,
  persistDisplayOrder,
  withGloboAdminOptionKeys,
  type BuiltinEnableKey,
} from "../filter-option-rows";

type ConfigState = {
  name: string;
  appliesToSearch: boolean;
  appliesToAllProducts: boolean;
  collectionGids: string[];
  enabled: boolean;
  enablePrice: boolean;
  enableSale: boolean;
  enableRating: boolean;
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

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const { shop } = await ensureShopAccess(session.shop);
  const treeId = params.id;
  if (!treeId) {
    throw new Response("Not found", { status: 404 });
  }
  const config = await getFilterTree(shop.id, treeId);
  if (!config) {
    throw new Response("Not found", { status: 404 });
  }
  const [collections, otherTrees] = await Promise.all([
    prisma.collection.findMany({
      where: { shopId: shop.id },
      orderBy: { title: "asc" },
    }),
    listFilterTrees(shop.id),
  ]);
  const usedElsewhere: Record<string, boolean> = {};
  let allCollectionsUsedElsewhere = false;
  for (const tree of otherTrees) {
    if (tree.id === config.id) continue;
    if (tree.treeCollections.length === 0 && !tree.collectionGid) {
      allCollectionsUsedElsewhere = true;
    }
    for (const row of tree.treeCollections) {
      usedElsewhere[row.collectionGid] = true;
    }
    if (tree.collectionGid) {
      usedElsewhere[tree.collectionGid] = true;
    }
  }
  const valueCatalog = await getListFacetValueCatalog(shop.id, "");
  const optionProducts = await prisma.productFacet.findMany({
    where: { shopId: shop.id, status: "ACTIVE" },
    take: 500,
    select: { options: true },
  });
  const catalogOptions = catalogOptionRows(
    optionProducts.map((product) => ({
      options: (product.options as Record<string, string[]>) || {},
    })),
  );
  const mappedFacets = (await getMetafieldMappings(shop.id))
    .filter((mapping) => mapping.enabled)
    .map((mapping) => ({
      key: metafieldFacetKey(
        mapping.namespace,
        mapping.key,
        mapping.ownerType === "VARIANT" ? "VARIANT" : "PRODUCT",
      ),
      label: mapping.displayLabel || mapping.key,
      filterType: mapping.filterType,
    }));
  const listMetafields = mappedFacets.filter(
    (mapping) => mapping.filterType === "LIST",
  );
  const facetSettings = parseFacetSettings(
    config && "facetSettings" in config ? config.facetSettings : {},
  );

  return {
    treeId: config.id,
    collections: collections.map((collection) => ({
      collectionGid: collection.collectionGid,
      title: collection.title,
      handle: collection.handle,
    })),
    usedElsewhere,
    allCollectionsUsedElsewhere,
    valueCatalog,
    catalogOptions,
    listMetafields,
    mappedFacets,
    facetSettings,
    config: {
      name: config.name,
      appliesToSearch: config.appliesToSearch,
      appliesToAllProducts: false,
      collectionGids: config.treeCollections.map((row) => row.collectionGid),
      enabled: config.enabled ?? true,
      enablePrice: config?.enablePrice ?? true,
      enableSale: config?.enableSale ?? false,
      enableRating: config?.enableRating ?? false,
      enableAvailability: config?.enableAvailability ?? true,
      enableVendor: config?.enableVendor ?? true,
      enableProductType: config?.enableProductType ?? true,
      enableTags: config?.enableTags ?? true,
      enableOptions: config?.enableOptions ?? true,
      displayOrder: (() => {
        const mapped = withGloboAdminOptionKeys(
          withMappedFacetKeys(
            config?.displayOrder,
            mappedFacets.map((facet) => facet.key),
          ),
        );
        const stored = Array.isArray(config?.displayOrder)
          ? config.displayOrder
          : [];
        if (config?.enableSale || stored.includes("sale") || stored.length === 0) {
          return mapped;
        }
        return mapped.filter((key) => key !== "sale");
      })(),
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
  const treeId = params.id;
  if (!treeId) {
    return { error: "Filter tree required" };
  }
  const form = await request.formData();
  const intent = String(form.get("intent") || "save");

  if (intent === "duplicate") {
    const copy = await duplicateFilterTree(shop.id, treeId);
    if (!copy) return { error: "Could not duplicate this tree." };
    return redirect(`/app/filters/${copy.id}`);
  }
  if (intent === "delete") {
    const result = await deleteFilterTree(shop.id, treeId);
    if ("error" in result) return { error: result.error };
    return redirect("/app");
  }

  const bool = (key: string) => form.get(key) === "true" || form.get(key) === "on";

  let displayOrder: string[] = normalizeDisplayOrder();
  const orderRaw = form.get("displayOrder");
  if (typeof orderRaw === "string" && orderRaw) {
    try {
      const parsed = JSON.parse(orderRaw) as string[];
      if (Array.isArray(parsed) && parsed.length) {
        displayOrder = normalizeDisplayOrder(parsed);
        if (!parsed.includes("sale")) {
          displayOrder = displayOrder.filter((key) => key !== "sale");
        }
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

  let collectionGids: string[] = [];
  const gidsRaw = form.get("collectionGids");
  if (typeof gidsRaw === "string" && gidsRaw) {
    try {
      const parsed = JSON.parse(gidsRaw) as unknown;
      if (Array.isArray(parsed)) {
        collectionGids = parsed.filter((item): item is string => typeof item === "string");
      }
    } catch {
      collectionGids = [];
    }
  }

  await updateFilterTree(shop.id, treeId, {
    name: String(form.get("name") || "Untitled tree"),
    appliesToSearch: bool("appliesToSearch"),
    collectionGids,
    enabled: bool("enabled"),
    enablePrice: bool("enablePrice"),
    enableSale: bool("enableSale"),
    enableRating: bool("enableRating"),
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

export default function FilterTreeEditorPage() {
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const navigate = useNavigate();
  const submit = useSubmit();
  const [searchParams, setSearchParams] = useSearchParams();
  const shopify = useAppBridge();
  const [config, setConfig] = useState<ConfigState>(data.config);
  const [loaderConfig, setLoaderConfig] = useState(data.config);
  if (data.config !== loaderConfig) {
    setLoaderConfig(data.config);
    setConfig(data.config);
  }

  const saving = isMutationBusy(navigation);
  const flags = {
    enablePrice: config.enablePrice,
    enableSale: config.enableSale,
    enableRating: config.enableRating,
    enableAvailability: config.enableAvailability,
    enableVendor: config.enableVendor,
    enableProductType: config.enableProductType,
    enableTags: config.enableTags,
    enableOptions: config.enableOptions,
  };
  const rows = useMemo(
    () =>
      applyFacetSettingLabels(
        buildVisibleFilterRows(
          config.displayOrder,
          flags,
          data.catalogOptions,
          data.mappedFacets,
        ),
        data.facetSettings,
      ),
    // flags fields are listed so we don't depend on a new object identity
    [
      config.displayOrder,
      config.enablePrice,
      config.enableSale,
      config.enableRating,
      config.enableAvailability,
      config.enableVendor,
      config.enableProductType,
      config.enableTags,
      config.enableOptions,
      data.catalogOptions,
      data.mappedFacets,
      data.facetSettings,
    ],
  );
  const untitled =
    !config.name.trim() ||
    /^filter tree \d+$/i.test(config.name.trim()) ||
    config.name.trim() === "Untitled tree";

  useEffect(() => {
    if (actionData && "ok" in actionData && actionData.ok) {
      shopify.toast.show("Filter config saved");
    }
    if (actionData && "error" in actionData && actionData.error) {
      shopify.toast.show(actionData.error, { isError: true });
    }
  }, [actionData, shopify]);

  useEffect(() => {
    const notice = searchParams.get("notice");
    if (notice !== "saved" && notice !== "deleted") return;
    shopify.toast.show(
      notice === "deleted" ? "Filter option removed" : "Filter config saved",
    );
    const next = new URLSearchParams(searchParams);
    next.delete("notice");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, shopify]);

  const patchEnable = (key: BuiltinEnableKey, value: boolean) =>
    setConfig((current) => ({ ...current, [key]: value }));

  const handleRemove = (key: string) => {
    const def = builtinDefForKey(key);
    if (
      def?.enableKey &&
      def.enableKey !== "enableOptions" &&
      def.key !== "sale"
    ) {
      patchEnable(def.enableKey, false);
      return;
    }
    const remaining = rows.map((row) => row.key).filter((item) => item !== key);
    setConfig((current) => ({
      ...current,
      enableSale: remaining.includes("sale"),
      enableOptions: remaining.some(isOptionRowKey),
      displayOrder: persistDisplayOrder(remaining, current.displayOrder),
    }));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData();
    formData.set("intent", "save");
    formData.set("name", config.name);
    formData.set("appliesToSearch", String(config.appliesToSearch));
    formData.set("collectionGids", JSON.stringify(config.collectionGids));
    formData.set("enabled", String(config.enabled));
    formData.set("enablePrice", String(config.enablePrice));
    formData.set("enableSale", String(rows.some((row) => row.key === "sale")));
    formData.set("enableRating", String(config.enableRating));
    formData.set("enableAvailability", String(config.enableAvailability));
    formData.set("enableVendor", String(config.enableVendor));
    formData.set("enableProductType", String(config.enableProductType));
    formData.set("enableTags", String(config.enableTags));
    formData.set("enableOptions", String(config.enableOptions));
    formData.set("priceRangeMode", config.priceRangeMode);
    formData.set("customPriceMin", config.customPriceMin);
    formData.set("customPriceMax", config.customPriceMax);
    formData.set("displayOrder", JSON.stringify(
      persistDisplayOrder(
        rows.map((row) => row.key),
        config.displayOrder,
      ),
    ));
    formData.set("displayTypes", JSON.stringify(config.displayTypes));
    formData.set("matchModes", JSON.stringify(config.matchModes));
    formData.set("valueSort", JSON.stringify(config.valueSort));
    formData.set("rangeBounds", JSON.stringify(config.rangeBounds));
    submit(formData, { method: "POST" });
  };

  return (
    <Page
      title={untitled ? "Add filter" : config.name}
      backAction={{
        content: "Filters",
        onAction: () => navigate("/app"),
      }}
      secondaryActions={[
        {
          content: "Duplicate",
          disabled: saving,
          onAction: () => {
            const formData = new FormData();
            formData.set("intent", "duplicate");
            submit(formData, { method: "POST" });
          },
        },
        {
          content: "Delete",
          disabled: saving,
          destructive: true,
          onAction: () => {
            const formData = new FormData();
            formData.set("intent", "delete");
            submit(formData, { method: "POST" });
          },
        },
      ]}
      primaryAction={{
        content: saving ? "Saving…" : "Save",
        loading: saving,
        disabled: saving,
        onAction: () => {
          const form = document.getElementById(
            "default-filter-form",
          ) as HTMLFormElement | null;
          form?.requestSubmit();
        },
      }}
    >
      <Layout>
        <Layout.Section>
          <Form id="default-filter-form" method="post" onSubmit={handleSubmit}>
            <BlockStack gap="400">
              <Card>
                <BlockStack gap="300">
                  <TextField
                    label="Name"
                    value={config.name}
                    autoComplete="off"
                    disabled={saving}
                    onChange={(value) =>
                      setConfig((c) => ({ ...c, name: value }))
                    }
                  />
                  <CollectionAppliesTo
                    collections={data.collections}
                    selected={config.collectionGids}
                    onChange={(collectionGids) =>
                      setConfig((c) => ({ ...c, collectionGids }))
                    }
                    appliesToSearch={config.appliesToSearch}
                    onAppliesToSearchChange={(appliesToSearch) =>
                      setConfig((c) => ({ ...c, appliesToSearch }))
                    }
                    appliesToAllProducts={config.appliesToAllProducts}
                    onAppliesToAllProductsChange={(appliesToAllProducts) =>
                      setConfig((c) => ({ ...c, appliesToAllProducts }))
                    }
                    allCollections={config.collectionGids.length === 0}
                    onAllCollectionsChange={(next) => {
                      if (next) {
                        setConfig((c) => ({ ...c, collectionGids: [] }));
                      }
                    }}
                    usedElsewhere={data.usedElsewhere}
                    allCollectionsUsedElsewhere={data.allCollectionsUsedElsewhere}
                    disabled={saving}
                  />
                </BlockStack>
              </Card>

              <Card>
                <BlockStack gap="300">
                  <Text as="h2" variant="headingMd">
                    Filter options
                  </Text>
                  <FilterOptionsTable
                    rows={rows}
                    displayTypes={config.displayTypes}
                    disabled={saving}
                    treeId={data.treeId}
                    onAddOption={() =>
                      navigate(`/app/filters/${data.treeId}/options/new`)
                    }
                    onEditOption={(key) =>
                      navigate(
                        `/app/filters/${data.treeId}/options/${encodeURIComponent(key)}`,
                      )
                    }
                    onReorder={(nextKeys) =>
                      setConfig((c) => ({
                        ...c,
                        displayOrder: persistDisplayOrder(
                          nextKeys,
                          c.displayOrder,
                        ),
                      }))
                    }
                    onRemove={handleRemove}
                    onDisplayTypesChange={(displayTypes) =>
                      setConfig((c) => ({ ...c, displayTypes }))
                    }
                  />
                  {config.enablePrice ? (
                    <BlockStack gap="200">
                      <ChoiceList
                        title="Price range"
                        choices={[
                          {
                            label: "From products in each collection",
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
                </BlockStack>
              </Card>

              <Card>
                <BlockStack gap="300">
                  <Text as="h2" variant="headingMd">
                    Matching (AND vs OR)
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
                    Filter value order
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
        ? `Could not load shop-wide defaults (${String((error as { status: unknown }).status)})`
        : "Could not load shop-wide defaults";

  return (
    <Page title="Shop-wide default filters">
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
