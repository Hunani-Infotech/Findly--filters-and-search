import { log } from "./log.server";
import { getRedis } from "./redis.server";
import { findShopByIdCached } from "./shop-cache.server";

const CATALOG_PREFIX = "findly:catalog-gen:";
const CONFIG_PREFIX = "findly:config-gen:";
const localCatalogGen = new Map<string, number>();
const localConfigGen = new Map<string, number>();

function catalogRedisKey(shopDomain: string) {
  return `${CATALOG_PREFIX}${shopDomain}`;
}

function configRedisKey(shopDomain: string) {
  return `${CONFIG_PREFIX}${shopDomain}`;
}

function localMapValue(store: Map<string, number>, shopDomain: string): number {
  return store.get(shopDomain) ?? 0;
}

export type StorefrontCacheGens = {
  catalog: string;
  config: string;
};

/**
 * One Redis round-trip for catalog + widget-config generations.
 * Filter/search JSON caches should include both so admin saves are visible
 * without invalidating the product-row cache.
 */
export async function getStorefrontCacheGens(
  shopDomain: string,
): Promise<StorefrontCacheGens> {
  const localCatalog = localMapValue(localCatalogGen, shopDomain);
  const localConfig = localMapValue(localConfigGen, shopDomain);
  try {
    const [catalogRaw, configRaw] = await getRedis().mget(
      catalogRedisKey(shopDomain),
      configRedisKey(shopDomain),
    );
    return {
      catalog: String(Math.max(Number(catalogRaw ?? "0") || 0, localCatalog)),
      config: String(Math.max(Number(configRaw ?? "0") || 0, localConfig)),
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
    const value = await getRedis().get(catalogRedisKey(shopDomain));
    const redisN = Number(value ?? "0") || 0;
    return String(Math.max(redisN, local));
  } catch (error) {
    log.warn("[catalog-cache] get generation failed", error);
    return String(local);
  }
}

/** Call after ProductFacet / membership writes so filter payloads miss cache. */
export async function bumpCatalogGeneration(shopDomain: string): Promise<void> {
  localCatalogGen.set(
    shopDomain,
    localMapValue(localCatalogGen, shopDomain) + 1,
  );
  try {
    await getRedis().incr(catalogRedisKey(shopDomain));
  } catch (error) {
    log.warn("[catalog-cache] bump generation failed", error);
  }
}

/** Call after filter-tree / widget-settings writes so JSON payloads miss cache. */
export async function bumpStorefrontConfigGeneration(
  shopDomain: string,
): Promise<void> {
  localConfigGen.set(shopDomain, localMapValue(localConfigGen, shopDomain) + 1);
  try {
    await getRedis().incr(configRedisKey(shopDomain));
  } catch (error) {
    log.warn("[catalog-cache] bump config generation failed", error);
  }
}

export async function bumpStorefrontConfigGenerationForShopId(
  shopId: string,
): Promise<void> {
  const shop = await findShopByIdCached(shopId);
  if (!shop) return;
  await bumpStorefrontConfigGeneration(shop.domain);
}
