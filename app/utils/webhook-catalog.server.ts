import { log } from "../lib/log.server";
import type { CatalogWebhookPlan } from "../services/webhooks.server";

type CatalogDeps = {
  isShopInactive: (shopDomain: string) => Promise<boolean>;
  recordDelivery: (opts: {
    webhookId: string;
    shopDomain: string;
    topic: string;
  }) => Promise<"new" | "duplicate" | "claimed">;
  planJob: (
    shop: string,
    topic: string,
    payload: Record<string, unknown>,
  ) => CatalogWebhookPlan | null;
  ackBatch: (opts: {
    delivery: { webhookId: string; shopDomain: string; topic: string };
    job?: {
      name: CatalogWebhookPlan["name"];
      data: Record<string, unknown>;
      jobId: string;
      delay?: number;
    };
  }) => Promise<{ delivery: "new" | "duplicate" }>;
};

/**
 * After HMAC-safe auth: skip uninstalled shops with 200; enqueue for active shops.
 * ackBatch failure throws (5xx) so Shopify retries only when retry helps.
 */
export async function processCatalogWebhook(
  ctx: {
    shop: string;
    topic: string;
    webhookId: string;
    payload: Record<string, unknown>;
  },
  deps: CatalogDeps,
): Promise<Response> {
  const { shop, topic, webhookId, payload } = ctx;

  if (await deps.isShopInactive(shop)) {
    log.info(
      `[webhooks] ${topic} skipped for uninstalled/missing shop=${shop} webhookId=${webhookId}; ack 200`,
    );
    await deps.recordDelivery({ webhookId, shopDomain: shop, topic });
    return new Response();
  }

  const plan = deps.planJob(shop, topic, payload);
  const recorded = await deps.ackBatch({
    delivery: { webhookId, shopDomain: shop, topic },
    job: plan
      ? {
          name: plan.name,
          data: plan.data,
          jobId: plan.jobId,
          delay: plan.delay,
        }
      : undefined,
  });
  if (recorded.delivery === "duplicate") {
    log.info(
      `[webhooks] duplicate ${topic} for ${shop} webhookId=${webhookId}; ack 200`,
    );
  }

  return new Response();
}
