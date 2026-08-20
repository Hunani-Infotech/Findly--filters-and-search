export const FACET_VALUE_MODES = ["all", "manual", "prefix"] as const;
export type FacetValueMode = (typeof FACET_VALUE_MODES)[number];

export type FacetSetting = {
  label?: string;
  valueMode?: FacetValueMode;
  prefix?: string;
  removePrefix?: boolean;
  selectedValues?: string[];
};

export type FacetSettingsMap = Record<string, FacetSetting>;

export function parseFacetSettings(raw: unknown): FacetSettingsMap {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: FacetSettingsMap = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!key || !value || typeof value !== "object" || Array.isArray(value)) continue;
    const rec = value as Record<string, unknown>;
    const setting: FacetSetting = {};
    if (typeof rec.label === "string" && rec.label.trim()) {
      setting.label = rec.label.trim();
    }
    if (rec.valueMode === "all" || rec.valueMode === "manual" || rec.valueMode === "prefix") {
      setting.valueMode = rec.valueMode;
    }
    if (typeof rec.prefix === "string") setting.prefix = rec.prefix;
    if (typeof rec.removePrefix === "boolean") setting.removePrefix = rec.removePrefix;
    if (Array.isArray(rec.selectedValues)) {
      setting.selectedValues = rec.selectedValues
        .filter((item): item is string => typeof item === "string" && item.length > 0)
        .slice(0, 500);
    }
    if (Object.keys(setting).length) out[key] = setting;
  }
  return out;
}

export function facetSettingFor(map: FacetSettingsMap, key: string): FacetSetting {
  return map[key] || {};
}

export function applyFacetValueFilter(
  key: string,
  values: string[],
  settings: FacetSettingsMap,
): string[] {
  const setting = settings[key] || {};
  const mode = setting.valueMode || "all";
  if (mode === "manual") {
    const allowed = new Set(setting.selectedValues || []);
    if (!allowed.size) return values;
    return values.filter((value) => allowed.has(value));
  }
  if (mode === "prefix") {
    const prefix = setting.prefix || "";
    if (!prefix) return values;
    return values.filter((value) => value.startsWith(prefix));
  }
  return values;
}

export function applyFacetValueLabel(
  key: string,
  value: string,
  settings: FacetSettingsMap,
): string {
  const setting = settings[key] || {};
  if (setting.removePrefix && setting.prefix && value.startsWith(setting.prefix)) {
    return value.slice(setting.prefix.length);
  }
  return value;
}
