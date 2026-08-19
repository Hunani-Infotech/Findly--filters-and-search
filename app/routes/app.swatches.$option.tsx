import { useEffect, useMemo, useRef, useState } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import {
  useActionData,
  useFetcher,
  useLoaderData,
  useNavigate,
  useNavigation,
  useParams,
  useSubmit,
} from "react-router";
import {
  Banner,
  BlockStack,
  Button,
  ButtonGroup,
  Card,
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
import { SwatchImagePicker } from "../components/swatch-image-picker";
import { hexFromColorName, isSwatchFilled } from "../color-autofill";
import {
  clearSwatch,
  importSwatches,
  listSwatchesForOption,
  upsertSwatch,
  type SwatchKind,
  type SwatchRow,
} from "../color-swatches.server";
import { listShopImages, uploadShopImage } from "../shopify-files.server";

function parseKind(value: unknown): SwatchKind {
  return value === "dual" || value === "image" ? value : "solid";
}

function toColorInput(hex: string) {
  const raw = hex.trim();
  if (/^#[0-9a-f]{6}$/i.test(raw)) return raw;
  if (/^#[0-9a-f]{3}$/i.test(raw)) {
    const r = raw[1];
    const g = raw[2];
    const b = raw[3];
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return "#ffffff";
}

function parseSwatchRows(raw: unknown, optionKey: string): SwatchRow[] {
  if (!Array.isArray(raw)) return [];
  const rows: SwatchRow[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const value = String(row.value || "").trim();
    if (!value) continue;
    rows.push({
      optionKey: String(row.optionKey || optionKey).trim() || optionKey,
      value,
      kind: parseKind(row.kind),
      color1: String(row.color1 || ""),
      color2: String(row.color2 || ""),
      imageUrl: String(row.imageUrl || ""),
    });
  }
  return rows;
}

function downloadJson(filename: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const { shop } = await ensureShopAccess(session.shop);
  const optionKey = String(params.option || "").trim();
  const data = await listSwatchesForOption(shop.id, optionKey);
  let shopFiles: Awaited<ReturnType<typeof listShopImages>> = [];
  let filesError = "";
  try {
    shopFiles = await listShopImages(admin);
  } catch (error) {
    filesError =
      error instanceof Error
        ? error.message
        : "Could not load Shopify files. Check read_files scope.";
  }
  return {
    optionKey,
    label: data.label,
    rows: data.rows,
    shopFiles,
    filesError,
  };
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const { shop } = await ensureShopAccess(session.shop);
  const form = await request.formData();
  const optionKey =
    String(params.option || "").trim() ||
    String(form.get("optionKey") || "").trim();
  const intent = String(form.get("intent") || "");

  if (intent === "clear") {
    const value = String(form.get("value") || "");
    await clearSwatch(shop.id, optionKey, value);
    return { ok: true as const, intent };
  }

  if (intent === "saveAll") {
    let parsed: unknown;
    try {
      parsed = JSON.parse(String(form.get("rows") || "[]"));
    } catch {
      return { error: "Invalid swatch payload." };
    }
    const rows = parseSwatchRows(parsed, optionKey);
    for (const row of rows) {
      await upsertSwatch(shop.id, row);
    }
    return { ok: true as const, intent };
  }

  if (intent === "import") {
    let parsed: unknown;
    try {
      parsed = JSON.parse(String(form.get("payload") || ""));
    } catch {
      return { error: "Invalid JSON file." };
    }
    const result = await importSwatches(shop.id, parsed, optionKey);
    if ("error" in result && result.error) {
      return { error: result.error };
    }
    return { ok: true as const, intent, imported: result.imported };
  }

  if (intent === "upload") {
    const value = String(form.get("value") || "");
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return { error: "Choose an image file." };
    }
    const result = await uploadShopImage(admin, {
      filename: file.name,
      mimeType: file.type || "image/png",
      bytes: Buffer.from(await file.arrayBuffer()),
    });
    if ("error" in result) return { error: result.error, intent };
    return { ok: true as const, intent, url: result.url, value };
  }

  return { error: "Unknown action." };
};

function ColorHexField({
  label,
  value,
  onCommit,
}: {
  label: string;
  value: string;
  onCommit: (next: string) => void;
}) {
  const [hex, setHex] = useState(value);
  useEffect(() => {
    setHex(value);
  }, [value]);

  return (
    <InlineStack gap="200" blockAlign="end" wrap={false}>
      <div>
        <Text as="span" variant="bodyMd">
          {label}
        </Text>
        <div style={{ marginTop: 4 }}>
          {hex.trim() ? (
            <input
              type="color"
              aria-label={label}
              value={toColorInput(hex)}
              onChange={(event) => {
                const next = event.target.value;
                setHex(next);
                onCommit(next);
              }}
              style={{
                width: 40,
                height: 32,
                padding: 0,
                border: "1px solid #c9cccf",
                borderRadius: 6,
                background: "transparent",
                cursor: "pointer",
              }}
            />
          ) : (
            <input
              type="color"
              aria-label={label}
              value="#ffffff"
              onChange={(event) => {
                const next = event.target.value;
                setHex(next);
                onCommit(next);
              }}
              style={{
                width: 40,
                height: 32,
                padding: 0,
                border: "1px dashed #8c9196",
                borderRadius: 6,
                background: "transparent",
                cursor: "pointer",
                opacity: 0.45,
              }}
            />
          )}
        </div>
      </div>
      <div style={{ minWidth: 140 }}>
        <TextField
          label="Hex"
          labelHidden
          autoComplete="off"
          placeholder="#hex"
          value={hex}
          onChange={setHex}
          onBlur={() => onCommit(hex)}
        />
      </div>
    </InlineStack>
  );
}

function SwatchEditor({
  row,
  busy,
  uploading,
  shopFiles,
  filesError,
  onChange,
  onClear,
  onUpload,
}: {
  row: SwatchRow;
  busy: boolean;
  uploading: boolean;
  shopFiles: { id: string; alt: string; url: string }[];
  filesError: string;
  onChange: (next: SwatchRow) => void;
  onClear: () => void;
  onUpload: (file: File) => void;
}) {
  const patch = (next: Partial<SwatchRow>) => onChange({ ...row, ...next });

  return (
    <Card>
      <BlockStack gap="300">
        <InlineStack align="space-between" blockAlign="center" wrap>
          <Text as="h3" variant="headingSm">
            {row.value}
          </Text>
          <Button
            tone="critical"
            variant="plain"
            disabled={busy}
            onClick={onClear}
          >
            Clear
          </Button>
        </InlineStack>
        <Text as="span" variant="bodyMd">
          Type
        </Text>
        <ButtonGroup variant="segmented">
          <Button
            pressed={row.kind === "solid"}
            disabled={busy}
            onClick={() => patch({ kind: "solid" })}
          >
            1 color
          </Button>
          <Button
            pressed={row.kind === "dual"}
            disabled={busy}
            onClick={() => patch({ kind: "dual" })}
          >
            2 colors
          </Button>
          <Button
            pressed={row.kind === "image"}
            disabled={busy}
            onClick={() => patch({ kind: "image" })}
          >
            Image
          </Button>
        </ButtonGroup>
        {row.kind === "image" ? (
          <SwatchImagePicker
            imageUrl={row.imageUrl}
            disabled={busy}
            uploading={uploading}
            shopFiles={shopFiles}
            filesError={filesError}
            onUrlChange={(imageUrl) => patch({ imageUrl })}
            onPickComputerFile={onUpload}
          />
        ) : (
          <InlineStack gap="400" wrap>
            <ColorHexField
              label="Color"
              value={row.color1}
              onCommit={(color1) => patch({ color1 })}
            />
            {row.kind === "dual" ? (
              <ColorHexField
                label="Second color"
                value={row.color2}
                onCommit={(color2) => patch({ color2 })}
              />
            ) : null}
          </InlineStack>
        )}
      </BlockStack>
    </Card>
  );
}

export default function SwatchOptionPage() {
  const { optionKey, label, rows, shopFiles, filesError } =
    useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigate = useNavigate();
  const navigation = useNavigation();
  const params = useParams();
  const submit = useSubmit();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();
  const busy =
    isMutationBusy(navigation) ||
    fetcher.state === "submitting" ||
    fetcher.state === "loading";
  const toastSeen = useRef<string | null>(null);
  const uploadApplied = useRef<string | null>(null);
  const importInput = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | "missing">("all");
  const [drafts, setDrafts] = useState(rows);
  const [dirty, setDirty] = useState(false);
  const [uploadingValue, setUploadingValue] = useState<string | null>(null);

  useEffect(() => {
    if (!dirty) setDrafts(rows);
  }, [rows, dirty]);

  useEffect(() => {
    const data = actionData ?? (fetcher.state === "idle" ? fetcher.data : undefined);
    if (!data) return;
    const key = JSON.stringify(data);
    if (toastSeen.current === key) return;
    toastSeen.current = key;
    if ("error" in data && data.error) {
      shopify.toast.show(data.error, { isError: true });
      return;
    }
    if ("intent" in data && data.intent === "saveAll") {
      setDirty(false);
      shopify.toast.show("Saved");
    }
    if ("intent" in data && data.intent === "import") {
      setDirty(false);
      const imported = "imported" in data ? data.imported : 0;
      shopify.toast.show(
        imported === 1 ? "Imported 1 swatch" : `Imported ${imported} swatches`,
      );
    }
  }, [actionData, fetcher.data, fetcher.state, shopify]);

  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data) return;
    const data = fetcher.data;
    if (!("intent" in data) || data.intent !== "upload") return;
    const stamp = JSON.stringify(data);
    if (uploadApplied.current === stamp) return;
    uploadApplied.current = stamp;
    setUploadingValue(null);
    if ("error" in data && data.error) return;
    if (!("url" in data) || !data.url) return;
    const value = "value" in data ? String(data.value || "") : "";
    setDrafts((prev) =>
      prev.map((row) =>
        row.value === value ? { ...row, imageUrl: data.url } : row,
      ),
    );
    setDirty(true);
  }, [fetcher.data, fetcher.state]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return drafts.filter((row) => {
      if (q && !row.value.toLowerCase().includes(q)) return false;
      if (status === "missing" && isSwatchFilled(row)) return false;
      return true;
    });
  }, [drafts, query, status]);

  const updateDraft = (next: SwatchRow) => {
    setDrafts((prev) =>
      prev.map((row) => (row.value === next.value ? next : row)),
    );
    setDirty(true);
  };

  const autofillDrafts = () => {
    let filled = 0;
    const next = drafts.map((row) => {
      if (isSwatchFilled(row)) return row;
      const hex = hexFromColorName(row.value);
      if (!hex) return row;
      filled += 1;
      return {
        ...row,
        kind: "solid" as const,
        color1: hex,
        color2: "",
        imageUrl: "",
      };
    });
    setDrafts(next);
    if (filled > 0) {
      setDirty(true);
      shopify.toast.show(
        filled === 1
          ? "Filled 1 color. Click Save to keep it."
          : `Filled ${filled} colors. Click Save to keep them.`,
      );
      return;
    }
    shopify.toast.show(
      "No matching color names to fill. Pick colors, then Save.",
      { isError: true },
    );
  };

  const saveAll = () => {
    submit(
      { intent: "saveAll", rows: JSON.stringify(drafts) },
      { method: "post" },
    );
  };

  const encoded = encodeURIComponent(params.option || optionKey);

  return (
    <Page
      title="Swatch"
      subtitle={label}
      backAction={{
        content: "Swatch",
        onAction: () => navigate("/app/swatches"),
      }}
      primaryAction={
        dirty
          ? {
              content: "Save",
              loading: busy && navigation.formData?.get("intent") === "saveAll",
              disabled: busy,
              onAction: saveAll,
            }
          : undefined
      }
      secondaryActions={[
        {
          content: "Auto-fill with AI",
          disabled: busy,
          onAction: autofillDrafts,
        },
        {
          content: "Import",
          disabled: busy,
          onAction: () => importInput.current?.click(),
        },
        {
          content: "Export",
          onAction: () =>
            downloadJson(`findly-swatches-${encoded}.json`, drafts),
        },
      ]}
    >
      <Layout>
        <Layout.Section>
          <BlockStack gap="400">
            <Banner tone="info">
              <p>
                Auto-fill maps catalog color names to hex values from a color
                dictionary. It is not search ranking and does not call OpenAI.
                Changes stay in this page until you Save.
              </p>
            </Banner>
            <input
              ref={importInput}
              type="file"
              accept="application/json"
              hidden
              onChange={async (event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (!file) return;
                const payload = await file.text();
                submit({ intent: "import", payload }, { method: "post" });
              }}
            />
            <Card>
              <InlineStack gap="300" wrap>
                <div style={{ minWidth: 220, flex: 1 }}>
                  <TextField
                    label="Search values"
                    autoComplete="off"
                    value={query}
                    onChange={setQuery}
                    placeholder="Search"
                  />
                </div>
                <div style={{ minWidth: 160 }}>
                  <Select
                    label="Status"
                    options={[
                      { label: "All", value: "all" },
                      { label: "Missing", value: "missing" },
                    ]}
                    value={status}
                    onChange={(next) =>
                      setStatus(next === "missing" ? "missing" : "all")
                    }
                  />
                </div>
              </InlineStack>
            </Card>
            {filtered.length === 0 ? (
              <Banner>
                <p>
                  {drafts.length === 0
                    ? "No values found for this option. Sync products, then try again."
                    : "No values match this search."}
                </p>
              </Banner>
            ) : (
              <BlockStack gap="300">
                {filtered.map((row) => (
                  <SwatchEditor
                    key={row.value}
                    row={row}
                    busy={busy}
                    uploading={uploadingValue === row.value}
                    shopFiles={shopFiles}
                    filesError={filesError}
                    onChange={updateDraft}
                    onClear={() => {
                      setDrafts((prev) =>
                        prev.map((item) =>
                          item.value === row.value
                            ? {
                                ...item,
                                kind: "solid",
                                color1: "",
                                color2: "",
                                imageUrl: "",
                              }
                            : item,
                        ),
                      );
                      fetcher.submit(
                        { intent: "clear", value: row.value },
                        { method: "post" },
                      );
                    }}
                    onUpload={(file) => {
                      setUploadingValue(row.value);
                      const form = new FormData();
                      form.set("intent", "upload");
                      form.set("value", row.value);
                      form.set("file", file);
                      fetcher.submit(form, {
                        method: "post",
                        encType: "multipart/form-data",
                      });
                    }}
                  />
                ))}
              </BlockStack>
            )}
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

export function shouldRevalidate({
  formData,
  defaultShouldRevalidate,
}: {
  formData?: FormData;
  defaultShouldRevalidate: boolean;
}) {
  const intent = formData?.get("intent");
  if (intent === "upload") return false;
  return defaultShouldRevalidate;
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
