import type { Prisma } from "@prisma/client";
import prisma from "./db.server";
import { log } from "./log.server";

/**
 * Hard-delete all tenant data for a shop domain (APP_UNINSTALLED / shop/redact).
 * ComplianceRequest rows are kept (keyed by shopDomain, no FK) for audit.
 */
export async function purgeShopData(shopDomain: string) {
  const shop = await prisma.shop.findUnique({ where: { domain: shopDomain } });

  await prisma.session.deleteMany({ where: { shop: shopDomain } });

  if (!shop) {
    log.info(`[compliance] purgeShopData: no Shop row for ${shopDomain}`);
    return { deleted: false as const };
  }

  // Explicit deletes for clarity; Shop CASCADE covers relations if any remain.
  await prisma.$transaction([
    prisma.productFacet.deleteMany({ where: { shopId: shop.id } }),
    prisma.collectionMembership.deleteMany({ where: { shopId: shop.id } }),
    prisma.collection.deleteMany({ where: { shopId: shop.id } }),
    prisma.discoveredMetafield.deleteMany({ where: { shopId: shop.id } }),
    prisma.filterConfig.deleteMany({ where: { shopId: shop.id } }),
    prisma.metafieldMapping.deleteMany({ where: { shopId: shop.id } }),
    prisma.appSettings.deleteMany({ where: { shopId: shop.id } }),
    prisma.syncJob.deleteMany({ where: { shopId: shop.id } }),
    prisma.subscription.deleteMany({ where: { shopId: shop.id } }),
    prisma.shop.delete({ where: { id: shop.id } }),
  ]);

  log.success(
    `[compliance] purgeShopData: deleted tenant data for ${shopDomain}`,
  );
  return { deleted: true as const, shopId: shop.id };
}

/** Persist a compliance webhook payload for audit. */
export async function logComplianceEvent(
  shopDomain: string,
  topic: string,
  payload: unknown,
) {
  const data = (payload ?? {}) as Prisma.InputJsonValue;
  try {
    const row = await prisma.complianceRequest.create({
      data: {
        shopDomain,
        topic,
        payload: data,
      },
    });
    log.success(
      `[compliance] logged ${topic} for ${shopDomain} (id=${row.id})`,
    );
    return row;
  } catch (error) {
    log.error(
      `[compliance] failed to persist ${topic} for ${shopDomain}`,
      error,
    );
    log.warn(
      `[compliance] payload fallback ${JSON.stringify({ shopDomain, topic, payload })}`,
    );
    return null;
  }
}
