import { Select, Text } from "@shopify/polaris";
import { DisplayOrderList } from "./display-order-list";
import {
  VALUE_SORT_MODE_LABELS,
  VALUE_SORT_MODES,
  mergeManualValueOrder,
  parseValueSort,
  type ValueSortMap,
  type ValueSortMode,
} from "../filters.server";

export type FacetValueCatalogItem = {
  key: string;
  label: string;
  values: string[];
};

type FacetValueSortEditorProps = {
  catalog: FacetValueCatalogItem[];
  valueSort: ValueSortMap;
  onChange: (next: ValueSortMap) => void;
  disabled?: boolean;
};

export function FacetValueSortEditor({
  catalog,
  valueSort,
  onChange,
  disabled = false,
}: FacetValueSortEditorProps) {
  const map = parseValueSort(valueSort);

  if (!catalog.length) {
    return (
      <Text as="p" variant="bodySm" tone="subdued">
        Sync products to this collection to reorder filter values. Size-like
        options stay in size order until you pick A–Z or a manual list.
      </Text>
    );
  }

  return (
    <>
      <Text as="p" variant="bodySm" tone="subdued">
        Automatic keeps A–Z (and size order for Size / Length / Width).
        Alphabetical forces A–Z. Manual uses the drag list after you save.
      </Text>
      {catalog.map((facet) => {
        const current = map[facet.key] ?? { mode: "auto" as const };
        const mode = current.mode;
        const keys =
          mode === "manual"
            ? mergeManualValueOrder(current.values, facet.values)
            : facet.values;
        return (
          <div key={facet.key} style={{ marginTop: 12 }}>
            <Select
              label={`${facet.label} values`}
              disabled={disabled}
              options={VALUE_SORT_MODES.map((value) => ({
                label: VALUE_SORT_MODE_LABELS[value],
                value,
              }))}
              value={mode}
              onChange={(nextMode) => {
                const parsed = nextMode as ValueSortMode;
                onChange({
                  ...map,
                  [facet.key]:
                    parsed === "manual"
                      ? {
                          mode: "manual",
                          values: mergeManualValueOrder(
                            current.values,
                            facet.values,
                          ),
                        }
                      : { mode: parsed },
                });
              }}
            />
            {mode === "manual" && keys.length > 1 ? (
              <div style={{ marginTop: 8 }}>
                <DisplayOrderList
                  keys={keys}
                  disabled={disabled}
                  labels={Object.fromEntries(keys.map((key) => [key, key]))}
                  helpText="Drag values into the order shoppers should see."
                  onChange={(next) =>
                    onChange({
                      ...map,
                      [facet.key]: { mode: "manual", values: next },
                    })
                  }
                />
              </div>
            ) : null}
          </div>
        );
      })}
    </>
  );
}
