import { log } from "../lib/log.server";

/** Best-effort Admin cleanup budget (must not delay the 200). */
export const UNINSTALL_CLEANUP_TIMEOUT_MS = 4_000;

// Minimal admin surface — real AdminApiContext is assignable.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UninstallAdmin = { graphql: (...args: any[]) => any };

type UninstallDeps = {
  claimDelivery: (params: {
    webhookId: string | undefined;
    topic: string;
    shopDomain: string;
  }) => Promise<"claimed" | "duplicate">;
  releaseDelivery: (webhookId: string | undefined) => Promise<void>;
  softUninstall: (shopDomain: string) => Promise<void>;
  /**
   * Best-effort Shopify cleanup (e.g. cancel subscriptions). Never changes
   * the HTTP status after soft uninstall succeeds.
   */
  cleanupBestEffort: (params: {
    shopDomain: string;
    admin?: UninstallAdmin | null;
  }) => Promise<void>;
  /** Override for tests; production default is UNINSTALL_CLEANUP_TIMEOUT_MS. */
  cleanupTimeoutMs?: number;
};

/**
 * Soft uninstall: HMAC already validated by caller.
 * Order: dedupe → soft uninstall → best-effort cleanup (≤4s).
 * Cleanup failures / timeouts never change the response status.
 */
export async function processAppUninstalled(
  ctx: {
    shop: string;
    topic: string;
    webhookId: string;
    admin?: UninstallAdmin | null;
  },
  deps: UninstallDeps,
): Promise<Response> {
  const topic = ctx.topic || "app/uninstalled";
  const { shop, webhookId, admin } = ctx;

  const claim = await deps.claimDelivery({
    webhookId,
    topic,
    shopDomain: shop,
  });
  if (claim === "duplicate") {
    log.info(
      `[app/uninstalled] duplicate delivery acknowledged shop=${shop} webhookId=${webhookId}`,
    );
    return new Response(null, { status: 200 });
  }

  try {
    await deps.softUninstall(shop);
  } catch (error) {
    log.error(
      `[app/uninstalled] soft uninstall failed shop=${shop} webhookId=${webhookId}`,
      error,
    );
    await deps.releaseDelivery(webhookId);
    throw error;
  }

  const timeoutMs = deps.cleanupTimeoutMs ?? UNINSTALL_CLEANUP_TIMEOUT_MS;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const cleanupPromise = Promise.resolve()
    .then(() =>
      deps.cleanupBestEffort({
        shopDomain: shop,
        admin: admin ?? null,
      }),
    )
    .catch((error: unknown) => {
      // Attach catch so a late rejection after timeout cannot become unhandled.
      log.warn(
        `[app/uninstalled] cleanup rejected (best-effort) shop=${shop} webhookId=${webhookId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    });

  try {
    await Promise.race([
      cleanupPromise,
      new Promise<void>((resolve) => {
        timer = setTimeout(() => {
          log.warn(
            `[app/uninstalled] cleanup timed out after ${timeoutMs}ms (best-effort) shop=${shop} webhookId=${webhookId}`,
          );
          resolve();
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }

  log.success(
    `[app/uninstalled] soft uninstall complete shop=${shop} webhookId=${webhookId}`,
  );
  return new Response(null, { status: 200 });
}
