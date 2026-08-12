# Build order — verification gate

**Do not advance past a step until it is verified on a real Shopify dev store (not just `tsc`).**

## Launch scope
Solid **collection filters** + **storefront search** + **Theme App Extension**.

## Deferred (do not build now)
- Analytics dashboards / event pipelines (filter or search)
- AI/ML semantic ranking, embeddings
- Synonym groups, typo-tolerance engines, search redirects/boosts (beyond solid basic search)
- Custom theme editor / drag-drop widget styling beyond basic position (+ accent / counts)
- Filter tree builder, variants-as-products, Year-Make-Model, recommendations

If work drifts into these, stop and return to the current step below. There is no AI/analytics implementation in the repo to delete — do not add stubs.

| Step | Description | Status |
|------|-------------|--------|
| 1 | Scaffold + Prisma + Postgres connection | **BLOCKED** — Postgres unreachable at `localhost:5432` (Docker not installed / DB not running) |
| 2 | Auth/session E2E install on dev store | **BLOCKED** — `SHOPIFY_API_KEY` / `SHOPIFY_API_SECRET` empty; `client_id` empty in `shopify.app.toml` |
| 3 | Data models + migrations applied | Waiting on step 1 |
| 4 | Bulk sync on install (50+ products) | Waiting on steps 1–3 |
| 5 | Incremental webhook sync | Waiting on step 4 |
| 6 | Admin: collection list + filter config | Waiting on step 5 |
| 7 | Admin: metafield mapping | Waiting on step 6 |
| 8 | Theme extension: static filter UI | **HOLD** until 1–7 verified |
| 9 | Theme extension: filter logic | HOLD |
| 10 | Storefront search (solid basic — not AI) | **NOT STARTED** — launch scope; build after filters widget works |
| 11 | Billing | HOLD |
| 12 | Compliance webhooks | HOLD |
| 13 | Manual QA (filters + search + theme) | HOLD |

## Unblock step 1 (Postgres)

Pick one:

1. Install Docker Desktop, then from the project root:
   ```powershell
   docker compose up -d
   npm run setup
   ```
2. Or set `DATABASE_URL` in `.env` to a hosted Postgres (Neon/Supabase/Fly) and run `npm run setup`.

Verify:
```powershell
npx prisma migrate deploy
node .\scripts\verify-step1.mjs
```

## Unblock step 2 (Shopify auth)

1. Create / open a Partner app → copy API key + secret into `.env`
2. Set `client_id` in `shopify.app.toml` to the API key
3. Install Shopify CLI: `npm i -g @shopify/cli`
4. Run `npm run dev`, install on a development store
5. Confirm a `Session` row exists for that shop in Postgres

## After steps 1–2

Re-run verification for steps 3–9 in order, then implement step 10 (search) before treating launch MVP as done.
