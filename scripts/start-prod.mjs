/**
 * `npm start` — production: web (foreground) + dedicated worker sibling.
 *
 * Web: `node server.js` with START_WORKER=0 so the in-process poller stays off.
 * Worker: same as `npm run worker:prod` (`node --import tsx app/workers/index.ts`).
 */
import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runMigrateDeploy } from "./run-migrate-deploy.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const isWin = process.platform === "win32";
const node = process.execPath;

let shuttingDown = false;
let web;
let worker;
let workerRestarted = false;

function spawnWeb() {
  return spawn(node, ["server.js"], {
    cwd: root,
    env: {
      ...process.env,
      START_WORKER: "0",
      FINDLY_MIGRATIONS_RAN: "1",
    },
    stdio: "inherit",
    windowsHide: false,
  });
}

function spawnWorker() {
  return spawn(node, ["--import", "tsx", "app/workers/index.ts"], {
    cwd: root,
    env: { ...process.env },
    stdio: "inherit",
    windowsHide: true,
  });
}

function killTree(child) {
  if (!child?.pid || child.killed) return;
  if (isWin) {
    spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
      stdio: "ignore",
      windowsHide: true,
    });
    return;
  }
  try {
    child.kill("SIGTERM");
  } catch {
    /* already gone */
  }
}

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  killTree(worker);
  killTree(web);
  setTimeout(() => process.exit(code), 400);
}

function attachWorker(child) {
  worker = child;
  child.on("exit", (code, signal) => {
    if (shuttingDown) return;
    const detail = `code=${code ?? "null"} signal=${signal || ""}`;
    console.error(`[start] worker exited unexpectedly ${detail}`);
    if (!workerRestarted) {
      workerRestarted = true;
      console.error("[start] restarting worker once");
      attachWorker(spawnWorker());
      return;
    }
    console.error(
      "[start] worker not restarted again; web continues (jobs remain in Postgres)",
    );
  });
}

runMigrateDeploy();

web = spawnWeb();
attachWorker(spawnWorker());

web.on("exit", (code, signal) => {
  if (shuttingDown) return;
  console.error(
    `[start] web exited code=${code ?? "null"} signal=${signal || ""}`,
  );
  shuttingDown = true;
  killTree(worker);
  process.exit(code ?? (signal ? 1 : 0));
});

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
