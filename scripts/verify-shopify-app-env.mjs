/**
 * Smoke-check APP_ENV → Shopify config selection and TOML twin drift.
 * Exit 0 = OK.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  resolveFindlyAppEnv,
  shopifyAppConfigPath,
} from "./findly-app-env.mjs";
import { log } from "./terminal-log.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function stripNoise(toml) {
  return toml
    .split(/\r?\n/)
    .filter((line) => {
      const t = line.trim();
      if (!t || t.startsWith("#")) return false;
      if (/^automatically_update_urls_on_dev\s*=/.test(t)) return false;
      return true;
    })
    .join("\n");
}

const prod = readFileSync(path.join(root, "shopify.app.toml"), "utf8");
const dev = readFileSync(
  path.join(root, "shopify.app.development.toml"),
  "utf8",
);

if (!/automatically_update_urls_on_dev\s*=\s*false/.test(prod)) {
  log.error("shopify.app.toml must keep automatically_update_urls_on_dev = false");
  process.exit(1);
}
if (!/automatically_update_urls_on_dev\s*=\s*true/.test(dev)) {
  log.error(
    "shopify.app.development.toml must keep automatically_update_urls_on_dev = true",
  );
  process.exit(1);
}

const a = stripNoise(prod);
const b = stripNoise(dev);
if (a !== b) {
  log.error(
    "shopify.app.toml and shopify.app.development.toml drifted (beyond Update URLs flag)",
  );
  process.exit(1);
}

const cases = [
  [{}, "development", "shopify.app.development.toml"],
  [{ APP_ENV: "production" }, "production", "shopify.app.toml"],
  [{ NODE_ENV: "production" }, "production", "shopify.app.toml"],
  [{ APP_ENV: "development" }, "development", "shopify.app.development.toml"],
];
for (const [env, expectEnv, expectConfig] of cases) {
  const gotEnv = resolveFindlyAppEnv(env);
  const gotConfig = shopifyAppConfigPath(env);
  if (gotEnv !== expectEnv || gotConfig !== expectConfig) {
    log.error(
      `APP_ENV case ${JSON.stringify(env)} → ${gotEnv}/${gotConfig}, expected ${expectEnv}/${expectConfig}`,
    );
    process.exit(1);
  }
}

log.success("APP_ENV / Shopify config OK");
process.exit(0);
