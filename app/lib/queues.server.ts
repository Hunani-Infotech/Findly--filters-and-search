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

/** Never throws when the row was already removed by a concurrent enqueue. */
async function deleteJobByIdQuiet(id: string) {
  await prisma.queueJob.deleteMany({ where: { id } });
}

/**
 * Insert a pending job. When jobKey is set, use ON CONFLICT so concurrent
 * enqueues never throw unique-constraint errors.
 *
 * Hot path (inventory/product storms): one round-trip inserts, or refreshes
 * payload + debounce delay when the same jobKey is already pending.
 * processing / terminal conflicts return no row → caller / retry loop handles.
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
    // Insert or coalesce onto pending (extends debounce delay). WHERE false on
    // processing/terminal → like DO NOTHING (no row returned).
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
      ON CONFLICT ("jobKey") DO UPDATE SET
        payload = EXCLUDED.payload,
        -- Extend debounce only while still delayed; never push a due job back.
        "runAt" = CASE
          WHEN "QueueJob"."runAt" > NOW() THEN EXCLUDED."runAt"
          ELSE "QueueJob"."runAt"
        END,
        "updatedAt" = NOW()
      WHERE "QueueJob".status = 'pending'::"QueueJobStatus"
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
    // pending (race) or processing — return for follow-up handling.
    return existing;
  }

  const fallback = await prisma.queueJob.findUnique({ where: { jobKey } });
  if (fallback) return fallback;
  throw new Error(`Failed to enqueue ${type} (jobKey=${jobKey}) after races`);
}

/**
 * When the primary jobKey is already processing, queue a follow-up so the
 * latest change is not dropped. Catalog payloads are IDs only — worker refetches.
 */
async function enqueueFollowupWhileProcessing(
  name: SyncJobName,
  data: Record<string, unknown>,
  jobKey: string,
  existing: QueueJob,
  delay?: number,
) {
  if (DROP_IF_BUSY_JOBS.has(name) || !FOLLOWUP_JOBS.has(name)) {
    const staleAfterMs = name === "shop.fullSync" ? 120_000 : 0;
    const startedAt = existing.lockedAt?.getTime() ?? existing.updatedAt.getTime();
    if (staleAfterMs && startedAt && Date.now() - startedAt > staleAfterMs) {
      log.warn(
        `[queue] queueing replacement ${name} for stuck ${jobKey} after ${Date.now() - startedAt}ms`,
      );
      return insertJob(name, data, {
        jobKey: `${jobKey}_retry_${Date.now()}`,
        delay,
      });
    }
    return existing;
  }

  for (const suffix of ["followup", "followup2"] as const) {
    const followupKey = `${jobKey}_${suffix}`;
    const followup = await insertJob(name, data, {
      jobKey: followupKey,
      delay,
    });
    if (followup.status !== "processing") {
      return followup;
    }
  }

  return insertJob(name, data, {
    jobKey: `${jobKey}_followup_${Date.now()}`,
    delay,
  });
}

/**
 * Enqueue with the same idempotency / follow-up semantics as the former BullMQ path.
 * Storage is Postgres QueueJob rows instead of Redis.
 *
 * Insert-first: inventory/product storms usually need one Postgres round-trip.
 */
export async function enqueueSyncJob(
  name: SyncJobName,
  data: Record<string, unknown>,
  opts?: { jobId?: string; delay?: number },
) {
  // Production web sets START_WORKER=0 — skip dynamic import on the hot path.
  if (process.env.START_WORKER !== "0") {
    const { ensureWorkerRunning } = await import(
      "../workers/ensure-running.server"
    );
    await ensureWorkerRunning();
  }

  const jobKey = normalizeJobKey(opts?.jobId);
  const job = await insertJob(name, data, { jobKey, delay: opts?.delay });

  if (!jobKey || job.status !== "processing") {
    return job;
  }

  return enqueueFollowupWhileProcessing(
    name,
    data,
    jobKey,
    job,
    opts?.delay,
  );
}

