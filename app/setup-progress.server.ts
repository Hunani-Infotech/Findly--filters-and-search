import type { Prisma } from "@prisma/client";
import prisma from "./db.server";
import type {
  SetupMarkId,
  SetupProgress,
  SetupStep,
  SetupStepStatus,
  ThemeEditorUrls,
  ThemeStepId,
} from "./setup-progress";

export {
  isSetupMarkId,
  isThemeStepId,
  THEME_STEP_IDS,
  type SetupMarkId,
  type SetupProgress,
  type SetupStep,
  type SetupStepStatus,
  type ThemeEditorUrls,
  type ThemeStepId,
} from "./setup-progress";

type ThemeSetupFlags = Record<ThemeStepId, boolean>;

type SetupExtras = ThemeSetupFlags & {
  guideDismissed: boolean;
  performance: boolean;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {};
}

export function parseThemeSetupFlags(raw: unknown): ThemeSetupFlags {
  const setup = asRecord(asRecord(raw).setup);
  return {
    "collection-filters": setup["collection-filters"] === true,
    "product-search": setup["product-search"] === true,
    "instant-search": setup["instant-search"] === true,
  };
}

function parseSetupExtras(raw: unknown): SetupExtras {
  const setup = asRecord(asRecord(raw).setup);
  return {
    ...parseThemeSetupFlags(raw),
    guideDismissed: setup.guideDismissed === true,
    performance: setup.performance === true,
  };
}

function setupExtrasPayload(extras: SetupExtras): Record<string, boolean> {
  return {
    "collection-filters": extras["collection-filters"],
    "product-search": extras["product-search"],
    "instant-search": extras["instant-search"],
    guideDismissed: extras.guideDismissed,
    performance: extras.performance,
  };
}

export function themeEditorUrls(
  shopDomain: string,
  apiKey = process.env.SHOPIFY_API_KEY || "",
): ThemeEditorUrls {
  const editor = `https://${shopDomain}/admin/themes/current/editor`;
  if (!apiKey) {
    return {
      collectionFilters: `${editor}?context=apps`,
      productSearch: `${editor}?template=search`,
      instantSearch: `${editor}?context=apps`,
    };
  }
  return {
    collectionFilters: `${editor}?context=apps&activateAppId=${apiKey}/collection-filters-embed`,
    productSearch: `${editor}?template=search&addAppBlockId=${apiKey}/product-search&target=newAppsSection`,
    instantSearch: `${editor}?context=apps&activateAppId=${apiKey}/instant-search`,
  };
}

function themeStatus(done: boolean): SetupStepStatus {
  return done ? "complete" : "todo";
}

const SETUP_PROGRESS_TTL_MS = 30_000;
const setupProgressCache = new Map<
  string,
  { value: SetupProgress; expires: number }
>();

function invalidateSetupProgress(shopId: string) {
  for (const key of [...setupProgressCache.keys()]) {
    if (key.startsWith(`${shopId}:`)) setupProgressCache.delete(key);
  }
}

async function persistSetupExtras(shopId: string, extras: SetupExtras) {
  const row = await prisma.appSettings.upsert({
    where: { shopId },
    create: { shopId },
    update: {},
    select: { adminExtras: true },
  });
  const adminExtras = asRecord(row.adminExtras);
  adminExtras.setup = setupExtrasPayload(extras);
  await prisma.appSettings.update({
    where: { shopId },
    data: { adminExtras: adminExtras as Prisma.InputJsonValue },
  });
  invalidateSetupProgress(shopId);
}

export async function getSetupProgress(
  shopId: string,
  shopDomain: string,
): Promise<SetupProgress> {
  const cacheKey = `${shopId}:${shopDomain}`;
  const hit = setupProgressCache.get(cacheKey);
  if (hit && hit.expires > Date.now()) return hit.value;
  const value = await loadSetupProgress(shopId, shopDomain);
  setupProgressCache.set(cacheKey, {
    value,
    expires: Date.now() + SETUP_PROGRESS_TTL_MS,
  });
  return value;
}

