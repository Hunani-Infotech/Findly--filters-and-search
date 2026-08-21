import { useEffect, useMemo, useRef, useState } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import {
  Badge,
  Banner,
  BlockStack,
  Button,
  Card,
  DropZone,
  IndexTable,
  InlineStack,
  Layout,
  Modal,
  Page,
  Select,
  Text,
} from "@shopify/polaris";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { ADDABLE_LOCALES } from "../admin-locales";
import { useConfirmDelete } from "../components/confirm-delete-modal";
import {
  getAdminNavExtras,
  saveAdminNavExtras,
  type AdminLocaleRow,
} from "../admin-nav-extras.server";
import { useEmbeddedNavigate } from "../admin-path";
import { authenticate } from "../shopify.server";
import { ensureShopAccess } from "../billing.server";
import {
  DEFAULT_WIDGET_I18N,
  WIDGET_I18N_KEYS,
  WIDGET_I18N_LABELS,
  mergeWidgetChrome,
  type WidgetI18nKey,
  type WidgetI18nMap,
} from "../widget-i18n";

const WIDGET_KEY_SET = new Set<string>(WIDGET_I18N_KEYS);

function csvCell(value: string | number) {
  const raw = String(value);
  if (/[",\n\r]/.test(raw)) return `"${raw.replace(/"/g, '""')}"`;
  return raw;
}

function widgetCsvRows(
  locale: string,
  chrome: Record<WidgetI18nKey, string>,
  includeLocale: boolean,
) {
  return WIDGET_I18N_KEYS.map((key, index) => {
    const cells = [
      "widget",
      key,
      WIDGET_I18N_LABELS[key],
      chrome[key],
      index + 1,
    ];
    if (includeLocale) cells.push(locale);
    return cells.map(csvCell).join(",");
  });
}

function sampleCsv() {
  const header = ["Section", "Key", "Label", "Value", "Order", "Locale"].join(
    ",",
  );
  const rows = widgetCsvRows("en", DEFAULT_WIDGET_I18N, true);
  return [header, ...rows].join("\n");
}

function exportCsv(langs: AdminLocaleRow[], i18n: WidgetI18nMap) {
  const header = ["Section", "Key", "Label", "Value", "Order", "Locale"].join(
    ",",
  );
  const rows: string[] = [];
  for (const lang of langs) {
    const chrome = mergeWidgetChrome(i18n[lang.code]);
    rows.push(...widgetCsvRows(lang.code, chrome, true));
  }
  return [header, ...rows].join("\n");
}

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  const src = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell);
      if (row.some((part) => part.trim())) rows.push(row);
      row = [];
      cell = "";
    } else if (ch !== "\r") {
      cell += ch;
    }
  }
  row.push(cell);
  if (row.some((part) => part.trim())) rows.push(row);
  return rows;
}

function isWidgetKey(value: string): value is WidgetI18nKey {
  return WIDGET_KEY_SET.has(value);
}

function parseStringsPayload(
  form: FormData,
): Partial<Record<WidgetI18nKey, string>> | { error: string } {
  const jsonRaw = form.get("strings");
  if (typeof jsonRaw === "string" && jsonRaw.trim()) {
    try {
      const parsed = JSON.parse(jsonRaw) as unknown;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return { error: "Invalid strings JSON." };
      }
      const out: Partial<Record<WidgetI18nKey, string>> = {};
      for (const key of WIDGET_I18N_KEYS) {
        const value = (parsed as Record<string, unknown>)[key];
        if (typeof value === "string") out[key] = value;
      }
      return out;
    } catch {
      return { error: "Invalid strings JSON." };
    }
  }

  const out: Partial<Record<WidgetI18nKey, string>> = {};
  for (const key of WIDGET_I18N_KEYS) {
    const value = form.get(key);
    if (typeof value === "string") out[key] = value;
  }
  return out;
}

function stringsAreComplete(chrome: Record<WidgetI18nKey, string>) {
  return WIDGET_I18N_KEYS.every((key) => chrome[key].trim().length > 0);
}

function normalizeImportLocale(raw: string, fallback: string) {
  const locale = raw.trim() || fallback;
  if (!locale || locale.toLowerCase() === "default") return "en";
  return locale;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const { shop } = await ensureShopAccess(session.shop);
  const extras = await getAdminNavExtras(shop.id);
  return { langs: extras.langs, i18n: extras.i18n };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const { shop } = await ensureShopAccess(session.shop);
  const extras = await getAdminNavExtras(shop.id);
  const form = await request.formData();
  const intent = String(form.get("intent") || "");

  if (intent === "addLang") {
    const code = String(form.get("code") || "");
    const locale = ADDABLE_LOCALES.find((item) => item.code === code);
    if (!locale) return { error: "Choose a language from the list." };
    if (extras.langs.some((lang) => lang.code === code)) {
      return { error: "That language is already added." };
    }
    extras.langs.push({
      code: locale.code,
      name: locale.name,
      complete: false,
      isDefault: false,
    });
    extras.i18n = {
      ...extras.i18n,
      [locale.code]: { ...DEFAULT_WIDGET_I18N },
    };
    await saveAdminNavExtras(shop.id, extras);
    return { ok: true as const, toast: `${locale.name} added` };
  }

  if (intent === "deleteLang") {
    const code = String(form.get("code") || "");
    const row = extras.langs.find((lang) => lang.code === code);
    if (!row) return { error: "Language not found." };
    if (row.isDefault) return { error: "The default language cannot be deleted." };
    extras.langs = extras.langs.filter((lang) => lang.code !== code);
    const nextI18n = { ...extras.i18n };
    delete nextI18n[code];
    extras.i18n = nextI18n;
    await saveAdminNavExtras(shop.id, extras);
    return { ok: true as const, toast: `${row.name} removed` };
  }

  if (intent === "updateLang") {
    const code = String(form.get("code") || "");
    const name = String(form.get("name") || "").trim();
    const complete = String(form.get("complete") || "") === "true";
    const row = extras.langs.find((lang) => lang.code === code);
    if (!row) return { error: "Language not found." };
    extras.langs = extras.langs.map((lang) =>
      lang.code === code
        ? { ...lang, name: name || lang.name, complete }
        : lang,
    );
    await saveAdminNavExtras(shop.id, extras);
    return { ok: true as const, toast: `${name || row.name} updated` };
  }

  if (intent === "saveStrings") {
    const code = String(form.get("code") || "");
    const name = String(form.get("name") || "").trim();
    const row = extras.langs.find((lang) => lang.code === code);
    if (!row) return { error: "Language not found." };
    const parsed = parseStringsPayload(form);
    if ("error" in parsed) return parsed;
    const merged = mergeWidgetChrome({
      ...extras.i18n[code],
      ...parsed,
    });
    extras.i18n = { ...extras.i18n, [code]: merged };
    extras.langs = extras.langs.map((lang) =>
      lang.code === code
        ? {
            ...lang,
            name: name || lang.name,
            complete: stringsAreComplete(merged),
          }
        : lang,
    );
    await saveAdminNavExtras(shop.id, extras);
    return { ok: true as const, toast: `${name || row.name} strings saved` };
  }

  if (intent === "importCsv") {
    const csv = String(form.get("csv") || "");
    if (!csv.trim()) return { error: "CSV is empty." };
    const table = parseCsv(csv);
    if (table.length < 2) return { error: "CSV has no data rows." };
    const header = table[0]!.map((cell) => cell.trim().toLowerCase());
    const keyIdx = header.indexOf("key");
    const valueIdx = header.indexOf("value");
    if (keyIdx < 0 || valueIdx < 0) {
      return { error: "CSV must include Key and Value columns." };
    }
    const localeIdx = header.indexOf("locale");
    const fallbackLocale = normalizeImportLocale(
      String(form.get("code") || ""),
      "en",
    );
    const nextI18n: WidgetI18nMap = { ...extras.i18n };
    let count = 0;
    const touched = new Set<string>();
    for (const cells of table.slice(1)) {
      const key = String(cells[keyIdx] || "").trim();
      if (!isWidgetKey(key)) continue;
      const value = String(cells[valueIdx] ?? "");
      const locale = normalizeImportLocale(
        localeIdx >= 0 ? String(cells[localeIdx] || "") : "",
        fallbackLocale,
      );
      nextI18n[locale] = { ...nextI18n[locale], [key]: value };
      touched.add(locale);
      count += 1;
    }
    extras.i18n = nextI18n;
    if (touched.size > 0) {
      extras.langs = extras.langs.map((lang) =>
        touched.has(lang.code)
          ? {
              ...lang,
              complete: stringsAreComplete(mergeWidgetChrome(nextI18n[lang.code])),
            }
          : lang,
      );
    }
    await saveAdminNavExtras(shop.id, extras);
    return {
      ok: true as const,
      toast: `Imported ${count} string${count === 1 ? "" : "s"}`,
      count,
    };
  }

  return { error: "Unknown action." };
};

export default function TranslationPage() {
  const { langs, i18n } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const navigate = useEmbeddedNavigate();
  const shopify = useAppBridge();
  const { ask, dialog } = useConfirmDelete();
  const busy = fetcher.state !== "idle";

  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [addCode, setAddCode] = useState("");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [addOpenedFor, setAddOpenedFor] = useState(false);
  const [seenResult, setSeenResult] = useState<string | null>(null);
  const toastSeen = useRef<string | null>(null);

  const availableLocales = useMemo(() => {
    const used = new Set(langs.map((lang) => lang.code));
    return ADDABLE_LOCALES.filter((locale) => !used.has(locale.code));
  }, [langs]);

  if (addOpen && !addOpenedFor) {
    setAddOpenedFor(true);
    setAddCode(availableLocales[0]?.code ?? "");
  }
  if (!addOpen && addOpenedFor) setAddOpenedFor(false);

  if (fetcher.state === "idle" && fetcher.data) {
    const key = JSON.stringify(fetcher.data);
    if (seenResult !== key) {
      setSeenResult(key);
      if ("ok" in fetcher.data && fetcher.data.ok) {
        setAddOpen(false);
        setImportOpen(false);
        setImportFile(null);
      }
    }
  }

  useEffect(() => {
    const data = fetcher.data;
    if (!data || fetcher.state !== "idle") return;
    const key = JSON.stringify(data);
    if (toastSeen.current === key) return;
    toastSeen.current = key;
    if ("error" in data && data.error) {
      shopify.toast.show(data.error, { isError: true });
      return;
    }
    if ("ok" in data && data.ok) {
      shopify.toast.show(data.toast);
    }
  }, [fetcher.data, fetcher.state, shopify]);

  const submitImportFile = (file: File) => {
    const name = file.name.toLowerCase();
    if (name.endsWith(".xlsx")) {
      shopify.toast.show("Excel apply is CSV-only for now.");
      return;
    }
    if (!name.endsWith(".csv")) {
      shopify.toast.show("Choose a .csv file.", { isError: true });
      return;
    }
    void file.text().then((csv) => {
      fetcher.submit({ intent: "importCsv", csv }, { method: "post" });
    });
  };

  const addOptions = availableLocales.map((locale) => ({
    label: `${locale.name} (${locale.code})`,
    value: locale.code,
  }));

  const resourceName = { singular: "language", plural: "languages" };

  const openEditor = (code: string) => {
    navigate(`/app/translation/${encodeURIComponent(code)}`);
  };

  const rowMarkup = langs.map((lang, index) => (
    <IndexTable.Row id={lang.code} key={lang.code} position={index}>
      <IndexTable.Cell>
        <InlineStack gap="200" blockAlign="center" wrap={false}>
          <Button
            variant="plain"
            onClick={() => openEditor(lang.code)}
          >
            {lang.name}
          </Button>
          {lang.isDefault ? <Badge>Default</Badge> : null}
        </InlineStack>
      </IndexTable.Cell>
      <IndexTable.Cell>
        {lang.complete ? (
          <Badge tone="success">Translation complete</Badge>
        ) : (
          <Badge>Incomplete</Badge>
        )}
      </IndexTable.Cell>
      <IndexTable.Cell>
        <InlineStack gap="200" wrap={false}>
          <Button
            variant="plain"
            onClick={() => openEditor(lang.code)}
          >
            Edit
          </Button>
          <Button
            variant="plain"
            tone="critical"
            disabled={lang.isDefault}
            onClick={async () => {
              if (lang.isDefault) return;
              const ok = await ask({
                title: `Delete ${lang.name} translations?`,
                message: "This cannot be undone.",
                confirmLabel: "Delete",
              });
              if (!ok) return;
              fetcher.submit(
                { intent: "deleteLang", code: lang.code },
                { method: "post" },
              );
            }}
          >
            Delete
          </Button>
        </InlineStack>
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  return (
    <Page
      title="Translation"
      backAction={{ content: "Filters", onAction: () => navigate("/app") }}
      primaryAction={{
        content: "Add language",
        onAction: () => {
          setAddOpen(true);
          setAddCode(availableLocales[0]?.code ?? "");
        },
        disabled: availableLocales.length === 0,
      }}
      secondaryActions={[
        { content: "Import", onAction: () => setImportOpen(true) },
        {
          content: "Export",
          onAction: () =>
            downloadCsv("findly-translations.csv", exportCsv(langs, i18n)),
        },
      ]}
    >
      <Layout>
        <Layout.Section>
          <BlockStack gap="400">
            <Banner tone="info">
              <p>
                Widget chrome strings apply on the storefront for the shop
                locale (e.g. French / fr).
              </p>
            </Banner>
            <Card padding="0">
              <IndexTable
                resourceName={resourceName}
                itemCount={langs.length}
                headings={[
                  { title: "Language" },
                  { title: "Status" },
                  { title: "Actions" },
                ]}
                selectable={false}
              >
                {rowMarkup}
              </IndexTable>
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add language"
        primaryAction={{
          content: "Add",
          disabled: busy || !addCode,
          onAction: () => {
            fetcher.submit(
              { intent: "addLang", code: addCode },
              { method: "post" },
            );
          },
        }}
        secondaryActions={[
          { content: "Cancel", onAction: () => setAddOpen(false) },
        ]}
      >
        <Modal.Section>
          {addOptions.length === 0 ? (
            <Text as="p">All catalog languages are already added.</Text>
          ) : (
            <Select
              label="Language"
              options={addOptions}
              value={addCode}
              onChange={setAddCode}
            />
          )}
        </Modal.Section>
      </Modal>

      <Modal
        open={importOpen}
        onClose={() => {
          setImportOpen(false);
          setImportFile(null);
        }}
        title="Import translations"
        primaryAction={{
          content: "Import",
          disabled: !importFile || busy,
          onAction: () => {
            if (!importFile) return;
            submitImportFile(importFile);
          },
        }}
        secondaryActions={[
          {
            content: "Cancel",
            onAction: () => {
              setImportOpen(false);
              setImportFile(null);
            },
          },
        ]}
      >
        <Modal.Section>
          <BlockStack gap="300">
            <Text as="p">
              Upload a CSV with columns Section, Key, Label, Value, Order,
              Locale (Locale optional). Matching widget keys are saved per
              locale. Excel (.xlsx) apply is CSV-only for now.
            </Text>
            <Button
              variant="plain"
              onClick={() =>
                downloadCsv("findly-translations-sample.csv", sampleCsv())
              }
            >
              Download sample CSV
            </Button>
            <DropZone
              accept=".xlsx,.csv"
              allowMultiple={false}
              onDrop={(_dropped, accepted) => {
                const file = accepted[0];
                if (!file) return;
                setImportFile(file);
                submitImportFile(file);
              }}
              variableHeight
            >
              {importFile ? (
                <Text as="p">{importFile.name}</Text>
              ) : (
                <DropZone.FileUpload
                  actionTitle="Add file"
                  actionHint="Accepts .xlsx or .csv"
                />
              )}
            </DropZone>
          </BlockStack>
        </Modal.Section>
      </Modal>
      {dialog}
    </Page>
  );
}

export const headers: HeadersFunction = (headersArgs) =>
  boundary.headers(headersArgs);
