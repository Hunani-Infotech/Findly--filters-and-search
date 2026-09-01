# Partner listing copy

Paste-ready text for **Apps → Findly → Distribution → Manage listing**.

Cross-checked against `app/routes/app.tsx` NavMenu. Vehicle Finder and Recommendations are not in the product. Do not invent extras in the Partner form.

## NavMenu vs listing

| Nav item | Route | Listing? | Why |
|---|---|---|---|
| Home | `/app` | Yes | Onboarding, catalog sync popup, performance |
| Filters | `/app/filters` | Yes | Filter sets, color swatches, value groups |
| Collections | `/app/collections` | Yes | Synced catalog list → per-collection filter config |
| Search | `/app/search` | Yes | Search fields, instant widget, pinnings, synonyms, redirects |
| Settings | `/app/settings` | Yes | Panel position, metafields |
| Translation | `/app/translation` | Yes | Widget label locales |
| Integrations | `/app/integrations` | Yes | Judge.me / wishlist / Weglot re-init after Ajax |
| Analytics | `/app/analytics` | Yes — one feature line only | Finished dashboard, visible in nav |
| Pricing plans | `/app/billing` | Yes (pricing fields) | Free / Standard / Pro |
| Contact | `/app/contact` | No | Use the same Gmail in listing support |

Catalog sync is on **Home**. `/app/sync` redirects there; it is not a NavMenu item.

---

## Paste into Partner Dashboard

Character limits: name 30, introduction 100, details 500, each feature 80.

### App name (≤30)

```
Findly: Smart Filters & Search
```

### App card subtitle / tagline

```
Help shoppers find products faster with collection filters and storefront search
```

### App introduction (≤100)

```
Shoppers filter collections and search products in your theme. Add the widget as a theme app block.
```

### App details (≤500)

```
Findly adds collection filters and storefront search via a theme app block. Enable sets under Filters. Map metafields and set left, right, or top placement in Settings. Search includes keyword search, instant suggestions, pins, synonyms, and redirects. Shoppers filter by price, availability, vendor, type, tags, options, and metafields. Translation edits widget labels. Integrations keep review and wishlist widgets in sync. Analytics shows search and filter usage. Plans: Free, Standard, and Pro.
```

### Feature list (≤80 each)

1. Filter collections by price, availability, vendor, type, tags, and options.
2. Map product metafields to filters and choose which collections they apply to.
3. Add collection filters on Online Store 2.0 themes with a theme app block.
4. Let shoppers search products with a search block and instant suggestions.
5. Pin products, map synonyms, and redirect searches from the Search pages.
6. Set color swatches, grouped values, and left, right, or top filter placement.
7. Translate widget labels. Review and wishlist apps stay in sync after filters.
8. See filter and search analytics: top queries, no-results, and popular filters.

### How it works

1. Install Findly. Catalog sync starts; open Home → View details to check status or run a full sync.
2. On Filters, enable a filter set. Choose price, availability, vendor, type, tags, options, and metafields.
3. In the theme editor, add **Collection filters** on collection templates. Add **Product search** and/or **Instant search** for storefront search.
4. Optional: Settings for panel look, Search for pins / synonyms / redirects, Translation for labels.

### Search terms (5)

1. product filters
2. collection filters
3. storefront search
4. instant search
5. metafield filters

### Integrations (up to 6)

Only apps Findly re-inits after Ajax (`app/utils/partner-integrations.ts`). Do not list Shopify itself.

1. Judge.me
2. Wishlist Hero
3. Froonze wishlist
4. Swym Wishlist Plus
5. Weglot

### Resources

**Privacy policy URL**

```
https://deeppink-manatee-141983.hostingersite.com/privacy
```

**Terms of service URL**

```
https://deeppink-manatee-141983.hostingersite.com/terms
```

**Support email** (listing contact only — must not contain “Shopify”)

```
sohilhunani11@gmail.com
```

### Pricing (must match Billing API)

Primary method: **Recurring charge**, with one plan marked **Free**. Monthly only. Do not enter yearly prices.

| Plan | Price / 30 days | Trial | Products | Metafield filters |
|---|---|---|---|---|
| Free | $0.00 — no Shopify charge | — | 200 | 5 |
| Standard | $9.99 USD | 7 days | 1,000 | 12 |
| Pro | $19.99 USD | 7 days | 5,000 | 25 |

**Free** — Collection filters, storefront search, Theme App Extension, up to 5 metafield filters, up to 200 products.

**Standard** — Everything in Free, up to 1,000 products and 12 metafield filters, 7-day trial then billed every 30 days.

**Pro** — Everything in Standard, up to 5,000 products and 25 metafield filters, 7-day trial then billed every 30 days.

Do not claim a 30-day money-back guarantee.

---

## Listing media

| Asset | File | Spec |
|---|---|---|
| App icon | `docs/listing-assets/app-icon-1200.jpg` (or `.png`) | 1200×1200 |
| Screenshots | Capture from admin + storefront | 3–6 images, 1600×900 |
| Feature media | Strong storefront frame or short video | Listing card |

Suggested screenshots: Home, Filters, storefront collection filters, Instant search header; optional Search/Analytics.

---

## Demo store + reviewer notes

Demo collection:

```
https://findly-test-store.myshopify.com/collections/all
```

Admin: `https://admin.shopify.com/store/findly-test-store`

Put real storefront password, collaborator code, screencast URL, and emergency phone into Partner — never placeholder text.

Theme steps for reviewers (only these three):

1. App embeds → **Collection filters** ON  
2. App embeds → **Instant search** ON  
3. Search template / header → **Product search** block  

---

## Do not paste

| Claim | Action |
|---|---|
| AI / semantic search / typo-tolerance engine | Not shipped |
| Vehicle Finder / Year-Make-Model / fitment | Removed |
| Product recommendations / FBT / trending | Removed |
| Unlimited products or filters | Use plan caps |
| Yearly billing | Disabled |
| Live chat / ticket support | Contact is Gmail only |
| Analytics as the card tagline | One feature line in details is enough |
