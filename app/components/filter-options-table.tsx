import { useRef, useState, type DragEvent, type KeyboardEvent } from "react";
import { useNavigate, useSearchParams } from "react-router";
import {
  Badge,
  BlockStack,
  Button,
  InlineStack,
  Text,
} from "@shopify/polaris";
import {
  displayTypeForFacet,
  FACET_DISPLAY_TYPE_LABELS,
  parseDisplayTypes,
  type FacetDisplayType,
  type FacetSource,
} from "../filters";
import { withEmbeddedParams } from "../admin-path";
import { ADMIN_TABLE_PAGE_SIZE, reorderWithinSubset, slicePage } from "../admin-list-page";
import { AdminListPagination } from "./admin-list-pagination";
import {
  displayChoicesForRow,
  type FilterOptionRow,
} from "../filter-option-rows";

type FilterOptionsTableProps = {
  rows: FilterOptionRow[];
  displayTypes: Record<string, string>;
  disabled?: boolean;
  onReorder: (nextKeys: string[]) => void;
  onRemove: (key: string) => void;
  onDisplayTypesChange: (next: Record<string, FacetDisplayType>) => void;
  treeId?: string;
  onEditOption?: (key: string) => void;
  onAddOption?: () => void;
  allowEdit?: boolean;
  showAddButton?: boolean;
};

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

function SourceCell({ row }: { row: FilterOptionRow }) {
  if (row.sourceKind === "option") {
    return (
      <InlineStack gap="100" blockAlign="center" wrap={false}>
        <span className="findly-option-source-badge">Option</span>
        <Text as="span" variant="bodySm" tone="subdued">
          {row.source.toLowerCase()}
        </Text>
      </InlineStack>
    );
  }
  if (row.sourceKind === "metafield") {
    return (
      <InlineStack gap="100" blockAlign="center" wrap={false}>
        <Badge tone="info">Metafield</Badge>
        <Text as="span" variant="bodySm" tone="subdued">
          {row.source}
        </Text>
      </InlineStack>
    );
  }
  return <Text as="span">{row.source}</Text>;
}

