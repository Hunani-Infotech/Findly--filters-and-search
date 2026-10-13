import { randomUUID } from "node:crypto";
import { hostname } from "node:os";
import { Prisma, type QueueJob, type QueueJobStatus } from "@prisma/client";
import prisma from "../db.server";
import {
  QUEUE_BACKOFF_DELAY_MS,
  QUEUE_CLAIM_BATCH_MAX,
  QUEUE_MAX_BACKOFF_MS,
  QUEUE_STALE_LOCK_MS,
} from "../constants/limits";
import { log } from "./log.server";

export type SyncJobName =
  | "shop.fullSync"
  | "shop.ingestBulk"
  | "shop.finalizeFullSync"
  | "product.upsert"
  | "product.markets"
  | "product.delete"
  | "collection.rebuild"
  | "shop.cleanup"
  | "billing.syncFromShopify"
  | "compliance.customersRedact"
  | "inventory.sync"
  | "variant.sync";

const FOLLOWUP_JOBS: ReadonlySet<SyncJobName> = new Set([
  "product.upsert",
  "product.markets",
  "product.delete",
  "collection.rebuild",
  "inventory.sync",
  "variant.sync",
  "shop.finalizeFullSync",
]);

const DROP_IF_BUSY_JOBS: ReadonlySet<SyncJobName> = new Set([
  "shop.fullSync",
  "shop.ingestBulk",
  "shop.cleanup",
  "shop.finalizeFullSync",
  "billing.syncFromShopify",
]);

/** Stable worker id for lockedBy — helps debug which process held a stale lock. */
export function workerLockId() {
  return `${hostname()}:${process.pid}`;
}

/** Former BullMQ custom job IDs could not contain `:` (Redis key separator). */
function normalizeJobKey(jobId?: string) {
  if (!jobId) return undefined;
  return jobId.replace(/:/g, "_");
}

function backoffMs(attempts: number) {
  const raw = QUEUE_BACKOFF_DELAY_MS * 2 ** Math.max(0, attempts - 1);
  return Math.min(raw, QUEUE_MAX_BACKOFF_MS);
}

/** DB clock — never use Date.now() for due/backoff (client clock skew vs Supabase). */
async function setRunAtFromDb(id: string, delayMs: number) {
  const ms = Math.max(0, Math.floor(delayMs));
  const rows = await prisma.$queryRaw<QueueJob[]>`
    UPDATE "QueueJob"
    SET
      "runAt" = NOW() + (${ms}::bigint * INTERVAL '1 millisecond'),
      "updatedAt" = NOW()
    WHERE id = ${id}
    RETURNING *
  `;
  return rows[0];
}

async function isRunAtInFuture(id: string) {
  const rows = await prisma.$queryRaw<Array<{ future: boolean }>>`
    SELECT ("runAt" > NOW()) AS future FROM "QueueJob" WHERE id = ${id}
  `;
  return Boolean(rows[0]?.future);
}

/** Never throws when the row was already removed by a concurrent enqueue. */
async function deleteJobByIdQuiet(id: string) {
  await prisma.queueJob.deleteMany({ where: { id } });
}

/**
 * Insert a pending job. When jobKey is set, use ON CONFLICT so concurrent
 * enqueues never throw unique-constraint errors (return the winner's row).
 */
