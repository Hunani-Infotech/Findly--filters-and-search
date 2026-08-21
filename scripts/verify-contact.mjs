/**
 * Contact form must email Gmail (SMTP), not only save a draft.
 * Usage: npm run verify:contact
 */
import "tsx/esm";
import { createServer } from "node:net";
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
const CONTACT_ENV = [
  "GMAIL_USER",
  "GMAIL_APP_PASSWORD",
  "CONTACT_SMTP_HOST",
  "CONTACT_SMTP_PORT",
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

async function assertLocalGmailSmtp(msg) {
  const snap = snapshotEnv();
  const inbox = await listenLocalSmtp();
  process.env.GMAIL_USER = "findly.support@gmail.com";
  process.env.GMAIL_APP_PASSWORD = "test-app-password";
  process.env.CONTACT_SMTP_HOST = "127.0.0.1";
  process.env.CONTACT_SMTP_PORT = String(inbox.port);
  try {
    const result = await deliverContactMessage(msg);
    if (!result.ok) fail(`Local Gmail SMTP delivery failed: ${result.error}`);
    if (!result.channels.includes("gmail")) {
      fail("Expected gmail channel on local delivery");
    }
    if (inbox.received.length !== 1) {
      fail(`Expected 1 SMTP message, got ${inbox.received.length}`);
    }
    const raw = inbox.received[0].replace(/=\r\n/g, "").replace(/=\n/g, "");
    const text = formatContactPlainText(msg);
    if (!raw.includes(MARKER) || !raw.includes(msg.message)) {
      fail("SMTP message missing the merchant body");
    }
    if (!raw.includes(msg.email) || !raw.includes(msg.shopDomain)) {
      fail("SMTP message missing reply email or shop");
    }
    if (!text.includes(msg.collaboratorCode)) {
      fail("Plain-text body missing collaborator code");
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
  await assertLocalGmailSmtp(msg);
  log.success("CONTACT_OK gmail SMTP");
}

main().catch((error) => {
  log.error(error instanceof Error ? error.stack || error.message : error);
  process.exit(1);
});
