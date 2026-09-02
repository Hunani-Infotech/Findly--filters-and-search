import nodemailer from "nodemailer";
import { log } from "../lib/log.server";
import { FINDLY_SUPPORT_EMAIL } from "../utils/public-origin";

const MAX_MESSAGE_CHARS = 10_000;
const MAX_SUBJECT_CHARS = 200;
const DELIVER_TIMEOUT_MS = 15_000;
const CONTACT_RATE_MAX = 8;
const CONTACT_RATE_WINDOW_MS = 10 * 60 * 1000;

const contactSendTimes = new Map<string, number[]>();

function sanitizeHeaderValue(value: string) {
  return value.replace(/[\r\n\0]+/g, " ").trim();
}

function allowContactSend(shopDomain: string): boolean {
  const now = Date.now();
  const stamps = (contactSendTimes.get(shopDomain) ?? []).filter(
    (stamp) => now - stamp < CONTACT_RATE_WINDOW_MS,
  );
  if (stamps.length >= CONTACT_RATE_MAX) {
    contactSendTimes.set(shopDomain, stamps);
    return false;
  }
  stamps.push(now);
  contactSendTimes.set(shopDomain, stamps);
  return true;
}

export type ContactMessage = {
  shopDomain: string;
  email: string;
  collaboratorCode?: string;
  requestAccess?: boolean;
  subject: string;
  message: string;
  ticketNumber?: string;
};

export type DeliverContactResult =
  | { ok: true; channels: string[]; ticketNumber: string; ackSent: boolean }
  | { ok: false; error: string };

/** Short reference for support + merchant confirmation (not a persisted ticket DB). */
export function createContactTicketNumber() {
  const time = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `FINDLY-${time}${rand}`;
}

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
    const to = trimEnv("SUPPORT_EMAIL") || FINDLY_SUPPORT_EMAIL;
    return { to, host, user: gmailUser, pass: gmailPass, port, from: gmailUser };
  }

  const to = trimEnv("SUPPORT_EMAIL") || FINDLY_SUPPORT_EMAIL;
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

const APP_NAME = "Findly Smart Filters & Search";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function collaboratorLabel(code: string) {
  return code.trim() || "(requested, no code provided)";
}

function includeCollaboratorCode(msg: ContactMessage) {
  return Boolean(msg.requestAccess);
}

function shopAdminHref(shop: string) {
  if (!/^[a-z0-9][a-z0-9.-]*\.myshopify\.com$/i.test(shop)) return "";
  return `https://${shop}/admin`;
}

function metaRow(label: string, valueHtml: string) {
  return `<tr>
<td style="padding:10px 20px 10px 0;width:148px;vertical-align:top;font-size:13px;line-height:1.45;color:#6b6b6b;white-space:nowrap;">${label}</td>
<td style="padding:10px 0;vertical-align:top;font-size:13px;line-height:1.5;color:#111111;word-break:break-word;">${valueHtml}</td>
</tr>`;
}

function linkedValue(href: string, label: string) {
  const safe = escapeHtml(label);
  if (!href) return safe;
  return `<a href="${escapeHtml(href)}" style="color:#111111;text-decoration:underline;">${safe}</a>`;
}

function ticketLabel(msg: ContactMessage) {
  return (msg.ticketNumber ?? "").trim();
}

export function formatContactPlainText(msg: ContactMessage) {
  const ticket = ticketLabel(msg);
  const lines = [
    APP_NAME,
    "Support request",
    "",
    ...(ticket ? [`Reference: ${ticket}`, ""] : []),
    `Shop: ${msg.shopDomain}`,
    `From: ${msg.email}`,
  ];
  if (includeCollaboratorCode(msg)) {
    lines.push(
      `Collaborator code: ${collaboratorLabel(msg.collaboratorCode ?? "")}`,
    );
  }
  lines.push(`Subject: ${msg.subject}`, "", "Message", msg.message);
  return lines.join("\n");
}

