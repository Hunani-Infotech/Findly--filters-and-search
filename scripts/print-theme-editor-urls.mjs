/**
 * Print Theme Editor deep links for the configured API key + shop.
 * Usage: node ./scripts/print-theme-editor-urls.mjs [shop.myshopify.com]
 *
 * Audit #13 — click the printed collectionFilters URL; the collection template
 * should open with Collection filters ready to add as an app block.
 */
import "tsx/esm";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { log } from "./terminal-log.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function loadDotEnv() {
  try {
    const raw = readFileSync(join(ROOT, ".env"), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = value;
    }
  } catch {
    /* optional */
  }
}

loadDotEnv();

const { themeEditorUrls } = await import("../app/services/setup-progress.server.ts");

const shop =
  process.argv[2] ||
  process.env.SHOPIFY_FLAG_STORE ||
  "your-dev-store.myshopify.com";
const apiKey = process.env.SHOPIFY_API_KEY || "";

if (!apiKey) {
  log.error("SHOPIFY_API_KEY is empty — activateAppId query will be incomplete");
  process.exitCode = 1;
}

const urls = themeEditorUrls(shop, apiKey);

log.info(`shop=${shop}`);
log.info(`apiKey=${apiKey ? `${apiKey.slice(0, 6)}…` : "(empty)"}`);
log.info(`collectionFilters=${urls.collectionFilters}`);
log.info(`collectionFiltersEmbed=${urls.collectionFiltersEmbed}`);
log.info(`productSearch=${urls.productSearch}`);
log.info(`instantSearch=${urls.instantSearch}`);

if (
  apiKey &&
  !urls.collectionFilters.includes(`addAppBlockId=${apiKey}/collection-filters`)
) {
  log.error("collectionFilters URL missing addAppBlockId — FAIL");
  process.exitCode = 1;
} else if (
  apiKey &&
  !urls.collectionFiltersEmbed.includes(
    `activateAppId=${apiKey}/collection-filters-embed`,
  )
) {
  log.error("collectionFiltersEmbed URL missing activateAppId — FAIL");
  process.exitCode = 1;
} else if (apiKey) {
  log.success(
    "STEPTHEME_URL_OK template matches SHOPIFY_API_KEY + collection-filters",
  );
  log.info(
    "Manual click: open collectionFiltersEmbed URL while logged into that shop admin. Pass if App embeds opens Collection filters.",
  );
}
