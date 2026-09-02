/**
 * Contact form must email Gmail (app password SMTP), not only save a draft.
 * Usage: npm run verify:contact
 * (package.json runs this with: node --import tsx)
 */
import { createServer } from "node:net";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { log } from "./terminal-log.mjs";
import {
  deliverContactMessage,
  formatContactHtml,
  formatContactPlainText,
} from "../app/services/contact.server.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MARKER = `findly-contact-e2e-${Date.now()}`;
const CONTACT_ENV = [
  "GMAIL_USER",
  "GMAIL_APP_PASSWORD",
  "SUPPORT_EMAIL",
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_USER",
  "SMTP_PASSWORD",
  "SMTP_FROM",
];

function fail(message) {
  throw new Error(message);
}

function readRepo(...parts) {
  return readFileSync(join(ROOT, ...parts), "utf8");
}

function snapshotEnv() {
  return Object.fromEntries(CONTACT_ENV.map((key) => [key, process.env[key]]));
}

function restoreEnv(snap) {
  for (const key of CONTACT_ENV) {
    const value = snap[key];
    if (value == null || value === "") delete process.env[key];
    else process.env[key] = value;
  }
}

function clearContactEnv() {
  for (const key of CONTACT_ENV) delete process.env[key];
}

function assertRouteWiresDelivery() {
  const route = readRepo("app", "routes", "app.contact.tsx");
  if (!route.includes('from "../services/contact.server"')) {
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
  if (/contactDraft:\s*\{[^}]*collaboratorCode/.test(route)) {
    fail("Contact drafts must not persist collaborator codes");
  }
  if (!route.includes("Request store access") || !route.includes("requestAccess")) {
    fail("Contact form must require an explicit request-access opt-in");
  }
  if (!route.includes("ticketNumber: delivered.ticketNumber")) {
    fail("Contact success response must include delivered.ticketNumber");
  }
  if (!route.includes("ackSent: delivered.ackSent")) {
    fail("Contact success response must include delivered.ackSent");
  }
  if (!route.includes("Reference:")) {
    fail("Contact success UI must show the reference / ticket number");
  }
  log.info("Contact route waits for outbound delivery before success");
}

function sampleMessage(overrides = {}) {
  return {
    shopDomain: "findly-test-store.myshopify.com",
    email: "merchant@example.com",
    requestAccess: true,
    collaboratorCode: "4821",
    subject: "[Findly Smart Filters & Search] contact e2e",
    message: `Please help with collection filters. Marker: ${MARKER}`,
    ...overrides,
  };
}

function listenLocalSmtp() {
  const received = [];
  const server = createServer((socket) => {
    let mode = "cmd";
    let buffer = "";
    let data = "";
    socket.write("220 localhost ESMTP\r\n");
    socket.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      if (mode === "data") {
        data += buffer;
        buffer = "";
        if (data.includes("\r\n.\r\n")) {
          received.push(data.slice(0, data.indexOf("\r\n.\r\n")));
          data = "";
          mode = "cmd";
          socket.write("250 OK\r\n");
        }
        return;
      }
      while (buffer.includes("\r\n")) {
        const idx = buffer.indexOf("\r\n");
        const line = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        const upper = line.toUpperCase();
        if (upper.startsWith("EHLO") || upper.startsWith("HELO")) {
          socket.write("250-localhost\r\n250 AUTH PLAIN LOGIN\r\n");
        } else if (upper.startsWith("AUTH")) {
          socket.write("235 2.7.0 Authentication successful\r\n");
        } else if (upper.startsWith("MAIL") || upper.startsWith("RCPT") || upper === "RSET") {
          socket.write("250 OK\r\n");
        } else if (upper === "DATA") {
          mode = "data";
          data = "";
          socket.write("354 End data with <CR><LF>.<CR><LF>\r\n");
        } else if (upper === "QUIT") {
          socket.write("221 Bye\r\n");
          socket.end();
        } else {
          socket.write("250 OK\r\n");
        }
      }
    });
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({
        port,
        received,
        close: () =>
          new Promise((done, reject) =>
            server.close((err) => (err ? reject(err) : done())),
          ),
      });
    });
  });
}

async function assertUnconfiguredFails(msg) {
  const snap = snapshotEnv();
  clearContactEnv();
  try {
    const result = await deliverContactMessage(msg);
    if (result.ok) fail("Delivery must fail closed when no inbox is configured");
    log.info("Unconfigured contact form fails instead of fake-success");
  } finally {
    restoreEnv(snap);
  }
}

