import { useMemo, useState, type FormEvent } from "react";
import { Form, useNavigate, useNavigation, useSubmit } from "react-router";
import {
  BlockStack,
  Card,
  Checkbox,
  ChoiceList,
  FormLayout,
  InlineGrid,
  Layout,
  Page,
  Select,
  Text,
  TextField,
} from "@shopify/polaris";
import { isMutationBusy } from "./admin-loading";
import type { FilterOptionEditorData } from "../filter-option-editor.server";
import { FACET_DISPLAY_TYPE_LABELS, type FacetDisplayType } from "../filters";
import type { FacetValueMode } from "../facet-settings";

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

  const [key, setKey] = useState(data.optionKey);
  const [label, setLabel] = useState(data.label);
  const [displayType, setDisplayType] = useState(data.displayType);
  const [valueMode, setValueMode] = useState<FacetValueMode>(data.valueMode);
  const [prefix, setPrefix] = useState(data.prefix);
  const [removePrefix, setRemovePrefix] = useState(data.removePrefix);
  const [selectedValues, setSelectedValues] = useState<string[]>(
    data.selectedValues,
  );

  const sourceOptions = data.sources.length
    ? data.sources.map((source) => ({
        value: source.value,
        label: source.label,
      }))
    : [{ value: "", label: "No sources left to add" }];

  const selectedSource =
    data.sources.find((source) => source.value === key) || data.sources[0];
  const showValues = Boolean(key) && (selectedSource?.showValues ?? data.showValues);
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

  const handleSourceChange = (next: string) => {
    setKey(next);
    const source = data.sources.find((item) => item.value === next);
    if (source) {
      setLabel(source.defaultLabel);
      setDisplayType(source.displayType);
    }
    setSelectedValues([]);
    setValueMode("all");
    setPrefix("");
    setRemovePrefix(false);
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
    submit(formData, { method: "POST" });
  };

  const handleDelete = () => {
    const formData = new FormData();
    formData.set("intent", "delete");
    formData.set("key", key);
    submit(formData, { method: "POST" });
  };

  return (
    <Page
      title={isEdit ? label || data.label || "Edit filter option" : "Add filter option"}
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
          <Card>
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
                    helpText="Shopper-facing name in the filter sidebar."
                    value={label}
                    onChange={setLabel}
                    autoComplete="off"
                    disabled={saving}
                  />
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
                </FormLayout>
                {showValues ? (
                  <BlockStack gap="300">
                    <ChoiceList
                      title="Values"
                      choices={[
                        {
                          label: "All values",
                          value: "all",
                          helpText: "Show every catalog value for this source.",
                        },
                        {
                          label: "Manual selection",
                          value: "manual",
                          helpText: "Pick which values appear on the storefront.",
                        },
                        {
                          label: "By value prefix",
                          value: "prefix",
                          helpText:
                            "Only values that start with a prefix, e.g. Color_.",
                        },
                      ]}
                      selected={[valueMode]}
                      disabled={saving}
                      onChange={(selected) =>
                        setValueMode((selected[0] as FacetValueMode) || "all")
                      }
                    />
                    {valueMode === "manual" ? (
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
                    {valueMode === "prefix" ? (
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
                ) : (
                  <Text as="p" tone="subdued">
                    This source does not use a value list. Shoppers see the
                    control for this option (slider, availability, collection,
                    and similar) without picking individual values here.
                  </Text>
                )}
              </BlockStack>
            </Form>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
