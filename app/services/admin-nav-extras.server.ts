import type { Prisma } from "@prisma/client";
import prisma from "../db.server";
import { createTtlCache } from "../lib/read-cache.server";
import {
  parseWidgetI18nMap,
  type WidgetI18nMap,
} from "../utils/widget-i18n";
import type { VehicleFinderAdmin } from "../types/vehicle-finder";
import { DEFAULT_YMM, parseVehicleFinderAdmin } from "../utils/vehicle-finder";
import type { RecsConfig } from "../types/recommendations";
import { DEFAULT_RECS, parseRecsConfig } from "../utils/recommendations";

export type { VehicleFinderAdmin };

export type AdminLocaleRow = {
  code: string;
  name: string;
  complete: boolean;
  isDefault: boolean;
};

export type ContactDraft = {
  email: string;
  collaboratorCode: string;
  subject: string;
  message: string;
};

export type TranslationCustomField = {
  id: string;
  reference: string;
};

export type AdminNavExtras = {
  recOn: Record<string, boolean>;
  recs: RecsConfig;
  ymm: VehicleFinderAdmin;
  langs: AdminLocaleRow[];
  i18n: WidgetI18nMap;
  translationCustom?: Record<string, TranslationCustomField[]>;
  contactDraft?: ContactDraft;
};

const DEFAULT_ADMIN_EXTRAS: AdminNavExtras = {
  recOn: {},
  recs: DEFAULT_RECS,
  ymm: DEFAULT_YMM,
  langs: [{ code: "en", name: "English", complete: true, isDefault: true }],
  i18n: {},
};

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function parseTranslationCustom(raw: unknown): Record<string, TranslationCustomField[]> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, TranslationCustomField[]> = {};
  for (const [locale, rows] of Object.entries(raw as Record<string, unknown>)) {
    if (!locale.trim() || !Array.isArray(rows)) continue;
    out[locale] = rows
      .filter((row): row is Record<string, unknown> => Boolean(row && typeof row === "object"))
      .map((row) => ({
        id: typeof row.id === "string" ? row.id : "",
        reference: typeof row.reference === "string" ? row.reference : "Custom field",
      }))
      .filter((row) => row.id);
  }
  return out;
}

export function parseAdminNavExtras(raw: unknown): AdminNavExtras {
  const o = asRecord(raw);
  const recs = parseRecsConfig(o.recs, o.recOn);
  const recOn = recs.on;
  const ymm = parseVehicleFinderAdmin(o.ymm);
  let langs: AdminLocaleRow[] = DEFAULT_ADMIN_EXTRAS.langs;
  if (Array.isArray(o.langs) && o.langs.length > 0) {
    langs = o.langs
      .filter((row): row is Record<string, unknown> => Boolean(row && typeof row === "object"))
      .map((row) => ({
        code: typeof row.code === "string" ? row.code : "en",
        name: typeof row.name === "string" ? row.name : "English",
        complete: row.complete !== false,
        isDefault: row.isDefault === true,
      }));
    if (!langs.some((l) => l.isDefault)) langs[0]!.isDefault = true;
  }
  const draftRaw = asRecord(o.contactDraft);
  const contactDraft: ContactDraft | undefined =
    Object.keys(draftRaw).length === 0
      ? undefined
      : {
          email: typeof draftRaw.email === "string" ? draftRaw.email : "",
          collaboratorCode:
            typeof draftRaw.collaboratorCode === "string"
              ? draftRaw.collaboratorCode
              : "",
          subject: typeof draftRaw.subject === "string" ? draftRaw.subject : "",
          message: typeof draftRaw.message === "string" ? draftRaw.message : "",
        };
  const i18n = parseWidgetI18nMap(o.i18n);
  const translationCustom = parseTranslationCustom(o.translationCustom);
  return contactDraft
    ? { recOn, recs, ymm, langs, i18n, translationCustom, contactDraft }
    : { recOn, recs, ymm, langs, i18n, translationCustom };
}

const extrasCache = createTtlCache<AdminNavExtras>(30_000);

export async function getAdminNavExtras(shopId: string): Promise<AdminNavExtras> {
  return extrasCache.wrap(shopId, async () => {
    const row = await prisma.appSettings.findUnique({
      where: { shopId },
      select: { adminExtras: true },
    });
    return parseAdminNavExtras(row?.adminExtras);
  });
}

export async function saveAdminNavExtras(
  shopId: string,
  extras: AdminNavExtras,
): Promise<AdminNavExtras> {
  const current = await prisma.appSettings.findUnique({
    where: { shopId },
    select: { adminExtras: true },
  });
  const existingSetup = asRecord(asRecord(current?.adminExtras).setup);
  const payload = {
    ...extras,
    ...(Object.keys(existingSetup).length > 0 ? { setup: existingSetup } : {}),
  } as Prisma.InputJsonValue;
  const row = await prisma.appSettings.upsert({
    where: { shopId },
    create: { shopId, adminExtras: payload },
    update: { adminExtras: payload },
  });
  extrasCache.del(shopId);
  return parseAdminNavExtras(row.adminExtras);
}
