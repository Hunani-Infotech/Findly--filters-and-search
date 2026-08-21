export const FINDLY_FILTER_RENDER_COMPLETED = "findlyFilterRenderCompleted";
export const GLOBO_FILTER_RENDER_COMPLETED = "globoFilterRenderCompleted";
export const SMART_FILTER_UPDATE_EVENT = "smart-filter:update";

export type PartnerIntegrationCategory =
  | "reviews"
  | "wishlist"
  | "translation"
  | "currency"
  | "badges";

export type PartnerIntegrationStatus = "built-in" | "event";

export type PartnerIntegration = {
  id: string;
  category: PartnerIntegrationCategory;
  name: string;
  status: PartnerIntegrationStatus;
  notes: string;
};

export const PARTNER_LISTENER_SNIPPET = `<!-- Findly Smart Filters: paste before </body> in theme.liquid -->
<script>
  (function () {
    function onFindlyGridReady(event) {
      // Findly native event. A globoFilterRenderCompleted alias is also
      // dispatched so existing Globo partner snippets keep working.
      console.log("Findly grid render completed", event && event.type);
      // Re-init your review / wishlist / badge widgets here if needed.
    }
    window.addEventListener("findlyFilterRenderCompleted", onFindlyGridReady);
    window.addEventListener("globoFilterRenderCompleted", onFindlyGridReady);
  })();
</script>
`;

export const PARTNER_INTEGRATIONS: PartnerIntegration[] = [
  {
    id: "judge-me",
    category: "reviews",
    name: "Judge.me",
    status: "built-in",
    notes:
      "After Ajax hide/show of the theme product grid, the widget calls jdgm.customizeBadges so star badges remain on visible cards.",
  },
  {
    id: "wishlist-hero",
    category: "wishlist",
    name: "Wishlist Hero",
    status: "built-in",
    notes:
      "Re-inits .wishlist-hero-custom-button after each filter rerender so hearts stay visible on remaining products.",
  },
  {
    id: "froonze-wishlist",
    category: "wishlist",
    name: "Froonze wishlist",
    status: "built-in",
    notes:
      "Calls frcp.wishlist.attachOnCollection after Ajax so wishlist buttons stay on remaining cards.",
  },
  {
    id: "swym-wishlist-plus",
    category: "wishlist",
    name: "Swym Wishlist Plus",
    status: "built-in",
    notes:
      "Calls _swat.initializeActionButtons after Ajax so wishlist hearts stay on remaining cards.",
  },
  {
    id: "shopify-translate-adapt",
    category: "translation",
    name: "Shopify Translate & Adapt",
    status: "built-in",
    notes:
      "Theme product cards keep locale HTML from the storefront. Cards are not rebuilt from English Admin API JSON.",
  },
  {
    id: "weglot",
    category: "translation",
    name: "Weglot",
    status: "built-in",
    notes: "Calls Weglot.refresh after Ajax so newly visible cards stay translated.",
  },
  {
    id: "shopify-markets-currency",
    category: "currency",
    name: "Shopify Markets / currency converter",
    status: "built-in",
    notes:
      "Calls Currency.convertAll after Ajax so theme money on remaining cards matches the shopper currency.",
  },
  {
    id: "flair-badges",
    category: "badges",
    name: "Flair",
    status: "event",
    notes:
      "Listen for findlyFilterRenderCompleted and re-apply Flair badges on visible product cards.",
  },
  {
    id: "sami-badges",
    category: "badges",
    name: "Sami badges",
    status: "event",
    notes:
      "Listen for findlyFilterRenderCompleted and re-apply Sami badges on visible product cards.",
  },
];
