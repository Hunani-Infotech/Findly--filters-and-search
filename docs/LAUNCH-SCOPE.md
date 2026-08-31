# Findly launch scope

What Findly ships at launch, what we defer, and how we talk about the product. Use this for planning and App Store positioning.

---

## Positioning summary

Findly is a Shopify embedded app for **collection filters + storefront search** via Theme App Extension. Merchants also get search extras (pins / synonyms / redirects), a usage analytics dashboard, translation, and integrations — on **Free / Standard / Pro** caps. Do **not** pitch AI ranking as finished.

| | **Findly: Smart Filters & Search** |
|---|---|
| Core pitch | **Filters + storefront search** via Theme App Extension |
| Launch focus | Filters + search (+ extras) + analytics + Theme App Extension |
| Search | Keyword + Instant search; pins / synonyms / redirects (not AI) |
| Analytics | In app (`/app/analytics`) — filter + search usage |
| Widget install | Theme App Extension (async, scoped CSS) |
| Pricing | Free → Standard ($9.99) → Pro ($19.99) |

**Launch win theme:** collection-level filters, metafield mapping, reliable sync, solid storefront search, and clear plan caps — without an AI search suite.

---

## Feature coverage

Legend: **Yes** = shipped in repo for launch · **Partial** = limited · **No (later)** = not for submit copy · **No** = not planned near term

### A. Collection / product filters

| Capability | Findly launch | Notes |
|---|---|---|
| Filter by price | **Yes** | Range facet |
| Filter by availability | **Yes** | In stock / out of stock |
| Filter by vendor | **Yes** | |
| Filter by product type | **Yes** | |
| Filter by tags | **Yes** | Toggle per collection |
| Filter by variant options (size, color, etc.) | **Partial** | Via product options in index when present; not a full “filter tree builder” |
| Filter by metafields | **Yes** | Merchant maps discovered metafields → list / range / boolean |
| Per-collection filter config | **Yes** | Admin collection screen + display order |
| Unlimited filter menus / filter tree builder | **No** | Basic toggles + order only |
| Sidebar / top / left–right placement | **Yes** | Block + app settings (`left` \| `right` \| `top`) |
| Mobile-responsive filters | **Yes** | Scoped CSS, 375px+ |
| Separate variants as products on collection | **No** | Out of scope |
| Year / Make / Model style filters | **No** | Not in scope |
| Infinite scroll browsing | **No** | Theme concern |
| Multi-language filter UI | **Yes** | Translation admin for widget labels |
| Custom CSS / deep theme styling | **No** | Basic accent + position only (non-goal: drag-drop theme editor) |
| SEO-safe filtering (no crawlable filter URLs) | **Yes** | Client-side + `#sf=` hash via `replaceState` |

### B. Search & discovery

| Capability | Findly launch | Notes |
|---|---|---|
| Storefront search | **Yes** | Product search block + proxy |
| Autocomplete / instant suggestions | **Yes** | Instant search app embed |
| AI / semantic search | **No (later)** | Do not advertise |
| Typo tolerance engine | **No (later)** | Beyond keyword + synonyms |
| Synonym groups | **Yes** | `/app/search/synonyms` |
| Search redirects / pinnings | **Yes** | `/app/search/redirects`, `/app/search/pinnings` |

| Replace theme search bar | **No** | Theme block / embed approach |

### C. Analytics & merchandising

| Capability | Findly launch | Notes |
|---|---|---|
| Filter usage analytics | **Yes** | `/app/analytics` |
| Search query analytics | **Yes** | Top queries, no-results, etc. |
| Custom dashboards / 90–180 day reports | **Partial** | Current dashboard only |
| Merchandising / spell check / ranking rules | **No** | |

### D. Platform / ops

| Capability | Findly launch | Notes |
|---|---|---|
| Theme App Extension (not script tags) | **Yes** | |
| Admin GraphQL sync (bulk + webhooks) | **Yes** | Postgres queue; live sync proof still open |
| Shopify Billing API | **Yes** | Free + Standard + Pro |
| Mandatory compliance webhooks | **Yes** | Uninstall + GDPR topics |
| Plan product / metafield caps | **Yes** | Free 200 / 5 · Standard 1000 / 12 · Pro 5000 / 25 |
| Translation + Integrations | **Yes** | NavMenu pages |

---

## Pricing (current product code)

| Plan | Price | Limits (current) | Includes at launch |
|---|---|---|---|
| **Free** | $0 | 200 products · 5 metafield filters | Filters, search (+ extras), analytics, translation, integrations, sync, Theme Extension |
| **Standard** | **$9.99 / 30 days** · 7-day trial | 1,000 products · 12 metafield filters | Same product, higher caps |
| **Pro** | **$19.99 / 30 days** · 7-day trial | 5,000 products · 25 metafield filters | Same product, highest caps |

Search extras and analytics are on **every** plan (not Pro-gated). Caps differentiate plans.

---

## What Findly covers at launch (checklist)

Use this as the “in scope” product promise:

- [x] Collection filter widget (Theme App Extension)
- [x] Price, availability, vendor, product type, tags
- [x] Metafield filters via merchant mapping UI
- [x] Per-collection enable/order configuration
- [x] Catalog sync (bulk on install + product/collection webhooks)
- [x] Free + Standard + Pro plan limits via Shopify Billing
- [x] Async-loaded, mobile-friendly widget; no crawlable filter URLs
- [x] Basic styling: position, accent, show counts, collapse
- [x] Storefront search (Product search + Instant search)
- [x] Search extras: pinnings, synonyms, redirects
- [x] Analytics dashboard
- [x] Translation + Integrations admin

Live Hostinger health and storefront QA are still required before submit — see `docs/app-store-approval-jobs.html`.

---

## What we intentionally do not sell as finished

Do not implement-as-finished or advertise during listing review:

1. AI-powered / semantic search
2. Dedicated typo-tolerance engines beyond keyword + synonyms
3. Filter tree builder / unlimited visual menu designer
4. Variants-as-products, Year-Make-Model
5. Deep custom CSS / drag-drop theme editor

See also: [build-order.md](./build-order.md) and [partner-listing.md](./partner-listing.md).

---

## Suggested App Store / marketing angle

**Headline direction:**  
“Fast collection filters and solid storefront search — metafields, instant suggestions, and clear plan caps.”

**Differentiators to emphasize:**
- Per-collection control without Shopify Search & Discovery’s filter-count ceiling
- Merchant-owned metafield mapping from synced catalog data
- Lightweight Theme App Extension (performance-friendly)
- Clear Free → Standard → Pro path based on **product / metafield caps**

**Product line:**  
Findly launch is **filters + search (+ extras) + analytics** via Theme App Extension — not an AI ranking suite.

---

## Related docs

| Doc | Use |
|-----|-----|
| [app-flow-and-setup.md](./app-flow-and-setup.md) | Architecture + setup |
| [mvp-guide.md](./mvp-guide.md) | MVP build guide |
| [build-order.md](./build-order.md) | Verification sequence |
| [partner-listing.md](./partner-listing.md) | Partner listing paste text |
| [app-store-approval-jobs.html](./app-store-approval-jobs.html) | Submit job board |
