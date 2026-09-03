import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const prismaCli = path.join(root, "node_modules", "prisma", "build", "index.js");

function sleepMs(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/** prisma migrate deploy with retries. Returns false if it still fails. */
export function runMigrateDeploy({ attempts = 5, retryMs = 3000 } = {}) {
  for (let i = 1; i <= attempts; i++) {
    console.log(`[start] prisma migrate deploy (attempt ${i}/${attempts})`);
    const result = spawnSync(process.execPath, [prismaCli, "migrate", "deploy"], {
      cwd: root,
      env: process.env,
      stdio: "inherit",
      windowsHide: true,
    });
    if ((result.status ?? 1) === 0) {
      console.log("[start] prisma migrate deploy ok");
      return true;
    }
    if (i < attempts) {
      console.error(
        `[start] prisma migrate deploy failed (status=${result.status ?? 1}); retrying`,
      );
      sleepMs(retryMs);
    }
  }
  console.error(
    "[start] prisma migrate deploy still failing; continuing",
  );
  return false;
}
