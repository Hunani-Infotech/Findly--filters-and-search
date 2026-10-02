# Smart Filter & Search — MVP Build Guide

## 1. Scope Decision: Filters + Search Launch

Launch product = collection filters + storefront search + Theme App Extension, plus the admin surfaces that support them.

**In repo today:**

- Filter by price, availability, vendor, product type, tags, options, and mapped metafields
- Per-collection / filter-set configuration in the admin dashboard
- Mobile-responsive storefront filter widget (Theme App Extension)
- Storefront Product search (not AI ranking)
- Search extras: pinnings, synonyms, redirects
- Analytics dashboard (filter + search usage)
- Translation (widget label locales) and Integrations (review / wishlist re-init after Ajax)
- Plans: Development (dev-only) / Standard / Pro

**Do not advertise as finished:** AI/ML semantic ranking, drag-drop theme editor.

## 2. Tech Stack: The Shopify-Native Recommendation

Build on Shopify's official stack, not a DIY Next.js/Express setup.

### Framework: React Router 7
Evolution of Remix (Shopify owns it), and what Shopify's own CLI scaffolds by default, and what Shopify builds its own Admin and Hydrogen on.

- Auth is solved, not built: `@shopify/shopify-app-react-router` provides token exchange, managed installation, and session handling out of the box.
- Webhooks self-register via `npm run deploy` from `shopify.app.toml`.
- It's the reference implementation App Store reviewers check against.
- Shopify CLI tooling (dev store, tunnel, hot reload) works with zero extra config.

Scaffold with:
```
shopify app init --template=https://github.com/Shopify/shopify-app-template-react-router
```

### Full recommended stack

| Layer | Choice | Why |
|---|---|---|
| Admin app framework | React Router 7 (Shopify CLI template) | Official; auth/session/billing pre-wired |
| Admin UI | Polaris | Required for App Store visual/UX approval |
| Storefront widget | Theme App Extension | Only supported storefront injection method now; async, no page-speed penalty |
| API layer | Admin GraphQL API (not REST) | Shopify is phasing out REST for new apps |
| Database | Postgres (Supabase) | Hosted pooler + direct URLs; better fit than Mongo for relational filter-config/metafield-mapping data |
| Queue/sync | Postgres `QueueJob` + poller | Product/metafield sync jobs. Hostinger: web process + separate `npm run worker:prod`. In-process poller when `START_WORKER` is not `0` (local/dev). |
| Billing | Shopify Billing API (`AppSubscriptionCreate`) | Free + Standard + Pro |
| Hosting | Hostinger Node | Current production. Postgres on Supabase (queue + catalog). No `fly.toml`; add one later only if Fly.io is chosen again. |
| Mandatory webhooks | `APP_UNINSTALLED`, `customers/redact`, `shop/redact`, `customers/data_request` | Required for App Store approval, not optional |

## 3. Path to App Store submit

1. Scaffold the app with Shopify CLI, connect to a Partner account + dev store — **done**
2. Metafield mapping, filter admin, Theme App Extension filters — **done in repo**
3. Storefront search + search extras — **done in repo**
4. Catalog sync (bulk + webhooks) — **done in repo**; live proof: AS-Q1 / AS-Q2
5. Billing API — Free / Standard / Pro — **done in repo**; live charges: AS-B5–B7
6. Mandatory GDPR webhooks — **done in repo**; live delivery: AS-C6
7. Fix production `/health` (Postgres on Hostinger) + `shopify app deploy` — **done**
8. Live QA on a development store (filters, search, billing)
9. Partner listing assets + reviewer notes
10. Submit for App Store review

## 4. Plan structure

| Plan | Price | Caps | Includes |
|---|---|---|---|
| **Development** | $0 | Live: 0 products. Development stores: full catalog | All features, development stores only |
| **Standard** | $11.99 / 30 days · no trial | 200 products · 6 metafield filters | Live plan (previous Free caps), billed from install |
| **Pro** | $19.99 / 30 days · no trial | 1,000 products · 15 metafield filters | Previous Standard caps |

Search extras and analytics are **not** separate SKUs — they ship on every plan. Caps differentiate plans.

## 5. Summary

- Tech decision locked: React Router 7 official template, not Next.js/Express
- Product = filters + search (+ extras) + analytics + Theme App Extension
- Plans = Development (dev stores only) / Standard / Pro
- Remaining risk is **live Hostinger + storefront QA**, not re-building search from scratch
