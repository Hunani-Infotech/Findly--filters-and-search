import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  Form,
  useFetcher,
  useNavigate,
  useNavigation,
  useSearchParams,
  useSubmit,
} from "react-router";
import {
  BlockStack,
  Box,
  Button,
  Card,
  Checkbox,
  ChoiceList,
  FormLayout,
  InlineStack,
  Layout,
  Page,
  Select,
  Text,
  TextField,
} from "@shopify/polaris";
import { withEmbeddedParams } from "../utils/admin-path";
import { hexFromColorName } from "../utils/color-autofill";
import { CatalogValuePicker } from "./catalog-value-picker";
import { useConfirmDelete } from "./confirm-delete-modal";
import { isMutationBusy } from "./admin-loading";
import type {
  FilterOptionCatalogPage,
  FilterOptionEditorData,
} from "../services/filter-option-editor.server";
import {
  FACET_DISPLAY_TYPE_LABELS,
  type FacetDisplayType,
  type FacetMatchMode,
} from "../utils/filters";
import {
  defaultUrlHandle,
  type FacetShowMoreMode,
  type FacetTextTransform,
  type FacetValueMode,
  type FacetValueSortMode,
} from "../utils/facet-settings";

const FALLBACK_SHOP_DOMAIN = "findly-test-store.myshopify.com";

type PickerResponse =
  | ({ all: false; requestId: string } & FilterOptionCatalogPage)
  | {
      all: true;
      requestId: string;
      sourceKey: string;
      query: string;
      values: string[];
      total: number;
    };

function catalogPickerPath(
  searchParams: URLSearchParams,
  input: { source: string; page?: number; q?: string; all?: boolean; r?: string },
) {
  const next = new URLSearchParams();
  if (input.source) next.set("source", input.source);
  if (input.q) next.set("q", input.q);
  if (input.r) next.set("r", input.r);
  if (input.all) next.set("all", "1");
  else if (input.page && input.page > 0) next.set("page", String(input.page));
  return withEmbeddedParams(`/app/filters/picker?${next.toString()}`, searchParams);
}

