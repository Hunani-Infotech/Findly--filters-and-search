import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { ackWebhookBatch } from "../lib/queues.server";
import { log } from "../lib/log.server";
import {
  resolveCustomersRedactWebhookId,
  webhookDeliveryExists,
} from "../services/webhook-delivery.server";

/**
 * GDPR customers/redact: durable enqueue, then delivery dedupe, ack 200.
 * Enqueue failure → 5xx so Shopify retries (no inline scrub on the request path).
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

  if (await webhookDeliveryExists(webhookId)) {
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
    await ackWebhookBatch({
      delivery: { webhookId, shopDomain: shop, topic },
      job: {
        name: "compliance.customersRedact",
        data: jobData,
        jobId,
      },
    });
    log.success(
      `[compliance] queued compliance.customersRedact for ${shop} webhookId=${webhookId}`,
    );
  } catch (enqueueError) {
    const reason =
      enqueueError instanceof Error
        ? enqueueError.message
        : String(enqueueError);
    log.error(
      `[compliance] enqueue failed for ${shop} (${reason}) — webhook will 5xx so Shopify retries`,
      enqueueError,
    );
    throw enqueueError;
  }

  return new Response(null, { status: 200 });
};
