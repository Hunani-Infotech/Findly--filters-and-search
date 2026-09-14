/**
 * Prisma Client for Node scripts. Must use the pg adapter — schema engineType
 * is `client` (no Rust query engine).
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

function pgConnectionString(raw) {
  if (!raw?.trim()) return raw;
  try {
    const url = new URL(raw.trim().replace(/^postgresql:/i, "http:"));
    url.searchParams.delete("pgbouncer");
    url.searchParams.delete("connection_limit");
    url.searchParams.delete("connect_timeout");
    const host = url.hostname;
    const local = host === "localhost" || host === "127.0.0.1";
    if (!local) {
      if (!url.searchParams.get("sslmode")) {
        url.searchParams.set("sslmode", "require");
      }
      url.searchParams.set("uselibpqcompat", "true");
    }
    return url.toString().replace(/^http:/i, "postgresql:");
  } catch {
    return raw;
  }
}

export function createPrismaClient() {
  const connectionString = pgConnectionString(process.env.DATABASE_URL);
  if (!connectionString) {
    throw new Error("DATABASE_URL is required");
  }
  const adapter = new PrismaPg({
    connectionString,
    max: 3,
    connectionTimeoutMillis: 30_000,
  });
  return new PrismaClient({ adapter });
}
