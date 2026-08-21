import { useEffect, useMemo, useRef, useState } from "react";
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
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  PlusIcon,
  RefreshIcon,
  XSmallIcon,
} from "@shopify/polaris-icons";
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
import type { MetafieldFilterType } from "@prisma/client";

import { ADMIN_TABLE_PAGE_SIZE, lastPageIndex, slicePage } from "../admin-list-page";

const RESOURCE_OPTIONS = [
  { label: "Product", value: "PRODUCT" },
  { label: "Variant", value: "VARIANT" },
];

const FILTER_TYPE_OPTIONS: Array<{ label: string; value: MetafieldFilterType }> =
  [
    { label: "List", value: "LIST" },
    { label: "Range", value: "RANGE" },
    { label: "Yes / No", value: "BOOLEAN" },
  ];

const APPLY_LABELS: Record<MetafieldApplyKey, string> = {
  display: "Display",
  search: "Search",
  filter: "Filter",
  sort: "Sort",
};

type FetcherData =
  | { ok: true; intent: "save-metafields"; rows: SettingsMetafieldRow[] }
  | {
      ok: true;
      intent: "sync-metafields";
      added: number;
      extras: SettingsMetafieldRow[];
      rows?: SettingsMetafieldRow[];
    }
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
            <BlockStack key={key} gap="050">
              <Checkbox
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
              {key === "sort" ? (
                <Text as="p" variant="bodySm" tone="subdued">
                  Saved on the mapping. Storefront sort does not use metafields
                  yet.
                </Text>
              ) : null}
            </BlockStack>
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
  const [savedRows, setSavedRows] = useState(initialRows);
  const [seenInitial, setSeenInitial] = useState(initialRows);
  const [page, setPage] = useState(0);
  if (initialRows !== seenInitial) {
    setSeenInitial(initialRows);
    setSavedRows(initialRows);
    setRows(initialRows);
    setPage(0);
  }

  const [appliedFetcher, setAppliedFetcher] = useState<FetcherData | undefined>(
    undefined,
  );
  if (fetcher.data && fetcher.data !== appliedFetcher) {
    setAppliedFetcher(fetcher.data);
    if ("ok" in fetcher.data && fetcher.data.ok) {
      if (fetcher.data.intent === "save-metafields") {
        const saved = fetcher.data.rows;
        setRows(saved);
        setSavedRows(saved);
        setPage((current) => Math.min(current, lastPageIndex(saved.length)));
      }
      if (fetcher.data.intent === "sync-metafields") {
        if (fetcher.data.rows) {
          setRows(fetcher.data.rows);
          setSavedRows(fetcher.data.rows);
          setPage(lastPageIndex(fetcher.data.rows.length));
        } else if (fetcher.data.extras.length) {
          const extras = fetcher.data.extras;
          const nextCount = rows.length + extras.length;
          setRows((current) => [...current, ...extras]);
          setPage(lastPageIndex(nextCount));
        }
      }
    }
  }

  const busy = fetcher.state !== "idle";
  const toastSeen = useRef<FetcherData | undefined>(undefined);

  useEffect(() => {
    const data = fetcher.data;
    if (!data || toastSeen.current === data) return;
    toastSeen.current = data;
    if ("error" in data && data.error) {
      shopify.toast.show(data.error, { isError: true });
      return;
    }
    if ("ok" in data && data.ok && data.intent === "save-metafields") {
      shopify.toast.show("Metafields saved");
    }
    if ("ok" in data && data.ok && data.intent === "sync-metafields") {
      shopify.toast.show(
        data.added
          ? `Added ${data.added} metafield${data.added === 1 ? "" : "s"} from Shopify`
          : "Metafield definitions are up to date",
      );
    }
  }, [fetcher.data, shopify]);

  const empty = rows.length === 0;
  const pendingClear = empty && savedRows.length > 0;
  const filterCount = useMemo(
    () => rows.filter((row) => row.appliesTo.includes("filter")).length,
    [rows],
  );
  const slice = slicePage(rows, page, ADMIN_TABLE_PAGE_SIZE);
  if (page !== slice.safePage) setPage(slice.safePage);
  const paged = slice.paged;
  const showingFrom = slice.showingFrom;
  const showingTo = slice.showingTo;
  const pageCount = slice.pageCount;
  const safePage = slice.safePage;

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
            Declare product and variant metafields for filters and search. Tick
            Filter to add a collection facet. Tick Search, and keep Metafield
            enabled on Search → Search fields, to query those values.
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
            {pendingClear
              ? "Save to remove all metafields"
              : "Declare your first metafield"}
          </Text>
          <Text as="p" variant="bodySm" tone="subdued">
            {pendingClear
              ? "These mappings are still saved until you click Save. That drops them from search, filter, and display."
              : "Declare product or variant metafields here to filter and search products by those values across the store."}
          </Text>
          <InlineStack gap="300" align="center">
            <Button
              variant={pendingClear ? "secondary" : "primary"}
              icon={PlusIcon}
              disabled={busy}
              onClick={() => setRows([newDraftRow()])}
            >
              Add Metafield
            </Button>
            {pendingClear ? (
              <Button
                variant="primary"
                loading={busy}
                onClick={() => saveRows([])}
              >
                Save
              </Button>
            ) : null}
          </InlineStack>
        </div>
      ) : (
        <BlockStack gap="300">
          <div className="findly-meta-table">
            <div className="findly-meta-table__head">
              <span>Resource</span>
              <span>Namespace</span>
              <span>Key</span>
              <span>Type</span>
              <span>Applies to</span>
              <span />
            </div>
            {paged.map((row) => (
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
                <Select
                  label="Type"
                  labelHidden
                  options={FILTER_TYPE_OPTIONS}
                  value={row.filterType}
                  disabled={busy}
                  onChange={(value) =>
                    patchRow(row.clientId, {
                      filterType: value as MetafieldFilterType,
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
                    setPage((currentPage) =>
                      Math.min(currentPage, lastPageIndex(rows.length - 1)),
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
              onClick={() => {
                setRows((current) => [...current, newDraftRow()]);
                setPage(lastPageIndex(rows.length + 1));
              }}
            >
              Add metafield
            </Button>
            <InlineStack gap="300" blockAlign="center" wrap>
              <Text as="span" variant="bodySm" tone="subdued">
                {`Showing ${showingFrom}–${showingTo} of ${rows.length}`}
                {` · Filter metafields: ${filterCount}/${filterLimit} on ${plan}`}
              </Text>
              {rows.length > ADMIN_TABLE_PAGE_SIZE ? (
                <div className="findly-meta-pager">
                  <button
                    type="button"
                    aria-label="Previous page"
                    disabled={busy || safePage <= 0}
                    onClick={() => setPage((current) => Math.max(0, current - 1))}
                  >
                    <ChevronLeftIcon width={14} height={14} />
                  </button>
                  <button
                    type="button"
                    aria-label="Next page"
                    disabled={busy || safePage >= pageCount - 1}
                    onClick={() =>
                      setPage((current) => Math.min(pageCount - 1, current + 1))
                    }
                  >
                    <ChevronRightIcon width={14} height={14} />
                  </button>
                </div>
              ) : null}
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
