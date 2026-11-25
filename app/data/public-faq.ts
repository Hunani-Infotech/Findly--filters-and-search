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
      "In the theme editor, add the Collection filters app block to collection templates. You can also add it to the search template when Show filters on the search results page is on. Placement (left, right, or top), accent color, and product counts are set in Findly → Settings. The app embed is the fallback and loads on collection and search templates.",
  },
  {
    id: "theme-code",
    category: "setup",
    question: "Do I need to edit my theme’s code?",
    answer:
      "No. Findly ships as a Theme App Extension. Add Collection filters in the theme editor. When Judge.me, Wishlist Hero, or Weglot is already on the page, Findly calls that app after the product grid updates.",
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
      "Map product metafields in Settings → Metafields, then include them in a filter set. Plan limits apply to metafield mappings: 0 on a live shop with no paid plan, 6 on Standard, 15 on Pro, and 40 on Plus. Development stores are capped at 5,000 products and 25 metafield filters. Other filter types are included on every plan, subject to the product index cap.",
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
    question: "How does collection search work?",
    answer:
      "In Settings, turn on Allow searching within collection pages. Collection pages then show a search field in the collection filters. Matches stay inside that collection and any active filters. Search in Admin chooses which product fields are matched, plus fuzzy matching, fallback, and stop words.",
  },
  {
    id: "search-results-filters",
    category: "search",
    question: "Can shoppers filter the search results page?",
    answer:
      "Yes, when Show filters on the search results page is on in Settings and Collection filters is on the search template (or the app embed is enabled). That filters the store’s own search results. Findly does not add a header search field.",
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
      "Open Analytics in the Findly admin for filter usage. Counts stay at zero until the theme widgets are live and shoppers use them.",
  },
  {
    id: "plans",
    category: "billing",
    question: "What plans are available?",
    answer:
      "Development ($0, Shopify development stores only: 5,000 products, 25 metafield filters, analytics kept 90 days). A live shop with no paid plan is labeled No paid plan and has 0 products and 0 metafield filters. Standard ($11.99 USD every 30 days, 200 products, 6 metafield filters, analytics kept 90 days) starts at install with no trial. Pro ($19.99 USD every 30 days, 1,000 products, 15 metafield filters, analytics kept 180 days). Plus ($34.99 USD every 30 days, 5,000 products, 40 metafield filters, analytics kept 365 days). Charges go through the Shopify Billing API. See the [Terms of Service](/terms#billing) for the full billing section.",
  },
  {
    id: "change-plan",
    category: "billing",
    question: "How do I change or cancel a plan?",
    answer:
      "Switch plans in Findly → Pricing plans without reinstalling. Paid upgrades create or replace a Shopify charge you must approve in Admin. Uninstalling cancels the Shopify subscription according to Shopify’s billing rules. If you decline a new charge, a live shop stays on no paid plan (no catalog index) until you approve Standard, Pro, or Plus.",
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
      "Mandatory Shopify compliance webhooks are implemented: customer data request, customer redact, shop redact, and app uninstall. On uninstall we revoke sessions, mark the shop uninstalled, and reset local billing to free (row kept); catalog and settings are retained until shop/redact. On reinstall, paid status is rebuilt from Shopify. shop/redact hard-deletes tenant data unless the merchant has reinstalled (we skip purge when an offline app session exists again). Details are in the Privacy Policy.",
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