export function formatContactHtml(msg: ContactMessage) {
  const shopHref = shopAdminHref(msg.shopDomain);
  const ticket = ticketLabel(msg);
  const code = (msg.collaboratorCode ?? "").trim();
  const codeHtml = code
    ? `<span style="font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:13px;letter-spacing:0.02em;">${escapeHtml(code)}</span>`
    : `<span style="color:#8a8a8a;">Requested, no code provided</span>`;
  const accessRow = includeCollaboratorCode(msg)
    ? metaRow("Collaborator code", codeHtml)
    : "";
  const ticketRow = ticket
    ? metaRow(
        "Reference",
        `<span style="font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:13px;letter-spacing:0.02em;">${escapeHtml(ticket)}</span>`,
      )
    : "";
  const messageHtml = escapeHtml(msg.message)
    .replace(/\r\n/g, "\n")
    .replace(/\n/g, "<br>");
  const preheader = ticket
    ? `Support request ${ticket} from ${msg.shopDomain}`
    : `New support request from ${msg.shopDomain}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escapeHtml(APP_NAME)} — Support request</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;">
<tr>
<td align="center" style="padding:32px 16px;">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border:1px solid #e4e4e7;border-radius:10px;">
<tr>
<td style="padding:36px 40px 32px;">
<p style="margin:0 0 4px;font-size:11px;line-height:1.3;letter-spacing:0.16em;font-weight:600;color:#111111;">FINDLY</p>
<p style="margin:0 0 28px;font-size:13px;line-height:1.4;color:#71717a;">${escapeHtml(APP_NAME)}</p>
<h1 style="margin:0 0 8px;font-size:22px;line-height:1.25;font-weight:600;color:#111111;">Support request</h1>
<p style="margin:0 0 28px;font-size:14px;line-height:1.5;color:#52525b;">A merchant submitted this from the Findly admin. Reply to this email to reach them.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #ececec;border-bottom:1px solid #ececec;">
${ticketRow}${metaRow("Shop", linkedValue(shopHref, msg.shopDomain))}
${metaRow("From", linkedValue(`mailto:${msg.email}`, msg.email))}
${accessRow}${metaRow("Subject", escapeHtml(msg.subject))}
</table>
<p style="margin:28px 0 10px;font-size:12px;line-height:1.4;letter-spacing:0.04em;font-weight:600;color:#71717a;text-transform:uppercase;">Message</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa;border:1px solid #ececec;border-radius:8px;">
<tr>
<td style="padding:16px 18px;font-size:14px;line-height:1.6;color:#111111;">${messageHtml}</td>
</tr>
</table>
<p style="margin:28px 0 0;font-size:12px;line-height:1.5;color:#8a8a8a;">Sent from Contact in ${escapeHtml(APP_NAME)}.</p>
</td>
</tr>
</table>
</td>
</tr>
</table>
</body>
</html>`;
}

export function formatMerchantAckPlainText(msg: ContactMessage) {
  const ticket = ticketLabel(msg) || "pending";
  return [
    APP_NAME,
    "We received your support request",
    "",
    `Reference: ${ticket}`,
    `Shop: ${msg.shopDomain}`,
    `Subject: ${msg.subject}`,
    "",
    "Keep this reference when you follow up with Findly support.",
    "Our team will reply to this email address.",
    "",
    "Your message",
    msg.message,
    "",
    `— ${APP_NAME}`,
  ].join("\n");
}

