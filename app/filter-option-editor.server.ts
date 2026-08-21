import type { Prisma } from "@prisma/client";
import prisma from "./db.server";
import {
  defaultUrlHandle,
  facetSettingsWithTreeMeta,
  parseFacetSettings,
  type FacetSetting,
  type FacetSettingsMap,
  type FacetShowMoreMode,
  type FacetTextTransform,
  type FacetValueMode,
  type FacetValueSortMode,
  FACET_SHOW_MORE_MODES,
  FACET_TEXT_TRANSFORMS,
  FACET_VALUE_SORT_MODES,
} from "./facet-settings";
import {
  addFilterOptionKeys,
  applyFacetSettingLabels,
  availableFilterOptions,
  buildVisibleFilterRows,
  catalogValuesForKey,
  enableFlagsFromConfig,
  facetSupportsValuePicker,
  persistDisplayOrder,
  removeFilterOptionKeys,
  resolveFilterOptionRow,
  withGloboAdminOptionKeys,
  type FilterOptionRow,
} from "./filter-option-rows";
import { getFilterTree, updateFilterTree } from "./filter-trees.server";
import {
  catalogOptionRows,
  mappedFacetsForAdmin,
  parseDisplayTypes,
  withMappedFacetKeys,
} from "./filters.server";
import {
  displayTypeChoicesForKey,
  FACET_DISPLAY_TYPE_LABELS,
  parseMatchModes,
  type FacetDisplayType,
  type FacetMatchMode,
} from "./filters";
import { getListFacetValueCatalog, getMetafieldMappings } from "./shop.server";

export type FilterOptionEditorMode = "add" | "edit";

export type FilterOptionSourceChoice = {
  value: string;
  label: string;
  defaultLabel: string;
  displayType: FacetDisplayType;
  displayTypeChoices: Array<{ value: FacetDisplayType; label: string }>;
  catalogValues: string[];
  showValues: boolean;
};

export type FilterOptionEditorData = {
  mode: FilterOptionEditorMode;
  treeId: string;
  optionKey: string;
  sourceLabel: string;
  sourceDisabled: boolean;
  sources: FilterOptionSourceChoice[];
  label: string;
  displayType: FacetDisplayType;
  displayTypeChoices: Array<{ value: FacetDisplayType; label: string }>;
  valueMode: FacetValueMode;
  prefix: string;
  removePrefix: boolean;
  selectedValues: string[];
  catalogValues: string[];
  showValues: boolean;
  shopDomain: string;
  urlHandle: string;
  collectionTree: boolean;
  valueSortMode: FacetValueSortMode;
  collapseByDefault: boolean;
  enableValueSearch: boolean;
  showMore: FacetShowMoreMode;
  textTransform: FacetTextTransform;
  autoRemovePrefixes: string;
  tooltip: string;
  matchMode: FacetMatchMode;
};

const FALLBACK_SHOP_DOMAIN = "findly-test-store.myshopify.com";

function editorExtras(
  key: string,
  label: string,
  setting: FacetSetting,
  matchMode: FacetMatchMode,
): Pick<
  FilterOptionEditorData,
  | "shopDomain"
  | "urlHandle"
  | "collectionTree"
  | "valueSortMode"
  | "collapseByDefault"
  | "enableValueSearch"
  | "showMore"
  | "textTransform"
  | "autoRemovePrefixes"
  | "tooltip"
  | "matchMode"
> {
  return {
    shopDomain: FALLBACK_SHOP_DOMAIN,
    urlHandle: setting.urlHandle || defaultUrlHandle(label, key),
    collectionTree: Boolean(setting.collectionTree),
    valueSortMode: setting.valueSortMode || "az",
    collapseByDefault: setting.collapseByDefault !== false,
    enableValueSearch: Boolean(setting.enableValueSearch),
    showMore: setting.showMore || "scrollbar",
    textTransform: setting.textTransform || "capitalize",
    autoRemovePrefixes: setting.autoRemovePrefixes || "",
    tooltip: setting.tooltip || "",
    matchMode,
  };
}

type MappedFacet = { key: string; label: string; filterType: string };

async function loadCatalogContext(shopId: string) {
  const valueCatalog = await getListFacetValueCatalog(shopId, "");
  const optionProducts = await prisma.productFacet.findMany({
    where: { shopId, status: "ACTIVE" },
    take: 500,
    select: { options: true },
  });
  const catalogOptions = catalogOptionRows(
    optionProducts.map((product) => ({
      options: (product.options as Record<string, string[]>) || {},
    })),
  );
  const mappedFacets: MappedFacet[] = mappedFacetsForAdmin(
    await getMetafieldMappings(shopId),
  );
  return { valueCatalog, catalogOptions, mappedFacets };
}

