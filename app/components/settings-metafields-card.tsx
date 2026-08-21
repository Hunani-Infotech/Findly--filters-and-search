import { useEffect, useMemo, useState } from "react";
import { useFetcher } from "react-router";
import {
  BlockStack,
  Button,
  Checkbox,
  InlineStack,
  Popover,
  Select,
  Text,
  TextField,
} from "@shopify/polaris";
import { PlusIcon, RefreshIcon, XSmallIcon } from "@shopify/polaris-icons";
import { useAppBridge } from "@shopify/app-bridge-react";
import { useConfirmDelete } from "./confirm-delete-modal";
import {
  DEFAULT_NEW_APPLIES,
  METAFIELD_APPLY_KEYS,
  isValidMetafieldPart,
  type MetafieldApplyKey,
} from "../metafield-applies";
import type { SettingsMetafieldRow } from "../settings-metafields.server";
import type { MetafieldOwnerTypeValue } from "../metafield-owner";

const RESOURCE_OPTIONS = [
  { label: "Product", value: "PRODUCT" },
  { label: "Variant", value: "VARIANT" },
];

const APPLY_LABELS: Record<MetafieldApplyKey, string> = {
  display: "Display",
  search: "Search",
  filter: "Filter",
  sort: "Sort",
};

type FetcherData =
  | { ok: true; intent: "save-metafields"; rows: SettingsMetafieldRow[] }
  | { ok: true; intent: "sync-metafields"; added: number; extras: SettingsMetafieldRow[] }
  | { error: string };

function newDraftRow(): SettingsMetafieldRow {
  return {
    clientId: `new-${crypto.randomUUID()}`,
    ownerType: "PRODUCT",
    namespace: "",
    key: "",
    displayLabel: "",
    filterType: "LIST",
    appliesTo: [...DEFAULT_NEW_APPLIES],
  };
}

