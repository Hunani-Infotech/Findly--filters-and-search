import type { Prisma } from "@prisma/client";
import prisma from "./db.server";
import {
  parseWidgetI18nMap,
  type WidgetI18nMap,
} from "./widget-i18n";
import { DEFAULT_YMM, parseVehicleFinderAdmin, type VehicleFinderAdmin } from "./ymm";
import { DEFAULT_RECS, parseRecsConfig, type RecsConfig } from "./recs";

export type { VehicleFinderAdmin };

export type RecPageTab = "product" | "home" | "collection" | "cart";

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

export type AdminNavExtras = {
  recOn: Record<string, boolean>;
  recs: RecsConfig;
  ymm: VehicleFinderAdmin;
  langs: AdminLocaleRow[];
  i18n: WidgetI18nMap;
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
  return contactDraft
    ? { recOn, recs, ymm, langs, i18n, contactDraft }
    : { recOn, recs, ymm, langs, i18n };
}

export async function getAdminNavExtras(shopId: string): Promise<AdminNavExtras> {
  const row = await prisma.appSettings.upsert({
    where: { shopId },
    create: { shopId },
    update: {},
  });
  return parseAdminNavExtras(row.adminExtras);
}

export async function saveAdminNavExtras(
  shopId: string,
  extras: AdminNavExtras,
): Promise<AdminNavExtras> {
  const payload = extras as Prisma.InputJsonValue;
  const row = await prisma.appSettings.upsert({
    where: { shopId },
    create: { shopId, adminExtras: payload },
    update: { adminExtras: payload },
  });
  return parseAdminNavExtras(row.adminExtras);
}
