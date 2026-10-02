# Partner listing copy

Paste-ready text for **Apps → Findly → Distribution → Manage listing**.

Match `app/routes/app.tsx` NavMenu. Paste only the copy in this file.

## NavMenu vs listing

| Nav item | Route | Listing? | Why |
|---|---|---|---|
| Home | `/app` | Yes | Onboarding, catalog sync popup, performance |
| Filters | `/app/filters` | Yes | Filter sets, color swatches, value groups |
| Search | `/app/search` | Yes | Search fields, pinnings, synonyms, redirects |
| Settings | `/app/settings` | Yes | Panel position, metafields |
| Translation | `/app/translation` | Yes | Widget label locales |
| Integrations | `/app/integrations` | Yes | Judge.me / wishlist / Weglot re-init after Ajax |
| Analytics | `/app/analytics` | Yes | Search and filter usage |
| Pricing plans | `/app/billing` | Yes (pricing fields) | Development / Standard / Pro |
| Contact | `/app/contact` | No | Listing support: `info@srhwebagency.com` |

Catalog sync is on **Home**. `/app/sync` redirects there; it is not a NavMenu item.

Per-collection filter config lives at `/app/collections*` (linked from Home and filter “applies to”). It is not a top-level NavMenu item.

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
Findly adds collection filters and storefront search via a theme app block. Enable sets under Filters. Map metafields and set left, right, or top placement in Settings. Search includes keyword product search, pins, synonyms, and redirects. Shoppers filter by price, availability, vendor, type, tags, options, and metafields. Translation edits widget labels. Integrations keep review and wishlist widgets in sync. Analytics shows search and filter usage. Plans: Development, Standard, and Pro.
```

### Feature list (≤80 each)

1. Filter collections by price, availability, vendor, type, tags, and options.
2. Map product metafields to filters and choose which collections they apply to.
3. Add collection filters on Online Store 2.0 themes with a theme app block.
4. Let shoppers search products with the Product search theme block.
5. Pin products, map synonyms, and redirect searches from the Search pages.
6. Set color swatches, grouped values, and left, right, or top filter placement.
7. Translate widget labels. Review and wishlist apps stay in sync after filters.
8. See filter and search analytics: top queries, no-results, and popular filters.

### How it works

1. Install Findly. Catalog sync starts; open Home → View details to check status or run a full sync.
2. On Filters, enable a filter set. Choose price, availability, vendor, type, tags, options, and metafields.
3. In the theme editor, add **Collection filters** on collection templates. Add **Product search** for storefront search.
4. Optional: Settings for panel look, Search for pins / synonyms / redirects, Translation for labels.

### Search terms (5)

1. product filters
2. collection filters
3. storefront search
4. product search
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
https://findly.srhwebagency.com/privacy
```

**Terms of service URL**

```
https://findly.srhwebagency.com/terms
```

**Support email** (listing contact only — must not contain “Shopify”)

```
info@srhwebagency.com
```

### Pricing (must match Billing API)

Primary method: **Recurring charge**, with one plan marked **Free** (display name **Development**). Monthly billing: Development / Standard / Pro. **No trial.** Live shops start Standard at install.

| Plan | Price / 30 days | Trial | Products | Metafield filters |
|---|---|---|---|---|
| Development | $0.00 — no Shopify charge | None | Live: 0. Development stores: full catalog | Live: 0 |
| Standard | $11.99 USD | None | 200 | 6 |
| Pro | $19.99 USD | None | 1,000 | 15 |

**Development** — $0 for Shopify development / partner stores only. All features included. Not a live-store plan.

**Standard** — Live catalogs: up to 200 products and 6 metafield filters. Charge starts at install (no trial).

**Pro** — Up to 1,000 products and 15 metafield filters. No trial.

### Pricing details (listing form)

Paste on **Manage listing → Edit language → Pricing details**. Display name max **18** characters. Do **not** put product/metafield limits in the display name — Shopify already shows the price on the card. Match each block to the plan key (`free` / `standard` / `pro`), not to the order on the page (Pro and Standard can appear swapped).

**Optional pricing URL**

```
https://findly.srhwebagency.com/terms#billing
```

#### Plan: free

Display name:

```
Development
```

Top features (add one per line):

```
Collection filters via theme app block
Filter price, vendor, type, tags, options
Storefront product search block
Pin products, synonyms, and redirects
Color swatches and grouped values
Left, right, or top filter panel
All features on development stores
Not for live shops
```

#### Plan: standard ($11.99/month, no trial — 200 products / 6 metafields)

Display name:

```
Standard
```

Top features:

```
Collection filters via theme app block
Filter price, vendor, type, tags, options
Storefront product search block
Pin products, synonyms, and redirects
Color swatches and grouped values
Left, right, or top filter panel
Up to 200 synced products
6 metafield filters, 180-day analytics
```

#### Plan: pro ($19.99/month, no trial — 1,000 products / 15 metafields)

Display name:

```
Pro
```

Top features:

```
Collection filters via theme app block
Storefront product search block
Pin products, synonyms, and redirects
Per-collection metafield filter maps
Reviews and wishlists stay after Ajax
Translate storefront widget labels
Up to 1,000 synced products
15 metafield filters, 180-day analytics
```

---

## Listing media

| Asset | File | Spec |
|---|---|---|
| App icon | `docs/listing-assets/app-icon-1200.jpg` (or `.png`) | 1200×1200 |
| Screenshots | Capture from admin + storefront | 3–6 images, 1600×900 |
| Feature media | Strong storefront frame or short video | Listing card |

Suggested screenshots: Home, Filters, storefront collection filters, Product search, Search settings, Analytics.

---

## Demo store + reviewer notes

Demo collection:

```
https://findly-test-store.myshopify.com/collections/all
```

Admin: `https://admin.shopify.com/store/findly-test-store`

Put real storefront password, collaborator code, screencast URL, and emergency phone into Partner — never placeholder text.

Theme steps for reviewers:

1. Collection template → add **Collection filters** (preferred). App embeds → **Collection filters (app embed)** is the fallback; it loads assets only on collection/search pages.  
2. Search template / header → **Product search** block
