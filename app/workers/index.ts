import { log } from "../lib/log.server";
import { drainOnce } from "./ensure-running.server";
import { getWorkerCount } from "./concurrency.server";
import { QUEUE_POLL_INTERVAL_MS } from "../constants/limits";
import { pruneTerminalJobs } from "../lib/queues.server";

/**
 * Dedicated worker process (`npm run worker` / nohup / Hostinger cron).
 * Polls Postgres QueueJob rows — no Redis/BullMQ.
 *
 * QUEUE_POLL_ONCE=1 → single drain then exit (cron-friendly).
 * Otherwise loop until SIGINT/SIGTERM.
 */
process.env.FINDLY_WORKER_CHILD = "1";

const concurrency = getWorkerCount();
let stopping = false;

log.info(
  `Smart Filter worker listening on postgres queue (WORKER_COUNT=${concurrency})`,
);

async function main() {
  if (process.env.QUEUE_POLL_ONCE === "1") {
    const n = await drainOnce(concurrency);
    await pruneTerminalJobs().catch(() => {});
    log.info(`[worker] poll-once drained ${n} job(s); exiting`);
    process.exit(0);
  }

  let pruneTick = 0;
  while (!stopping) {
    try {
      await drainOnce(concurrency);
      pruneTick += 1;
      if (pruneTick % 30 === 0) {
        await pruneTerminalJobs().catch((error) => {
          log.warn("[queue] prune failed", error);
        });
      }
    } catch (error) {
      log.error("[worker] poll cycle failed", error);
    }
    await new Promise((resolve) => setTimeout(resolve, QUEUE_POLL_INTERVAL_MS));
  }
}

async function shutdown() {
  if (stopping) return;
  stopping = true;
  log.info("Shutting down worker…");
  // Let the current drain finish via stopping flag on next loop.
  setTimeout(() => process.exit(0), 500);
}

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());

main().catch((error) => {
  log.error("[worker] fatal", error);
  process.exit(1);
});
