import { BlockStack, ChoiceList, InlineStack, Text, TextField } from "@shopify/polaris";
import type { RangeBoundFormMap } from "../types/filters";

type RangeField = { key: string; label: string };

type NumericRangeBoundsProps = {
  fields: RangeField[];
  value: RangeBoundFormMap;
  disabled?: boolean;
  onChange: (next: RangeBoundFormMap) => void;
};

export function NumericRangeBounds({
  fields,
  value,
  disabled = false,
  onChange,
}: NumericRangeBoundsProps) {
  if (!fields.length) return null;

  return (
    <BlockStack gap="300">
      <Text as="h2" variant="headingMd">
        Numeric range sliders
      </Text>
      <Text as="p" variant="bodySm" tone="subdued">
        RANGE metafields use the same dual-thumb slider as price. Leave Auto to
        scan synced values, or set custom min / max like the price slider.
      </Text>
      {fields.map((field) => {
        const entry = value[field.key] ?? {
          mode: "auto" as const,
          min: "",
          max: "",
        };
        return (
          <BlockStack key={field.key} gap="200">
            <ChoiceList
              title={field.label}
              choices={[
                {
                  label: "From products in this collection",
                  value: "auto",
                  helpText: "Slider min and max come from synced numeric values.",
                },
                {
                  label: "Custom min / max",
                  value: "custom",
                  helpText:
                    "You set the slider bounds. Shoppers can still filter inside that range.",
                },
              ]}
              selected={[entry.mode]}
              disabled={disabled}
              onChange={(selected) =>
                onChange({
                  ...value,
                  [field.key]: {
                    ...entry,
                    mode: selected[0] === "custom" ? "custom" : "auto",
                  },
                })
              }
            />
            {entry.mode === "custom" ? (
              <InlineStack gap="300" wrap>
                <TextField
                  label="Custom min"
                  type="number"
                  autoComplete="off"
                  value={entry.min}
                  disabled={disabled}
                  onChange={(min) =>
                    onChange({
                      ...value,
                      [field.key]: { ...entry, min },
                    })
                  }
                />
                <TextField
                  label="Custom max"
                  type="number"
                  autoComplete="off"
                  value={entry.max}
                  disabled={disabled}
                  onChange={(max) =>
                    onChange({
                      ...value,
                      [field.key]: { ...entry, max },
                    })
                  }
                />
              </InlineStack>
            ) : null}
          </BlockStack>
        );
      })}
    </BlockStack>
  );
}
