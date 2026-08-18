/**
 * C3b gate: Globo filter tree styles — vertical (left/right), horizontal (top), off-canvas.
 * Usage: node ./scripts/verify-c3b.mjs
 */
import "tsx/esm";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseWidgetPosition } from "../app/app-settings.ts";
import { log } from "./terminal-log.mjs";

function fail(message) {
  throw new Error(message);
}

function readRepo(...relParts) {
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

function assertParseWidgetPosition() {
  for (const position of ["left", "right", "top", "offcanvas"]) {
    const parsed = parseWidgetPosition(position);
    if (parsed !== position) {
      fail(
        `parseWidgetPosition(${JSON.stringify(position)}) returned ${JSON.stringify(parsed)}`,
      );
    }
  }
  const fallback = parseWidgetPosition("nope");
  if (fallback !== "left") {
    fail(
      `parseWidgetPosition("nope") returned ${JSON.stringify(fallback)}, expected "left"`,
    );
  }
  log.info('parseWidgetPosition accepts left/right/top/offcanvas; "nope" → left');
}

function assertSettingsSavePath(settingsServer) {
  if (!settingsServer.includes("offcanvas")) {
    fail("app/settings.server.ts must mention offcanvas (save path accepts it)");
  }
  log.info("settings.server.ts save path mentions offcanvas");
}

function assertLiquidSchema(liquid) {
  if (!liquid.includes("offcanvas")) {
    fail('collection-filters.liquid schema missing value "offcanvas"');
  }
  log.info('collection-filters.liquid schema includes offcanvas');
}

function assertJsPositionsAndCollapse(js) {
  if (!js.includes("POSITIONS")) {
    fail("smart-filter.js missing POSITIONS");
  }
  if (!js.includes("offcanvas")) {
    fail("smart-filter.js POSITIONS must include offcanvas");
  }
  if (!js.includes("isFacetCollapsed")) {
    fail("smart-filter.js missing isFacetCollapsed");
  }
  if (!js.includes('this.position === "top"')) {
    fail(
      'smart-filter.js must include this.position === "top" (horizontal skips collapse-by-default)',
    );
  }
  log.info("js POSITIONS includes offcanvas; isFacetCollapsed skips collapse for top");
}

function assertCssTreeStyles(css) {
  for (const sel of [".smart-filter--offcanvas", ".smart-filter--top"]) {
    if (!css.includes(sel)) {
      fail(`smart-filter.css missing ${sel}`);
    }
  }
  const desktopMedia = extractMediaBlock(
    css,
    /@media\s*\(\s*min-width:\s*750px\s*\)/,
  );
  if (!desktopMedia || !desktopMedia.includes(".smart-filter--left")) {
    fail(
      "@media (min-width: 750px) must still contain .smart-filter--left",
    );
  }
  log.info("css has offcanvas + top modifiers; desktop still has --left");
}

function assertLocalePositionOptions(localeJson) {
  let parsed;
  try {
    parsed = JSON.parse(localeJson);
  } catch (error) {
    fail(`en.default.json is not valid JSON: ${error.message}`);
  }
  const blob = JSON.stringify(parsed);
  const hasOffCanvasLabel =
    blob.includes("Off-canvas") || blob.toLowerCase().includes("offcanvas");
  if (!hasOffCanvasLabel) {
    fail("en.default.json position options missing Off-canvas or offcanvas");
  }
  log.info("locale position options include Off-canvas / offcanvas");
}

function assertWidgetPreviewLayouts(previewTsx) {
  const hasHorizontal = previewTsx.includes("Horizontal");
  const hasOffCanvas =
    previewTsx.includes("Off-canvas") || previewTsx.includes("offcanvas");
  if (!hasHorizontal) {
    fail("widget-preview.tsx LAYOUT_OPTIONS or labels missing Horizontal");
  }
  if (!hasOffCanvas) {
    fail("widget-preview.tsx LAYOUT_OPTIONS or labels missing Off-canvas");
  }
  log.info("widget-preview LAYOUT_OPTIONS include Horizontal and Off-canvas");
}

try {
  assertParseWidgetPosition();

  const settingsServer = readRepo("app", "settings.server.ts");
  const liquid = readRepo(
    "extensions",
    "smart-filter",
    "blocks",
    "collection-filters.liquid",
  );
  const js = readRepo(
    "extensions",
    "smart-filter",
    "assets",
    "smart-filter.js",
  );
  const css = readRepo(
    "extensions",
    "smart-filter",
    "assets",
    "smart-filter.css",
  );
  const localeJson = readRepo(
    "extensions",
    "smart-filter",
    "locales",
    "en.default.json",
  );
  const previewTsx = readRepo("app", "components", "widget-preview.tsx");

  assertSettingsSavePath(settingsServer);
  assertLiquidSchema(liquid);
  assertJsPositionsAndCollapse(js);
  assertCssTreeStyles(css);
  assertLocalePositionOptions(localeJson);
  assertWidgetPreviewLayouts(previewTsx);

  log.success("STEPC3B_OK vertical / horizontal / off-canvas tree styles");
} catch (error) {
  log.error(`STEPC3B_FAIL ${error.message}`);
  process.exitCode = 1;
}
