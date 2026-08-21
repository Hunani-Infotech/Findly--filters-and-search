import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Form, useFetcher, useNavigation, useSearchParams, useSubmit } from "react-router";
import { useEmbeddedNavigate, withEmbeddedParams } from "../admin-path";
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
import type { CatalogValuesPage } from "../value-groups.server";

export type ValueGroupDraft = {
  id: string;
  name: string;
  sourceKey: string;
  values: string[];
};

type CatalogPageData = CatalogValuesPage;

type PickerResponse =
  | ({ all: false; requestId: string } & CatalogPageData)
  | {
      all: true;
      requestId: string;
      sourceKey: string;
      query: string;
      values: string[];
      total: number;
    };

function pickerPath(
  searchParams: URLSearchParams,
  input: { source: string; page?: number; q?: string; all?: boolean; r?: string },
) {
  const next = new URLSearchParams();
  if (input.source) next.set("source", input.source);
  if (input.q) next.set("q", input.q);
  if (input.r) next.set("r", input.r);
  if (input.all) next.set("all", "1");
  else if (input.page && input.page > 0) next.set("page", String(input.page));
  return withEmbeddedParams(`/app/groups/picker?${next.toString()}`, searchParams);
}

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
  catalog: CatalogPageData;
  group: ValueGroupDraft | null;
  error?: string;
}) {
  const navigate = useEmbeddedNavigate();
  const navigation = useNavigation();
  const submit = useSubmit();
  const [searchParams] = useSearchParams();
  const pageFetcher = useFetcher<PickerResponse>();
  const allFetcher = useFetcher<PickerResponse>();
  const { ask, dialog } = useConfirmDelete();
  const saving = isMutationBusy(navigation);
  const isEdit = Boolean(group);
  const lastAllKey = useRef<string | null>(null);
  const pageRequestId = useRef(0);

  const [name, setName] = useState(group?.name ?? "");
  const [sourceKey, setSourceKey] = useState(catalog.sourceKey);
  const [selected, setSelected] = useState<string[]>(group?.values ?? []);
  const [query, setQuery] = useState(catalog.query);
  const [pageData, setPageData] = useState(catalog);

  useEffect(() => {
    const data = pageFetcher.data;
    if (!data || data.all !== false) return;
    if (data.requestId !== String(pageRequestId.current)) return;
    setPageData(data);
  }, [pageFetcher.data]);

  useEffect(() => {
    const data = allFetcher.data;
    if (!data || data.all !== true) return;
    const key = `${data.sourceKey}|${data.query}|${data.total}`;
    if (lastAllKey.current === key) return;
    lastAllKey.current = key;
    setSelected((prev) => [...new Set([...prev, ...data.values])]);
  }, [allFetcher.data]);

  const sourceOptions = useMemo(
    () =>
      pageData.sources.map((source) => ({
        label: source.label,
        value: source.key,
      })),
    [pageData.sources],
  );

  const loadPage = (next: { source: string; page?: number; q?: string }) => {
    pageRequestId.current += 1;
    const requestId = String(pageRequestId.current);
    pageFetcher.load(
      pickerPath(searchParams, {
        source: next.source,
        page: next.page ?? 0,
        q: next.q ?? "",
        r: requestId,
      }),
    );
  };

  const handleSourceChange = (next: string) => {
    setSourceKey(next);
    setSelected([]);
    setQuery("");
    setPageData((prev) => ({
      ...prev,
      sourceKey: next,
      values: [],
      total: 0,
      page: 0,
      pageCount: 1,
      showingFrom: 0,
      showingTo: 0,
      query: "",
    }));
    loadPage({ source: next, page: 0, q: "" });
  };

  const toggleValue = (value: string, checked: boolean) => {
    setSelected((prev) => {
      if (checked) {
        return prev.includes(value) ? prev : [...prev, value];
      }
      return prev.filter((item) => item !== value);
    });
  };

  const selectAllResults = () => {
    allFetcher.load(
      pickerPath(searchParams, {
        source: sourceKey,
        q: query,
        all: true,
      }),
    );
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
                  values={pageData.values}
                  selected={selected}
                  disabled={saving}
                  emptyMessage="No values for this source yet. Sync products, then pick values from the catalog."
                  query={query}
                  onQueryChange={(next) => {
                    setQuery(next);
                    loadPage({ source: sourceKey, page: 0, q: next });
                  }}
                  page={pageData.page}
                  pageCount={pageData.pageCount}
                  total={pageData.total}
                  showingFrom={pageData.showingFrom}
                  showingTo={pageData.showingTo}
                  onPageChange={(nextPage) => {
                    loadPage({
                      source: sourceKey,
                      page: nextPage,
                      q: query,
                    });
                  }}
                  onToggle={toggleValue}
                  onSelectAll={selectAllResults}
                  selectAllLoading={allFetcher.state !== "idle"}
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
