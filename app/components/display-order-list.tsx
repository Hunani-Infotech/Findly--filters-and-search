import { useState, type DragEvent, type KeyboardEvent } from "react";
import { BlockStack, Text } from "@shopify/polaris";

const DISPLAY_ORDER_LABELS: Record<string, string> = {
  availability: "Availability",
  price: "Price",
  vendor: "Vendor",
  productType: "Product type",
  tags: "Tags",
  tag: "Tags",
  options: "Variant options",
};

export function displayOrderLabel(key: string) {
  return DISPLAY_ORDER_LABELS[key] ?? key;
}

type DisplayOrderListProps = {
  keys: string[];
  disabled?: boolean;
  onChange: (next: string[]) => void;
};

function reorder(keys: string[], from: number, to: number) {
  if (from === to || from < 0 || to < 0 || to >= keys.length) return keys;
  const next = [...keys];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function DisplayOrderList({
  keys,
  disabled = false,
  onChange,
}: DisplayOrderListProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  const handleDragStart = (index: number, event: DragEvent<HTMLDivElement>) => {
    if (disabled) return;
    setDragIndex(index);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", keys[index]);
  };

  const handleDragOver = (index: number, event: DragEvent<HTMLDivElement>) => {
    if (disabled || dragIndex == null) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    if (overIndex !== index) setOverIndex(index);
  };

  const handleDrop = (index: number, event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (disabled || dragIndex == null) return;
    onChange(reorder(keys, dragIndex, index));
    setDragIndex(null);
    setOverIndex(null);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    setOverIndex(null);
  };

  const handleKeyDown = (index: number, event: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    if (event.key === "ArrowUp") {
      event.preventDefault();
      onChange(reorder(keys, index, index - 1));
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      onChange(reorder(keys, index, index + 1));
    }
  };

  return (
    <BlockStack gap="200">
      <Text as="p" variant="bodySm" tone="subdued">
        Drag a row to change the order shoppers see. Arrow keys also work when a
        row is focused.
      </Text>
      <div role="list" aria-label="Filter display order">
        {keys.map((key, index) => {
          const dragging = dragIndex === index;
          const over = overIndex === index && dragIndex !== index;
          return (
            <div
              key={key}
              role="listitem"
              draggable={!disabled}
              tabIndex={disabled ? -1 : 0}
              aria-grabbed={dragging}
              aria-label={`${displayOrderLabel(key)}. Position ${index + 1} of ${keys.length}`}
              onDragStart={(event) => handleDragStart(index, event)}
              onDragOver={(event) => handleDragOver(index, event)}
              onDrop={(event) => handleDrop(index, event)}
              onDragEnd={handleDragEnd}
              onKeyDown={(event) => handleKeyDown(index, event)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 12px",
                marginBottom: 8,
                borderRadius: 8,
                border: over
                  ? "1px solid #005bd3"
                  : "1px solid #e3e3e3",
                background: dragging ? "#f6f6f7" : "#fff",
                opacity: dragging ? 0.7 : 1,
                cursor: disabled ? "default" : "grab",
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  color: "#8c9196",
                  fontSize: 14,
                  letterSpacing: 1,
                  lineHeight: 1,
                  userSelect: "none",
                }}
              >
                ⋮⋮
              </span>
              <Text as="span">{displayOrderLabel(key)}</Text>
            </div>
          );
        })}
      </div>
    </BlockStack>
  );
}
