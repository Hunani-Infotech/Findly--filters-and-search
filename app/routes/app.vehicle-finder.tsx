import { useEffect, useRef, useState, type CSSProperties } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { useFetcher, useLoaderData, useNavigate } from "react-router";
import {
  Banner,
  BlockStack,
  Button,
  Card,
  Checkbox,
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
import { getAdminNavExtras, saveAdminNavExtras } from "../admin-nav-extras.server";
import {
  DEFAULT_YMM_FIELDS,
  parseVehicleFinderAdmin,
  parseYmmCsv,
  type VehicleFinderAdmin,
  type YmmField,
  type YmmValueMode,
} from "../ymm";

const SHORTCODE = '<div id="gf-form"></div>';

const SAMPLE_CSV =
  "Year,Make,Model,Product handle\n2020,Toyota,Camry,sample-product\n2019,Honda,Civic,sample-product\n";

const VALUE_MODE_OPTIONS = [
  { label: "All values", value: "all" },
  { label: "Prefix", value: "prefix" },
  { label: "Manual", value: "manual" },
];

function createField(index: number): YmmField {
  const template = DEFAULT_YMM_FIELDS[index] ?? {
    id: `field_${index + 1}`,
    label: `Field ${index + 1}`,
    valueMode: "all" as const,
    prefix: "",
    removePrefix: false,
    manualValues: [],
  };
  return {
    ...template,
    id: `${template.id}_${Date.now().toString(36)}`,
    label: template.label,
  };
}

function parseMode(value: string): YmmValueMode {
  if (value === "prefix" || value === "manual" || value === "all") return value;
  return "all";
}

function parseManualValues(raw: string): string[] {
  return raw
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const { shop } = await ensureShopAccess(session.shop);
  const extras = await getAdminNavExtras(shop.id);
  return { ymm: extras.ymm };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const { shop } = await ensureShopAccess(session.shop);
  const form = await request.formData();
  const intent = String(form.get("intent") || "");
  const extras = await getAdminNavExtras(shop.id);

  if (intent === "csv") {
    const csv = String(form.get("csv") ?? "");
    const fileName = String(form.get("fileName") ?? "");
    extras.ymm = {
      ...extras.ymm,
      rows: parseYmmCsv(csv),
      fileName,
    };
    const saved = await saveAdminNavExtras(shop.id, extras);
    return {
      ok: true as const,
      intent: "csv" as const,
      count: saved.ymm.rows.length,
      ymm: saved.ymm,
    };
  }

  if (intent !== "ymm") {
    return { error: "Unknown action" };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(String(form.get("ymm") ?? ""));
  } catch {
    return { error: "Invalid vehicle finder settings" };
  }

  extras.ymm = parseVehicleFinderAdmin(parsed);
  const saved = await saveAdminNavExtras(shop.id, extras);
  return { ok: true as const, intent: "ymm" as const, ymm: saved.ymm };
};

export default function VehicleFinderPage() {
  const data = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const navigate = useNavigate();
  const shopify = useAppBridge();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [ymm, setYmm] = useState<VehicleFinderAdmin>(data.ymm);
  const ymmRef = useRef(ymm);
  const toastSeen = useRef<string | null>(null);
  const [seenResult, setSeenResult] = useState<string | null>(null);

  const saving =
    ["loading", "submitting"].includes(fetcher.state) &&
    fetcher.formMethod === "POST";

  useEffect(() => {
    ymmRef.current = ymm;
  }, [ymm]);

  if (fetcher.data && "ok" in fetcher.data && fetcher.data.ok) {
    const key = JSON.stringify(fetcher.data);
    if (seenResult !== key) {
      setSeenResult(key);
      setYmm(fetcher.data.ymm);
    }
  }

  useEffect(() => {
    const result = fetcher.data;
    if (!result) return;
    const key = JSON.stringify(result);
    if (toastSeen.current === key) return;
    toastSeen.current = key;
    if ("ok" in result && result.ok) {
      if (result.intent === "csv") {
        shopify.toast.show(`${result.count} vehicle rows uploaded`);
      } else {
        shopify.toast.show("Vehicle Finder saved");
      }
    }
    if ("error" in result && result.error) {
      shopify.toast.show(String(result.error), { isError: true });
    }
  }, [fetcher.data, shopify]);

  const persist = (next: VehicleFinderAdmin) => {
    const formData = new FormData();
    formData.set("intent", "ymm");
    formData.set("ymm", JSON.stringify(next));
    fetcher.submit(formData, { method: "POST" });
  };

  const patch = (partial: Partial<VehicleFinderAdmin>, saveNow: boolean) => {
    setYmm((prev) => {
      const next = { ...prev, ...partial };
      if (saveNow) persist(next);
      return next;
    });
  };

  const patchField = (
    index: number,
    partial: Partial<YmmField>,
    saveNow: boolean,
  ) => {
    setYmm((prev) => {
      const fields = prev.fields.map((field, i) =>
        i === index ? { ...field, ...partial } : field,
      );
      const next = { ...prev, fields };
      if (saveNow) persist(next);
      return next;
    });
  };

  const addField = () => {
    if (ymm.fields.length >= 8) return;
    patch({ fields: [...ymm.fields, createField(ymm.fields.length)] }, true);
  };

  const removeField = (index: number) => {
    if (ymm.fields.length <= 1) return;
    patch(
      { fields: ymm.fields.filter((_, i) => i !== index) },
      true,
    );
  };

  const copyShortcode = async () => {
    try {
      await navigator.clipboard.writeText(SHORTCODE);
      shopify.toast.show("Copied");
    } catch {
      shopify.toast.show("Could not copy", { isError: true });
    }
  };

  const downloadSample = () => {
    const blob = new Blob([SAMPLE_CSV], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "vehicle-finder-sample.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const uploadCsv = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const formData = new FormData();
      formData.set("intent", "csv");
      formData.set("csv", String(reader.result ?? ""));
      formData.set("fileName", file.name);
      fetcher.submit(formData, { method: "POST" });
    };
    reader.onerror = () => {
      shopify.toast.show("Could not read CSV", { isError: true });
    };
    reader.readAsText(file);
  };

  const selectStyle: CSSProperties = {
    display: "block",
    width: "100%",
    padding: "8px 10px",
    borderRadius: ymm.radius,
    border: `1px solid ${ymm.borderColor}`,
    background: ymm.selectBg,
    color: ymm.labelColor,
  };

  return (
    <Page
      title="Vehicle Finder"
      subtitle="Upload a spreadsheet to map vehicles to products. Configure the form fields below."
      backAction={{ content: "Filters", onAction: () => navigate("/app") }}
    >
      <Layout>
        <Layout.Section variant="oneThird">
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                Settings
              </Text>
              <Checkbox
                label="On"
                checked={ymm.enabled}
                disabled={saving}
                onChange={(checked) => patch({ enabled: checked }, true)}
              />
              <TextField
                label="Form heading"
                value={ymm.heading}
                autoComplete="off"
                onChange={(value) => patch({ heading: value }, false)}
                onBlur={() => persist(ymmRef.current)}
              />
              <TextField
                label="Fitment metafield"
                value={ymm.metafieldPath}
                autoComplete="off"
                helpText="Products use values like 2020|Toyota|Camry (pipe-separated). Multiple lines or JSON list allowed on the metafield."
                onChange={(value) => patch({ metafieldPath: value }, false)}
                onBlur={() => persist(ymmRef.current)}
              />
              <Checkbox
                label="Show search input"
                checked={ymm.showSearch}
                disabled={saving}
                onChange={(checked) => patch({ showSearch: checked }, true)}
              />
              <TextField
                label="Input border radius"
                type="number"
                value={String(ymm.radius)}
                autoComplete="off"
                onChange={(value) =>
                  patch({ radius: Number(value) || 0 }, false)
                }
                onBlur={() => persist(ymmRef.current)}
              />
              <TextField
                label="Background"
                value={ymm.bg}
                autoComplete="off"
                onChange={(value) => patch({ bg: value }, false)}
                onBlur={() => persist(ymmRef.current)}
              />
              <TextField
                label="Heading text"
                value={ymm.headingColor}
                autoComplete="off"
                onChange={(value) => patch({ headingColor: value }, false)}
                onBlur={() => persist(ymmRef.current)}
              />
              <TextField
                label="Label"
                value={ymm.labelColor}
                autoComplete="off"
                onChange={(value) => patch({ labelColor: value }, false)}
                onBlur={() => persist(ymmRef.current)}
              />
              <TextField
                label="Border"
                value={ymm.borderColor}
                autoComplete="off"
                onChange={(value) => patch({ borderColor: value }, false)}
                onBlur={() => persist(ymmRef.current)}
              />
              <TextField
                label="Select background"
                value={ymm.selectBg}
                autoComplete="off"
                onChange={(value) => patch({ selectBg: value }, false)}
                onBlur={() => persist(ymmRef.current)}
              />
              <TextField
                label="Button text"
                value={ymm.btnText}
                autoComplete="off"
                onChange={(value) => patch({ btnText: value }, false)}
                onBlur={() => persist(ymmRef.current)}
              />
              <TextField
                label="Button background"
                value={ymm.btnBg}
                autoComplete="off"
                onChange={(value) => patch({ btnBg: value }, false)}
                onBlur={() => persist(ymmRef.current)}
              />
              <InlineStack gap="200" blockAlign="end" wrap>
                <div style={{ flexGrow: 1, minWidth: 200 }}>
                  <TextField
                    label="Shortcode"
                    value={SHORTCODE}
                    autoComplete="off"
                    readOnly
                    helpText='Paste this markup, or add the Theme Editor block “Vehicle finder”.'
                  />
                </div>
                <Button onClick={() => void copyShortcode()}>Copy</Button>
              </InlineStack>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <BlockStack gap="400">
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  Vehicle data
                </Text>
                <InlineStack gap="200" wrap>
                  <Button onClick={downloadSample}>Download sample</Button>
                  <Button onClick={() => fileInputRef.current?.click()}>
                    Upload
                  </Button>
                </InlineStack>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  hidden
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (!file) return;
                    uploadCsv(file);
                  }}
                />
                {ymm.rows.length > 0 ? (
                  <Banner tone="success">
                    <p>
                      {ymm.rows.length} vehicle rows uploaded
                      {ymm.fileName ? ` (${ymm.fileName})` : ""}. Fitment
                      metafield: {ymm.metafieldPath || "custom.vehicle_fitment"}.
                    </p>
                  </Banner>
                ) : (
                  <Banner tone="info">
                    <p>No vehicle data file uploaded yet.</p>
                  </Banner>
                )}
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  Fields
                </Text>
                {ymm.fields.map((field, index) => (
                  <Card key={field.id} background="bg-surface-secondary">
                    <BlockStack gap="200">
                      <TextField
                        label="Label"
                        value={field.label}
                        autoComplete="off"
                        disabled={saving}
                        onChange={(value) =>
                          patchField(index, { label: value }, false)
                        }
                        onBlur={() => persist(ymmRef.current)}
                      />
                      <Select
                        label="Value mode"
                        options={VALUE_MODE_OPTIONS}
                        value={field.valueMode}
                        disabled={saving}
                        onChange={(value) =>
                          patchField(index, { valueMode: parseMode(value) }, true)
                        }
                      />
                      {field.valueMode === "prefix" ? (
                        <TextField
                          label="Prefix"
                          value={field.prefix}
                          autoComplete="off"
                          disabled={saving}
                          onChange={(value) =>
                            patchField(index, { prefix: value }, false)
                          }
                          onBlur={() => persist(ymmRef.current)}
                        />
                      ) : null}
                      <Checkbox
                        label="Remove prefix"
                        checked={field.removePrefix}
                        disabled={saving}
                        onChange={(checked) =>
                          patchField(index, { removePrefix: checked }, true)
                        }
                      />
                      {field.valueMode === "manual" ? (
                        <TextField
                          label="Manual values"
                          value={field.manualValues.join("\n")}
                          autoComplete="off"
                          multiline={4}
                          helpText="One value per line, or comma-separated."
                          disabled={saving}
                          onChange={(value) =>
                            patchField(
                              index,
                              { manualValues: parseManualValues(value) },
                              false,
                            )
                          }
                          onBlur={() => persist(ymmRef.current)}
                        />
                      ) : null}
                      <Button
                        tone="critical"
                        disabled={saving || ymm.fields.length <= 1}
                        onClick={() => removeField(index)}
                      >
                        Remove
                      </Button>
                    </BlockStack>
                  </Card>
                ))}
                <Button
                  disabled={saving || ymm.fields.length >= 8}
                  onClick={addField}
                >
                  Add field
                </Button>
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  Preview
                </Text>
                <div
                  style={{
                    background: ymm.bg,
                    padding: 16,
                    borderRadius: ymm.radius,
                    border: `1px solid ${ymm.borderColor}`,
                  }}
                >
                  <BlockStack gap="200">
                    <div
                      style={{
                        color: ymm.headingColor,
                        fontWeight: 600,
                        fontSize: 16,
                      }}
                    >
                      {ymm.heading}
                    </div>
                    {ymm.showSearch ? (
                      <input
                        disabled
                        placeholder="Search"
                        style={selectStyle}
                      />
                    ) : null}
                    {ymm.fields.map((field) => (
                      <label
                        key={field.id}
                        style={{ color: ymm.labelColor, fontSize: 13 }}
                      >
                        {field.label}
                        <select disabled style={selectStyle} defaultValue="">
                          <option value="">-- Select --</option>
                        </select>
                      </label>
                    ))}
                    <div
                      style={{
                        display: "inline-block",
                        padding: "8px 16px",
                        background: ymm.btnBg,
                        color: ymm.btnText,
                        borderRadius: ymm.radius,
                        textAlign: "center",
                        fontWeight: 600,
                        letterSpacing: 0.4,
                      }}
                    >
                      SEARCH
                    </div>
                  </BlockStack>
                </div>
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

export const headers: HeadersFunction = (headersArgs) =>
  boundary.headers(headersArgs);
