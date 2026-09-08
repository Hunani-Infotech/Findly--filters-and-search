export function csvCell(value: unknown) {
  const raw = formatCsvValue(value);
  if (/[",\n\r]/.test(raw)) return `"${raw.replace(/"/g, '""')}"`;
  return raw;
}

export function recordsToCsv(
  rows: Array<Record<string, unknown>>,
  headers?: string[],
) {
  const keys =
    headers && headers.length
      ? headers
      : uniqueKeys(rows);
  const lines = [keys.map(csvCell).join(",")];
  for (const row of rows) {
    lines.push(keys.map((key) => csvCell(row[key])).join(","));
  }
  return lines.join("\n");
}

export function parseCsv(text: string): string[][] {
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

export function csvToRecords(text: string): Record<string, string>[] {
  const table = parseCsv(text);
  if (table.length < 2) return [];
  const header = table[0]!.map((cell) => cell.trim());
  return table.slice(1).map((cells) => {
    const row: Record<string, string> = {};
    header.forEach((key, index) => {
      if (!key) return;
      row[key] = cells[index] ?? "";
    });
    return row;
  });
}

export function parseJsonOrCsvRecords(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return JSON.parse(trimmed);
  }
  return csvToRecords(trimmed);
}

export function parseCsvList(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (Array.isArray(parsed)) return parsed.map((item) => String(item));
    } catch {
      /* pipe-separated fallback */
    }
  }
  return trimmed
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function downloadCsv(filename: string, csv: string) {
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

function formatCsvValue(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    const simple = value.every(
      (item) =>
        typeof item === "string" ||
        typeof item === "number" ||
        typeof item === "boolean",
    );
    if (simple) return value.map(String).join("|");
    return JSON.stringify(value);
  }
  return JSON.stringify(value);
}

function uniqueKeys(rows: Array<Record<string, unknown>>) {
  const keys: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (seen.has(key)) continue;
      seen.add(key);
      keys.push(key);
    }
  }
  return keys;
}