export function FilterOptionEditorPage({
  data,
  error,
}: {
  data: FilterOptionEditorData;
  error?: string;
}) {
  const navigate = useNavigate();
  const navigation = useNavigation();
  const [searchParams] = useSearchParams();
  const submit = useSubmit();
  const pageFetcher = useFetcher<PickerResponse>();
  const allFetcher = useFetcher<PickerResponse>();
  const { ask, dialog } = useConfirmDelete();
  const saving = isMutationBusy(navigation);
  const isEdit = data.mode === "edit";
  const backUrl = withEmbeddedParams(
    `/app/filters/${data.treeId}`,
    searchParams,
  );
  const shopDomain = data.shopDomain || FALLBACK_SHOP_DOMAIN;
  const lastAllKey = useRef<string | null>(null);
  const pageRequestId = useRef(0);

  const [key, setKey] = useState(data.optionKey);
  const [label, setLabel] = useState(data.label);
  const [displayType, setDisplayType] = useState(data.displayType);
  const [valueMode, setValueMode] = useState<FacetValueMode>(data.valueMode);
  const [prefix, setPrefix] = useState(data.prefix);
  const [removePrefix, setRemovePrefix] = useState(data.removePrefix);
  const [selectedValues, setSelectedValues] = useState<string[]>(
    data.selectedValues,
  );
  const [urlHandle, setUrlHandle] = useState(data.urlHandle);
  const [handleTouched, setHandleTouched] = useState(data.mode === "edit");
  const [showHandleField, setShowHandleField] = useState(false);
  const [collectionTree, setCollectionTree] = useState(data.collectionTree);
  const [collectionParents, setCollectionParents] = useState<Record<string, string>>(
    data.collectionParents || {},
  );
  const [valueSortMode, setValueSortMode] = useState<FacetValueSortMode>(
    data.valueSortMode,
  );
  const [collapseByDefault, setCollapseByDefault] = useState(
    data.collapseByDefault,
  );
  const [enableValueSearch, setEnableValueSearch] = useState(
    data.enableValueSearch,
  );
  const [showMore, setShowMore] = useState<FacetShowMoreMode>(data.showMore);
  const [textTransform, setTextTransform] = useState<FacetTextTransform>(
    data.textTransform,
  );
  const [autoRemovePrefixes, setAutoRemovePrefixes] = useState(
    data.autoRemovePrefixes,
  );
  const [tooltip, setTooltip] = useState(data.tooltip);
  const [matchMode, setMatchMode] = useState<FacetMatchMode>(data.matchMode);
  const [catalogQuery, setCatalogQuery] = useState(data.catalog.query);
  const [catalogPage, setCatalogPage] = useState(data.catalog);

  useEffect(() => {
    const next = pageFetcher.data;
    if (!next || next.all !== false) return;
    if (next.requestId !== String(pageRequestId.current)) return;
    setCatalogPage(next);
  }, [pageFetcher.data]);

  useEffect(() => {
    const next = allFetcher.data;
    if (!next || next.all !== true) return;
    const stamp = `${next.sourceKey}|${next.query}|${next.total}`;
    if (lastAllKey.current === stamp) return;
    lastAllKey.current = stamp;
    setSelectedValues((prev) => [...new Set([...prev, ...next.values])]);
  }, [allFetcher.data]);

  const loadCatalogPage = (next: { source: string; page?: number; q?: string }) => {
    pageRequestId.current += 1;
    pageFetcher.load(
      catalogPickerPath(searchParams, {
        source: next.source,
        page: next.page ?? 0,
        q: next.q ?? "",
        r: String(pageRequestId.current),
      }),
    );
  };

  const sourceOptions = data.sources.length
    ? data.sources.map((source) => ({
        value: source.value,
        label: source.label,
      }))
    : [{ value: "", label: "No sources left to add" }];

  const selectedSource =
    data.sources.find((source) => source.value === key) || data.sources[0];
  const showValues = Boolean(key) && (selectedSource?.showValues ?? data.showValues);
  const isCollection = key === "collection";
  const persistValueControls = showValues || isCollection;
  const typeChoices =
    selectedSource?.displayTypeChoices || data.displayTypeChoices;
  const typeOptions = typeChoices.map((choice) => ({
    value: choice.value,
    label: FACET_DISPLAY_TYPE_LABELS[choice.value] || choice.label,
  }));

  const catalogValues = catalogPage.values;
  const catalogValueLabels = catalogPage.labels;
  const collectionTreeValues = catalogPage.collectionTreeItems.map(
    (item) => item.value,
  );
  const collectionTreeLabels = Object.fromEntries(
    catalogPage.collectionTreeItems.map((item) => [item.value, item.label]),
  );

  const resolvedHandle =
    urlHandle || defaultUrlHandle(label, key) || key || "collection";
  const exampleValue = catalogValues[0] || "Blue";
  const exampleUrl = `https://${shopDomain}?${resolvedHandle}=${encodeURIComponent(exampleValue)}`;

  const handleLabelChange = (next: string) => {
    setLabel(next);
    if (!handleTouched) setUrlHandle(defaultUrlHandle(next, key));
  };

  const handleSourceChange = (next: string) => {
    setKey(next);
    const source = data.sources.find((item) => item.value === next);
    const nextLabel = source?.defaultLabel || "";
    if (source) {
      setLabel(nextLabel);
      setDisplayType(source.displayType);
    }
    setSelectedValues([]);
    setValueMode("all");
    setPrefix("");
    setRemovePrefix(false);
    setHandleTouched(false);
    setUrlHandle(defaultUrlHandle(nextLabel, next));
    setCollectionTree(false);
    setCollectionParents({});
    setValueSortMode("az");
    setCollapseByDefault(true);
    setEnableValueSearch(false);
    setShowMore("scrollbar");
    setTextTransform("capitalize");
    setAutoRemovePrefixes("");
    setTooltip("");
    setMatchMode("or");
    setCatalogQuery("");
    setCatalogPage({
      sourceKey: next,
      values: [],
      labels: {},
      total: 0,
      page: 0,
      pageCount: 1,
      showingFrom: 0,
      showingTo: 0,
      query: "",
      collectionTreeItems: [],
    });
    loadCatalogPage({ source: next, page: 0, q: "" });
  };

  const toggleValue = (value: string, checked: boolean) => {
    setSelectedValues((prev) => {
      if (checked) return prev.includes(value) ? prev : [...prev, value];
      return prev.filter((item) => item !== value);
    });
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData();
    formData.set("intent", "save");
    formData.set("key", key);
    formData.set("label", label);
    formData.set("displayType", displayType);
    formData.set("valueMode", valueMode);
    formData.set("prefix", prefix);
    formData.set("removePrefix", String(removePrefix));
    formData.set("selectedValues", JSON.stringify(selectedValues));
    formData.set("urlHandle", resolvedHandle);
    formData.set("collectionTree", String(collectionTree));
    formData.set("collectionParents", JSON.stringify(collectionParents));
    formData.set("valueSortMode", valueSortMode);
    formData.set("collapseByDefault", String(collapseByDefault));
    formData.set("enableValueSearch", String(enableValueSearch));
    formData.set("showMore", showMore);
    formData.set("textTransform", textTransform);
    formData.set("autoRemovePrefixes", autoRemovePrefixes);
    formData.set("tooltip", tooltip);
    formData.set("matchMode", matchMode);
    submit(formData, { method: "POST" });
  };

  const handleDelete = async () => {
    const ok = await ask({
      title: "Delete this filter option?",
      message: "This cannot be undone.",
      confirmLabel: "Delete",
    });
    if (!ok) return;
    const formData = new FormData();
    formData.set("intent", "delete");
    formData.set("key", key);
    submit(formData, { method: "POST" });
  };

  const previewItems = buildPreviewItems({
    sourceKey: key,
    catalogValues,
    labels: { ...collectionTreeLabels, ...catalogValueLabels },
    treeItems: catalogPage.collectionTreeItems,
    selectedValues,
    valueMode,
    prefix,
    valueSortMode,
  }).map((item) => ({
    ...item,
    label: applyPreviewLabel(item.label, {
      valueMode,
      prefix,
      removePrefix,
      autoRemovePrefixes,
    }),
  }));

  return (
    <div className="findly-option-editor-page">
    <Page
      fullWidth
      title={isEdit ? "Edit filter option" : "Add filter option"}
      backAction={{
        content: "Filter",
        onAction: () => navigate(backUrl),
      }}
      secondaryActions={
        isEdit
          ? [
              {
                content: "Delete",
                destructive: true,
                disabled: saving,
                onAction: handleDelete,
              },
            ]
          : undefined
      }
      primaryAction={{
        content: saving ? "Saving…" : "Save",
        loading: saving,
        disabled: saving || !key,
        onAction: () => {
          const form = document.getElementById(
            "filter-option-form",
          ) as HTMLFormElement | null;
          form?.requestSubmit();
        },
      }}
    >
      <Layout>
        <Layout.Section>
          <Form id="filter-option-form" method="post" onSubmit={handleSubmit}>
            <BlockStack gap="400">
              {error ? (
                <Text as="p" tone="critical">
                  {error}
                </Text>
              ) : null}
              {!isEdit && data.sources.length === 0 ? (
                <Text as="p" tone="subdued">
                  Every available source is already on this filter. Go back
                  and edit an existing option, or map a new metafield.
                </Text>
              ) : null}
              <Card>
                <BlockStack gap="400">
                  <FormLayout>
                    <Select
                      label="Source"
                      options={sourceOptions}
                      value={key}
                      disabled={saving || data.sourceDisabled || !data.sources.length}
                      onChange={handleSourceChange}
                    />
                    <TextField
                      label="Label"
                      value={label}
                      onChange={handleLabelChange}
                      autoComplete="off"
                      disabled={saving}
                    />
                  </FormLayout>
                  <BlockStack gap="100">
                    <Text as="p" tone="subdued" variant="bodySm">
                      Example: {exampleUrl}
                    </Text>
                    <Box>
                      <Button
                        variant="plain"
                        disabled={saving}
                        onClick={() => setShowHandleField((open) => !open)}
                      >
                        Edit URL handle.
                      </Button>
                    </Box>
                    {showHandleField ? (
                      <TextField
                        label="URL handle"
                        labelHidden
                        value={urlHandle}
                        onChange={(next) => {
                          setHandleTouched(true);
                          setUrlHandle(next);
                        }}
                        autoComplete="off"
                        disabled={saving}
                      />
                    ) : null}
                  </BlockStack>
                  <Select
                    label="Display type"
                    options={
                      typeOptions.length
                        ? typeOptions
                        : [{ label: "Checkbox", value: "checkbox" }]
                    }
                    value={displayType}
                    disabled={saving || typeOptions.length <= 1}
                    onChange={(next) =>
                      setDisplayType(next as FacetDisplayType)
                    }
                  />
                  {isCollection ? (
                    <BlockStack gap="200">
                      <Checkbox
                        label="Build a collection tree with multi-level sub-collections"
                        checked={collectionTree}
                        disabled={saving}
                        onChange={setCollectionTree}
                      />
                      {collectionTree ? (
                        <CollectionTreeEditor
                          values={collectionTreeValues}
                          labels={collectionTreeLabels}
                          parents={collectionParents}
                          disabled={saving}
                          onChange={setCollectionParents}
                        />
                      ) : null}
                    </BlockStack>
                  ) : null}
                </BlockStack>
              </Card>
              {persistValueControls ? (
                <Card>
                  <BlockStack gap="400">
                    <InlineStack gap="400" wrap>
                      <Box minWidth="220px">
                        <Select
                          label="Type"
                          labelHidden
                          options={[
                            { label: "Type: Use all values", value: "all" },
                            {
                              label: "Type: Manual selection",
                              value: "manual",
                            },
                            {
                              label: "Type: By value prefix",
                              value: "prefix",
                            },
                          ]}
                          value={valueMode}
                          disabled={saving}
                          onChange={(next) =>
                            setValueMode((next as FacetValueMode) || "all")
                          }
                        />
                      </Box>
                      <Box minWidth="220px">
                        <Select
                          label="Sort"
                          labelHidden
                          options={[
                            { label: "Sort: A-Z", value: "az" },
                            { label: "Sort: Z-A", value: "za" },
                            { label: "Sort: Product count", value: "count" },
                            { label: "Sort: Manual", value: "manual" },
                          ]}
                          value={valueSortMode}
                          disabled={saving}
                          onChange={(next) =>
                            setValueSortMode(
                              (next as FacetValueSortMode) || "az",
                            )
                          }
                        />
                      </Box>
                    </InlineStack>
                    {showValues && valueMode === "manual" ? (
                      <CatalogValuePicker
                        key={key}
                        values={catalogValues}
                        selected={selectedValues}
                        labels={catalogValueLabels}
                        disabled={saving}
                        onToggle={toggleValue}
                        query={catalogQuery}
                        onQueryChange={(next) => {
                          setCatalogQuery(next);
                          loadCatalogPage({ source: key, page: 0, q: next });
                        }}
                        page={catalogPage.page}
                        pageCount={catalogPage.pageCount}
                        total={catalogPage.total}
                        showingFrom={catalogPage.showingFrom}
                        showingTo={catalogPage.showingTo}
                        onPageChange={(nextPage) => {
                          loadCatalogPage({
                            source: key,
                            page: nextPage,
                            q: catalogQuery,
                          });
                        }}
                        onSelectAll={() => {
                          allFetcher.load(
                            catalogPickerPath(searchParams, {
                              source: key,
                              q: catalogQuery,
                              all: true,
                            }),
                          );
                        }}
                        selectAllLoading={allFetcher.state !== "idle"}
                      />
                    ) : null}
                    {showValues && valueMode === "prefix" ? (
                      <BlockStack gap="200">
                        <TextField
                          label="Value prefix"
                          helpText="Example: Color_ keeps Color_Red and hides Size_M."
                          value={prefix}
                          onChange={setPrefix}
                          autoComplete="off"
                          disabled={saving}
                        />
                        <Checkbox
                          label="Remove prefix"
                          helpText="Shoppers see Red instead of Color_Red."
                          checked={removePrefix}
                          disabled={saving}
                          onChange={setRemovePrefix}
                        />
                      </BlockStack>
                    ) : null}
                  </BlockStack>
                </Card>
              ) : (
                <Card>
                  <Text as="p" tone="subdued">
                    This source does not use a value list. Shoppers see the
                    control for this option (slider, availability, collection,
                    and similar) without picking individual values here.
                  </Text>
                </Card>
              )}
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">
                    Display options
                  </Text>
                  <Checkbox
                    label="Collapse filter by default"
                    checked={collapseByDefault}
                    disabled={saving}
                    onChange={setCollapseByDefault}
                  />
                  <Checkbox
                    label="Enable search within values"
                    checked={enableValueSearch}
                    disabled={saving}
                    onChange={setEnableValueSearch}
                  />
                  <ChoiceList
                    title="Show more options"
                    choices={[
                      { label: "Scrollbar", value: "scrollbar" },
                      { label: "Show more button", value: "button" },
                      { label: "Show all values", value: "all" },
                    ]}
                    selected={[showMore]}
                    disabled={saving}
                    onChange={(selected) =>
                      setShowMore((selected[0] as FacetShowMoreMode) || "scrollbar")
                    }
                  />
                </BlockStack>
              </Card>
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">
                    Advanced settings
                  </Text>
                  <ChoiceList
                    title="Logic"
                    choices={[
                      {
                        label: "OR condition",
                        value: "or",
                        helpText:
                          "Displays products that match any of the selected values",
                      },
                      {
                        label: "AND condition",
                        value: "and",
                        helpText:
                          "Only the products that have all selected values matched",
                      },
                    ]}
                    selected={[matchMode]}
                    disabled={saving}
                    onChange={(selected) =>
                      setMatchMode((selected[0] as FacetMatchMode) || "or")
                    }
                  />
                  <ChoiceList
                    title="Option value text transform"
                    choices={[
                      { label: "Use global setting", value: "global" },
                      { label: "None", value: "none" },
                      { label: "Capitalize", value: "capitalize" },
                      { label: "Uppercase", value: "uppercase" },
                      { label: "Lowercase", value: "lowercase" },
                    ]}
                    selected={[textTransform]}
                    disabled={saving}
                    onChange={(selected) =>
                      setTextTransform(
                        (selected[0] as FacetTextTransform) || "capitalize",
                      )
                    }
                  />
                  <TextField
                    label="Automatically remove value prefixes"
                    placeholder="e.g. Color_, Material_"
                    value={autoRemovePrefixes}
                    onChange={setAutoRemovePrefixes}
                    autoComplete="off"
                    disabled={saving}
                  />
                  <TextField
                    label="Tooltip content"
                    value={tooltip}
                    onChange={(next) => setTooltip(next.slice(0, 150))}
                    multiline={3}
                    maxLength={150}
                    showCharacterCount
                    autoComplete="off"
                    disabled={saving}
                    helpText={`${tooltip.length}/150`}
                  />
                </BlockStack>
              </Card>
            </BlockStack>
          </Form>
        </Layout.Section>
        <Layout.Section variant="oneThird">
          <div className="findly-option-preview-wrap">
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  Preview
                </Text>
                <FilterOptionPreview
                  label={label || "Collection"}
                  displayType={displayType}
                  items={previewItems}
                  parents={collectionParents}
                  collectionTree={collectionTree && isCollection}
                  enableValueSearch={enableValueSearch}
                  showMore={showMore}
                  textTransform={textTransform}
                  tooltip={tooltip}
                />
              </BlockStack>
            </Card>
          </div>
        </Layout.Section>
      </Layout>
      {dialog}
    </Page>
    </div>
  );
}

