# Findly: Smart Filters & Search

Shopify embedded app for **collection filters + storefront search** via Theme App Extension. Analytics, search extras, translation, and integrations are included; AI ranking and advanced merchandising stay out of scope. Built on Shopify’s official React Router 7 template.

**Build order / verification gate:** [docs/build-order.md](docs/build-order.md)  
**MVP guide + build notes:** [docs/mvp-guide.md](docs/mvp-guide.md) · [docs/build-instructions.md](docs/build-instructions.md)  
**Partner listing paste kit:** [docs/partner-listing.md](docs/partner-listing.md)

## Stack

- React Router 7 + `@shopify/shopify-app-react-router`
- Polaris web components (admin)
- Theme App Extension (storefront widget)
- Admin GraphQL only
- PostgreSQL (Supabase) + Prisma (`DATABASE_URL` pooler + `DIRECT_URL` direct)
- Postgres-backed job queue (`QueueJob` table + poller). Production: dedicated `npm run worker:prod` process. Local/dev: in-process poller when `START_WORKER` is not `0`.
- Hostinger Node web process (`npm start` / `server.js`) plus a separate `npm run worker:prod` process (Postgres `QueueJob` poller)
- Shopify Billing API (`appSubscriptionCreate`) — Free + Standard + Pro

## Quick start

1. Copy `.env.example` → `.env` (or copy `.env` from a teammate) and fill Shopify credentials.

   **Postgres is Supabase.** Prisma needs both URLs (never commit real values; URL-encode `@` in the password as `%40`):
   - `DATABASE_URL` — pooled URI, port **6543**, with `?pgbouncer=true&sslmode=require`
   - `DIRECT_URL` — direct URI, port **5432**, with `?sslmode=require`

   The old local URL (`postgresql://postgres:postgres@localhost:5432/smart_filter?schema=public`) is a rollback copy only. Keep it commented in `.env` until the app is confirmed against Supabase. Do not drop the local database yet.
2. `npm install`
3. `npm run dev` — starts local Postgres on `5432` if that port is free, runs `prisma migrate deploy` against **Supabase** via `DIRECT_URL`, then the worker and Shopify app.

To share **this machine's local Postgres** (not Supabase) with a teammate over Cloudflare (host only): point `.env` back at localhost, keep `npm run dev` running, create a **new** Cloudflare Tunnel + subdomain (TCP → `tcp://localhost:5432`, do not change `hunaniinfotech.com` root DNS), install `cloudflared` as a Windows service, then `npm run share:db`. The teammate runs `npm run share:db:connect` and uses the printed localhost `DATABASE_URL`. Never commit a tunnel token.

Split terminals: `npm run dev:shopify` and `npm run worker`.

## Production

Live app is Hostinger: `https://findly.srhwebagency.com` (Postgres on Supabase; job queue in Postgres). `shopify app deploy` pushes App URL + app proxy to the Partner Dashboard.

There is no `fly.toml` in this repo. Production does not use Fly.io. If Fly is needed later, add a new `fly.toml` then (`fly launch`).

## App proxy

Storefront calls `/apps/smart-filter/filters?collection_id=...` (configured in `shopify.app.toml`).
