import { useEffect, useRef, useState } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import {
  useActionData,
  useFetcher,
  useLoaderData,
  useNavigation,
  useSearchParams,
  useSubmit,
} from "react-router";
import { Banner, BlockStack, Layout, Link, Page, Text } from "@shopify/polaris";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ExportIcon,
  ImportIcon,
  MagicIcon,
  SearchIcon,
} from "@shopify/polaris-icons";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { authenticateAdminAllowReviewBot } from "../lib/admin-auth.server";
import { ensureShopAccess } from "../services/billing.server";
import { isMutationBusy } from "../components/admin-loading";
import { useConfirmDelete } from "../components/confirm-delete-modal";
import { SwatchImagePicker } from "../components/swatch-image-picker";
import {
  autofillMissingSwatches,
  clearSwatch,
  importSwatches,
  listSwatchesForOption,
  loadSwatchesAdmin,
  upsertSwatch,
  parseSwatchKind,
  type SwatchKind,
  type SwatchListStatus,
  type SwatchRow,
} from "../services/color-swatches.server";
import { listShopImages, uploadShopImage } from "../services/shopify-files.server";
import { useEmbeddedNavigate } from "../hooks/use-embedded-navigate";
import { withEmbeddedParams } from "../utils/admin-path";
import { downloadCsv, parseJsonOrCsvRecords, recordsToCsv } from "../utils/csv";
import { expandHexColor } from "../utils/hex-color";
import { useDebouncedCallback } from "../hooks/use-debounced-callback";

export { SwatchesPageSkeleton as HydrateFallback } from "../components/admin-skeletons";

/** Image swatches (upload / thumbnail picker) stay in code but are hidden until needed. */
const SHOW_IMAGE_SWATCHES = false;

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
      kind: parseSwatchKind(row.kind),
      color1: String(row.color1 || ""),
      color2: String(row.color2 || ""),
      imageUrl: String(row.imageUrl || ""),
    });
  }
  return rows;
}

function parseStatus(value: string | null): SwatchListStatus {
  return value === "missing" ? "missing" : "all";
}

function swatchesHref(
  current: URLSearchParams,
  patch: {
    option?: string;
    page?: number;
    q?: string;
    status?: SwatchListStatus;
  },
) {
  const next = new URLSearchParams(current);
  if (patch.option !== undefined) {
    next.set("option", patch.option);
    next.delete("page");
    next.delete("q");
    next.delete("status");
  }
  if (patch.page !== undefined) {
    if (patch.page <= 0) next.delete("page");
    else next.set("page", String(patch.page));
  }
  if (patch.q !== undefined) {
    const query = patch.q.trim();
    if (!query) next.delete("q");
    else next.set("q", query);
    next.delete("page");
  }
  if (patch.status !== undefined) {
    if (patch.status === "all") next.delete("status");
    else next.set("status", patch.status);
    next.delete("page");
  }
  const qs = next.toString();
  return qs ? `/app/swatches?${qs}` : "/app/swatches";
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const auth = await authenticateAdminAllowReviewBot(request);
  if (auth.bot) {
    return {
      optionKey: "",
      label: "",
      options: [] as Array<{
        optionKey: string;
        label: string;
        valueCount: number;
        missing: number;
      }>,
      rows: [] as SwatchRow[],
      total: 0,
      page: 0,
      pageCount: 1,
      showingFrom: 0,
      showingTo: 0,
      query: "",
      status: "all" as SwatchListStatus,
      shopFiles: [] as Awaited<ReturnType<typeof listShopImages>>,
      filesError: "",
    };
  }
  const { admin, session } = auth;
  const { shop } = await ensureShopAccess(session.shop);
  const url = new URL(request.url);
  const data = await loadSwatchesAdmin(
    shop.id,
    String(url.searchParams.get("option") || "").trim(),
    {
      page: Number(url.searchParams.get("page") || "0") || 0,
      query: String(url.searchParams.get("q") || ""),
      status: parseStatus(url.searchParams.get("status")),
    },
  );
  let shopFiles: Awaited<ReturnType<typeof listShopImages>> = [];
  let filesError = "";
  if (SHOW_IMAGE_SWATCHES && data.optionKey) {
    try {
      shopFiles = await listShopImages(admin);
    } catch (error) {
      filesError =
        error instanceof Error
          ? error.message
          : "Could not load Shopify files. Check read_files scope.";
    }
  }
  return {
    ...data,
    shopFiles,
    filesError,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const { shop } = await ensureShopAccess(session.shop);
  const form = await request.formData();
  const optionKey = String(form.get("optionKey") || "").trim();
  const intent = String(form.get("intent") || "");

  if (intent === "clear") {
    const value = String(form.get("value") || "");
    await clearSwatch(shop.id, optionKey, value);
    return { ok: true as const, intent };
  }

  if (intent === "upsert") {
    const rows = parseSwatchRows(
      [
        {
          optionKey,
          value: String(form.get("value") || ""),
          kind: String(form.get("kind") || ""),
          color1: String(form.get("color1") || ""),
          color2: String(form.get("color2") || ""),
          imageUrl: String(form.get("imageUrl") || ""),
        },
      ],
      optionKey,
    );
    if (!rows[0]) return { error: "Invalid swatch payload." };
    await upsertSwatch(shop.id, rows[0]);
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
      parsed = parseJsonOrCsvRecords(String(form.get("payload") || ""));
    } catch {
      return { error: "Invalid CSV or JSON file." };
    }
    const result = await importSwatches(shop.id, parsed, optionKey);
    if ("error" in result && result.error) {
      return { error: result.error };
    }
    return { ok: true as const, intent, imported: result.imported };
  }

  if (intent === "autofill") {
    const result = await autofillMissingSwatches(shop.id, optionKey);
    return { ok: true as const, intent, filled: result.filled };
  }

  if (intent === "export") {
    const data = await listSwatchesForOption(shop.id, optionKey);
    return { ok: true as const, intent, payload: data.rows };
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
    return {
      ok: true as const,
      intent,
      url: result.url,
      value,
      id: result.id,
      alt: result.alt,
    };
  }

  return { error: "Unknown action." };
};

