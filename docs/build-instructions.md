# Build Instructions — Smart Filter & Search (Shopify App MVP)

## 0. Project Summary

Shopify embedded app called Smart Filter & Search. Launch MVP = solid collection filters + storefront search + Theme App Extension. Analytics, AI/ML ranking, and advanced search extras are deferred (no stubs). Four parts:

1. An embedded admin app (merchant configures filters and settings)
2. A Theme App Extension — collection filter widget
3. A Theme App Extension — storefront search widget/block (launch scope; not implemented in code yet)
4. A backend sync system (keeps product/collection/metafield data current)

Target merchants: stores with 200–5,000+ products, especially fashion, beauty, home decor, and specialty goods with lots of variant attributes.

## 1. Tech Stack (do not substitute without asking)

- Framework: React Router 7 via Shopify's official template (`@shopify/shopify-app-react-router`)
- Admin UI: Shopify Polaris
- Storefront: Theme App Extension (Liquid + JS, NOT script tags)
- API: Shopify Admin GraphQL API only — no REST
- Database: PostgreSQL
- ORM: Prisma
- Queue/jobs: Redis + BullMQ
- Hosting target: Fly.io
- Billing: Shopify Billing API (`AppSubscriptionCreate` GraphQL mutation)

Do not introduce Next.js, Express, MongoDB, or REST Admin API calls anywhere in this project, even as a "quick" solution. If a package or pattern conflicts with this stack, stop and ask before proceeding.

## 2. Project Scaffolding — First Command

```
shopify app init --template=https://github.com/Shopify/shopify-app-template-react-router
```

Then:
- Add Prisma with a PostgreSQL provider (replace any default SQLite config)
- Add Redis + BullMQ as dependencies
- Set up `.env.example` listing every required environment variable (no real secrets committed)

## 3. Data Model

- **Shop** — shop domain, access token reference, install date, plan
- **FilterConfig** — per collection: which filter types are enabled (price, availability, vendor, product type, tags), display order
- **MetafieldMapping** — merchant-selected metafields that should become filters (namespace, key, display label, filter type: list/range/boolean)
- **SyncJob** — tracks sync status per shop (last full sync, last incremental sync, status, error log)
- **Subscription** — plan name, status, Shopify subscription ID, product/filter limits tied to plan

Generate Prisma models for these, with shop-scoped foreign keys throughout (multi-tenant app).

## 4. Core Backend Work

### 4.1 Auth & Session
Use the built-in token exchange / managed installation flow from the React Router template — do not hand-roll OAuth. Session storage must be Postgres-backed via Prisma session storage adapter.

### 4.2 Product/Collection/Metafield Sync
- Initial sync on install: use Admin API Bulk Operations (`bulkOperationRunQuery`), not paginated REST/GraphQL loops.
- Incremental sync: register webhooks for `products/update`, `products/delete`, `collections/update`, re-run sync for affected shop/collection only.
- Sync populates: product list, collection list, tags, vendors, product types, and metafields (store all metafields found, even before merchant selects which to use).
- Build as a BullMQ job (`sync-queue`), not inline in request/response cycle.

### 4.3 Mandatory Compliance Webhooks
Implement and register: `APP_UNINSTALLED`, `customers/redact`, `shop/redact`, `customers/data_request`. Required for App Store approval — do not skip or stub.

### 4.4 Billing
- Implement `AppSubscriptionCreate` mutation flow for plan selection
- Free plan: no subscription created, but still enforce plan limits in code
- Paid plan(s): trigger Shopify's subscription confirmation flow, store Subscription record on `app_subscriptions/update` webhook

## 5. Admin App Screens (Polaris, embedded)

1. Dashboard/home — list of collections with filter-config status
2. Collection filter config screen — toggle active filter types, set display order
3. Metafield mapping screen — list detected metafields, choose which become filters, assign labels and filter type
4. Billing/plan screen — current plan, usage against limits, upgrade CTA
5. Settings — general app settings (widget position, basic styling)

Use Polaris components throughout — do not build custom UI components that duplicate what Polaris already provides.

## 6. Theme App Extension (storefront widget)

- Scaffold via `shopify app generate extension` (Theme App Extension type)
- Filter panel reads active FilterConfig for the current collection, renders filter options, applies filters client-side or via URL query params (no indexable duplicate pages)
- After filters: storefront search widget/block (solid product search — not AI ranking; launch work, not yet in code)
- Must be async-loaded — no main thread blocking, no LCP delay
- Must be mobile-responsive — test at 375px width minimum
- Style scoped to the extension block — no leaking styles into merchant's theme

## 7. Build Order (follow this sequence, do not build everything at once)

1. Scaffold app + Prisma + Postgres connection
2. Auth/session working end-to-end (install on dev store, confirm session persists)
3. Data models + migrations
4. Bulk sync on install (verify against a dev store with 50+ products before moving on)
5. Incremental webhook sync
6. Admin: collection list + filter config screen
7. Admin: metafield mapping screen
8. Theme App Extension: static filter UI rendering (no logic yet)
9. Theme App Extension: wire filter logic to actual product filtering
10. Theme App Extension: storefront search widget/block (solid basic search)
11. Billing flow (free plan enforcement first, paid subscription flow second)
12. Mandatory compliance webhooks
13. Manual QA pass against a real dev store before considering v1 "done"

Do not skip ahead to step 8+ before steps 1–7 are verified working against a real Shopify dev store, not just compiling.

## 8. Explicit Non-Goals for This Build

- Search/filter analytics dashboard — deferred / no stubs
- Any AI/ML relevance ranking — deferred / no stubs
- Synonym groups, typo-tolerance engines, redirects/boosts beyond solid basic search — deferred / no stubs
- Custom theme editor / drag-drop widget styling beyond basic position settings

If code generation starts for any of the above, stop and redirect to the current step.
