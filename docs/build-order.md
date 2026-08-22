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
| 1 | Scaffold + Prisma + Postgres connection | **VERIFIED** (data copied to **Supabase**). Re-run `verify-step1.mjs` after restart so it hits `DATABASE_URL`, not the old localhost copy. Redis stays `localhost:6379`. |
| 2 | Auth/session E2E install on dev store | **VERIFIED** — `verify-step2.mjs` → `STEP2_OK` (offline Session for `findly-test-store.myshopify.com`) |
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
| 13 | Manual QA (filters + search + theme) | **CODE GATE PASS** (`npm run verify:b5` → `STEPB5_OK`). Live theme clicks still required for final storefront sign-off. |

## Unblock step 1 (Postgres)

Pick one:

1. **Supabase (current):** set both URLs in `.env`, then `npm install` and `npm run dev`.
   - `DATABASE_URL` — pooled (port 6543) with `pgbouncer=true&sslmode=require`
   - `DIRECT_URL` — direct (port 5432) with `sslmode=require`
   Redis still runs locally. `npm run dev` may also start unused local Postgres on `5432` if that port is free; Prisma ignores it while `.env` points at Supabase. Catalog was copied from local `smart_filter` — do not drop the local DB until the app is confirmed.
2. **No Docker (local rollback):** comment the Supabase URLs, restore `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/smart_filter?schema=public`, and `npm run dev`. Data stays in gitignored `.local/`.
3. Install Docker Desktop, then:
   ```powershell
   docker compose up -d
   npm run setup
   ```

Verify (uses whatever `DATABASE_URL` / `DIRECT_URL` are in `.env`):
```powershell
node .\node_modules\prisma\build\index.js migrate deploy
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
