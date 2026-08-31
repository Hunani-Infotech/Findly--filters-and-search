import { PrismaClient } from "@prisma/client";
import { log } from "./lib/log.server";

declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: PrismaClient | undefined;
  // eslint-disable-next-line no-var
  var __findlyDbReady: Promise<void> | undefined;
}

/**
 * Normalize Supabase / Hostinger Postgres URLs for Prisma.
 * - Transaction pooler (:6543) needs pgbouncer=true (no prepared statements)
 * - sslmode=require for hosted Postgres
 * - connect_timeout high enough for Hostinger → distant regions (e.g. Tokyo)
 */
const CONNECT_TIMEOUT_SEC = "30";
const POOLER_CONNECTION_LIMIT = "5";
const DIRECT_CONNECTION_LIMIT = "3";
const ERROR_MESSAGE_MAX = 180;
const DB_READY_ATTEMPTS = 4;

function parsePgUrl(raw: string | undefined): URL | null {
  if (!raw?.trim()) return null;
  try {
    const normalized = raw.trim().replace(/^postgresql:/i, "http:");
    return new URL(normalized);
  } catch {
    return null;
  }
}

/** Supabase transaction pooler (:6543) only — session pooler (:5432) must not use it. */
function isTransactionPoolerPort(port: string): boolean {
  return port === "6543";
}

function withPrismaDbParams(
  raw: string | undefined,
  { pgbouncer }: { pgbouncer: boolean },
): string | undefined {
  if (!raw?.trim()) return raw;
  const url = parsePgUrl(raw);
  if (!url) return raw;
  try {
    if (pgbouncer && isTransactionPoolerPort(url.port)) {
      url.searchParams.set("pgbouncer", "true");
    }
    if (!url.searchParams.get("sslmode")) {
      url.searchParams.set("sslmode", "require");
    }
    if (!url.searchParams.get("connect_timeout")) {
      url.searchParams.set("connect_timeout", CONNECT_TIMEOUT_SEC);
    }
    // Keep Hostinger pool small; Passenger may spawn multiple processes.
    if (!url.searchParams.get("connection_limit")) {
      url.searchParams.set(
        "connection_limit",
        pgbouncer ? POOLER_CONNECTION_LIMIT : DIRECT_CONNECTION_LIMIT,
      );
    }
    return url.toString().replace(/^http:/i, "postgresql:");
  } catch {
    return raw;
  }
}

function applyDatabaseEnv() {
  const databaseUrl = withPrismaDbParams(process.env.DATABASE_URL, {
    pgbouncer: isTransactionPoolerPort(
      parsePgUrl(process.env.DATABASE_URL)?.port ?? "",
    ),
  });
  const directUrl = withPrismaDbParams(process.env.DIRECT_URL, {
    pgbouncer: false,
  });
  if (databaseUrl) process.env.DATABASE_URL = databaseUrl;
  if (directUrl) process.env.DIRECT_URL = directUrl;

  const runtime = parsePgUrl(process.env.DATABASE_URL);
  if (runtime) {
    log.info(
      `[db] runtime target ${runtime.hostname}:${runtime.port || "5432"} user=${runtime.username}`,
    );
  }
}

applyDatabaseEnv();

function createPrismaClient() {
  return new PrismaClient({
    log: ["error", "warn"],
  });
}

if (process.env.NODE_ENV !== "production") {
  if (!global.prismaGlobal) {
    global.prismaGlobal = createPrismaClient();
  }
}

const prisma = global.prismaGlobal ?? createPrismaClient();

/** Safe diagnostic for /health — never includes credentials or full URLs. */
export function summarizeDatabaseError(error: unknown): string {
  if (!(error instanceof Error)) return "unknown_error";
  const code =
    typeof error === "object" &&
    error &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string"
      ? (error as { code: string }).code
      : "";
  const message = error.message.replace(
    /postgresql:\/\/[^\s'"]+/gi,
    "[redacted-url]",
  );
  if (code) return `${code}: ${message.slice(0, ERROR_MESSAGE_MAX)}`;
  if (/timeout|timed out|ECONNREFUSED|ENOTFOUND|P1001|P1017/i.test(message)) {
    return message.slice(0, ERROR_MESSAGE_MAX);
  }
  return message.slice(0, ERROR_MESSAGE_MAX);
}

/**
 * Warm the Prisma engine + one round-trip so the first shopper request
 * does not pay cold TLS to Supabase. Retries briefly on Hostinger boot.
 */
export function ensureDatabaseReady(): Promise<void> {
  if (global.__findlyDbReady) return global.__findlyDbReady;

  global.__findlyDbReady = (async () => {
    const attempts = DB_READY_ATTEMPTS;
    let lastError: unknown;
    for (let i = 1; i <= attempts; i++) {
      const started = Date.now();
      try {
        await prisma.$connect();
        await prisma.$queryRaw`SELECT 1`;
        log.success(
          `[db] ready in ${Date.now() - started}ms (attempt ${i}/${attempts})`,
        );
        return;
      } catch (error) {
        lastError = error;
        log.warn(
          `[db] connect attempt ${i}/${attempts} failed: ${summarizeDatabaseError(error)}`,
        );
        if (i < attempts) {
          await new Promise((resolve) => setTimeout(resolve, 750 * i));
        }
      }
    }
    // Do not crash the web process — /health will stay 503 until DB is reachable.
    log.error(
      `[db] still unreachable after ${attempts} attempts: ${summarizeDatabaseError(lastError)}`,
    );
  })();

  return global.__findlyDbReady;
}

export default prisma;
