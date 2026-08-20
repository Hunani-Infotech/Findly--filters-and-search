import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { BlockStack, InlineStack, Tag } from "@shopify/polaris";

export const ALL_COLLECTIONS_VALUE = "__all_collections__";
export const ALL_PRODUCTS_VALUE = "__all_products__";
export const SEARCH_PAGE_VALUE = "__search__";

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
}: CollectionAppliesToProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

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

  useEffect(() => {
    if (activeIndex >= rows.length) {
      setActiveIndex(0);
    }
  }, [activeIndex, rows.length]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const isChecked = (value: string) => {
    if (value === ALL_COLLECTIONS_VALUE) return allCollectionsChecked;
    if (value === ALL_PRODUCTS_VALUE) return appliesToAllProducts;
    if (value === SEARCH_PAGE_VALUE) return appliesToSearch;
    return selected.includes(value);
  };

  const toggleRow = (value: string) => {
    if (disabled) return;

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

  const onFieldKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((index) =>
        rows.length ? (index + 1) % rows.length : 0,
      );
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((index) =>
        rows.length ? (index - 1 + rows.length) % rows.length : 0,
      );
      return;
    }
    if (event.key === "Enter" && open && rows[activeIndex]) {
      event.preventDefault();
      toggleRow(rows[activeIndex].value);
    }
  };

  return (
    <BlockStack gap="200">
      <div className="findly-applies-to" ref={rootRef}>
        <label className="findly-applies-to__label" htmlFor="findly-applies-to-search">
          Applies to
        </label>
        <div className="findly-applies-to__control">
          <span className="findly-applies-to__icon" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5" />
              <path
                d="M10.5 10.5L14 14"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </span>
          <input
            id="findly-applies-to-search"
            className="findly-applies-to__field"
            type="text"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={open}
            aria-controls={listId}
            value={query}
            placeholder="Search for collections"
            autoComplete="off"
            disabled={disabled}
            onChange={(event) => {
              setQuery(event.target.value);
              setOpen(true);
              setActiveIndex(0);
            }}
            onFocus={() => setOpen(true)}
            onClick={() => setOpen(true)}
            onKeyDown={onFieldKeyDown}
          />
          {open ? (
            <div className="findly-applies-to__panel" id={listId} role="listbox">
              {rows.length === 0 ? (
                <div className="findly-applies-to__empty">
                  {collections.length === 0
                    ? "Sync collections to assign this filter."
                    : "No collections match that search."}
                </div>
              ) : (
                rows.map((row, index) => {
                  const checked = isChecked(row.value);
                  return (
                    <button
                      key={row.value}
                      type="button"
                      role="option"
                      aria-selected={checked}
                      className="findly-applies-to__row"
                      data-active={index === activeIndex ? "true" : "false"}
                      disabled={disabled}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => toggleRow(row.value)}
                    >
                      <span className="findly-applies-to__row-main">
                        <input
                          type="checkbox"
                          checked={checked}
                          readOnly
                          tabIndex={-1}
                        />
                        <span>{row.label}</span>
                      </span>
                      {row.badge ? (
                        <span className="findly-applies-to__badge">
                          Applied in other filter
                        </span>
                      ) : null}
                    </button>
                  );
                })
              )}
            </div>
          ) : null}
        </div>
      </div>
      {selectedCollections.length || appliesToSearch || appliesToAllProducts ? (
        <InlineStack gap="200" wrap>
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
    </BlockStack>
  );
}
