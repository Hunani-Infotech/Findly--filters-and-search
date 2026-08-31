# Build order — verification gate

**Do not treat App Store submit as done until live Hostinger + storefront QA pass** (see `docs/app-store-approval-jobs.html`). Compiling / `tsc` alone is not enough.

## Product scope (current)

**Shipped in repo:** collection filters, storefront search (Product search + Instant search), search extras (pinnings / synonyms / redirects), analytics dashboard, translation, integrations, Theme App Extension, Free / Standard / Pro billing, compliance webhooks.

## Still out of scope for submit copy

Do **not** advertise or treat as finished:

- AI/ML semantic ranking, embeddings
- Custom theme editor / drag-drop widget builder beyond basic position (+ accent / counts)

Live storefront clicks for filters, search, billing, and GDPR remain open jobs (AS-Q*, AS-B5–B7, AS-C6).

| Step | Description | Status |
|------|-------------|--------|
| 1 | Scaffold + Prisma + Postgres connection | **VERIFIED** (data on **Supabase**). Re-run `verify-step1.mjs` against `DATABASE_URL`. |
| 2 | Auth/session E2E install on dev store | **VERIFIED** — `verify-step2.mjs` → `STEP2_OK` (offline Session for `findly-test-store.myshopify.com`) |
| 3 | Data models + migrations applied | **CODE COMPLETE** — Prisma schema + migrations in repo |
| 4 | Bulk sync on install (50+ products) | **CODE COMPLETE** — live sync proof is AS-Q1 / AS-P1 |
| 5 | Incremental webhook sync | **CODE COMPLETE** — live proof is AS-Q2 |
| 6 | Admin: collection list + filter config | **CODE COMPLETE** — `/app/filters`, collections |
| 7 | Admin: metafield mapping | **CODE COMPLETE** — Settings → Metafields |
| 8 | Theme extension: static filter UI | **CODE COMPLETE** — Collection filters block + embed |
| 9 | Theme extension: filter logic | **CODE COMPLETE** — `verify:b5` / storefront proxy |
| 10 | Storefront search (solid basic — not AI) | **CODE COMPLETE** — Product search + Instant search + `/app/search` (pins / synonyms / redirects). Live theme clicks: AS-Q4 / AS-Q6 / AS-Q10–Q11 |
| 11 | Billing | **CODE COMPLETE** — Free / Standard / Pro in `billing.server.ts`. Live charges: AS-B5–B7; production `BILLING_TEST_MODE=false` is AS-P4 |
| 12 | Compliance webhooks | **CODE COMPLETE** — GDPR trio + uninstall. Live delivery: AS-C6 |
| 13 | Manual QA (filters + search + theme) | **CODE GATE PASS** (`npm run verify:b5` → `STEPB5_OK`). Live theme clicks still required for final storefront sign-off (AS-Q*). |

## Unblock step 1 (Postgres)

Pick one:

1. **Supabase (current):** set both URLs in `.env`, then `npm install` and `npm run dev`.
   - `DATABASE_URL` — pooled (port 6543) with `pgbouncer=true&sslmode=require`
   - `DIRECT_URL` — direct (port 5432) with `sslmode=require`
   `npm run dev` may also start unused local Postgres on `5432` if that port is free; Prisma ignores it while `.env` points at Supabase. Catalog was copied from local `smart_filter` — do not drop the local DB until the app is confirmed.
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

## After code-complete steps

Repo product code for filters + search + billing + compliance is in place. Next gate is **production health + live QA** (`docs/app-store-approval-jobs.html`), not re-implementing step 10.
