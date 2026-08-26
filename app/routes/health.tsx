import prisma from "../db.server";
import { getRedis } from "../redis.server";
import { getWorkerCount } from "../workers/concurrency.server";
import { isSyncWorkerRunning } from "../workers/ensure-running.server";

function withTimeout<T>(promise: Promise<T>, ms: number, label: string) {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timeout`)), ms);
    }),
  ]);
}

async function probe(label: string, fn: () => Promise<unknown>) {
  const started = Date.now();
  try {
    await withTimeout(fn(), 2000, label);
    return { ok: true, latencyMs: Date.now() - started };
  } catch {
    return { ok: false, latencyMs: Date.now() - started };
  }
}

export const loader = async () => {
  const [postgres, redis] = await Promise.all([
    probe("postgres", () => prisma.$queryRaw`SELECT 1`),
    probe("redis", async () => {
      const pong = await getRedis().ping();
      if (pong !== "PONG") throw new Error("redis ping failed");
    }),
  ]);
  const workerRunning = isSyncWorkerRunning();
  const body = {
    ok: postgres.ok && redis.ok,
    service: "findly-smart-filters-search",
    checks: {
      postgres,
      redis,
      worker: {
        ok: workerRunning,
        mode: workerRunning ? "in-process" : "down",
        count: getWorkerCount(),
      },
    },
  };

  return new Response(JSON.stringify(body), {
    status: body.ok ? 200 : 503,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
};
