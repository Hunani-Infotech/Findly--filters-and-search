import { useMemo, useRef, useState } from "react";
import { useFetcher, useSearchParams } from "react-router";
import {
  Badge,
  BlockStack,
  Button,
  Checkbox,
  Combobox,
  Icon,
  InlineStack,
  Listbox,
  Modal,
  Pagination,
  Tag,
  Text,
  TextField,
} from "@shopify/polaris";
import { SearchIcon } from "@shopify/polaris-icons";
import { withEmbeddedParams } from "../admin-path";
import { useDebouncedCallback } from "../hooks/use-debounced-callback";
import {
  COLLECTION_PICKER_BROWSE_SIZE,
  COLLECTION_PICKER_PAGE_SIZE,
  type CollectionChoice,
} from "../collections-picker";

export type { CollectionChoice };

export const ALL_COLLECTIONS_VALUE = "__all_collections__";
export const ALL_PRODUCTS_VALUE = "__all_products__";
export const SEARCH_PAGE_VALUE = "__search__";

const EMPTY_VALUE = "__empty__";
const LOAD_MORE_VALUE = "__load_more__";

type CollectionPickerResponse = {
  collections: CollectionChoice[];
  page: number;
  pageSize: number;
  total: number;
  hasNext: boolean;
  query: string;
  requestId?: string;
};

type CollectionAppliesToProps = {
  collections: CollectionChoice[];
  knownCollections?: CollectionChoice[];
  collectionTotal?: number;
  collectionHasNext?: boolean;
  collectionPageSize?: number;
  selected: string[];
  onChange: (next: string[]) => void;
  appliesToSearch: boolean;
  onAppliesToSearchChange: (next: boolean) => void;
  appliesToAllProducts: boolean;
  onAppliesToAllProductsChange: (next: boolean) => void;
  allCollections: boolean;
  onAllCollectionsChange: (next: boolean) => void;
  usedElsewhere: Record<string, boolean>;
  allCollectionsUsedElsewhere?: boolean;
  disabled?: boolean;
  showExclude?: boolean;
  excluded?: string[];
  onExcludedChange?: (next: string[]) => void;
  showAllCollectionsChip?: boolean;
};

type AppliesRow = {
  value: string;
  label: string;
  handle?: string;
  badge: boolean;
};

function matchesQuery(needle: string, ...parts: Array<string | undefined>) {
  if (!needle) return true;
  return parts.some((part) => part?.toLowerCase().includes(needle));
}

function mergeChoices(
  current: CollectionChoice[],
  extra: CollectionChoice[],
): CollectionChoice[] {
  const map = new Map(current.map((row) => [row.collectionGid, row]));
  for (const row of extra) map.set(row.collectionGid, row);
  return [...map.values()];
}

function pickerUrl(
  query: string,
  page: number,
  pageSize: number,
  searchParams: URLSearchParams,
  requestId: string,
) {
  const next = new URLSearchParams();
  if (query) next.set("q", query);
  next.set("page", String(page));
  next.set("pageSize", String(pageSize));
  next.set("r", requestId);
  return withEmbeddedParams(`/app/collections/picker?${next}`, searchParams);
}

function useCollectionPickerPages({
  initialRows,
  initialTotal,
  initialHasNext,
  pageSize,
  mode,
}: {
  initialRows: CollectionChoice[];
  initialTotal: number;
  initialHasNext: boolean;
  pageSize: number;
  mode: "append" | "replace";
}) {
  const fetcher = useFetcher<CollectionPickerResponse>();
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState(initialRows);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(initialHasNext);
  const [total, setTotal] = useState(initialTotal);
  const [applied, setApplied] = useState<CollectionPickerResponse | undefined>();
  const loadSeq = useRef(0);
  const [issuedRequestId, setIssuedRequestId] = useState("");

  const loading = fetcher.state !== "idle";
  const incoming = fetcher.state === "idle" ? fetcher.data : undefined;

  if (incoming && incoming !== applied) {
    setApplied(incoming);
    const incomingId = incoming.requestId || "";
    const matchesRequest = incomingId
      ? incomingId === issuedRequestId
      : incoming.query === query.trim();
    if (matchesRequest) {
      setPage(incoming.page);
      setHasNext(incoming.hasNext);
      setTotal(incoming.total);
      setRows(
        mode === "append" && incoming.page > 1
          ? mergeChoices(rows, incoming.collections)
          : incoming.collections,
      );
    }
  }

  const loadPage = (nextPage: number, nextQuery = query.trim()) => {
    const seq = ++loadSeq.current;
    setIssuedRequestId(String(seq));
    fetcher.load(
      pickerUrl(nextQuery, nextPage, pageSize, searchParams, String(seq)),
    );
  };

  const {
    run: scheduleLoad,
    flush: flushLoad,
    flushPending,
    cancel,
  } = useDebouncedCallback((nextQuery: string) => {
    loadPage(1, nextQuery);
  });

  const onQueryChange = (value: string) => {
    setQuery(value);
    const next = value.trim();
    if (!next) {
      flushLoad("");
      return;
    }
    scheduleLoad(next);
  };

  const loadMore = () => {
    if (loading || !hasNext) return;
    loadPage(page + 1);
  };

  const goToPage = (nextPage: number) => {
    if (loading || nextPage < 1) return;
    loadPage(nextPage);
  };

  const reloadFirstPage = () => {
    cancel();
    setQuery("");
    loadPage(1, "");
  };

  return {
    query,
    onQueryChange,
    rows,
    page,
    hasNext,
    total,
    loading,
    loadMore,
    goToPage,
    reloadFirstPage,
    flushPending,
  };
}

