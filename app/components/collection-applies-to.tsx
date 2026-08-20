import { useMemo, useState } from "react";
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
  Tag,
  TextField,
} from "@shopify/polaris";
import { SearchIcon } from "@shopify/polaris-icons";

export const ALL_COLLECTIONS_VALUE = "__all_collections__";
export const ALL_PRODUCTS_VALUE = "__all_products__";
export const SEARCH_PAGE_VALUE = "__search__";

const EMPTY_VALUE = "__empty__";

export type CollectionChoice = {
  collectionGid: string;
  title: string;
  handle: string;
};

type CollectionAppliesToProps = {
  collections: CollectionChoice[];
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

export function CollectionAppliesTo({
  collections,
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
  const [query, setQuery] = useState("");
  const [excludeQuery, setExcludeQuery] = useState("");
  const [browseOpen, setBrowseOpen] = useState(false);
  const [browseQuery, setBrowseQuery] = useState("");

  const allCollectionsChecked = selected.length === 0 || allCollections;

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
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

    const collectionRows = collections
      .filter((collection) =>
        matchesQuery(needle, collection.title, collection.handle),
      )
      .map((collection) => ({
        value: collection.collectionGid,
        label: collection.title,
        handle: collection.handle,
        badge: Boolean(usedElsewhere[collection.collectionGid]),
      }));

    return [...special, ...collectionRows];
  }, [allCollectionsUsedElsewhere, collections, query, usedElsewhere]);

  const isChecked = (value: string) => {
    if (value === ALL_COLLECTIONS_VALUE) return allCollectionsChecked;
    if (value === ALL_PRODUCTS_VALUE) return appliesToAllProducts;
    if (value === SEARCH_PAGE_VALUE) return appliesToSearch;
    return selected.includes(value);
  };

  const toggleRow = (value: string) => {
    if (disabled || value === EMPTY_VALUE) return;

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
    .map((gid) =>
      collections.find((collection) => collection.collectionGid === gid),
    )
    .filter((collection): collection is CollectionChoice => Boolean(collection));

  const emptyLabel =
    collections.length === 0
      ? "Sync collections to assign this filter."
      : "No collections match that search.";

  const excludedCollections = excluded
    .map((gid) =>
      collections.find((collection) => collection.collectionGid === gid),
    )
    .filter((collection): collection is CollectionChoice => Boolean(collection));

  const excludeRows = useMemo(() => {
    const needle = excludeQuery.trim().toLowerCase();
    return collections.filter((collection) =>
      matchesQuery(needle, collection.title, collection.handle),
    );
  }, [collections, excludeQuery]);

  const browseRows = useMemo(() => {
    const needle = browseQuery.trim().toLowerCase();
    return collections.filter((collection) =>
      matchesQuery(needle, collection.title, collection.handle),
    );
  }, [browseQuery, collections]);

  const toggleExclude = (value: string) => {
    if (disabled || !onExcludedChange || value === EMPTY_VALUE) return;
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

  return (
    <BlockStack gap="200">
      <Combobox
        allowMultiple
        maxHeight="320px"
        onClose={() => setQuery("")}
        activator={
          <Combobox.TextField
            label="Applies to"
            prefix={<Icon source={SearchIcon} />}
            value={query}
            placeholder="Search for collections"
            autoComplete="off"
            disabled={disabled}
            onChange={setQuery}
          />
        }
      >
        <Listbox onSelect={toggleRow} accessibilityLabel="Applies to">
          {rows.length === 0 ? (
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
                onClose={() => setExcludeQuery("")}
                activator={
                  <Combobox.TextField
                    label="Exclude collections"
                    prefix={<Icon source={SearchIcon} />}
                    value={excludeQuery}
                    placeholder="Search for collections"
                    autoComplete="off"
                    disabled={disabled}
                    onChange={setExcludeQuery}
                  />
                }
              >
                <Listbox
                  onSelect={toggleExclude}
                  accessibilityLabel="Exclude collections"
                >
                  {excludeRows.length === 0 ? (
                    <Listbox.Option value={EMPTY_VALUE} disabled>
                      {emptyLabel}
                    </Listbox.Option>
                  ) : (
                    excludeRows.map((collection) => {
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
                </Listbox>
              </Combobox>
            </div>
            <Button
              disabled={disabled}
              onClick={() => {
                setBrowseQuery("");
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
                  value={browseQuery}
                  placeholder="Search for collections"
                  autoComplete="off"
                  onChange={setBrowseQuery}
                />
                {browseRows.length === 0 ? (
                  <p>{emptyLabel}</p>
                ) : (
                  <BlockStack gap="200">
                    {browseRows.map((collection) => (
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
              </BlockStack>
            </Modal.Section>
          </Modal>
        </BlockStack>
      ) : null}
    </BlockStack>
  );
}