type PreviewItem = { value: string; label: string };

function fallbackPreviewLabels(sourceKey: string): string[] {
  if (sourceKey === "collection") return ["Home", "Summer", "Sale", "New arrivals"];
  if (sourceKey === "availability") return ["In stock", "Out of stock"];
  if (sourceKey === "vendor") return ["Cotton", "Linen", "Wool"];
  if (sourceKey === "productType") return ["Shirts", "Pants", "Hats"];
  if (sourceKey === "tag" || sourceKey === "tags") return ["New", "Sale", "Organic"];
  return ["Blue", "Red", "Green", "Black"];
}

function applyPreviewLabel(
  label: string,
  input: {
    valueMode: FacetValueMode;
    prefix: string;
    removePrefix: boolean;
    autoRemovePrefixes: string;
  },
) {
  let text = label;
  if (
    input.valueMode === "prefix" &&
    input.removePrefix &&
    input.prefix &&
    text.startsWith(input.prefix)
  ) {
    text = text.slice(input.prefix.length);
  }
  const prefixes = input.autoRemovePrefixes
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
  for (const prefix of prefixes) {
    if (text.startsWith(prefix)) {
      text = text.slice(prefix.length);
      break;
    }
  }
  return text || label;
}

function buildPreviewItems(input: {
  sourceKey: string;
  catalogValues: string[];
  labels: Record<string, string>;
  treeItems: Array<{ value: string; label: string }>;
  selectedValues: string[];
  valueMode: FacetValueMode;
  prefix: string;
  valueSortMode: FacetValueSortMode;
}): PreviewItem[] {
  const labeled = (values: string[]) =>
    values
      .map((value) => ({
        value,
        label: input.labels[value] || value,
      }))
      .filter((item) => !item.label.startsWith("gid://"));
  let items: PreviewItem[] = [];
  if (input.valueMode === "manual" && input.selectedValues.length) {
    items = labeled(input.selectedValues);
  } else if (input.valueMode === "prefix" && input.prefix) {
    const filtered = input.catalogValues.filter((value) => {
      const label = input.labels[value] || value;
      return label.startsWith(input.prefix) || value.startsWith(input.prefix);
    });
    items = labeled(filtered.length ? filtered : input.catalogValues);
  } else if (input.sourceKey === "collection" && input.treeItems.length) {
    items = input.treeItems.map((item) => ({
      value: item.value,
      label: item.label,
    }));
  } else if (input.catalogValues.length) {
    items = labeled(input.catalogValues);
  }
  if (!items.length) {
    items = fallbackPreviewLabels(input.sourceKey).map((label) => ({
      value: label,
      label,
    }));
  }
  if (input.valueSortMode === "za") {
    return [...items].sort((a, b) => b.label.localeCompare(a.label));
  }
  if (input.valueSortMode === "az") {
    return [...items].sort((a, b) => a.label.localeCompare(b.label));
  }
  return items;
}

