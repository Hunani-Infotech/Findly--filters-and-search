/**
 * Contact form must deliver to a human-monitored inbox, not only save a draft.
 * Usage: npm run verify:contact
 */
import "tsx/esm";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { log } from "./terminal-log.mjs";
import {
  deliverContactMessage,
  formatContactPlainText,
} from "../app/contact.server.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MARKER = `findly-contact-e2e-${Date.now()}`;

function fail(message) {
  throw new Error(message);
}

function readRepo(...parts) {
  return readFileSync(join(ROOT, ...parts), "utf8");
}

function assertRouteWiresDelivery() {
  const route = readRepo("app", "routes", "app.contact.tsx");
  if (!route.includes('from "../contact.server"')) {
    fail("app.contact.tsx must import deliverContactMessage from contact.server");
  }
  if (!route.includes("await deliverContactMessage(")) {
    fail("app.contact.tsx action must await deliverContactMessage");
  }
  if (!route.includes("if (!delivered.ok)")) {
    fail("app.contact.tsx must not toast success unless delivery succeeded");
  }
  const afterSave = route.split("saveAdminNavExtras")[1] ?? "";
  if (afterSave.includes("return { ok: true") && !route.includes("delivered.ok")) {
    fail("app.contact.tsx still returns ok after saving a draft only");
  }
  log.info("Contact route waits for outbound delivery before success");
}

function sampleMessage() {
  return {
    shopDomain: "findly-test-store.myshopify.com",
    email: "merchant@example.com",
    collaboratorCode: "4821",
    subject: "[Findly Smart Filters & Search] contact e2e",
    message: `Please help with collection filters. Marker: ${MARKER}`,
  };
}

async function listenLocalWebhook() {
  const received = [];
  const server = createServer((req, res) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      received.push({
        method: req.method,
        url: req.url,
        raw,
        json: JSON.parse(raw),
      });
      res.writeHead(204);
      res.end();
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  return {
    url: `http://127.0.0.1:${port}/findly-support`,
    received,
    close: () =>
      new Promise((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve())),
      ),
  };
}

async function assertUnconfiguredFails(msg) {
  const previousWebhook = process.env.CONTACT_WEBHOOK_URL;
  const previousResend = process.env.RESEND_API_KEY;
  delete process.env.CONTACT_WEBHOOK_URL;
  delete process.env.RESEND_API_KEY;
  const result = await deliverContactMessage(msg);
  if (result.ok) fail("Delivery must fail closed when no inbox is configured");
  if (previousWebhook) process.env.CONTACT_WEBHOOK_URL = previousWebhook;
  if (previousResend) process.env.RESEND_API_KEY = previousResend;
  log.info("Unconfigured contact form fails instead of fake-success");
}

async function assertLocalWebhook(msg) {
  const previousWebhook = process.env.CONTACT_WEBHOOK_URL;
  const previousResend = process.env.RESEND_API_KEY;
  const inbox = await listenLocalWebhook();
  process.env.CONTACT_WEBHOOK_URL = inbox.url;
  delete process.env.RESEND_API_KEY;
  try {
    const result = await deliverContactMessage(msg);
    if (!result.ok) fail(`Local webhook delivery failed: ${result.error}`);
    if (!result.channels.includes("webhook")) {
      fail("Expected webhook channel on local delivery");
    }
    if (inbox.received.length !== 1) {
      fail(`Expected 1 webhook POST, got ${inbox.received.length}`);
    }
    const body = inbox.received[0].json;
    const text = formatContactPlainText(msg);
    if (body.message !== msg.message || !body.text.includes(MARKER)) {
      fail("Webhook payload missing the merchant message");
    }
    if (body.shop !== msg.shopDomain || body.email !== msg.email) {
      fail("Webhook payload missing shop or reply email");
    }
    if (!text.includes(msg.collaboratorCode)) {
      fail("Plain-text body missing collaborator code");
    }
    log.info("Local webhook captured the contact payload");
  } finally {
    await inbox.close();
    if (previousWebhook) process.env.CONTACT_WEBHOOK_URL = previousWebhook;
    else delete process.env.CONTACT_WEBHOOK_URL;
    if (previousResend) process.env.RESEND_API_KEY = previousResend;
    else delete process.env.RESEND_API_KEY;
  }
}

async function createWebhookSiteToken() {
  const response = await fetch("https://webhook.site/token", {
    method: "POST",
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    fail(`webhook.site token create failed: HTTP ${response.status}`);
  }
  const token = await response.json();
  if (!token?.uuid) fail("webhook.site did not return a uuid");
  return token.uuid;
}

async function readWebhookSiteRequests(uuid) {
  const response = await fetch(
    `https://webhook.site/token/${uuid}/requests?sorting=newest&per_page=5`,
    {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(15000),
    },
  );
  if (!response.ok) {
    fail(`webhook.site request poll failed: HTTP ${response.status}`);
  }
  return response.json();
}

async function assertHumanVisibleInbox(msg) {
  const previousWebhook = process.env.CONTACT_WEBHOOK_URL;
  const previousResend = process.env.RESEND_API_KEY;
  const uuid = await createWebhookSiteToken();
  const inboxUrl = `https://webhook.site/${uuid}`;
  process.env.CONTACT_WEBHOOK_URL = inboxUrl;
  delete process.env.RESEND_API_KEY;

  try {
    const result = await deliverContactMessage(msg);
    if (!result.ok) fail(`Human inbox delivery failed: ${result.error}`);

    let found = null;
    for (let attempt = 0; attempt < 8; attempt++) {
      const payload = await readWebhookSiteRequests(uuid);
      const rows = payload?.data ?? [];
      found = rows.find((row) => {
        const content =
          typeof row.content === "string"
            ? row.content
            : JSON.stringify(row.content ?? "");
        return content.includes(MARKER);
      });
      if (found) break;
      await new Promise((resolve) => setTimeout(resolve, 750));
    }
    if (!found) {
      fail(`webhook.site inbox ${inboxUrl} never received marker ${MARKER}`);
    }
    log.info(`Human-visible inbox received the message: ${inboxUrl}`);
    return inboxUrl;
  } finally {
    if (previousWebhook) process.env.CONTACT_WEBHOOK_URL = previousWebhook;
    else delete process.env.CONTACT_WEBHOOK_URL;
    if (previousResend) process.env.RESEND_API_KEY = previousResend;
    else delete process.env.RESEND_API_KEY;
  }
}

async function main() {
  const msg = sampleMessage();
  assertRouteWiresDelivery();
  await assertUnconfiguredFails(msg);
  await assertLocalWebhook(msg);
  const inboxUrl = await assertHumanVisibleInbox(msg);
  log.success(`CONTACT_OK human inbox ${inboxUrl}`);
}

main().catch((error) => {
  log.error(error instanceof Error ? error.stack || error.message : error);
  process.exit(1);
});
