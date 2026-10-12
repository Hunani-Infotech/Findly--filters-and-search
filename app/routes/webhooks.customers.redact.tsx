import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { enqueueSyncJobWithTimeout } from "../lib/queues.server";
import { log } from "../lib/log.server";
import {
  resolveCustomersRedactWebhookId,
  tryRecordWebhookDelivery,
} from "../services/webhook-delivery.server";

/**
 * GDPR customers/redact: dedupe on webhook id, enqueue scrub, ack 200.
 * Scrub + ComplianceRequest audit run in the worker (not on the request path).
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, payload } = await authenticate.webhook(request);

  log.info(`Received ${topic} webhook for ${shop}`);

  const webhookId = resolveCustomersRedactWebhookId({
    request,
    topic,
    shopDomain: shop,
    payload,
  });

  const recorded = await tryRecordWebhookDelivery({
    webhookId,
    shopDomain: shop,
    topic,
  });
  if (recorded === "duplicate") {
    log.info(
      `[compliance] duplicate ${topic} for ${shop} webhookId=${webhookId}; ack 200`,
    );
    return new Response(null, { status: 200 });
  }

  // Payload is needed by the worker for scrubCustomerData identifiers only —
  // never written into ComplianceRequest.
  const jobData = { shop, payload, webhookId };
  const jobId = `${shop}:customers.redact:${webhookId}`;

  try {
    await enqueueSyncJobWithTimeout("compliance.customersRedact", jobData, {
      jobId,
      timeoutMs: 800,
    });
    log.success(
      `[compliance] queued compliance.customersRedact for ${shop} webhookId=${webhookId}`,
    );
  } catch (enqueueError) {
    const reason =
      enqueueError instanceof Error
        ? enqueueError.message
        : String(enqueueError);
    log.warn(
      `[compliance] enqueue failed for ${shop} (${reason}); fire-and-forget inline scrub`,
    );
    const { runSyncJobInline } = await import("../workers/processors");
    void runSyncJobInline("compliance.customersRedact", jobData).catch(
      (error) => {
        log.error(
          `[compliance] inline compliance.customersRedact failed for ${shop}`,
          error,
        );
      },
    );
  }

  return new Response(null, { status: 200 });
};
