export type YmmValueMode = "all" | "prefix" | "manual";

export type YmmField = {
  id: string;
  label: string;
  valueMode: YmmValueMode;
  prefix: string;
  removePrefix: boolean;
  manualValues: string[];
};

export type YmmFitmentRow = {
  handle: string;
  values: string[];
};

export type VehicleFinderAdmin = {
  enabled: boolean;
  heading: string;
  showSearch: boolean;
  radius: number;
  bg: string;
  headingColor: string;
  labelColor: string;
  borderColor: string;
  selectBg: string;
  btnText: string;
  btnBg: string;
  metafieldPath: string;
  fields: YmmField[];
  rows: YmmFitmentRow[];
  fileName: string;
};

export const DEFAULT_YMM_FIELDS: YmmField[] = [
  {
    id: "year",
    label: "Year",
    valueMode: "all",
    prefix: "",
    removePrefix: false,
    manualValues: [],
  },
  {
    id: "make",
    label: "Make",
    valueMode: "all",
    prefix: "",
    removePrefix: false,
    manualValues: [],
  },
  {
    id: "model",
    label: "Model",
    valueMode: "all",
    prefix: "",
    removePrefix: false,
    manualValues: [],
  },
];

export const DEFAULT_YMM: VehicleFinderAdmin = {
  enabled: false,
  heading: "Search products",
  showSearch: true,
  radius: 0,
  bg: "#ffffff",
  headingColor: "#000000",
  labelColor: "#6d7175",
  borderColor: "#c9cccf",
  selectBg: "#ffffff",
  btnText: "#ffffff",
  btnBg: "#000000",
  metafieldPath: "custom.vehicle_fitment",
  fields: DEFAULT_YMM_FIELDS,
  rows: [],
  fileName: "",
};

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
}

function parseValueMode(raw: unknown): YmmValueMode {
  if (raw === "prefix" || raw === "manual" || raw === "all") return raw;
  return "all";
}

function parseField(raw: unknown, index: number): YmmField | null {
  const o = asRecord(raw);
  const label = typeof o.label === "string" && o.label.trim() ? o.label.trim() : "";
  if (!label && typeof o.id !== "string") return null;
  const manualValues = Array.isArray(o.manualValues)
    ? o.manualValues.filter((item): item is string => typeof item === "string" && Boolean(item.trim()))
        .map((item) => item.trim())
    : typeof o.manualValues === "string"
      ? o.manualValues
          .split(/[\n,]+/)
          .map((item) => item.trim())
          .filter(Boolean)
      : [];
  return {
    id:
      typeof o.id === "string" && o.id.trim()
        ? o.id.trim().slice(0, 40)
        : `field_${index + 1}`,
    label: label || `Field ${index + 1}`,
    valueMode: parseValueMode(o.valueMode),
    prefix: typeof o.prefix === "string" ? o.prefix : "",
    removePrefix: o.removePrefix === true,
    manualValues,
  };
}

function parseRows(raw: unknown): YmmFitmentRow[] {
  if (!Array.isArray(raw)) return [];
  const rows: YmmFitmentRow[] = [];
  for (const item of raw) {
    const o = asRecord(item);
    const handle =
      typeof o.handle === "string"
        ? o.handle.trim().toLowerCase().replace(/^\/?(products\/)?/, "")
        : "";
    const values = Array.isArray(o.values)
      ? o.values.map((part) => String(part).trim()).filter(Boolean)
      : [];
    if (!handle || !values.length) continue;
    rows.push({ handle, values });
  }
  return rows.slice(0, 20000);
}

export function parseVehicleFinderAdmin(raw: unknown): VehicleFinderAdmin {
  const o = asRecord(raw);
  const radiusRaw = o.radius;
  const radius =
    typeof radiusRaw === "number"
      ? radiusRaw
      : typeof radiusRaw === "string"
        ? Number(radiusRaw)
        : DEFAULT_YMM.radius;
  const fieldsRaw = Array.isArray(o.fields) ? o.fields : [];
  const fields = fieldsRaw
    .map((item, index) => parseField(item, index))
    .filter((item): item is YmmField => Boolean(item));
  return {
    enabled: o.enabled === true,
    heading: typeof o.heading === "string" ? o.heading : DEFAULT_YMM.heading,
    showSearch: o.showSearch !== false,
    radius: Number.isFinite(radius) ? Math.max(0, Math.min(40, radius)) : 0,
    bg: typeof o.bg === "string" ? o.bg : DEFAULT_YMM.bg,
    headingColor:
      typeof o.headingColor === "string" ? o.headingColor : DEFAULT_YMM.headingColor,
    labelColor: typeof o.labelColor === "string" ? o.labelColor : DEFAULT_YMM.labelColor,
    borderColor:
      typeof o.borderColor === "string" ? o.borderColor : DEFAULT_YMM.borderColor,
    selectBg: typeof o.selectBg === "string" ? o.selectBg : DEFAULT_YMM.selectBg,
    btnText: typeof o.btnText === "string" ? o.btnText : DEFAULT_YMM.btnText,
    btnBg: typeof o.btnBg === "string" ? o.btnBg : DEFAULT_YMM.btnBg,
    metafieldPath:
      typeof o.metafieldPath === "string" && o.metafieldPath.trim()
        ? o.metafieldPath.trim()
        : DEFAULT_YMM.metafieldPath,
    fields: fields.length ? fields.slice(0, 8) : DEFAULT_YMM_FIELDS,
    rows: parseRows(o.rows),
    fileName: typeof o.fileName === "string" ? o.fileName : "",
  };
}

