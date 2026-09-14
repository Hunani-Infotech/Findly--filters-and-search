import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const prismaCli = path.join(root, "node_modules", "prisma", "build", "index.js");

function sleepMs(ms) {
  // Avoid SharedArrayBuffer — some host sandboxes throw on SAB construction.
  const sec = Math.max(1, Math.ceil(ms / 1000));
  if (process.platform === "win32") {
    spawnSync(
      "powershell",
      ["-NoProfile", "-Command", `Start-Sleep -Milliseconds ${ms}`],
      { stdio: "ignore", windowsHide: true },
    );
    return;
  }
  spawnSync("sleep", [String(sec)], { stdio: "ignore" });
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

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  // Soft-fail: Hostinger builds should still finish if Postgres is briefly down.
  runMigrateDeploy();
}
