import { useMemo, useState, type FormEvent } from "react";
import { Form, useNavigate, useNavigation, useSubmit } from "react-router";
import {
  BlockStack,
  Box,
  Button,
  Card,
  Checkbox,
  ChoiceList,
  FormLayout,
  InlineGrid,
  InlineStack,
  Layout,
  Page,
  Select,
  Text,
  TextField,
} from "@shopify/polaris";
import { isMutationBusy } from "./admin-loading";
import type { FilterOptionEditorData } from "../filter-option-editor.server";
import {
  FACET_DISPLAY_TYPE_LABELS,
  type FacetDisplayType,
  type FacetMatchMode,
} from "../filters";
import {
  defaultUrlHandle,
  type FacetShowMoreMode,
  type FacetTextTransform,
  type FacetValueMode,
  type FacetValueSortMode,
} from "../facet-settings";

const FALLBACK_SHOP_DOMAIN = "findly-test-store.myshopify.com";

export function FilterOptionEditorPage({
  data,
  error,
}: {
  data: FilterOptionEditorData;
  error?: string;
}) {
  const navigate = useNavigate();
  const navigation = useNavigation();
  const submit = useSubmit();
  const saving = isMutationBusy(navigation);
  const isEdit = data.mode === "edit";
  const backUrl = `/app/filters/${data.treeId}`;
  const shopDomain = data.shopDomain || FALLBACK_SHOP_DOMAIN;

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

  const catalogValues = selectedSource?.catalogValues || data.catalogValues;
  const valueList = useMemo(() => {
    const seen = new Set(catalogValues);
    const extras = selectedValues.filter((value) => !seen.has(value));
    return extras.length ? [...catalogValues, ...extras] : catalogValues;
  }, [catalogValues, selectedValues]);

  const selectedSet = useMemo(() => new Set(selectedValues), [selectedValues]);
  const mid = Math.ceil(valueList.length / 2);
  const left = valueList.slice(0, mid);
  const right = valueList.slice(mid);

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
    setValueSortMode("az");
    setCollapseByDefault(true);
    setEnableValueSearch(false);
    setShowMore("scrollbar");
    setTextTransform("capitalize");
    setAutoRemovePrefixes("");
    setTooltip("");
    setMatchMode("or");
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

  const handleDelete = () => {
    const formData = new FormData();
    formData.set("intent", "delete");
    formData.set("key", key);
    submit(formData, { method: "POST" });
  };

  const previewValues = (catalogValues.length
    ? catalogValues
    : ["Blue", "Red"]
  ).slice(0, 4);
  const previewLabel = (label || "Collection").toUpperCase();
  const previewValueStyle: { textTransform: "none" | "capitalize" | "uppercase" | "lowercase" } =
    textTransform === "none" ||
    textTransform === "capitalize" ||
    textTransform === "uppercase" ||
    textTransform === "lowercase"
      ? { textTransform }
      : { textTransform: "none" };

  return (
    <Page
      title={isEdit ? "Edit filter option" : "Add filter option"}
      backAction={{
        content: "Filter",
        url: backUrl,
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
                    <Checkbox
                      label="Build a collection tree with multi-level sub-collections"
                      checked={collectionTree}
                      disabled={saving}
                      onChange={setCollectionTree}
                    />
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
                      valueList.length === 0 ? (
                        <Text as="p" tone="subdued">
                          No catalog values yet. Sync products, then select
                          values here.
                        </Text>
                      ) : (
                        <InlineGrid columns={{ xs: 1, md: 2 }} gap="200">
                          <BlockStack gap="200">
                            {left.map((value) => (
                              <Checkbox
                                key={value}
                                label={value}
                                checked={selectedSet.has(value)}
                                disabled={saving}
                                onChange={(checked) =>
                                  toggleValue(value, checked)
                                }
                              />
                            ))}
                          </BlockStack>
                          <BlockStack gap="200">
                            {right.map((value) => (
                              <Checkbox
                                key={value}
                                label={value}
                                checked={selectedSet.has(value)}
                                disabled={saving}
                                onChange={(checked) =>
                                  toggleValue(value, checked)
                                }
                              />
                            ))}
                          </BlockStack>
                        </InlineGrid>
                      )
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
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                Preview
              </Text>
              <div className="findly-option-preview">
                <div className="findly-option-preview__header">
                  <span className="findly-option-preview__caret" aria-hidden />
                  <span className="findly-option-preview__title">
                    {previewLabel}
                  </span>
                </div>
                {!collapseByDefault ? (
                  <div className="findly-option-preview__values">
                    {previewValues.map((value) => (
                      <label
                        key={value}
                        className="findly-option-preview__value"
                      >
                        <input type="checkbox" readOnly tabIndex={-1} />
                        <span style={previewValueStyle}>{value}</span>
                      </label>
                    ))}
                  </div>
                ) : null}
              </div>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
