import { useRef, useState, type DragEvent, type KeyboardEvent } from "react";
import { BlockStack, Checkbox, Text } from "@shopify/polaris";
import { moveItem } from "../utils/admin-list-page";
import { DragHandle } from "./drag-handle";

type CheckboxOrderListProps = {
  keys: string[];
  enabled: ReadonlySet<string> | readonly string[];
  labels?: Partial<Record<string, string>>;
  disabled?: boolean;
  helpText?: string;
  onReorder: (next: string[]) => void;
  onToggle: (key: string, checked: boolean) => void;
};

export function CheckboxOrderList({
  keys,
  enabled,
  labels,
  disabled = false,
  helpText,
  onReorder,
  onToggle,
}: CheckboxOrderListProps) {
  const enabledSet = enabled instanceof Set ? enabled : new Set(enabled);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const ghostRef = useRef<HTMLElement | null>(null);

  const clearGhost = () => {
    ghostRef.current?.remove();
    ghostRef.current = null;
  };

  const handleDragStart = (index: number, event: DragEvent<HTMLButtonElement>) => {
    if (disabled) return;
    const source = event.currentTarget.closest(
      ".findly-search-fields__row",
    ) as HTMLElement | null;
    if (!source) return;
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
    ghost.style.pointerEvents = "none";
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

  const resetDrag = () => {
    clearGhost();
    setDragIndex(null);
    setOverIndex(null);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (disabled || dragIndex == null || overIndex == null) {
      resetDrag();
      return;
    }
    let target = overIndex;
    if (target > dragIndex) target -= 1;
    onReorder(moveItem(keys, dragIndex, target));
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
      onReorder(moveItem(keys, index, index - 1));
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      onReorder(moveItem(keys, index, index + 1));
    }
  };

  return (
    <BlockStack gap="200">
      {helpText ? (
        <Text as="p" variant="bodySm" tone="subdued">
          {helpText}
        </Text>
      ) : null}
      <div className="findly-search-fields">
        {keys.map((key, index) => {
          const dragging = dragIndex === index;
          const noop =
            dragIndex != null &&
            (overIndex === dragIndex || overIndex === dragIndex + 1);
          const showLine =
            dragIndex != null && overIndex === index && !noop;
          const label = labels?.[key] ?? key;
          return (
            <div key={key}>
              {showLine ? (
                <div className="findly-search-fields__drop-line" aria-hidden="true" />
              ) : null}
              <div
                className={`findly-search-fields__row${
                  dragging ? " findly-search-fields__row--dragging" : ""
                }`}
                onDragOver={(event) => handleDragOver(index, event)}
                onDrop={handleDrop}
              >
                <button
                  type="button"
                  className="findly-search-fields__handle"
                  draggable={!disabled}
                  disabled={disabled}
                  aria-label={`${label}. Position ${index + 1} of ${keys.length}`}
                  onDragStart={(event) => handleDragStart(index, event)}
                  onDragEnd={handleDragEnd}
                  onKeyDown={(event) => handleKeyDown(index, event)}
                >
                  <DragHandle />
                </button>
                <Checkbox
                  label={label}
                  checked={enabledSet.has(key)}
                  disabled={disabled}
                  onChange={(checked) => onToggle(key, checked)}
                />
              </div>
            </div>
          );
        })}
        {dragIndex != null &&
        overIndex === keys.length &&
        overIndex !== dragIndex + 1 ? (
          <div className="findly-search-fields__drop-line" aria-hidden="true" />
        ) : null}
      </div>
    </BlockStack>
  );
}
