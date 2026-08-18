# Findly: Smart Filters & Search

Shopify embedded app for **collection filters + storefront search** via Theme App Extension (launch MVP). AI, analytics, and advanced extras come later. Built on Shopify’s official React Router 7 template.

**Full architecture, flows, and setup checklist:** [docs/APP-FLOW-AND-SETUP.md](docs/APP-FLOW-AND-SETUP.md)  
**vs Globo Smart Product Filter & Search:** [docs/COMPETITIVE-COMPARISON.md](docs/COMPETITIVE-COMPARISON.md)

## Stack

- React Router 7 + `@shopify/shopify-app-react-router`
- Polaris web components (admin)
- Theme App Extension (storefront widget)
- Admin GraphQL only
- PostgreSQL + Prisma
- Redis + BullMQ (`sync-queue` worker)
- Fly.io (`web` + `worker`)
- Shopify Billing API (`appSubscriptionCreate`) — Free + Pro

## Quick start

1. Copy `.env` from a teammate (or create it) and fill Shopify credentials.
   Use local Postgres/Redis URLs:
   `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/smart_filter?schema=public`
   `REDIS_URL=redis://localhost:6379`
2. `npm install`
3. `npm run dev` — starts Postgres, Redis, the sync worker, and the Shopify app (no Docker)

To share **this machine's** Postgres with a teammate over Cloudflare (host only): keep `npm run dev` running, create a **new** Cloudflare Tunnel + subdomain (TCP → `tcp://localhost:5432`, do not change `hunaniinfotech.com` root DNS), install `cloudflared` as a Windows service, then `npm run share:db`. The teammate runs `npm run share:db:connect` and uses the printed localhost `DATABASE_URL`. They keep `REDIS_URL=redis://localhost:6379`. Never commit a tunnel token.

Optional: `docker compose up -d` if you prefer Docker. Split terminals: `npm run dev:shopify` and `npm run worker`.

## Fly.io

```bash
fly launch   # or use existing fly.toml
fly secrets set SHOPIFY_API_SECRET=... DATABASE_URL=... BILLING_TEST_MODE=true
fly deploy
```

## App proxy

Storefront calls `/apps/smart-filter/filters?collection_id=...` (configured in `shopify.app.toml`).
