import { useEffect, useMemo, useState, type FormEvent } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import type { Prisma } from "@prisma/client";
import {
  Form,
  redirect,
  useActionData,
  useLoaderData,
  useNavigation,
  useRouteError,
  useSearchParams,
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
  Text,
  TextField,
} from "@shopify/polaris";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { ensureShopAccess } from "../services/billing.server";
import { catalogOptionRows, mappedFacetsForAdmin, normalizeDisplayOrder, parseDisplayTypes, parseMatchModes, parseRangeBounds, parseValueSort, rangeBoundsToForm, type RangeBoundFormMap, type ValueSortMap } from "../services/filters.server";
import {
  parseAppliesToAllProducts,
  parseExcludeCollectionGids,
  parseFacetSettings,
  withFilterTreeMeta,
} from "../utils/facet-settings";
import { getMetafieldMappings, filterConfigPriceFields } from "../services/shop.server";
import { normalizeVariantOptionNames } from "../utils/variants-as-products";
import {
  createFilterTree,
  defaultFilterTreeDisplayOrder,
  deleteFilterTree,
  duplicateFilterTree,
  getFilterTree,
  listFilterTrees,
  updateFilterTree,
} from "../services/filter-trees.server";
import prisma from "../db.server";
import { COLLECTION_PICKER_PAGE_SIZE } from "../utils/collections-picker";
import { listCollectionsForPicker } from "../services/collections-picker.server";
import { useConfirmDelete } from "../components/confirm-delete-modal";
import { useEmbeddedNavigate } from "../hooks/use-embedded-navigate";
import { withEmbeddedParamsFromRequest } from "../utils/admin-path";
import { isMutationBusy } from "../components/admin-loading";
import { CollectionAppliesTo } from "../components/collection-applies-to";
import { FilterOptionsTable } from "../components/filter-options-table";
import {
  applyFacetSettingLabels,
  buildVisibleFilterRows,
  builtinDefForKey,
  isOptionRowKey,
  persistDisplayOrder,
  storedFilterDisplayOrder,
  type BuiltinEnableKey,
} from "../utils/filter-option-rows";

export { FilterEditorSkeleton as HydrateFallback } from "../components/admin-skeletons";

