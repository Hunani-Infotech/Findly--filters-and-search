import { useRef, useState, type DragEvent, type KeyboardEvent } from "react";
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

function DragHandle() {
  return (
    <svg
      width="12"
      height="16"
      viewBox="0 0 12 16"
      aria-hidden="true"
      focusable="false"
    >
      {[0, 1, 2, 3, 4, 5].map((dot) => (
        <circle
          key={dot}
          cx={dot % 2 === 0 ? 3 : 9}
          cy={2 + Math.floor(dot / 2) * 6}
          r="1.4"
          fill="#8c9196"
        />
      ))}
    </svg>
  );
}

export function DisplayOrderList({
  keys,
  disabled = false,
  onChange,
}: DisplayOrderListProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const ghostRef = useRef<HTMLElement | null>(null);

  const clearGhost = () => {
    ghostRef.current?.remove();
    ghostRef.current = null;
  };

  const handleDragStart = (index: number, event: DragEvent<HTMLDivElement>) => {
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
    event.dataTransfer.setData("text/plain", keys[index]);
    event.dataTransfer.setDragImage(
      ghost,
      event.clientX - rect.left,
      event.clientY - rect.top,
    );
    setDragIndex(index);
    setOverIndex(index);
  };

  const handleDragOver = (index: number, event: DragEvent<HTMLDivElement>) => {
    if (disabled || dragIndex == null) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    const rect = event.currentTarget.getBoundingClientRect();
    const after = event.clientY > rect.top + rect.height / 2;
    const nextOver = after ? index + 1 : index;
    if (overIndex !== nextOver) setOverIndex(nextOver);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (disabled || dragIndex == null || overIndex == null) {
      clearGhost();
      setDragIndex(null);
      setOverIndex(null);
      return;
    }
    let target = overIndex;
    if (target > dragIndex) target -= 1;
    onChange(reorder(keys, dragIndex, target));
    clearGhost();
    setDragIndex(null);
    setOverIndex(null);
  };

  const handleDragEnd = () => {
    clearGhost();
    setDragIndex(null);
    setOverIndex(null);
  };

  const handleKeyDown = (
    index: number,
    event: KeyboardEvent<HTMLDivElement>,
  ) => {
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
      <div
        role="list"
        aria-label="Filter display order"
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleDrop}
      >
        {keys.map((key, index) => {
          const dragging = dragIndex === index;
          const noop =
            dragIndex != null &&
            (overIndex === dragIndex || overIndex === dragIndex + 1);
          const showLine =
            dragIndex != null && overIndex === index && !noop;
          return (
            <div key={key}>
              {showLine ? (
                <div
                  aria-hidden="true"
                  style={{
                    height: 3,
                    margin: "0 4px 6px",
                    borderRadius: 99,
                    background: "#005bd3",
                  }}
                />
              ) : null}
              <div
                role="listitem"
                draggable={!disabled}
                tabIndex={disabled ? -1 : 0}
                aria-grabbed={dragging}
                aria-label={`${displayOrderLabel(key)}. Position ${index + 1} of ${keys.length}`}
                onDragStart={(event) => handleDragStart(index, event)}
                onDragOver={(event) => handleDragOver(index, event)}
                onDragEnd={handleDragEnd}
                onKeyDown={(event) => handleKeyDown(index, event)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 12px",
                  marginBottom: 8,
                  minHeight: 40,
                  borderRadius: 10,
                  border: dragging
                    ? "1px dashed #c9cccf"
                    : "1px solid #e3e3e3",
                  background: dragging ? "#f6f6f7" : "#fff",
                  cursor: disabled ? "default" : "grab",
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
                  <Text as="span">{displayOrderLabel(key)}</Text>
                </span>
              </div>
            </div>
          );
        })}
        {dragIndex != null &&
        overIndex === keys.length &&
        overIndex !== dragIndex + 1 ? (
          <div
            aria-hidden="true"
            style={{
              height: 3,
              margin: "0 4px 6px",
              borderRadius: 99,
              background: "#005bd3",
            }}
          />
        ) : null}
      </div>
    </BlockStack>
  );
}