export function CollectionAppliesTo({
  collections,
  knownCollections = [],
  collectionTotal,
  collectionHasNext = false,
  collectionPageSize = COLLECTION_PICKER_PAGE_SIZE,
  selected,
  onChange,
  appliesToSearch,
  onAppliesToSearchChange,
  appliesToAllProducts,
  onAppliesToAllProductsChange,
  allCollections,
  onAllCollectionsChange,
  usedElsewhere,
  allCollectionsUsedElsewhere = false,
  disabled = false,
  showExclude = false,
  excluded = [],
  onExcludedChange,
  showAllCollectionsChip = true,
}: CollectionAppliesToProps) {
  const [browseOpen, setBrowseOpen] = useState(false);
  const [catalog, setCatalog] = useState(() =>
    mergeChoices(collections, knownCollections),
  );

  const shopTotal = collectionTotal ?? collections.length;
  const applies = useCollectionPickerPages({
    initialRows: collections,
    initialTotal: shopTotal,
    initialHasNext: collectionHasNext,
    pageSize: collectionPageSize,
    mode: "append",
  });
  const excludePicker = useCollectionPickerPages({
    initialRows: collections,
    initialTotal: shopTotal,
    initialHasNext: collectionHasNext,
    pageSize: collectionPageSize,
    mode: "append",
  });
  const browse = useCollectionPickerPages({
    initialRows: collections.slice(0, COLLECTION_PICKER_BROWSE_SIZE),
    initialTotal: shopTotal,
    initialHasNext: shopTotal > COLLECTION_PICKER_BROWSE_SIZE,
    pageSize: COLLECTION_PICKER_BROWSE_SIZE,
    mode: "replace",
  });

  const incomingKnown = [
    ...applies.rows,
    ...excludePicker.rows,
    ...browse.rows,
  ];
  const incomingKey = incomingKnown.map((row) => row.collectionGid).join("|");
  const [catalogKey, setCatalogKey] = useState(incomingKey);
  if (incomingKey !== catalogKey) {
    setCatalogKey(incomingKey);
    setCatalog((current) => mergeChoices(current, incomingKnown));
  }

  const allCollectionsChecked = selected.length === 0 || allCollections;

  const rows = useMemo(() => {
    const needle = applies.query.trim().toLowerCase();
    const special: AppliesRow[] = [
      {
        value: ALL_COLLECTIONS_VALUE,
        label: "All Collections",
        badge: allCollectionsUsedElsewhere,
      },
      {
        value: ALL_PRODUCTS_VALUE,
        label: "All Products",
        badge: false,
      },
      {
        value: SEARCH_PAGE_VALUE,
        label: "Search Page",
        badge: false,
      },
    ].filter((row) => matchesQuery(needle, row.label));

    const collectionRows = applies.rows.map((collection) => ({
      value: collection.collectionGid,
      label: collection.title,
      handle: collection.handle,
      badge: Boolean(usedElsewhere[collection.collectionGid]),
    }));

    return [...special, ...collectionRows];
  }, [allCollectionsUsedElsewhere, applies.query, applies.rows, usedElsewhere]);

  const isChecked = (value: string) => {
    if (value === ALL_COLLECTIONS_VALUE) return allCollectionsChecked;
    if (value === ALL_PRODUCTS_VALUE) return appliesToAllProducts;
    if (value === SEARCH_PAGE_VALUE) return appliesToSearch;
    return selected.includes(value);
  };

  const toggleRow = (value: string) => {
    if (disabled || value === EMPTY_VALUE) return;
    if (value === LOAD_MORE_VALUE) {
      applies.loadMore();
      return;
    }

    if (value === ALL_COLLECTIONS_VALUE) {
      onAllCollectionsChange(true);
      onChange([]);
      return;
    }
    if (value === ALL_PRODUCTS_VALUE) {
      onAppliesToAllProductsChange(!appliesToAllProducts);
      return;
    }
    if (value === SEARCH_PAGE_VALUE) {
      onAppliesToSearchChange(!appliesToSearch);
      return;
    }

    if (selected.includes(value)) {
      const next = selected.filter((gid) => gid !== value);
      onChange(next);
      if (next.length === 0) {
        onAllCollectionsChange(true);
      }
      return;
    }

    onAllCollectionsChange(false);
    onChange([...selected, value]);
  };

  const selectedCollections = selected
    .map((gid) => catalog.find((collection) => collection.collectionGid === gid))
    .filter((collection): collection is CollectionChoice => Boolean(collection));

  const emptyLabel =
    shopTotal === 0
      ? "Sync collections to assign this filter."
      : "No collections match that search.";

  const excludedCollections = excluded
    .map((gid) => catalog.find((collection) => collection.collectionGid === gid))
    .filter((collection): collection is CollectionChoice => Boolean(collection));

  const toggleExclude = (value: string) => {
    if (disabled || !onExcludedChange || value === EMPTY_VALUE) return;
    if (value === LOAD_MORE_VALUE) {
      excludePicker.loadMore();
      return;
    }
    if (excluded.includes(value)) {
      onExcludedChange(excluded.filter((gid) => gid !== value));
      return;
    }
    onExcludedChange([...excluded, value]);
  };

  const showAppliesChips =
    (showAllCollectionsChip && allCollectionsChecked) ||
    selectedCollections.length > 0 ||
    appliesToSearch ||
    appliesToAllProducts;

  const browseFrom =
    browse.total === 0
      ? 0
      : (browse.page - 1) * COLLECTION_PICKER_BROWSE_SIZE + 1;
  const browseTo = Math.min(
    browse.page * COLLECTION_PICKER_BROWSE_SIZE,
    browse.total,
  );

  return (
    <BlockStack gap="200">
      <Combobox
        allowMultiple
        maxHeight="320px"
        onClose={() => {
          if (applies.query) applies.onQueryChange("");
        }}
        activator={
          <Combobox.TextField
            label="Applies to"
            prefix={<Icon source={SearchIcon} />}
            value={applies.query}
            placeholder="Search for collections"
            autoComplete="off"
            disabled={disabled}
            onChange={applies.onQueryChange}
          />
        }
      >
        <Listbox onSelect={toggleRow} accessibilityLabel="Applies to">
          {rows.length === 0 && !applies.loading ? (
            <Listbox.Option value={EMPTY_VALUE} disabled>
              {emptyLabel}
            </Listbox.Option>
          ) : (
            rows.map((row) => {
              const checked = isChecked(row.value);
              return (
                <Listbox.Option
                  key={row.value}
                  value={row.value}
                  selected={checked}
                  accessibilityLabel={row.label}
                >
                  <Listbox.TextOption selected={checked} disabled={disabled}>
                    {row.badge ? (
                      <InlineStack gap="200" blockAlign="center" wrap={false}>
                        <span>{row.label}</span>
                        <Badge size="small">Applied in other filter</Badge>
                      </InlineStack>
                    ) : (
                      row.label
                    )}
                  </Listbox.TextOption>
                </Listbox.Option>
              );
            })
          )}
          {applies.loading ? (
            <Listbox.Loading accessibilityLabel="Loading collections" />
          ) : null}
          {applies.hasNext && !applies.loading ? (
            <Listbox.Option
              value={LOAD_MORE_VALUE}
              accessibilityLabel="Load more collections"
            >
              Load more ({applies.rows.length} of {applies.total})
            </Listbox.Option>
          ) : null}
        </Listbox>
      </Combobox>
      {showAppliesChips ? (
        <InlineStack gap="200" wrap>
          {showAllCollectionsChip && allCollectionsChecked ? (
            <Tag
              disabled={disabled}
              onRemove={() => {
                onAllCollectionsChange(false);
              }}
            >
              All Collections
            </Tag>
          ) : null}
          {selectedCollections.map((collection) => (
            <Tag
              key={collection.collectionGid}
              disabled={disabled}
              onRemove={() => {
                const next = selected.filter(
                  (gid) => gid !== collection.collectionGid,
                );
                onChange(next);
                if (next.length === 0) {
                  onAllCollectionsChange(true);
                }
              }}
            >
              {collection.title}
            </Tag>
          ))}
          {appliesToAllProducts ? (
            <Tag
              disabled={disabled}
              onRemove={() => onAppliesToAllProductsChange(false)}
            >
              All Products
            </Tag>
          ) : null}
          {appliesToSearch ? (
            <Tag
              disabled={disabled}
              onRemove={() => onAppliesToSearchChange(false)}
            >
              Search Page
            </Tag>
          ) : null}
        </InlineStack>
      ) : null}
      {showExclude ? (
        <BlockStack gap="200">
          <div className="findly-exclude-collections">
            <div className="findly-exclude-collections__field">
              <Combobox
                allowMultiple
                maxHeight="320px"
                onClose={() => {
                  if (excludePicker.query) excludePicker.onQueryChange("");
                }}
                activator={
                  <Combobox.TextField
                    label="Exclude collections"
                    prefix={<Icon source={SearchIcon} />}
                    value={excludePicker.query}
                    placeholder="Search for collections"
                    autoComplete="off"
                    disabled={disabled}
                    onChange={excludePicker.onQueryChange}
                  />
                }
              >
                <Listbox
                  onSelect={toggleExclude}
                  accessibilityLabel="Exclude collections"
                >
                  {excludePicker.rows.length === 0 && !excludePicker.loading ? (
                    <Listbox.Option value={EMPTY_VALUE} disabled>
                      {emptyLabel}
                    </Listbox.Option>
                  ) : (
                    excludePicker.rows.map((collection) => {
                      const checked = excluded.includes(collection.collectionGid);
                      return (
                        <Listbox.Option
                          key={collection.collectionGid}
                          value={collection.collectionGid}
                          selected={checked}
                          accessibilityLabel={collection.title}
                        >
                          <Listbox.TextOption
                            selected={checked}
                            disabled={disabled}
                          >
                            {collection.title}
                          </Listbox.TextOption>
                        </Listbox.Option>
                      );
                    })
                  )}
                  {excludePicker.loading ? (
                    <Listbox.Loading accessibilityLabel="Loading collections" />
                  ) : null}
                  {excludePicker.hasNext && !excludePicker.loading ? (
                    <Listbox.Option
                      value={LOAD_MORE_VALUE}
                      accessibilityLabel="Load more collections"
                    >
                      Load more ({excludePicker.rows.length} of{" "}
                      {excludePicker.total})
                    </Listbox.Option>
                  ) : null}
                </Listbox>
              </Combobox>
            </div>
            <Button
              disabled={disabled}
              onClick={() => {
                browse.reloadFirstPage();
                setBrowseOpen(true);
              }}
            >
              Browse
            </Button>
          </div>
          {excludedCollections.length ? (
            <InlineStack gap="200" wrap>
              {excludedCollections.map((collection) => (
                <Tag
                  key={collection.collectionGid}
                  disabled={disabled}
                  onRemove={() =>
                    onExcludedChange?.(
                      excluded.filter(
                        (gid) => gid !== collection.collectionGid,
                      ),
                    )
                  }
                >
                  {collection.title}
                </Tag>
              ))}
            </InlineStack>
          ) : null}
          <Modal
            open={browseOpen}
            onClose={() => setBrowseOpen(false)}
            title="Exclude collections"
            primaryAction={{
              content: "Done",
              onAction: () => setBrowseOpen(false),
            }}
          >
            <Modal.Section>
              <BlockStack gap="300">
                <TextField
                  label="Search for collections"
                  labelHidden
                  value={browse.query}
                  placeholder="Search for collections"
                  autoComplete="off"
                  onChange={browse.onQueryChange}
                  onBlur={() => browse.flushPending()}
                />
                {browse.rows.length === 0 && !browse.loading ? (
                  <p>{emptyLabel}</p>
                ) : (
                  <BlockStack gap="200">
                    {browse.rows.map((collection) => (
                      <Checkbox
                        key={collection.collectionGid}
                        label={collection.title}
                        checked={excluded.includes(collection.collectionGid)}
                        disabled={disabled}
                        onChange={() => toggleExclude(collection.collectionGid)}
                      />
                    ))}
                  </BlockStack>
                )}
                {browse.loading ? (
                  <Text as="p" variant="bodySm" tone="subdued">
                    Loading collections…
                  </Text>
                ) : null}
                {browse.total > 0 ? (
                  <InlineStack align="space-between" blockAlign="center" wrap>
                    <Text as="span" variant="bodySm" tone="subdued">
                      {browseFrom}–{browseTo} of {browse.total}
                    </Text>
                    <Pagination
                      hasPrevious={browse.page > 1 && !browse.loading}
                      onPrevious={() => browse.goToPage(browse.page - 1)}
                      hasNext={browse.hasNext && !browse.loading}
                      onNext={() => browse.goToPage(browse.page + 1)}
                    />
                  </InlineStack>
                ) : null}
              </BlockStack>
            </Modal.Section>
          </Modal>
        </BlockStack>
      ) : null}
    </BlockStack>
  );
}
