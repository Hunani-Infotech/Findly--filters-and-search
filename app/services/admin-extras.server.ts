import type { Prisma } from "@prisma/client";
import prisma from "../db.server";
import { createTtlCache } from "../lib/read-cache.server";
import {
  parseWidgetI18nMap,
  type WidgetI18nMap,
} from "../utils/widget-i18n";


export type AdminLocaleRow = {
  code: string;
  name: string;
  complete: boolean;
  isDefault: boolean;
};

export type ContactDraft = {
  email: string;
  subject: string;
  message: string;
};

export type TranslationCustomField = {
  id: string;
  reference: string;
};

export type AdminNavExtras = {
  langs: AdminLocaleRow[];
  i18n: WidgetI18nMap;
  translationCustom?: Record<string, TranslationCustomField[]>;
  contactDraft?: ContactDraft;
  /** Opt-in storefront behavior. Absent or false keeps the released behavior. */
  storefrontV2?: boolean;
};

const DEFAULT_ADMIN_EXTRAS: AdminNavExtras = {
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
          subject: typeof draftRaw.subject === "string" ? draftRaw.subject : "",
          message: typeof draftRaw.message === "string" ? draftRaw.message : "",
        };
  const i18n = parseWidgetI18nMap(o.i18n);
  const translationCustom = parseTranslationCustom(o.translationCustom);
  const storefrontV2 = o.storefrontV2 === true;
  return {
    langs,
    i18n,
    translationCustom,
    ...(contactDraft ? { contactDraft } : {}),
    ...(storefrontV2 ? { storefrontV2: true } : {}),
  };
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
  const currentRaw = asRecord(current?.adminExtras);
  const existingSetup = asRecord(currentRaw.setup);
  const { contactDraft, storefrontV2: incomingV2, ...rest } = extras;
  const storefrontV2 =
    incomingV2 === true
      ? true
      : incomingV2 === false
        ? false
        : currentRaw.storefrontV2 === true;
  const payload = {
    ...rest,
    ...(storefrontV2 ? { storefrontV2: true } : {}),
    ...(contactDraft
      ? {
          contactDraft: {
            email: contactDraft.email,
            subject: contactDraft.subject,
            message: contactDraft.message,
          },
        }
      : {}),
    ...(Object.keys(existingSetup).length > 0 ? { setup: existingSetup } : {}),
  };
  const body = JSON.stringify(payload);
  const mergeCounts = async () =>
    prisma.$executeRaw`
      UPDATE "AppSettings"
      SET "adminExtras" =
        ${body}::jsonb
        || jsonb_build_object(
          'signalCounts',
          COALESCE("adminExtras"->'signalCounts', '{}'::jsonb)
        )
      WHERE "shopId" = ${shopId}
    `;
  const updated = await mergeCounts();
  if (Number(updated) === 0) {
    try {
      await prisma.appSettings.create({
        data: { shopId, adminExtras: payload as Prisma.InputJsonValue },
      });
    } catch {
      await mergeCounts();
    }
  }
  extrasCache.del(shopId);
  const row = await prisma.appSettings.findUnique({
    where: { shopId },
    select: { adminExtras: true },
  });
  return parseAdminNavExtras(row?.adminExtras);
}
