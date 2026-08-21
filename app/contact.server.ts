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

export function contactDeliveryConfigured() {
  return Boolean(trimEnv("CONTACT_WEBHOOK_URL") || trimEnv("RESEND_API_KEY"));
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

function webhookPayload(msg: ContactMessage, text: string) {
  return {
    source: "findly-admin-contact",
    shop: msg.shopDomain,
    email: msg.email,
    collaboratorCode: msg.collaboratorCode,
    subject: msg.subject,
    message: msg.message,
    text,
    content: text.slice(0, 2000),
  };
}

async function postJson(url: string, body: unknown, headers: Record<string, string>) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": "Findly-Smart-Filters-Search/contact",
      ...headers,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(DELIVER_TIMEOUT_MS),
  });
  const raw = await response.text();
  return { ok: response.ok, status: response.status, raw };
}

async function deliverWebhook(msg: ContactMessage, text: string) {
  const url = trimEnv("CONTACT_WEBHOOK_URL");
  if (!url) return null;
  const result = await postJson(url, webhookPayload(msg, text), {});
  if (!result.ok) {
    throw new Error(`Support webhook returned HTTP ${result.status}`);
  }
  return "webhook";
}

async function deliverResend(msg: ContactMessage, text: string) {
  const apiKey = trimEnv("RESEND_API_KEY");
  if (!apiKey) return null;
  const to = trimEnv("CONTACT_SUPPORT_TO");
  if (!to) {
    throw new Error("CONTACT_SUPPORT_TO is required when RESEND_API_KEY is set");
  }
  const from =
    trimEnv("CONTACT_FROM_EMAIL") || "Findly Support <beth.t@example.com>";
  const result = await postJson(
    "https://api.resend.com/emails",
    {
      from,
      to: [to],
      reply_to: msg.email,
      subject: msg.subject,
      text,
    },
    { Authorization: `Bearer ${apiKey}` },
  );
  if (!result.ok) {
    throw new Error(`Resend returned HTTP ${result.status}`);
  }
  return "resend";
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
    console.error("Contact form has no CONTACT_WEBHOOK_URL or RESEND_API_KEY");
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
  const channels: string[] = [];
  const failures: string[] = [];

  for (const send of [deliverWebhook, deliverResend]) {
    try {
      const channel = await send(payload, text);
      if (channel) channels.push(channel);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Delivery failed";
      failures.push(detail);
      console.error("Contact delivery failed", detail);
    }
  }

  if (channels.length > 0) {
    console.info(
      `Contact message delivered for ${payload.shopDomain} via ${channels.join(",")}`,
    );
    return { ok: true, channels };
  }

  return {
    ok: false,
    error:
      failures[0] ||
      "Could not reach Findly support. Please try again in a few minutes.",
  };
}
