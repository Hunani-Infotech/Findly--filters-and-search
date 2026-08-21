import { useMemo, useState } from "react";
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

const PAGE_SIZE = 50;

export function CatalogValuePicker({
  values,
  selected,
  disabled,
  onToggle,
  emptyMessage = "No catalog values yet. Sync products, then select values here.",
  onSelectAll,
}: {
  values: string[];
  selected: string[];
  disabled: boolean;
  onToggle: (value: string, checked: boolean) => void;
  emptyMessage?: string;
  onSelectAll?: (filtered: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return values;
    return values.filter((value) => value.toLowerCase().includes(needle));
  }, [query, values]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const start = safePage * PAGE_SIZE;
  const paged = filtered.slice(start, start + PAGE_SIZE);
  const mid = Math.ceil(paged.length / 2);
  const left = paged.slice(0, mid);
  const right = paged.slice(mid);
  const showingFrom = paged.length === 0 ? 0 : start + 1;
  const showingTo = start + paged.length;

  const handleQueryChange = (next: string) => {
    setQuery(next);
    setPage(0);
  };

  const renderColumn = (column: string[]) => (
    <BlockStack gap="200">
      {column.map((value) => (
        <Checkbox
          key={value}
          label={value}
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
      {onSelectAll && filtered.length > 0 ? (
        <Button disabled={disabled} onClick={() => onSelectAll(filtered)}>
          Select all results
        </Button>
      ) : null}
      {filtered.length === 0 ? (
        <Text as="p" tone="subdued">
          {values.length === 0 ? emptyMessage : "No values match this search."}
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
          {filtered.length > 0
            ? ` · Showing ${showingFrom}–${showingTo} of ${filtered.length}`
            : ""}
        </Text>
        {filtered.length > PAGE_SIZE ? (
          <Pagination
            label={`${safePage + 1} of ${pageCount}`}
            hasPrevious={safePage > 0}
            onPrevious={() => setPage(Math.max(0, safePage - 1))}
            hasNext={safePage < pageCount - 1}
            onNext={() => setPage(Math.min(pageCount - 1, safePage + 1))}
          />
        ) : null}
      </InlineStack>
    </BlockStack>
  );
}
