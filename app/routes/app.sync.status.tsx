import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticateAdminAllowReviewBot } from "../lib/admin-auth.server";
import prisma from "../db.server";
import { recoverStuckSyncIfNeeded } from "../sync/sync.server";

/**
 * Lightweight catalog-sync status for home-page polling.
 * Avoids reloading analytics / setup on every tick while status is SYNCING.
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const auth = await authenticateAdminAllowReviewBot(request);
  if (auth.bot) {
    return {
      status: "PENDING",
      lastFullSyncAt: null,
      lastIncrementalSyncAt: null,
      errorLog: null,
      updatedAt: null,
    };
  }
  const { session } = auth;
  const syncJob = await recoverStuckSyncIfNeeded(session.shop);
  const shop = await prisma.shop.findUnique({
    where: { domain: session.shop },
    select: { id: true },
  });
  const job =
    syncJob ??
    (shop
      ? await prisma.syncJob.findUnique({ where: { shopId: shop.id } })
      : null);

  return {
    status: job?.status ?? "PENDING",
    lastFullSyncAt: job?.lastFullSyncAt?.toISOString() ?? null,
    lastIncrementalSyncAt: job?.lastIncrementalSyncAt?.toISOString() ?? null,
    errorLog: job?.errorLog ?? null,
    updatedAt: job?.updatedAt?.toISOString() ?? null,
  };
};

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
