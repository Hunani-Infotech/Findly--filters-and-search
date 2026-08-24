import { log } from "./log.server";
import { createTtlCache } from "./read-cache.server";
import { getRedis } from "./redis.server";

const PREFIX = "findly:catalog-gen:";
/** Web/worker are separate processes — keep Redis gen in memory only briefly. */
const memory = createTtlCache<string>(1_000);

function redisKey(shopDomain: string) {
  return `${PREFIX}${shopDomain}`;
}

/** Storefront/admin caches should include this so catalog writes are visible immediately. */
export async function getCatalogGeneration(shopDomain: string): Promise<string> {
  return memory.wrap(shopDomain, async () => {
    try {
      const value = await getRedis().get(redisKey(shopDomain));
      return value ?? "0";
    } catch (error) {
      log.warn("[catalog-cache] get generation failed", error);
      return "0";
    }
  });
}

/** Call after ProductFacet / membership writes so filter payloads miss cache. */
export async function bumpCatalogGeneration(shopDomain: string): Promise<void> {
  try {
    await getRedis().incr(redisKey(shopDomain));
    memory.del(shopDomain);
  } catch (error) {
    log.warn("[catalog-cache] bump generation failed", error);
  }
}
