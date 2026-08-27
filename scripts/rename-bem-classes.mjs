/**
 * One-shot BEM `__` → purpose-based class rename.
 * Skips Polaris, third-party, and external theme integration selectors.
 * Does not touch .min.js (regenerate via theme:minify).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** External theme / Polaris / framework selectors — never rename */
const KEEP = new Set([
  "Polaris-Layout__Section",
  "Polaris-Layout__Section--oneThird",
  "Polaris-TextField__Input",
  "Polaris-Button",
  "card__badge",
  "card__content",
  "card__details",
  "card__heading",
  "card__information",
  "card__inner",
  "card__media",
  "card__text",
  "card__title",
  "collection__content",
  "collection__products",
  "collection-grid__wrapper",
  "CollectionInner__Products",
  "facet-filters__field",
  "facet-filters__sort",
  "facets__disclosure",
  "facets__form",
  "facets__form-wrapper",
  "facets__item",
  "facets__panel",
  "facets__product-count",
  "facets__wrapper",
  "filter-count-bubble__text",
  "filters-toolbar__product-count",
  "grid__item",
  "grid-view-item__link",
  "header__search",
  "mobile-facets__wrapper",
  "pagination__inner",
  "pagination__item--next",
  "pagination__item--prev",
  "pagination__list",
  "pagination__load-more",
  "predictive-search__results",
  "product__item",
  "product-block__image",
  "product-card__badge",
  "product-card__content",
  "product-card__image",
  "product-card__info",
  "product-card__price",
  "product-card__title",
  "product-card__wrapper",
  "product-count__text",
  "product-grid__item",
  "product-item__info",
  "product-list__inner",
  "sorting-filter__container",
  "toolbar__product-count",
]);

/** State BEM modifiers → standalone is-* classes */
const STATE_MODS = {
  open: "is-open",
  active: "is-active",
  dragging: "is-dragging",
  collapsed: "is-collapsed",
  empty: "is-empty",
  loading: "is-loading",
};

/**
 * Purpose-based renames. Keys are full old class names (including --modifiers).
 * Values are either a single new class, or space-separated "base is-state".
 */
function buildMap() {
  const map = new Map();

  function put(from, to) {
    if (KEEP.has(from)) return;
    if (from === to) return;
    map.set(from, to);
  }

  /** smart-filter__foo → sf-foo; smart-filter__foo--bar → sf-foo-bar or sf-foo is-* */
  function mapSmartFilter(cls) {
    const m = cls.match(/^smart-filter__(.+?)(?:--(.+))?$/);
    if (!m) return null;
    const el = m[1];
    const mod = m[2];
    const base = `sf-${el}`;
    if (!mod) return base;
    if (STATE_MODS[mod]) return `${base} ${STATE_MODS[mod]}`;
    return `${base}-${mod}`;
  }

  /** smart-filter-search__x → sf-search-x */
  function mapPrefixed(prefix, short, cls) {
    const re = new RegExp(`^${prefix}__(.+?)(?:--(.+))?$`);
    const m = cls.match(re);
    if (!m) return null;
    const el = m[1];
    const mod = m[2];
    const base = `${short}-${el}`;
    if (!mod) return base;
    if (STATE_MODS[mod]) return `${base} ${STATE_MODS[mod]}`;
    return `${base}-${mod}`;
  }

  /** findly-foo__bar → findly-foo-bar; findly-foo__bar--baz → findly-foo-bar-baz or is-* */
  function mapFindly(cls) {
    const m = cls.match(/^(findly-[a-z0-9-]+)__(.+?)(?:--(.+))?$/);
    if (!m) return null;
    const block = m[1];
    const el = m[2];
    const mod = m[3];
    const base = `${block}-${el}`;
    if (!mod) return base;
    if (STATE_MODS[mod]) return `${base} ${STATE_MODS[mod]}`;
    return `${base}-${mod}`;
  }

  /** sf-foo__bar → sf-foo-bar */
  function mapSf(cls) {
    const m = cls.match(/^(sf-[a-z0-9-]+)__(.+?)(?:--(.+))?$/);
    if (!m) return null;
    const block = m[1];
    const el = m[2];
    const mod = m[3];
    // Shorten verbose layout names
    let baseBlock = block;
    if (block === "sf-collection-layout") baseBlock = "sf-layout";
    const base = `${baseBlock}-${el}`;
    if (!mod) return base;
    if (STATE_MODS[mod]) return `${base} ${STATE_MODS[mod]}`;
    return `${base}-${mod}`;
  }

  const inventory = fs
    .readFileSync(path.join(ROOT, "_bem_classes.txt"), "utf8")
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);

  for (const cls of inventory) {
    if (KEEP.has(cls)) continue;
    if (cls.startsWith("Polaris-")) continue;

    let next =
      mapSmartFilter(cls) ||
      mapPrefixed("smart-filter-search", "sf-search", cls) ||
      mapPrefixed("smart-filter-ymm", "sf-ymm", cls) ||
      mapPrefixed("smart-filter-recs", "sf-recs", cls) ||
      mapFindly(cls) ||
      mapSf(cls);

    if (!next) {
      // Fallback: replace __ with - and --state with is-state when known
      const m = cls.match(/^(.+?)__(.+?)(?:--(.+))?$/);
      if (m) {
        const base = `${m[1]}-${m[2]}`;
        next = m[3]
          ? STATE_MODS[m[3]]
            ? `${base} ${STATE_MODS[m[3]]}`
            : `${base}-${m[3]}`
          : base;
      }
    }

    if (next) put(cls, next);
  }

  // Purpose overrides (user examples / readability)
  const overrides = {
    "smart-filter__toggle": "sf-toggle",
    "smart-filter__badge": "sf-badge",
    "smart-filter__icon": "sf-icon",
    "smart-filter__btn-text": "sf-btn-label",
    "smart-filter__panel": "sf-panel",
    "smart-filter__header": "sf-header",
    "smart-filter__backdrop": "sf-backdrop",
    "smart-filter__close": "sf-close",
    "smart-filter__facets": "sf-facets",
    "smart-filter__facet": "sf-facet",
    "smart-filter__title": "sf-title",
    "smart-filter__chips": "sf-chips",
    "smart-filter__chip": "sf-chip",
    "smart-filter__chips-slot": "sf-chips-slot",
    "smart-filter__clear-all": "sf-clear-all",
    "smart-filter__status": "sf-status",
    "smart-filter__apply-bar": "sf-apply-bar",
    "smart-filter__apply-now": "sf-apply-now",
    "sf-collection-layout__aside": "sf-layout-aside",
    "sf-collection-layout__main": "sf-layout-main",
    "sf-toolbar__search": "sf-toolbar-search",
    "sf-toolbar__actions": "sf-toolbar-actions",
    "sf-toolbar__end": "sf-toolbar-end",
  };
  for (const [k, v] of Object.entries(overrides)) put(k, v);

  return map;
}

