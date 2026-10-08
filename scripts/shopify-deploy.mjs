/**
 * `npm run deploy` — always uses production shopify.app.toml so Partner
 * URLs stay on Hostinger regardless of local APP_ENV.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { log } from "./terminal-log.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const config = "shopify.app.toml";

log.info(`[shopify-deploy] using --config ${config} (production)`);

const result = spawnSync(
  process.execPath,
  [
    path.join(root, "node_modules", "@shopify", "cli", "bin", "run.js"),
    "app",
    "deploy",
    "--config",
    config,
    ...process.argv.slice(2),
  ],
  { cwd: root, env: process.env, stdio: "inherit" },
);

process.exit(result.status ?? 1);
