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

export function getSyncQueue() {
  if (!syncQueue) {
    syncQueue = new Queue(SYNC_QUEUE, { connection: getRedis() });
  }
  return syncQueue;
}

export async function enqueueSyncJob(
  name: SyncJobName,
  data: Record<string, unknown>,
  opts?: { jobId?: string; delay?: number },
) {
  return getSyncQueue().add(name, data, {
    jobId: opts?.jobId,
    delay: opts?.delay,
    removeOnComplete: 100,
    removeOnFail: 200,
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
  });
}
