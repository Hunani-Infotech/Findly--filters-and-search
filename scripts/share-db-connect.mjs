/**
 * Other developer: connect to the host PC's Postgres through Cloudflare Access TCP.
 *
 *   npm run share:db:connect
 *
 * Keep this process running. Then use DATABASE_URL on localhost (printed below).
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { log } from "./terminal-log.mjs";
import { findCloudflared, loadDotEnv } from "./share-db-lib.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
loadDotEnv(root);

const hostname =
  process.env.SHARE_DB_HOSTNAME?.trim() || "appdb.hunaniinfotech.com";
const localPort = process.env.SHARE_DB_LOCAL_PORT?.trim() || "15432";
const cloudflared = findCloudflared();

if (!cloudflared) {
  log.error(
    "cloudflared was not found. Install Cloudflare's cloudflared, then retry.",
  );
  process.exit(1);
}

log.info(`Opening Cloudflare Access TCP to ${hostname} → 127.0.0.1:${localPort}`);
log.info("Keep this window open. Ctrl+C closes the connection.");
console.log("");
log.info("After this stays running, set YOUR .env to:");
console.log(
  `DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:${localPort}/smart_filter?schema=public`,
);
console.log("");

const child = spawn(
  cloudflared,
  ["access", "tcp", "--hostname", hostname, "--url", `127.0.0.1:${localPort}`],
  {
    cwd: root,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
    env: process.env,
  },
);

child.stdout.on("data", (buf) => process.stdout.write(`[tunnel] ${buf}`));
child.stderr.on("data", (buf) => process.stderr.write(`[tunnel] ${buf}`));
child.on("error", (error) => {
  log.error(`Could not start cloudflared (${error.code || error.message}).`);
  process.exit(1);
});
child.on("exit", (code, signal) => {
  log.error(`cloudflared access exited code=${code ?? "null"} signal=${signal || ""}`);
  process.exit(code || 1);
});
