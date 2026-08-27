import { useEffect, useMemo, useState, type FormEvent } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import {
  Form,
  useActionData,
  useLoaderData,
  useNavigation,
  useSearchParams,
  useSubmit,
} from "react-router";
import {
  BlockStack,
  Button,
  Card,
  Checkbox,
  FormLayout,
  InlineStack,
  Layout,
  Page,
  Select,
  Tabs,
  Text,
  TextField,
} from "@shopify/polaris";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { ensureShopAccess } from "../services/billing.server";
import { isMutationBusy } from "../components/admin-loading";
import { useConfirmDelete } from "../components/confirm-delete-modal";
import {
  LayoutPicker,
  WidgetLookPreview,
  toWidgetPreviewSettings,
} from "../components/widget-preview";
import { SortOptionsPicker } from "../components/sort-options-picker";
import {
  HIDE_OUT_OF_STOCK_OPTIONS,
  PAGING_STYLE_OPTIONS,
  DEFAULT_APP_SETTINGS,
  DEFAULT_SEARCH_FIELDS,
  SORT_OPTION_LABELS,
  WIDGET_RADIUS_MAX,
  WIDGET_RADIUS_MIN,
  WIDGET_RADIUS_PRESETS,
  WIDGET_TITLE_SIZE_MAX,
  WIDGET_TITLE_SIZE_MIN,
  WIDGET_TITLE_SIZE_PRESETS,
  isPresetRadius,
  isPresetTitleSize,
  normalizeHandleList,
  normalizeHideProductTags,
  normalizeSearchFields,
  normalizeSortOptions,
  parseHideOutOfStock,
  parsePaginationStyle,
  parseSortOption,
  parseWidgetFontMode,
  parseWidgetPosition,
  parseWidgetRadius,
  parseWidgetTitleSize,
  resolveHideOutOfStock,
  type HideOutOfStockMode,
  type PaginationStyle,
  type SearchFieldKey,
  type SortOptionKey,
  type WidgetPosition,
} from "../utils/app-settings";
import { expandHexColor } from "../utils/hex-color";
import { getAppSettings, saveAppSettings } from "../services/settings.server";
import { useEmbeddedNavigate } from "../hooks/use-embedded-navigate";
import { SettingsMetafieldsCard } from "../components/settings-metafields-card";
import {
  loadSettingsMetafields,
  mergeSyncedMetafields,
  parseDeclaredMetafieldRows,
  saveDeclaredMetafields,
  syncShopifyMetafieldDefinitions,
} from "../services/settings-metafields.server";

export { SettingsPageSkeleton as HydrateFallback } from "../components/admin-skeletons";

const FONT_OPTIONS = [
  { label: "Match the theme (recommended)", value: "theme" },
  { label: "Theme heading font", value: "heading" },
  { label: "Theme body font", value: "body" },
  { label: "Custom font", value: "custom" },
];

const TITLE_SIZE_OPTIONS = [
  ...WIDGET_TITLE_SIZE_PRESETS.map((item) => ({
    label: item.label,
    value: String(item.value),
  })),
  { label: "Custom", value: "custom" },
];

const RADIUS_OPTIONS = [
  ...WIDGET_RADIUS_PRESETS.map((item) => ({
    label: item.label,
    value: String(item.value),
  })),
  { label: "Custom", value: "custom" },
];

const SETTINGS_TABS = [
  { id: "general", content: "General", panelID: "settings-general" },
  { id: "panel", content: "Filter panel", panelID: "settings-panel" },
  { id: "metafields", content: "Metafields", panelID: "settings-metafields" },
] as const;

type SettingsTabId = (typeof SETTINGS_TABS)[number]["id"];

function parseSettingsTab(value: unknown): SettingsTabId {
  const raw = typeof value === "string" ? value : "";
  if (raw === "layout" || raw === "look") return "panel";
  if (raw === "sort" || raw === "search" || raw === "product" || raw === "theme") {
    return "general";
  }
  return SETTINGS_TABS.some((tab) => tab.id === raw)
    ? (raw as SettingsTabId)
    : "general";
}

function tabPanelStyle(visible: boolean) {
  return visible ? undefined : { display: "none" as const };
}

type SettingsState = {
  widgetPosition: WidgetPosition;
  accentColor: string;
  showProductCounts: boolean;
  showTotalProductCount: boolean;
  hideProductTags: string[];
  collapseByDefault: boolean;
  hideOutOfStock: HideOutOfStockMode;
  paginationStyle: PaginationStyle;
  widgetShadow: boolean;
  widgetRadius: number;
  radiusChoice: string;
  widgetFontMode: "theme" | "heading" | "body" | "custom";
  widgetFontFamily: string;
  widgetTitle: string;
  widgetTitleSize: number;
  titleSizeChoice: string;
  widgetTitleColor: string;
  searchFields: SearchFieldKey[];
  sortOptionsEnabled: SortOptionKey[];
  defaultSort: SortOptionKey;
  hideSortDropdown: boolean;
  enableCollectionSearch: boolean;
  enableMarkets: boolean;
  enableFiltersOnSearch: boolean;
  hideSingleValueFacets: boolean;
  showMatchingVariantImage: boolean;
  showRefineBy: boolean;
  autoApplyFilters: boolean;
  showSuggestionsOnEmptyQuery: boolean;
  showSuggestionsOnNoResults: boolean;
  suggestionProductHandles: string[];
  suggestionCollectionHandles: string[];
  customCss: string;
  productListLiquid: string;
};

