import { useMemo, useState } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { redirect, useFetcher, useLoaderData, useSearchParams } from "react-router";
import { Card, Layout, Page } from "@shopify/polaris";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { useEmbeddedNavigate } from "../admin-path";
import { authenticate } from "../shopify.server";
import { ensureShopAccess } from "../billing.server";
import {
  getAdminNavExtras,
  saveAdminNavExtras,
  type AdminLocaleRow,
} from "../admin-nav-extras.server";
import { listColorOptionKeys } from "../color-swatches.server";
import { mergeWidgetChrome } from "../widget-i18n";
import {
  BUILTIN_LABEL_FIELDS,
  TRANSLATION_FIELDS,
  TRANSLATION_TABS,
  defaultCatalogStrings,
  labelKeyFromOption,
  parseTranslationTab,
  type TranslationField,
} from "../translation-catalog";

/** Set true to restore Custom tab "+ Add field". */
const ALLOW_CUSTOM_FIELDS = false;

function mergeLocaleStrings(
  stored: Record<string, string> | undefined,
): Record<string, string> {
  return {
    ...defaultCatalogStrings(),
    ...mergeWidgetChrome(stored),
    ...(stored || {}),
  };
}

function decodeLocaleParam(raw: string | undefined) {
  const value = String(raw ?? "").trim();
  if (!value) return "";
  try {
    return decodeURIComponent(value).trim();
  } catch {
    return value;
  }
}

function localeKey(value: string) {
  return value.trim().toLowerCase();
}

function findLang(langs: AdminLocaleRow[], decoded: string) {
  const needle = localeKey(decoded);
  if (!needle) return undefined;
  return langs.find(
    (row) =>
      localeKey(row.code) === needle || localeKey(row.name) === needle,
  );
}

function resolveLang(langs: AdminLocaleRow[], decoded: string) {
  const match = findLang(langs, decoded);
  if (match) return match;
  if (langs.length === 0) return null;
  return findLang(langs, "en") ?? langs[0]!;
}

function mapForLocale<T>(
  map: Record<string, T> | undefined,
  code: string,
): T | undefined {
  if (!map) return undefined;
  if (Object.prototype.hasOwnProperty.call(map, code)) return map[code];
  const needle = localeKey(code);
  const key = Object.keys(map).find((entry) => localeKey(entry) === needle);
  return key ? map[key] : undefined;
}

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const { shop } = await ensureShopAccess(session.shop);
  const extras = await getAdminNavExtras(shop.id);
  const decoded = decodeLocaleParam(params.locale);
  const lang = resolveLang(extras.langs, decoded);
  if (!lang) return redirect("/app/translation");

  const code = lang.code;
  const options = await listColorOptionKeys(shop.id);
  const seen = new Set(BUILTIN_LABEL_FIELDS.map((field) => field.reference.toLowerCase()));
  const labelFields: TranslationField[] = [...BUILTIN_LABEL_FIELDS];
  for (const option of options) {
    const label = option.label.trim();
    if (!label || seen.has(label.toLowerCase())) continue;
    seen.add(label.toLowerCase());
    labelFields.push({
      key: labelKeyFromOption(option.optionKey),
      reference: label,
      defaultValue: "",
    });
  }

  return {
    lang,
    strings: mergeLocaleStrings(mapForLocale(extras.i18n, code)),
    labelFields,
    customFields: mapForLocale(extras.translationCustom, code) || [],
  };
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const { shop } = await ensureShopAccess(session.shop);
  const extras = await getAdminNavExtras(shop.id);
  const decoded = decodeLocaleParam(params.locale);
  const lang = resolveLang(extras.langs, decoded);
  if (!lang) return { error: "Language not found." };

  const code = lang.code;
  const form = await request.formData();
  const intent = String(form.get("intent") || "");

  if (intent === "addCustom") {
    if (!ALLOW_CUSTOM_FIELDS) {
      return { error: "Creating custom fields is disabled for now." };
    }
    const next = extras.translationCustom ? { ...extras.translationCustom } : {};
    const rows = [...(mapForLocale(next, code) || [])];
    rows.push({ id: crypto.randomUUID(), reference: "Custom field" });
    next[code] = rows;
    extras.translationCustom = next;
    await saveAdminNavExtras(shop.id, extras);
    return { ok: true as const };
  }

  if (intent === "saveStrings") {
    let parsed: unknown;
    try {
      parsed = JSON.parse(String(form.get("strings") || "{}"));
    } catch {
      return { error: "Invalid strings JSON." };
    }
    const next: Record<string, string> = { ...(mapForLocale(extras.i18n, code) || {}) };
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
        if (typeof value === "string") next[key] = value;
      }
    }
    extras.i18n = { ...extras.i18n, [code]: next };
    await saveAdminNavExtras(shop.id, extras);
    return { ok: true as const };
  }

  return { error: "Unknown action." };
};

