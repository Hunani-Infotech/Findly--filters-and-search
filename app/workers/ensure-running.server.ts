import type { Worker } from "bullmq";
import { log } from "../log.server";

declare global {
  // eslint-disable-next-line no-var
  var __findlySyncWorker: Worker | undefined;
  // eslint-disable-next-line no-var
  var __findlySyncWorkerStarting: Promise<void> | undefined;
}

/**
 * Hostinger Passenger starts `react-router-serve.cjs`, not `server.js`.
 * Run the BullMQ worker in-process so it shares the Node app env.
 * Always start unless START_WORKER=0 (or this process is already the worker).
 */
export function isSyncWorkerRunning() {
  return Boolean(globalThis.__findlySyncWorker);
}

export function ensureWorkerRunning(): Promise<void> {
  if (process.env.START_WORKER === "0") return Promise.resolve();
  if (process.env.FINDLY_WORKER_CHILD === "1") return Promise.resolve();

  const lifecycle = process.env.npm_lifecycle_event ?? "";
  if (lifecycle === "build" || lifecycle === "postinstall") {
    return Promise.resolve();
  }

  if (globalThis.__findlySyncWorker) return Promise.resolve();
  if (globalThis.__findlySyncWorkerStarting) {
    return globalThis.__findlySyncWorkerStarting;
  }

  globalThis.__findlySyncWorkerStarting = startInProcessWorker().catch(
    (error) => {
      log.error("[worker] in-process start failed", error);
      globalThis.__findlySyncWorkerStarting = undefined;
    },
  );
  return globalThis.__findlySyncWorkerStarting ?? Promise.resolve();
}

async function startInProcessWorker() {
  if (globalThis.__findlySyncWorker) return;

  const { Worker } = await import("bullmq");
  const { createRedisConnection } = await import("../redis.server");
  const { SYNC_QUEUE } = await import("../queues.server");
  const { processSyncJob } = await import("./processors");

  if (globalThis.__findlySyncWorker) return;

  const worker = new Worker(SYNC_QUEUE, processSyncJob, {
    connection: createRedisConnection(),
    concurrency: 2,
  });

  worker.on("completed", (job) => {
    log.success(`[sync] completed ${job.name} (${job.id})`);
  });
  worker.on("failed", (job, err) => {
    log.error(`[sync] failed ${job?.name} (${job?.id}): ${err.message}`);
  });

  globalThis.__findlySyncWorker = worker;
  log.info(`Smart Filter worker listening on ${SYNC_QUEUE} (in-process)`);
}
