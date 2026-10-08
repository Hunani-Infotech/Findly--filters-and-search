/**
 * Single switch for local vs live Hostinger behavior.
 * Set APP_ENV=development | production in .env
 * (defaults: production when NODE_ENV=production, else development).
 * FINDLY_APP_ENV is still accepted as a legacy alias.
 */

export function resolveFindlyAppEnv(env = process.env) {
  const raw = String(env.APP_ENV || env.FINDLY_APP_ENV || "")
    .trim()
    .toLowerCase();
  if (raw === "development" || raw === "dev") return "development";
  if (raw === "production" || raw === "prod") return "production";
  return env.NODE_ENV === "production" ? "production" : "development";
}

export function isFindlyDevelopment(env = process.env) {
  return resolveFindlyAppEnv(env) === "development";
}

/** Shopify CLI --config path relative to repo root. */
export function shopifyAppConfigPath(env = process.env) {
  return isFindlyDevelopment(env)
    ? "shopify.app.development.toml"
    : "shopify.app.toml";
}
