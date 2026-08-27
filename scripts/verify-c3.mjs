/**
 * C3 gate: off-canvas mobile filter drawer (UI-only, no DB).
 * Usage: node ./scripts/verify-c3.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { log } from "./terminal-log.mjs";

function fail(message) {
  throw new Error(message);
}

function readTheme(...relParts) {
  const root = path.dirname(fileURLToPath(import.meta.url));
  return fs.readFileSync(path.join(root, "..", ...relParts), "utf8");
}

function extractMediaBlock(css, queryRe) {
  const match = queryRe.exec(css);
  if (!match) return null;
  const braceStart = css.indexOf("{", match.index + match[0].length);
  if (braceStart === -1) return null;
  let depth = 0;
  for (let i = braceStart; i < css.length; i++) {
    const ch = css[i];
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return css.slice(braceStart + 1, i);
    }
  }
  return null;
}

function assertLiquidDrawerHooks(liquid) {
  const missing = [
    "data-drawer-toggle",
    "data-drawer-panel",
    "data-drawer-backdrop",
    "data-drawer-close",
  ].filter((attr) => !liquid.includes(attr));
  if (missing.length) {
    fail(
      `collection-filters.liquid missing drawer hooks: ${missing.join(", ")}`,
    );
  }
  log.info("liquid has data-drawer-toggle/panel/backdrop/close");
}

function assertJsDrawer(js) {
  if (!js.includes("is-drawer-open")) {
    fail('smart-filter.js missing is-drawer-open');
  }
  const hasOpenClose =
    js.includes("openDrawer") && js.includes("closeDrawer");
  const hasSetDrawerOpen = js.includes("setDrawerOpen");
  if (!hasOpenClose && !hasSetDrawerOpen) {
    fail(
      "smart-filter.js missing openDrawer and closeDrawer (or setDrawerOpen)",
    );
  }
  if (!js.includes("Escape")) {
    fail('smart-filter.js missing Escape key listener (Escape string)');
  }
  log.info("js has drawer open/close and Escape");
}

function assertCssDrawer(css) {
  const requiredClasses = [
    ".sf-toggle",
    ".sf-panel",
    ".sf-backdrop",
    ".is-drawer-open",
  ];
  const missingClasses = requiredClasses.filter((sel) => !css.includes(sel));
  if (missingClasses.length) {
    fail(`smart-filter.css missing ${missingClasses.join(", ")}`);
  }

  // Drawer chrome lives in the mobile max-width block (989px today; 749px legacy).
  const mobileQueries = [
    /@media\s*\(\s*max-width:\s*989px\s*\)/,
    /@media\s*\(\s*max-width:\s*749\.98px\s*\)/,
    /@media\s*\(\s*max-width:\s*749px\s*\)/,
  ];
  let drawerMedia = null;
  for (const queryRe of mobileQueries) {
    // Scan all matching media blocks until drawer markers appear.
    let searchFrom = 0;
    while (searchFrom < css.length) {
      const sliced = css.slice(searchFrom);
      const match = queryRe.exec(sliced);
      if (!match) break;
      const absoluteIndex = searchFrom + match.index;
      const block = extractMediaBlock(css.slice(absoluteIndex), queryRe);
      if (
        block &&
        [".sf-toggle", ".sf-panel", ".sf-backdrop", ".is-drawer-open"].some(
          (sel) => block.includes(sel),
        )
      ) {
        drawerMedia = block;
        break;
      }
      searchFrom = absoluteIndex + match[0].length;
    }
    if (drawerMedia) break;
  }
  if (!drawerMedia) {
    fail(
      "smart-filter.css missing a mobile max-width media query with drawer toggle/panel/backdrop/is-drawer-open rules",
    );
  }

  const desktopQuery = /@media\s*\(\s*min-width:\s*750px\s*\)/;
  let hasDesktopLeft = false;
  let desktopSearchFrom = 0;
  while (desktopSearchFrom < css.length) {
    const sliced = css.slice(desktopSearchFrom);
    const match = desktopQuery.exec(sliced);
    if (!match) break;
    const absoluteIndex = desktopSearchFrom + match.index;
    const block = extractMediaBlock(css.slice(absoluteIndex), desktopQuery);
    if (block && block.includes(".smart-filter--left")) {
      hasDesktopLeft = true;
      break;
    }
    desktopSearchFrom = absoluteIndex + match[0].length;
  }
  if (!hasDesktopLeft) {
    fail(
      "@media (min-width: 750px) must still contain .smart-filter--left (desktop unchanged)",
    );
  }

  const scopedDrawerMarkers = [
    ".smart-filter.is-drawer-open .sf-backdrop",
    ".smart-filter.is-drawer-open .sf-panel",
    ".smart-filter--offcanvas .sf-toggle",
  ];
  const missingScoped = scopedDrawerMarkers.filter((sel) => !css.includes(sel));
  if (missingScoped.length) {
    fail(
      `drawer selectors must remain scoped under .smart-filter (missing ${missingScoped.join(", ")})`,
    );
  }
  log.info("css has scoped drawer + mobile / desktop breakpoints");
}

function assertLocaleFilterLabel(localeJson) {
  let parsed;
  try {
    parsed = JSON.parse(localeJson);
  } catch (error) {
    fail(`en.default.json is not valid JSON: ${error.message}`);
  }
  const collectionFilters = parsed?.blocks?.collection_filters;
  if (!collectionFilters || typeof collectionFilters !== "object") {
    fail("en.default.json missing blocks.collection_filters");
  }
  const blob = JSON.stringify(collectionFilters);
  if (!blob.includes("Filter")) {
    fail(
      'en.default.json collection_filters missing Filter label (word "Filter")',
    );
  }
  log.info("locale collection_filters has Filter label");
}

try {
  const liquid = readTheme(
    "extensions",
    "smart-filter",
    "blocks",
    "collection-filters.liquid",
  );
  const js = readTheme(
    "extensions",
    "smart-filter",
    "assets",
    "smart-filter.js",
  );
  const css = readTheme(
    "extensions",
    "smart-filter",
    "assets",
    "smart-filter.css",
  );
  const localeJson = readTheme(
    "extensions",
    "smart-filter",
    "locales",
    "en.default.json",
  );

  assertLiquidDrawerHooks(liquid);
  assertJsDrawer(js);
  assertCssDrawer(css);
  assertLocaleFilterLabel(localeJson);

  log.success("STEPC3_OK off-canvas mobile filter drawer");
} catch (error) {
  log.error(`STEPC3_FAIL ${error.message}`);
  process.exitCode = 1;
}
