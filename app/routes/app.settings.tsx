import { useEffect, useState, type FormEvent } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import {
  Form,
  useActionData,
  useLoaderData,
  useNavigate,
  useNavigation,
  useSubmit,
} from "react-router";
import {
  Banner,
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
import { ensureShopAccess } from "../billing.server";
import { isMutationBusy } from "../components/admin-loading";
import { ThemeSetupCard } from "../components/theme-setup-card";
import {
  LayoutPicker,
  WidgetLookPreview,
} from "../components/widget-preview";
import {
  HIDE_OUT_OF_STOCK_OPTIONS,
  DEFAULT_APP_SETTINGS,
  DEFAULT_SEARCH_FIELDS,
  SORT_OPTION_KEYS,
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
  normalizeSearchFields,
  normalizeSortOptions,
  parseHideOutOfStock,
  parseSortOption,
  parseWidgetFontMode,
  parseWidgetPosition,
  parseWidgetRadius,
  parseWidgetTitleSize,
  type HideOutOfStockMode,
  type SearchFieldKey,
  type SortOptionKey,
  type WidgetPosition,
} from "../app-settings";
import { getAppSettings, saveAppSettings } from "../settings.server";

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
  { id: "product", content: "Product card", panelID: "settings-product" },
  { id: "metafields", content: "Metafields", panelID: "settings-metafields" },
  { id: "theme", content: "Theme", panelID: "settings-theme" },
] as const;

type SettingsTabId = (typeof SETTINGS_TABS)[number]["id"];

function parseSettingsTab(value: unknown): SettingsTabId {
  const raw = typeof value === "string" ? value : "";
  if (raw === "layout" || raw === "look") return "panel";
  if (raw === "sort" || raw === "search") return "general";
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
  collapseByDefault: boolean;
  hideOutOfStock: HideOutOfStockMode;
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
  inStockOnTop: boolean;
  soldOutToBottom: boolean;
  enableCollectionSearch: boolean;
  enableFiltersOnSearch: boolean;
  hideSingleValueFacets: boolean;
  showMatchingVariantImage: boolean;
  showRefineBy: boolean;
  showSuggestionsOnEmptyQuery: boolean;
  showSuggestionsOnNoResults: boolean;
  suggestionProductHandles: string[];
  suggestionCollectionHandles: string[];
};

function toSettingsState(settings: {
  widgetPosition: string;
  accentColor: string;
  showProductCounts: boolean;
  collapseByDefault: boolean;
  hideOutOfStock?: string;
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
  enableFiltersOnSearch?: boolean;
  hideSingleValueFacets?: boolean;
  showMatchingVariantImage?: boolean;
  showRefineBy?: boolean;
  showSuggestionsOnEmptyQuery?: boolean;
  showSuggestionsOnNoResults?: boolean;
  suggestionProductHandles?: unknown;
  suggestionCollectionHandles?: unknown;
}): SettingsState {
  const widgetRadius = parseWidgetRadius(settings.widgetRadius);
  const widgetTitleSize = parseWidgetTitleSize(settings.widgetTitleSize);
  return {
    widgetPosition: parseWidgetPosition(settings.widgetPosition),
    accentColor: settings.accentColor,
    showProductCounts: settings.showProductCounts,
    collapseByDefault: settings.collapseByDefault,
    hideOutOfStock: parseHideOutOfStock(settings.hideOutOfStock),
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
    inStockOnTop: Boolean(settings.inStockOnTop),
    soldOutToBottom: Boolean(settings.soldOutToBottom),
    enableCollectionSearch: Boolean(settings.enableCollectionSearch),
    enableFiltersOnSearch: settings.enableFiltersOnSearch ?? true,
    hideSingleValueFacets: Boolean(settings.hideSingleValueFacets),
    showMatchingVariantImage: settings.showMatchingVariantImage ?? true,
    showRefineBy: settings.showRefineBy ?? true,
    showSuggestionsOnEmptyQuery: Boolean(settings.showSuggestionsOnEmptyQuery),
    showSuggestionsOnNoResults: Boolean(settings.showSuggestionsOnNoResults),
    suggestionProductHandles: normalizeHandleList(
      settings.suggestionProductHandles,
    ),
    suggestionCollectionHandles: normalizeHandleList(
      settings.suggestionCollectionHandles,
    ),
  };
}

