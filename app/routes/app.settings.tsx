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
import { DEFAULT_APP_SETTINGS } from "../app-settings";
import { getAppSettings, saveAppSettings } from "../settings.server";

const POSITION_OPTIONS = [
  { label: "Left", value: "left" },
  { label: "Right", value: "right" },
  { label: "Top", value: "top" },
];

const RADIUS_OPTIONS = [
  { label: "None", value: "0" },
  { label: "Small", value: "8" },
  { label: "Default", value: "12" },
  { label: "Large", value: "20" },
];

type SettingsState = {
  widgetPosition: "left" | "right" | "top";
  accentColor: string;
  showProductCounts: boolean;
  collapseByDefault: boolean;
  widgetShadow: boolean;
  widgetRadius: number;
};

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
    settings: {
      widgetPosition: settings.widgetPosition as "left" | "right" | "top",
      accentColor: settings.accentColor,
      showProductCounts: settings.showProductCounts,
      collapseByDefault: settings.collapseByDefault,
      widgetShadow: settings.widgetShadow,
      widgetRadius: settings.widgetRadius,
    } satisfies SettingsState,
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
  const radius = Number(form.get("widgetRadius"));

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
    widgetRadius: Number.isFinite(radius) ? radius : DEFAULT_APP_SETTINGS.widgetRadius,
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
    setSettings({ ...DEFAULT_APP_SETTINGS });
    submitSettings(DEFAULT_APP_SETTINGS, "reset");
  };

  return (
    <Page
      title="Settings"
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
                    Widget look
                  </Text>
                  <FormLayout>
                    <Select
                      label="Widget position"
                      options={POSITION_OPTIONS}
                      value={settings.widgetPosition}
                      disabled={saving}
                      onChange={(value) =>
                        setSettings((s) => ({
                          ...s,
                          widgetPosition: value as "left" | "right" | "top",
                        }))
                      }
                    />
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
                              setSettings((s) => ({ ...s, accentColor: value }))
                            }
                            helpText="Used for buttons, selected filters, and the price range slider."
                          />
                        </div>
                      </InlineStack>
                    </BlockStack>
                    <Select
                      label="Corner radius"
                      options={RADIUS_OPTIONS}
                      value={String(settings.widgetRadius)}
                      disabled={saving}
                      onChange={(value) =>
                        setSettings((s) => ({
                          ...s,
                          widgetRadius: Number(value),
                        }))
                      }
                    />
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

              <Card>
                <BlockStack gap="300">
                  <Text as="h2" variant="headingMd">
                    Filter display
                  </Text>
                  <FormLayout>
                    <Checkbox
                      label="Show product counts on filter options"
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
                  </FormLayout>
                </BlockStack>
              </Card>
            </BlockStack>
          </Form>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