/** Split metafield / CSV cells like 2020|Toyota|Camry into tokens. */
export function parseFitmentLine(raw: string): string[] {
  return raw
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean);
}

export function parseFitmentBag(raw: unknown): string[][] {
  if (raw == null || raw === "") return [];
  if (Array.isArray(raw)) {
    return raw.flatMap((item) => parseFitmentBag(item));
  }
  if (typeof raw !== "string") return parseFitmentBag(String(raw));
  const trimmed = raw.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith("[")) {
    try {
      return parseFitmentBag(JSON.parse(trimmed));
    } catch {
      // fall through
    }
  }
  return trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(parseFitmentLine)
    .filter((parts) => parts.length > 0);
}

export function parseYmmCsv(csv: string): YmmFitmentRow[] {
  const lines = csv
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];
  const split = (line: string) => {
    const cells: string[] = [];
    let current = "";
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (quoted && line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          quoted = !quoted;
        }
        continue;
      }
      if (ch === "," && !quoted) {
        cells.push(current.trim());
        current = "";
        continue;
      }
      current += ch;
    }
    cells.push(current.trim());
    return cells;
  };
  const header = split(lines[0]!).map((cell) => cell.toLowerCase());
  const handleIdx = header.findIndex((cell) =>
    /handle|product/.test(cell),
  );
  const valueIdxs = header
    .map((cell, index) => ({ cell, index }))
    .filter(({ cell, index }) => index !== handleIdx && !/^section$/.test(cell))
    .map(({ index }) => index);
  const rows: YmmFitmentRow[] = [];
  for (const line of lines.slice(1)) {
    const cells = split(line);
    const handleRaw = handleIdx >= 0 ? cells[handleIdx] ?? "" : cells.at(-1) ?? "";
    const handle = handleRaw.trim().toLowerCase().replace(/^\/?(products\/)?/, "");
    if (!handle) continue;
    const values =
      valueIdxs.length > 0
        ? valueIdxs.map((index) => (cells[index] ?? "").trim()).filter(Boolean)
        : parseFitmentLine(cells[0] ?? "");
    if (!values.length) continue;
    rows.push({ handle, values });
  }
  return rows;
}

export type YmmOption = { value: string; label: string };

export function displayValue(field: YmmField, raw: string): { value: string; label: string } {
  const value = raw.trim();
  if (!value) return { value: "", label: "" };
  if (field.removePrefix && field.prefix && value.toLowerCase().startsWith(field.prefix.toLowerCase())) {
    return { value, label: value.slice(field.prefix.length) || value };
  }
  return { value, label: value };
}

export function fieldAllowsValue(field: YmmField, raw: string): boolean {
  const value = raw.trim();
  if (!value) return false;
  if (field.valueMode === "prefix") {
    const prefix = field.prefix.trim();
    if (!prefix) return true;
    return value.toLowerCase().startsWith(prefix.toLowerCase());
  }
  if (field.valueMode === "manual") {
    if (!field.manualValues.length) return false;
    return field.manualValues.some((item) => item.toLowerCase() === value.toLowerCase());
  }
  return true;
}

export function cascadeOptions(
  fields: YmmField[],
  fitments: Array<{ values: string[] }>,
  selected: string[],
): YmmOption[] {
  const level = selected.length;
  const field = fields[level];
  if (!field) return [];
  const seen = new Map<string, YmmOption>();
  for (const row of fitments) {
    let ok = true;
    for (let i = 0; i < level; i++) {
      const want = selected[i] ?? "";
      if (!want) continue;
      if (String(row.values[i] ?? "").toLowerCase() !== want.toLowerCase()) {
        ok = false;
        break;
      }
    }
    if (!ok) continue;
    const raw = String(row.values[level] ?? "").trim();
    if (!fieldAllowsValue(field, raw)) continue;
    const shown = displayValue(field, raw);
    if (!shown.value || seen.has(shown.value.toLowerCase())) continue;
    seen.set(shown.value.toLowerCase(), shown);
  }
  return [...seen.values()].sort((a, b) =>
    a.label.localeCompare(b.label, undefined, { numeric: true }),
  );
}

export function fitmentMatches(values: string[], selected: string[]): boolean {
  for (let i = 0; i < selected.length; i++) {
    const want = selected[i]?.trim() ?? "";
    if (!want) continue;
    if (String(values[i] ?? "").toLowerCase() !== want.toLowerCase()) return false;
  }
  return selected.some((item) => Boolean(item && item.trim()));
}

export function uniqueHandles(
  fitments: Array<{ handle: string; values: string[] }>,
  selected: string[],
): string[] {
  const handles: string[] = [];
  const seen = new Set<string>();
  for (const row of fitments) {
    if (!fitmentMatches(row.values, selected)) continue;
    const handle = row.handle.toLowerCase();
    if (seen.has(handle)) continue;
    seen.add(handle);
    handles.push(handle);
  }
  return handles;
}