/**
 * Shopify allows ~5s for the full webhook HTTP response.
 * Catalog, compliance, and billing share this budget (3500 + 900 = 4400ms)
 * so HMAC and the delivery row still fit. Callers may pass a shorter timeoutMs.
 */
const DEFAULT_ENQUEUE_TIMEOUT_MS = 3500;
/** Extra budget after enqueue timeout for the in-flight INSERT (must stay under Shopify 5s). */
const ENQUEUE_TIMEOUT_RECOVERY_MS = 900;

type EnqueueAttempt =
  | { ok: true; job: QueueJob }
  | { ok: false; error: unknown };

/**
 * Reject if Postgres enqueue hangs (pooler / network blip).
 * Safe recovery: wait for the INSERT already in flight, and accept it only
 * when that same jobKey is pending/processing. Otherwise rethrow so Shopify
 * retries — never invents success.
 *
 * A fresh lookup during an inventory storm needs another pool slot and often
 * misses the row the original INSERT is about to commit. Recovery therefore
 * waits on that in-flight enqueue first.
 *
 * Recovery is hard-capped at ENQUEUE_TIMEOUT_RECOVERY_MS so pool waits cannot
 * push the webhook past Shopify's ~5s ack window.
 */
export async function enqueueSyncJobWithTimeout(
  name: SyncJobName,
  data: Record<string, unknown>,
  opts?: { jobId?: string; delay?: number; timeoutMs?: number },
) {
  const timeoutMs = opts?.timeoutMs ?? DEFAULT_ENQUEUE_TIMEOUT_MS;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const enqueuePromise: Promise<EnqueueAttempt> = enqueueSyncJob(
    name,
    data,
    opts,
  ).then(
    (job) => ({ ok: true as const, job }),
    (error: unknown) => ({ ok: false as const, error }),
  );
  const timeoutPromise = new Promise<EnqueueAttempt>((resolve) => {
    timer = setTimeout(() => {
      resolve({
        ok: false,
        error: new Error(`enqueue ${name} timed out after ${timeoutMs}ms`),
      });
    }, timeoutMs);
  });

  const first = await Promise.race([
    enqueuePromise.finally(() => {
      if (timer) clearTimeout(timer);
    }),
    timeoutPromise,
  ]);
  if (first.ok) return first.job;

  const failure = first.error;
  const message = failure instanceof Error ? failure.message : String(failure);
  const jobKey = normalizeJobKey(opts?.jobId);
  if (!jobKey || !message.includes("timed out")) {
    throw failure;
  }

  const isLiveMatch = (row: QueueJob | null | undefined) =>
    Boolean(
      row &&
        row.type === name &&
        (row.status === "pending" || row.status === "processing"),
    );

  const recoveryDeadline = Date.now() + ENQUEUE_TIMEOUT_RECOVERY_MS;
  const remaining = () => Math.max(0, recoveryDeadline - Date.now());

  const late = await Promise.race([
    enqueuePromise,
    new Promise<undefined>((resolve) => {
      setTimeout(() => resolve(undefined), remaining());
    }),
  ]);
  if (late?.ok && isLiveMatch(late.job)) {
    log.warn(
      `[queue] enqueue ${name} timed out but in-flight enqueue jobKey=${jobKey} is ${late.job.status}; treating as success`,
    );
    return late.job;
  }
  if (late && !late.ok) throw late.error;

  const left = remaining();
  if (left > 0) {
    try {
      const existing = await Promise.race([
        prisma.queueJob.findUnique({ where: { jobKey } }),
        new Promise<null>((resolve) => {
          setTimeout(() => resolve(null), left);
        }),
      ]);
      if (isLiveMatch(existing) && existing) {
        log.warn(
          `[queue] enqueue ${name} timed out but jobKey=${jobKey} is ${existing.status}; treating as success`,
        );
        return existing;
      }
    } catch {
      /* fall through — Shopify retries */
    }
  }
  throw failure;
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