export function FilterOptionsTable({
  rows,
  displayTypes,
  disabled = false,
  onReorder,
  onRemove,
  onDisplayTypesChange,
  treeId,
  onEditOption,
  onAddOption,
  allowEdit = true,
  showAddButton = true,
}: FilterOptionsTableProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [page, setPage] = useState(0);
  const ghostRef = useRef<HTMLElement | null>(null);
  const keys = rows.map((row) => row.key);
  const types = parseDisplayTypes(displayTypes);
  const slice = slicePage(rows, page, ADMIN_TABLE_PAGE_SIZE);
  if (page !== slice.safePage) setPage(slice.safePage);
  const paged = slice.paged;
  const pagedKeys = paged.map((row) => row.key);

  const openEdit = (key: string) => {
    if (!allowEdit || disabled) return;
    if (onEditOption) {
      onEditOption(key);
      return;
    }
    if (treeId) {
      navigate(
        withEmbeddedParams(
          `/app/filters/${treeId}/options/${encodeURIComponent(key)}`,
          searchParams,
        ),
      );
    }
  };

  const openAdd = () => {
    if (onAddOption) {
      onAddOption();
      return;
    }
    if (treeId) {
      navigate(
        withEmbeddedParams(`/app/filters/${treeId}/options/new`, searchParams),
      );
    }
  };

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

  const handleDragOver = (index: number, event: DragEvent) => {
    if (disabled || dragIndex == null) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    const rect = event.currentTarget.getBoundingClientRect();
    const after = event.clientY > rect.top + rect.height / 2;
    setOverIndex(after ? index + 1 : index);
  };

  const handleDrop = (event: DragEvent) => {
    event.preventDefault();
    if (disabled || dragIndex == null || overIndex == null) {
      clearGhost();
      setDragIndex(null);
      setOverIndex(null);
      return;
    }
    let target = overIndex;
    if (target > dragIndex) target -= 1;
    onReorder(reorderWithinSubset(keys, pagedKeys, dragIndex, target));
    clearGhost();
    setDragIndex(null);
    setOverIndex(null);
  };

  const handleKeyDown = (index: number, event: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    if (event.key === "ArrowUp") {
      event.preventDefault();
      onReorder(reorderWithinSubset(keys, pagedKeys, index, index - 1));
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      onReorder(reorderWithinSubset(keys, pagedKeys, index, index + 1));
    }
  };

  return (
    <BlockStack gap="300">
      <div className="findly-filter-option-table">
        <div className="findly-filter-option-table__head">
          <span />
          <Text as="span" variant="bodySm" fontWeight="semibold">
            Label
          </Text>
          <Text as="span" variant="bodySm" fontWeight="semibold">
            Source
          </Text>
          <Text as="span" variant="bodySm" fontWeight="semibold">
            Display type
          </Text>
          <Text as="span" variant="bodySm" fontWeight="semibold">
            Actions
          </Text>
        </div>
        {rows.length === 0 ? (
          <Text as="p" tone="subdued">
            No filter options yet. Add an option to show it on the storefront.
          </Text>
        ) : (
          paged.map((row, index) => {
            const dragging = dragIndex === index;
            const showLine =
              dragIndex != null &&
              overIndex === index &&
              overIndex !== dragIndex &&
              overIndex !== dragIndex + 1;
            const choices = displayChoicesForRow(row);
            const lockedSlider = choices.length === 1 && choices[0] === "slider";
            const source: FacetSource =
              row.sourceKind === "option"
                ? "option"
                : row.sourceKind === "metafield"
                  ? "metafield"
                  : row.key === "tags"
                    ? "tag"
                    : row.key === "price"
                      ? "price"
                      : row.key === "sale"
                        ? "sale"
                        : row.key === "rating"
                          ? "rating"
                          : row.key === "availability"
                            ? "availability"
                            : row.key === "productType"
                              ? "productType"
                              : "vendor";
            const selectedType = lockedSlider
              ? "slider"
              : displayTypeForFacet(
                  {
                    key: row.key,
                    source,
                    label: row.label,
                    type: lockedSlider ? "range" : "checkbox",
                  },
                  types,
                );
            return (
              <div key={row.key}>
                {showLine ? (
                  <div className="findly-filter-option-table__line" aria-hidden="true" />
                ) : null}
                <div
                  className="findly-filter-option-table__row"
                  onDragOver={(event) => handleDragOver(index, event)}
                  onDrop={handleDrop}
                  style={{
                    opacity: dragging ? 0.55 : 1,
                    outline: dragging ? "1px dashed #c9cccf" : undefined,
                  }}
                >
                  <button
                    type="button"
                    draggable={!disabled}
                    disabled={disabled}
                    aria-label={`${row.label}. Position ${slice.start + index + 1} of ${rows.length}`}
                    onDragStart={(event) => handleDragStart(index, event)}
                    onDragEnd={() => {
                      clearGhost();
                      setDragIndex(null);
                      setOverIndex(null);
                    }}
                    onKeyDown={(event) => handleKeyDown(index, event)}
                    className="findly-filter-option-table__handle"
                  >
                    <DragHandle />
                  </button>
                  {allowEdit ? (
                    <Button
                      variant="plain"
                      submit={false}
                      disabled={disabled}
                      onClick={() => openEdit(row.key)}
                    >
                      {row.label}
                    </Button>
                  ) : (
                    <Text as="span" variant="bodyMd" fontWeight="semibold">
                      {row.label}
                    </Text>
                  )}
                  <SourceCell row={row} />
                  {lockedSlider || choices.length <= 1 || !allowEdit ? (
                    <Text as="span">
                      {FACET_DISPLAY_TYPE_LABELS[selectedType]}
                    </Text>
                  ) : (
                    <select
                      className="findly-filter-option-table__type"
                      aria-label={`${row.label} display type`}
                      disabled={disabled}
                      value={selectedType}
                      onClick={(event) => event.stopPropagation()}
                      onMouseDown={(event) => event.stopPropagation()}
                      onChange={(event) =>
                        onDisplayTypesChange({
                          ...types,
                          [row.key]: event.target.value as FacetDisplayType,
                        })
                      }
                    >
                      {choices.map((value) => (
                        <option key={value} value={value}>
                          {FACET_DISPLAY_TYPE_LABELS[value]}
                        </option>
                      ))}
                    </select>
                  )}
                  <InlineStack gap="200" wrap={false}>
                    {allowEdit ? (
                      <Button
                        variant="plain"
                        submit={false}
                        disabled={disabled}
                        onClick={() => openEdit(row.key)}
                      >
                        Edit
                      </Button>
                    ) : null}
                    <Button
                      variant="plain"
                      tone="critical"
                      submit={false}
                      disabled={disabled}
                      onClick={() => onRemove(row.key)}
                    >
                      Remove
                    </Button>
                  </InlineStack>
                </div>
              </div>
            );
          })
        )}
        {dragIndex != null &&
        overIndex === paged.length &&
        overIndex !== dragIndex + 1 ? (
          <div className="findly-filter-option-table__line" aria-hidden="true" />
        ) : null}
      </div>
      <AdminListPagination
        slice={slice}
        onPageChange={setPage}
        disabled={disabled}
        noun="option"
      />
      {showAddButton ? (
        <Button submit={false} disabled={disabled} onClick={openAdd}>
          + Add filter option
        </Button>
      ) : null}
    </BlockStack>
  );
}
