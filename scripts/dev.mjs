/**
 * `npm run dev` entry.
 *
 * Default (other developers): Shopify CLI only. They still run
 * `docker compose up -d` and `npm run worker` in other terminals.
 *
 * This machine only: gitignored `.local/dev-all.mjs` starts Postgres + Redis
 * + worker + Shopify together. That file is never committed.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const extra = process.argv.slice(2);
const localAll = path.join(root, ".local", "dev-all.mjs");
const shopifyCli = path.join(
  root,
  "node_modules",
  "@shopify",
  "cli",
  "bin",
  "run.js",
);

const child = existsSync(localAll)
  ? spawn(process.execPath, [localAll, ...extra], {
      cwd: root,
      env: process.env,
      stdio: "inherit",
    })
  : existsSync(shopifyCli)
    ? spawn(process.execPath, [shopifyCli, "app", "dev", ...extra], {
        cwd: root,
        env: process.env,
        stdio: "inherit",
      })
    : spawn("shopify", ["app", "dev", ...extra], {
        cwd: root,
        env: process.env,
        stdio: "inherit",
        shell: process.platform === "win32",
      });

child.on("exit", (code, signal) => {
  if (signal) process.exit(1);
  process.exit(code ?? 0);
});