function toColorInputValue(value: string) {
  const color = value.trim();
  if (/^#[0-9a-f]{6}$/i.test(color)) return color;
  if (/^#[0-9a-f]{3}$/i.test(color)) {
    return `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`;
  }
  return DEFAULT_APP_SETTINGS.accentColor;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const { shop } = await ensureShopAccess(session.shop);
  const settings = await getAppSettings(shop.id);
  const tab = parseSettingsTab(new URL(request.url).searchParams.get("tab"));

  return {
    tab,
    shopDomain: session.shop,
    settings: toSettingsState({
      widgetPosition: settings.widgetPosition,
      accentColor: settings.accentColor,
      showProductCounts: settings.showProductCounts,
      collapseByDefault: settings.collapseByDefault,
      hideOutOfStock: settings.hideOutOfStock,
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
      enableFiltersOnSearch: settings.enableFiltersOnSearch,
      hideSingleValueFacets: settings.hideSingleValueFacets,
      showMatchingVariantImage: settings.showMatchingVariantImage,
      showRefineBy: settings.showRefineBy,
      showSuggestionsOnEmptyQuery: settings.showSuggestionsOnEmptyQuery,
      showSuggestionsOnNoResults: settings.showSuggestionsOnNoResults,
      suggestionProductHandles: settings.suggestionProductHandles,
      suggestionCollectionHandles: settings.suggestionCollectionHandles,
    }),
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const { shop } = await ensureShopAccess(session.shop);
  const form = await request.formData();

  if (form.get("intent") === "reset") {
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
    collapseByDefault:
      form.get("collapseByDefault") === "true" ||
      form.get("collapseByDefault") === "on",
    hideOutOfStock: parseHideOutOfStock(form.get("hideOutOfStock")),
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
    inStockOnTop:
      form.get("inStockOnTop") === "true" || form.get("inStockOnTop") === "on",
    soldOutToBottom:
      form.get("soldOutToBottom") === "true" ||
      form.get("soldOutToBottom") === "on",
    enableCollectionSearch:
      form.get("enableCollectionSearch") === "true" ||
      form.get("enableCollectionSearch") === "on",
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
  });

  return { ok: true };
};

export default function SettingsPage() {
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const navigate = useNavigate();
  const submit = useSubmit();
  const shopify = useAppBridge();
  const [settings, setSettings] = useState<SettingsState>(data.settings);
  const [loaderSettings, setLoaderSettings] = useState(data.settings);
  const [selectedTab, setSelectedTab] = useState<SettingsTabId>(data.tab);
  if (data.settings !== loaderSettings) {
    setLoaderSettings(data.settings);
    setSettings(data.settings);
  }

  const selectedTabIndex = SETTINGS_TABS.findIndex(
    (tab) => tab.id === selectedTab,
  );
  const showPreview = selectedTab === "panel";

  const saving = isMutationBusy(navigation);

  useEffect(() => {
    if (actionData && "ok" in actionData && actionData.ok) {
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
    formData.set("collapseByDefault", String(next.collapseByDefault));
    formData.set("hideOutOfStock", next.hideOutOfStock);
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
    formData.set("inStockOnTop", String(next.inStockOnTop));
    formData.set("soldOutToBottom", String(next.soldOutToBottom));
    formData.set("enableCollectionSearch", String(next.enableCollectionSearch));
    formData.set("enableFiltersOnSearch", String(next.enableFiltersOnSearch));
    formData.set("hideSingleValueFacets", String(next.hideSingleValueFacets));
    formData.set(
      "showMatchingVariantImage",
      String(next.showMatchingVariantImage),
    );
    formData.set("showRefineBy", String(next.showRefineBy));
    submit(formData, { method: "POST" });
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submitSettings(settings);
  };

  const handleReset = () => {
    if (
      !window.confirm(
        "Reset widget look, search fields, and filter display settings to the defaults?",
      )
    ) {
      return;
    }
    setSettings(toSettingsState({ ...DEFAULT_APP_SETTINGS }));
    submitSettings(toSettingsState({ ...DEFAULT_APP_SETTINGS }), "reset");
  };

  return (
    <Page
      title="Settings"
      subtitle="General, filter panel, product cards, metafields, and theme setup."
      backAction={{ content: "Filters", onAction: () => navigate("/app") }}
      primaryAction={{
        content: saving ? "Saving…" : "Save",
        loading: saving,
        disabled: saving,
        onAction: () => {
          const form = document.getElementById(
            "settings-form",
          ) as HTMLFormElement | null;
          form?.requestSubmit();
        },
      }}
      secondaryActions={[
        {
          content: "Default filters",
          url: "/app/collections/default",
        },
        {
          content: "Reset defaults",
          disabled: saving,
          onAction: handleReset,
        },
      ]}
    >
      <Layout>
        <Layout.Section>
          <BlockStack gap="400">
            <Tabs
              tabs={[...SETTINGS_TABS]}
              selected={selectedTabIndex < 0 ? 0 : selectedTabIndex}
              onSelect={(index) => {
                const next = SETTINGS_TABS[index];
                if (next) setSelectedTab(next.id);
              }}
            />
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
                        helpText="Still add the Collection filters block on the search template; this toggle shows or hides it."
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
                        helpText="Shows a search bar on collection pages. Matches stay inside that collection plus any active filters — not store-wide."
                        onChange={(checked) =>
                          setSettings((s) => ({
                            ...s,
                            enableCollectionSearch: checked,
                          }))
                        }
                      />
                      <Checkbox
                        label="Show the number of matching products"
                        checked={settings.showProductCounts}
                        disabled={saving}
                        onChange={(checked) =>
                          setSettings((s) => ({
                            ...s,
                            showProductCounts: checked,
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
                      <Select
                        label="Out-of-stock"
                        options={HIDE_OUT_OF_STOCK_OPTIONS}
                        value={settings.hideOutOfStock}
                        disabled={saving}
                        helpText="Show all, hide sold-out products, or hide them only after a shopper applies a filter. The availability filter still works."
                        onChange={(value) =>
                          setSettings((s) => ({
                            ...s,
                            hideOutOfStock: parseHideOutOfStock(value),
                          }))
                        }
                      />
                      <Checkbox
                        label="Display in-stock products on top"
                        checked={settings.inStockOnTop}
                        disabled={saving}
                        helpText="Keeps available products first. Combines with the selected Sort By order among in-stock items."
                        onChange={(checked) =>
                          setSettings((s) => ({
                            ...s,
                            inStockOnTop: checked,
                          }))
                        }
                      />
                      <Checkbox
                        label="Move sold-out products to the bottom"
                        checked={settings.soldOutToBottom}
                        disabled={saving}
                        helpText="Pushes out-of-stock products last while keeping the selected sort inside each group."
                        onChange={(checked) =>
                          setSettings((s) => ({
                            ...s,
                            soldOutToBottom: checked,
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
                        Best-selling sorting is not available yet.
                      </Text>
                      <Checkbox
                        label="Hide the Sort By dropdown"
                        checked={settings.hideSortDropdown}
                        disabled={saving}
                        helpText="Products still use the default sort. Uncheck every option below to hide the dropdown the same way."
                        onChange={(checked) =>
                          setSettings((s) => ({
                            ...s,
                            hideSortDropdown: checked,
                          }))
                        }
                      />
                      <FormLayout>
                        {SORT_OPTION_KEYS.map((key) => (
                          <Checkbox
                            key={key}
                            label={SORT_OPTION_LABELS[key]}
                            checked={settings.sortOptionsEnabled.includes(key)}
                            disabled={saving}
                            onChange={(checked) =>
                              setSettings((s) => {
                                const next = checked
                                  ? s.sortOptionsEnabled.includes(key)
                                    ? s.sortOptionsEnabled
                                    : [...s.sortOptionsEnabled, key]
                                  : s.sortOptionsEnabled.filter(
                                      (option) => option !== key,
                                    );
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
                        ))}
                      </FormLayout>
                      <Select
                        label="Default sort"
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
                        sidebar), Horizontal (filters above the grid), or
                        Off-canvas (Filter button + drawer). Place the theme
                        block above the product grid for Horizontal.
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
                              value={toColorInputValue(
                                settings.widgetTitleColor,
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
                              value={toColorInputValue(settings.accentColor)}
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
                </BlockStack>
              </div>

              <div
                id="settings-product"
                role="tabpanel"
                style={tabPanelStyle(selectedTab === "product")}
              >
                <Card>
                  <BlockStack gap="300">
                    <Text as="h2" variant="headingMd">
                      Product card
                    </Text>
                    <Text as="p" variant="bodyMd">
                      Findly uses your theme’s product grid. App-built
                      product cards are not used; Findly keeps your theme
                      cards.
                    </Text>
                    <Checkbox
                      label="Display image of variants that match the filters"
                      checked={settings.showMatchingVariantImage}
                      disabled={saving}
                      helpText="After a Color/Size filter, theme product cards swap to the matching variant image from catalog sync."
                      onChange={(checked) =>
                        setSettings((s) => ({
                          ...s,
                          showMatchingVariantImage: checked,
                        }))
                      }
                    />
                  </BlockStack>
                </Card>
              </div>

              <div
                id="settings-metafields"
                role="tabpanel"
                style={tabPanelStyle(selectedTab === "metafields")}
              >
                <Card>
                  <BlockStack gap="300">
                    <Text as="h2" variant="headingMd">
                      Metafields
                    </Text>
                    <Banner tone="info">
                      <p>
                        List metafields to search, filter, and display on the
                        Metafields page.
                      </p>
                    </Banner>
                    <Button url="/app/metafields" variant="primary">
                      Open metafield mappings
                    </Button>
                    <Text as="p" variant="bodySm" tone="subdued">
                      Map namespace/key and choose List, Range, or Yes/No.
                      Enabled mappings then appear in Filters display order.
                    </Text>
                  </BlockStack>
                </Card>
              </div>
            </BlockStack>
          </Form>
            <div
              id="settings-theme"
              role="tabpanel"
              style={tabPanelStyle(selectedTab === "theme")}
            >
              <BlockStack gap="300">
                <ThemeSetupCard shopDomain={data.shopDomain} />
                <Text as="p" variant="bodySm" tone="subdued">
                  Add the Collection filters block on collection and search
                  templates, and the Product search block in the header or
                  search template, so filters and search appear on the
                  storefront.
                </Text>
              </BlockStack>
            </div>
          </BlockStack>
        </Layout.Section>
        {showPreview ? (
        <Layout.Section variant="oneThird">
          <div style={{ position: "sticky", top: 16 }}>
            <Card>
              <BlockStack gap="200">
                <Text as="h2" variant="headingMd">
                  Preview
                </Text>
                <WidgetLookPreview settings={settings} />
              </BlockStack>
            </Card>
          </div>
        </Layout.Section>
        ) : null}
      </Layout>
    </Page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};

