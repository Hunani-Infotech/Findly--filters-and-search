import { useEffect, useMemo, useRef, useState } from "react";
import { useFetcher } from "react-router";
import {
  Badge,
  BlockStack,
  Box,
  Button,
  Card,
  Checkbox,
  IndexTable,
  InlineStack,
  Popover,
  Text,
} from "@shopify/polaris";
import { RefreshIcon } from "@shopify/polaris-icons";
import { useAppBridge } from "@shopify/app-bridge-react";
import { indexTablePagination } from "./admin-list-pagination";
import {
  METAFIELD_APPLY_KEYS,
  isValidMetafieldPart,
  type MetafieldApplyKey,
} from "../utils/metafield-applies";
import type { SettingsMetafieldRow } from "../services/settings-metafields.server";
import type { MetafieldOwnerTypeValue } from "../utils/metafield-owner";
import type { MetafieldFilterType } from "@prisma/client";

import { ADMIN_TABLE_PAGE_SIZE, lastPageIndex, slicePage } from "../utils/admin-list-page";

const PLAN_LABELS: Record<string, string> = {
  free: "Development",
  standard: "Standard",
  pro: "Pro",
};

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

const APPLY_TONES: Record<MetafieldApplyKey, "success" | "info" | undefined> = {
  display: undefined,
  search: undefined,
  filter: "success",
  sort: "info",
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

function resourceLabel(ownerType: MetafieldOwnerTypeValue) {
  return (
    RESOURCE_OPTIONS.find((option) => option.value === ownerType)?.label ??
    ownerType
  );
}

function typeLabel(filterType: MetafieldFilterType) {
  return (
    FILTER_TYPE_OPTIONS.find((option) => option.value === filterType)?.label ??
    filterType
  );
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

  return (
    <InlineStack gap="200" blockAlign="center" wrap>
      {value.length === 0 ? (
        <Text as="span" variant="bodySm" tone="subdued">
          None
        </Text>
      ) : (
        value.map((key) => (
          <Badge key={key} tone={APPLY_TONES[key]}>
            {APPLY_LABELS[key]}
          </Badge>
        ))
      )}
      <Popover
        active={open}
        activator={
          <Button
            size="slim"
            disclosure
            disabled={disabled}
            onClick={() => setOpen((current) => !current)}
            accessibilityLabel="Change where this metafield applies"
          >
            {value.length === 0 ? "Select" : "Change"}
          </Button>
        }
        onClose={() => setOpen(false)}
      >
        <Box padding="300" minWidth="220px">
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
                    Checking Sort adds this metafield to the storefront Sort By
                    dropdown (using its display name). Uncheck Sort to remove
                    it.
                  </Text>
                ) : null}
              </BlockStack>
            ))}
          </BlockStack>
        </Box>
      </Popover>
    </InlineStack>
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
    } else if ("error" in fetcher.data && fetcher.data.error) {
      setRows(savedRows);
      setPage((current) => Math.min(current, lastPageIndex(savedRows.length)));
    }
  }

  const busy = fetcher.state !== "idle";
  const syncing =
    busy && String(fetcher.formData?.get("intent") || "") === "sync-metafields";
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
  const filterCount = useMemo(
    () => rows.filter((row) => row.appliesTo.includes("filter")).length,
    [rows],
  );
  const slice = slicePage(rows, page, ADMIN_TABLE_PAGE_SIZE);
  if (page !== slice.safePage) setPage(slice.safePage);

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

  const patchApplies = (clientId: string, appliesTo: MetafieldApplyKey[]) => {
    const next = rows.map((row) =>
      row.clientId === clientId ? { ...row, appliesTo } : row,
    );
    setRows(next);
    saveRows(next);
  };

  const rowMarkup = slice.paged.map((row, index) => (
    <IndexTable.Row
      id={row.clientId}
      key={row.clientId}
      position={slice.start + index}
    >
      <IndexTable.Cell>{resourceLabel(row.ownerType)}</IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span" variant="bodyMd" breakWord>
          {row.namespace || "—"}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span" variant="bodyMd" fontWeight="semibold" breakWord>
          {row.key || "—"}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>{typeLabel(row.filterType)}</IndexTable.Cell>
      <IndexTable.Cell>
        <AppliesToField
          value={row.appliesTo}
          disabled={busy}
          onChange={(appliesTo) => patchApplies(row.clientId, appliesTo)}
        />
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  return (
    <Card padding="0">
      <Box padding="400">
        <InlineStack align="space-between" blockAlign="start" gap="400" wrap>
          <BlockStack gap="100">
            <Text as="h2" variant="headingMd">
              Metafields
            </Text>
            <Text as="p" variant="bodySm" tone="subdued">
              Definitions come from Shopify. Sync to refresh the list, then
              choose Filter, Search, or Sort for each metafield. Keep
              Metafield enabled on Search → Search fields to query those values.
            </Text>
          </BlockStack>
          <Button
            icon={RefreshIcon}
            loading={syncing}
            disabled={busy}
            onClick={syncDefinitions}
          >
            Sync metafields
          </Button>
        </InlineStack>
      </Box>

      {empty ? (
        <Box padding="400" paddingBlockStart="0">
          <BlockStack gap="300">
            <Text as="p" variant="bodyMd">
              No metafields yet
            </Text>
            <Text as="p" variant="bodySm" tone="subdued">
              Sync metafield definitions from Shopify to use them in filters
              and search.
            </Text>
            <Box>
              <Button
                variant="primary"
                loading={syncing}
                disabled={busy}
                onClick={syncDefinitions}
              >
                Sync metafields
              </Button>
            </Box>
          </BlockStack>
        </Box>
      ) : (
        <>
          <IndexTable
            resourceName={{ singular: "metafield", plural: "metafields" }}
            itemCount={slice.total}
            selectable={false}
            lastColumnSticky
            pagination={indexTablePagination(slice, setPage)}
            headings={[
              { title: "Resource" },
              { title: "Namespace" },
              { title: "Key" },
              { title: "Type" },
              { title: "Applies to" },
            ]}
          >
            {rowMarkup}
          </IndexTable>
          <Box padding="300" borderBlockStartWidth="025" borderColor="border">
            <Text as="p" variant="bodySm" tone="subdued">
              {`Showing ${slice.showingFrom}–${slice.showingTo} of ${rows.length}`}
              {` · Filter metafields: ${filterCount}/${filterLimit} on ${PLAN_LABELS[plan] ?? plan}`}
            </Text>
          </Box>
        </>
      )}
    </Card>
  );
}
