import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { ensureShop } from "../shop.server";
import {
  PLANS,
  hasActivePaidSubscription,
} from "../billing.server";
import { log } from "../log.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, payload } = await authenticate.webhook(request);
  log.info(`Received ${topic} webhook for ${shop}`);

  const shopRow = await ensureShop(shop);
  const body = payload as {
    app_subscription?: {
      admin_graphql_api_id?: string;
      name?: string;
      status?: string;
      admin_graphql_api_shop_id?: string;
    };
  };

  const sub = body.app_subscription;
  if (sub?.status) {
    const status = String(sub.status).toUpperCase();
    const isPaid =
      status === "ACTIVE" ||
      status === "TRIAL" ||
      status === "ACCEPTED" ||
      status === "PENDING";
    const planName = isPaid
      ? sub.name || PLANS.pro.name
      : PLANS.free.name;
    const limits = isPaid ? PLANS.pro : PLANS.free;

    const subscription = await prisma.subscription.upsert({
      where: { shopId: shopRow.id },
      create: {
        shopId: shopRow.id,
        shopifySubscriptionId: sub.admin_graphql_api_id,
        planName,
        status: sub.status,
        productLimit: limits.productLimit,
        filterLimit: limits.filterLimit,
      },
      update: {
        shopifySubscriptionId: sub.admin_graphql_api_id,
        planName,
        status: sub.status,
        productLimit: limits.productLimit,
        filterLimit: limits.filterLimit,
      },
    });

    const planKey = hasActivePaidSubscription(subscription)
      ? PLANS.pro.key
      : PLANS.free.key;

    await prisma.shop.update({
      where: { id: shopRow.id },
      data: { plan: planKey },
    });
  }

  return new Response(null, { status: 200 });
};
