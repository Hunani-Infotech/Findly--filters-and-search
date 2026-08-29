import { log } from "../lib/log.server";
import { enqueueSyncJob } from "../lib/queues.server";

/**
 * Queue a catalog full sync. If enqueue fails, start the bulk query
 * inline so install and Sync now are not blocked.
 */
export async function queueFullSync(shop: string) {
  try {
    await enqueueSyncJob(
      "shop.fullSync",
      { shop },
      { jobId: `${shop}:shop.fullSync` },
    );
    const { ensureWorkerRunning, isSyncWorkerRunning } = await import(
      "../workers/ensure-running.server"
    );
    await ensureWorkerRunning();
    if (process.env.START_WORKER === "0" || isSyncWorkerRunning()) {
      return { ok: true as const, mode: "queued" as const };
    }
    log.warn("[sync] worker not running after enqueue; starting full sync inline");
  } catch (error) {
    log.warn("[sync] enqueue fullSync failed; running inline", error);
  }

  const { startFullSync } = await import("./sync.server");
  await startFullSync(shop);
  return { ok: true as const, mode: "inline" as const };
}
