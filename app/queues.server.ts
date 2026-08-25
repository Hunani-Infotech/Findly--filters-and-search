import { Queue } from "bullmq";
import { log } from "./log.server";
import { getRedis } from "./redis.server";

export const SYNC_QUEUE = "sync-queue";

export type SyncJobName =
  | "shop.fullSync"
  | "shop.ingestBulk"
  | "product.upsert"
  | "product.delete"
  | "collection.rebuild"
  | "shop.cleanup"
  | "inventory.sync"
  | "variant.sync";

const FOLLOWUP_JOBS: ReadonlySet<SyncJobName> = new Set([
  "product.upsert",
  "product.delete",
  "collection.rebuild",
  "inventory.sync",
  "variant.sync",
]);

const DROP_IF_BUSY_JOBS: ReadonlySet<SyncJobName> = new Set([
  "shop.fullSync",
  "shop.ingestBulk",
  "shop.cleanup",
]);

let syncQueue: Queue | null = null;

function getSyncQueue() {
  if (!syncQueue) {
    syncQueue = new Queue(SYNC_QUEUE, { connection: getRedis() });
  }
  return syncQueue;
}

/** BullMQ custom job IDs cannot contain `:` (Redis key separator). */
function bullJobId(jobId?: string) {
  if (!jobId) return undefined;
  return jobId.replace(/:/g, "_");
}

function jobAddOpts(jobId: string | undefined, delay?: number) {
  return {
    jobId,
    delay,
    removeOnComplete: 100,
    removeOnFail: 200,
    attempts: 3,
    backoff: { type: "exponential" as const, delay: 2000 },
  };
}

export async function enqueueSyncJob(
  name: SyncJobName,
  data: Record<string, unknown>,
  opts?: { jobId?: string; delay?: number },
) {
  const { ensureWorkerRunning } = await import("./workers/ensure-running.server");
  await ensureWorkerRunning();
  const queue = getSyncQueue();
  const jobId = bullJobId(opts?.jobId);

  if (jobId) {
    const existing = await queue.getJob(jobId);
    if (existing) {
      const state = await existing.getState();
      if (state === "failed" || state === "completed") {
        await existing.remove();
      } else if (state === "delayed") {
        if (
          opts?.delay != null &&
          typeof existing.changeDelay === "function"
        ) {
          await existing.changeDelay(opts.delay);
        }
        return existing;
      } else if (state === "waiting") {
        return existing;
      } else if (state === "active") {
        if (DROP_IF_BUSY_JOBS.has(name) || !FOLLOWUP_JOBS.has(name)) {
          const staleAfterMs = name === "shop.fullSync" ? 120_000 : 0;
          const startedAt = existing.processedOn ?? existing.timestamp ?? 0;
          if (
            staleAfterMs &&
            startedAt &&
            Date.now() - startedAt > staleAfterMs
          ) {
            log.warn(
              `[queue] queueing replacement ${name} for stuck ${jobId} after ${Date.now() - startedAt}ms`,
            );
            return queue.add(
              name,
              data,
              jobAddOpts(`${jobId}_retry_${Date.now()}`, opts?.delay),
            );
          }
          return existing;
        }
        for (const suffix of ["followup", "followup2"] as const) {
          const followupId = `${jobId}_${suffix}`;
          const followup = await queue.getJob(followupId);
          if (followup) {
            const followupState = await followup.getState();
            if (followupState === "delayed") {
              if (
                opts?.delay != null &&
                typeof followup.changeDelay === "function"
              ) {
                await followup.changeDelay(opts.delay);
              }
              return followup;
            }
            if (followupState === "waiting") {
              return followup;
            }
            if (followupState === "active") {
              continue;
            }
            if (followupState === "failed" || followupState === "completed") {
              await followup.remove();
            }
          }
          return queue.add(name, data, jobAddOpts(followupId, opts?.delay));
        }
        return queue.add(
          name,
          data,
          jobAddOpts(`${jobId}_followup_${Date.now()}`, opts?.delay),
        );
      }
    }
  }

  return queue.add(name, data, jobAddOpts(jobId, opts?.delay));
}

const DEFAULT_ENQUEUE_TIMEOUT_MS = 2000;

/** Reject if Redis/BullMQ hangs (ioredis retries forever when Redis is down). */
export async function enqueueSyncJobWithTimeout(
  name: SyncJobName,
  data: Record<string, unknown>,
  opts?: { jobId?: string; delay?: number; timeoutMs?: number },
) {
  const timeoutMs = opts?.timeoutMs ?? DEFAULT_ENQUEUE_TIMEOUT_MS;
  return await Promise.race([
    enqueueSyncJob(name, data, opts),
    new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(
          new Error(`enqueue ${name} timed out after ${timeoutMs}ms`),
        );
      }, timeoutMs);
    }),
  ]);
}
