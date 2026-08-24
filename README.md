# Findly: Smart Filters & Search

Shopify embedded app for **collection filters + storefront search** via Theme App Extension (launch MVP). AI, analytics, and advanced extras come later. Built on Shopify’s official React Router 7 template.

**Full architecture, flows, and setup checklist:** [docs/APP-FLOW-AND-SETUP.md](docs/APP-FLOW-AND-SETUP.md)  
**Launch scope and capabilities:** [docs/LAUNCH-SCOPE.md](docs/LAUNCH-SCOPE.md)

## Stack

- React Router 7 + `@shopify/shopify-app-react-router`
- Polaris web components (admin)
- Theme App Extension (storefront widget)
- Admin GraphQL only
- PostgreSQL (Supabase) + Prisma (`DATABASE_URL` pooler + `DIRECT_URL` direct)
- Redis + BullMQ (`sync-queue` worker)
- Fly.io (`web` + `worker`)
- Shopify Billing API (`appSubscriptionCreate`) — Free + Pro

## Quick start

1. Copy `.env.example` → `.env` (or copy `.env` from a teammate) and fill Shopify credentials.

   **Postgres is Supabase.** Prisma needs both URLs (never commit real values; URL-encode `@` in the password as `%40`):
   - `DATABASE_URL` — pooled URI, port **6543**, with `?pgbouncer=true&sslmode=require`
   - `DIRECT_URL` — direct URI, port **5432**, with `?sslmode=require`

   Redis stays on this machine: `REDIS_URL=redis://localhost:6379`

   The old local URL (`postgresql://postgres:postgres@localhost:5432/smart_filter?schema=public`) is a rollback copy only. Keep it commented in `.env` until the app is confirmed against Supabase. Do not drop the local database yet.
2. `npm install`
3. `npm run dev` — starts local Redis (and a local Postgres on `5432` if that port is free), runs `prisma migrate deploy` against **Supabase** via `DIRECT_URL`, then the worker and Shopify app.

To share **this machine's local Postgres** (not Supabase) with a teammate over Cloudflare (host only): point `.env` back at localhost, keep `npm run dev` running, create a **new** Cloudflare Tunnel + subdomain (TCP → `tcp://localhost:5432`, do not change `hunaniinfotech.com` root DNS), install `cloudflared` as a Windows service, then `npm run share:db`. The teammate runs `npm run share:db:connect` and uses the printed localhost `DATABASE_URL`. They keep `REDIS_URL=redis://localhost:6379`. Never commit a tunnel token.

Optional: `docker compose up -d` if you prefer Docker. Split terminals: `npm run dev:shopify` and `npm run worker`.

## Fly.io

Current production is Hostinger: `https://deeppink-manatee-141983.hostingersite.com`

Optional / legacy Fly.io (not the live app):

```bash
fly launch   # or use existing fly.toml
fly secrets set SHOPIFY_API_SECRET=... DATABASE_URL=... DIRECT_URL=... REDIS_URL=... BILLING_TEST_MODE=true
fly deploy
shopify app deploy   # pushes App URL + app proxy to Partner Dashboard
```

## App proxy

Storefront calls `/apps/smart-filter/filters?collection_id=...` (configured in `shopify.app.toml`).
