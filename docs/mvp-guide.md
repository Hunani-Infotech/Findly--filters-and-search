# Smart Filter & Search — MVP Build Guide

## 1. Scope Decision: Filters + Search Launch, Advanced Later

Launch MVP = collection filters + storefront search + Theme App Extension.

- Filter by price, availability, vendor, product type, tags
- Filter by metafields (color, size, material, etc.)
- Per-collection configuration in the admin dashboard
- Mobile-responsive storefront filter widget
- Solid storefront product search via Theme App Extension (not AI ranking; not in code yet)

Later (post-launch): AI/ML ranking, analytics dashboards, and advanced search extras (synonym engines, typo-tolerance engines beyond basic search, redirects/boosts). Deferred / no stubs — those features were never in the codebase.

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
| Queue/sync | Redis + BullMQ | Product/metafield sync jobs, no rate-limit surprises |
| Billing | Shopify Billing API (`AppSubscriptionCreate`) | Wire early, even for the free tier |
| Hosting | Fly.io or Railway | Known-good Shopify app deploy paths |
| Mandatory webhooks | `APP_UNINSTALLED`, `customers/redact`, `shop/redact`, `customers/data_request` | Required for App Store approval, not optional |

## 3. Path to First Submission

1. Scaffold the app with Shopify CLI, connect to a Partner account + dev store
2. Build the metafield-mapping step — merchant chooses which metafields become filters (don't auto-detect)
3. Build the filter config UI in the embedded admin (per-collection, Polaris components)
4. Build the Theme App Extension — storefront filter widget, async-loaded
5. Add storefront search via Theme App Extension (solid basic search)
6. Wire product/collection sync — Bulk Operations API for initial full sync, webhooks for incremental updates
7. Wire Billing API — even for a free tier, get the subscription flow working early
8. Add mandatory GDPR webhooks
9. Internal QA, then a small beta with 3–5 real stores before submission
10. Submit for App Store review

## 4. Plan structure

**Free plan:**
- Standard collection filters (price, availability, tags, vendor, product type)
- Basic metafield filtering (limited number of metafields)
- Solid storefront search (Theme App Extension)
- Mobile-responsive widget
- Capped product count (e.g. up to 200–500 products)

**Paid plans:**
- Unlimited/expanded metafield filters
- Higher product caps
- Priority sync frequency
- AI ranking and analytics — later (not sold on Pro at launch)

## 5. Summary

- Buildable — launch risk is filters + solid search + Theme Extension, not an AI suite
- Tech decision locked: React Router 7 official template, not Next.js/Express
- MVP = filters + search + Theme App Extension
- AI + analytics + advanced search extras = post-launch; deferred / no stubs
