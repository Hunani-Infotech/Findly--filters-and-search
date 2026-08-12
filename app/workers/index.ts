import { Worker } from "bullmq";
import { SYNC_QUEUE } from "../queues.server";
import { getRedis } from "../redis.server";
import { processSyncJob } from "./processors";

const connection = getRedis();

const syncWorker = new Worker(SYNC_QUEUE, processSyncJob, {
  connection,
  concurrency: 2,
});

syncWorker.on("completed", (job) => {
  console.log(`[sync] completed ${job.name} (${job.id})`);
});

syncWorker.on("failed", (job, err) => {
  console.error(`[sync] failed ${job?.name} (${job?.id}):`, err.message);
});

console.log(`Smart Filter worker listening on ${SYNC_QUEUE}`);

async function shutdown() {
  console.log("Shutting down worker…");
  await syncWorker.close();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
