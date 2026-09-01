# Partner listing copy (AS-H6 / AS-L4)

Paste-ready text for **Apps → Findly → Distribution → Manage listing**. No prior draft existed in the repo; this is the source of truth.

Cross-checked 31 Aug 2026 against `app/routes/app.tsx` NavMenu. Vehicle Finder and Recommendations have been removed from the codebase. Do not invent extras in the Partner form.

## NavMenu vs listing (current)

Enabled in `NavMenu` right now:

| Nav item | Route | Listing? | Why |
|---|---|---|---|
| Home | `/app` | Yes | Onboarding, catalog sync popup, performance |
| Filters | `/app/filters` | Yes | Filter sets, color swatches, value groups |
| Collections | `/app/collections` | Yes | Synced catalog list → per-collection filter config; shop defaults |
| Search | `/app/search` | Yes | Search fields, instant widget, pinnings, synonyms, redirects |
| Settings | `/app/settings` | Yes | Panel position, metafields — not under construction |
| Translation | `/app/translation` | Yes | Widget label locales |
| Integrations | `/app/integrations` | Yes | Judge.me / wishlist / Weglot re-init after Ajax |
| Analytics | `/app/analytics` | **Yes, one feature line only** | Real dashboard (not Under construction) **and** visible in nav |
| Pricing plans | `/app/billing` | Yes (pricing fields) | Free / Standard / Pro in `billing.server.ts` |
| Contact | `/app/contact` | No | In-app form emails Gmail (AS-H4). Use the same address in listing support (AS-L8). |

Catalog sync is on **Home** (card + View details popup). `/app/sync` still redirects there for old links; it is not a NavMenu item.

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

80 characters. No AI, analytics headline.

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

Only apps Findly actually re-inits after Ajax (`app/utils/partner-integrations.ts`). Do not list Shopify itself.

1. Judge.me
2. Wishlist Hero
3. Froonze wishlist
4. Swym Wishlist Plus
5. Weglot

### Resources (AS-C1 / AS-C2)

Paste these into the listing **Resources** fields. Both pages are live on the Hostinger host (verified HTTPS).

**Privacy policy URL (required)**

```
https://deeppink-manatee-141983.hostingersite.com/privacy
```

**Terms of service URL**

```
https://deeppink-manatee-141983.hostingersite.com/terms
```

**Support email (AS-L8)** — Partner Dashboard contact field only. Do not add it to the listing body copy.

```
sohilhunani11@gmail.com
```

Do not use localhost, Google Docs, or a marketing homepage.

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

## Listing media (AS-L1–L3)

### App icon (AS-L1) — ready to upload

Upload in Partner Dashboard → Distribution → Manage listing → App icon.

| File | Size | Notes |
|---|---|---|
| `docs/listing-assets/app-icon-1200.jpg` | **1200×1200** JPEG | Prefer this for Partner upload (~145 KB) |
| `docs/listing-assets/app-icon-1200.png` | **1200×1200** PNG | Same art if the form prefers PNG |

Green funnel icon on a rounded light tile / darker green field. Matches Findly filters branding. Do not stretch or crop.

### Screenshots (AS-L2) — later

Add **3–6** images at **1600×900** of the real admin and storefront. Suggested set when you capture them:

1. Home (SetupGuide + catalog sync)
2. Filters (enabled filter set)
3. Storefront collection with Findly filter panel
4. Instant search in the header
5. Search settings or Analytics (optional 5th/6th)

Drop files into `docs/listing-assets/screenshots/` when ready, then upload in Partner.

### Feature media (AS-L3) — later

One promotional image or short video for the listing card. Prefer a clean storefront filter/search frame, not a long tutorial. Can reuse a strong 1600×900 screenshot until a dedicated feature image exists.

---

## Reviewer + contact (AS-L6–L9)

Paste into **Distribution → Manage listing** (demo store, testing instructions, contact) and the **App Store review** configuration page (emergency contact). Findly has no separate login — Shopify OAuth is enough. Do not invent a third-party API key.

Replace every `FILL:` line from the live demo store before you submit. Do not paste the word `FILL`.

### Demo store (AS-L6)

```
https://findly-test-store.myshopify.com/collections/all
```

Admin (collaborator): `https://admin.shopify.com/store/findly-test-store`

The storefront is password-protected. Instant search should already be on. If `/collections/all` is empty, pick the collection that shows filters and paste that URL instead.

### Support email (AS-L8)

Listing contact / App submission email. Must not contain “Shopify”. Same inbox as in-app Contact (`FINDLY_SUPPORT_EMAIL`).

```
sohilhunani11@gmail.com
```

Also add `noreply@shopify.com` to this inbox’s allowlist (AS-S2) so review mail is not spam-foldered.

