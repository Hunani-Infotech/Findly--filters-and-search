export const TRANSLATION_TABS = [
  { id: "product", label: "Product" },
  { id: "search", label: "Search" },
  { id: "filter", label: "Filter" },
  { id: "sort", label: "Sort" },
  { id: "labels", label: "Filter option labels" },
  { id: "ymm", label: "Vehicle Finder form" },
  { id: "custom", label: "Custom" },
] as const;

export type TranslationTabId = (typeof TRANSLATION_TABS)[number]["id"];

export type TranslationField = {
  key: string;
  reference: string;
  defaultValue: string;
};

export const TRANSLATION_FIELDS: Record<
  Exclude<TranslationTabId, "labels" | "custom">,
  TranslationField[]
> = {
  product: [
    { key: "product.add_to_cart", reference: "Add to cart", defaultValue: "Add to cart" },
    { key: "product.unavailable", reference: "Unavailable", defaultValue: "Unavailable" },
    { key: "product.sold_out", reference: "Sold out", defaultValue: "Sold out" },
    { key: "product.sale", reference: "Sale", defaultValue: "Sale" },
    { key: "product.load_more", reference: "Load more", defaultValue: "Load more" },
    { key: "product.show", reference: "Show", defaultValue: "Show" },
    {
      key: "product.search_products",
      reference: "Search products",
      defaultValue: "Search products",
    },
    {
      key: "product.empty_collection",
      reference: "Sorry, there are no products in this collection",
      defaultValue: "Sorry, there are no products in this collection",
    },
  ],
  search: [
    { key: "search.recent_searches", reference: "Recent searches", defaultValue: "" },
    {
      key: "search.popular_search_terms",
      reference: "Popular search terms",
      defaultValue: "",
    },
    { key: "search.suggestions", reference: "Suggestions", defaultValue: "Suggestions" },
    { key: "search.collections", reference: "Collections", defaultValue: "Collections" },
    { key: "search.blog_posts", reference: "Blog Posts", defaultValue: "Blog Posts" },
    { key: "search.pages", reference: "Pages", defaultValue: "Pages" },
    { key: "search.product", reference: "Product", defaultValue: "Product" },
    { key: "search.products", reference: "Products", defaultValue: "Products" },
    { key: "search.search_for", reference: "Search for", defaultValue: "Search for" },
    {
      key: "search.view_all_products",
      reference: "View all products",
      defaultValue: "View all products",
    },
    {
      key: "search.empty_search_message",
      reference: "Empty search message",
      defaultValue: "Sorry, nothing found for",
    },
    {
      key: "search.product_not_found",
      reference: "Product not found message",
      defaultValue: "No products were found",
    },
    {
      key: "search.no_result_products_title",
      reference: "No result products suggestions title",
      defaultValue: "However, You may like",
    },
    {
      key: "search.no_result_keywords_title",
      reference: "No result keywords suggestions title",
      defaultValue: "Popular searches",
    },
    {
      key: "search.zero_char_products_title",
      reference: "Zero character products suggestions title",
      defaultValue: "Trending products",
    },
    {
      key: "search.zero_char_keywords_title",
      reference: "Zero character keywords suggestions title",
      defaultValue: "",
    },
  ],
  filter: [
    { key: "filter", reference: "Filter By", defaultValue: "Filter By" },
    { key: "clear", reference: "Clear All", defaultValue: "Clear All" },
    { key: "filter.view", reference: "View", defaultValue: "View" },
    { key: "filter.clear", reference: "Clear", defaultValue: "Clear" },
    { key: "in_stock", reference: "In Stock", defaultValue: "In Stock" },
    { key: "out_of_stock", reference: "Out of Stock", defaultValue: "Out of Stock" },
    {
      key: "filter.ready_to_ship",
      reference: "Ready to ship",
      defaultValue: "Ready to ship",
    },
    { key: "filter.yes", reference: "Yes", defaultValue: "Yes" },
    { key: "filter.no", reference: "No", defaultValue: "No" },
    {
      key: "filter.search_options",
      reference: "Search options",
      defaultValue: "Search options",
    },
    {
      key: "filter.choose_values",
      reference: "Choose values",
      defaultValue: "Choose values",
    },
    { key: "filter.show_more", reference: "Show more", defaultValue: "Show more" },
    { key: "filter.show_less", reference: "Show less", defaultValue: "Show less" },
  ],
  sort: [
    { key: "sort.sort_by", reference: "Sort By", defaultValue: "Sort By" },
    { key: "sort_manual", reference: "Featured", defaultValue: "Featured" },
    { key: "sort.availability", reference: "Availability", defaultValue: "Availability" },
    { key: "sort.relevance", reference: "Relevance", defaultValue: "Relevance" },
    {
      key: "sort.most_relevant",
      reference: "Most relevant",
      defaultValue: "Most relevant",
    },
    { key: "sort.best_selling", reference: "Best Selling", defaultValue: "Best Selling" },
    {
      key: "sort_title_asc",
      reference: "Alphabetically, A-Z",
      defaultValue: "Alphabetically, A-Z",
    },
    {
      key: "sort_title_desc",
      reference: "Alphabetically, Z-A",
      defaultValue: "Alphabetically, Z-A",
    },
    {
      key: "sort_price_asc",
      reference: "Price, low to high",
      defaultValue: "Price, low to high",
    },
    {
      key: "sort_price_desc",
      reference: "Price, high to low",
      defaultValue: "Price, high to low",
    },
    {
      key: "sort_date_desc",
      reference: "Date, new to old",
      defaultValue: "Date, new to old",
    },
    {
      key: "sort_date_asc",
      reference: "Date, old to new",
      defaultValue: "Date, old to new",
    },
    {
      key: "sort.published_newest",
      reference: "Published: Newest first",
      defaultValue: "Published: Newest first",
    },
    {
      key: "sort.published_oldest",
      reference: "Published: Oldest first",
      defaultValue: "Published: Oldest first",
    },
    {
      key: "sort.updated_newest",
      reference: "Updated: Newest first",
      defaultValue: "Updated: Newest first",
    },
    {
      key: "sort.updated_oldest",
      reference: "Updated: Oldest first",
      defaultValue: "Updated: Oldest first",
    },
    {
      key: "sort.inventory_asc",
      reference: "Inventory quantity, low to high",
      defaultValue: "",
    },
    {
      key: "sort.inventory_desc",
      reference: "Inventory quantity, high to low",
      defaultValue: "",
    },
    {
      key: "sort_sale_pct_desc",
      reference: "% Sale off",
      defaultValue: "% Sale off",
    },
  ],
  ymm: [
    {
      key: "ymm.heading",
      reference: "Form heading",
      defaultValue: "Search products",
    },
    {
      key: "ymm.select_placeholder",
      reference: "Select placeholder",
      defaultValue: "-- Select --",
    },
    {
      key: "ymm.search_placeholder",
      reference: "Search input placeholder",
      defaultValue: "Search",
    },
    {
      key: "ymm.search_button",
      reference: "Search button text",
      defaultValue: "Search",
    },
  ],
};

