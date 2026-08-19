import prisma from "./db.server";

export type SetupStepStatus = "complete" | "todo" | "optional";

export type SetupStep = {
  id: string;
  number: number;
  title: string;
  description: string;
  href: string;
  actionLabel: string;
  status: SetupStepStatus;
};

export type SetupProgress = {
  shopDomain: string;
  collectionCount: number;
  productCount: number;
  mappedFilterCount: number;
  discoveredMetafieldCount: number;
  syncStatus: string | null;
  defaultConfigured: boolean;
  steps: SetupStep[];
  nextStep: SetupStep | null;
  completeCount: number;
};

export async function getSetupProgress(
  shopId: string,
  shopDomain: string,
): Promise<SetupProgress> {
  const [
    syncJob,
    defaultConfig,
    mappedFilterCount,
    discoveredMetafieldCount,
    collectionCount,
    productCount,
  ] = await Promise.all([
    prisma.syncJob.findUnique({ where: { shopId } }),
    prisma.filterConfig.findFirst({
      where: { shopId, appliesToSearch: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.metafieldMapping.count({
      where: { shopId, enabled: true },
    }),
    prisma.discoveredMetafield.count({ where: { shopId } }),
    prisma.collection.count({ where: { shopId } }),
    prisma.productFacet.count({ where: { shopId } }),
  ]);

  const syncReady =
    syncJob?.status === "READY" && (productCount > 0 || collectionCount > 0);
  const defaultConfigured = Boolean(defaultConfig);

  const steps: SetupStep[] = [
    {
      id: "sync",
      number: 1,
      title: "Sync your catalog",
      description:
        "Import products, collections, tags, options, and metafields so filters have real values.",
      href: "/app/sync",
      actionLabel: syncReady ? "View sync" : "Run sync",
      status: syncReady ? "complete" : "todo",
    },
    {
      id: "defaults",
      number: 2,
      title: "Choose default filter options",
      description:
        "Turn on Price, Availability, Vendor, Type, Tags, and variant options. Set display type, AND/OR, and value order.",
      href: "/app",
      actionLabel: defaultConfigured ? "Edit defaults" : "Set defaults",
      status: defaultConfigured ? "complete" : "todo",
    },
    {
      id: "metafields",
      number: 3,
      title: "Map metafield filters",
      description:
        "Optional. Enable product or variant metafields as List, Range, or Yes/No filters.",
      href: "/app/metafields",
      actionLabel: "Open metafields",
      status:
        mappedFilterCount > 0
          ? "complete"
          : discoveredMetafieldCount === 0
            ? "optional"
            : "optional",
    },
    {
      id: "layout",
      number: 4,
      title: "Pick filter layout and look",
      description:
        "Vertical, Horizontal, or Off-canvas; product counts; collapse; colors and font.",
      href: "/app/settings?tab=panel",
      actionLabel: "Open layout",
      status: "complete",
    },
    {
      id: "search",
      number: 5,
      title: "Configure search and sort",
      description:
        "Search fields, in-collection search, empty-result pins, Sort By, and out-of-stock rules.",
      href: "/app/settings?tab=general",
      actionLabel: "Open search",
      status: "complete",
    },
    {
      id: "theme",
      number: 6,
      title: "Add the theme blocks",
      description:
        "Place Collection filters on collection (and search) templates, and Product search in the header or search template.",
      href: "/app/settings?tab=theme",
      actionLabel: "How to add blocks",
      status: "todo",
    },
    {
      id: "collections",
      number: 7,
      title: "Override a collection (optional)",
      description:
        "Collections inherit the shop-wide default. Open one only when it needs different options.",
      href: "/app",
      actionLabel: "View collections",
      status: collectionCount > 0 ? "optional" : "todo",
    },
  ];

  const nextStep =
    steps.find((step) => step.status === "todo" && step.id !== "theme") ??
    steps.find((step) => step.id === "theme") ??
    null;

  return {
    shopDomain,
    collectionCount,
    productCount,
    mappedFilterCount,
    discoveredMetafieldCount,
    syncStatus: syncJob?.status ?? null,
    defaultConfigured,
    steps,
    nextStep,
    completeCount: steps.filter((step) => step.status === "complete").length,
  };
}
