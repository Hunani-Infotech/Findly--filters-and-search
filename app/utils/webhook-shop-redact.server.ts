import { log } from "../lib/log.server";

type ShopRedactDeps = {
  claimDelivery: (params: {
    webhookId: string | undefined;
    topic: string;
    shopDomain: string;
  }) => Promise<"claimed" | "duplicate">;
  releaseDelivery: (webhookId: string | undefined) => Promise<void>;
  shopExists: (shopDomain: string) => Promise<boolean>;
  shopLooksReinstalled: (shopDomain: string) => Promise<boolean>;
  /** Queue or run hard purge. Must not depend on a live Admin API token. */
  purgeShopData: (shopDomain: string) => Promise<void>;
  audit: (params: {
    shopDomain: string;
    requestId: string;
    topic: string;
    status: string;
  }) => Promise<void>;
};

/**
 * shop/redact — purge tenant data. No Admin API dependency.
 * 5xx only when purge itself fails. Already-purged / reinstalled → 200.
 */
export async function processShopRedact(
  ctx: { shop: string; topic: string; webhookId: string },
  deps: ShopRedactDeps,
): Promise<Response> {
  const topicName = ctx.topic || "shop/redact";
  const { shop, webhookId } = ctx;
  const requestId = webhookId || `${topicName}:${shop}`;

  const claim = await deps.claimDelivery({
    webhookId,
    topic: topicName,
    shopDomain: shop,
  });

  if (claim === "duplicate") {
    const stillThere = await deps.shopExists(shop);
    if (!stillThere || (await deps.shopLooksReinstalled(shop))) {
      log.info(
        `[shop/redact] duplicate delivery acknowledged shop=${shop} webhookId=${webhookId} outcome=${
          stillThere ? "skipped_reinstalled" : "already_purged"
        }`,
      );
      return new Response(null, { status: 200 });
    }
  }

  if (await deps.shopLooksReinstalled(shop)) {
    await deps.audit({
      shopDomain: shop,
      requestId,
      topic: topicName,
      status: "skipped_reinstalled",
    });
    log.info(
      `[shop/redact] skipped — shop looks reinstalled shop=${shop} webhookId=${webhookId}`,
    );
    return new Response(null, { status: 200 });
  }

  if (!(await deps.shopExists(shop))) {
    await deps.audit({
      shopDomain: shop,
      requestId,
      topic: topicName,
      status: "already_purged",
    });
    log.info(
      `[shop/redact] shop already absent — idempotent ok shop=${shop} webhookId=${webhookId}`,
    );
    return new Response(null, { status: 200 });
  }

  let outcome: "queued" | "skipped_reinstalled" = "queued";
  try {
    await deps.purgeShopData(shop);
    if (await deps.shopLooksReinstalled(shop)) {
      outcome = "skipped_reinstalled";
    }
  } catch (error) {
    log.error(
      `[shop/redact] purge failed shop=${shop} webhookId=${webhookId}`,
      error,
    );
    await deps.releaseDelivery(webhookId);
    try {
      await deps.audit({
        shopDomain: shop,
        requestId,
        topic: topicName,
        status: "failed",
      });
    } catch (auditError) {
      log.error(`[shop/redact] audit update failed shop=${shop}`, auditError);
    }
    throw error;
  }

  // Purge already succeeded — audit must not flip this into a 5xx retry.
  try {
    await deps.audit({
      shopDomain: shop,
      requestId,
      topic: topicName,
      status: outcome,
    });
  } catch (auditError) {
    log.error(
      `[shop/redact] audit update failed after successful purge shop=${shop} webhookId=${webhookId}`,
      auditError,
    );
  }

  log.success(
    `[shop/redact] purge complete shop=${shop} webhookId=${webhookId} outcome=${outcome}`,
  );
  return new Response(null, { status: 200 });
}