const EXT = new Set([
  ".css",
  ".scss",
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".liquid",
  ".mjs",
  ".html",
  ".md",
]);

const SKIP_DIR = new Set([
  "node_modules",
  ".git",
  ".shopify",
  ".react-router",
  "dist",
  "build",
  ".turbo",
  "coverage",
]);

function shouldSkipFile(file) {
  const base = path.basename(file);
  if (base.endsWith(".min.js") || base.endsWith(".min.css")) return true;
  if (base === "rename-bem-classes.mjs") return true;
  if (base === "_bem_classes.txt") return true;
  const ext = path.extname(file);
  return !EXT.has(ext);
}

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIR.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (!shouldSkipFile(full)) out.push(full);
  }
  return out;
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Replace class tokens. Handles:
 * - plain class strings
 * - CSS selectors (.old → .new or .base.is-state)
 * - Combined "base base--mod" → "base is-mod" when mapped that way
 */
function applyMap(content, map, sortedKeys) {
  let next = content;
  let hits = 0;

  // First pass: paired "base base--mod" when map value has is-*
  for (const old of sortedKeys) {
    const neu = map.get(old);
    if (!neu || !neu.includes(" ")) continue;
    const [baseNew, state] = neu.split(/\s+/);
    // Infer old base by stripping --mod
    const oldBase = old.replace(/--[a-z0-9-]+$/, "");
    if (oldBase === old) continue;
    const mappedBase = map.get(oldBase) || oldBase;
    // "oldBase old" → "baseNew state"
    const pairRe = new RegExp(
      `\\b${escapeRe(oldBase)}\\s+${escapeRe(old)}\\b`,
      "g",
    );
    const before = next;
    next = next.replace(pairRe, `${mappedBase === baseNew ? baseNew : mappedBase} ${state}`);
    // Also "old oldBase" order
    const pairRe2 = new RegExp(
      `\\b${escapeRe(old)}\\s+${escapeRe(oldBase)}\\b`,
      "g",
    );
    next = next.replace(pairRe2, `${baseNew} ${state}`);
    if (next !== before) hits++;
  }

  // Second pass: CSS .old--mod → .base.is-state
  for (const old of sortedKeys) {
    const neu = map.get(old);
    if (!neu || !neu.includes(" ")) continue;
    const [baseNew, state] = neu.split(/\s+/);
    const cssRe = new RegExp(`\\.${escapeRe(old)}(?![a-zA-Z0-9_-])`, "g");
    const before = next;
    next = next.replace(cssRe, `.${baseNew}.${state}`);
    if (next !== before) hits++;
  }

  // Third pass: remaining whole-token replacements (longest first)
  for (const old of sortedKeys) {
    const neu = map.get(old);
    if (!neu) continue;
    // If neu is "base is-state" and we already converted CSS dots, still need string refs
    const re = new RegExp(`(?<![a-zA-Z0-9_-])${escapeRe(old)}(?![a-zA-Z0-9_-])`, "g");
    const before = next;
    next = next.replace(re, neu);
    if (next !== before) hits++;
  }

  return { content: next, hits };
}

function main() {
  const map = buildMap();
  const sortedKeys = [...map.keys()].sort((a, b) => b.length - a.length);

  const report = {
    totalMapped: map.size,
    kept: [...KEEP].sort(),
    renames: [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])),
    filesUpdated: [],
  };

  const files = walk(ROOT);
  for (const file of files) {
    const raw = fs.readFileSync(file, "utf8");
    // Skip files with no candidate
    if (![...map.keys()].some((k) => raw.includes(k))) continue;
    const { content, hits } = applyMap(raw, map, sortedKeys);
    if (content !== raw) {
      fs.writeFileSync(file, content, "utf8");
      report.filesUpdated.push({
        file: path.relative(ROOT, file).replace(/\\/g, "/"),
        hits,
      });
    }
  }

  const outPath = path.join(ROOT, "docs", "bem-rename-report.json");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2), "utf8");

  console.log(
    JSON.stringify(
      {
        mapped: report.totalMapped,
        kept: report.kept.length,
        filesUpdated: report.filesUpdated.length,
        report: "docs/bem-rename-report.json",
      },
      null,
      2,
    ),
  );
}

main();
