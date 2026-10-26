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
  Text,
} from "@shopify/polaris";
import { RefreshIcon } from "@shopify/polaris-icons";
import { useAppBridge } from "@shopify/app-bridge-react";
import { indexTablePagination } from "./admin-list-pagination";
import {
  appliesToWithFilter,
  type MetafieldApplyKey,
} from "../utils/metafield-applies";
import type { SettingsMetafieldRow } from "../services/settings-metafields.server";
import type { MetafieldOwnerTypeValue } from "../utils/metafield-owner";
import type { MetafieldFilterType } from "@prisma/client";

import { ADMIN_TABLE_PAGE_SIZE, lastPageIndex, slicePage } from "../utils/admin-list-page";
import { planDisplayName } from "../constants/plans";

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

function AppliesToBadges({ value }: { value: MetafieldApplyKey[] }) {
  if (value.length === 0) {
    return (
      <Text as="span" variant="bodySm" tone="subdued">
        None
      </Text>
    );
  }

  return (
    <InlineStack gap="200" blockAlign="center" wrap>
      {value.map((key) => (
        <Badge key={key} tone={APPLY_TONES[key]}>
          {APPLY_LABELS[key]}
        </Badge>
      ))}
    </InlineStack>
  );
}

function rowIdentity(rows: SettingsMetafieldRow[]) {
  return rows.map((row) => row.clientId).join("\n");
}

export function SettingsMetafieldsCard({
  initialRows,
  plan,
  filterLimit,
  partnerDevelopment = false,
}: {
  initialRows: SettingsMetafieldRow[];
  plan: string;
  filterLimit: number;
  partnerDevelopment?: boolean;
}) {
  const fetcher = useFetcher<FetcherData>();
  const shopify = useAppBridge();
  const [rows, setRows] = useState(initialRows);
  const [savedRows, setSavedRows] = useState(initialRows);
  const [seenInitial, setSeenInitial] = useState(initialRows);
  const [page, setPage] = useState(0);
  const saveLocked = useRef(false);
  if (initialRows !== seenInitial) {
    const sameRows = rowIdentity(initialRows) === rowIdentity(seenInitial);
    setSeenInitial(initialRows);
    setSavedRows(initialRows);
    setRows(initialRows);
    if (!sameRows) setPage(0);
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
    if (fetcher.state === "idle") saveLocked.current = false;
  }, [fetcher.state]);

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

  const syncDefinitions = () => {
    const formData = new FormData();
    formData.set("intent", "sync-metafields");
    formData.set("mappings", JSON.stringify(rows));
    fetcher.submit(formData, { method: "POST" });
  };

  const atFilterCap = filterCount >= filterLimit;
  const saveRows = (nextRows: SettingsMetafieldRow[]) => {
    setRows(nextRows);
    const formData = new FormData();
    formData.set("intent", "save-metafields");
    formData.set("mappings", JSON.stringify(nextRows));
    fetcher.submit(formData, { method: "POST" });
  };

  const setRowFilter = (clientId: string, enabled: boolean) => {
    if (busy || saveLocked.current) return;
    const current = rows.find((row) => row.clientId === clientId);
    if (!current || current.appliesTo.includes("filter") === enabled) return;
    if (enabled && atFilterCap) {
      shopify.toast.show(
        `Your ${planDisplayName(plan, { partnerDevelopment })} plan allows up to ${filterLimit} filter metafields. Turn Filter off on another row first.`,
        { isError: true },
      );
      return;
    }
    saveLocked.current = true;
    saveRows(
      rows.map((row) =>
        row.clientId === clientId
          ? { ...row, appliesTo: appliesToWithFilter(row.appliesTo, enabled) }
          : row,
      ),
    );
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
        <Checkbox
          id={`metafield-filter-${row.clientId.replace(/[^a-zA-Z0-9_-]/g, "-")}`}
          label={`Use ${row.displayLabel || row.key} as a filter`}
          labelHidden
          checked={row.appliesTo.includes("filter")}
          disabled={busy || (!row.appliesTo.includes("filter") && atFilterCap)}
          onChange={(enabled) => setRowFilter(row.clientId, enabled)}
        />
      </IndexTable.Cell>
      <IndexTable.Cell>
        <AppliesToBadges value={row.appliesTo} />
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
              Definitions come from Shopify. Sync to refresh the list. Keep
              Metafield enabled on Search → Search fields to query those values.
              Turn on Filter to use a metafield in Add filter. Display, Search,
              and Sort stay as they are.
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
              { title: "Filter" },
              { title: "Applies to" },
            ]}
          >
            {rowMarkup}
          </IndexTable>
          <Box padding="300" borderBlockStartWidth="025" borderColor="border">
            <Text as="p" variant="bodySm" tone="subdued">
              {`Showing ${slice.showingFrom}–${slice.showingTo} of ${rows.length}`}
              {` · Filter metafields: ${filterCount}/${filterLimit} on ${planDisplayName(plan, { partnerDevelopment })}`}
              {atFilterCap
                ? " · Filter limit reached. Turn Filter off on a row to enable another."
                : ""}
            </Text>
          </Box>
        </>
      )}
    </Card>
  );
}