function displayOrderForConfig(
  config: {
    displayOrder: string[];
    enableSale?: boolean | null;
  },
  mappedFacets: MappedFacet[],
) {
  const mapped = withGloboAdminOptionKeys(
    withMappedFacetKeys(
      config.displayOrder,
      mappedFacets.map((facet) => facet.key),
    ),
  );
  const stored = Array.isArray(config.displayOrder) ? config.displayOrder : [];
  if (config.enableSale || stored.includes("sale") || stored.length === 0) {
    return mapped;
  }
  return mapped.filter((key) => key !== "sale");
}

function choiceLabels(choices: FacetDisplayType[]) {
  return choices.map((value) => ({
    value,
    label: FACET_DISPLAY_TYPE_LABELS[value],
  }));
}

function choicesForRow(row: FilterOptionRow) {
  return displayTypeChoicesForKey(row.key, row.filterType);
}

function sourceChoice(
  row: FilterOptionRow,
  displayTypes: Record<string, FacetDisplayType>,
  valueCatalog: Array<{ key: string; values: string[] }>,
): FilterOptionSourceChoice {
  const choices = choicesForRow(row);
  const stored = displayTypes[row.key];
  const displayType =
    stored && choices.includes(stored) ? stored : choices[0] || "checkbox";
  return {
    value: row.key,
    label:
      row.sourceKind === "option"
        ? `Option ${row.source}`
        : row.sourceKind === "metafield"
          ? `Metafield ${row.source}`
          : row.source,
    defaultLabel: row.label,
    displayType,
    displayTypeChoices: choiceLabels(choices),
    catalogValues: catalogValuesForKey(valueCatalog, row.key),
    showValues: facetSupportsValuePicker(row.key, row.filterType),
  };
}

function settingFor(
  settings: FacetSettingsMap,
  key: string,
): FacetSetting {
  return settings[key] || {};
}

export async function loadFilterOptionEditorPage(
  shopId: string,
  treeId: string,
  mode: FilterOptionEditorMode,
  optionKey?: string,
): Promise<FilterOptionEditorData | "not_found"> {
  const config = await getFilterTree(shopId, treeId);
  if (!config) return "not_found";

  const { valueCatalog, catalogOptions, mappedFacets } =
    await loadCatalogContext(shopId);
  const flags = enableFlagsFromConfig(config);
  const displayOrder = displayOrderForConfig(config, mappedFacets);
  const rows = applyFacetSettingLabels(
    buildVisibleFilterRows(displayOrder, flags, catalogOptions, mappedFacets),
    parseFacetSettings(
      config && "facetSettings" in config ? config.facetSettings : {},
    ),
  );
  const available = availableFilterOptions(
    rows.map((row) => row.key),
    flags,
    catalogOptions,
    mappedFacets,
  );
  const settings = parseFacetSettings(
    config && "facetSettings" in config ? config.facetSettings : {},
  );
  const displayTypes = parseDisplayTypes(
    config && "displayTypes" in config ? config.displayTypes : {},
  );
  const matchModes = parseMatchModes(
    config && "matchModes" in config ? config.matchModes : {},
  );

  if (mode === "add") {
    const sources = available.map((row) =>
      sourceChoice(row, displayTypes, valueCatalog),
    );
    const first = sources[0];
    const addKey = first?.value || "";
    const addLabel = first?.defaultLabel || "";
    return {
      mode,
      treeId,
      optionKey: addKey,
      sourceLabel: first?.label || "",
      sourceDisabled: false,
      sources,
      label: addLabel,
      displayType: first?.displayType || "checkbox",
      displayTypeChoices: first?.displayTypeChoices || choiceLabels(["checkbox"]),
      valueMode: "all",
      prefix: "",
      removePrefix: false,
      selectedValues: [],
      catalogValues: first?.catalogValues || [],
      showValues: first?.showValues || false,
      ...editorExtras(addKey, addLabel, {}, "or"),
    };
  }

  const key = optionKey || "";
  if (!key) return "not_found";
  const row = rows.find((item) => item.key === key);
  if (!row) return "not_found";
  const setting = settingFor(settings, key);
  const choice = sourceChoice(row, displayTypes, valueCatalog);
  const extras = (setting.selectedValues || []).filter(
    (value) => !choice.catalogValues.includes(value),
  );
  const label = setting.label || row.label;

  return {
    mode,
    treeId,
    optionKey: key,
    sourceLabel: row.source,
    sourceDisabled: true,
    sources: [choice],
    label,
    displayType: choice.displayType,
    displayTypeChoices: choice.displayTypeChoices,
    valueMode: setting.valueMode || "all",
    prefix: setting.prefix || "",
    removePrefix: Boolean(setting.removePrefix),
    selectedValues: setting.selectedValues || [],
    catalogValues: [...choice.catalogValues, ...extras],
    showValues: choice.showValues,
    ...editorExtras(
      key,
      label,
      setting,
      matchModes[key] === "and" ? "and" : "or",
    ),
  };
}

