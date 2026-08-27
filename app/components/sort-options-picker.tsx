import { useMemo, useState, type DragEvent } from "react";
import {
  BlockStack,
  Combobox,
  Icon,
  Listbox,
  Text,
} from "@shopify/polaris";
import { SearchIcon } from "@shopify/polaris-icons";
import {
  SORT_OPTION_KEYS,
  SORT_OPTION_LABELS,
  type SortOptionKey,
} from "../utils/app-settings";

const EMPTY_VALUE = "__empty__";

type SortOptionsPickerProps = {
  selected: SortOptionKey[];
  disabled?: boolean;
  onChange: (next: SortOptionKey[]) => void;
};

function moveOption(
  list: SortOptionKey[],
  from: number,
  to: number,
): SortOptionKey[] {
  if (
    from === to ||
    from < 0 ||
    to < 0 ||
    from >= list.length ||
    to >= list.length
  ) {
    return list;
  }
  const next = [...list];
  const [item] = next.splice(from, 1);
  if (!item) return list;
  next.splice(to, 0, item);
  return next;
}

export function SortOptionsPicker({
  selected,
  disabled = false,
  onChange,
}: SortOptionsPickerProps) {
  const [query, setQuery] = useState("");
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const needle = query.trim().toLowerCase();
  const options = useMemo(
    () =>
      SORT_OPTION_KEYS.filter((key) =>
        needle ? SORT_OPTION_LABELS[key].toLowerCase().includes(needle) : true,
      ),
    [needle],
  );

  const toggle = (key: SortOptionKey) => {
    if (disabled) return;
    onChange(
      selected.includes(key)
        ? selected.filter((item) => item !== key)
        : [...selected, key],
    );
  };

  const handleDragStart = (
    index: number,
    event: DragEvent<HTMLSpanElement>,
  ) => {
    if (disabled) return;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", selected[index] ?? "");
    setDragIndex(index);
  };

  const handleDragOver = (
    index: number,
    event: DragEvent<HTMLSpanElement>,
  ) => {
    if (disabled || dragIndex == null) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    if (overIndex !== index) setOverIndex(index);
  };

  const handleDrop = (index: number, event: DragEvent<HTMLSpanElement>) => {
    event.preventDefault();
    if (disabled || dragIndex == null) return;
    onChange(moveOption(selected, dragIndex, index));
    setDragIndex(null);
    setOverIndex(null);
  };

  const clearDrag = () => {
    setDragIndex(null);
    setOverIndex(null);
  };

  return (
    <BlockStack gap="200">
      <Combobox
        allowMultiple
        onClose={() => setQuery("")}
        activator={
          <Combobox.TextField
            label="Sorting options"
            prefix={<Icon source={SearchIcon} />}
            value={query}
            placeholder="Search sorting options"
            autoComplete="off"
            disabled={disabled}
            onChange={setQuery}
          />
        }
      >
        <Listbox
          onSelect={(value) => {
            if (value === EMPTY_VALUE) return;
            toggle(value as SortOptionKey);
          }}
          accessibilityLabel="Sorting options"
        >
          {options.length === 0 ? (
            <Listbox.Option value={EMPTY_VALUE} disabled>
              No matching sort options
            </Listbox.Option>
          ) : (
            options.map((key) => {
              const checked = selected.includes(key);
              return (
                <Listbox.Option
                  key={key}
                  value={key}
                  selected={checked}
                  accessibilityLabel={SORT_OPTION_LABELS[key]}
                >
                  <Listbox.TextOption selected={checked} disabled={disabled}>
                    {SORT_OPTION_LABELS[key]}
                  </Listbox.TextOption>
                </Listbox.Option>
              );
            })
          )}
        </Listbox>
      </Combobox>
      {selected.length ? (
        <div className="findly-sort-chips">
          {selected.map((key, index) => (
            <span
              key={key}
              className={`findly-sort-chip${
                dragIndex === index ? " findly-sort-chip--dragging" : ""
              }${overIndex === index && dragIndex !== index ? " findly-sort-chip--over" : ""}${disabled ? " findly-sort-chip--disabled" : ""}`}
              draggable={!disabled}
              onDragStart={(event) => handleDragStart(index, event)}
              onDragOver={(event) => handleDragOver(index, event)}
              onDrop={(event) => handleDrop(index, event)}
              onDragEnd={clearDrag}
            >
              <span className="findly-sort-chip__handle" aria-hidden="true">
                <svg width="8" height="14" viewBox="0 0 8 14" focusable="false">
                  <circle cx="2" cy="2" r="1.15" fill="currentColor" />
                  <circle cx="6" cy="2" r="1.15" fill="currentColor" />
                  <circle cx="2" cy="7" r="1.15" fill="currentColor" />
                  <circle cx="6" cy="7" r="1.15" fill="currentColor" />
                  <circle cx="2" cy="12" r="1.15" fill="currentColor" />
                  <circle cx="6" cy="12" r="1.15" fill="currentColor" />
                </svg>
              </span>
              <span className="findly-sort-chip__label">
                {SORT_OPTION_LABELS[key]}
              </span>
              <button
                type="button"
                className="findly-sort-chip__remove"
                disabled={disabled}
                aria-label={`Remove ${SORT_OPTION_LABELS[key]}`}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={() => toggle(key)}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      ) : (
        <Text as="p" variant="bodySm" tone="subdued">
          No sorting options selected. The Sort By dropdown stays hidden.
        </Text>
      )}
    </BlockStack>
  );
}