export default function TranslationLocalePage() {
  const { lang, strings, labelFields, customFields } =
    useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const navigate = useEmbeddedNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = parseTranslationTab(searchParams.get("tab"));
  const snapshot = JSON.stringify(strings);
  const [drafts, setDrafts] = useState<Record<string, string>>(strings);
  const [seen, setSeen] = useState(snapshot);
  if (snapshot !== seen) {
    setSeen(snapshot);
    setDrafts(strings);
  }

  const dirty = JSON.stringify(drafts) !== JSON.stringify(strings);
  const busy = fetcher.state !== "idle";

  const fields = useMemo((): TranslationField[] => {
    if (tab === "labels") return labelFields;
    if (tab === "custom") {
      return customFields.map((field) => ({
        key: `custom.${field.id}`,
        reference: field.reference,
        defaultValue: "",
      }));
    }
    return TRANSLATION_FIELDS[tab];
  }, [customFields, labelFields, tab]);

  const save = () => {
    fetcher.submit(
      { intent: "saveStrings", strings: JSON.stringify(drafts) },
      { method: "post" },
    );
  };

  return (
    <Page
      title={lang.name}
      backAction={{
        content: "Translation",
        onAction: () => navigate("/app/translation"),
      }}
      primaryAction={
        dirty
          ? {
              content: "Save",
              loading: busy,
              onAction: save,
            }
          : undefined
      }
      secondaryActions={
        dirty
          ? [
              {
                content: "Discard",
                disabled: busy,
                onAction: () => setDrafts(strings),
              },
            ]
          : undefined
      }
    >
      <Layout>
        <Layout.Section>
          <Card>
            <div className="findly-i18n-tabs">
              {TRANSLATION_TABS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={
                    item.id === tab
                      ? "findly-i18n-tab findly-i18n-tab--active"
                      : "findly-i18n-tab"
                  }
                  onClick={() => {
                    const next = new URLSearchParams(searchParams);
                    next.set("tab", item.id);
                    setSearchParams(next);
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <div className="findly-i18n-table">
              <div className="findly-i18n-table__head">
                <span>Reference</span>
                <span />
                <span>{lang.name}</span>
              </div>
              {fields.map((field) => (
                <div className="findly-i18n-table__row" key={field.key}>
                  <span>{field.reference}</span>
                  <span className="findly-i18n-arrow" aria-hidden>
                    ›
                  </span>
                  <input
                    className="findly-i18n-input"
                    value={drafts[field.key] ?? ""}
                    placeholder="Enter translation value"
                    onChange={(event) =>
                      setDrafts((current) => ({
                        ...current,
                        [field.key]: event.target.value,
                      }))
                    }
                  />
                </div>
              ))}
            </div>
            {tab === "custom" && ALLOW_CUSTOM_FIELDS ? (
              <button
                type="button"
                className="findly-i18n-add"
                disabled={busy}
                onClick={() =>
                  fetcher.submit({ intent: "addCustom" }, { method: "post" })
                }
              >
                <span className="findly-i18n-add__plus">+</span>
                Add field
              </button>
            ) : null}
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

export const headers: HeadersFunction = (headersArgs) =>
  boundary.headers(headersArgs);