function parseBool(form: FormData, name: string, fallback = false) {
  const raw = form.get(name);
  if (raw === "true" || raw === "on") return true;
  if (raw === "false") return false;
  return fallback;
}

export function parseFilterOptionForm(form: FormData) {
  const valueModeRaw = String(form.get("valueMode") || "all");
  const valueMode: FacetValueMode =
    valueModeRaw === "manual" || valueModeRaw === "prefix" ? valueModeRaw : "all";
  let selectedValues: string[] = [];
  const selectedRaw = form.get("selectedValues");
  if (typeof selectedRaw === "string" && selectedRaw) {
    try {
      const parsed = JSON.parse(selectedRaw) as unknown;
      if (Array.isArray(parsed)) {
        selectedValues = parsed.filter(
          (item): item is string => typeof item === "string" && item.length > 0,
        );
      }
    } catch {
      selectedValues = [];
    }
  }
  const sortRaw = String(form.get("valueSortMode") || "az");
  const valueSortMode: FacetValueSortMode = (
    FACET_VALUE_SORT_MODES as readonly string[]
  ).includes(sortRaw)
    ? (sortRaw as FacetValueSortMode)
    : "az";
  const showMoreRaw = String(form.get("showMore") || "scrollbar");
  const showMore: FacetShowMoreMode = (
    FACET_SHOW_MORE_MODES as readonly string[]
  ).includes(showMoreRaw)
    ? (showMoreRaw as FacetShowMoreMode)
    : "scrollbar";
  const transformRaw = String(form.get("textTransform") || "capitalize");
  const textTransform: FacetTextTransform = (
    FACET_TEXT_TRANSFORMS as readonly string[]
  ).includes(transformRaw)
    ? (transformRaw as FacetTextTransform)
    : "capitalize";
  const matchRaw = String(form.get("matchMode") || "or");
  const matchMode: FacetMatchMode = matchRaw === "and" ? "and" : "or";
  const key = String(form.get("key") || "").trim();
  const label = String(form.get("label") || "").trim();
  const handleRaw = String(form.get("urlHandle") || "").trim();
  return {
    key,
    label,
    displayType: String(form.get("displayType") || "").trim(),
    valueMode,
    prefix: String(form.get("prefix") || ""),
    removePrefix:
      form.get("removePrefix") === "true" || form.get("removePrefix") === "on",
    selectedValues,
    urlHandle: handleRaw || defaultUrlHandle(label, key),
    collectionTree: parseBool(form, "collectionTree"),
    valueSortMode,
    collapseByDefault: parseBool(form, "collapseByDefault", true),
    enableValueSearch: parseBool(form, "enableValueSearch"),
    showMore,
    textTransform,
    autoRemovePrefixes: String(form.get("autoRemovePrefixes") || ""),
    tooltip: String(form.get("tooltip") || "").slice(0, 150),
    matchMode,
  };
}

function nextFacetSetting(
  existing: FacetSetting,
  input: ReturnType<typeof parseFilterOptionForm>,
  showValues: boolean,
): FacetSetting {
  const setting: FacetSetting = { ...existing };
  if (input.label) setting.label = input.label;
  else delete setting.label;
  setting.urlHandle = input.urlHandle;
  setting.collapseByDefault = input.collapseByDefault;
  setting.enableValueSearch = input.enableValueSearch;
  setting.showMore = input.showMore;
  setting.textTransform = input.textTransform;
  if (input.autoRemovePrefixes.trim()) {
    setting.autoRemovePrefixes = input.autoRemovePrefixes;
  } else {
    delete setting.autoRemovePrefixes;
  }
  if (input.tooltip.trim()) setting.tooltip = input.tooltip.slice(0, 150);
  else delete setting.tooltip;
  if (input.key === "collection") {
    setting.collectionTree = input.collectionTree;
  } else {
    delete setting.collectionTree;
  }
  const persistValues = showValues || input.key === "collection";
  if (!persistValues) {
    delete setting.valueMode;
    delete setting.prefix;
    delete setting.removePrefix;
    delete setting.selectedValues;
    delete setting.valueSortMode;
    return setting;
  }
  setting.valueSortMode = input.valueSortMode;
  setting.valueMode = input.valueMode;
  if (!showValues) {
    delete setting.prefix;
    delete setting.removePrefix;
    delete setting.selectedValues;
    return setting;
  }
  if (input.valueMode === "prefix") {
    setting.prefix = input.prefix;
    setting.removePrefix = input.removePrefix;
    delete setting.selectedValues;
  } else if (input.valueMode === "manual") {
    setting.selectedValues = input.selectedValues.slice(0, 500);
    delete setting.prefix;
    delete setting.removePrefix;
  } else {
    delete setting.prefix;
    delete setting.removePrefix;
    delete setting.selectedValues;
  }
  return setting;
}

