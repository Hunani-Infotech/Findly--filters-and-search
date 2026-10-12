import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { log } from "../lib/log.server";
import {
  resolveScopesUpdateWebhookId,
  tryRecordWebhookDelivery,
  webhookDeliveryExists,
} from "../services/webhook-delivery.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { payload, session, topic, shop } = await authenticate.webhook(request);
  log.info(`Received ${topic} webhook for ${shop}`);

  const webhookId = resolveScopesUpdateWebhookId({
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

  const current = payload.current as string[];
  if (session) {
    await prisma.session.update({
      where: {
        id: session.id,
      },
      data: {
        scope: current.toString(),
      },
    });
  }

  await tryRecordWebhookDelivery({
    webhookId,
    shopDomain: shop,
    topic,
  });

  return new Response();
};