### Emergency developer (AS-L9)

Review configuration page — not the public listing body.

```
Name: Hunani Infotech
Email: sohilhunani11@gmail.com
Phone: FILL: (country code + number that is answered during review)
```

### Testing instructions (AS-L7)

Paste the block below into **Testing instructions**. Fill the three `FILL:` lines first.

```
Demo store: https://findly-test-store.myshopify.com
Collection with filters: https://findly-test-store.myshopify.com/collections/all
Storefront password: FILL: Online Store → Preferences → Password
Collaborator request code: FILL: Settings → Users → Security (4-digit code). Please request Collaborator access with Apps + Online Store → Themes. We will approve promptly.
Screencast: FILL: 60–120s English Loom/YouTube showing install → Collection filters on a collection → Instant search in the header

Findly does not use a separate username/password. After install, the embedded admin is enough.

What to add in the theme editor (only these three — AS-H8):
1. Theme editor → App embeds → turn ON “Collection filters”. Save.
2. Theme editor → App embeds → turn ON “Instant search”. Save.
3. Theme editor → search template (or header) → Add block → “Product search”. Save.
Do not add the Collection filters section block if the Collection filters app embed is already on (that duplicates the widget). There is no Vehicle Finder or Recommendations block.

How to verify:
1. Apps → Findly → Home. Catalog sync should be ready. Filters → confirm a filter set is enabled (price, availability, vendor, type, tags).
2. Open the collection URL above. Use the Findly filter panel (price / vendor / chips). On mobile, open the filter drawer.
3. Type in the theme header search. Instant suggestions should appear (Instant search embed).
4. Open the storefront search page. Product search should return products; a garbage query shows “No products found”.
5. Optional admin: Search (pins / synonyms / redirects), Settings (left / right / top), Translation, Analytics, Pricing plans.

Billing on this development store:
- Free $0 (no Shopify charge)
- Standard $9.99 USD / 30 days, 7-day trial
- Pro $19.99 USD / 30 days, 7-day trial
No yearly plan. Do not require a 30-day money-back guarantee.

Privacy: https://deeppink-manatee-141983.hostingersite.com/privacy
Terms: https://deeppink-manatee-141983.hostingersite.com/terms
Support: sohilhunani11@gmail.com
```

### Screencast checklist (AS-L7)

Record 60–120 seconds, English or English subtitles. Upload to Loom or unlisted YouTube and paste the URL into the listing screencast field (and into the `FILL:` line above).

1. Install / open Findly Home (catalog sync).
2. Filters: a set enabled.
3. Theme editor: the three enables above.
4. Storefront collection: click a filter; grid updates.
5. Header: type a product name; instant results.
6. Stop. Do not tour Settings first.

---

## Flagged — do not paste

| Claim | Status | Action |
|---|---|---|
| Analytics / insights / dashboards as the **tagline** | Dashboard exists and is in nav | Keep it off the card subtitle. One feature line + one details sentence is enough. |
| Year / Make / Model, Vehicle Finder, fitment search | Not in scope | Removed. Never add. |
| Product recommendations, FBT, trending, recently viewed | Not in scope | Removed. Never add. |
| AI / semantic search / typo-tolerance engine | Not shipped | Removed. Search is keyword + instant suggestions + pins / synonyms / redirects. |
| Unlimited products or filters | Caps in `PLANS` | Removed. Use the table above. |
| Yearly billing | Disabled on `/app/billing` | Removed (AS-B9). |
| In-app live support / ticket send | Contact emails Gmail (AS-H4) | Do not claim live chat. Put the same Gmail in the listing contact field (AS-L8). |

## Still human after paste

- AS-L1 icon files are in `docs/listing-assets/` — upload `app-icon-1200.jpg` (or `.png`) in Partner. AS-L2 screenshots and AS-L3 feature media are still later.
- AS-L4 copy, AS-L5 prices, L6 demo URL, L7 testing notes, L8 support email, and privacy/terms URLs are written above. Paste them into **Apps → Findly → Distribution → Manage listing**.
- Pricing: Recurring charge, monthly only. Free $0.00 / Standard $9.99 / Pro $19.99. Do not type “draft”. Do not add yearly.
- Resources: privacy `https://deeppink-manatee-141983.hostingersite.com/privacy` and terms `https://deeppink-manatee-141983.hostingersite.com/terms`.
- Before submit, replace every `FILL:` in AS-L7 / AS-L9: storefront password, 4-digit collaborator code, screencast URL, emergency phone.
- AS-L9 emergency contact is on the review configuration page, not the public listing.
- App version `findly-smart-filters-8` deployed 31 Aug 2026 with Vehicle Finder and Recommendations removed.