function previewSwatchColor(value: string) {
  return hexFromColorName(value) || `hsl(${Math.abs(hashHue(value)) % 360}, 58%, 52%)`;
}

function hashHue(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = value.charCodeAt(i) + ((hash << 5) - hash);
  }
  return hash;
}

function previewDepth(value: string, parents: Record<string, string>, values: string[]) {
  let depth = 0;
  let current = parents[value];
  const seen = new Set<string>();
  while (current && !seen.has(current) && values.includes(current)) {
    seen.add(current);
    depth += 1;
    current = parents[current];
  }
  return depth;
}

function FilterOptionPreview({
  label,
  displayType,
  items,
  parents,
  collectionTree,
  enableValueSearch,
  showMore,
  textTransform,
  tooltip,
}: {
  label: string;
  displayType: FacetDisplayType;
  items: PreviewItem[];
  parents: Record<string, string>;
  collectionTree: boolean;
  enableValueSearch: boolean;
  showMore: FacetShowMoreMode;
  textTransform: FacetTextTransform;
  tooltip: string;
}) {
  const [open, setOpen] = useState(true);

  const isSlider = displayType === "slider";
  const valueIds = items.map((item) => item.value);
  const transformStyle: { textTransform: "none" | "capitalize" | "uppercase" | "lowercase" } =
    textTransform === "none" ||
    textTransform === "capitalize" ||
    textTransform === "uppercase" ||
    textTransform === "lowercase"
      ? { textTransform }
      : { textTransform: "none" };
  const valuesClass = [
    "findly-option-preview__values",
    displayType === "swatch" || displayType === "swatch-text"
      ? "findly-option-preview__values--swatches"
      : "",
    displayType === "box" ? "findly-option-preview__values--boxes" : "",
    displayType === "collection" ? "findly-option-preview__values--links" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const renderValue = (item: PreviewItem) => {
    const depth = collectionTree ? previewDepth(item.value, parents, valueIds) : 0;
    const text = (
      <span className="findly-option-preview__text" style={transformStyle}>
        {item.label}
      </span>
    );
    if (displayType === "collection") {
      return (
        <span
          key={item.value}
          className="findly-option-preview__link"
          style={{ paddingLeft: `${depth * 14}px` }}
        >
          {text}
        </span>
      );
    }
    if (displayType === "swatch") {
      return (
        <span
          key={item.value}
          className="findly-option-preview__swatch"
          title={item.label}
          style={{ background: previewSwatchColor(item.label) }}
        />
      );
    }
    if (displayType === "swatch-text") {
      return (
        <span key={item.value} className="findly-option-preview__swatch-text">
          <span
            className="findly-option-preview__swatch findly-option-preview__swatch--inline"
            style={{ background: previewSwatchColor(item.label) }}
          />
          {text}
        </span>
      );
    }
    if (displayType === "box") {
      return (
        <span key={item.value} className="findly-option-preview__box">
          {text}
        </span>
      );
    }
    if (displayType === "list") {
      return (
        <span
          key={item.value}
          className="findly-option-preview__value findly-option-preview__value--list"
          style={{ paddingLeft: `${depth * 14}px` }}
        >
          {text}
        </span>
      );
    }
    return (
      <label
        key={item.value}
        className="findly-option-preview__value"
        style={{ paddingLeft: `${depth * 14}px` }}
      >
        <input
          type={displayType === "radio" ? "radio" : "checkbox"}
          readOnly
          tabIndex={-1}
          name="findly-option-preview"
        />
        {text}
      </label>
    );
  };

  return (
    <div className="findly-option-preview">
      <button
        type="button"
        className="findly-option-preview__header"
        aria-expanded={open}
        onClick={() => setOpen((next) => !next)}
      >
        <span
          className={
            open
              ? "findly-option-preview__caret"
              : "findly-option-preview__caret findly-option-preview__caret--collapsed"
          }
          aria-hidden
        />
        <span className="findly-option-preview__title">{label}</span>
        {tooltip.trim() ? (
          <span className="findly-option-preview__tip" title={tooltip.trim()}>
            ?
          </span>
        ) : null}
      </button>
      {open ? (
        <div className="findly-option-preview__body">
          {enableValueSearch && !isSlider ? (
            <div className="findly-option-preview__search">Search values</div>
          ) : null}
          {isSlider ? (
            <div className="findly-option-preview__slider" aria-hidden>
              <div className="findly-option-preview__slider-track">
                <div className="findly-option-preview__slider-fill" />
                <span className="findly-option-preview__slider-thumb findly-option-preview__slider-thumb--min" />
                <span className="findly-option-preview__slider-thumb findly-option-preview__slider-thumb--max" />
              </div>
              <div className="findly-option-preview__slider-inputs">
                <span>20</span>
                <span>180</span>
              </div>
            </div>
          ) : displayType === "dropdown" ? (
            <div className="findly-option-preview__dropdown">
              {items[0]?.label || "Any"}
            </div>
          ) : (
            <div className={valuesClass}>{items.map(renderValue)}</div>
          )}
          {!isSlider && displayType !== "dropdown" && showMore === "button" ? (
            <span className="findly-option-preview__more">Show more</span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function CollectionTreeEditor({
  values,
  labels,
  parents,
  disabled,
  onChange,
}: {
  values: string[];
  labels: Record<string, string>;
  parents: Record<string, string>;
  disabled: boolean;
  onChange: (next: Record<string, string>) => void;
}) {
  const depthOf = (value: string) => {
    let depth = 0;
    let current = parents[value];
    const seen = new Set<string>();
    while (current && !seen.has(current) && values.includes(current)) {
      seen.add(current);
      depth += 1;
      current = parents[current];
    }
    return depth;
  };

  const indent = (value: string) => {
    const index = values.indexOf(value);
    if (index <= 0) return;
    const previous = values[index - 1];
    if (!previous || previous === value) return;
    onChange({ ...parents, [value]: previous });
  };

  const outdent = (value: string) => {
    const parent = parents[value];
    if (!parent) return;
    const next = { ...parents };
    const grand = next[parent];
    if (grand) next[value] = grand;
    else delete next[value];
    onChange(next);
  };

  return (
    <BlockStack gap="200">
      <Text as="p" tone="subdued" variant="bodySm">
        Indent a collection under the row above to nest it as a sub-collection.
      </Text>
      {values.slice(0, 80).map((value) => (
        <InlineStack key={value} gap="200" blockAlign="center" wrap={false}>
          <div style={{ width: `${Math.min(depthOf(value), 6) * 16}px` }} />
          <Button size="slim" disabled={disabled} onClick={() => outdent(value)}>
            Outdent
          </Button>
          <Button size="slim" disabled={disabled} onClick={() => indent(value)}>
            Indent
          </Button>
          <Text as="span" variant="bodySm">
            {labels[value] || value}
          </Text>
        </InlineStack>
      ))}
    </BlockStack>
  );
}
