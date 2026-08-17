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
  useNavigation,
  useSubmit,
} from "react-router";
import {
  BlockStack,
  Card,
  Checkbox,
  FormLayout,
  InlineStack,
  Layout,
  Page,
  Select,
  Text,
  TextField,
} from "@shopify/polaris";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { ensureShopAccess } from "../billing.server";
import { isMutationBusy } from "../components/admin-loading";
import {
  LayoutPicker,
  WidgetLookPreview,
} from "../components/widget-preview";
import {
  DEFAULT_APP_SETTINGS,
  WIDGET_RADIUS_MAX,
  WIDGET_RADIUS_MIN,
  WIDGET_RADIUS_PRESETS,
  WIDGET_TITLE_SIZE_MAX,
  WIDGET_TITLE_SIZE_MIN,
  WIDGET_TITLE_SIZE_PRESETS,
  isPresetRadius,
  isPresetTitleSize,
  parseWidgetFontMode,
  parseWidgetRadius,
  parseWidgetTitleSize,
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

type SettingsState = {
  widgetPosition: "left" | "right" | "top";
  accentColor: string;
  showProductCounts: boolean;
  collapseByDefault: boolean;
  widgetShadow: boolean;
  widgetRadius: number;
  radiusChoice: string;
  widgetFontMode: "theme" | "heading" | "body" | "custom";
  widgetFontFamily: string;
  widgetTitle: string;
  widgetTitleSize: number;
  titleSizeChoice: string;
  widgetTitleColor: string;
};

function toSettingsState(settings: {
  widgetPosition: "left" | "right" | "top";
  accentColor: string;
  showProductCounts: boolean;
  collapseByDefault: boolean;
  widgetShadow: boolean;
  widgetRadius: number;
  widgetFontMode: string;
  widgetFontFamily: string;
  widgetTitle: string;
  widgetTitleSize: number;
  widgetTitleColor: string;
}): SettingsState {
  const widgetRadius = parseWidgetRadius(settings.widgetRadius);
  const widgetTitleSize = parseWidgetTitleSize(settings.widgetTitleSize);
  return {
    widgetPosition: settings.widgetPosition,
    accentColor: settings.accentColor,
    showProductCounts: settings.showProductCounts,
    collapseByDefault: settings.collapseByDefault,
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

  return {
    settings: toSettingsState({
      widgetPosition: settings.widgetPosition as "left" | "right" | "top",
      accentColor: settings.accentColor,
      showProductCounts: settings.showProductCounts,
      collapseByDefault: settings.collapseByDefault,
      widgetShadow: settings.widgetShadow,
      widgetRadius: settings.widgetRadius,
      widgetFontMode: settings.widgetFontMode,
      widgetFontFamily: settings.widgetFontFamily || "",
      widgetTitle: settings.widgetTitle ?? DEFAULT_APP_SETTINGS.widgetTitle,
      widgetTitleSize: settings.widgetTitleSize,
      widgetTitleColor: settings.widgetTitleColor || DEFAULT_APP_SETTINGS.widgetTitleColor,
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

  const positionRaw = String(form.get("widgetPosition") || "left");
  const widgetPosition =
    positionRaw === "right" || positionRaw === "top" ? positionRaw : "left";

  await saveAppSettings(shop.id, {
    widgetPosition,
    accentColor: String(form.get("accentColor") || DEFAULT_APP_SETTINGS.accentColor),
    showProductCounts:
      form.get("showProductCounts") === "true" ||
      form.get("showProductCounts") === "on",
    collapseByDefault:
      form.get("collapseByDefault") === "true" ||
      form.get("collapseByDefault") === "on",
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
  });

  return { ok: true };
};

export default function SettingsPage() {
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const submit = useSubmit();
  const shopify = useAppBridge();
  const [settings, setSettings] = useState<SettingsState>(data.settings);
  const [loaderSettings, setLoaderSettings] = useState(data.settings);
  if (data.settings !== loaderSettings) {
    setLoaderSettings(data.settings);
    setSettings(data.settings);
  }

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
    formData.set("widgetShadow", String(next.widgetShadow));
    formData.set("widgetRadius", String(next.widgetRadius));
    formData.set("widgetFontMode", next.widgetFontMode);
    formData.set("widgetFontFamily", next.widgetFontFamily);
    formData.set("widgetTitle", next.widgetTitle);
    formData.set("widgetTitleSize", String(next.widgetTitleSize));
    formData.set("widgetTitleColor", next.widgetTitleColor);
    submit(formData, { method: "POST" });
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submitSettings(settings);
  };

  const handleReset = () => {
    if (
      !window.confirm(
        "Reset widget look and filter display settings to the defaults?",
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
      fullWidth
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
          content: "Reset defaults",
          disabled: saving,
          onAction: handleReset,
        },
      ]}
    >
      <Layout>
        <Layout.Section>
          <Form id="settings-form" method="post" onSubmit={handleSubmit}>
            <BlockStack gap="400">
              <Card>
                <BlockStack gap="300">
                  <Text as="h2" variant="headingMd">
                    Filter layout
                  </Text>
                  <LayoutPicker
                    value={settings.widgetPosition}
                    disabled={saving}
                    onChange={(value: "left" | "right" | "top") =>
                      setSettings((s) => ({ ...s, widgetPosition: value }))
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
                  <Checkbox
                    label="Collapse filter groups by default"
                    checked={settings.collapseByDefault}
                    disabled={saving}
                    onChange={(checked) =>
                      setSettings((s) => ({
                        ...s,
                        collapseByDefault: checked,
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
                              value === "" ? WIDGET_TITLE_SIZE_MIN : value,
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
                          value={toColorInputValue(settings.widgetTitleColor)}
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
                        setSettings((s) => ({ ...s, widgetShadow: checked }))
                      }
                      helpText="Turn off for a flat look with no drop shadow."
                    />
                  </FormLayout>
                </BlockStack>
              </Card>
            </BlockStack>
          </Form>
        </Layout.Section>
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
      </Layout>
    </Page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
