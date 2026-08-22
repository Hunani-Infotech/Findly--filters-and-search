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

function smtpConfig() {
  const gmailUser = trimEnv("GMAIL_USER");
  const gmailPass = trimEnv("GMAIL_APP_PASSWORD").replace(/\s+/g, "");
  if (gmailUser && gmailPass) {
    const host = trimEnv("SMTP_HOST") || "smtp.gmail.com";
    const local = isLocalSmtpHost(host);
    const port = Number(trimEnv("SMTP_PORT") || (local ? "587" : "465"));
    const to = trimEnv("SUPPORT_EMAIL") || gmailUser;
    return { to, host, user: gmailUser, pass: gmailPass, port, from: gmailUser };
  }

  const to = trimEnv("SUPPORT_EMAIL");
  const host = trimEnv("SMTP_HOST");
  const user = trimEnv("SMTP_USER");
  const pass = trimEnv("SMTP_PASSWORD").replace(/\s+/g, "");
  if (!to || !host || !user || !pass) return null;
  const port = Number(trimEnv("SMTP_PORT") || "587");
  const from = trimEnv("SMTP_FROM") || user;
  return { to, host, user, pass, port, from };
}

export function contactDeliveryConfigured() {
  return Boolean(smtpConfig());
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

function createSmtpTransport(cfg: NonNullable<ReturnType<typeof smtpConfig>>) {
  const local = isLocalSmtpHost(cfg.host);
  return nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: !local && cfg.port === 465,
    auth: { user: cfg.user, pass: cfg.pass },
    ignoreTLS: local,
    tls: local ? { rejectUnauthorized: false } : undefined,
    connectionTimeout: DELIVER_TIMEOUT_MS,
    greetingTimeout: DELIVER_TIMEOUT_MS,
    socketTimeout: DELIVER_TIMEOUT_MS,
  });
}

async function deliverSmtp(msg: ContactMessage, text: string) {
  const cfg = smtpConfig();
  if (!cfg) return null;

  const transport = createSmtpTransport(cfg);
  try {
    await transport.sendMail({
      from: `Findly Support <${cfg.from}>`,
      to: cfg.to,
      replyTo: msg.email,
      subject: msg.subject,
      text,
    });
  } finally {
    transport.close();
  }
  return "smtp";
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
    const channel = await deliverSmtp(payload, text);
    if (!channel) {
      return {
        ok: false,
        error: "Could not send your message. Findly support is not configured yet.",
      };
    }
    console.info(`Contact message delivered for ${payload.shopDomain} via smtp`);
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
