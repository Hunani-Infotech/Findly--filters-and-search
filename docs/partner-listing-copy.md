# Partner listing copy (AS-H6 / AS-L4)

Paste-ready text for **Apps → Findly → Distribution → Manage listing**. No prior draft existed in the repo; this is the source of truth.

Cross-checked on 25 Aug 2026 against `app/routes/app.tsx` NavMenu and the pages those links open. Do not invent extras in the Partner form.

## NavMenu vs listing (current)

Enabled in `NavMenu` right now:

| Nav item | Route | Listing? | Why |
|---|---|---|---|
| Home | `/app` | Yes | Onboarding, catalog sync popup, performance |
| Filters | `/app/filters` | Yes | Filter sets, color swatches, value groups |
| Search | `/app/search` | Yes | Search fields, instant widget, pinnings, synonyms, redirects |
| Settings | `/app/settings` | Yes | Panel position, metafields — not under construction |
| Translation | `/app/translation` | Yes | Widget label locales |
| Integrations | `/app/integrations` | Yes | Judge.me / wishlist / Weglot re-init after Ajax |
| Analytics | `/app/analytics` | **Yes, one feature line only** | Real dashboard (not Under construction) **and** visible in nav |
| Pricing plans | `/app/billing` | Yes (pricing fields) | Free / Standard / Pro in `billing.server.ts` |
| Contact | `/app/contact` | No | In-app form emails Gmail (AS-H4). Use the same address in listing support (AS-L8). |

Catalog sync is on **Home** (card + View details popup). `/app/sync` still redirects there for old links; it is not a NavMenu item.

**Not in NavMenu** (routes exist as Under construction — do **not** advertise):

- Vehicle Finder / YMM — `/app/vehicle-finder` → `UnderConstructionGate`
- Recommendations — `/app/recommendations` → `UnderConstructionGate`

Theme editor still lists **Vehicle finder** and **Product recommendations** blocks. Listing copy must not mention them. Do not tell merchants to add those blocks.

---

## Paste into Partner Dashboard

Character counts are for the official limits: name 30, introduction 100, details 500, each feature 80.

### App name (≤30)

```
Findly: Smart Filters & Search
```

30 characters. TOML `name` is `Findly Smart Filters` — same brand, shorter, which Shopify allows.

### App card subtitle / tagline

```
Help shoppers find products faster with collection filters and storefront search
```

80 characters. No AI, analytics headline, YMM, or recommendations.

### App introduction (≤100)

```
Shoppers filter collections and search products in your theme. Add the widget as a theme app block.
```

99 characters.

### App details (≤500)

```
Findly adds collection filters and storefront search via a theme app block. Enable sets under Filters. Map metafields and set left, right, or top placement in Settings. Search includes keyword search, instant suggestions, pins, synonyms, and redirects. Shoppers filter by price, availability, vendor, type, tags, options, and metafields. Translation edits widget labels. Integrations keep review and wishlist widgets in sync. Analytics shows search and filter usage. Plans: Free, Standard, and Pro.
```

498 characters.

### Feature list (≤80 each)

1. Filter collections by price, availability, vendor, type, tags, and options.
2. Map product metafields to filters and choose which collections they apply to.
3. Add collection filters on Online Store 2.0 themes with a theme app block.
4. Let shoppers search products with a search block and instant suggestions.
5. Pin products, map synonyms, and redirect searches from the Search pages.
6. Set color swatches, grouped values, and left, right, or top filter placement.
7. Translate widget labels. Review and wishlist apps stay in sync after filters.
8. See filter and search analytics: top queries, no-results, and popular filters.

Feature 8 is allowed only because Analytics is a finished page **and** it is in NavMenu. If you later hide Analytics from the nav, delete feature 8 and the analytics sentence in App details before resubmitting.

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

Only apps Findly actually re-inits after Ajax (`app/partner-integrations.ts`). Do not list Shopify itself.

1. Judge.me
2. Wishlist Hero
3. Froonze wishlist
4. Swym Wishlist Plus
5. Weglot

### Pricing (must match Billing API)

Primary method: **Recurring charge**, with one plan marked **Free**. Monthly only. Do not enter yearly prices.

| Plan | Price / 30 days | Trial | Products | Metafield filters |
|---|---|---|---|---|
| Free | $0.00 — no Shopify charge | — | 200 | 5 |
| Standard | $9.99 USD | 7 days | 1,000 | 12 |
| Pro | $19.99 USD | 7 days | 5,000 | 25 |

Plan feature bullets (same idea as `/app/billing`):

**Free**
- Collection filters (price, availability, vendor, type, tags)
- Storefront search via Theme App Extension
- Theme App Extension widget (left, right, or top)
- Metafield filters up to 5 mappings
- Up to 200 products

**Standard**
- Everything in Free
- Up to 1,000 products and 12 metafield filters
- 7-day trial, then billed every 30 days

**Pro**
- Everything in Standard
- Up to 5,000 products and 25 metafield filters
- 7-day trial, then billed every 30 days

Do not claim a 30-day money-back guarantee (in-app billing copy says Findly does not offer one).

---

## Flagged — do not paste

| Claim | Status | Action |
|---|---|---|
| Analytics / insights / dashboards as the **tagline** | Dashboard exists and is in nav | Keep it off the card subtitle. One feature line + one details sentence is enough. |
| Year / Make / Model, Vehicle Finder, fitment search | Admin is Under construction; **not in nav** | Removed. Never add. |
| Product recommendations, FBT, trending, recently viewed | Admin is Under construction; **not in nav** | Removed. Never add. |
| AI / semantic search / typo-tolerance engine | Not shipped | Removed. Search is keyword + instant suggestions + pins / synonyms / redirects. |
| Unlimited products or filters | Caps in `PLANS` | Removed. Use the table above. |
| Yearly billing | Disabled on `/app/billing` | Removed (AS-B9). |
| In-app live support / ticket send | Contact emails Gmail (AS-H4) | Do not claim live chat. Put the same Gmail in the listing contact field (AS-L8). |

## Still human after paste

- AS-L4 is done for **copy**. Someone still has to paste this into the Partner listing form.
- AS-L5: enter the same three prices. Do not type “draft”.
- Do not add Vehicle finder or Product recommendations to screenshots or the screencast.
