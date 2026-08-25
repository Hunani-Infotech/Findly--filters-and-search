import { log } from "./log.server";
import { getRedis } from "./redis.server";

const PREFIX = "findly:catalog-gen:";
const localGen = new Map<string, number>();

function redisKey(shopDomain: string) {
  return `${PREFIX}${shopDomain}`;
}

function localValue(shopDomain: string): number {
  return localGen.get(shopDomain) ?? 0;
}

/** Storefront/admin caches should include this so catalog writes are visible immediately. */
export async function getCatalogGeneration(shopDomain: string): Promise<string> {
  const local = localValue(shopDomain);
  try {
    const value = await getRedis().get(redisKey(shopDomain));
    const redisN = Number(value ?? "0") || 0;
    return String(Math.max(redisN, local));
  } catch (error) {
    log.warn("[catalog-cache] get generation failed", error);
    return String(local);
  }
}

/** Call after ProductFacet / membership writes so filter payloads miss cache. */
export async function bumpCatalogGeneration(shopDomain: string): Promise<void> {
  localGen.set(shopDomain, localValue(shopDomain) + 1);
  try {
    await getRedis().incr(redisKey(shopDomain));
  } catch (error) {
    log.warn("[catalog-cache] bump generation failed", error);
  }
}
