import { useRef, useState, type DragEvent, type KeyboardEvent } from "react";
import { BlockStack, Select, Text } from "@shopify/polaris";
import { ADMIN_TABLE_PAGE_SIZE, reorderWithinSubset, slicePage } from "../utils/admin-list-page";
import { AdminListPagination } from "./admin-list-pagination";
import { DragHandle } from "./drag-handle";
import {
  displayTypeChoicesForKey,
  FACET_DISPLAY_TYPE_LABELS,
  parseDisplayTypes,
  type FacetDisplayType,
} from "../utils/filters";

const DISPLAY_ORDER_LABELS: Record<string, string> = {
  availability: "Availability",
  location: "Location",
  price: "Price",
  sale: "% Sale off",
  rating: "Rating",
  vendor: "Vendor",
  productType: "Product type",
  tags: "Tags",
  tag: "Tags",
  options: "Variant options",
  title: "Title",
  sku: "SKU",
};

function displayOrderLabel(
  key: string,
  labels?: Partial<Record<string, string>>,
) {
  return labels?.[key] ?? DISPLAY_ORDER_LABELS[key] ?? key;
}

type DisplayOrderListProps = {
  keys: string[];
  disabled?: boolean;
  onChange: (next: string[]) => void;
  displayTypes?: Record<string, string>;
  onDisplayTypesChange?: (next: Record<string, FacetDisplayType>) => void;
  labels?: Partial<Record<string, string>>;
  facetKinds?: Record<string, string>;
  helpText?: string;
};

