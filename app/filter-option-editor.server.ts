import type { Prisma } from "@prisma/client";
import prisma from "./db.server";
import {
  parseFacetSettings,
  type FacetSetting,
  type FacetSettingsMap,
  type FacetValueMode,
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
  metafieldFacetKey,
  parseDisplayTypes,
  withMappedFacetKeys,
} from "./filters.server";
import {
  displayTypeChoicesForKey,
  FACET_DISPLAY_TYPE_LABELS,
  type FacetDisplayType,
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
};

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
  const mappedFacets: MappedFacet[] = (await getMetafieldMappings(shopId))
    .filter((mapping) => mapping.enabled)
    .map((mapping) => ({
      key: metafieldFacetKey(
        mapping.namespace,
        mapping.key,
        mapping.ownerType === "VARIANT" ? "VARIANT" : "PRODUCT",
      ),
      label: mapping.displayLabel || mapping.key,
      filterType: mapping.filterType,
    }));
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

  if (mode === "add") {
    const sources = available.map((row) =>
      sourceChoice(row, displayTypes, valueCatalog),
    );
    const first = sources[0];
    return {
      mode,
      treeId,
      optionKey: first?.value || "",
      sourceLabel: first?.label || "",
      sourceDisabled: false,
      sources,
      label: first?.defaultLabel || "",
      displayType: first?.displayType || "checkbox",
      displayTypeChoices: first?.displayTypeChoices || choiceLabels(["checkbox"]),
      valueMode: "all",
      prefix: "",
      removePrefix: false,
      selectedValues: [],
      catalogValues: first?.catalogValues || [],
      showValues: first?.showValues || false,
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

  return {
    mode,
    treeId,
    optionKey: key,
    sourceLabel: row.source,
    sourceDisabled: true,
    sources: [choice],
    label: setting.label || row.label,
    displayType: choice.displayType,
    displayTypeChoices: choice.displayTypeChoices,
    valueMode: setting.valueMode || "all",
    prefix: setting.prefix || "",
    removePrefix: Boolean(setting.removePrefix),
    selectedValues: setting.selectedValues || [],
    catalogValues: [...choice.catalogValues, ...extras],
    showValues: choice.showValues,
  };
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
  return {
    key: String(form.get("key") || "").trim(),
    label: String(form.get("label") || "").trim(),
    displayType: String(form.get("displayType") || "").trim(),
    valueMode,
    prefix: String(form.get("prefix") || ""),
    removePrefix:
      form.get("removePrefix") === "true" || form.get("removePrefix") === "on",
    selectedValues,
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
  if (!showValues) {
    delete setting.valueMode;
    delete setting.prefix;
    delete setting.removePrefix;
    delete setting.selectedValues;
    return setting;
  }
  setting.valueMode = input.valueMode;
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

  const settings = parseFacetSettings(
    config && "facetSettings" in config ? config.facetSettings : {},
  );
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

  await updateFilterTree(shopId, treeId, {
    ...nextFlags,
    displayOrder: persistDisplayOrder(nextVisible, displayOrder),
    displayTypes: displayTypes as Prisma.InputJsonValue,
    facetSettings: settings as Prisma.InputJsonValue,
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
  const settings = parseFacetSettings(
    config && "facetSettings" in config ? config.facetSettings : {},
  );
  delete settings[key];
  const displayTypes = parseDisplayTypes(
    config && "displayTypes" in config ? config.displayTypes : {},
  );
  delete displayTypes[key];

  await updateFilterTree(shopId, treeId, {
    ...removed.flags,
    displayOrder: persistDisplayOrder(removed.visibleKeys, displayOrder),
    displayTypes: displayTypes as Prisma.InputJsonValue,
    facetSettings: settings as Prisma.InputJsonValue,
  });

  return { ok: true as const };
}
