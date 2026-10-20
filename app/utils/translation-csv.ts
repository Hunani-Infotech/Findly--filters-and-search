import { csvCell, parseCsv } from "./csv";
import {
  BUILTIN_LABEL_FIELDS,
  TRANSLATION_FIELDS,
  TRANSLATION_TABS,
  englishSourceStrings,
  isUntouchedEnglishCopy,
  localeIsComplete,
  normalizeStoredStrings,
  persistLocaleStrings,
  visibleLocaleStrings,
  type TranslationField,
} from "./translation-catalog";
import { canonicalizeWidgetKey, type WidgetI18nMap } from "./widget-i18n";

export const TRANSLATION_CSV_HEADERS = [
  "Section",
  "Key",
  "Label",
  "Value",
  "Order",
  "Locale",
] as const;

export type TranslationCsvField = {
  section: string;
  key: string;
  label: string;
};

export type TranslationLocaleRow = {
  code: string;
  name: string;
  complete: boolean;
  isDefault: boolean;
};

export type TranslationCustomRef = {
  id: string;
  reference: string;
};

const KNOWN_KEYS = new Set<string>([
  ...Object.values(TRANSLATION_FIELDS).flatMap((fields) =>
    fields.map((field) => field.key),
  ),
  ...BUILTIN_LABEL_FIELDS.map((field) => field.key),
]);

function tabLabel(id: (typeof TRANSLATION_TABS)[number]["id"]) {
  return TRANSLATION_TABS.find((tab) => tab.id === id)?.label || id;
}

export function translationExportFields(options: {
  labelFields: TranslationField[];
  customFields?: TranslationCustomRef[];
}): TranslationCsvField[] {
  const rows: TranslationCsvField[] = [];
  for (const tab of TRANSLATION_TABS) {
    if (tab.id === "labels" || tab.id === "custom") continue;
    for (const field of TRANSLATION_FIELDS[tab.id]) {
      rows.push({
        section: tab.label,
        key: field.key,
        label: field.reference,
      });
    }
  }
  for (const field of options.labelFields) {
    rows.push({
      section: tabLabel("labels"),
      key: field.key,
      label: field.reference,
    });
  }
  for (const field of options.customFields || []) {
    rows.push({
      section: tabLabel("custom"),
      key: `custom.${field.id}`,
      label: field.reference || "Custom field",
    });
  }
  return rows;
}

export function importableTranslationKey(raw: string): string | null {
  const key = canonicalizeWidgetKey(raw.trim());
  if (!key) return null;
  if (KNOWN_KEYS.has(key)) return key;
  if (key.startsWith("label.option.")) return key;
  if (key.startsWith("custom.")) return key;
  return null;
}

function csvLine(cells: Array<string | number>) {
  return cells.map(csvCell).join(",");
}

export function renderTranslationCsv(
  langs: TranslationLocaleRow[],
  i18n: WidgetI18nMap,
  options: {
    labelFields: TranslationField[];
    customByLocale?: Record<string, TranslationCustomRef[]>;
  },
): string {
  const lines = [TRANSLATION_CSV_HEADERS.join(",")];
  for (const lang of langs) {
    const visible = visibleLocaleStrings(i18n[lang.code], lang.isDefault);
    const fields = translationExportFields({
      labelFields: options.labelFields,
      customFields: options.customByLocale?.[lang.code] || [],
    });
    fields.forEach((field, index) => {
      lines.push(
        csvLine([
          field.section,
          field.key,
          field.label,
          visible[field.key] || "",
          index + 1,
          lang.code,
        ]),
      );
    });
  }
  return lines.join("\n");
}

export function sampleTranslationCsv(): string {
  return renderTranslationCsv(
    [{ code: "en", name: "English", complete: true, isDefault: true }],
    { en: englishSourceStrings() },
    { labelFields: BUILTIN_LABEL_FIELDS },
  );
}

export type ImportedTranslation = {
  langs: TranslationLocaleRow[];
  i18n: WidgetI18nMap;
  imported: number;
  skipped: number;
  added: string[];
};

export function applyTranslationCsv(
  langs: TranslationLocaleRow[],
  i18n: WidgetI18nMap,
  csv: string,
  catalog: Array<{ code: string; name: string }>,
  fallbackLocale = "en",
  customByLocale: Record<string, TranslationCustomRef[]> = {},
): ImportedTranslation | { error: string } {
  const table = parseCsv(csv);
  if (table.length < 2) return { error: "CSV has no data rows." };
  const header = table[0]!.map((cell) => cell.trim().toLowerCase());
  const keyIdx = header.indexOf("key");
  const valueIdx = header.indexOf("value");
  if (keyIdx < 0 || valueIdx < 0) {
    return { error: "CSV must include Key and Value columns." };
  }
  const localeIdx = header.indexOf("locale");
  const nextLangs = langs.map((lang) => ({ ...lang }));
  const nextI18n: WidgetI18nMap = { ...i18n };
  const bases = new Map<string, Record<string, string>>();
  for (const lang of nextLangs) {
    const stored = i18n[lang.code];
    bases.set(
      lang.code,
      lang.isDefault
        ? persistLocaleStrings(normalizeStoredStrings(stored))
        : isUntouchedEnglishCopy(stored)
          ? {}
          : persistLocaleStrings(normalizeStoredStrings(stored)),
    );
  }

  let imported = 0;
  let skipped = 0;
  const added: string[] = [];
  const touched = new Set<string>();

  for (const cells of table.slice(1)) {
    const key = importableTranslationKey(String(cells[keyIdx] || ""));
    if (!key) {
      skipped += 1;
      continue;
    }
    const locale = normalizeImportLocale(
      localeIdx >= 0 ? String(cells[localeIdx] || "") : "",
      fallbackLocale,
    );
    let lang = nextLangs.find((row) => row.code.toLowerCase() === locale.toLowerCase());
    if (!lang) {
      const known = catalog.find((item) => item.code.toLowerCase() === locale.toLowerCase());
      if (!known) {
        skipped += 1;
        continue;
      }
      lang = {
        code: known.code,
        name: known.name,
        complete: false,
        isDefault: false,
      };
      nextLangs.push(lang);
      bases.set(known.code, {});
      added.push(known.name);
    }
    const value = String(cells[valueIdx] ?? "").trim();
    const bucket = { ...(bases.get(lang.code) || {}) };
    if (value) bucket[key] = value;
    else delete bucket[key];
    bases.set(lang.code, bucket);
    touched.add(lang.code);
    imported += 1;
  }

  if (imported === 0) {
    return {
      error:
        "No translation rows matched. Export a file from this page and edit the Value column.",
    };
  }

  for (const lang of nextLangs) {
    if (!touched.has(lang.code)) continue;
    const saved = bases.get(lang.code) || {};
    nextI18n[lang.code] = saved;
    lang.complete = localeIsComplete(saved, {
      isDefault: lang.isDefault,
      customKeys: (customByLocale[lang.code] || []).map(
        (field) => `custom.${field.id}`,
      ),
    });
  }

  return { langs: nextLangs, i18n: nextI18n, imported, skipped, added };
}

export function normalizeImportLocale(raw: string, fallback: string) {
  const locale = raw.trim() || fallback;
  if (!locale || locale.toLowerCase() === "default") return "en";
  return locale;
}
