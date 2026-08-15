/**
 * Step 1 gate: Postgres reachable + core tables present.
 * Usage: node ./scripts/verify-step1.mjs
 */
import { PrismaClient } from "@prisma/client";
import { log } from "./terminal-log.mjs";

const prisma = new PrismaClient();

const required = [
  "Session",
  "Shop",
  "FilterConfig",
  "MetafieldMapping",
  "SyncJob",
  "Subscription",
  "ProductFacet",
  "CollectionMembership",
  "Collection",
  "DiscoveredMetafield",
  "ComplianceRequest",
  "AppSettings",
];

try {
  await prisma.$queryRaw`SELECT 1 AS ok`;
  const rows = await prisma.$queryRaw`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename
  `;
  const tables = new Set(rows.map((r) => r.tablename));
  const missing = required.filter((t) => !tables.has(t));

  if (missing.length) {
    log.error(`STEP1_FAIL missing tables: ${missing.join(", ")}`);
    log.error("Run: npm run setup");
    process.exit(1);
  }

  log.success(`STEP1_OK postgres connected; tables: ${required.join(", ")}`);
  process.exit(0);
} catch (error) {
  log.error(`STEP1_FAIL ${error.message}`);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
