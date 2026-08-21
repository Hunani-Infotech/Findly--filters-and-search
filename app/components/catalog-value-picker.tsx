import { useEffect, useMemo, useRef, useState } from "react";
import {
  BlockStack,
  Button,
  Checkbox,
  InlineGrid,
  InlineStack,
  Pagination,
  Text,
  TextField,
} from "@shopify/polaris";

import { ADMIN_CATALOG_PAGE_SIZE, slicePage } from "../admin-list-page";

export function CatalogValuePicker({
  values,
  selected,
  disabled,
  onToggle,
  emptyMessage = "No catalog values yet. Sync products, then select values here.",
  onSelectAll,
  labels,
  query: queryProp,
  onQueryChange,
  page: pageProp,
  pageCount: pageCountProp,
  total: totalProp,
  showingFrom: showingFromProp,
  showingTo: showingToProp,
  onPageChange,
  selectAllLoading = false,
}: {
  values: string[];
  selected: string[];
  disabled: boolean;
  onToggle: (value: string, checked: boolean) => void;
  emptyMessage?: string;
  onSelectAll?: (filtered: string[]) => void;
  labels?: Record<string, string>;
  query?: string;
  onQueryChange?: (query: string) => void;
  page?: number;
  pageCount?: number;
  total?: number;
  showingFrom?: number;
  showingTo?: number;
  onPageChange?: (page: number) => void;
  selectAllLoading?: boolean;
}) {
  const server = Boolean(onPageChange && totalProp != null);
  const [query, setQuery] = useState(queryProp ?? "");
  const [page, setPage] = useState(0);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  useEffect(() => {
    if (queryProp == null) return;
    setQuery(queryProp);
  }, [queryProp]);

  useEffect(() => {
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, []);

  const filtered = useMemo(() => {
    if (server) return values;
    const needle = query.trim().toLowerCase();
    if (!needle) return values;
    return values.filter((value) => {
      const label = labels?.[value] || value;
      return (
        value.toLowerCase().includes(needle) ||
        label.toLowerCase().includes(needle)
      );
    });
  }, [query, values, labels, server]);

  const slice = slicePage(filtered, page, ADMIN_CATALOG_PAGE_SIZE);
  if (!server && page !== slice.safePage) setPage(slice.safePage);

  const paged = server ? values : slice.paged;
  const total = server ? totalProp || 0 : filtered.length;
  const pageCount = server
    ? Math.max(1, pageCountProp || 1)
    : slice.pageCount;
  const safePage = server ? pageProp ?? 0 : slice.safePage;
  const showingFrom = server
    ? showingFromProp ?? 0
    : slice.showingFrom;
  const showingTo = server ? showingToProp ?? 0 : slice.showingTo;
  const mid = Math.ceil(paged.length / 2);
  const left = paged.slice(0, mid);
  const right = paged.slice(mid);

  const handleQueryChange = (next: string) => {
    setQuery(next);
    if (server && onQueryChange) {
      if (searchTimer.current) clearTimeout(searchTimer.current);
      searchTimer.current = setTimeout(() => onQueryChange(next), 300);
      return;
    }
    setPage(0);
  };

  const renderColumn = (column: string[]) => (
    <BlockStack gap="200">
      {column.map((value) => (
        <Checkbox
          key={value}
          label={labels?.[value] || value}
          checked={selectedSet.has(value)}
          disabled={disabled}
          onChange={(checked) => onToggle(value, checked)}
        />
      ))}
    </BlockStack>
  );

  return (
    <BlockStack gap="300">
      <TextField
        label="Search values"
        value={query}
        onChange={handleQueryChange}
        autoComplete="off"
        disabled={disabled}
        placeholder="Find a tag, vendor, type, or metafield value"
        clearButton
        onClearButtonClick={() => handleQueryChange("")}
      />
      {onSelectAll && total > 0 ? (
        <Button
          disabled={disabled || selectAllLoading}
          loading={selectAllLoading}
          onClick={() => onSelectAll(server ? [] : filtered)}
        >
          Select all results
        </Button>
      ) : null}
      {total === 0 ? (
        <Text as="p" tone="subdued">
          {values.length === 0 && !query.trim()
            ? emptyMessage
            : "No values match this search."}
        </Text>
      ) : (
        <InlineGrid columns={{ xs: 1, md: 2 }} gap="200">
          {renderColumn(left)}
          {renderColumn(right)}
        </InlineGrid>
      )}
      <InlineStack align="space-between" blockAlign="center" wrap gap="200">
        <Text as="p" tone="subdued" variant="bodySm">
          {selected.length === 1
            ? "1 selected"
            : `${selected.length} selected`}
          {total > 0 ? ` · Showing ${showingFrom}–${showingTo} of ${total}` : ""}
        </Text>
        {total > ADMIN_CATALOG_PAGE_SIZE ? (
          <Pagination
            label={`${safePage + 1} of ${pageCount}`}
            hasPrevious={!disabled && safePage > 0}
            onPrevious={() =>
              server
                ? onPageChange?.(Math.max(0, safePage - 1))
                : setPage(Math.max(0, safePage - 1))
            }
            hasNext={!disabled && safePage < pageCount - 1}
            onNext={() =>
              server
                ? onPageChange?.(Math.min(pageCount - 1, safePage + 1))
                : setPage(Math.min(pageCount - 1, safePage + 1))
            }
          />
        ) : null}
      </InlineStack>
    </BlockStack>
  );
}