function normalizeHexOnBlur(raw: string) {
  const trimmed = raw.trim();
  if (/^[0-9a-f]{6}$/i.test(trimmed)) return `#${trimmed}`;
  return trimmed;
}

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
  const [seenValue, setSeenValue] = useState(value);
  if (value !== seenValue) {
    setSeenValue(value);
    setHex(value);
  }
  const filled = Boolean(value.trim());
  return (
    <div className="findly-swatch-hex">
      <label
        className={
          filled
            ? "findly-swatch-hex-chip"
            : "findly-swatch-hex-chip is-empty"
        }
      >
        <input
          type="color"
          aria-label={label}
          value={expandHexColor(hex || value, "#ffffff")}
          onChange={(event) => {
            const next = event.target.value;
            setHex(next);
            onCommit(next);
          }}
        />
      </label>
      <input
        type="text"
        className="findly-swatch-hex-input"
        placeholder="#hex"
        aria-label={`${label} hex`}
        value={hex}
        onChange={(event) => setHex(event.target.value)}
        onBlur={() => {
          const next = normalizeHexOnBlur(hex);
          setHex(next);
          onCommit(next);
        }}
      />
    </div>
  );
}

function ValuePreview({ row }: { row: SwatchRow }) {
  const color1 = row.color1.trim();
  const color2 = row.color2.trim();
  const imageUrl = row.imageUrl.trim();
  const classNames = ["findly-swatch-preview"];
  let style: { background?: string; backgroundImage?: string } | undefined;

  if (row.kind === "image" && imageUrl) {
    classNames.push("findly-swatch-preview--image");
    style = { backgroundImage: `url(${imageUrl})` };
  } else if (row.kind === "dual" && color1 && color2) {
    classNames.push("findly-swatch-preview--dual");
    style = {
      background: `linear-gradient(135deg, ${color1} 50%, ${color2} 50%)`,
    };
  } else if ((row.kind === "solid" || row.kind === "dual") && color1) {
    style = { background: color1 };
  } else {
    classNames.push("findly-swatch-preview--empty");
  }

  return (
    <span className={classNames.join(" ")} style={style} aria-hidden />
  );
}

