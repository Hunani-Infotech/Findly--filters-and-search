import { Banner, BlockStack, List, Text } from "@shopify/polaris";
import { useNavigate } from "react-router";

export function FilterOptionsGuide({
  variant,
}: {
  variant: "default" | "collection";
}) {
  const navigate = useNavigate();

  return (
    <Banner
      tone="info"
      title={
        variant === "default"
          ? "Shop-wide filter options"
          : "Collection filter options"
      }
      action={{
        content: "Map metafields",
        onAction: () => navigate("/app/metafields"),
      }}
    >
      <BlockStack gap="200">
        <Text as="p">
          {variant === "default"
            ? "Collections without their own config inherit everything on this page."
            : "Saving this page creates a collection-specific config. Leave it on the shop-wide default if this collection should match the rest of the store."}
        </Text>
        <List type="number">
          <List.Item>
            Filter options: Price (auto or custom bounds), % Sale off, Availability,
            Vendor, Product type, Tags, Variant options (Size, Color, and other
            option names), plus any metafields you enabled as List, Range, or Yes/No.
          </List.Item>
          <List.Item>
            Matching: values inside one option are OR unless you turn on Use
            AND for Tags, variant options, or a list metafield. Different
            options still combine with AND.
          </List.Item>
          <List.Item>
            Display: drag order, then pick List, Dropdown, Checkbox, Swatch,
            Swatch-text, Radio, Box, or Slider (price and numeric ranges stay
            sliders).
          </List.Item>
          <List.Item>
            Value order: Automatic, Alphabetical, or Manual drag for each list
            option. Range sliders use the bounds above, not this list.
          </List.Item>
        </List>
      </BlockStack>
    </Banner>
  );
}