async function insertJob(
  type: SyncJobName,
  payload: Record<string, unknown>,
  opts?: { jobKey?: string; delay?: number },
) {
  const delayMs = Math.max(0, Math.floor(opts?.delay ?? 0));
  const jobKey = opts?.jobKey;

  // No jobKey → no unique race; keep Prisma create + DB-clock runAt.
  if (!jobKey) {
    const created = await prisma.queueJob.create({
      data: {
        type,
        payload: payload as Prisma.InputJsonValue,
        status: "pending",
        maxAttempts: 3,
        runAt: new Date(0),
      },
    });
    return (await setRunAtFromDb(created.id, delayMs)) ?? created;
  }

  const payloadJson = JSON.stringify(payload);

  for (let attempt = 0; attempt < 3; attempt++) {
    const id = randomUUID();
    // Single round-trip insert with Postgres NOW() for runAt (no client skew).
    // DO NOTHING on jobKey conflict → no P2002 / prisma:error noise.
    const inserted = await prisma.$queryRaw<QueueJob[]>`
      INSERT INTO "QueueJob" (
        id, type, payload, status, attempts, "maxAttempts",
        "runAt", "jobKey", "createdAt", "updatedAt"
      )
      VALUES (
        ${id},
        ${type},
        ${payloadJson}::jsonb,
        'pending'::"QueueJobStatus",
        0,
        3,
        NOW() + (${delayMs}::bigint * INTERVAL '1 millisecond'),
        ${jobKey},
        NOW(),
        NOW()
      )
      ON CONFLICT ("jobKey") DO NOTHING
      RETURNING *
    `;
    if (inserted[0]) return inserted[0];

    const existing = await prisma.queueJob.findUnique({ where: { jobKey } });
    if (!existing) {
      // Conflict then deleted — retry insert.
      continue;
    }
    if (existing.status === "completed" || existing.status === "failed") {
      // Replace terminal row (same as former delete-then-create).
      await deleteJobByIdQuiet(existing.id);
      continue;
    }
    // pending / processing — coalesce onto the winner (existing behavior).
    return existing;
  }

  const fallback = await prisma.queueJob.findUnique({ where: { jobKey } });
  if (fallback) return fallback;
  throw new Error(`Failed to enqueue ${type} (jobKey=${jobKey}) after races`);
}

/**
 * Enqueue with the same idempotency / follow-up semantics as the former BullMQ path.
 * Storage is Postgres QueueJob rows instead of Redis.
 */
export async function enqueueSyncJob(
  name: SyncJobName,
  data: Record<string, unknown>,
  opts?: { jobId?: string; delay?: number },
) {
  const { ensureWorkerRunning } = await import("../workers/ensure-running.server");
  await ensureWorkerRunning();

  const jobKey = normalizeJobKey(opts?.jobId);

  if (jobKey) {
    const existing = await prisma.queueJob.findUnique({ where: { jobKey } });
    if (existing) {
      if (existing.status === "failed" || existing.status === "completed") {
        await deleteJobByIdQuiet(existing.id);
      } else if (
        existing.status === "pending" &&
        (await isRunAtInFuture(existing.id))
      ) {
        // Delayed (backoff / explicit delay): refresh delay if caller asked.
        if (opts?.delay != null) {
          const refreshed = await prisma.queueJob.updateMany({
            where: { id: existing.id, status: "pending" },
            data: { payload: data as Prisma.InputJsonValue },
          });
          if (refreshed.count === 0) {
            return insertJob(name, data, { jobKey, delay: opts.delay });
          }
          return (await setRunAtFromDb(existing.id, opts.delay)) ?? existing;
        }
        return existing;
      } else if (existing.status === "pending") {
        return existing;
      } else if (existing.status === "processing") {
        if (DROP_IF_BUSY_JOBS.has(name) || !FOLLOWUP_JOBS.has(name)) {
          const staleAfterMs = name === "shop.fullSync" ? 120_000 : 0;
          const startedAt = existing.lockedAt?.getTime() ?? existing.updatedAt.getTime();
          if (
            staleAfterMs &&
            startedAt &&
            Date.now() - startedAt > staleAfterMs
          ) {
            log.warn(
              `[queue] queueing replacement ${name} for stuck ${jobKey} after ${Date.now() - startedAt}ms`,
            );
            return insertJob(name, data, {
              jobKey: `${jobKey}_retry_${Date.now()}`,
              delay: opts?.delay,
            });
          }
          return existing;
        }
        for (const suffix of ["followup", "followup2"] as const) {
          const followupKey = `${jobKey}_${suffix}`;
          const followup = await prisma.queueJob.findUnique({
            where: { jobKey: followupKey },
          });
          if (followup) {
            if (followup.status === "failed" || followup.status === "completed") {
              await deleteJobByIdQuiet(followup.id);
            } else if (
              followup.status === "pending" &&
              (await isRunAtInFuture(followup.id))
            ) {
              if (opts?.delay != null) {
                const refreshed = await prisma.queueJob.updateMany({
                  where: { id: followup.id, status: "pending" },
                  data: { payload: data as Prisma.InputJsonValue },
                });
                if (refreshed.count === 0) {
                  return insertJob(name, data, {
                    jobKey: followupKey,
                    delay: opts.delay,
                  });
                }
                return (await setRunAtFromDb(followup.id, opts.delay)) ?? followup;
              }
              return followup;
            } else if (followup.status === "pending") {
              return followup;
            } else if (followup.status === "processing") {
              continue;
            } else {
              return followup;
            }
          }
          return insertJob(name, data, {
            jobKey: followupKey,
            delay: opts?.delay,
          });
        }
        return insertJob(name, data, {
          jobKey: `${jobKey}_followup_${Date.now()}`,
          delay: opts?.delay,
        });
      }
    }
  }

  return insertJob(name, data, { jobKey, delay: opts?.delay });
}

