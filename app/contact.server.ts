import nodemailer from "nodemailer";

const MAX_MESSAGE_CHARS = 10_000;
const DELIVER_TIMEOUT_MS = 15_000;

export type ContactMessage = {
  shopDomain: string;
  email: string;
  collaboratorCode: string;
  subject: string;
  message: string;
};

export type DeliverContactResult =
  | { ok: true; channels: string[] }
  | { ok: false; error: string };

function trimEnv(name: string) {
  return (process.env[name] ?? "").trim();
}

function gmailCredentials() {
  const user = trimEnv("GMAIL_USER");
  const pass = trimEnv("GMAIL_APP_PASSWORD").replace(/\s+/g, "");
  if (!user || !pass) return null;
  return { user, pass };
}

export function contactDeliveryConfigured() {
  return Boolean(gmailCredentials());
}

export function formatContactPlainText(msg: ContactMessage) {
  const code = msg.collaboratorCode.trim() || "(none)";
  return [
    "Findly support request",
    `Shop: ${msg.shopDomain}`,
    `From: ${msg.email}`,
    `Collaborator code: ${code}`,
    `Subject: ${msg.subject}`,
    "",
    msg.message,
  ].join("\n");
}

function isLocalSmtpHost(host: string) {
  return host === "127.0.0.1" || host === "localhost";
}

function createGmailTransport(auth: { user: string; pass: string }) {
  const host = trimEnv("CONTACT_SMTP_HOST") || "smtp.gmail.com";
  const local = isLocalSmtpHost(host);
  const port = Number(
    trimEnv("CONTACT_SMTP_PORT") || (local ? "2525" : "465"),
  );
  return nodemailer.createTransport({
    host,
    port,
    secure: !local && port === 465,
    auth,
    ignoreTLS: local,
    tls: local ? { rejectUnauthorized: false } : undefined,
    connectionTimeout: DELIVER_TIMEOUT_MS,
    greetingTimeout: DELIVER_TIMEOUT_MS,
    socketTimeout: DELIVER_TIMEOUT_MS,
  });
}

async function deliverGmail(msg: ContactMessage, text: string) {
  const auth = gmailCredentials();
  if (!auth) return null;

  const transport = createGmailTransport(auth);
  try {
    await transport.sendMail({
      from: `Findly Support <${auth.user}>`,
      to: auth.user,
      replyTo: msg.email,
      subject: msg.subject,
      text,
    });
  } finally {
    transport.close();
  }
  return "gmail";
}

export async function deliverContactMessage(
  msg: ContactMessage,
): Promise<DeliverContactResult> {
  const message = msg.message.trim();
  if (!message) {
    return { ok: false, error: "Enter a message" };
  }
  if (message.length > MAX_MESSAGE_CHARS) {
    return { ok: false, error: "Message is too long" };
  }
  if (!contactDeliveryConfigured()) {
    console.error("Contact form has no GMAIL_USER / GMAIL_APP_PASSWORD");
    return {
      ok: false,
      error: "Could not send your message. Findly support is not configured yet.",
    };
  }

  const payload: ContactMessage = {
    shopDomain: msg.shopDomain.trim(),
    email: msg.email.trim(),
    collaboratorCode: msg.collaboratorCode.trim(),
    subject: msg.subject.trim(),
    message,
  };
  const text = formatContactPlainText(payload);

  try {
    const channel = await deliverGmail(payload, text);
    if (!channel) {
      return {
        ok: false,
        error: "Could not send your message. Findly support is not configured yet.",
      };
    }
    console.info(`Contact message delivered for ${payload.shopDomain} via gmail`);
    return { ok: true, channels: [channel] };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Delivery failed";
    console.error("Contact delivery failed", detail);
    return {
      ok: false,
      error: "Could not reach Findly support. Please try again in a few minutes.",
    };
  }
}