export async function saveFilterOption(
  shopId: string,
  treeId: string,
  mode: FilterOptionEditorMode,
  form: FormData,
) {
  const config = await getFilterTree(shopId, treeId);
  if (!config) return { error: "Filter tree not found." };

  const input = parseFilterOptionForm(form);
  if (!input.key) return { error: "Choose a source." };

  const { catalogOptions, mappedFacets } = await loadCatalogContext(shopId);
  const flags = enableFlagsFromConfig(config);
  const displayOrder = displayOrderForConfig(config, mappedFacets);
  const rows = buildVisibleFilterRows(
    displayOrder,
    flags,
    catalogOptions,
    mappedFacets,
  );
  const available = availableFilterOptions(
    rows.map((row) => row.key),
    flags,
    catalogOptions,
    mappedFacets,
  );

  const row =
    mode === "add"
      ? available.find((item) => item.key === input.key)
      : rows.find((item) => item.key === input.key) ||
        resolveFilterOptionRow(input.key, catalogOptions, mappedFacets);
  if (!row) {
    return {
      error:
        mode === "add"
          ? "That source is already on this filter, or is not available."
          : "That filter option was not found.",
    };
  }

  let nextFlags = flags;
  let nextVisible = rows.map((item) => item.key);
  if (mode === "add") {
    const added = addFilterOptionKeys(row, nextVisible, flags);
    nextFlags = added.flags;
    nextVisible = added.visibleKeys;
  }

  const rawFacetSettings =
    config && "facetSettings" in config ? config.facetSettings : {};
  const settings = parseFacetSettings(rawFacetSettings);
  const showValues = facetSupportsValuePicker(row.key, row.filterType);
  settings[row.key] = nextFacetSetting(settings[row.key] || {}, input, showValues);

  const displayTypes = parseDisplayTypes(
    config && "displayTypes" in config ? config.displayTypes : {},
  );
  const allowed = choicesForRow(row);
  const nextType = allowed.includes(input.displayType as FacetDisplayType)
    ? (input.displayType as FacetDisplayType)
    : allowed[0];
  if (nextType) displayTypes[row.key] = nextType;

  const matchModes = parseMatchModes(
    config && "matchModes" in config ? config.matchModes : {},
  );
  matchModes[row.key] = input.matchMode;

  await updateFilterTree(shopId, treeId, {
    ...nextFlags,
    displayOrder: persistDisplayOrder(nextVisible, displayOrder),
    displayTypes: displayTypes as Prisma.InputJsonValue,
    matchModes: matchModes as Prisma.InputJsonValue,
    facetSettings: facetSettingsWithTreeMeta(
      settings,
      rawFacetSettings,
    ) as Prisma.InputJsonValue,
  });

  return { ok: true as const };
}

export async function deleteFilterOption(
  shopId: string,
  treeId: string,
  key: string,
) {
  const config = await getFilterTree(shopId, treeId);
  if (!config) return { error: "Filter tree not found." };
  if (!key) return { error: "Filter option required." };

  const { catalogOptions, mappedFacets } = await loadCatalogContext(shopId);
  const flags = enableFlagsFromConfig(config);
  const displayOrder = displayOrderForConfig(config, mappedFacets);
  const rows = buildVisibleFilterRows(
    displayOrder,
    flags,
    catalogOptions,
    mappedFacets,
  );
  const removed = removeFilterOptionKeys(
    key,
    rows.map((row) => row.key),
    flags,
  );
  const rawFacetSettings =
    config && "facetSettings" in config ? config.facetSettings : {};
  const settings = parseFacetSettings(rawFacetSettings);
  delete settings[key];
  const displayTypes = parseDisplayTypes(
    config && "displayTypes" in config ? config.displayTypes : {},
  );
  delete displayTypes[key];

  await updateFilterTree(shopId, treeId, {
    ...removed.flags,
    displayOrder: persistDisplayOrder(removed.visibleKeys, displayOrder),
    displayTypes: displayTypes as Prisma.InputJsonValue,
    facetSettings: facetSettingsWithTreeMeta(
      settings,
      rawFacetSettings,
    ) as Prisma.InputJsonValue,
  });

  return { ok: true as const };
}
