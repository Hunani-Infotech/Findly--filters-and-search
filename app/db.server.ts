import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { log } from "./lib/log.server";

declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: PrismaClient | undefined;
  // eslint-disable-next-line no-var
  var __findlyDbReady: Promise<void> | undefined;
}

/**
 * Normalize Supabase / Hostinger Postgres URLs.
 * - sslmode=require for hosted Postgres
 * - Strip Prisma-engine-only params (`pgbouncer`, `connection_limit`) before
 *   handing the URL to node-pg
 * - Transaction pooler (:6543) uses a small pg.Pool instead of Prisma's
 *   connection_limit query param
 */
const CONNECT_TIMEOUT_MS = 30_000;
const POOLER_MAX = 5;
const DIRECT_MAX = 3;
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

function toPostgresUrl(url: URL): string {
  return url.toString().replace(/^http:/i, "postgresql:");
}

function withHostedSsl(raw: string | undefined): string | undefined {
  if (!raw?.trim()) return raw;
  const url = parsePgUrl(raw);
  if (!url) return raw;
  try {
    if (!url.searchParams.get("sslmode")) {
      url.searchParams.set("sslmode", "require");
    }
    return toPostgresUrl(url);
  } catch {
    return raw;
  }
}

/** node-pg connection string: drop Prisma-engine query params. */
function pgConnectionString(raw: string | undefined): string | undefined {
  if (!raw?.trim()) return raw;
  const url = parsePgUrl(raw);
  if (!url) return raw;
  try {
    url.searchParams.delete("pgbouncer");
    url.searchParams.delete("connection_limit");
    url.searchParams.delete("connect_timeout");
    if (!url.searchParams.get("sslmode")) {
      url.searchParams.set("sslmode", "require");
    }
    return toPostgresUrl(url);
  } catch {
    return raw;
  }
}

function applyDatabaseEnv() {
  const databaseUrl = withHostedSsl(process.env.DATABASE_URL);
  const directUrl = withHostedSsl(process.env.DIRECT_URL);
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
  const connectionString = pgConnectionString(process.env.DATABASE_URL);
  if (!connectionString) {
    throw new Error("DATABASE_URL is required");
  }
  const port = parsePgUrl(connectionString)?.port ?? "";
  const adapter = new PrismaPg({
    connectionString,
    max: isTransactionPoolerPort(port) ? POOLER_MAX : DIRECT_MAX,
    connectionTimeoutMillis: CONNECT_TIMEOUT_MS,
  });
  return new PrismaClient({
    adapter,
    log: ["error", "warn"],
  });
}

if (!global.prismaGlobal) {
  global.prismaGlobal = createPrismaClient();
}

const prisma = global.prismaGlobal;

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
  if (
    /timeout|timed out|ECONNREFUSED|ENOTFOUND|P1001|P1017|timer has gone away/i.test(
      message,
    )
  ) {
    return message.slice(0, ERROR_MESSAGE_MAX);
  }
  return message.slice(0, ERROR_MESSAGE_MAX);
}

/**
 * Warm one round-trip so the first shopper request does not pay cold TLS
 * to Supabase. Retries briefly on Hostinger boot.
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
