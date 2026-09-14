/**
 * Step 2 gate: at least one offline Session row after install.
 * Usage: node ./scripts/verify-step2.mjs
 */
import { createPrismaClient } from "./prisma-runtime.mjs";
import { log } from "./terminal-log.mjs";

const prisma = createPrismaClient();

try {
  const sessions = await prisma.session.findMany({
    where: { isOnline: false },
    select: { shop: true, scope: true, accessToken: true },
    take: 5,
  });

  if (!sessions.length) {
    log.error(
      "STEP2_FAIL no offline Session rows. Install the app via `npm run dev` on a dev store first.",
    );
    process.exit(1);
  }

  for (const s of sessions) {
    const tokenOk = Boolean(s.accessToken && s.accessToken.length > 10);
    log.info(
      `session shop=${s.shop} scope=${s.scope || "(none)"} token=${tokenOk ? "SET" : "EMPTY"}`,
    );
    if (!tokenOk) {
      log.error("STEP2_FAIL session missing accessToken");
      process.exit(1);
    }
  }

  log.success(`STEP2_OK ${sessions.length} offline session(s) persisted`);
  process.exit(0);
} catch (error) {
  log.error(`STEP2_FAIL ${error.message}`);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
