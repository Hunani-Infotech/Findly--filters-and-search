# Findly: Smart Filters & Search

Shopify embedded app for **collection filters** (MVP). Built on Shopify’s official React Router 7 template.

**Full architecture, flows, and setup checklist:** [docs/APP-FLOW-AND-SETUP.md](docs/APP-FLOW-AND-SETUP.md)

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

1. Copy `.env.example` → `.env` and fill Shopify credentials.
2. Start local infra: `docker compose up -d` (Postgres + Redis)
3. `npm install`
4. `npm run setup`
5. Install Shopify CLI globally if needed: `npm i -g @shopify/cli`
6. `npm run dev` (web) and in another terminal `npm run worker`

## Fly.io

```bash
fly launch   # or use existing fly.toml
fly secrets set SHOPIFY_API_SECRET=... DATABASE_URL=... BILLING_TEST_MODE=true
fly deploy
```

## App proxy

Storefront calls `/apps/smart-filter/filters?collection_id=...` (configured in `shopify.app.toml`).
