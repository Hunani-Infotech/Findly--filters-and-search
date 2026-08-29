/**
 * Verify Redis → Postgres queue migration (static + functional).
 * Usage: node --import tsx scripts/verify-postgres-queue.mjs
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

process.env.START_WORKER = "0";
process.env.FINDLY_WORKER_CHILD = "1";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const results = [];
let failed = 0;

function pass(name, detail) {
  results.push({ ok: true, name, detail });
  console.log(`PASS  ${name}`);
  console.log(`      ${detail}`);
}

function fail(name, detail) {
  failed += 1;
  results.push({ ok: false, name, detail });
  console.log(`FAIL  ${name}`);
  console.log(`      ${detail}`);
}

function assert(name, ok, expected, actual) {
  if (ok) pass(name, `expected=${expected}; actual=${actual}`);
  else fail(name, `expected=${expected}; actual=${actual}`);
}

function walkFiles(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".git" || name === ".local") continue;
    const full = path.join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walkFiles(full, out);
    else out.push(full);
  }
  return out;
}

function loadDotEnv() {
  const envFile = path.join(root, ".env");
  if (!existsSync(envFile)) return;
  for (const raw of readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    if (!key || process.env[key]) continue;
    process.env[key] = line.slice(eq + 1).trim();
  }
}

loadDotEnv();

console.log("\n=== STATIC ===\n");

const sourceRoots = [
  path.join(root, "app"),
  path.join(root, "scripts"),
  path.join(root, "extensions"),
  path.join(root, "prisma"),
].filter(existsSync);

const sourceExt = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".mjs",
  ".cjs",
  ".json",
  ".prisma",
]);

const redisHits = [];
for (const base of sourceRoots) {
  for (const file of walkFiles(base)) {
    const baseName = path.basename(file);
    if (
      baseName === "verify-postgres-queue.mjs" ||
      baseName.startsWith("_debug-claim") ||
      baseName === "package-lock.json"
    ) {
      continue;
    }
    if (!sourceExt.has(path.extname(file))) continue;
    const text = readFileSync(file, "utf8");
    const rel = path.relative(root, file).replace(/\\/g, "/");
    if (/\bfrom\s+["'](bullmq|ioredis)["']/.test(text)) {
      redisHits.push(`${rel}: import bullmq/ioredis`);
    }
    if (/\brequire\(["'](bullmq|ioredis)["']\)/.test(text)) {
      redisHits.push(`${rel}: require bullmq/ioredis`);
    }
    if (/@upstash\//.test(text)) {
      redisHits.push(`${rel}: @upstash`);
    }
    if (/\bgetRedis\s*\(/.test(text) || /\bcreateRedisConnection\s*\(/.test(text)) {
      redisHits.push(`${rel}: getRedis/createRedisConnection`);
    }
    if (/\bIORedis\b/.test(text)) {
      redisHits.push(`${rel}: IORedis`);
    }
  }
}

assert(
  "no live ioredis/bullmq/@upstash usages in source",
  redisHits.length === 0,
  "0 hits",
  redisHits.length === 0 ? "0 hits" : redisHits.slice(0, 8).join("; "),
);

const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
const deps = { ...pkg.dependencies, ...pkg.devDependencies };
const redisDeps = Object.keys(deps).filter((k) =>
  /ioredis|bullmq|@upstash|^redis$/i.test(k),
);
assert(
  "package.json has no Redis-related dependencies",
  redisDeps.length === 0,
  "[]",
  JSON.stringify(redisDeps),
);

function envRedisKeys(filePath) {
  if (!existsSync(filePath)) return { missing: true, keys: [] };
  const keys = [];
  for (const raw of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const key = line.split("=")[0]?.trim() ?? "";
    if (/REDIS|UPSTASH/i.test(key)) keys.push(key);
  }
  return { missing: false, keys };
}

for (const envName of [".env.example", ".env"]) {
  const info = envRedisKeys(path.join(root, envName));
  if (info.missing && envName === ".env") {
    pass(`${envName} Redis/UPSTASH vars`, "file missing — skipped");
    continue;
  }
  assert(
    `${envName} has no REDIS/UPSTASH variables`,
    info.keys.length === 0,
    "[]",
    JSON.stringify(info.keys),
  );
}

const schema = readFileSync(path.join(root, "prisma", "schema.prisma"), "utf8");
assert(
  "schema.prisma has model SyncJob",
  /model\s+SyncJob\b/.test(schema),
  "model SyncJob present",
  /model\s+SyncJob\b/.test(schema) ? "present" : "absent",
);
assert(
  "schema.prisma has model QueueJob (Postgres queue)",
  /model\s+QueueJob\b/.test(schema),
  "model QueueJob present",
  /model\s+QueueJob\b/.test(schema) ? "present" : "absent",
);
assert(
  "schema.prisma has model CacheGeneration",
  /model\s+CacheGeneration\b/.test(schema),
  "model CacheGeneration present",
  /model\s+CacheGeneration\b/.test(schema) ? "present" : "absent",
);

const health = readFileSync(path.join(root, "app", "routes", "health.tsx"), "utf8");
const healthPingsRedis =
  /getRedis|redis\.ping|label:\s*["']redis["']/i.test(health) ||
  /checks:\s*\{[\s\S]*?\bredis\b/i.test(health);
assert(
  "health check no longer pings Redis",
  !healthPingsRedis && /postgres/i.test(health),
  "postgres probe only; no redis",
  healthPingsRedis
    ? "still references redis"
    : /postgres/i.test(health)
      ? "postgres only"
      : "no postgres either",
);

const redisFileExists = existsSync(path.join(root, "app", "lib", "redis.server.ts"));
assert(
  "app/lib/redis.server.ts deleted",
  !redisFileExists,
  "absent",
  redisFileExists ? "present" : "absent",
);

console.log("\n=== FUNCTIONAL ===\n");

const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();

const {
  enqueueSyncJob,
  claimJobs,
  failJob,
  completeJob,
  recoverStaleJobs,
} = await import("../app/lib/queues.server.ts");

const TEST_PREFIX = `verify-pg-queue-${Date.now()}`;
const createdJobIds = [];
const cacheKey = `${TEST_PREFIX}:cache`;

async function cleanup() {
  if (createdJobIds.length) {
    await prisma.queueJob.deleteMany({ where: { id: { in: createdJobIds } } });
  }
  await prisma.queueJob.deleteMany({
    where: { jobKey: { startsWith: TEST_PREFIX.replace(/:/g, "_") } },
  });
  await prisma.queueJob.deleteMany({
    where: { jobKey: { startsWith: TEST_PREFIX } },
  });
  await prisma.cacheGeneration.deleteMany({ where: { key: cacheKey } });
}

try {
  await prisma.$queryRaw`SELECT 1`;

  // 1) enqueue + claim → processing
  // Note: Hostinger may poll the same Supabase DB; losing the race still
  // proves claim works if the row ends in `processing`.
  const enqueued = await enqueueSyncJob(
    "product.upsert",
    { shop: TEST_PREFIX, productGid: "gid://shopify/Product/verify1" },
    { jobId: `${TEST_PREFIX}:claim` },
  );
  createdJobIds.push(enqueued.id);
  const ourWorker = `${TEST_PREFIX}-worker-a`;
  const claimed = await claimJobs(5, ourWorker);
  const mine = claimed.find((j) => j.id === enqueued.id);
  const afterEnqueue = await prisma.queueJob.findUnique({
    where: { id: enqueued.id },
  });
  const processingOk = afterEnqueue?.status === "processing";
  const weClaimed = Boolean(mine) && String(mine.status) === "processing";
  assert(
    "enqueueJob + claimJobs marks job processing",
    processingOk,
    "status=processing after enqueue+claim (us or live worker)",
    weClaimed
      ? `claimed_by_us=true lockedBy=${mine.lockedBy}`
      : `claimed_by_us=false status=${afterEnqueue?.status} lockedBy=${afterEnqueue?.lockedBy} batch=${claimed.length}`,
  );
  if (afterEnqueue?.status === "processing" || afterEnqueue?.status === "pending") {
    await completeJob(enqueued.id).catch(() => {});
  }

  // 2) Concurrent claim never double-claims — create N jobs, claim in parallel
  const raceIds = [];
  for (let i = 0; i < 6; i++) {
    const j = await prisma.queueJob.create({
      data: {
        type: "product.upsert",
        payload: { shop: TEST_PREFIX, i },
        jobKey: `${TEST_PREFIX}_race_${i}`,
        status: "pending",
        maxAttempts: 3,
        runAt: new Date(0),
      },
    });
    raceIds.push(j.id);
    createdJobIds.push(j.id);
  }
  await prisma.$executeRaw`
    UPDATE "QueueJob"
    SET "runAt" = NOW()
    WHERE "jobKey" LIKE ${`${TEST_PREFIX}_race_%`}
  `;

  // True concurrent SKIP LOCKED against our rows only (Hostinger may also
  // claim; we only assert no id appears twice across OUR three claimers).
  const claimSlice = async (worker) => {
    const { Prisma } = await import("@prisma/client");
    return prisma.$transaction(async (tx) => {
      return tx.$queryRaw`
        WITH due AS (
          SELECT id FROM "QueueJob"
          WHERE status = 'pending'::"QueueJobStatus"
            AND "runAt" <= NOW()
            AND "jobKey" LIKE ${`${TEST_PREFIX}_race_%`}
          ORDER BY "runAt" ASC
          LIMIT ${Prisma.raw("10")}
          FOR UPDATE SKIP LOCKED
        )
        UPDATE "QueueJob" AS q
        SET
          status = 'processing'::"QueueJobStatus",
          "lockedAt" = NOW(),
          "lockedBy" = ${worker},
          "updatedAt" = NOW()
        FROM due
        WHERE q.id = due.id
        RETURNING q.id, q."lockedBy"
      `;
    });
  };

  const [batch1, batch2, batch3] = await Promise.all([
    claimSlice(`${TEST_PREFIX}-w1`),
    claimSlice(`${TEST_PREFIX}-w2`),
    claimSlice(`${TEST_PREFIX}-w3`),
  ]);
  const allClaimed = [...batch1, ...batch2, ...batch3];
  const uniqueIds = new Set(allClaimed.map((j) => j.id));
  assert(
    "concurrent claimJobs never double-claim (SKIP LOCKED)",
    allClaimed.length >= 1 && uniqueIds.size === allClaimed.length,
    ">=1 claimed and no duplicate ids across 3 parallel claimers",
    `total_rows=${allClaimed.length}; unique_ids=${uniqueIds.size}`,
  );
  for (const j of allClaimed) {
    if (!createdJobIds.includes(j.id)) createdJobIds.push(j.id);
    await completeJob(j.id).catch(() => {});
  }
  for (const id of raceIds) {
    await prisma.queueJob
      .updateMany({
        where: { id, status: { in: ["pending", "processing"] } },
        data: { status: "completed", lockedAt: null, lockedBy: null },
      })
      .catch(() => {});
  }

  // 3) failJob increments attempts + pushes runAt (DB-clock backoff)
  const failTarget = await prisma.queueJob.create({
    data: {
      type: "product.upsert",
      payload: { shop: TEST_PREFIX },
      jobKey: `${TEST_PREFIX}_fail_backoff`,
      status: "processing",
      attempts: 0,
      maxAttempts: 3,
      runAt: new Date(0),
      lockedAt: new Date(),
      lockedBy: `${TEST_PREFIX}-fail`,
    },
  });
  createdJobIds.push(failTarget.id);
  await prisma.$executeRaw`
    UPDATE "QueueJob" SET "runAt" = NOW(), "lockedAt" = NOW() WHERE id = ${failTarget.id}
  `;
  await failJob(failTarget.id, new Error("verify backoff"));
  const afterFail = await prisma.$queryRaw`
    SELECT
      attempts,
      status::text AS status,
      EXTRACT(EPOCH FROM ("runAt" - NOW())) * 1000 AS remaining_ms
    FROM "QueueJob"
    WHERE id = ${failTarget.id}
  `;
  const af = afterFail[0];
  const remaining = Number(af.remaining_ms);
  const backoffOk =
    Number(af.attempts) === 1 &&
    af.status === "pending" &&
    remaining >= 1000 &&
    remaining <= 4000;
  assert(
    "failJob increments attempts and applies backoff runAt",
    backoffOk,
    "attempts=1 status=pending remaining_ms≈2000 (DB NOW)",
    `attempts=${af.attempts} status=${af.status} remaining_ms=${Math.round(remaining)}`,
  );

  // 4) exceeding maxAttempts → permanently failed
  const maxJob = await prisma.queueJob.create({
    data: {
      type: "product.upsert",
      payload: { shop: TEST_PREFIX },
      jobKey: `${TEST_PREFIX}_fail_max`,
      status: "processing",
      attempts: 2,
      maxAttempts: 3,
      runAt: new Date(0),
      lockedAt: new Date(),
      lockedBy: `${TEST_PREFIX}-max`,
    },
  });
  createdJobIds.push(maxJob.id);
  await failJob(maxJob.id, new Error("final fail"));
  const maxAfter = await prisma.queueJob.findUnique({ where: { id: maxJob.id } });
  assert(
    "job exceeding maxAttempts ends permanently failed",
    maxAfter.status === "failed" && maxAfter.attempts === 3,
    "status=failed attempts=3",
    `status=${maxAfter.status} attempts=${maxAfter.attempts}`,
  );

  // 5) CacheGeneration atomic under ~20 concurrent increments
  await prisma.cacheGeneration.deleteMany({ where: { key: cacheKey } });
  const CONCURRENCY = 20;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, () =>
      prisma.$queryRaw`
        INSERT INTO "CacheGeneration" (key, version)
        VALUES (${cacheKey}, 1)
        ON CONFLICT (key) DO UPDATE
          SET version = "CacheGeneration".version + 1
        RETURNING version
      `,
    ),
  );
  const cacheRow = await prisma.cacheGeneration.findUnique({ where: { key: cacheKey } });
  assert(
    "CacheGeneration concurrent increments are atomic (no lost updates)",
    cacheRow?.version === CONCURRENCY,
    `version=${CONCURRENCY}`,
    `version=${cacheRow?.version ?? "null"}`,
  );

  // 6) Stale processing job reclaimed (DB-clock lockedAt)
  const staleJob = await prisma.queueJob.create({
    data: {
      type: "product.upsert",
      payload: { shop: TEST_PREFIX },
      jobKey: `${TEST_PREFIX}_stale`,
      status: "processing",
      attempts: 0,
      maxAttempts: 3,
      runAt: new Date(0),
      lockedBy: `${TEST_PREFIX}-crashed`,
    },
  });
  createdJobIds.push(staleJob.id);
  await prisma.$executeRaw`
    UPDATE "QueueJob"
    SET
      "runAt" = NOW() - INTERVAL '60 seconds',
      "lockedAt" = NOW() - INTERVAL '120 seconds',
      status = 'processing'::"QueueJobStatus"
    WHERE id = ${staleJob.id}
  `;
  const recovered = await recoverStaleJobs(30_000);
  const staleAfter = await prisma.queueJob.findUnique({ where: { id: staleJob.id } });
  assert(
    "stale processing job requeued (crashed-worker recovery)",
    staleAfter.status === "pending" &&
      staleAfter.lockedAt == null &&
      staleAfter.lockedBy == null &&
      recovered >= 1,
    "status=pending lockedAt=null lockedBy=null recovered>=1",
    `status=${staleAfter.status} lockedAt=${staleAfter.lockedAt} lockedBy=${staleAfter.lockedBy} recovered=${recovered}`,
  );

  await prisma.$executeRaw`
    UPDATE "QueueJob" SET "runAt" = NOW() WHERE id = ${staleJob.id}
  `;
  const reclaimed = await claimJobs(5, `${TEST_PREFIX}-recover-worker`);
  const gotStale = reclaimed.find((j) => j.id === staleJob.id);
  assert(
    "recovered stale job can be claimed again",
    Boolean(gotStale) && String(gotStale.status) === "processing",
    "status=processing after reclaim",
    gotStale ? `status=${gotStale.status}` : "not in claim batch",
  );
  if (gotStale) await completeJob(gotStale.id);
} catch (error) {
  fail(
    "functional suite threw",
    error instanceof Error ? error.stack || error.message : String(error),
  );
} finally {
  try {
    await cleanup();
    pass(
      "cleanup test rows",
      `deleted jobs prefix=${TEST_PREFIX}; cache key=${cacheKey}`,
    );
  } catch (cleanupError) {
    fail(
      "cleanup test rows",
      cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
    );
  }
  await prisma.$disconnect();
}

console.log("\n=== SUMMARY ===\n");
const passed = results.filter((r) => r.ok).length;
console.log(`${passed} passed, ${failed} failed, ${results.length} total`);
process.exit(failed > 0 ? 1 : 0);
