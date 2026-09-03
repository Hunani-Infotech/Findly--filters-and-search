import { authenticate } from "../shopify.server";
import { log } from "./log.server";

/**
 * Shopify's authenticate.admin rejects self-identified bots with HTTP 410
 * (`isbot` → HeadlessChrome). App Store automated checks use HeadlessChrome,
 * so a bare 410 looks like a dead app surface. Soft-handle that case and still
 * return a 200 App Bridge shell for review crawlers.
 *
 * Real merchants (normal browsers) never hit this path.
 */
export function isBotGoneResponse(error: unknown): error is Response {
  return error instanceof Response && error.status === 410;
}

export async function authenticateAdminAllowReviewBot(request: Request) {
  try {
    const result = await authenticate.admin(request);
    return { bot: false as const, ...result };
  } catch (error) {
    if (isBotGoneResponse(error)) {
      const ua = (request.headers.get("user-agent") || "").slice(0, 120);
      log.info(`[auth] bot/review UA skipped auth (410 Gone) ua=${ua}`);
      return { bot: true as const };
    }
    throw error;
  }
}

export function adminApiKey() {
  return process.env.SHOPIFY_API_KEY || "";
}
