import type { LoaderFunctionArgs } from "react-router";
import { timingSafeEqual } from "node:crypto";
import prisma, { summarizeDatabaseError } from "../db.server";
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

async function probe(
  label: string,
  fn: () => Promise<unknown>,
  ms: number,
): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
  const started = Date.now();
  try {
    await withTimeout(fn(), ms, label);
    return { ok: true, latencyMs: Date.now() - started };
  } catch (error) {
    return {
      ok: false,
      latencyMs: Date.now() - started,
      error: summarizeDatabaseError(error),
    };
  }
}

function tokenMatches(expected: string, provided: string | null): boolean {
  if (!provided) return false;
  try {
    const left = Buffer.from(expected, "utf8");
    const right = Buffer.from(provided, "utf8");
    if (left.length !== right.length) return false;
    return timingSafeEqual(left, right);
  } catch {
    return false;
  }
}

const HEALTH_PROBE_CACHE_MS = 5_000;

type ProbeResult = Awaited<ReturnType<typeof probe>>;
let cachedProbes: {
  expires: number;
  postgres: ProbeResult;
} | null = null;

async function getCachedProbes() {
  if (cachedProbes && cachedProbes.expires > Date.now()) {
    return cachedProbes;
  }
  const postgres = await probe(
    "postgres",
    async () => {
      await prisma.$connect();
      await prisma.$queryRaw`SELECT 1`;
    },
    15_000,
  );
  cachedProbes = {
    expires: Date.now() + HEALTH_PROBE_CACHE_MS,
    postgres,
  };
  return cachedProbes;
}

/**
 * Load balancers get `{ ok }` only. Detailed postgres/worker probes require
 * HEALTH_CHECK_TOKEN via `X-Health-Token` or `?token=`.
 * Unauthenticated details are development-only (unset NODE_ENV is not treated as dev).
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { postgres } = await getCachedProbes();
  const workerRunning = isSyncWorkerRunning();
  const ok = postgres.ok;

  const expected = process.env.HEALTH_CHECK_TOKEN?.trim() || "";
  const provided =
    request.headers.get("x-health-token") ||
    new URL(request.url).searchParams.get("token");
  const allowDetails =
    process.env.NODE_ENV === "development" ||
    (Boolean(expected) && tokenMatches(expected, provided));

  const body = allowDetails
    ? {
        ok,
        service: "findly-smart-filters-search",
        checks: {
          postgres,
          worker: {
            ok: workerRunning,
            mode: workerRunning ? "in-process" : "down",
            count: getWorkerCount(),
          },
        },
      }
    : { ok };

  return new Response(JSON.stringify(body), {
    status: ok ? 200 : 503,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
};
