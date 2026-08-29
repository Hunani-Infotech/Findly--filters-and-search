import prisma from "../db.server";
import { log } from "./log.server";
import { findShopByIdCached } from "./shop-cache.server";

const CATALOG_PREFIX = "catalog:";
const CONFIG_PREFIX = "config:";
const localCatalogGen = new Map<string, number>();
const localConfigGen = new Map<string, number>();

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

/** Drop in-process generation counters for a shop (uninstall / shop/redact). */
export function forgetShopCacheGenerations(shopDomain: string) {
  localCatalogGen.delete(shopDomain);
  localConfigGen.delete(shopDomain);
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

/**
 * One DB round-trip for catalog + widget-config generations.
 * Filter/search JSON caches should include both so admin saves are visible
 * without invalidating the product-row cache.
 */
export async function getStorefrontCacheGens(
  shopDomain: string,
): Promise<StorefrontCacheGens> {
  const localCatalog = localMapValue(localCatalogGen, shopDomain);
  const localConfig = localMapValue(localConfigGen, shopDomain);
  try {
    const rows = await prisma.cacheGeneration.findMany({
      where: { key: { in: [catalogKey(shopDomain), configKey(shopDomain)] } },
    });
    const byKey = new Map(rows.map((row) => [row.key, row.version]));
    return {
      catalog: String(
        Math.max(byKey.get(catalogKey(shopDomain)) ?? 0, localCatalog),
      ),
      config: String(
        Math.max(byKey.get(configKey(shopDomain)) ?? 0, localConfig),
      ),
    };
  } catch (error) {
    log.warn("[catalog-cache] get storefront gens failed", error);
    return {
      catalog: String(localCatalog),
      config: String(localConfig),
    };
  }
}

/** Storefront/admin caches should include this so catalog writes are visible immediately. */
export async function getCatalogGeneration(shopDomain: string): Promise<string> {
  const local = localMapValue(localCatalogGen, shopDomain);
  try {
    const version = await readGeneration(catalogKey(shopDomain));
    return String(Math.max(version, local));
  } catch (error) {
    log.warn("[catalog-cache] get generation failed", error);
    return String(local);
  }
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
export async function bumpStorefrontConfigGeneration(
  shopDomain: string,
): Promise<void> {
  const next = localMapValue(localConfigGen, shopDomain) + 1;
  localConfigGen.set(shopDomain, next);
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
