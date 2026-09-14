import { InlineStack, Pagination, Text } from "@shopify/polaris";
import type { PagedSlice } from "../utils/admin-list-page";

type AdminListPaginationProps = {
  slice: PagedSlice<unknown>;
  onPageChange: (page: number) => void;
  disabled?: boolean;
  noun?: string;
};

export function AdminListPagination({
  slice,
  onPageChange,
  disabled = false,
  noun,
}: AdminListPaginationProps) {
  if (slice.total === 0) return null;
  const countLabel = noun
    ? `${slice.total} ${slice.total === 1 ? noun : `${noun}s`}`
    : `${slice.total}`;
  return (
    <div className="findly-admin-pager">
      <InlineStack align="space-between" blockAlign="center" wrap gap="200">
        <Text as="p" tone="subdued" variant="bodySm">
          {`Showing ${slice.showingFrom}–${slice.showingTo} of ${countLabel}`}
        </Text>
        {slice.pageCount > 1 ? (
          <Pagination
            label={`${slice.safePage + 1} of ${slice.pageCount}`}
            hasPrevious={!disabled && slice.safePage > 0}
            onPrevious={() => onPageChange(slice.safePage - 1)}
            hasNext={!disabled && slice.safePage < slice.pageCount - 1}
            onNext={() => onPageChange(slice.safePage + 1)}
          />
        ) : null}
      </InlineStack>
    </div>
  );
}

export function indexTablePagination(
  slice: PagedSlice<unknown>,
  onPageChange: (page: number) => void,
) {
  if (slice.pageCount <= 1) return undefined;
  return {
    hasPrevious: slice.safePage > 0,
    hasNext: slice.safePage < slice.pageCount - 1,
    onPrevious: () => onPageChange(slice.safePage - 1),
    onNext: () => onPageChange(slice.safePage + 1),
    label: `${slice.showingFrom}–${slice.showingTo} of ${slice.total}`,
  };
}
