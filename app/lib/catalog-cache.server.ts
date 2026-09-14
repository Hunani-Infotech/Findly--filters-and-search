import prisma from "../db.server";
import { log } from "./log.server";
import { findShopByIdCached } from "./shop-cache.server";

const CATALOG_PREFIX = "catalog:";
const CONFIG_PREFIX = "config:";
const localCatalogGen = new Map<string, number>();
const localConfigGen = new Map<string, number>();

/**
 * Soft freshness window for CacheGeneration reads.
 * After this, serve stale-while-revalidate (return memory immediately,
 * refresh Postgres in the background). Same-process bumps still win via
 * Math.max(db, local) without waiting for refresh.
 */
const GENS_FRESH_MS = 5_000;
type GensReadEntry = { catalog: number; config: number; freshUntil: number };
const gensReadCache = new Map<string, GensReadEntry>();
const gensReadInflight = new Map<
  string,
  Promise<{ catalog: number; config: number }>
>();

/** Postgres CacheGeneration.key for catalog invalidation — keep in sync with GDPR purge. */
export function catalogCacheKey(shopDomain: string) {
  return `${CATALOG_PREFIX}${shopDomain}`;
}

/** Postgres CacheGeneration.key for widget/config invalidation — keep in sync with GDPR purge. */
export function configCacheKey(shopDomain: string) {
  return `${CONFIG_PREFIX}${shopDomain}`;
}

function catalogKey(shopDomain: string) {
  return catalogCacheKey(shopDomain);
}

function configKey(shopDomain: string) {
  return configCacheKey(shopDomain);
}

function invalidateGensReadCache(shopDomain: string) {
  gensReadCache.delete(shopDomain);
  gensReadInflight.delete(shopDomain);
}

/** Drop in-process generation counters for a shop (uninstall / shop/redact). */
export function forgetShopCacheGenerations(shopDomain: string) {
  localCatalogGen.delete(shopDomain);
  localConfigGen.delete(shopDomain);
  invalidateGensReadCache(shopDomain);
}

function localMapValue(store: Map<string, number>, shopDomain: string): number {
  return store.get(shopDomain) ?? 0;
}

export type StorefrontCacheGens = {
  catalog: string;
  config: string;
};

/**
 * Atomic upsert+increment via UPDATE … RETURNING / INSERT ON CONFLICT.
 * Avoids read-then-write races between concurrent admin/storefront requests.
 */
async function incrGeneration(key: string): Promise<number> {
  const rows = await prisma.$queryRaw<Array<{ version: number }>>`
    INSERT INTO "CacheGeneration" (key, version)
    VALUES (${key}, 1)
    ON CONFLICT (key) DO UPDATE
      SET version = "CacheGeneration".version + 1
    RETURNING version
  `;
  return Number(rows[0]?.version ?? 1);
}

async function readGeneration(key: string): Promise<number> {
  const row = await prisma.cacheGeneration.findUnique({ where: { key } });
  return row?.version ?? 0;
}

async function fetchGensFromDb(
  shopDomain: string,
): Promise<{ catalog: number; config: number }> {
  let pending = gensReadInflight.get(shopDomain);
  if (!pending) {
    pending = (async () => {
      try {
        const rows = await prisma.cacheGeneration.findMany({
          where: {
            key: { in: [catalogKey(shopDomain), configKey(shopDomain)] },
          },
        });
        const byKey = new Map(rows.map((row) => [row.key, row.version]));
        return {
          catalog: byKey.get(catalogKey(shopDomain)) ?? 0,
          config: byKey.get(configKey(shopDomain)) ?? 0,
        };
      } finally {
        gensReadInflight.delete(shopDomain);
      }
    })();
    gensReadInflight.set(shopDomain, pending);
  }
  return pending;
}

function storeGensRead(
  shopDomain: string,
  db: { catalog: number; config: number },
) {
  gensReadCache.set(shopDomain, {
    catalog: db.catalog,
    config: db.config,
    freshUntil: Date.now() + GENS_FRESH_MS,
  });
}

function mergeWithLocal(
  shopDomain: string,
  catalog: number,
  config: number,
): StorefrontCacheGens {
  return {
    catalog: String(
      Math.max(catalog, localMapValue(localCatalogGen, shopDomain)),
    ),
    config: String(Math.max(config, localMapValue(localConfigGen, shopDomain))),
  };
}

