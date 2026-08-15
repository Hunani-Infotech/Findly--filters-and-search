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
  Layout,
  Page,
  Select,
  TextField,
} from "@shopify/polaris";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { ensureShopAccess } from "../billing.server";
import { isMutationBusy } from "../components/admin-loading";
import { getAppSettings, saveAppSettings } from "../settings.server";

const POSITION_OPTIONS = [
  { label: "Left", value: "left" },
  { label: "Right", value: "right" },
  { label: "Top", value: "top" },
];

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
    },
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const { shop } = await ensureShopAccess(session.shop);
  const form = await request.formData();

  const positionRaw = String(form.get("widgetPosition") || "left");
  const widgetPosition =
    positionRaw === "right" || positionRaw === "top" ? positionRaw : "left";

  await saveAppSettings(shop.id, {
    widgetPosition,
    accentColor: String(form.get("accentColor") || "#1c1917"),
    showProductCounts:
      form.get("showProductCounts") === "true" ||
      form.get("showProductCounts") === "on",
    collapseByDefault:
      form.get("collapseByDefault") === "true" ||
      form.get("collapseByDefault") === "on",
  });

  return { ok: true };
};

export default function SettingsPage() {
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const submit = useSubmit();
  const shopify = useAppBridge();
  const [settings, setSettings] = useState(data.settings);

  const saving = isMutationBusy(navigation);

  useEffect(() => {
    setSettings(data.settings);
  }, [data.settings]);

  useEffect(() => {
    if (actionData && "ok" in actionData && actionData.ok) {
      shopify.toast.show("Settings saved");
    }
  }, [actionData, shopify]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData();
    formData.set("widgetPosition", settings.widgetPosition);
    formData.set("accentColor", settings.accentColor);
    formData.set("showProductCounts", String(settings.showProductCounts));
    formData.set("collapseByDefault", String(settings.collapseByDefault));
    submit(formData, { method: "POST" });
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
    >
      <Layout>
        <Layout.Section>
          <Card>
            <Form id="settings-form" method="post" onSubmit={handleSubmit}>
              <BlockStack gap="400">
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
                  <TextField
                    label="Accent color"
                    autoComplete="off"
                    value={settings.accentColor}
                    disabled={saving}
                    onChange={(value) =>
                      setSettings((s) => ({ ...s, accentColor: value }))
                    }
                    helpText="CSS color used by the storefront filter widget (e.g. #1c1917)."
                  />
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
            </Form>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
