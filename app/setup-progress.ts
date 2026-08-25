export type SetupStepStatus = "complete" | "todo" | "optional";

export const THEME_STEP_IDS = [
  "collection-filters",
  "product-search",
  "instant-search",
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
