export type SetupStepStatus = "complete" | "todo" | "optional";

export const THEME_STEP_IDS = [
  "collection-filters",
  "product-search",
] as const;

export type ThemeStepId = (typeof THEME_STEP_IDS)[number];
export type SetupMarkId = ThemeStepId | "performance";

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

export type ThemeSetupFlags = Record<ThemeStepId, boolean>;

export type ThemeEditorUrls = {
  collectionFilters: string;
  collectionFiltersEmbed: string;
  productSearch: string;
};

export function emptyThemeSetupFlags(): ThemeSetupFlags {
  return {
    "collection-filters": false,
    "product-search": false,
  };
}

export function themeFlagsEqual(a: ThemeSetupFlags, b: ThemeSetupFlags): boolean {
  return THEME_STEP_IDS.every((id) => a[id] === b[id]);
}

export function themeFlagsFromSteps(setup: SetupProgress): ThemeSetupFlags {
  return {
    "collection-filters": setup.themeSteps.some(
      (step) => step.id === "collection-filters" && step.status === "complete",
    ),
    "product-search": setup.themeSteps.some(
      (step) => step.id === "product-search" && step.status === "complete",
    ),
  };
}

function applyThemeFlagToStep(step: SetupStep, flags: ThemeSetupFlags): SetupStep {
  if (step.id === "collection-filters") {
    const done = flags["collection-filters"];
    return {
      ...step,
      status: done ? "complete" : "todo",
      actionLabel: done ? "Open collection editor" : "Open theme editor",
    };
  }
  if (step.id === "product-search") {
    const done = flags["product-search"];
    return {
      ...step,
      status: done ? "complete" : "todo",
      actionLabel: done ? "Open search editor" : "Open theme editor",
    };
  }
  return step;
}

/** Apply live theme-embed detection onto a loader payload without waiting for persist. */
export function overlayThemeFlags(
  setup: SetupProgress,
  flags: ThemeSetupFlags,
): SetupProgress {
  const steps = setup.steps.map((step) => applyThemeFlagToStep(step, flags));
  const themeSteps = setup.themeSteps.map((step) =>
    applyThemeFlagToStep(step, flags),
  );
  const completeCount = steps.filter((step) => step.status === "complete").length;
  const nextStep = steps.find((step) => step.status === "todo") ?? null;
  const themeComplete = themeSteps.every((step) => step.status === "complete");
  const allComplete = completeCount === steps.length;
  return {
    ...setup,
    steps,
    themeSteps,
    completeCount,
    nextStep,
    themeComplete,
    allComplete,
    showGuide: setup.showGuide && !allComplete,
  };
}

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
  /** First-install checklist. Hidden after all steps are complete. */
  showGuide: boolean;
  editorUrls: ThemeEditorUrls;
};

export function isThemeStepId(value: string): value is ThemeStepId {
  return (THEME_STEP_IDS as readonly string[]).includes(value);
}

export function isSetupMarkId(value: string): value is SetupMarkId {
  return isThemeStepId(value) || value === "performance";
}