async function loadSetupProgress(
  shopId: string,
  shopDomain: string,
): Promise<SetupProgress> {
  const [
    syncJob,
    enabledFilterCount,
    mappedFilterCount,
    discoveredMetafieldCount,
    collectionCount,
    productCount,
    settings,
  ] = await Promise.all([
    prisma.syncJob.findUnique({ where: { shopId } }),
    prisma.filterConfig.count({ where: { shopId, enabled: true } }),
    prisma.metafieldMapping.count({
      where: { shopId, enabled: true },
    }),
    prisma.discoveredMetafield.count({ where: { shopId } }),
    prisma.collection.count({ where: { shopId } }),
    prisma.productFacet.count({ where: { shopId } }),
    prisma.appSettings.findUnique({
      where: { shopId },
      select: { adminExtras: true },
    }),
  ]);

  const extras = parseSetupExtras(settings?.adminExtras);
  const flags = extras;
  const editorUrls = themeEditorUrls(shopDomain);
  const syncReady =
    syncJob?.status === "READY" || productCount > 0 || collectionCount > 0;
  const filterConfigured = enabledFilterCount > 0;

  const adminSteps: SetupStep[] = [
    {
      id: "sync",
      number: 1,
      title: "Sync your catalog",
      description:
        "Import products and collections so filters have real values to show.",
      href: syncReady ? "/app?sync=1" : "/app?sync=1&run=1",
      actionLabel: syncReady ? "View sync" : "Run sync",
      status: syncReady ? "complete" : "todo",
    },
    {
      id: "filters",
      number: 2,
      title: "Turn on a filter",
      description:
        "Keep the default filter, or add one, so collection pages can use Price, Vendor, Type, and Tags.",
      href: "/app/filters",
      actionLabel: filterConfigured ? "View filters" : "Open filters",
      status: filterConfigured ? "complete" : "todo",
    },
  ];

  const themeSteps: SetupStep[] = [
    {
      id: "collection-filters",
      number: 3,
      title: "Enable Collection filters",
      description:
        "In the theme editor, open App embeds and turn on Collection filters. Save the theme.",
      href: editorUrls.collectionFilters,
      actionLabel: flags["collection-filters"]
        ? "Open app embeds"
        : "Open theme editor",
      status: themeStatus(flags["collection-filters"]),
      external: true,
    },
    {
      id: "product-search",
      number: 4,
      title: "Add Product search",
      description:
        "In the theme editor, add Product search to the search template (or header), then save.",
      href: editorUrls.productSearch,
      actionLabel: flags["product-search"]
        ? "Open search editor"
        : "Open theme editor",
      status: themeStatus(flags["product-search"]),
      external: true,
    },
  ];

  const performanceStep: SetupStep = {
    id: "performance",
    number: 5,
    title: "Check performance",
    description:
      "See how shoppers use search and filters. Counts stay at zero until the widgets are live on the storefront.",
    href: "/app/analytics",
    actionLabel: "View performance",
    status: extras.performance ? "complete" : "todo",
  };

  const steps = [...adminSteps, ...themeSteps, performanceStep];
  const nextStep = steps.find((step) => step.status === "todo") ?? null;
  const completeCount = steps.filter((step) => step.status === "complete").length;
  const themeComplete = themeSteps.every((step) => step.status === "complete");
  const allComplete = completeCount === steps.length;
  let guideDismissed = extras.guideDismissed;
  if (allComplete && !guideDismissed) {
    try {
      await persistSetupExtras(shopId, { ...extras, guideDismissed: true });
      guideDismissed = true;
    } catch {
      // Still hide this request via allComplete; persist retries on the next load.
    }
  }

  return {
    shopDomain,
    collectionCount,
    productCount,
    mappedFilterCount,
    discoveredMetafieldCount,
    syncStatus: syncJob?.status ?? null,
    filterConfigured,
    steps,
    themeSteps,
    nextStep,
    completeCount,
    themeComplete,
    allComplete,
    showGuide: !guideDismissed && !allComplete,
    editorUrls,
  };
}

export async function setSetupMark(
  shopId: string,
  stepId: SetupMarkId,
  complete: boolean,
): Promise<void> {
  const row = await prisma.appSettings.upsert({
    where: { shopId },
    create: { shopId },
    update: {},
    select: { adminExtras: true },
  });
  const extras = parseSetupExtras(row.adminExtras);
  extras[stepId] = complete;
  await persistSetupExtras(shopId, extras);
}
