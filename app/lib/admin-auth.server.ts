import { authenticate } from "../shopify.server";
import { log } from "./log.server";

/**
 * authenticate.admin returns 410 for bot UAs (isbot). Catch that so loaders
 * can render an empty admin page instead of Gone.
 *
 * Loaders only. Actions and auth.$.tsx keep authenticate.admin.
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