export function DisplayOrderList({
  keys,
  disabled = false,
  onChange,
  displayTypes,
  onDisplayTypesChange,
  labels,
  facetKinds,
  helpText = "Drag a row to change the order shoppers see. Arrow keys also work when a row is focused. Display type: List, Dropdown, Checkbox, Swatch, Swatch-text, Slider, Radio, or Box. Price and numeric ranges stay sliders.",
}: DisplayOrderListProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [page, setPage] = useState(0);
  const ghostRef = useRef<HTMLElement | null>(null);
  const slice = slicePage(keys, page, ADMIN_TABLE_PAGE_SIZE);
  if (page !== slice.safePage) setPage(slice.safePage);
  const paged = slice.paged;

  const clearGhost = () => {
    ghostRef.current?.remove();
    ghostRef.current = null;
  };

  const handleDragStart = (index: number, event: DragEvent<HTMLButtonElement>) => {
    if (disabled) return;
    const source = event.currentTarget;
    const ghost = source.cloneNode(true) as HTMLElement;
    ghost.style.position = "absolute";
    ghost.style.top = "-1200px";
    ghost.style.left = "0";
    ghost.style.width = `${source.offsetWidth}px`;
    ghost.style.boxShadow = "0 10px 28px rgb(26 26 26 / 18%)";
    ghost.style.background = "#fff";
    ghost.style.border = "1px solid #c9cccf";
    ghost.style.borderRadius = "10px";
    ghost.style.opacity = "1";
    ghost.style.cursor = "grabbing";
    ghost.style.pointerEvents = "none";
    ghost.style.transform = "rotate(1.5deg)";
    document.body.appendChild(ghost);
    ghostRef.current = ghost;

    const rect = source.getBoundingClientRect();
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", paged[index]);
    event.dataTransfer.setDragImage(
      ghost,
      event.clientX - rect.left,
      event.clientY - rect.top,
    );
    setDragIndex(index);
    setOverIndex(index);
  };

  const handleDragOver = (index: number, event: DragEvent<HTMLButtonElement>) => {
    if (disabled || dragIndex == null) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    const rect = event.currentTarget.getBoundingClientRect();
    const after = event.clientY > rect.top + rect.height / 2;
    const nextOver = after ? index + 1 : index;
    if (overIndex !== nextOver) setOverIndex(nextOver);
  };

  const resetDrag = () => {
    clearGhost();
    setDragIndex(null);
    setOverIndex(null);
  };

  const handleDrop = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    if (disabled || dragIndex == null || overIndex == null) {
      resetDrag();
      return;
    }
    let target = overIndex;
    if (target > dragIndex) target -= 1;
    onChange(reorderWithinSubset(keys, paged, dragIndex, target));
    resetDrag();
  };

  const handleDragEnd = () => {
    resetDrag();
  };

  const handleKeyDown = (
    index: number,
    event: KeyboardEvent<HTMLButtonElement>,
  ) => {
    if (disabled) return;
    if (event.key === "ArrowUp") {
      event.preventDefault();
      onChange(reorderWithinSubset(keys, paged, index, index - 1));
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      onChange(reorderWithinSubset(keys, paged, index, index + 1));
    }
  };

  return (
    <BlockStack gap="200">
      <Text as="p" variant="bodySm" tone="subdued">
        {helpText}
      </Text>
      <div>
        {paged.map((key, index) => {
          const dragging = dragIndex === index;
          const noop =
            dragIndex != null &&
            (overIndex === dragIndex || overIndex === dragIndex + 1);
          const showLine =
            dragIndex != null && overIndex === index && !noop;
          return (
            <div key={key}>
              {showLine ? (
                <div className="findly-option-table__line" aria-hidden="true" />
              ) : null}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  width: "100%",
                  marginBottom: 8,
                }}
              >
              <button
                type="button"
                draggable={!disabled}
                disabled={disabled}
                aria-pressed={dragging}
                aria-label={`${displayOrderLabel(key, labels)}. Position ${slice.start + index + 1} of ${keys.length}`}
                onDragStart={(event) => handleDragStart(index, event)}
                onDragOver={(event) => handleDragOver(index, event)}
                onDrop={handleDrop}
                onDragEnd={handleDragEnd}
                onKeyDown={(event) => handleKeyDown(index, event)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  flex: 1,
                  minWidth: 0,
                  padding: "10px 12px",
                  minHeight: 40,
                  borderRadius: 10,
                  border: dragging
                    ? "1px dashed #c9cccf"
                    : "1px solid #e3e3e3",
                  background: dragging ? "#f6f6f7" : "#fff",
                  cursor: disabled ? "default" : "grab",
                  textAlign: "left",
                  font: "inherit",
                  color: "inherit",
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    display: dragging ? "none" : "flex",
                    alignItems: "center",
                    flexShrink: 0,
                  }}
                >
                  <DragHandle />
                </span>
                <span
                  style={{
                    visibility: dragging ? "hidden" : "visible",
                    userSelect: "none",
                  }}
                >
                  <Text as="span">{displayOrderLabel(key, labels)}</Text>
                </span>
              </button>
              {onDisplayTypesChange ? (
                // eslint-disable-next-line jsx-a11y/no-static-element-interactions -- isolate Select from row drag
                <div
                  style={{ width: 160, flexShrink: 0 }}
                  onClick={(event) => event.stopPropagation()}
                  onKeyDown={(event) => event.stopPropagation()}
                >
                  <Select
                    label="Display type"
                    labelHidden
                    disabled={disabled}
                    options={displayTypeChoicesForKey(
                      key,
                      facetKinds?.[key],
                    ).map((value) => ({
                      label: FACET_DISPLAY_TYPE_LABELS[value],
                      value,
                    }))}
                    value={
                      parseDisplayTypes(displayTypes)[key] ||
                      (key === "price" ||
                      String(facetKinds?.[key] || "").toUpperCase() === "RANGE"
                        ? "slider"
                        : "checkbox")
                    }
                    onChange={(value) =>
                      onDisplayTypesChange({
                        ...parseDisplayTypes(displayTypes),
                        [key]: value as FacetDisplayType,
                      })
                    }
                  />
                </div>
              ) : null}
              </div>
            </div>
          );
        })}
        {dragIndex != null &&
        overIndex === paged.length &&
        overIndex !== dragIndex + 1 ? (
          <div className="findly-option-table__line" aria-hidden="true" />
        ) : null}
      </div>
      <AdminListPagination
        slice={slice}
        onPageChange={setPage}
        disabled={disabled}
        noun="value"
      />
    </BlockStack>
  );
}
