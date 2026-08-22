export type MetafieldOwnerTypeValue = "PRODUCT" | "VARIANT";

export function normalizeMetafieldOwnerType(
  value: unknown,
): MetafieldOwnerTypeValue {
  return value === "VARIANT" ? "VARIANT" : "PRODUCT";
}
