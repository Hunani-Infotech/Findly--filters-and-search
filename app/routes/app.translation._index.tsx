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
import { ADDABLE_LOCALES } from "../utils/admin-locales";
import { downloadCsv } from "../utils/csv";
import { useConfirmDelete } from "../components/confirm-delete-modal";
import {
  getAdminNavExtras,
  saveAdminNavExtras,
} from "../services/admin-extras.server";
import { listColorOptionKeys } from "../services/color-swatches.server";
import { useEmbeddedNavigate } from "../hooks/use-embedded-navigate";
import { slicePage } from "../utils/admin-list-page";
import { indexTablePagination } from "../components/admin-list-pagination";
import { authenticate } from "../shopify.server";
import { authenticateAdminAllowReviewBot } from "../lib/admin-auth.server";
import { ensureShopAccess } from "../services/billing.server";
import {
  buildLabelFields,
  isUntouchedEnglishCopy,
  localeIsComplete,
  persistLocaleStrings,
  type TranslationField,
} from "../utils/translation-catalog";
import {
  applyTranslationCsv,
  renderTranslationCsv,
  sampleTranslationCsv,
  type TranslationCustomRef,
} from "../utils/translation-csv";
import type { WidgetI18nMap } from "../utils/widget-i18n";

export { TranslationListSkeleton as HydrateFallback } from "../components/admin-skeletons";

function customByLocale(
  extras: { translationCustom?: Record<string, TranslationCustomRef[]> },
): Record<string, TranslationCustomRef[]> {
  return extras.translationCustom || {};
}

function customKeysFor(
  extras: { translationCustom?: Record<string, TranslationCustomRef[]> },
  code: string,
) {
  return (extras.translationCustom?.[code] || []).map(
    (field) => `custom.${field.id}`,
  );
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const auth = await authenticateAdminAllowReviewBot(request);
  if (auth.bot) {
    return {
      langs: [{ code: "en", name: "English", complete: true, isDefault: true }],
      i18n: {} as WidgetI18nMap,
      labelFields: [] as TranslationField[],
      customByLocale: {} as Record<string, TranslationCustomRef[]>,
    };
  }
  const { session } = auth;
  const { shop } = await ensureShopAccess(session.shop);
  const [extras, options] = await Promise.all([
    getAdminNavExtras(shop.id),
    listColorOptionKeys(shop.id),
  ]);
  return {
    langs: extras.langs,
    i18n: extras.i18n,
    labelFields: buildLabelFields(options),
    customByLocale: customByLocale(extras),
  };
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
      [locale.code]: {},
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
    let parsed: unknown;
    try {
      parsed = JSON.parse(String(form.get("strings") || "{}"));
    } catch {
      return { error: "Invalid strings JSON." };
    }
    const incoming: Record<string, string> = {};
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
        if (typeof value === "string") incoming[key] = value;
      }
    }
    const previous = isUntouchedEnglishCopy(extras.i18n[code])
      ? {}
      : { ...(extras.i18n[code] || {}) };
    for (const [key, value] of Object.entries(incoming)) {
      if (value.trim()) previous[key] = value;
      else delete previous[key];
    }
    const saved = persistLocaleStrings(previous);
    extras.i18n = { ...extras.i18n, [code]: saved };
    extras.langs = extras.langs.map((lang) =>
      lang.code === code
        ? {
            ...lang,
            name: name || lang.name,
            complete: localeIsComplete(saved, {
              isDefault: lang.isDefault,
              customKeys: customKeysFor(extras, code),
            }),
          }
        : lang,
    );
    await saveAdminNavExtras(shop.id, extras);
    return { ok: true as const, toast: `${name || row.name} strings saved` };
  }

  if (intent === "importCsv") {
    const csv = String(form.get("csv") || "");
    if (!csv.trim()) return { error: "CSV is empty." };
    const applied = applyTranslationCsv(
      extras.langs,
      extras.i18n,
      csv,
      ADDABLE_LOCALES,
      "en",
      customByLocale(extras),
    );
    if ("error" in applied) return applied;
    extras.langs = applied.langs;
    extras.i18n = applied.i18n;
    await saveAdminNavExtras(shop.id, extras);
    const skipped =
      applied.skipped > 0 ? ` ${applied.skipped} rows skipped.` : "";
    return {
      ok: true as const,
      toast: `Imported ${applied.imported} string${applied.imported === 1 ? "" : "s"}.${skipped}`,
      count: applied.imported,
    };
  }

  return { error: "Unknown action." };
};

export default function TranslationPage() {
  const { langs, i18n, labelFields, customByLocale: customFields } =
    useLoaderData<typeof loader>();
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
  const [page, setPage] = useState(0);
  const slice = slicePage(langs, page);
  if (page !== slice.safePage) setPage(slice.safePage);

  const openEditor = (code: string) => {
    navigate(`/app/translation/${encodeURIComponent(code)}`);
  };

  const rowMarkup = slice.paged.map((lang, index) => (
    <IndexTable.Row
      id={lang.code}
      key={lang.code}
      position={slice.start + index}
    >
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
      backAction={{ content: "Home", onAction: () => navigate("/app") }}
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
            downloadCsv(
              "findly-translations.csv",
              renderTranslationCsv(langs, i18n, {
                labelFields,
                customByLocale: customFields,
              }),
            ),
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
                itemCount={slice.total}
                pagination={indexTablePagination(slice, setPage)}
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
              Upload a CSV with columns Section, Key, Label, Value, Order, and
              Locale. Each language includes Product, Search, Filter, Sort, and
              Filter option labels. Empty Value cells clear that string. Excel
              (.xlsx) is not applied.
            </Text>
            <Button
              variant="plain"
              onClick={() =>
                downloadCsv("findly-translations-sample.csv", sampleTranslationCsv())
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