function toSettingsState(settings: {
  widgetPosition: string;
  accentColor: string;
  showProductCounts: boolean;
  showTotalProductCount?: boolean;
  hideProductTags?: unknown;
  collapseByDefault: boolean;
  hideOutOfStock?: string;
  paginationStyle?: string;
  widgetShadow: boolean;
  widgetRadius: number;
  widgetFontMode: string;
  widgetFontFamily: string;
  widgetTitle: string;
  widgetTitleSize: number;
  widgetTitleColor: string;
  searchFields?: unknown;
  sortOptionsEnabled?: unknown;
  defaultSort?: string;
  hideSortDropdown?: boolean;
  inStockOnTop?: boolean;
  soldOutToBottom?: boolean;
  enableCollectionSearch?: boolean;
  enableMarkets?: boolean;
  enableFiltersOnSearch?: boolean;
  hideSingleValueFacets?: boolean;
  showMatchingVariantImage?: boolean;
  showRefineBy?: boolean;
  autoApplyFilters?: boolean;
  showSuggestionsOnEmptyQuery?: boolean;
  showSuggestionsOnNoResults?: boolean;
  suggestionProductHandles?: unknown;
  suggestionCollectionHandles?: unknown;
  customCss?: string;
  productListLiquid?: string;
}): SettingsState {
  const widgetRadius = parseWidgetRadius(settings.widgetRadius);
  const widgetTitleSize = parseWidgetTitleSize(settings.widgetTitleSize);
  return {
    widgetPosition: parseWidgetPosition(settings.widgetPosition),
    accentColor: settings.accentColor,
    showProductCounts: settings.showProductCounts,
    showTotalProductCount: settings.showTotalProductCount !== false,
    hideProductTags: normalizeHideProductTags(settings.hideProductTags),
    collapseByDefault: settings.collapseByDefault,
    hideOutOfStock: resolveHideOutOfStock(settings),
    paginationStyle: parsePaginationStyle(settings.paginationStyle),
    widgetShadow: settings.widgetShadow,
    widgetRadius,
    radiusChoice: isPresetRadius(widgetRadius) ? String(widgetRadius) : "custom",
    widgetFontMode: parseWidgetFontMode(settings.widgetFontMode),
    widgetFontFamily: settings.widgetFontFamily || "",
    widgetTitle: settings.widgetTitle ?? "",
    widgetTitleSize,
    titleSizeChoice: isPresetTitleSize(widgetTitleSize)
      ? String(widgetTitleSize)
      : "custom",
    widgetTitleColor: settings.widgetTitleColor || DEFAULT_APP_SETTINGS.widgetTitleColor,
    searchFields:
      settings.searchFields === undefined
        ? [...DEFAULT_SEARCH_FIELDS]
        : normalizeSearchFields(settings.searchFields),
    sortOptionsEnabled:
      settings.sortOptionsEnabled === undefined
        ? [...DEFAULT_APP_SETTINGS.sortOptionsEnabled]
        : normalizeSortOptions(settings.sortOptionsEnabled),
    defaultSort: parseSortOption(settings.defaultSort),
    hideSortDropdown: Boolean(settings.hideSortDropdown),
    enableCollectionSearch: Boolean(settings.enableCollectionSearch),
    enableMarkets: settings.enableMarkets ?? DEFAULT_APP_SETTINGS.enableMarkets,
    enableFiltersOnSearch: settings.enableFiltersOnSearch ?? true,
    hideSingleValueFacets: Boolean(settings.hideSingleValueFacets),
    showMatchingVariantImage: settings.showMatchingVariantImage ?? true,
    showRefineBy: settings.showRefineBy ?? true,
    autoApplyFilters: settings.autoApplyFilters ?? true,
    showSuggestionsOnEmptyQuery: Boolean(settings.showSuggestionsOnEmptyQuery),
    showSuggestionsOnNoResults: Boolean(settings.showSuggestionsOnNoResults),
    suggestionProductHandles: normalizeHandleList(
      settings.suggestionProductHandles,
    ),
    suggestionCollectionHandles: normalizeHandleList(
      settings.suggestionCollectionHandles,
    ),
    customCss: settings.customCss ?? DEFAULT_APP_SETTINGS.customCss,
    productListLiquid:
      settings.productListLiquid ?? DEFAULT_APP_SETTINGS.productListLiquid,
  };
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const { shop } = await ensureShopAccess(session.shop);
  const [settings, metafields] = await Promise.all([
    getAppSettings(shop.id),
    loadSettingsMetafields(shop.id),
  ]);
  const tab = parseSettingsTab(new URL(request.url).searchParams.get("tab"));

  return {
    tab,
    metafields,
    settings: toSettingsState({
      widgetPosition: settings.widgetPosition,
      accentColor: settings.accentColor,
      showProductCounts: settings.showProductCounts,
      showTotalProductCount: settings.showTotalProductCount,
      hideProductTags: settings.hideProductTags,
      collapseByDefault: settings.collapseByDefault,
      hideOutOfStock: settings.hideOutOfStock,
      paginationStyle: (settings as { paginationStyle?: string }).paginationStyle,
      widgetShadow: settings.widgetShadow,
      widgetRadius: settings.widgetRadius,
      widgetFontMode: settings.widgetFontMode,
      widgetFontFamily: settings.widgetFontFamily || "",
      widgetTitle: settings.widgetTitle ?? DEFAULT_APP_SETTINGS.widgetTitle,
      widgetTitleSize: settings.widgetTitleSize,
      widgetTitleColor: settings.widgetTitleColor || DEFAULT_APP_SETTINGS.widgetTitleColor,
      searchFields: settings.searchFields,
      sortOptionsEnabled: settings.sortOptionsEnabled,
      defaultSort: settings.defaultSort,
      hideSortDropdown: settings.hideSortDropdown,
      inStockOnTop: settings.inStockOnTop,
      soldOutToBottom: settings.soldOutToBottom,
      enableCollectionSearch: settings.enableCollectionSearch,
      enableMarkets: settings.enableMarkets,
      enableFiltersOnSearch: settings.enableFiltersOnSearch,
      hideSingleValueFacets: settings.hideSingleValueFacets,
      showMatchingVariantImage: settings.showMatchingVariantImage,
      showRefineBy: settings.showRefineBy,
      autoApplyFilters: settings.autoApplyFilters,
      showSuggestionsOnEmptyQuery: settings.showSuggestionsOnEmptyQuery,
      showSuggestionsOnNoResults: settings.showSuggestionsOnNoResults,
      suggestionProductHandles: settings.suggestionProductHandles,
      suggestionCollectionHandles: settings.suggestionCollectionHandles,
      customCss: settings.customCss,
      productListLiquid: settings.productListLiquid,
    }),
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const { shop } = await ensureShopAccess(session.shop);
  const form = await request.formData();
  const intent = String(form.get("intent") || "");

  if (intent === "save-metafields") {
    const parsed = parseDeclaredMetafieldRows(String(form.get("mappings") || "[]"));
    if (!parsed.ok) return { error: parsed.error };
    const result = await saveDeclaredMetafields(shop.id, parsed.rows);
    if ("error" in result) return { error: result.error };
    return { ok: true, intent: "save-metafields" as const, rows: result.rows };
  }

  if (intent === "sync-metafields") {
    const parsed = parseDeclaredMetafieldRows(String(form.get("mappings") || "[]"));
    if (!parsed.ok) return { error: parsed.error };
    const loaded = await loadSettingsMetafields(shop.id);
    const existing = parsed.rows;
    try {
      const result = await syncShopifyMetafieldDefinitions(
        shop.id,
        admin,
        existing,
      );
      if (!result.extras.length) {
        return {
          ok: true,
          intent: "sync-metafields" as const,
          added: 0,
          extras: [] as typeof result.extras,
          rows: existing,
        };
      }
      const merged = mergeSyncedMetafields(
        existing,
        result.extras,
        loaded.filterLimit,
      );
      const saved = await saveDeclaredMetafields(shop.id, merged);
      if ("error" in saved) return { error: saved.error };
      return {
        ok: true,
        intent: "sync-metafields" as const,
        added: result.added,
        extras: [] as typeof result.extras,
        rows: saved.rows,
      };
    } catch (error) {
      return {
        error:
          error instanceof Error
            ? error.message
            : "Could not sync metafield definitions from Shopify.",
      };
    }
  }

  if (intent === "reset") {
    await saveAppSettings(shop.id, { ...DEFAULT_APP_SETTINGS });
    return { ok: true, reset: true };
  }

  const widgetPosition = parseWidgetPosition(form.get("widgetPosition"));

  let sortOptionsEnabled = [...DEFAULT_APP_SETTINGS.sortOptionsEnabled];
  const sortOptionsRaw = form.get("sortOptionsEnabled");
  if (typeof sortOptionsRaw === "string" && sortOptionsRaw) {
    try {
      const parsed = JSON.parse(sortOptionsRaw) as unknown;
      if (Array.isArray(parsed)) {
        sortOptionsEnabled = normalizeSortOptions(parsed);
      }
    } catch {
      // keep default
    }
  }

  await saveAppSettings(shop.id, {
    widgetPosition,
    accentColor: String(form.get("accentColor") || DEFAULT_APP_SETTINGS.accentColor),
    showProductCounts:
      form.get("showProductCounts") === "true" ||
      form.get("showProductCounts") === "on",
    showTotalProductCount:
      form.get("showTotalProductCount") === "true" ||
      form.get("showTotalProductCount") === "on",
    hideProductTags: normalizeHideProductTags(
      String(form.get("hideProductTags") || ""),
    ),
    collapseByDefault:
      form.get("collapseByDefault") === "true" ||
      form.get("collapseByDefault") === "on",
    hideOutOfStock: parseHideOutOfStock(form.get("hideOutOfStock")),
    paginationStyle: parsePaginationStyle(form.get("paginationStyle")),
    widgetShadow:
      form.get("widgetShadow") === "true" || form.get("widgetShadow") === "on",
    widgetRadius: parseWidgetRadius(form.get("widgetRadius")),
    widgetFontMode: parseWidgetFontMode(form.get("widgetFontMode")),
    widgetFontFamily: String(form.get("widgetFontFamily") || ""),
    widgetTitle: String(form.get("widgetTitle") ?? DEFAULT_APP_SETTINGS.widgetTitle),
    widgetTitleSize: parseWidgetTitleSize(form.get("widgetTitleSize")),
    widgetTitleColor: String(
      form.get("widgetTitleColor") || DEFAULT_APP_SETTINGS.widgetTitleColor,
    ),
    sortOptionsEnabled,
    defaultSort: parseSortOption(form.get("defaultSort")),
    hideSortDropdown:
      form.get("hideSortDropdown") === "true" ||
      form.get("hideSortDropdown") === "on",
    enableCollectionSearch:
      form.get("enableCollectionSearch") === "true" ||
      form.get("enableCollectionSearch") === "on",
    enableMarkets:
      form.get("enableMarkets") === "true" || form.get("enableMarkets") === "on",
    enableFiltersOnSearch:
      form.get("enableFiltersOnSearch") === "true" ||
      form.get("enableFiltersOnSearch") === "on",
    hideSingleValueFacets:
      form.get("hideSingleValueFacets") === "true" ||
      form.get("hideSingleValueFacets") === "on",
    showMatchingVariantImage:
      form.get("showMatchingVariantImage") === "true" ||
      form.get("showMatchingVariantImage") === "on",
    showRefineBy:
      form.get("showRefineBy") === "true" || form.get("showRefineBy") === "on",
    autoApplyFilters:
      form.get("autoApplyFilters") === "true" ||
      form.get("autoApplyFilters") === "on",
    customCss: String(form.get("customCss") ?? ""),
    productListLiquid: String(form.get("productListLiquid") ?? ""),
  });

  return { ok: true };
};

export function shouldRevalidate({
  currentUrl,
  nextUrl,
  formData,
  formMethod,
  defaultShouldRevalidate,
}: {
  currentUrl: URL;
  nextUrl: URL;
  formData?: FormData;
  formMethod?: string;
  defaultShouldRevalidate: boolean;
}) {
  const intent = formData?.get("intent");
  if (intent === "sync-metafields" || intent === "save-metafields") return false;
  const method = formMethod?.toUpperCase();
  if (method && method !== "GET") return defaultShouldRevalidate;
  if (currentUrl.pathname === nextUrl.pathname) {
    const currentTab = currentUrl.searchParams.get("tab") || "";
    const nextTab = nextUrl.searchParams.get("tab") || "";
    const restUnchanged = [...new Set([
      ...currentUrl.searchParams.keys(),
      ...nextUrl.searchParams.keys(),
    ])].every((key) => {
      if (key === "tab") return true;
      return currentUrl.searchParams.get(key) === nextUrl.searchParams.get(key);
    });
    if (restUnchanged && currentTab !== nextTab) return false;
    if (currentUrl.search === nextUrl.search) return false;
  }
  return defaultShouldRevalidate;
}

export default function SettingsPage() {
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const navigate = useEmbeddedNavigate();
  const submit = useSubmit();
  const shopify = useAppBridge();
  const { ask, dialog } = useConfirmDelete();
  const [searchParams, setSearchParams] = useSearchParams();
  const [settings, setSettings] = useState<SettingsState>(data.settings);
  const [loaderSettings, setLoaderSettings] = useState(data.settings);
  if (data.settings !== loaderSettings) {
    setLoaderSettings(data.settings);
    setSettings(data.settings);
  }

  const selectedTab = parseSettingsTab(searchParams.get("tab"));
  const selectedTabIndex = SETTINGS_TABS.findIndex((tab) => tab.id === selectedTab);
  const showPreview =
    selectedTab === "general" || selectedTab === "panel";
  const hidePageSave = selectedTab === "metafields";
  const previewSettings = useMemo(
    () => toWidgetPreviewSettings(settings),
    [
      settings.widgetPosition,
      settings.accentColor,
      settings.showProductCounts,
      settings.collapseByDefault,
      settings.widgetShadow,
      settings.widgetRadius,
      settings.widgetFontMode,
      settings.widgetFontFamily,
      settings.widgetTitle,
      settings.widgetTitleSize,
      settings.widgetTitleColor,
      settings.enableCollectionSearch,
      settings.hideSortDropdown,
      settings.showTotalProductCount,
      settings.hideSingleValueFacets,
      settings.showRefineBy,
      settings.autoApplyFilters,
    ],
  );

  const saving = isMutationBusy(navigation);

  useEffect(() => {
    if (actionData && "ok" in actionData && actionData.ok && !("intent" in actionData)) {
      shopify.toast.show(
        "reset" in actionData && actionData.reset
          ? "Settings reset to defaults"
          : "Settings saved",
      );
    }
  }, [actionData, shopify]);

  const submitSettings = (next: SettingsState, intent?: "reset") => {
    const formData = new FormData();
    if (intent === "reset") {
      formData.set("intent", "reset");
      submit(formData, { method: "POST" });
      return;
    }
    formData.set("widgetPosition", next.widgetPosition);
    formData.set("accentColor", next.accentColor);
    formData.set("showProductCounts", String(next.showProductCounts));
    formData.set("showTotalProductCount", String(next.showTotalProductCount));
    formData.set("hideProductTags", next.hideProductTags.join(", "));
    formData.set("collapseByDefault", String(next.collapseByDefault));
    formData.set("hideOutOfStock", next.hideOutOfStock);
    formData.set("paginationStyle", next.paginationStyle);
    formData.set("widgetShadow", String(next.widgetShadow));
    formData.set("widgetRadius", String(next.widgetRadius));
    formData.set("widgetFontMode", next.widgetFontMode);
    formData.set("widgetFontFamily", next.widgetFontFamily);
    formData.set("widgetTitle", next.widgetTitle);
    formData.set("widgetTitleSize", String(next.widgetTitleSize));
    formData.set("widgetTitleColor", next.widgetTitleColor);
    formData.set("sortOptionsEnabled", JSON.stringify(next.sortOptionsEnabled));
    formData.set("defaultSort", next.defaultSort);
    formData.set("hideSortDropdown", String(next.hideSortDropdown));
    formData.set("enableCollectionSearch", String(next.enableCollectionSearch));
    formData.set("enableMarkets", String(next.enableMarkets));
    formData.set("enableFiltersOnSearch", String(next.enableFiltersOnSearch));
    formData.set("hideSingleValueFacets", String(next.hideSingleValueFacets));
    formData.set(
      "showMatchingVariantImage",
      String(next.showMatchingVariantImage),
    );
    formData.set("showRefineBy", String(next.showRefineBy));
    formData.set("autoApplyFilters", String(next.autoApplyFilters));
    formData.set("customCss", next.customCss);
    formData.set("productListLiquid", next.productListLiquid);
    submit(formData, { method: "POST" });
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submitSettings(settings);
  };

  const handleReset = async () => {
    const ok = await ask({
      title: "Reset settings to defaults?",
      message:
        "Widget look, search fields, and filter display settings will be restored to the defaults.",
      confirmLabel: "Reset",
    });
    if (!ok) return;
    setSettings(toSettingsState({ ...DEFAULT_APP_SETTINGS }));
    submitSettings(toSettingsState({ ...DEFAULT_APP_SETTINGS }), "reset");
  };

  return (
    <div
      className={
        showPreview
          ? "findly-settings-page findly-settings-page--preview"
          : "findly-settings-page"
      }
    >
    <Page
      title="Settings"
      subtitle="General, filter panel, and metafields."
      backAction={{ content: "Home", onAction: () => navigate("/app") }}
      primaryAction={
        hidePageSave
          ? undefined
          : {
              content: saving ? "Saving…" : "Save",
              loading: saving,
              disabled: saving,
              onAction: () => {
                const form = document.getElementById(
                  "settings-form",
                ) as HTMLFormElement | null;
                form?.requestSubmit();
              },
            }
      }
      secondaryActions={
        hidePageSave
          ? undefined
          : [
              {
                content: "Default filters",
                onAction: () => navigate("/app/collections/default"),
              },
              {
                content: "Reset defaults",
                disabled: saving,
                onAction: handleReset,
              },
            ]
      }
    >
      <BlockStack gap="400">
        <Tabs
          tabs={[...SETTINGS_TABS]}
          selected={selectedTabIndex < 0 ? 0 : selectedTabIndex}
          onSelect={(index) => {
            const next = SETTINGS_TABS[index];
            if (!next) return;
            const params = new URLSearchParams(searchParams);
            params.set("tab", next.id);
            setSearchParams(params, {
              replace: true,
              preventScrollReset: true,
            });
          }}
        />
        <Layout>
          <Layout.Section>
            <BlockStack gap="400">
            <Form id="settings-form" method="post" onSubmit={handleSubmit}>
            <BlockStack gap="400">
              <div
                id="settings-general"
                role="tabpanel"
                style={tabPanelStyle(selectedTab === "general")}
              >
                <BlockStack gap="400">
                  <Card>
                    <BlockStack gap="300">
                      <Text as="h2" variant="headingMd">
                        General
                      </Text>
                      <Checkbox
                        label="Show filters on the search results page"
                        checked={settings.enableFiltersOnSearch}
                        disabled={saving}
                        helpText="Turn on the Collection filters app embed; this toggle shows or hides filters on the search results page."
                        onChange={(checked) =>
                          setSettings((s) => ({
                            ...s,
                            enableFiltersOnSearch: checked,
                          }))
                        }
                      />
                      <Checkbox
                        label="Allow searching within collection pages"
                        checked={settings.enableCollectionSearch}
                        disabled={saving}
                        helpText="Shows a search bar on collection pages, including Catalog (/collections/all). Matches stay inside that collection plus any active filters — not store-wide."
                        onChange={(checked) =>
                          setSettings((s) => ({
                            ...s,
                            enableCollectionSearch: checked,
                          }))
                        }
                      />
                      <Checkbox
                        label="Enable Shopify Markets, multi-currency, and B2B catalog prices"
                        checked={settings.enableMarkets}
                        disabled={saving}
                        helpText="Price filters use the storefront Market country (and B2B company location when the buyer is logged in). Turn off to always use the shop default currency from sync. Re-sync products after changing Markets in Shopify."
                        onChange={(checked) =>
                          setSettings((s) => ({
                            ...s,
                            enableMarkets: checked,
                          }))
                        }
                      />
                      <Checkbox
                        label="Show the number of matching products"
                        checked={settings.showProductCounts}
                        disabled={saving}
                        helpText="Per-option counts in the filter list (Blue 12)."
                        onChange={(checked) =>
                          setSettings((s) => ({
                            ...s,
                            showProductCounts: checked,
                          }))
                        }
                      />
                      <Checkbox
                        label="Show the number of total products"
                        checked={settings.showTotalProductCount}
                        disabled={saving}
                        helpText="Uncheck to hide the “X products” count on collection and search pages."
                        onChange={(checked) =>
                          setSettings((s) => ({
                            ...s,
                            showTotalProductCount: checked,
                          }))
                        }
                      />
                      <Text as="p" variant="bodySm" tone="subdued">
                        Filter URLs stay as an on-page hash so search engines
                        do not index duplicate pages.
                      </Text>
                    </BlockStack>
                  </Card>
                  <Card>
                    <BlockStack gap="300">
                      <Text as="h2" variant="headingMd">
                        Product visibility
                      </Text>
                      <TextField
                        label="Hide products by tags"
                        value={settings.hideProductTags.join(", ")}
                        autoComplete="off"
                        disabled={saving}
                        multiline={2}
                        helpText="Products with any of these tags are hidden from collection pages, search, and instant search. Example: hidden-product"
                        placeholder="hidden-product"
                        onChange={(value) =>
                          setSettings((s) => ({
                            ...s,
                            hideProductTags: normalizeHideProductTags(value),
                          }))
                        }
                      />
                      <BlockStack gap="200">
                        <Text as="p" variant="bodyMd">
                          Out-of-stock
                        </Text>
                        <div
                          className="findly-stock-radios"
                          role="radiogroup"
                          aria-label="Out-of-stock"
                        >
                          {HIDE_OUT_OF_STOCK_OPTIONS.map((option) => {
                            const selected =
                              settings.hideOutOfStock === option.value;
                            return (
                              <label
                                key={option.value}
                                className={`findly-stock-radio${
                                  selected
                                    ? " findly-stock-radio--selected"
                                    : ""
                                }${
                                  saving ? " findly-stock-radio--disabled" : ""
                                }`}
                              >
                                <input
                                  type="radio"
                                  name="findlyHideOutOfStock"
                                  value={option.value}
                                  checked={selected}
                                  disabled={saving}
                                  onChange={() =>
                                    setSettings((s) => ({
                                      ...s,
                                      hideOutOfStock: parseHideOutOfStock(
                                        option.value,
                                      ),
                                    }))
                                  }
                                />
                                <span className="findly-stock-radio__label">
                                  {option.label}
                                  <span className="findly-stock-radio__help">
                                    {option.helpText}
                                  </span>
                                </span>
                              </label>
                            );
                          })}
                        </div>
                        <Text as="p" variant="bodySm" tone="subdued">
                          The availability filter still works with every option.
                        </Text>
                      </BlockStack>
                    </BlockStack>
                  </Card>
                  <Card>
                    <BlockStack gap="300">
                      <Text as="h2" variant="headingMd">
                        Pagination
                      </Text>
                      <Select
                        label="Paging style"
                        options={PAGING_STYLE_OPTIONS}
                        value={settings.paginationStyle}
                        disabled={saving}
                        helpText="Applies to filtered collection and search grids. Theme pagination is left alone when intercept is not possible."
                        onChange={(value) =>
                          setSettings((s) => ({
                            ...s,
                            paginationStyle: parsePaginationStyle(value),
                          }))
                        }
                      />
                    </BlockStack>
                  </Card>
                  <Card>
                    <BlockStack gap="300">
                      <Text as="h2" variant="headingMd">
                        Sorting
                      </Text>
                      <Text as="p" variant="bodySm" tone="subdued">
                        Shoppers sort the theme product grid together with
                        active filters. Featured order comes from the Shopify
                        collection (sync after changing collection sort).
                        Extra metafield sort keys come from Settings →
                        Metafields (Applies to: Sort), not the list below.
                        Best-selling sorting is not available yet.
                      </Text>
                      <Select
                        label="Default sort products by"
                        options={(settings.sortOptionsEnabled.length
                          ? settings.sortOptionsEnabled
                          : ["manual" as const]
                        ).map((key) => ({
                          label: SORT_OPTION_LABELS[key],
                          value: key,
                        }))}
                        value={
                          settings.sortOptionsEnabled.includes(
                            settings.defaultSort,
                          )
                            ? settings.defaultSort
                            : (settings.sortOptionsEnabled[0] ?? "manual")
                        }
                        disabled={
                          saving || settings.sortOptionsEnabled.length === 0
                        }
                        helpText="“Featured” follows the Shopify collection sort after catalog sync."
                        onChange={(value) =>
                          setSettings((s) => ({
                            ...s,
                            defaultSort: parseSortOption(value),
                          }))
                        }
                      />
                      <SortOptionsPicker
                        selected={settings.sortOptionsEnabled}
                        disabled={saving}
                        onChange={(next) =>
                          setSettings((s) => {
                            const defaultSort = next.includes(s.defaultSort)
                              ? s.defaultSort
                              : parseSortOption(next[0] ?? "manual");
                            return {
                              ...s,
                              sortOptionsEnabled: next,
                              defaultSort,
                            };
                          })
                        }
                      />
                      <Checkbox
                        label="Hide the Sort By dropdown"
                        checked={settings.hideSortDropdown}
                        disabled={saving}
                        helpText="Products still use the default sort. Remove every option above to hide the dropdown the same way."
                        onChange={(checked) =>
                          setSettings((s) => ({
                            ...s,
                            hideSortDropdown: checked,
                          }))
                        }
                      />
                    </BlockStack>
                  </Card>
                  <Card>
                    <BlockStack gap="300">
                      <Text as="h2" variant="headingMd">
                        Search
                      </Text>
                      <Text as="p" variant="bodyMd">
                        Search settings live under Search
                      </Text>
                      <Button onClick={() => navigate("/app/search")}>
                        Open Search
                      </Button>
                    </BlockStack>
                  </Card>
                </BlockStack>
              </div>

              <div
                id="settings-panel"
                role="tabpanel"
                style={tabPanelStyle(selectedTab === "panel")}
              >
                <BlockStack gap="400">
                  <Card>
                    <BlockStack gap="300">
                      <Text as="h2" variant="headingMd">
                        Filter layout
                      </Text>
                      <Text as="p" variant="bodySm" tone="subdued">
                        Common filter layouts: Vertical (left or right
                        sidebar next to the product grid), Horizontal (filters
                        above the grid), or Off-canvas (Filter button +
                        drawer). Enable the Collection filters app embed to
                        place this automatically.
                      </Text>
                      <LayoutPicker
                        value={settings.widgetPosition}
                        disabled={saving}
                        onChange={(value: WidgetPosition) =>
                          setSettings((s) => ({ ...s, widgetPosition: value }))
                        }
                      />
                      <Checkbox
                        label="Collapse filter groups by default"
                        checked={settings.collapseByDefault}
                        disabled={saving || settings.widgetPosition === "top"}
                        helpText="Does not apply to the Horizontal tree style."
                        onChange={(checked) =>
                          setSettings((s) => ({
                            ...s,
                            collapseByDefault: checked,
                          }))
                        }
                      />
                      <Checkbox
                        label="Hide filter options when only one value"
                        checked={settings.hideSingleValueFacets}
                        disabled={saving}
                        onChange={(checked) =>
                          setSettings((s) => ({
                            ...s,
                            hideSingleValueFacets: checked,
                          }))
                        }
                      />
                      <Checkbox
                        label="Show Refine by chips for applied filters"
                        checked={settings.showRefineBy}
                        disabled={saving}
                        onChange={(checked) =>
                          setSettings((s) => ({
                            ...s,
                            showRefineBy: checked,
                          }))
                        }
                      />
                      <Select
                        label="Apply filters"
                        options={[
                          {
                            label: "Instantly when an option is selected",
                            value: "instant",
                          },
                          {
                            label: "When shoppers click Apply now",
                            value: "apply",
                          },
                        ]}
                        value={settings.autoApplyFilters ? "instant" : "apply"}
                        helpText="Instant updates the product grid over AJAX as soon as a shopper picks a value. Apply now lets them select several options first, then confirm."
                        disabled={saving}
                        onChange={(value) =>
                          setSettings((s) => ({
                            ...s,
                            autoApplyFilters: value === "instant",
                          }))
                        }
                      />
                    </BlockStack>
                  </Card>
                  <Card>
                    <BlockStack gap="300">
                      <Text as="h2" variant="headingMd">
                        Widget look
                      </Text>
                      <FormLayout>
                        <TextField
                          label="Title text"
                          autoComplete="off"
                          value={settings.widgetTitle}
                          disabled={saving}
                          helpText="Shown at the top of the filter. Leave blank to hide it."
                          onChange={(value) =>
                            setSettings((s) => ({ ...s, widgetTitle: value }))
                          }
                        />
                        <Select
                          label="Title size"
                          options={TITLE_SIZE_OPTIONS}
                          value={settings.titleSizeChoice}
                          disabled={saving}
                          onChange={(value) =>
                            setSettings((s) => {
                              if (value === "custom") {
                                return { ...s, titleSizeChoice: "custom" };
                              }
                              return {
                                ...s,
                                titleSizeChoice: value,
                                widgetTitleSize: parseWidgetTitleSize(value),
                              };
                            })
                          }
                        />
                        {settings.titleSizeChoice === "custom" ? (
                          <TextField
                            label="Custom title size"
                            type="number"
                            inputMode="numeric"
                            autoComplete="off"
                            suffix="px"
                            min={WIDGET_TITLE_SIZE_MIN}
                            max={WIDGET_TITLE_SIZE_MAX}
                            value={String(settings.widgetTitleSize)}
                            disabled={saving}
                            helpText={`Enter a value from ${WIDGET_TITLE_SIZE_MIN} to ${WIDGET_TITLE_SIZE_MAX} pixels.`}
                            onChange={(value) =>
                              setSettings((s) => ({
                                ...s,
                                widgetTitleSize: parseWidgetTitleSize(
                                  value === ""
                                    ? WIDGET_TITLE_SIZE_MIN
                                    : value,
                                ),
                              }))
                            }
                          />
                        ) : null}
                        <BlockStack gap="200">
                          <Text as="p" variant="bodyMd">
                            Title color
                          </Text>
                          <InlineStack gap="300" blockAlign="center" wrap>
                            <input
                              type="color"
                              aria-label="Pick title color"
                              value={expandHexColor(
                                settings.widgetTitleColor,
                                DEFAULT_APP_SETTINGS.accentColor,
                              )}
                              disabled={saving}
                              onChange={(event) =>
                                setSettings((s) => ({
                                  ...s,
                                  widgetTitleColor: event.target.value,
                                }))
                              }
                              style={{
                                width: 40,
                                height: 36,
                                padding: 0,
                                border: "1px solid #c9cccf",
                                borderRadius: 8,
                                background: "transparent",
                                cursor: saving ? "not-allowed" : "pointer",
                              }}
                            />
                            <div style={{ flex: 1, minWidth: 160 }}>
                              <TextField
                                label="Title color"
                                labelHidden
                                autoComplete="off"
                                value={settings.widgetTitleColor}
                                disabled={saving}
                                onChange={(value) =>
                                  setSettings((s) => ({
                                    ...s,
                                    widgetTitleColor: value,
                                  }))
                                }
                              />
                            </div>
                          </InlineStack>
                        </BlockStack>
                        <BlockStack gap="200">
                          <Text as="p" variant="bodyMd">
                            Accent color
                          </Text>
                          <InlineStack gap="300" blockAlign="center" wrap>
                            <input
                              type="color"
                              aria-label="Pick accent color"
                              value={expandHexColor(
                                settings.accentColor,
                                DEFAULT_APP_SETTINGS.accentColor,
                              )}
                              disabled={saving}
                              onChange={(event) =>
                                setSettings((s) => ({
                                  ...s,
                                  accentColor: event.target.value,
                                }))
                              }
                              style={{
                                width: 40,
                                height: 36,
                                padding: 0,
                                border: "1px solid #c9cccf",
                                borderRadius: 8,
                                background: "transparent",
                                cursor: saving ? "not-allowed" : "pointer",
                              }}
                            />
                            <div style={{ flex: 1, minWidth: 160 }}>
                              <TextField
                                label="Accent color"
                                labelHidden
                                autoComplete="off"
                                value={settings.accentColor}
                                disabled={saving}
                                onChange={(value) =>
                                  setSettings((s) => ({
                                    ...s,
                                    accentColor: value,
                                  }))
                                }
                                helpText="Used for buttons, selected filters, and the price range slider."
                              />
                            </div>
                          </InlineStack>
                        </BlockStack>
                        <Select
                          label="Font"
                          options={FONT_OPTIONS}
                          value={settings.widgetFontMode}
                          disabled={saving}
                          helpText="Match the theme uses your theme’s body font so filters look like the rest of the page."
                          onChange={(value) =>
                            setSettings((s) => ({
                              ...s,
                              widgetFontMode: parseWidgetFontMode(value),
                            }))
                          }
                        />
                        {settings.widgetFontMode === "custom" ? (
                          <TextField
                            label="Custom font family"
                            autoComplete="off"
                            value={settings.widgetFontFamily}
                            disabled={saving}
                            placeholder='Inter, "Helvetica Neue", sans-serif'
                            helpText="Use the same CSS font-family stack as your theme."
                            onChange={(value) =>
                              setSettings((s) => ({
                                ...s,
                                widgetFontFamily: value,
                              }))
                            }
                          />
                        ) : null}
                        <Select
                          label="Corner radius"
                          options={RADIUS_OPTIONS}
                          value={settings.radiusChoice}
                          disabled={saving}
                          onChange={(value) =>
                            setSettings((s) => {
                              if (value === "custom") {
                                return { ...s, radiusChoice: "custom" };
                              }
                              return {
                                ...s,
                                radiusChoice: value,
                                widgetRadius: parseWidgetRadius(value),
                              };
                            })
                          }
                        />
                        {settings.radiusChoice === "custom" ? (
                          <TextField
                            label="Custom radius"
                            type="number"
                            inputMode="numeric"
                            autoComplete="off"
                            suffix="px"
                            min={WIDGET_RADIUS_MIN}
                            max={WIDGET_RADIUS_MAX}
                            value={String(settings.widgetRadius)}
                            disabled={saving}
                            helpText={`Enter a value from ${WIDGET_RADIUS_MIN} to ${WIDGET_RADIUS_MAX} pixels.`}
                            onChange={(value) =>
                              setSettings((s) => ({
                                ...s,
                                widgetRadius: parseWidgetRadius(
                                  value === "" ? WIDGET_RADIUS_MIN : value,
                                ),
                              }))
                            }
                          />
                        ) : null}
                        <Checkbox
                          label="Show panel shadow"
                          checked={settings.widgetShadow}
                          disabled={saving}
                          onChange={(checked) =>
                            setSettings((s) => ({
                              ...s,
                              widgetShadow: checked,
                            }))
                          }
                          helpText="Turn off for a flat look with no drop shadow."
                        />
                      </FormLayout>
                    </BlockStack>
                  </Card>
                  <Card>
                    <BlockStack gap="300">
                      <Text as="h2" variant="headingMd">
                        Custom CSS
                      </Text>
                      <TextField
                        label="Custom CSS"
                        labelHidden
                        autoComplete="off"
                        multiline={8}
                        value={settings.customCss}
                        disabled={saving}
                        helpText="Scoped to the filter widget only. Does not change the theme header. Use --sf-accent to change the accent."
                        onChange={(value) =>
                          setSettings((s) => ({ ...s, customCss: value }))
                        }
                      />
                    </BlockStack>
                  </Card>
                  <Card>
                    <BlockStack gap="300">
                      <Text as="h2" variant="headingMd">
                        Product list Liquid
                      </Text>
                      <TextField
                        label="Product list Liquid"
                        labelHidden
                        autoComplete="off"
                        multiline={6}
                        value={settings.productListLiquid}
                        disabled={saving}
                        helpText="Optional HTML for the app product grid. Placeholders like {{product.title}} work the same as the theme App embed product template. Script tags are stripped on save."
                        onChange={(value) =>
                          setSettings((s) => ({
                            ...s,
                            productListLiquid: value,
                          }))
                        }
                      />
                    </BlockStack>
                  </Card>
                </BlockStack>
              </div>
            </BlockStack>
          </Form>
              <div
                id="settings-metafields"
                role="tabpanel"
                style={tabPanelStyle(selectedTab === "metafields")}
              >
                <SettingsMetafieldsCard
                  initialRows={data.metafields.rows}
                  plan={data.metafields.plan}
                  filterLimit={data.metafields.filterLimit}
                />
              </div>
            </BlockStack>
          </Layout.Section>
          {showPreview ? (
            <Layout.Section variant="oneThird">
              <div className="findly-settings-preview">
                <Card>
                  <BlockStack gap="200">
                    <Text as="h2" variant="headingMd">
                      Preview
                    </Text>
                    <WidgetLookPreview settings={previewSettings} />
                  </BlockStack>
                </Card>
              </div>
            </Layout.Section>
          ) : null}
        </Layout>
      </BlockStack>
      {dialog}
    </Page>
    </div>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};

