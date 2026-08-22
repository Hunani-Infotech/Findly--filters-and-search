export function optionKeyFromName(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, "-");
}

function sourceKeyForOption(optionName: string) {
  return `option:${optionKeyFromName(optionName)}`;
}

export type CatalogSource = {
  key: string;
  label: string;
};

export type CatalogValueMap = Record<string, string[]>;

function uniqueSorted(values: string[]) {
  return [...new Set(values.filter((value) => value.trim()))].sort((a, b) =>
    a.localeCompare(b),
  );
}

export function collectCatalogFromProducts(
  products: Array<{
    vendor?: string;
    productType?: string;
    tags?: string[];
    options?: Record<string, string[]> | unknown;
  }>,
): { sources: CatalogSource[]; values: CatalogValueMap } {
  const vendors: string[] = [];
  const types: string[] = [];
  const tags: string[] = [];
  const optionValues = new Map<string, string[]>();
  const optionLabels = new Map<string, string>();

  for (const product of products) {
    if (product.vendor) vendors.push(product.vendor);
    if (product.productType) types.push(product.productType);
    for (const tag of product.tags ?? []) tags.push(tag);
    const options =
      product.options && typeof product.options === "object"
        ? (product.options as Record<string, string[]>)
        : {};
    for (const [name, list] of Object.entries(options)) {
      const key = sourceKeyForOption(name);
      optionLabels.set(key, name);
      const next = optionValues.get(key) ?? [];
      next.push(...(Array.isArray(list) ? list.map(String) : []));
      optionValues.set(key, next);
    }
  }

  const sources: CatalogSource[] = [
    { key: "productType", label: "Product type" },
    { key: "vendor", label: "Vendor" },
    { key: "tags", label: "Tag" },
    ...[...optionLabels.entries()]
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([key, label]) => ({
        key,
        label: `option:${label}`,
      })),
  ];

  const values: CatalogValueMap = {
    productType: uniqueSorted(types),
    vendor: uniqueSorted(vendors),
    tags: uniqueSorted(tags),
  };
  for (const [key, list] of optionValues) {
    values[key] = uniqueSorted(list);
  }
  return { sources, values };
}
