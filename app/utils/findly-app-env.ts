/**
 * Mirrors scripts/findly-app-env.mjs for app/Vite TypeScript callers.
 * APP_ENV=development | production (FINDLY_APP_ENV still accepted as alias).
 */
export type FindlyAppEnv = "development" | "production";

export function resolveFindlyAppEnv(
  env: NodeJS.ProcessEnv = process.env,
): FindlyAppEnv {
  const raw = String(env.APP_ENV || env.FINDLY_APP_ENV || "")
    .trim()
    .toLowerCase();
  if (raw === "development" || raw === "dev") return "development";
  if (raw === "production" || raw === "prod") return "production";
  return env.NODE_ENV === "production" ? "production" : "development";
}

export function isFindlyDevelopment(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return resolveFindlyAppEnv(env) === "development";
}
