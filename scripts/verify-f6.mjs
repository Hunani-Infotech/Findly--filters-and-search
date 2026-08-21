/**
 * F6 gate: partner re-init after Ajax grid (findlyFilterRenderCompleted,
 * Judge.me, Wishlist Hero, Integrations admin).
 * Usage: npm run verify:f6
 *
 * Static file greps only — no Prisma / Postgres.
 */
import "tsx/esm";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { log } from "./terminal-log.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function fail(message) {
  throw new Error(message);
}

function readRepo(...parts) {
  const path = join(ROOT, ...parts);
  if (!existsSync(path)) {
    fail(`missing file ${parts.join("/")}`);
  }
  return readFileSync(path, "utf8");
}

function requireAll(src, labels, fileLabel) {
  for (const label of labels) {
    if (!src.includes(label)) {
      fail(`${fileLabel} missing ${label}`);
    }
  }
}

function requireAny(src, labels, fileLabel) {
  if (!labels.some((label) => src.includes(label))) {
    fail(`${fileLabel} missing ${labels.join(" or ")}`);
  }
}

function assertStaticMarkers() {
  const filterJs = readRepo(
    "extensions",
    "smart-filter",
    "assets",
    "smart-filter.js",
  );
  requireAll(
    filterJs,
    [
      "findlyFilterRenderCompleted",
      "window.dispatchEvent",
      "jdgm.customizeBadges",
      "wishlist-hero-add-to-custom-element",
    ],
    "extensions/smart-filter/assets/smart-filter.js",
  );
  requireAny(
    filterJs,
    ["Weglot.refresh", "Weglot"],
    "extensions/smart-filter/assets/smart-filter.js",
  );
  requireAny(
    filterJs,
    ["Currency.convertAll"],
    "extensions/smart-filter/assets/smart-filter.js",
  );

  const vehicleJs = readRepo(
    "extensions",
    "smart-filter",
    "assets",
    "vehicle-finder.js",
  );
  requireAll(
    vehicleJs,
    [
      "findlyFilterRenderCompleted",
      "window.dispatchEvent",
    ],
    "extensions/smart-filter/assets/vehicle-finder.js",
  );

  const partners = readRepo("app", "partner-integrations.ts");
  requireAll(
    partners,
    [
      "findlyFilterRenderCompleted",
      "Judge.me",
      "Wishlist Hero",
    ],
    "app/partner-integrations.ts",
  );

  const admin = readRepo("app", "routes", "app.integrations.tsx");
  requireAll(
    admin,
    ["Integrations", "findlyFilterRenderCompleted"],
    "app/routes/app.integrations.tsx",
  );

  const appNav = readRepo("app", "routes", "app.tsx");
  requireAll(appNav, ["/app/integrations"], "app/routes/app.tsx");

  const docs = readRepo("docs", "partner-integrations.md");
  requireAll(
    docs,
    ["findlyFilterRenderCompleted", "smart-filter:update"],
    "docs/partner-integrations.md",
  );

  log.info("F6 static markers present");
}

try {
  assertStaticMarkers();
  log.info("STEPF6_OK");
} catch (error) {
  log.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
