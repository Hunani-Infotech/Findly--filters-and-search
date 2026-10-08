/**
 * `npm run dev:shopify` — picks shopify.app.development.toml when
 * APP_ENV=development (default for local).
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  resolveFindlyAppEnv,
  shopifyAppConfigPath,
} from "./findly-app-env.mjs";
import { log } from "./terminal-log.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadDotEnv() {
  const envFile = path.join(root, ".env");
  if (!existsSync(envFile)) return;
  for (const raw of readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    if (!key || key.includes(" ") || process.env[key]) continue;
    process.env[key] = line.slice(eq + 1).trim();
  }
}

loadDotEnv();
if (!process.env.APP_ENV?.trim() && !process.env.FINDLY_APP_ENV?.trim()) {
  process.env.APP_ENV = "development";
}

const config = shopifyAppConfigPath();
log.info(
  `[shopify-dev] APP_ENV=${resolveFindlyAppEnv()} → --config ${config}`,
);

const result = spawnSync(
  process.execPath,
  [
    path.join(root, "node_modules", "@shopify", "cli", "bin", "run.js"),
    "app",
    "dev",
    "--config",
    config,
    ...process.argv.slice(2),
  ],
  { cwd: root, env: process.env, stdio: "inherit" },
);

process.exit(result.status ?? 1);