type ConfigState = {
  name: string;
  appliesToSearch: boolean;
  appliesToAllProducts: boolean;
  collectionGids: string[];
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
  enableVariantsAsProducts: boolean;
  variantAsProductOptions: string;
  priceRangeMode: "auto" | "custom";
  customPriceMin: string;
  customPriceMax: string;
  displayOrder: string[];
  displayTypes: Record<string, string>;
  matchModes: Record<string, "or" | "and">;
  valueSort: ValueSortMap;
  rangeBounds: RangeBoundFormMap;
  excludeCollectionGids: string[];
};

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const { shop } = await ensureShopAccess(session.shop);
  const treeId = params.id;
  if (!treeId) {
    throw new Response("Not found", { status: 404 });
  }
  const isNew = treeId === "new";
  const config = isNew ? null : await getFilterTree(shop.id, treeId);
  if (!isNew && !config) {
    throw new Response("Not found", { status: 404 });
  }
  const includeGids = [
    ...(config?.treeCollections.map((row) => row.collectionGid) ?? []),
    ...parseExcludeCollectionGids(
      config && "facetSettings" in config ? config.facetSettings : {},
    ),
  ];
  const [picker, otherTrees, optionProducts, mappedFacets] = await Promise.all([
    listCollectionsForPicker(shop.id, {
      page: 1,
      pageSize: COLLECTION_PICKER_PAGE_SIZE,
      includeGids,
    }),
    listFilterTrees(shop.id),
    prisma.productFacet.findMany({
      where: { shopId: shop.id, status: "ACTIVE" },
      take: 120,
      select: { options: true },
    }),
    getMetafieldMappings(shop.id),
  ]);
  const usedElsewhere: Record<string, boolean> = {};
  let allCollectionsUsedElsewhere = false;
  for (const tree of otherTrees) {
    if (config && tree.id === config.id) continue;
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
  const catalogOptions = catalogOptionRows(
    optionProducts.map((product) => ({
      options: (product.options as Record<string, string[]>) || {},
    })),
  );
  const mappedFacetRows = mappedFacetsForAdmin(mappedFacets);
  const facetSettings = parseFacetSettings(
    config && "facetSettings" in config ? config.facetSettings : {},
  );

  return {
    treeId: config?.id ?? "",
    isNew,
    collections: picker.collections,
    knownCollections: picker.included,
    collectionTotal: picker.total,
    collectionHasNext: picker.hasNext,
    collectionPageSize: picker.pageSize,
    usedElsewhere,
    allCollectionsUsedElsewhere,
    catalogOptions,
    mappedFacets: mappedFacetRows,
    facetSettings,
    config: config
      ? {
          name: config.name,
          appliesToSearch: config.appliesToSearch,
          appliesToAllProducts: parseAppliesToAllProducts(
            config && "facetSettings" in config ? config.facetSettings : {},
          ),
          collectionGids: config.treeCollections.map((row) => row.collectionGid),
          excludeCollectionGids: parseExcludeCollectionGids(
            config && "facetSettings" in config ? config.facetSettings : {},
          ),
          enabled: config.enabled ?? true,
          enablePrice: config?.enablePrice ?? true,
          enableSale: config?.enableSale ?? false,
          enableRating: config?.enableRating ?? false,
          enableLocation: config?.enableLocation ?? false,
          enableAvailability: config?.enableAvailability ?? true,
          enableVendor: config?.enableVendor ?? true,
          enableProductType: config?.enableProductType ?? true,
          enableTags: config?.enableTags ?? true,
          enableOptions: config?.enableOptions ?? true,
          enableVariantsAsProducts: Boolean(
            (config as { enableVariantsAsProducts?: boolean } | null)
              ?.enableVariantsAsProducts,
          ),
          variantAsProductOptions: (
            (config as { variantAsProductOptions?: string[] } | null)
              ?.variantAsProductOptions || []
          ).join(", "),
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
        }
      : {
          name: "",
          appliesToSearch: false,
          appliesToAllProducts: false,
          collectionGids: [] as string[],
          excludeCollectionGids: [] as string[],
          enabled: true,
          enablePrice: true,
          enableSale: true,
          enableRating: false,
          enableLocation: false,
          enableAvailability: true,
          enableVendor: true,
          enableProductType: true,
          enableTags: true,
          enableOptions: true,
          enableVariantsAsProducts: false,
          variantAsProductOptions: "",
          displayOrder: defaultFilterTreeDisplayOrder(),
          displayTypes: parseDisplayTypes({}),
          matchModes: parseMatchModes({}),
          valueSort: parseValueSort({}),
          rangeBounds: rangeBoundsToForm(parseRangeBounds({})),
          ...filterConfigPriceFields(null),
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
  const isNew = treeId === "new";
  const form = await request.formData();
  const intent = String(form.get("intent") || "save");

  if (intent === "duplicate") {
    if (isNew) return { error: "Save this filter first." };
    const copy = await duplicateFilterTree(shop.id, treeId);
    if (!copy) return { error: "Could not duplicate this tree." };
    return redirect(
      withEmbeddedParamsFromRequest(request, `/app/filters/${copy.id}`),
    );
  }
  if (intent === "delete") {
    if (isNew) {
      return redirect(withEmbeddedParamsFromRequest(request, "/app/filters"));
    }
    const result = await deleteFilterTree(shop.id, treeId);
    if ("error" in result) return { error: result.error };
    return redirect(withEmbeddedParamsFromRequest(request, "/app/filters"));
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

  const existing = isNew ? null : await getFilterTree(shop.id, treeId);
  if (!isNew && !existing) {
    return { error: "Filter tree not found." };
  }
  const name = String(form.get("name") || "").trim();
  if (isNew && !name) {
    return { error: "Enter a filter name." };
  }
  const rawFacetSettings =
    existing && "facetSettings" in existing ? existing.facetSettings : {};
  let excludeCollectionGids = parseExcludeCollectionGids(rawFacetSettings);
  const excludeRaw = form.get("excludeCollectionGids");
  if (typeof excludeRaw === "string") {
    try {
      const parsed = JSON.parse(excludeRaw || "[]") as unknown;
      if (Array.isArray(parsed)) {
        excludeCollectionGids = parsed.filter(
          (item): item is string => typeof item === "string" && item.length > 0,
        );
      }
    } catch {
      // keep existing excludes
    }
  }

  const savedName = name || existing?.name || "Untitled tree";
  const persistId = isNew
    ? (
        await createFilterTree(shop.id, {
          name: savedName,
          appliesToSearch: bool("appliesToSearch"),
          collectionGids,
        })
      ).id
    : treeId;

  const mappedKeys = mappedFacetsForAdmin(
    await getMetafieldMappings(shop.id),
  ).map((facet) => facet.key);

  await updateFilterTree(shop.id, persistId, {
    name: savedName,
    appliesToSearch: bool("appliesToSearch"),
    collectionGids,
    facetSettings: withFilterTreeMeta(
      parseFacetSettings(rawFacetSettings),
      {
        excludeCollectionGids,
        appliesToAllProducts: bool("appliesToAllProducts"),
        knownMetafieldKeys: mappedKeys,
      },
      rawFacetSettings,
    ) as Prisma.InputJsonValue,
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
    enableVariantsAsProducts: bool("enableVariantsAsProducts"),
    variantAsProductOptions: normalizeVariantOptionNames(
      String(form.get("variantAsProductOptions") || ""),
    ),
    priceRangeMode,
    customPriceMin: customMin,
    customPriceMax: customMax,
    displayOrder,
    displayTypes,
    matchModes,
    valueSort,
    rangeBounds,
  });

  const url = new URL(request.url);
  if (isNew || url.searchParams.get("new") === "1") {
    return redirect(
      withEmbeddedParamsFromRequest(request, `/app/filters/${persistId}`),
    );
  }
  return { ok: true };
};

export function shouldRevalidate({
  formMethod,
  defaultShouldRevalidate,
}: {
  formMethod?: string;
  defaultShouldRevalidate: boolean;
}) {
  const method = formMethod?.toUpperCase();
  if (!method || method === "GET") return false;
  return defaultShouldRevalidate;
}

export default function FilterTreeEditorPage() {
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const navigate = useEmbeddedNavigate();
  const submit = useSubmit();
  const [searchParams, setSearchParams] = useSearchParams();
  const shopify = useAppBridge();
  const { ask, dialog } = useConfirmDelete();
  const [config, setConfig] = useState<ConfigState>(data.config);
  const [loaderConfig, setLoaderConfig] = useState(data.config);
  if (data.config !== loaderConfig) {
    setLoaderConfig(data.config);
    setConfig(data.config);
  }

  const saving = isMutationBusy(navigation);
  const rows = useMemo(
    () =>
      applyFacetSettingLabels(
        buildVisibleFilterRows(
          config.displayOrder,
          {
            enablePrice: config.enablePrice,
            enableSale: config.enableSale,
            enableRating: config.enableRating,
            enableLocation: config.enableLocation,
            enableAvailability: config.enableAvailability,
            enableVendor: config.enableVendor,
            enableProductType: config.enableProductType,
            enableTags: config.enableTags,
            enableOptions: config.enableOptions,
          },
          data.catalogOptions,
          data.mappedFacets,
        ),
        data.facetSettings,
      ),
    [
      config.displayOrder,
      config.enablePrice,
      config.enableSale,
      config.enableRating,
      config.enableLocation,
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
  const isAddMode = data.isNew || searchParams.get("new") === "1";

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

  const handleRemove = async (key: string) => {
    const ok = await ask({
      title: "Remove this filter option?",
      message: "You can add it again later from this page.",
      confirmLabel: "Remove",
    });
    if (!ok) return;
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
    formData.set("appliesToAllProducts", String(config.appliesToAllProducts));
    formData.set("collectionGids", JSON.stringify(config.collectionGids));
    if (searchParams.get("new") !== "1") {
      formData.set(
        "excludeCollectionGids",
        JSON.stringify(config.excludeCollectionGids),
      );
    }
    formData.set("enabled", String(config.enabled));
    formData.set("enablePrice", String(config.enablePrice));
    formData.set("enableSale", String(rows.some((row) => row.key === "sale")));
    formData.set("enableRating", String(config.enableRating));
    formData.set("enableLocation", String(config.enableLocation));
    formData.set("enableAvailability", String(config.enableAvailability));
    formData.set("enableVendor", String(config.enableVendor));
    formData.set("enableProductType", String(config.enableProductType));
    formData.set("enableTags", String(config.enableTags));
    formData.set("enableOptions", String(config.enableOptions));
    formData.set(
      "enableVariantsAsProducts",
      String(config.enableVariantsAsProducts),
    );
    formData.set("variantAsProductOptions", config.variantAsProductOptions);
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

  const isEditMode = !isAddMode;
  const pageTitle = isAddMode ? "Add filter" : "Edit filter";

  return (
    <Page
      title={pageTitle}
      backAction={{
        content: "Filters",
        onAction: () => navigate("/app/filters"),
      }}
      secondaryActions={
        isEditMode
          ? [
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
                onAction: async () => {
                  const ok = await ask({
                    title: "Delete this filter?",
                    message: "This cannot be undone.",
                    confirmLabel: "Delete",
                  });
                  if (!ok) return;
                  const formData = new FormData();
                  formData.set("intent", "delete");
                  submit(formData, { method: "POST" });
                },
              },
            ]
          : undefined
      }
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
          <BlockStack gap="400">
          <Form id="default-filter-form" method="post" onSubmit={handleSubmit}>
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
                  knownCollections={data.knownCollections}
                  collectionTotal={data.collectionTotal}
                  collectionHasNext={data.collectionHasNext}
                  collectionPageSize={data.collectionPageSize}
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
                  showExclude={!isAddMode}
                  showAllCollectionsChip={!isAddMode}
                  excluded={config.excludeCollectionGids}
                  onExcludedChange={(excludeCollectionGids) =>
                    setConfig((c) => ({ ...c, excludeCollectionGids }))
                  }
                />
              </BlockStack>
            </Card>
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  Variants as separate products
                </Text>
                <Checkbox
                  label="Show variants as separate products"
                  checked={config.enableVariantsAsProducts}
                  disabled={saving}
                  helpText="Each variant becomes its own card on assigned collection pages. A 3-color product shows 3 cards."
                  onChange={(checked) =>
                    setConfig((c) => ({
                      ...c,
                      enableVariantsAsProducts: checked,
                    }))
                  }
                />
                <TextField
                  label="Split by option names"
                  value={config.variantAsProductOptions}
                  autoComplete="off"
                  disabled={saving || !config.enableVariantsAsProducts}
                  placeholder="Color"
                  helpText="Optional. Example: Color shows one card per color. Leave empty to show every variant."
                  onChange={(value) =>
                    setConfig((c) => ({
                      ...c,
                      variantAsProductOptions: value,
                    }))
                  }
                />
              </BlockStack>
            </Card>
          </Form>
          <Card>
            <BlockStack gap="300">
              <InlineStack align="space-between" blockAlign="center">
                <Text as="h2" variant="headingMd">
                  Filter options
                </Text>
                {isEditMode ? (
                  <Button
                    submit={false}
                    disabled={saving}
                    onClick={() =>
                      navigate(`/app/filters/${data.treeId}/options/new`)
                    }
                  >
                    + Add filter option
                  </Button>
                ) : null}
              </InlineStack>
              <FilterOptionsTable
                rows={rows}
                displayTypes={config.displayTypes}
                disabled={saving}
                treeId={data.treeId}
                allowEdit={isEditMode}
                showAddButton={isEditMode}
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
            </BlockStack>
          </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>
      {dialog}
    </Page>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error && "status" in error
        ? `Could not load this filter (${String((error as { status: unknown }).status)})`
        : "Could not load this filter";

  return (
    <Page title="Edit filter">
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
