export const FAQ_CATEGORIES = [
  { id: "all", label: "All" },
  { id: "setup", label: "Setup" },
  { id: "filters", label: "Filters" },
  { id: "search", label: "Search" },
  { id: "billing", label: "Billing" },
  { id: "privacy", label: "Data & privacy" },
] as const;

export type FaqCategoryId = Exclude<(typeof FAQ_CATEGORIES)[number]["id"], "all">;

export type FaqItem = {
  id: string;
  category: FaqCategoryId;
  question: string;
  answer: string;
};

/** Merchant-facing FAQ. Answers must match live product + Terms/Privacy. */
export const FAQ_ITEMS: FaqItem[] = [
  {
    id: "install",
    category: "setup",
    question: "How do I install Findly on my Shopify store?",
    answer:
      "Open Findly and enter your .myshopify.com domain, or install from the Shopify App Store. Shopify handles OAuth. After you approve the app, you land in the embedded admin — there is no separate Findly password. Catalog sync starts from Home.",
  },
  {
    id: "theme-blocks",
    category: "setup",
    question: "How do I show filters and search on the storefront?",
    answer:
      "In the theme editor, add the Collection filters app block to collection (and search) templates. For storefront search, add the Product search block and/or enable Instant search as an app embed. Placement (left, right, or top), accent color, and product counts are set in Findly → Settings. You do not need custom theme code for the core widget.",
  },
  {
    id: "theme-code",
    category: "setup",
    question: "Do I need to edit my theme’s code?",
    answer:
      "No. Findly ships as a Theme App Extension. Add the blocks in the theme editor. After Ajax filtering, review and wishlist widgets (and Weglot) can re-init from Integrations so they stay in sync with the filtered grid.",
  },
  {
    id: "which-filters",
    category: "filters",
    question: "Which filters can shoppers use?",
    answer:
      "Price, availability, vendor, product type, tags, options, and metafields you map. You enable a filter set under Filters and choose which collections it applies to. Color swatches can use Shopify Files; Findly stores the resulting URL, not a second media library.",
  },
  {
    id: "metafields",
    category: "filters",
    question: "How do metafield filters work?",
    answer:
      "Map product metafields in Settings → Metafields, then include them in a filter set. Plan limits apply to metafield mappings (0 on Development for live shops, 6 on Standard, 15 on Pro). Development stores get the full catalog. Other filter types are included on every plan, subject to the product index cap.",
  },
  {
    id: "filters-not-showing",
    category: "filters",
    question: "Filters are enabled but not showing — what should I check?",
    answer:
      "Confirm the Collection filters block is on the live collection template, the filter set is enabled and assigned to that collection, and catalog sync on Home has finished. The widget loads from your theme over the app proxy (/apps/smart-filter), so the page must be a collection or search template where the block is present.",
  },
  {
    id: "storefront-search",
    category: "search",
    question: "How does storefront search work?",
    answer:
      "Shoppers search your indexed catalog through the Theme App Extension — keyword product search with optional instant suggestions. Findly is not a separate search-engine site and does not use AI ranking. Configure fields, the instant widget, pinnings, synonyms, and redirects under Search in Admin.",
  },
  {
    id: "search-extras",
    category: "search",
    question: "What are pinnings, synonyms, and redirects?",
    answer:
      "Pinnings pin specific products to the top of chosen queries. Synonyms map related terms so a search for one word also matches another. Redirects send a query to a collection or page you choose. All three are configured in Findly → Search.",
  },
  {
    id: "instant-vs-block",
    category: "search",
    question: "What is the difference between Product search and Instant search?",
    answer:
      "Product search is a theme app block you place on a template (typically the search page) to show results in your theme. Instant search is an app embed that shows suggestions as shoppers type. You can use one or both.",
  },
  {
    id: "translation",
    category: "search",
    question: "Can I translate filter and search labels?",
    answer:
      "Yes. Translation lets you edit widget labels per locale. Shoppers still see your storefront language; Findly does not replace Shopify Markets or your theme’s locale files.",
  },
  {
    id: "analytics",
    category: "search",
    question: "Where can I see popular searches and filters?",
    answer:
      "Open Analytics in the Findly admin for top queries, no-results, and popular filters. Counts stay at zero until the theme widgets are live and shoppers use them.",
  },
  {
    id: "plans",
    category: "billing",
    question: "What plans are available?",
    answer:
      "Development ($0, Shopify development / partner stores only, all features included). Live shops are not on Development. Standard ($11.99 USD every 30 days, 200 products, 6 metafield filters) starts at install with no trial. Pro ($19.99 USD every 30 days, 1,000 products, 15 metafield filters). Charges go through the Shopify Billing API. See the [Terms of Service](/terms#billing) for the full billing section.",
  },
  {
    id: "change-plan",
    category: "billing",
    question: "How do I change or cancel a plan?",
    answer:
      "Switch plans in Findly → Pricing plans without reinstalling. Paid upgrades create or replace a Shopify charge you must approve in Admin. Uninstalling cancels the Shopify subscription according to Shopify’s billing rules. If you decline a new charge, you stay on Development (no live catalog) until you approve Standard or Pro.",
  },
  {
    id: "refunds",
    category: "billing",
    question: "Can I get a refund?",
    answer:
      "There is no 30-day money-back guarantee from Findly. Refunds, if any, are handled through Shopify’s billing tools and policies, not as a separate cash refund from us. Development stores may see test charges when billing test mode is on; those are not a production invoice.",
  },
  {
    id: "what-data",
    category: "privacy",
    question: "What data does Findly store?",
    answer:
      "Findly stores shop-scoped catalog data used for filters and search (products, collections, vendors, tags, mapped metafields), your filter/search configuration, billing entitlement, and analytics counts from the widgets. Every table is tied to the installing shop. We use the Admin GraphQL API only. See the [Privacy Policy](/privacy) for permissions, retention, and GDPR webhooks.",
  },
  {
    id: "shopper-accounts",
    category: "privacy",
    question: "Do shoppers create a Findly account?",
    answer:
      "No. Shoppers only use the filter and search widgets on your storefront. They never create a Findly login. Findly does not request customer or order data from Shopify.",
  },
  {
    id: "gdpr",
    category: "privacy",
    question: "How does Findly handle GDPR and uninstall?",
    answer:
      "Mandatory Shopify compliance webhooks are implemented: customer data request, customer redact, shop redact, and app uninstall. After uninstall, shop-scoped data is deleted as described in the Privacy Policy — not left as empty stubs.",
  },
  {
    id: "contact",
    category: "privacy",
    question: "How do I contact support?",
    answer:
      "Email info@srhwebagency.com. Installed merchants can also use Contact inside the Findly admin. Do not send privacy or billing disputes about this app to Shopify’s generic inboxes — use the email above and the [Privacy Policy](/privacy) contact section.",
  },
];

export function faqHaystack(item: FaqItem): string {
  const categoryLabel =
    FAQ_CATEGORIES.find((c) => c.id === item.category)?.label ?? item.category;
  return `${item.question} ${item.answer} ${categoryLabel} ${item.id}`.toLowerCase();
}

export function filterFaqItems(
  items: FaqItem[],
  query: string,
  category: string,
): FaqItem[] {
  const cat = category.trim().toLowerCase() || "all";
  const tokens = query
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);

  return items.filter((item) => {
    if (cat !== "all" && item.category !== cat) return false;
    if (tokens.length === 0) return true;
    const hay = faqHaystack(item);
    return tokens.every((token) => hay.includes(token));
  });
}
