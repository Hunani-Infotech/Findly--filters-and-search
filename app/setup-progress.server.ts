import type { Prisma } from "@prisma/client";
import prisma from "./db.server";

export type SetupStepStatus = "complete" | "todo" | "optional";

export const THEME_STEP_IDS = [
  "collection-filters",
  "product-search",
  "instant-search",
] as const;

export type ThemeStepId = (typeof THEME_STEP_IDS)[number];

export type SetupStep = {
  id: string;
  number: number;
  title: string;
  description: string;
  href: string;
  actionLabel: string;
  status: SetupStepStatus;
  external?: boolean;
};

export type ThemeEditorUrls = {
  collectionFilters: string;
  productSearch: string;
  instantSearch: string;
};

export type SetupProgress = {
  shopDomain: string;
  collectionCount: number;
  productCount: number;
  mappedFilterCount: number;
  discoveredMetafieldCount: number;
  syncStatus: string | null;
  filterConfigured: boolean;
  steps: SetupStep[];
  themeSteps: SetupStep[];
  nextStep: SetupStep | null;
  completeCount: number;
  themeComplete: boolean;
  allComplete: boolean;
  editorUrls: ThemeEditorUrls;
};

type ThemeSetupFlags = Record<ThemeStepId, boolean>;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {};
}

export function isThemeStepId(value: string): value is ThemeStepId {
  return (THEME_STEP_IDS as readonly string[]).includes(value);
}

export function parseThemeSetupFlags(raw: unknown): ThemeSetupFlags {
  const setup = asRecord(asRecord(raw).setup);
  return {
    "collection-filters": setup["collection-filters"] === true,
    "product-search": setup["product-search"] === true,
    "instant-search": setup["instant-search"] === true,
  };
}

export function themeEditorUrls(
  shopDomain: string,
  apiKey = process.env.SHOPIFY_API_KEY || "",
): ThemeEditorUrls {
  const editor = `https://${shopDomain}/admin/themes/current/editor`;
  if (!apiKey) {
    return {
      collectionFilters: `${editor}?template=collection`,
      productSearch: `${editor}?template=search`,
      instantSearch: `${editor}?context=apps`,
    };
  }
  return {
    collectionFilters: `${editor}?template=collection&addAppBlockId=${apiKey}/collection-filters&target=newAppsSection`,
    productSearch: `${editor}?template=search&addAppBlockId=${apiKey}/product-search&target=newAppsSection`,
    instantSearch: `${editor}?context=apps&activateAppId=${apiKey}/instant-search`,
  };
}

function themeStatus(done: boolean): SetupStepStatus {
  return done ? "complete" : "todo";
}

export async function getSetupProgress(
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

  const flags = parseThemeSetupFlags(settings?.adminExtras);
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
        "Import products and collections so filters and search have real values.",
      href: "/app/sync",
      actionLabel: syncReady ? "View sync" : "Run sync",
      status: syncReady ? "complete" : "todo",
    },
    {
      id: "filters",
      number: 2,
      title: "Turn on a filter",
      description:
        "Keep the default filter or add one so collection pages have Price, Vendor, Type, and Tags.",
      href: "/app",
      actionLabel: filterConfigured ? "View filters" : "Add a filter",
      status: filterConfigured ? "complete" : "todo",
    },
  ];

  const themeSteps: SetupStep[] = [
    {
      id: "collection-filters",
      number: 3,
      title: "Add Collection filters",
      description:
        "Place the Collection filters app block on your collection template. Add it to the search template too if shoppers should filter search results.",
      href: editorUrls.collectionFilters,
      actionLabel: flags["collection-filters"]
        ? "Open collection editor"
        : "Add to collection template",
      status: themeStatus(flags["collection-filters"]),
      external: true,
    },
    {
      id: "product-search",
      number: 4,
      title: "Add Product search",
      description:
        "Place the Product search app block on the search template. You can also add it to the header from the theme editor.",
      href: editorUrls.productSearch,
      actionLabel: flags["product-search"]
        ? "Open search editor"
        : "Add to search template",
      status: themeStatus(flags["product-search"]),
      external: true,
    },
    {
      id: "instant-search",
      number: 5,
      title: "Enable Instant search",
      description:
        "Turn on the Instant search app embed under Theme settings → App embeds so suggestions appear as shoppers type.",
      href: editorUrls.instantSearch,
      actionLabel: flags["instant-search"]
        ? "Open app embeds"
        : "Enable app embed",
      status: themeStatus(flags["instant-search"]),
      external: true,
    },
  ];

  const steps = [...adminSteps, ...themeSteps];
  const nextStep = steps.find((step) => step.status === "todo") ?? null;
  const completeCount = steps.filter((step) => step.status === "complete").length;
  const themeComplete = themeSteps.every((step) => step.status === "complete");

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
    allComplete: completeCount === steps.length,
    editorUrls,
  };
}

export async function setThemeStepComplete(
  shopId: string,
  stepId: ThemeStepId,
  complete: boolean,
): Promise<void> {
  const row = await prisma.appSettings.upsert({
    where: { shopId },
    create: { shopId },
    update: {},
    select: { adminExtras: true },
  });
  const extras = asRecord(row.adminExtras);
  const setup = parseThemeSetupFlags(extras);
  setup[stepId] = complete;
  extras.setup = setup;
  await prisma.appSettings.update({
    where: { shopId },
    data: { adminExtras: extras as Prisma.InputJsonValue },
  });
}
