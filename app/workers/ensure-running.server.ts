import type { QueueJob } from "@prisma/client";
import { log } from "../lib/log.server";
import {
  claimJobs,
  completeJob,
  failJob,
  getClaimLimit,
  pruneTerminalJobs,
  recoverStaleJobs,
  workerLockId,
} from "../lib/queues.server";
import { QUEUE_POLL_INTERVAL_MS } from "../constants/limits";
import { getWorkerCount } from "./concurrency.server";

declare global {
  // eslint-disable-next-line no-var
  var __findlySyncWorkerRunning: boolean | undefined;
  // eslint-disable-next-line no-var
  var __findlySyncWorkerStarting: Promise<void> | undefined;
  // eslint-disable-next-line no-var
  var __findlySyncWorkerAbort: AbortController | undefined;
}

/**
 * Hostinger Passenger starts `react-router-serve.cjs`, not `server.js`.
 * Poll Postgres QueueJob rows in-process so the web app can drain the queue
 * without Redis/BullMQ. Parallelism is WORKER_COUNT (claim batch + concurrent
 * handlers). Always start unless START_WORKER=0 (or this process is already
 * the dedicated worker child).
 */
export function isSyncWorkerRunning() {
  return Boolean(globalThis.__findlySyncWorkerRunning);
}

export function ensureWorkerRunning(): Promise<void> {
  if (process.env.START_WORKER === "0") return Promise.resolve();
  if (process.env.FINDLY_WORKER_CHILD === "1") return Promise.resolve();

  const lifecycle = process.env.npm_lifecycle_event ?? "";
  if (lifecycle === "build" || lifecycle === "postinstall") {
    return Promise.resolve();
  }

  if (globalThis.__findlySyncWorkerRunning) return Promise.resolve();
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
  if (globalThis.__findlySyncWorkerRunning) return;

  const abort = new AbortController();
  globalThis.__findlySyncWorkerAbort = abort;
  globalThis.__findlySyncWorkerRunning = true;

  const concurrency = getWorkerCount();
  log.info(
    `Smart Filter worker listening on postgres queue (in-process, WORKER_COUNT=${concurrency})`,
  );

  void runPollLoop(abort.signal, concurrency);
}

async function runPollLoop(signal: AbortSignal, concurrency: number) {
  let pruneTick = 0;
  while (!signal.aborted) {
    try {
      await drainOnce(concurrency);
      pruneTick += 1;
      // Occasional prune keeps completed/failed from bloating claim indexes.
      if (pruneTick % 30 === 0) {
        await pruneTerminalJobs().catch((error) => {
          log.warn("[queue] prune failed", error);
        });
      }
    } catch (error) {
      log.error("[worker] poll cycle failed", error);
    }
    await sleep(QUEUE_POLL_INTERVAL_MS, signal);
  }
}

/** One claim → process → ack cycle (also used by the dedicated worker entrypoint). */
export async function drainOnce(concurrency = getWorkerCount()) {
  await recoverStaleJobs();
  const limit = getClaimLimit(concurrency);
  const jobs = await claimJobs(limit, workerLockId());
  if (jobs.length === 0) return 0;

  // Bound parallel handlers to WORKER_COUNT so one Hostinger process stays sane.
  await mapPool(jobs, concurrency, processClaimedJob);
  return jobs.length;
}

async function processClaimedJob(job: QueueJob) {
  const { processSyncJob } = await import("./processors");
  try {
    const payload =
      job.payload && typeof job.payload === "object" && !Array.isArray(job.payload)
        ? (job.payload as Record<string, unknown>)
        : {};
    await processSyncJob({
      name: job.type,
      data: payload,
    });
    await completeJob(job.id);
    log.success(`[sync] completed ${job.type} (${job.id})`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error(`[sync] failed ${job.type} (${job.id}): ${message}`);
    await failJob(job.id, error);
  }
}

async function mapPool<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<void>,
) {
  const size = Math.max(1, concurrency);
  let index = 0;
  const workers = Array.from({ length: Math.min(size, items.length) }, async () => {
    while (index < items.length) {
      const current = items[index];
      index += 1;
      await fn(current);
    }
  });
  await Promise.all(workers);
}

function sleep(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve) => {
    if (signal.aborted) {
      resolve();
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}
