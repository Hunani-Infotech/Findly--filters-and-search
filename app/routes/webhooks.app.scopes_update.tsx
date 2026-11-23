import type { ActionFunctionArgs } from "react-router";
import { authenticateWebhookSafe } from "../utils/authenticate-webhook.server";
import prisma from "../db.server";
import { log } from "../lib/log.server";
import {
  resolveScopesUpdateWebhookId,
  tryRecordWebhookDelivery,
  webhookDeliveryExists,
} from "../services/webhook-delivery.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { payload, session, topic, shop, webhookId: authWebhookId } =
    await authenticateWebhookSafe(request);
  log.info(`Received ${topic} webhook for ${shop}`);

  const webhookId =
    authWebhookId ||
    resolveScopesUpdateWebhookId({
      request,
      topic,
      shopDomain: shop,
      payload,
    });

  if (await webhookDeliveryExists(webhookId)) {
    log.info(
      `[webhooks] duplicate ${topic} for ${shop} webhookId=${webhookId}; ack 200`,
    );
    return new Response();
  }

  const current = Array.isArray(payload?.current) ? payload.current : null;
  if (session && current) {
    try {
      await prisma.session.update({
        where: {
          id: session.id,
        },
        data: {
          scope: current.toString(),
        },
      });
    } catch (error) {
      const code =
        typeof error === "object" &&
        error &&
        "code" in error &&
        typeof (error as { code?: unknown }).code === "string"
          ? (error as { code: string }).code
          : "";
      if (code !== "P2025") throw error;
      log.warn(
        `[webhooks] ${topic} session already gone for ${shop}; ack 200`,
      );
    }
  } else if (!session) {
    log.info(
      `[webhooks] ${topic} no session for ${shop} (revoked/HMAC fallback); ack 200`,
    );
  } else {
    log.warn(
      `[webhooks] ${topic} missing current scopes for ${shop}; ack 200`,
    );
  }

  await tryRecordWebhookDelivery({
    webhookId,
    shopDomain: shop,
    topic,
  });

  return new Response();
};
