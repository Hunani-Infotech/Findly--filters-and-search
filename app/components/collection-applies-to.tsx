import { useMemo, useState } from "react";
import {
  Autocomplete,
  BlockStack,
  Checkbox,
  InlineStack,
  Tag,
  Text,
} from "@shopify/polaris";

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
  disabled?: boolean;
};

export function CollectionAppliesTo({
  collections,
  selected,
  onChange,
  appliesToSearch,
  onAppliesToSearchChange,
  disabled = false,
}: CollectionAppliesToProps) {
  const [query, setQuery] = useState("");

  const options = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matches = collections.filter((collection) => {
      if (!needle) return true;
      return (
        collection.title.toLowerCase().includes(needle) ||
        collection.handle.toLowerCase().includes(needle)
      );
    });
    const selectedRows = collections.filter((collection) =>
      selected.includes(collection.collectionGid),
    );
    const seen = new Set<string>();
    const merged = [...selectedRows, ...matches].filter((collection) => {
      if (seen.has(collection.collectionGid)) return false;
      seen.add(collection.collectionGid);
      return true;
    });
    return merged.slice(0, 40).map((collection) => ({
      value: collection.collectionGid,
      label: collection.title,
    }));
  }, [collections, query, selected]);

  const selectedCollections = selected
    .map((gid) => collections.find((collection) => collection.collectionGid === gid))
    .filter((collection): collection is CollectionChoice => Boolean(collection));

  return (
    <BlockStack gap="200">
      <Autocomplete
        allowMultiple
        options={options}
        selected={selected}
        onSelect={(next) => {
          onChange(next);
          setQuery("");
        }}
        emptyState={
          collections.length === 0
            ? "Sync collections to assign this filter."
            : "No collections match that search."
        }
        textField={
          <Autocomplete.TextField
            label="Applies to"
            value={query}
            onChange={setQuery}
            placeholder="Search for collections"
            autoComplete="off"
            disabled={disabled}
          />
        }
      />
      {selectedCollections.length || appliesToSearch ? (
        <InlineStack gap="200" wrap>
          {selectedCollections.map((collection) => (
            <Tag
              key={collection.collectionGid}
              disabled={disabled}
              onRemove={() =>
                onChange(selected.filter((gid) => gid !== collection.collectionGid))
              }
            >
              {collection.title}
            </Tag>
          ))}
          {appliesToSearch ? (
            <Tag
              disabled={disabled}
              onRemove={() => onAppliesToSearchChange(false)}
            >
              Search
            </Tag>
          ) : null}
        </InlineStack>
      ) : (
        <Text as="p" variant="bodySm" tone="subdued">
          All collections unless you pick specific ones.
        </Text>
      )}
      <Checkbox
        label="Use on search results"
        helpText="Last-created search filter wins if more than one is checked."
        checked={appliesToSearch}
        disabled={disabled}
        onChange={onAppliesToSearchChange}
      />
    </BlockStack>
  );
}
