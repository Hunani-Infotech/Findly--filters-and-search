import { useMemo, useState, type FormEvent } from "react";
import { Form, useNavigation, useSubmit } from "react-router";
import { useEmbeddedNavigate } from "../admin-path";
import {
  BlockStack,
  Card,
  FormLayout,
  Layout,
  Page,
  Select,
  Text,
  TextField,
} from "@shopify/polaris";
import { CatalogValuePicker } from "./catalog-value-picker";
import { isMutationBusy } from "./admin-loading";
import { useConfirmDelete } from "./confirm-delete-modal";

export type ValueGroupCatalog = {
  sources: { key: string; label: string }[];
  values: Record<string, string[]>;
};

export type ValueGroupDraft = {
  id: string;
  name: string;
  sourceKey: string;
  values: string[];
};

export function parseValueGroupForm(form: FormData) {
  let values: string[] = [];
  const raw = String(form.get("values") || "");
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        values = parsed.map((value) => String(value));
      }
    } catch {
      values = [];
    }
  }
  return {
    name: String(form.get("name") || ""),
    sourceKey: String(form.get("sourceKey") || ""),
    values,
  };
}

export function ValueGroupFormPage({
  catalog,
  group,
  error,
}: {
  catalog: ValueGroupCatalog;
  group: ValueGroupDraft | null;
  error?: string;
}) {
  const navigate = useEmbeddedNavigate();
  const navigation = useNavigation();
  const submit = useSubmit();
  const { ask, dialog } = useConfirmDelete();
  const saving = isMutationBusy(navigation);
  const isEdit = Boolean(group);

  const defaultSource =
    group?.sourceKey || catalog.sources[0]?.key || "productType";

  const [name, setName] = useState(group?.name ?? "");
  const [sourceKey, setSourceKey] = useState(defaultSource);
  const [selected, setSelected] = useState<string[]>(group?.values ?? []);

  const sourceOptions = catalog.sources.map((source) => ({
    label: source.label,
    value: source.key,
  }));

  const valueList = useMemo(() => {
    const catalogValues = catalog.values[sourceKey] || [];
    const seen = new Set(catalogValues);
    const extras = selected.filter((value) => !seen.has(value));
    return extras.length ? [...catalogValues, ...extras] : catalogValues;
  }, [catalog.values, sourceKey, selected]);

  const handleSourceChange = (next: string) => {
    setSourceKey(next);
    const allowed = new Set(catalog.values[next] || []);
    setSelected((prev) => prev.filter((value) => allowed.has(value)));
  };

  const toggleValue = (value: string, checked: boolean) => {
    setSelected((prev) => {
      if (checked) {
        return prev.includes(value) ? prev : [...prev, value];
      }
      return prev.filter((item) => item !== value);
    });
  };

  const selectAllResults = (filtered: string[]) => {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const value of filtered) next.add(value);
      return [...next];
    });
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData();
    formData.set("intent", "save");
    formData.set("name", name);
    formData.set("sourceKey", sourceKey);
    formData.set("values", JSON.stringify(selected));
    submit(formData, { method: "POST" });
  };

  const handleDelete = async () => {
    if (!isEdit) return;
    const ok = await ask({
      title: "Delete this group?",
      message: "This cannot be undone.",
      confirmLabel: "Delete",
    });
    if (!ok) return;
    const formData = new FormData();
    formData.set("intent", "delete");
    submit(formData, { method: "POST" });
  };

  return (
    <Page
      title={isEdit ? "Edit group" : "Add group"}
      backAction={{
        content: "Group values",
        onAction: () => navigate("/app/groups"),
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
        disabled: saving,
        onAction: () => {
          const form = document.getElementById(
            "value-group-form",
          ) as HTMLFormElement | null;
          form?.requestSubmit();
        },
      }}
    >
      <Layout>
        <Layout.Section>
          <Card>
            <Form id="value-group-form" method="post" onSubmit={handleSubmit}>
              <BlockStack gap="400">
                {error ? (
                  <Text as="p" tone="critical">
                    {error}
                  </Text>
                ) : null}
                <FormLayout>
                  <TextField
                    label="Group name"
                    value={name}
                    onChange={setName}
                    autoComplete="off"
                    disabled={saving}
                  />
                  <Select
                    label="Source"
                    options={
                      sourceOptions.length
                        ? sourceOptions
                        : [{ label: "Product type", value: "productType" }]
                    }
                    value={sourceKey}
                    onChange={handleSourceChange}
                    disabled={saving}
                  />
                </FormLayout>
                <CatalogValuePicker
                  key={sourceKey}
                  values={valueList}
                  selected={selected}
                  disabled={saving}
                  emptyMessage="No values for this source yet. Sync products, then pick values from the catalog."
                  onToggle={toggleValue}
                  onSelectAll={selectAllResults}
                />
              </BlockStack>
            </Form>
          </Card>
        </Layout.Section>
      </Layout>
      {dialog}
    </Page>
  );
}