function AppliesToField({
  value,
  disabled,
  onChange,
}: {
  value: MetafieldApplyKey[];
  disabled?: boolean;
  onChange: (next: MetafieldApplyKey[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = new Set(value);
  const summary =
    value.length === 0
      ? "Select"
      : value.map((key) => APPLY_LABELS[key].toLowerCase()).join(", ");

  return (
    <Popover
      active={open}
      activator={
        <button
          type="button"
          className="findly-meta-applies"
          disabled={disabled}
          onClick={() => setOpen((current) => !current)}
        >
          {summary}
        </button>
      }
      onClose={() => setOpen(false)}
    >
      <div className="findly-meta-applies__menu">
        <BlockStack gap="200">
          {METAFIELD_APPLY_KEYS.map((key) => (
            <Checkbox
              key={key}
              label={APPLY_LABELS[key]}
              checked={selected.has(key)}
              disabled={disabled}
              onChange={(checked) => {
                const next = METAFIELD_APPLY_KEYS.filter((item) =>
                  item === key ? checked : selected.has(item),
                );
                onChange(next);
              }}
            />
          ))}
        </BlockStack>
      </div>
    </Popover>
  );
}

export function SettingsMetafieldsCard({
  initialRows,
  plan,
  filterLimit,
}: {
  initialRows: SettingsMetafieldRow[];
  plan: string;
  filterLimit: number;
}) {
  const fetcher = useFetcher<FetcherData>();
  const shopify = useAppBridge();
  const { ask, dialog } = useConfirmDelete();
  const [rows, setRows] = useState(initialRows);
  const [loaderRows, setLoaderRows] = useState(initialRows);
  if (initialRows !== loaderRows) {
    setLoaderRows(initialRows);
    setRows(initialRows.length ? initialRows : []);
  }

  const busy = fetcher.state !== "idle";

  useEffect(() => {
    const data = fetcher.data;
    if (!data) return;
    if ("error" in data && data.error) {
      shopify.toast.show(data.error, { isError: true });
      return;
    }
    if ("ok" in data && data.ok && data.intent === "save-metafields") {
      shopify.toast.show("Metafields saved");
      setRows(data.rows);
      setLoaderRows(data.rows);
    }
    if ("ok" in data && data.ok && data.intent === "sync-metafields") {
      if (data.extras.length) {
        setRows((current) => [...current, ...data.extras]);
      }
      shopify.toast.show(
        data.added
          ? `Added ${data.added} metafield${data.added === 1 ? "" : "s"} from Shopify`
          : "Metafield definitions are up to date",
      );
    }
  }, [fetcher.data, shopify]);

  const empty = rows.length === 0;
  const filterCount = useMemo(
    () => rows.filter((row) => row.appliesTo.includes("filter")).length,
    [rows],
  );

  const patchRow = (clientId: string, patch: Partial<SettingsMetafieldRow>) => {
    setRows((current) =>
      current.map((row) => (row.clientId === clientId ? { ...row, ...patch } : row)),
    );
  };

  const saveRows = (next = rows) => {
    const incomplete = next.filter((row) => {
      const namespace = row.namespace.trim();
      const key = row.key.trim();
      if (!namespace && !key) return false;
      return (
        !namespace ||
        !key ||
        !isValidMetafieldPart(namespace) ||
        !isValidMetafieldPart(key)
      );
    });
    if (incomplete.length) {
      shopify.toast.show(
        "Each metafield needs a valid namespace and key (letters, numbers, hyphen, underscore).",
        { isError: true },
      );
      return;
    }
    const formData = new FormData();
    formData.set("intent", "save-metafields");
    formData.set("mappings", JSON.stringify(next));
    fetcher.submit(formData, { method: "POST" });
  };

  const syncDefinitions = () => {
    const formData = new FormData();
    formData.set("intent", "sync-metafields");
    formData.set("mappings", JSON.stringify(rows));
    fetcher.submit(formData, { method: "POST" });
  };

  return (
    <div className="findly-meta-card">
      <div className="findly-meta-card__head">
        <div>
          <Text as="h2" variant="headingMd">
            Metafields
          </Text>
          <Text as="p" variant="bodySm" tone="subdued">
            List the metafields to search, filter, sort, and display.
          </Text>
        </div>
        <Button
          icon={RefreshIcon}
          disabled={busy}
          onClick={syncDefinitions}
        >
          Sync metafields
        </Button>
      </div>

      {empty ? (
        <div className="findly-meta-empty">
          <div className="findly-meta-empty__art" aria-hidden>
            <span className="findly-meta-empty__bar findly-meta-empty__bar--teal" />
            <span className="findly-meta-empty__bar findly-meta-empty__bar--orange" />
            <span className="findly-meta-empty__bar findly-meta-empty__bar--red" />
          </div>
          <Text as="p" variant="headingSm">
            Declare your first metafield
          </Text>
          <Text as="p" variant="bodySm" tone="subdued">
            Declare your product/variation metadata fields here to
            sort/display/filter/search products by metafield across your entire
            site.
          </Text>
          <Button
            variant="primary"
            icon={PlusIcon}
            disabled={busy}
            onClick={() => setRows([newDraftRow()])}
          >
            Add Metafield
          </Button>
        </div>
      ) : (
        <BlockStack gap="300">
          <div className="findly-meta-table">
            <div className="findly-meta-table__head">
              <span>Resource</span>
              <span>Namespace</span>
              <span>Key</span>
              <span>Applies to</span>
              <span />
            </div>
            {rows.map((row) => (
              <div className="findly-meta-table__row" key={row.clientId}>
                <Select
                  label="Resource"
                  labelHidden
                  options={RESOURCE_OPTIONS}
                  value={row.ownerType}
                  disabled={busy}
                  onChange={(value) =>
                    patchRow(row.clientId, {
                      ownerType: value as MetafieldOwnerTypeValue,
                    })
                  }
                />
                <TextField
                  label="Namespace"
                  labelHidden
                  placeholder="Namespace"
                  value={row.namespace}
                  autoComplete="off"
                  disabled={busy}
                  onChange={(namespace) => patchRow(row.clientId, { namespace })}
                />
                <TextField
                  label="Key"
                  labelHidden
                  placeholder="Key"
                  value={row.key}
                  autoComplete="off"
                  disabled={busy}
                  onChange={(key) =>
                    patchRow(row.clientId, {
                      key,
                      displayLabel: row.displayLabel || key,
                    })
                  }
                />
                <AppliesToField
                  value={row.appliesTo}
                  disabled={busy}
                  onChange={(appliesTo) => patchRow(row.clientId, { appliesTo })}
                />
                <button
                  type="button"
                  className="findly-meta-table__remove"
                  aria-label="Remove metafield"
                  disabled={busy}
                  onClick={async () => {
                    const ok = await ask({
                      title: "Remove this metafield?",
                      message: "It will be dropped from search, filter, and display when you save.",
                      confirmLabel: "Remove",
                    });
                    if (!ok) return;
                    setRows((current) =>
                      current.filter((item) => item.clientId !== row.clientId),
                    );
                  }}
                >
                  <XSmallIcon />
                </button>
              </div>
            ))}
          </div>
          <InlineStack align="space-between" blockAlign="center" wrap>
            <Button
              icon={PlusIcon}
              disabled={busy}
              onClick={() => setRows((current) => [...current, newDraftRow()])}
            >
              Add metafield
            </Button>
            <InlineStack gap="300" blockAlign="center">
              <Text as="span" variant="bodySm" tone="subdued">
                Filter metafields: {filterCount}/{filterLimit} on {plan}
              </Text>
              <Button
                variant="primary"
                loading={busy}
                onClick={() => saveRows()}
              >
                Save
              </Button>
            </InlineStack>
          </InlineStack>
        </BlockStack>
      )}
      {dialog}
    </div>
  );
}
