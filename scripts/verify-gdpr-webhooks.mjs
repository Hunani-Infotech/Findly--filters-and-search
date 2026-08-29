/**
 * GDPR / compliance webhook live trigger helper (audit #16 / AS-C6).
 *
 * This does not invent fake HMAC traffic. Use Shopify CLI against your
 * linked app + store, then confirm server logs for the three handlers.
 *
 * Usage (print commands only):
 *   node ./scripts/verify-gdpr-webhooks.mjs
 *
 * Then run the printed `shopify app webhook trigger` commands with the
 * app tunnel / Hostinger host receiving webhooks.
 */
import { log } from "./terminal-log.mjs";

const topics = [
  {
    topic: "CUSTOMERS_DATA_REQUEST",
    route: "/webhooks/customers/data_request",
    expectLog: "Received CUSTOMERS_DATA_REQUEST",
    also: "[compliance] logged customers/data_request",
  },
  {
    topic: "CUSTOMERS_REDACT",
    route: "/webhooks/customers/redact",
    expectLog: "Received CUSTOMERS_REDACT",
    also: "[compliance] customers/redact:",
  },
  {
    topic: "SHOP_REDACT",
    route: "/webhooks/shop/redact",
    expectLog: "Received SHOP_REDACT",
    also: "[compliance] billing-audit before-purge OR shop/redact status",
  },
];

log.info("GDPR webhook live check — run each trigger, then grep app logs:");
for (const row of topics) {
  log.info("");
  log.info(`# ${row.topic} → ${row.route}`);
  log.info(
    `npx shopify app webhook trigger --topic ${row.topic}`,
  );
  log.info(`Expect log containing: ${row.expectLog}`);
  log.info(`Also expect: ${row.also}`);
}

log.info("");
log.success(
  "PASS when all three topics produce authenticate.webhook success + compliance logs (not 401).",
);
log.info(
  "FAIL if HMAC rejects (wrong API secret), route 404, or no ComplianceRequest row for data_request.",
);
