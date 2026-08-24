import { spawn, type ChildProcess } from "node:child_process";
import { log } from "../log.server";

declare global {
  // eslint-disable-next-line no-var
  var __findlySyncWorker: ChildProcess | undefined;
}

/**
 * Hostinger Passenger starts `react-router-serve.cjs`, not `server.js`.
 * Spawn the BullMQ worker from the SSR bundle so it shares the Node app env
 * (DATABASE_URL, REDIS_URL, Shopify keys). Skip during `npm run build`.
 *
 * LiteSpeed sets LSNODE_CONSOLE_LOG on the running app only.
 * Set START_WORKER=1 to force (e.g. other hosts). START_WORKER=0 disables.
 */
export function ensureWorkerRunning() {
  if (process.env.START_WORKER === "0") return;
  if (process.env.FINDLY_WORKER_CHILD === "1") return;

  const lifecycle = process.env.npm_lifecycle_event ?? "";
  if (lifecycle === "build" || lifecycle === "postinstall") return;

  const passengerRuntime = Boolean(process.env.LSNODE_CONSOLE_LOG);
  const productionListen =
    process.env.NODE_ENV === "production" && Boolean(process.env.PORT);
  if (
    process.env.START_WORKER !== "1" &&
    !passengerRuntime &&
    !productionListen
  ) {
    return;
  }

  const existing = globalThis.__findlySyncWorker;
  if (existing && existing.exitCode === null && !existing.killed) return;

  log.info("[worker] starting BullMQ child process");
  const child = spawn(
    process.execPath,
    ["--import", "tsx", "app/workers/index.ts"],
    {
      stdio: "inherit",
      cwd: process.cwd(),
      env: { ...process.env, FINDLY_WORKER_CHILD: "1" },
    },
  );

  child.on("exit", (code, signal) => {
    if (signal === "SIGTERM" || signal === "SIGINT") return;
    log.error(`[worker] child exited code=${code} signal=${signal ?? ""}`);
  });

  globalThis.__findlySyncWorker = child;
}
