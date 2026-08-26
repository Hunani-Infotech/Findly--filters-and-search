import prisma from "./db.server";
import { ADMIN_TABLE_PAGE_SIZE, slicePage } from "./admin-list-page";
import { optionKeyFromName } from "./filter-catalog";
import { hexFromColorName, isSwatchFilled } from "./color-autofill";
import { SAMPLE_TEXT_MAX } from "./limits";
import { createTtlCache } from "./read-cache.server";

export type SwatchKind = "solid" | "dual" | "image";

export type SwatchRow = {
  optionKey: string;
  value: string;
  kind: SwatchKind;
  color1: string;
  color2: string;
  imageUrl: string;
};

function parseKind(value: unknown): SwatchKind {
  return value === "dual" || value === "image" ? value : "solid";
}

function isColorOptionName(name: string) {
  return /colou?r|hue|shade|finish|tone/i.test(String(name || "").trim());
}

type ColorOptionEntry = {
  optionKey: string;
  label: string;
  values: string[];
};

type SavedSwatch = {
  optionKey: string;
  value: string;
  kind: string;
  color1: string;
  color2: string;
  imageUrl: string;
};

const colorOptionsCache = createTtlCache<ColorOptionEntry[]>(30_000);
const swatchMapCache = createTtlCache<
  Record<string, Record<string, SwatchRow>>
>(30_000);

async function collectColorOptions(shopId: string): Promise<ColorOptionEntry[]> {
  return colorOptionsCache.wrap(shopId, () => loadColorOptions(shopId));
}

async function loadColorOptions(shopId: string): Promise<ColorOptionEntry[]> {
  const products = await prisma.productFacet.findMany({
    where: { shopId, status: "ACTIVE" },
    select: { options: true },
    take: 200,
  });
  const keys = new Map<string, { optionKey: string; label: string; values: Set<string> }>();
  for (const product of products) {
    const options =
      product.options && typeof product.options === "object"
        ? (product.options as Record<string, string[]>)
        : {};
    for (const [name, list] of Object.entries(options)) {
      if (!isColorOptionName(name)) continue;
      const optionKey = optionKeyFromName(name);
      const entry = keys.get(optionKey) ?? {
        optionKey,
        label: name,
        values: new Set<string>(),
      };
      entry.label = name;
      for (const value of list ?? []) {
        const trimmed = String(value).trim();
        if (trimmed) entry.values.add(trimmed);
      }
      keys.set(optionKey, entry);
    }
  }
  return [...keys.values()]
    .sort((a, b) => a.label.localeCompare(b.label))
    .map((entry) => ({
      optionKey: entry.optionKey,
      label: entry.label,
      values: [...entry.values].sort((a, b) => a.localeCompare(b)),
    }));
}

function rowsForOption(
  optionKey: string,
  values: string[],
  saved: SavedSwatch[],
): SwatchRow[] {
  const byValue = new Map(saved.map((row) => [row.value, row]));
  return values.map((value) => {
    const row = byValue.get(value);
    return {
      optionKey,
      value,
      kind: parseKind(row?.kind),
      color1: row?.color1 ?? "",
      color2: row?.color2 ?? "",
      imageUrl: row?.imageUrl ?? "",
    };
  });
}

function optionSummaries(
  catalog: ColorOptionEntry[],
  saved: SavedSwatch[],
) {
  return catalog.map((entry) => {
    const rows = saved.filter((row) => row.optionKey === entry.optionKey);
    const byValue = new Map(rows.map((row) => [row.value, row]));
    let missing = 0;
    for (const value of entry.values) {
      const row = byValue.get(value);
      if (!row || !isSwatchFilled(row)) missing += 1;
    }
    return {
      optionKey: entry.optionKey,
      label: entry.label,
      valueCount: entry.values.length,
      missing,
    };
  });
}

export async function listColorOptionKeys(shopId: string) {
  const [catalog, saved] = await Promise.all([
    collectColorOptions(shopId),
    prisma.colorSwatch.findMany({ where: { shopId } }),
  ]);
  return optionSummaries(catalog, saved);
}

export async function listSwatchesForOption(shopId: string, optionKey: string) {
  const [catalog, saved] = await Promise.all([
    collectColorOptions(shopId),
    prisma.colorSwatch.findMany({ where: { shopId, optionKey } }),
  ]);
  const entry = catalog.find((item) => item.optionKey === optionKey);
  return {
    label: entry?.label || optionKey,
    rows: rowsForOption(optionKey, entry?.values || [], saved),
  };
}

export type SwatchListStatus = "all" | "missing";

export type SwatchListQuery = {
  page?: number;
  query?: string;
  status?: SwatchListStatus;
  pageSize?: number;
};

