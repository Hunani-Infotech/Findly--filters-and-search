import { Worker } from "bullmq";
import { log } from "../log.server";
import { SYNC_QUEUE } from "../queues.server";
import { getRedis } from "../redis.server";
import { processSyncJob } from "./processors";

const connection = getRedis();

const syncWorker = new Worker(SYNC_QUEUE, processSyncJob, {
  connection,
  concurrency: 2,
});

syncWorker.on("completed", (job) => {
  log.success(`[sync] completed ${job.name} (${job.id})`);
});

syncWorker.on("failed", (job, err) => {
  log.error(`[sync] failed ${job?.name} (${job?.id}): ${err.message}`);
});

log.info(`Smart Filter worker listening on ${SYNC_QUEUE}`);

async function shutdown() {
  log.info("Shutting down worker…");
  await syncWorker.close();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
