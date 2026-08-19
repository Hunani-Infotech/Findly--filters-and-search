import prisma from "./db.server";
import { optionKeyFromName } from "./filter-catalog";
import { hexFromColorName, isSwatchFilled } from "./color-autofill";

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

export async function listColorOptionKeys(shopId: string) {
  const products = await prisma.productFacet.findMany({
    where: { shopId, status: "ACTIVE" },
    select: { options: true },
    take: 2000,
  });
  const keys = new Map<string, { optionKey: string; label: string; values: Set<string> }>();
  for (const product of products) {
    const options =
      product.options && typeof product.options === "object"
        ? (product.options as Record<string, string[]>)
        : {};
    for (const [name, list] of Object.entries(options)) {
      if (!/colou?r|hue|shade|finish|tone/i.test(name) && keys.size) {
        // still include every option so merchants can swatch Size if they want? Globo shows "color". Include all option names.
      }
      const optionKey = optionKeyFromName(name);
      const entry = keys.get(optionKey) ?? {
        optionKey,
        label: name,
        values: new Set<string>(),
      };
      entry.label = name;
      for (const value of list ?? []) entry.values.add(String(value));
      keys.set(optionKey, entry);
    }
  }
  const saved = await prisma.colorSwatch.findMany({ where: { shopId } });
  return [...keys.values()]
    .sort((a, b) => a.label.localeCompare(b.label))
    .map((entry) => {
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
        valueCount: entry.values.size,
        missing,
      };
    });
}

export async function listSwatchesForOption(shopId: string, optionKey: string) {
  const products = await prisma.productFacet.findMany({
    where: { shopId, status: "ACTIVE" },
    select: { options: true },
    take: 2000,
  });
  const values = new Set<string>();
  let label = optionKey;
  for (const product of products) {
    const options =
      product.options && typeof product.options === "object"
        ? (product.options as Record<string, string[]>)
        : {};
    for (const [name, list] of Object.entries(options)) {
      if (optionKeyFromName(name) !== optionKey) continue;
      label = name;
      for (const value of list ?? []) values.add(String(value));
    }
  }
  const saved = await prisma.colorSwatch.findMany({
    where: { shopId, optionKey },
  });
  const byValue = new Map(saved.map((row) => [row.value, row]));
  const rows: SwatchRow[] = [...values].sort((a, b) => a.localeCompare(b)).map((value) => {
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
  return { label, rows };
}

export async function upsertSwatch(shopId: string, input: SwatchRow) {
  const kind = parseKind(input.kind);
  return prisma.colorSwatch.upsert({
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
      imageUrl: input.imageUrl.trim().slice(0, 500),
    },
    update: {
      kind,
      color1: input.color1.trim().slice(0, 32),
      color2: input.color2.trim().slice(0, 32),
      imageUrl: input.imageUrl.trim().slice(0, 500),
    },
  });
}

export async function clearSwatch(shopId: string, optionKey: string, value: string) {
  await prisma.colorSwatch.deleteMany({ where: { shopId, optionKey, value } });
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