function filterSwatchRows(
  rows: SwatchRow[],
  query: string,
  status: SwatchListStatus,
) {
  const needle = query.trim().toLowerCase();
  return rows.filter((row) => {
    if (needle && !row.value.toLowerCase().includes(needle)) return false;
    if (status === "missing" && isSwatchFilled(row)) return false;
    return true;
  });
}

/** One product scan; returns only the current page of values for the client. */
export async function loadSwatchesAdmin(
  shopId: string,
  requestedOption: string,
  input: SwatchListQuery = {},
) {
  const [catalog, saved] = await Promise.all([
    collectColorOptions(shopId),
    prisma.colorSwatch.findMany({ where: { shopId } }),
  ]);
  const options = optionSummaries(catalog, saved);
  const optionKey =
    requestedOption && options.some((option) => option.optionKey === requestedOption)
      ? requestedOption
      : options[0]?.optionKey || "";
  const entry = catalog.find((item) => item.optionKey === optionKey);
  const optionSaved = saved.filter((row) => row.optionKey === optionKey);
  const allRows = rowsForOption(optionKey, entry?.values || [], optionSaved);
  const query = String(input.query || "");
  const status: SwatchListStatus = input.status === "missing" ? "missing" : "all";
  const filtered = filterSwatchRows(allRows, query, status);
  const slice = slicePage(
    filtered,
    input.page ?? 0,
    input.pageSize ?? ADMIN_TABLE_PAGE_SIZE,
  );
  return {
    optionKey,
    label: entry?.label || optionKey,
    options,
    rows: slice.paged,
    total: slice.total,
    page: slice.safePage,
    pageCount: slice.pageCount,
    showingFrom: slice.showingFrom,
    showingTo: slice.showingTo,
    query,
    status,
  };
}

export async function upsertSwatch(shopId: string, input: SwatchRow) {
  const kind = parseKind(input.kind);
  const row = await prisma.colorSwatch.upsert({
    where: {
      shopId_optionKey_value: {
        shopId,
        optionKey: input.optionKey,
        value: input.value,
      },
    },
    create: {
      shopId,
      optionKey: input.optionKey,
      value: input.value,
      kind,
      color1: input.color1.trim().slice(0, 32),
      color2: input.color2.trim().slice(0, 32),
      imageUrl: input.imageUrl.trim().slice(0, SAMPLE_TEXT_MAX),
    },
    update: {
      kind,
      color1: input.color1.trim().slice(0, 32),
      color2: input.color2.trim().slice(0, 32),
      imageUrl: input.imageUrl.trim().slice(0, SAMPLE_TEXT_MAX),
    },
  });
  swatchMapCache.del(shopId);
  return row;
}

export async function clearSwatch(shopId: string, optionKey: string, value: string) {
  await prisma.colorSwatch.deleteMany({ where: { shopId, optionKey, value } });
  swatchMapCache.del(shopId);
}

export async function autofillMissingSwatches(shopId: string, optionKey: string) {
  const { rows } = await listSwatchesForOption(shopId, optionKey);
  let filled = 0;
  for (const row of rows) {
    if (isSwatchFilled(row)) continue;
    const hex = hexFromColorName(row.value);
    if (!hex) continue;
    await upsertSwatch(shopId, {
      ...row,
      kind: "solid",
      color1: hex,
      color2: "",
      imageUrl: "",
    });
    filled += 1;
  }
  return { filled };
}

export async function swatchMapForShop(shopId: string) {
  return swatchMapCache.wrap(shopId, async () => {
    const rows = await prisma.colorSwatch.findMany({ where: { shopId } });
    const map: Record<string, Record<string, SwatchRow>> = {};
    for (const row of rows) {
      if (!map[row.optionKey]) map[row.optionKey] = {};
      map[row.optionKey][row.value] = {
        optionKey: row.optionKey,
        value: row.value,
        kind: parseKind(row.kind),
        color1: row.color1,
        color2: row.color2,
        imageUrl: row.imageUrl,
      };
    }
    return map;
  });
}

export async function importSwatches(
  shopId: string,
  payload: unknown,
  optionKey?: string,
) {
  const rows = Array.isArray(payload)
    ? payload
    : payload &&
        typeof payload === "object" &&
        Array.isArray((payload as { rows?: unknown }).rows)
      ? (payload as { rows: unknown[] }).rows
      : null;
  if (!rows) return { error: "JSON must be an array of swatches." as const };
  let imported = 0;
  for (const item of rows) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const value = String(row.value || "").trim();
    const key = String(row.optionKey || optionKey || "").trim();
    if (!value || !key) continue;
    await upsertSwatch(shopId, {
      optionKey: key,
      value,
      kind: parseKind(row.kind),
      color1: String(row.color1 || ""),
      color2: String(row.color2 || ""),
      imageUrl: String(row.imageUrl || ""),
    });
    imported += 1;
  }
  return { ok: true as const, imported };
}