export default function SwatchesPage() {
  const {
    optionKey,
    label,
    rows,
    options,
    total,
    page,
    pageCount,
    showingFrom,
    showingTo,
    query: loadedQuery,
    status: loadedStatus,
    shopFiles,
    filesError,
  } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigate = useEmbeddedNavigate();
  const navigation = useNavigation();
  const [searchParams] = useSearchParams();
  const submit = useSubmit();
  const fetcher = useFetcher<typeof action>();
  const exportFetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();
  const { ask, dialog } = useConfirmDelete();
  const busy =
    isMutationBusy(navigation) ||
    fetcher.state === "submitting" ||
    fetcher.state === "loading";
  const toastSeen = useRef<string | null>(null);
  const importInput = useRef<HTMLInputElement>(null);
  const lastExportKey = useRef<string | null>(null);

  const [query, setQuery] = useState(loadedQuery);
  const {
    run: scheduleSearch,
    flush: flushSearch,
    flushPending,
  } = useDebouncedCallback((next: string) => {
    if (next.trim() === loadedQuery.trim()) return;
    navigate(swatchesHref(searchParams, { q: next }));
  });
  const [selected, setSelected] = useState<string[]>([]);
  const [drafts, setDrafts] = useState(rows);
  const [uploadingValue, setUploadingValue] = useState<string | null>(null);
  const [imageValue, setImageValue] = useState<string | null>(null);
  const [seenRows, setSeenRows] = useState(rows);
  const [seenOption, setSeenOption] = useState(optionKey);
  const [seenUpload, setSeenUpload] = useState<string | null>(null);
  const [pendingUploadSave, setPendingUploadSave] = useState<SwatchRow | null>(
    null,
  );
  const [gallery, setGallery] = useState(shopFiles);
  const [seenFiles, setSeenFiles] = useState(shopFiles);

  const [seenQuery, setSeenQuery] = useState(loadedQuery);
  if (loadedQuery !== seenQuery) {
    setSeenQuery(loadedQuery);
    setQuery(loadedQuery);
  }
  if (optionKey !== seenOption) {
    setSeenOption(optionKey);
    setSeenRows(rows);
    setDrafts(rows);
    setQuery(loadedQuery);
    setSeenQuery(loadedQuery);
    setSelected([]);
    setImageValue(null);
  } else if (rows !== seenRows) {
    setSeenRows(rows);
    setDrafts(rows);
  }

  if (shopFiles !== seenFiles) {
    setSeenFiles(shopFiles);
    setGallery(shopFiles);
  }

  const persistRow = (row: SwatchRow) => {
    fetcher.submit(
      {
        intent: "upsert",
        optionKey: row.optionKey || optionKey,
        value: row.value,
        kind: row.kind,
        color1: row.color1,
        color2: row.color2,
        imageUrl: row.imageUrl,
      },
      { method: "post" },
    );
  };

  const uploadData =
    fetcher.state === "idle" &&
    fetcher.data &&
    "intent" in fetcher.data &&
    fetcher.data.intent === "upload"
      ? fetcher.data
      : null;
  const stamp = uploadData ? JSON.stringify(uploadData) : null;
  if (stamp && stamp !== seenUpload) {
    setSeenUpload(stamp);
    setUploadingValue(null);
    if (
      uploadData &&
      !("error" in uploadData && uploadData.error) &&
      "url" in uploadData &&
      uploadData.url
    ) {
      const value =
        "value" in uploadData ? String(uploadData.value || "") : "";
      const imageUrl = uploadData.url;
      const saved: SwatchRow = {
        optionKey,
        value,
        kind: "image",
        color1: "",
        color2: "",
        imageUrl,
      };
      setDrafts((prev) =>
        prev.map((row) => (row.value === value ? { ...row, ...saved } : row)),
      );
      setGallery((prev) => {
        if (prev.some((file) => file.url === imageUrl)) return prev;
        return [
          {
            id: ("id" in uploadData && uploadData.id) || imageUrl,
            alt: ("alt" in uploadData && uploadData.alt) || "Uploaded image",
            url: imageUrl,
          },
          ...prev,
        ];
      });
      setImageValue(null);
      setPendingUploadSave(saved);
    }
  }

  useEffect(() => {
    if (!pendingUploadSave) return;
    persistRow(pendingUploadSave);
    shopify.toast.show("Image uploaded");
    // persistRow is recreated each render; the pending row is the handshake.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingUploadSave]);

  useEffect(() => {
    const toastData =
      actionData ?? (fetcher.state === "idle" ? fetcher.data : undefined);
    if (!toastData) return;
    const key = JSON.stringify(toastData);
    if (toastSeen.current === key) return;
    toastSeen.current = key;
    if ("error" in toastData && toastData.error) {
      shopify.toast.show(toastData.error, { isError: true });
      return;
    }
    if ("intent" in toastData && toastData.intent === "saveAll") {
      shopify.toast.show("Saved");
    }
    if ("intent" in toastData && toastData.intent === "autofill") {
      const filled = "filled" in toastData ? Number(toastData.filled) || 0 : 0;
      shopify.toast.show(
        filled === 0
          ? "No matching color names to fill. Pick colors."
          : filled === 1
            ? "Filled 1 color."
            : `Filled ${filled} colors.`,
        filled === 0 ? { isError: true } : undefined,
      );
    }
    if ("intent" in toastData && toastData.intent === "import") {
      const imported = "imported" in toastData ? toastData.imported : 0;
      shopify.toast.show(
        imported === 1 ? "Imported 1 swatch" : `Imported ${imported} swatches`,
      );
    }
  }, [actionData, fetcher.data, fetcher.state, shopify]);

  useEffect(() => {
    const result = exportFetcher.data;
    if (!result || !("ok" in result) || !result.ok) return;
    if (!("intent" in result) || result.intent !== "export") return;
    if (!("payload" in result) || !result.payload) return;
    const key = JSON.stringify(result.payload);
    if (lastExportKey.current === key) return;
    lastExportKey.current = key;
    downloadCsv(
      `findly-swatches-${encodeURIComponent(optionKey || "swatches")}.csv`,
      recordsToCsv(
        Array.isArray(result.payload)
          ? (result.payload as Array<Record<string, unknown>>)
          : [],
        ["optionKey", "value", "kind", "color1", "color2", "imageUrl"],
      ),
    );
  }, [exportFetcher.data, optionKey]);

  const paged = drafts;

  const patchRow = (value: string, next: Partial<SwatchRow>) => {
    let saved: SwatchRow | null = null;
    setDrafts((prev) =>
      prev.map((row) => {
        if (row.value !== value) return row;
        saved = { ...row, ...next };
        return saved;
      }),
    );
    if (saved) persistRow(saved);
  };

  const autofillDrafts = () => {
    fetcher.submit({ intent: "autofill", optionKey }, { method: "post" });
  };

  const imageRow = drafts.find((row) => row.value === imageValue) || null;

  if (options.length === 0) {
    return (
      <Page
        title="Swatch"
        backAction={{ content: "Filters", onAction: () => navigate("/app/filters") }}
      >
        <Layout>
          <Layout.Section>
            <BlockStack gap="400">
              <Banner tone="info" title="No color options yet">
                <p>
                  Run a{" "}
                  <Link
                    url={withEmbeddedParams("/app/sync", searchParams)}
                    removeUnderline
                  >
                    product sync
                  </Link>{" "}
                  so Findly can list variant option names (Color, Finish, and
                  similar). Swatches appear on this page after that sync.
                </p>
              </Banner>
            </BlockStack>
          </Layout.Section>
        </Layout>
        {dialog}
      </Page>
    );
  }

  return (
    <Page
      title="Swatch"
      fullWidth
      backAction={{ content: "Filters", onAction: () => navigate("/app/filters") }}
      secondaryActions={[
        {
          content: "Auto-fill with AI",
          icon: MagicIcon,
          disabled: busy,
          onAction: autofillDrafts,
        },
        {
          content: "Import",
          icon: ImportIcon,
          disabled: busy,
          onAction: () => importInput.current?.click(),
        },
        {
          content: "Export",
          icon: ExportIcon,
          loading: exportFetcher.state !== "idle",
          onAction: () =>
            exportFetcher.submit(
              { intent: "export", optionKey },
              { method: "post" },
            ),
        },
      ]}
    >
      <input
        ref={importInput}
        type="file"
        accept=".csv,.json,text/csv,application/json"
        hidden
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          const payload = await file.text();
          submit(
            { intent: "import", optionKey, payload },
            { method: "post" },
          );
        }}
      />
      <BlockStack gap="400">
      <div className="findly-swatch-workspace">
        <div className="findly-swatch-options">
          {options.map((option) => {
            const active = option.optionKey === optionKey;
            return (
              <button
                key={option.optionKey}
                type="button"
                className={
                  active
                    ? "findly-swatch-option findly-swatch-option--selected"
                    : "findly-swatch-option"
                }
                onClick={() =>
                  navigate(swatchesHref(searchParams, { option: option.optionKey }))
                }
              >
                <span className="findly-swatch-option-label">
                  {option.label}
                </span>
                {option.missing > 0 ? (
                  <span className="findly-swatch-option-badge">
                    {option.missing} missing
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
        <div className="findly-swatch-main">
          <div className="findly-swatch-toolbar">
            <div className="findly-swatch-search">
              <span className="findly-swatch-search-icon" aria-hidden>
                <SearchIcon width={16} height={16} />
              </span>
              <input
                type="search"
                value={query}
                placeholder="Search..."
                aria-label="Search values"
                onChange={(event) => {
                  const next = event.target.value;
                  setQuery(next);
                  if (!next.trim()) {
                    flushSearch("");
                    return;
                  }
                  scheduleSearch(next);
                }}
                onKeyDown={(event) => {
                  if (event.key !== "Enter") return;
                  event.preventDefault();
                  flushSearch(query);
                }}
                onBlur={() => flushPending()}
              />
            </div>
            <select
              aria-label="Status"
              value={loadedStatus}
              onChange={(event) => {
                navigate(
                  swatchesHref(searchParams, {
                    status:
                      event.target.value === "missing" ? "missing" : "all",
                  }),
                );
              }}
            >
              <option value="all">All</option>
              <option value="missing">Missing</option>
            </select>
          </div>
          {selected.length > 0 ? (
            <div style={{ margin: "8px 0" }}>
              <button
                type="button"
                className="findly-swatch-clear"
                disabled={busy}
                onClick={async () => {
                  const ok = await ask({
                    title:
                      selected.length === 1
                        ? "Clear this swatch?"
                        : `Clear ${selected.length} swatches?`,
                    message:
                      "Saved colors and images for these values will be removed.",
                    confirmLabel: "Clear",
                  });
                  if (!ok) return;
                  selected.forEach((value) => {
                    setDrafts((prev) =>
                      prev.map((item) =>
                        item.value === value
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
                      { intent: "clear", optionKey, value },
                      { method: "post" },
                    );
                  });
                  setSelected([]);
                }}
              >
                Clear selected
              </button>
            </div>
          ) : null}
          {paged.length === 0 ? (
            <div style={{ padding: "24px 8px" }}>
              <Text as="p" tone="subdued">
                {total === 0
                  ? loadedQuery.trim() || loadedStatus === "missing"
                    ? "No values match this search."
                    : `No values found for ${label || "this option"}. Sync products, then try again.`
                  : "No values match this search."}
              </Text>
            </div>
          ) : (
            <div className="findly-swatch-table">
              <div className="findly-swatch-table-head">
                <span />
                <span>Value</span>
                <span>Type</span>
                <span>{SHOW_IMAGE_SWATCHES ? "Color & Image" : "Color"}</span>
              </div>
              {paged.map((row) => (
                <div className="findly-swatch-table-row" key={row.value}>
                  <input
                    type="checkbox"
                    aria-label={`Select ${row.value}`}
                    checked={selected.includes(row.value)}
                    disabled={busy}
                    onChange={(event) =>
                      setSelected((prev) =>
                        event.target.checked
                          ? [...prev, row.value]
                          : prev.filter((value) => value !== row.value),
                      )
                    }
                  />
                  <span className="findly-swatch-table-value">
                    <ValuePreview row={row} />
                    {row.value}
                  </span>
                  <div className="findly-swatch-type">
                    {(
                      (
                        SHOW_IMAGE_SWATCHES
                          ? [
                              ["solid", "1 color"],
                              ["dual", "2 colors"],
                              ["image", "Image"],
                            ]
                          : [
                              ["solid", "1 color"],
                              ["dual", "2 colors"],
                            ]
                      ) as ReadonlyArray<readonly [SwatchKind, string]>
                    ).map(([kind, caption]) => (
                      <button
                        key={kind}
                        type="button"
                        className={
                          (row.kind === kind ||
                            (!SHOW_IMAGE_SWATCHES &&
                              kind === "solid" &&
                              row.kind === "image"))
                            ? "findly-swatch-type-btn is-active"
                            : "findly-swatch-type-btn"
                        }
                        disabled={busy}
                        onClick={() => patchRow(row.value, { kind })}
                      >
                        {caption}
                      </button>
                    ))}
                  </div>
                  <div className="findly-swatch-slots">
                    {SHOW_IMAGE_SWATCHES && row.kind === "image" ? (
                      <button
                        type="button"
                        className={
                          row.imageUrl
                            ? "findly-swatch-slot findly-swatch-slot--image findly-swatch-slot--thumb"
                            : "findly-swatch-slot findly-swatch-slot--empty findly-swatch-slot--thumb"
                        }
                        aria-label={`Choose image for ${row.value}`}
                        disabled={busy}
                        onClick={() => setImageValue(row.value)}
                        style={
                          row.imageUrl
                            ? { backgroundImage: `url(${row.imageUrl})` }
                            : undefined
                        }
                      />
                    ) : row.kind === "dual" ? (
                      <>
                        <ColorHexField
                          label={`${row.value} color`}
                          value={row.color1}
                          onCommit={(color1) =>
                            patchRow(row.value, { color1 })
                          }
                        />
                        <ColorHexField
                          label={`${row.value} second color`}
                          value={row.color2}
                          onCommit={(color2) =>
                            patchRow(row.value, { color2 })
                          }
                        />
                      </>
                    ) : (
                      <ColorHexField
                        label={`${row.value} color`}
                        value={row.color1}
                        onCommit={(color1) =>
                          patchRow(row.value, { color1 })
                        }
                      />
                    )}
                    <button
                      type="button"
                      className="findly-swatch-clear"
                      disabled={busy}
                      onClick={async () => {
                        const ok = await ask({
                          title: "Clear this swatch?",
                          message:
                            "Saved colors and images for these values will be removed.",
                          confirmLabel: "Clear",
                        });
                        if (!ok) return;
                        const cleared = {
                          ...row,
                          kind: "solid" as const,
                          color1: "",
                          color2: "",
                          imageUrl: "",
                        };
                        setDrafts((prev) =>
                          prev.map((item) =>
                            item.value === row.value ? cleared : item,
                          ),
                        );
                        fetcher.submit(
                          { intent: "clear", optionKey, value: row.value },
                          { method: "post" },
                        );
                      }}
                    >
                      Clear
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="findly-swatch-pager">
            {total > 0 ? (
              <span className="findly-swatch-pager-label">
                {`Showing ${showingFrom}–${showingTo} of ${total}`}
              </span>
            ) : null}
            <button
              type="button"
              aria-label="Previous page"
              disabled={page <= 0 || busy}
              onClick={() =>
                navigate(swatchesHref(searchParams, { page: page - 1 }))
              }
            >
              <ChevronLeftIcon width={14} height={14} />
            </button>
            <button
              type="button"
              aria-label="Next page"
              disabled={page >= pageCount - 1 || busy}
              onClick={() =>
                navigate(swatchesHref(searchParams, { page: page + 1 }))
              }
            >
              <ChevronRightIcon width={14} height={14} />
            </button>
          </div>
        </div>
      </div>
      {SHOW_IMAGE_SWATCHES ? (
      <SwatchImagePicker
        imageUrl={imageRow?.imageUrl || ""}
        disabled={busy}
        uploading={uploadingValue === imageValue}
        shopFiles={gallery}
        filesError={filesError}
        hideTrigger
        open={Boolean(imageValue)}
        onOpenChange={(next) => {
          if (!next) setImageValue(null);
        }}
        onUrlChange={(imageUrl) => {
          if (!imageValue) return;
          patchRow(imageValue, { kind: "image", imageUrl });
          setImageValue(null);
        }}
        onPickComputerFile={(file) => {
          if (!imageValue) return;
          setUploadingValue(imageValue);
          const form = new FormData();
          form.set("intent", "upload");
          form.set("optionKey", optionKey);
          form.set("value", imageValue);
          form.set("file", file);
          fetcher.submit(form, {
            method: "post",
            encType: "multipart/form-data",
          });
        }}
      />
      ) : null}
      </BlockStack>
      {dialog}
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
  if (intent === "upload" || intent === "upsert" || intent === "clear") {
    return false;
  }
  return defaultShouldRevalidate;
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
