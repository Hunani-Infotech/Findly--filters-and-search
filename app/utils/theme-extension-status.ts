import type { ThemeSetupFlags } from "./setup-progress";

/** Liquid filenames in extensions/smart-filter/blocks. */
export const THEME_BLOCK_HANDLES = {
  collectionFilters: "collection-filters",
  collectionFiltersEmbed: "collection-filters-embed",
  productSearch: "product-search",
} as const;

type ThemeBlockActivation = {
  handle?: string;
  status?: string;
};

type ExtensionHost = {
  extensions?: () => Promise<unknown>;
  app?: {
    extensions?: () => Promise<unknown>;
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function collectThemeBlocks(raw: unknown): ThemeBlockActivation[] {
  if (!Array.isArray(raw)) return [];
  const blocks: ThemeBlockActivation[] = [];
  for (const item of raw) {
    if (!isRecord(item) || item.type !== "theme_app_extension") continue;
    if (!Array.isArray(item.activations)) continue;
    for (const activation of item.activations) {
      if (isRecord(activation)) blocks.push(activation);
    }
  }
  return blocks;
}

function blockIsActive(blocks: ThemeBlockActivation[], handle: string): boolean {
  return blocks.some(
    (block) => block.handle === handle && block.status === "active",
  );
}

export function themeFlagsFromExtensions(raw: unknown): ThemeSetupFlags {
  const blocks = collectThemeBlocks(raw);
  const collectionOn =
    blockIsActive(blocks, THEME_BLOCK_HANDLES.collectionFilters) ||
    blockIsActive(blocks, THEME_BLOCK_HANDLES.collectionFiltersEmbed);
  return {
    "collection-filters": collectionOn,
    "product-search": blockIsActive(blocks, THEME_BLOCK_HANDLES.productSearch),
  };
}

export async function detectThemeExtensionFlags(
  shopify: unknown,
): Promise<ThemeSetupFlags | null> {
  const host = shopify as ExtensionHost;
  const extensions = host.app?.extensions ?? host.extensions;
  if (typeof extensions !== "function") return null;
  try {
    const raw = await extensions();
    return themeFlagsFromExtensions(raw);
  } catch {
    return null;
  }
}
