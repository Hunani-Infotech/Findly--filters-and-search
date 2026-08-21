import { Queue } from "bullmq";
import { getRedis } from "./redis.server";

export const SYNC_QUEUE = "sync-queue";

export type SyncJobName =
  | "shop.fullSync"
  | "shop.ingestBulk"
  | "product.upsert"
  | "product.delete"
  | "collection.rebuild"
  | "shop.cleanup";

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

export async function enqueueSyncJob(
  name: SyncJobName,
  data: Record<string, unknown>,
  opts?: { jobId?: string; delay?: number },
) {
  const queue = getSyncQueue();
  const jobId = bullJobId(opts?.jobId);

  if (jobId) {
    const existing = await queue.getJob(jobId);
    if (existing) {
      const state = await existing.getState();
      if (state === "failed" || state === "completed") {
        await existing.remove();
      } else if (
        state === "active" ||
        state === "waiting" ||
        state === "delayed"
      ) {
        return existing;
      }
    }
  }

  return queue.add(name, data, {
    jobId,
    delay: opts?.delay,
    removeOnComplete: 100,
    removeOnFail: 200,
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
  });
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