/** Non-blocking refresh for stale-while-revalidate hits. */
function revalidateGensInBackground(shopDomain: string) {
  if (gensReadInflight.has(shopDomain)) return;
  void fetchGensFromDb(shopDomain)
    .then((db) => {
      storeGensRead(shopDomain, db);
    })
    .catch((error) => {
      log.warn("[catalog-cache] background gens refresh failed", error);
    });
}

/**
 * One DB round-trip for catalog + widget-config generations (true cold only).
 * After the first successful read, subsequent calls return memory immediately
 * (stale-while-revalidate when soft TTL expired). Same-process sync/admin
 * bumps update local counters so Math.max still invalidates payload caches.
 *
 * Correctness bound after a *cross-process* bump (e.g. worker): stale gen
 * may be served for at most GENS_FRESH_MS while still "soft-fresh", then one
 * more request returns the stale value while a background refresh runs; the
 * next request sees the updated generation (and may cold-load the new
 * gens-keyed payload once). Same-process bumps are immediate via
 * invalidateGensReadCache + local Math.max.
 *
 * Filter/search payload caches use the same SWR pattern (see createTtlCache /
 * getCollectionFilterPayload): soft TTL expiry never blocks; only a true
 * miss or a new cache key after a gen bump blocks on Postgres.
 */
export async function getStorefrontCacheGens(
  shopDomain: string,
): Promise<StorefrontCacheGens> {
  const cached = gensReadCache.get(shopDomain);
  if (cached) {
    if (cached.freshUntil <= Date.now()) {
      revalidateGensInBackground(shopDomain);
    }
    return mergeWithLocal(shopDomain, cached.catalog, cached.config);
  }

  try {
    const db = await fetchGensFromDb(shopDomain);
    storeGensRead(shopDomain, db);
    return mergeWithLocal(shopDomain, db.catalog, db.config);
  } catch (error) {
    log.warn("[catalog-cache] get storefront gens failed", error);
    return mergeWithLocal(shopDomain, 0, 0);
  }
}

/** Storefront/admin caches should include this so catalog writes are visible immediately. */
export async function getCatalogGeneration(shopDomain: string): Promise<string> {
  const gens = await getStorefrontCacheGens(shopDomain);
  return gens.catalog;
}

/**
 * Advance the in-process generation past Postgres when incr fails.
 * Otherwise getStorefrontCacheGens Math.max(db, local) stays on the old
 * value and in-memory filter payloads keep serving stale settings.
 */
async function advanceLocalPastDb(
  store: Map<string, number>,
  shopDomain: string,
  key: string,
  label: string,
) {
  try {
    const dbN = await readGeneration(key);
    const local = localMapValue(store, shopDomain);
    if (dbN >= local) {
      store.set(shopDomain, dbN + 1);
    }
  } catch (readError) {
    log.warn(`[catalog-cache] ${label} fallback read failed`, readError);
  }
}

/** Call after ProductFacet / membership writes so filter payloads miss cache. */
export async function bumpCatalogGeneration(shopDomain: string): Promise<void> {
  const next = localMapValue(localCatalogGen, shopDomain) + 1;
  localCatalogGen.set(shopDomain, next);
  invalidateGensReadCache(shopDomain);
  try {
    const dbN = await incrGeneration(catalogKey(shopDomain));
    localCatalogGen.set(shopDomain, Math.max(next, dbN));
  } catch (error) {
    log.warn("[catalog-cache] bump generation failed", error);
    await advanceLocalPastDb(
      localCatalogGen,
      shopDomain,
      catalogKey(shopDomain),
      "catalog",
    );
  }
}

/** Call after filter-tree / widget-settings writes so JSON payloads miss cache. */
async function bumpStorefrontConfigGeneration(
  shopDomain: string,
): Promise<void> {
  const next = localMapValue(localConfigGen, shopDomain) + 1;
  localConfigGen.set(shopDomain, next);
  invalidateGensReadCache(shopDomain);
  try {
    const dbN = await incrGeneration(configKey(shopDomain));
    localConfigGen.set(shopDomain, Math.max(next, dbN));
  } catch (error) {
    log.warn("[catalog-cache] bump config generation failed", error);
    await advanceLocalPastDb(
      localConfigGen,
      shopDomain,
      configKey(shopDomain),
      "config",
    );
  }
}

export async function bumpStorefrontConfigGenerationForShopId(
  shopId: string,
): Promise<void> {
  const shop = await findShopByIdCached(shopId);
  if (!shop) return;
  await bumpStorefrontConfigGeneration(shop.domain);
}