const DEFAULT_ENQUEUE_TIMEOUT_MS = 800;

/**
 * Reject if Postgres enqueue hangs (pooler / network blip).
 * Safe recovery: only when a durable pending/processing row for the same
 * jobKey+type already exists (late insert after timeout). Otherwise rethrow
 * so Shopify still retries — never invents success.
 */
export async function enqueueSyncJobWithTimeout(
  name: SyncJobName,
  data: Record<string, unknown>,
  opts?: { jobId?: string; delay?: number; timeoutMs?: number },
) {
  const timeoutMs = opts?.timeoutMs ?? DEFAULT_ENQUEUE_TIMEOUT_MS;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      enqueueSyncJob(name, data, opts).finally(() => {
        if (timer) clearTimeout(timer);
      }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`enqueue ${name} timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      }),
    ]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const jobKey = normalizeJobKey(opts?.jobId);
    if (!jobKey || !message.includes("timed out")) {
      throw error;
    }

    const isLiveMatch = (row: QueueJob | null) =>
      Boolean(
        row &&
          row.type === name &&
          (row.status === "pending" || row.status === "processing"),
      );

    // Immediate check, then one short grace for a late INSERT.
    let existing = await prisma.queueJob.findUnique({ where: { jobKey } });
    if (!isLiveMatch(existing)) {
      await new Promise((r) => setTimeout(r, 50));
      existing = await prisma.queueJob.findUnique({ where: { jobKey } });
    }
    if (isLiveMatch(existing) && existing) {
      log.warn(
        `[queue] enqueue ${name} timed out but jobKey=${jobKey} is ${existing.status}; treating as success`,
      );
      return existing;
    }
    throw error;
  }
}

/**
 * Requeue jobs left in `processing` after a crash / killed process.
 * Uses Postgres NOW() so Hostinger clock skew cannot strand jobs.
 */
export async function recoverStaleJobs(staleMs = QUEUE_STALE_LOCK_MS) {
  const ms = Math.max(0, Math.floor(staleMs));
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    UPDATE "QueueJob"
    SET
      status = 'pending'::"QueueJobStatus",
      "lockedAt" = NULL,
      "lockedBy" = NULL,
      "updatedAt" = NOW()
    WHERE status = 'processing'::"QueueJobStatus"
      AND "lockedAt" IS NOT NULL
      AND "lockedAt" < NOW() - (${ms}::bigint * INTERVAL '1 millisecond')
    RETURNING id
  `;
  if (rows.length > 0) {
    log.warn(`[queue] requeued ${rows.length} stale processing job(s)`);
  }
  return rows.length;
}

export function getClaimLimit(workerSlots?: number) {
  const slots =
    workerSlots != null && workerSlots > 0
      ? workerSlots
      : Math.min(
          32,
          Math.max(1, Number.parseInt(process.env.WORKER_COUNT || "2", 10) || 2),
        );
  return Math.max(1, Math.min(QUEUE_CLAIM_BATCH_MAX, slots));
}

/**
 * Atomically claim due pending jobs.
 *
 * Uses SELECT … FOR UPDATE SKIP LOCKED so concurrent worker processes never
 * block each other or double-process the same row. Claim is committed before
 * handlers run so long sync jobs do not hold row locks.
 *
 * Due time is Postgres NOW() — client Date.now() must not gate claims
 * (Supabase clock can differ from the Hostinger / Windows machine).
 */
export async function claimJobs(
  limit = getClaimLimit(),
  lockedBy = workerLockId(),
): Promise<QueueJob[]> {
  if (limit < 1) return [];
  const take = Math.floor(limit);

  // CTE + SKIP LOCKED: concurrent workers never block or double-claim.
  return prisma.$transaction(async (tx) => {
    return tx.$queryRaw<QueueJob[]>`
      WITH due AS (
        SELECT id
        FROM "QueueJob"
        WHERE status = 'pending'::"QueueJobStatus"
          AND "runAt" <= NOW()
        ORDER BY "runAt" ASC
        LIMIT ${Prisma.raw(String(take))}
        FOR UPDATE SKIP LOCKED
      )
      UPDATE "QueueJob" AS q
      SET
        status = 'processing'::"QueueJobStatus",
        "lockedAt" = NOW(),
        "lockedBy" = ${lockedBy},
        "updatedAt" = NOW()
      FROM due
      WHERE q.id = due.id
      RETURNING q.*
    `;
  });
}

export async function completeJob(id: string) {
  await prisma.queueJob.update({
    where: { id },
    data: {
      status: "completed",
      lockedAt: null,
      lockedBy: null,
      lastError: null,
    },
  });
}

/**
 * Record a failure. Increments attempts; either requeues with exponential
 * backoff or marks failed after maxAttempts (same as BullMQ attempts: 3).
 * Backoff runAt is NOW() + delay on the database clock.
 */
export async function failJob(id: string, error: unknown) {
  const message =
    error instanceof Error ? error.message.slice(0, 2000) : String(error).slice(0, 2000);

  const job = await prisma.queueJob.findUnique({ where: { id } });
  if (!job) return;

  const attempts = job.attempts + 1;
  if (attempts >= job.maxAttempts) {
    await prisma.queueJob.update({
      where: { id },
      data: {
        status: "failed",
        attempts,
        lastError: message,
        lockedAt: null,
        lockedBy: null,
      },
    });
    return;
  }

  const delay = backoffMs(attempts);
  await prisma.$executeRaw`
    UPDATE "QueueJob"
    SET
      status = 'pending'::"QueueJobStatus",
      attempts = ${attempts},
      "lastError" = ${message},
      "runAt" = NOW() + (${delay}::bigint * INTERVAL '1 millisecond'),
      "lockedAt" = NULL,
      "lockedBy" = NULL,
      "updatedAt" = NOW()
    WHERE id = ${id}
  `;
}

/** Drop old terminal rows so the table stays claim-friendly (former removeOnComplete/Fail). */
export async function pruneTerminalJobs(keep = 200) {
  const terminal: QueueJobStatus[] = ["completed", "failed"];
  for (const status of terminal) {
    const total = await prisma.queueJob.count({ where: { status } });
    if (total <= keep) continue;
    const survivors = await prisma.queueJob.findMany({
      where: { status },
      orderBy: { updatedAt: "desc" },
      take: keep,
      select: { id: true },
    });
    const keepIds = survivors.map((row) => row.id);
    if (keepIds.length === 0) continue;
    await prisma.queueJob.deleteMany({
      where: { status, id: { notIn: keepIds } },
    });
  }
}