export function formatMerchantAckHtml(msg: ContactMessage) {
  const ticket = ticketLabel(msg) || "pending";
  const messageHtml = escapeHtml(msg.message)
    .replace(/\r\n/g, "\n")
    .replace(/\n/g, "<br>");
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(APP_NAME)} — Request received</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;">
<tr>
<td align="center" style="padding:32px 16px;">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border:1px solid #e4e4e7;border-radius:10px;">
<tr>
<td style="padding:36px 40px 32px;">
<p style="margin:0 0 4px;font-size:11px;line-height:1.3;letter-spacing:0.16em;font-weight:600;color:#111111;">FINDLY</p>
<p style="margin:0 0 28px;font-size:13px;line-height:1.4;color:#71717a;">${escapeHtml(APP_NAME)}</p>
<h1 style="margin:0 0 8px;font-size:22px;line-height:1.25;font-weight:600;color:#111111;">We received your request</h1>
<p style="margin:0 0 28px;font-size:14px;line-height:1.5;color:#52525b;">Thanks for contacting Findly. Keep the reference below when you follow up. Our team will reply to this email address.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #ececec;border-bottom:1px solid #ececec;">
${metaRow(
  "Reference",
  `<span style="font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:13px;letter-spacing:0.02em;">${escapeHtml(ticket)}</span>`,
)}
${metaRow("Shop", escapeHtml(msg.shopDomain))}
${metaRow("Subject", escapeHtml(msg.subject))}
</table>
<p style="margin:28px 0 10px;font-size:12px;line-height:1.4;letter-spacing:0.04em;font-weight:600;color:#71717a;text-transform:uppercase;">Your message</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa;border:1px solid #ececec;border-radius:8px;">
<tr>
<td style="padding:16px 18px;font-size:14px;line-height:1.6;color:#111111;">${messageHtml}</td>
</tr>
</table>
<p style="margin:28px 0 0;font-size:12px;line-height:1.5;color:#8a8a8a;">This is an automated confirmation from ${escapeHtml(APP_NAME)}.</p>
</td>
</tr>
</table>
</td>
</tr>
</table>
</body>
</html>`;
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

async function deliverSmtp(msg: ContactMessage, text: string, html: string) {
  const cfg = smtpConfig();
  if (!cfg) return null;

  const ticket = ticketLabel(msg);
  const supportSubject = ticket
    ? `${msg.subject} [${ticket}]`
    : msg.subject;

  const transport = createSmtpTransport(cfg);
  try {
    await transport.sendMail({
      from: { name: APP_NAME, address: cfg.from },
      to: cfg.to,
      replyTo: msg.email,
      subject: supportSubject,
      text,
      html,
    });
  } finally {
    transport.close();
  }
  return "smtp";
}

async function deliverMerchantAck(msg: ContactMessage) {
  const cfg = smtpConfig();
  if (!cfg) return false;
  const ticket = ticketLabel(msg);
  const transport = createSmtpTransport(cfg);
  try {
    await transport.sendMail({
      from: { name: APP_NAME, address: cfg.from },
      to: msg.email,
      replyTo: cfg.to,
      subject: ticket
        ? `[${ticket}] We received your Findly support request`
        : "We received your Findly support request",
      text: formatMerchantAckPlainText(msg),
      html: formatMerchantAckHtml(msg),
    });
    return true;
  } finally {
    transport.close();
  }
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
    log.error("Contact form has no GMAIL_USER / GMAIL_APP_PASSWORD");
    return {
      ok: false,
      error: "Could not send your message. Findly support is not configured yet.",
    };
  }

  const requestAccess = includeCollaboratorCode(msg);
  const ticketNumber = createContactTicketNumber();
  const payload: ContactMessage = {
    shopDomain: sanitizeHeaderValue(msg.shopDomain).slice(0, 255),
    email: sanitizeHeaderValue(msg.email).slice(0, 254),
    requestAccess,
    collaboratorCode: requestAccess
      ? sanitizeHeaderValue(msg.collaboratorCode ?? "").slice(0, 32)
      : "",
    subject: sanitizeHeaderValue(msg.subject).slice(0, MAX_SUBJECT_CHARS),
    message,
    ticketNumber,
  };
  if (!allowContactSend(payload.shopDomain || "unknown")) {
    return {
      ok: false,
      error: "Too many messages. Please wait a few minutes and try again.",
    };
  }
  const text = formatContactPlainText(payload);
  const html = formatContactHtml(payload);

  try {
    const channel = await deliverSmtp(payload, text, html);
    if (!channel) {
      return {
        ok: false,
        error: "Could not send your message. Findly support is not configured yet.",
      };
    }

    let ackSent = false;
    try {
      ackSent = await deliverMerchantAck(payload);
      if (ackSent) {
        log.info(
          `Contact ack sent to merchant for ${payload.shopDomain} ticket ${ticketNumber}`,
        );
      }
    } catch (ackError) {
      const detail =
        ackError instanceof Error ? ackError.message : "Ack delivery failed";
      log.error("Contact merchant ack failed", detail);
    }

    log.info(
      `Contact message delivered for ${payload.shopDomain} via smtp ticket ${ticketNumber}`,
    );
    return { ok: true, channels: [channel], ticketNumber, ackSent };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Delivery failed";
    log.error("Contact delivery failed", detail);
    return {
      ok: false,
      error: "Could not reach Findly support. Please try again in a few minutes.",
    };
  }
}
