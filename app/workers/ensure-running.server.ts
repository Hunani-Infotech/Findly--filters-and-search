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
 * Run the BullMQ worker in-process so it shares the Node app env
 * (DATABASE_URL, REDIS_URL, Shopify keys). Spawning `tsx app/workers/index.ts`
 * fails in production (tsx is a devDependency; Passenger often kills children).
 *
 * LiteSpeed sets LSNODE_CONSOLE_LOG on the running app only.
 * Set START_WORKER=1 to force (e.g. other hosts). START_WORKER=0 disables.
 */
export function ensureWorkerRunning() {
  if (process.env.START_WORKER === "0") return;
  if (process.env.FINDLY_WORKER_CHILD === "1") return;

  const lifecycle = process.env.npm_lifecycle_event ?? "";
  if (lifecycle === "build" || lifecycle === "postinstall") return;

  const passengerRuntime = Boolean(process.env.LSNODE_CONSOLE_LOG);
  const production = process.env.NODE_ENV === "production";
  if (
    process.env.START_WORKER !== "1" &&
    !passengerRuntime &&
    !production
  ) {
    return;
  }

  if (globalThis.__findlySyncWorker) return;
  if (globalThis.__findlySyncWorkerStarting) return;

  globalThis.__findlySyncWorkerStarting = startInProcessWorker().catch(
    (error) => {
      log.error("[worker] in-process start failed", error);
      globalThis.__findlySyncWorkerStarting = undefined;
    },
  );
}

async function startInProcessWorker() {
  if (globalThis.__findlySyncWorker) return;

  const { Worker } = await import("bullmq");
  const { getRedis } = await import("../redis.server");
  const { SYNC_QUEUE } = await import("../queues.server");
  const { processSyncJob } = await import("./processors");

  if (globalThis.__findlySyncWorker) return;

  const worker = new Worker(SYNC_QUEUE, processSyncJob, {
    connection: getRedis(),
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
