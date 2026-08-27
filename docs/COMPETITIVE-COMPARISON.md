# Findly vs Smart Product Filter & Search (Globo)

Reference listing: [Smart Product Filter & Search on the Shopify App Store](https://apps.shopify.com/product-filter-and-search) (Globo.io).

This doc maps **what that app markets** against **what Findly covers at launch** and what we explicitly defer. Use it for product planning and App Store positioning — not as a claim that Findly matches Globo feature-for-feature.

---

## Positioning summary

| | [Globo — Smart Product Filter & Search](https://apps.shopify.com/product-filter-and-search) | **Findly: Smart Filters & Search** |
|---|---|---|
| Core pitch | AI search + smart filters + analytics + merchandising | **Filters + solid storefront search** via Theme App Extension (no AI suite) |
| Launch focus | Filters + search + AI + analytics in one product | **Filters + search + Theme App Extension** |
| Search | AI semantic, autocomplete, synonyms, typo tolerance | **Solid basic search** (launch / to build; not AI) |
| Analytics | Filter/search behavior dashboards | **Not at launch** (later; deferred / no stubs) |
| Widget install | Theme integration / customization-heavy | Theme App Extension (async, scoped CSS) |
| Typical entry price | Free (dev) → ~$14–$29/mo by product tier | Free (200 products / 5 metafield filters) → Pro $19.99/mo |

**Findly launch win theme:** collection-level filters, metafield mapping, reliable sync, and solid storefront search — without the Globo “AI search + analytics suite” surface area.

---

## Feature coverage matrix

Legend: **Yes** = in Findly launch · **Partial** = limited vs Globo · **No (later)** = planned later · **No** = not planned for near term

### A. Collection / product filters

| Capability (Globo markets) | Findly launch | Notes |
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
| Year / Make / Model style filters | **No** | Out of scope (vertical-specific) |
| Infinite scroll browsing | **No** | Theme concern |
| Multi-language filter UI | **No (later)** | Labels are merchant-defined strings today |
| Custom CSS / deep theme styling | **No** | Basic accent + position only (non-goal: drag-drop theme editor) |
| SEO-safe filtering (no crawlable filter URLs) | **Yes** | Client-side + `#sf=` hash via `replaceState` |

### B. Search & discovery

| Capability | Findly launch | Notes |
|---|---|---|
| Storefront search | **Yes** (launch / to build) | In scope; not implemented in code yet |
| Autocomplete / instant suggestions | **Partial** | Basic only if shipped with search; not a synonym/AI engine |
| AI / semantic search | **No (later)** | Deferred / no stubs |
| Typo tolerance | **No (later)** | Beyond solid basic search — deferred |
| Synonym groups | **No (later)** | Deferred / no stubs |
| Search redirects / boosts | **No** | |
| Product recommendations | **No** | |
| Replace theme search bar | **No** | Theme block approach |

### C. Analytics & merchandising

| Capability | Findly launch | Notes |
|---|---|---|
| Filter usage analytics | **No (later)** | Deferred / no stubs |
| Search query analytics | **No (later)** | Deferred / no stubs |
| Custom dashboards / 90–180 day reports | **No (later)** | Deferred / no stubs |
| Merchandising / spell check / ranking rules | **No** | |

### D. Platform / ops (Findly built-in)

| Capability | Findly launch | Notes |
|---|---|---|
| Theme App Extension (not script tags) | **Yes** | |
| Admin GraphQL sync (bulk + webhooks) | **Yes** | BullMQ `sync-queue` |
| Shopify Billing API | **Yes** | Free + Pro (`AppSubscriptionCreate`) |
| Mandatory compliance webhooks | **Yes** | Uninstall + GDPR topics |
| Plan product / metafield caps | **Yes** | Free 200 / 5 · Pro 5000 / 25 |

---

## Pricing shape (indicative)

### Globo (from App Store listing)

| Plan | Price (approx.) | Highlights from listing |
|---|---|---|
| Development Free | $0 | Full features on partner/dev/trial stores |
| Basic | From **$14/mo** (≤500 products) | Filters + smart search + analytics window |
| Basic | From **$19/mo** (≤1000 products) | Same family, higher product tier |
| Pro | From **$29/mo** (≤500 products) | AI search, more metafields, longer analytics |

Shopify Plus tiers on that listing start higher. Always confirm live pricing on the [App Store page](https://apps.shopify.com/product-filter-and-search).

### Findly (current product code)

| Plan | Price | Limits (current) | Includes at launch |
|---|---|---|---|
| **Free** | $0 | 200 products · 5 metafield filters | Collection filters, solid search (to build), sync, Theme Extension, basic widget settings |
| **Pro** | **$19.99 / 30 days** · 7-day trial | 5000 products · 25 metafield filters | Same filters + search product, higher caps |

Search is **in launch** (not Pro-gated). Analytics / AI are **not** on Pro yet — later candidates (deferred / no stubs).

---

## What Findly covers at launch (checklist)

Use this as the “in scope” product promise:

- [x] Collection filter widget (Theme App Extension)
- [x] Price, availability, vendor, product type, tags
- [x] Metafield filters via merchant mapping UI
- [x] Per-collection enable/order configuration
- [x] Catalog sync (bulk on install + product/collection webhooks)
- [x] Free + paid plan limits via Shopify Billing
- [x] Async-loaded, mobile-friendly widget; no crawlable filter URLs
- [x] Basic styling: position, accent, show counts, collapse
- [ ] Storefront search (Theme App Extension) — launch scope, not shipped yet

---

## What we intentionally do **not** match from Globo (launch)

Do not implement these to “catch up” during the current build:

1. AI-powered / semantic search  
2. Synonym engines / typo-tolerance engines beyond solid basic search  
3. Analytics dashboards (filter or search)  
4. Filter tree builder / unlimited visual menu designer  
5. Variants-as-products, Year-Make-Model, recommendation engines  
6. Deep custom CSS / drag-drop theme editor  

Basic storefront search **is** in launch scope — do not treat it as a non-goal.

See also: [build-order.md](./build-order.md) non-goals and `.cursor/rules/project-context.mdc`.

---

## Suggested App Store / marketing angle for Findly

**Headline direction:**  
“Fast collection filters and solid storefront search — metafields included, without an AI analytics suite.”

**Differentiators to emphasize:**
- Per-collection control without Shopify Search & Discovery’s filter-count ceiling (a common complaint in Globo reviews about native tools)
- Merchant-owned metafield mapping from synced catalog data
- Lightweight Theme App Extension (performance-friendly)
- Clear Free → Pro path based on **product / metafield caps**, not AI/analytics SKUs

**Honesty line:**  
Findly launch is **filters + solid search** via Theme App Extension — not an AI ranking or analytics suite. Merchants who need AI search + analytics dashboards today should evaluate Globo / Boost / Searchanise; Findly targets merchants who want reliable filtering and basic storefront search without that surface area.

---

## Related docs

| Doc | Use |
|-----|-----|
| [app-flow-and-setup.md](./app-flow-and-setup.md) | Architecture + setup |
| [mvp-guide.md](./mvp-guide.md) | Broader market notes |
| [build-order.md](./build-order.md) | Verification sequence |
| [Globo App Store listing](https://apps.shopify.com/product-filter-and-search) | Competitor source of truth for features/pricing |