export const BUILTIN_LABEL_FIELDS: TranslationField[] = [
  { key: "label.collection", reference: "Collection", defaultValue: "" },
  { key: "label.category", reference: "Category", defaultValue: "" },
  { key: "label.vendor", reference: "Vendor", defaultValue: "" },
  { key: "label.product_type", reference: "Product Type", defaultValue: "" },
  { key: "label.price", reference: "Price", defaultValue: "" },
  { key: "label.percent_sale", reference: "Percent Sale", defaultValue: "" },
  { key: "label.availability", reference: "Availability", defaultValue: "" },
  { key: "label.tag", reference: "Tag", defaultValue: "" },
  { key: "label.ready_to_ship", reference: "Ready To Ship", defaultValue: "" },
  { key: "label.location", reference: "Location", defaultValue: "" },
];

export function parseTranslationTab(raw: string | null): TranslationTabId {
  const value = String(raw || "").trim();
  return TRANSLATION_TABS.some((tab) => tab.id === value)
    ? (value as TranslationTabId)
    : "product";
}

export function defaultCatalogStrings() {
  const out: Record<string, string> = {};
  for (const fields of Object.values(TRANSLATION_FIELDS)) {
    for (const field of fields) {
      if (field.defaultValue) out[field.key] = field.defaultValue;
    }
  }
  return out;
}

export function labelKeyFromOption(optionKey: string) {
  return `label.option.${optionKey}`;
}