async function assertLocalSmtp(msg) {
  const snap = snapshotEnv();
  const inbox = await listenLocalSmtp();
  process.env.GMAIL_USER = "info@srhwebagency.com";
  process.env.GMAIL_APP_PASSWORD = "test-app-password";
  process.env.SMTP_HOST = "127.0.0.1";
  process.env.SMTP_PORT = String(inbox.port);
  delete process.env.SUPPORT_EMAIL;
  delete process.env.SMTP_USER;
  delete process.env.SMTP_PASSWORD;
  try {
    const result = await deliverContactMessage(msg);
    if (!result.ok) fail(`Local SMTP delivery failed: ${result.error}`);
    if (!result.channels.includes("smtp")) {
      fail("Expected smtp channel on local delivery");
    }
    if (!result.ticketNumber || !/^FINDLY-[A-Z0-9]+$/i.test(result.ticketNumber)) {
      fail("Delivery must return a FINDLY reference / ticket number");
    }
    if (!result.ackSent) {
      fail("Merchant confirmation email must be sent after support delivery");
    }
    if (inbox.received.length !== 2) {
      fail(`Expected 2 SMTP messages (support + ack), got ${inbox.received.length}`);
    }
    const rawSupport = inbox.received[0].replace(/=\r\n/g, "").replace(/=\n/g, "");
    const rawAck = inbox.received[1].replace(/=\r\n/g, "").replace(/=\n/g, "");
    const withTicket = { ...msg, ticketNumber: result.ticketNumber };
    const text = formatContactPlainText(withTicket);
    const html = formatContactHtml(withTicket);
    if (!rawSupport.includes(MARKER) || !rawSupport.includes(msg.message)) {
      fail("SMTP message missing the merchant body");
    }
    if (!rawSupport.includes(msg.email) || !rawSupport.includes(msg.shopDomain)) {
      fail("SMTP message missing reply email or shop");
    }
    if (!rawSupport.includes("info@srhwebagency.com")) {
      fail("SMTP message was not addressed to the support inbox");
    }
    if (!rawSupport.includes(result.ticketNumber)) {
      fail("Support SMTP message missing the ticket reference");
    }
    if (!rawSupport.toLowerCase().includes("text/html")) {
      fail("SMTP message missing the HTML body");
    }
    if (!rawAck.includes(msg.email) || !rawAck.includes(result.ticketNumber)) {
      fail("Merchant ack missing recipient address or ticket reference");
    }
    if (!rawAck.toLowerCase().includes("we received")) {
      fail("Merchant ack missing confirmation copy");
    }
    if (!text.includes(msg.collaboratorCode) || !text.includes("Support request")) {
      fail("Plain-text body missing collaborator code or app heading");
    }
    if (!text.includes(result.ticketNumber)) {
      fail("Plain-text body missing ticket reference");
    }
    if (
      !html.includes("Findly Smart Filters &amp; Search") ||
      !html.includes("Support request") ||
      !html.includes(msg.shopDomain) ||
      !html.includes(msg.collaboratorCode) ||
      !html.includes(result.ticketNumber)
    ) {
      fail("HTML body missing app name, heading, shop, collaborator code, or ticket");
    }
    const withheld = formatContactPlainText(
      sampleMessage({ requestAccess: false, collaboratorCode: "4821" }),
    );
    const withheldHtml = formatContactHtml(
      sampleMessage({ requestAccess: false, collaboratorCode: "4821" }),
    );
    if (withheld.includes("4821") || withheld.toLowerCase().includes("collaborator")) {
      fail("Plain-text must omit collaborator codes unless access is requested");
    }
    if (
      withheldHtml.includes("4821") ||
      withheldHtml.toLowerCase().includes("collaborator")
    ) {
      fail("HTML must omit collaborator codes unless access is requested");
    }
    const injected = formatContactHtml({
      ...msg,
      message: `<img src=x onerror=alert(1)>`,
    });
    if (injected.includes("<img") || !injected.includes("&lt;img")) {
      fail("HTML body must escape merchant message markup");
    }
    log.info("Local SMTP captured the contact email for Gmail");
  } finally {
    await inbox.close();
    restoreEnv(snap);
  }
}

async function main() {
  const msg = sampleMessage();
  assertRouteWiresDelivery();
  await assertUnconfiguredFails(msg);
  await assertLocalSmtp(msg);
  log.success("CONTACT_OK gmail SMTP");
}

main().catch((error) => {
  log.error(error instanceof Error ? error.stack || error.message : error);
  process.exit(1);
});
