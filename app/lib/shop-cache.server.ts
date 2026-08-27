import type { Shop, Subscription } from "@prisma/client";
import prisma from "../db.server";

const SHOP_CACHE_TTL_MS = 45_000;

export type ShopWithSubscription = Shop & {
  subscription: Subscription | null;
};

type CacheEntry = { value: ShopWithSubscription; expires: number };

const shopCache = new Map<string, CacheEntry>();
const shopByIdCache = new Map<string, CacheEntry>();

export function rememberShop(shop: ShopWithSubscription) {
  const entry: CacheEntry = {
    value: shop,
    expires: Date.now() + SHOP_CACHE_TTL_MS,
  };
  shopCache.set(shop.domain, entry);
  shopByIdCache.set(shop.id, entry);
}

export function forgetShop(domain: string) {
  const hit = shopCache.get(domain);
  shopCache.delete(domain);
  if (hit) shopByIdCache.delete(hit.value.id);
}

export async function findShopCached(
  domain: string,
): Promise<ShopWithSubscription | null> {
  const hit = shopCache.get(domain);
  if (hit && hit.expires > Date.now()) return hit.value;
  const shop = await prisma.shop.findUnique({
    where: { domain },
    include: { subscription: true },
  });
  if (shop) rememberShop(shop);
  return shop;
}

export async function findShopByIdCached(
  shopId: string,
): Promise<ShopWithSubscription | null> {
  const hit = shopByIdCache.get(shopId);
  if (hit && hit.expires > Date.now()) return hit.value;
  const shop = await prisma.shop.findUnique({
    where: { id: shopId },
    include: { subscription: true },
  });
  if (shop) rememberShop(shop);
  return shop;
}
