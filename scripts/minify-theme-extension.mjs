/**
 * Minify Theme App Extension JS and CSS assets.
 * Schema "javascript" / "stylesheet" files must stay under Shopify's 100 KB
 * AssetSizeAppBlock cap (the platform limit; Theme Check default 10 KB is a demo
 * lint threshold). Companion files loaded via Liquid asset_url are not capped.
 *
 * Usage:
 *   node ./scripts/minify-theme-extension.mjs
 *   node ./scripts/minify-theme-extension.mjs --watch
 */
import { watch } from "node:fs";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { transformWithEsbuild } from "vite";
import { log } from "./terminal-log.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const EXT_DIR = path.join(ROOT, "extensions/smart-filter");
const SHOPIFYIGNORE = path.join(EXT_DIR, ".shopifyignore");
const SCHEMA_JS_LIMIT_BYTES = 100000;
const SCHEMA_CSS_LIMIT_BYTES = 100000;

const JOBS = [
  {
    src: path.join(ROOT, "extensions/smart-filter/assets/smart-filter-privacy.js"),
    out: path.join(
      ROOT,
      "extensions/smart-filter/assets/smart-filter-privacy.min.js",
    ),
    banner: "/* generated from smart-filter-privacy.js — do not edit */\n",
  },
  {
    src: path.join(ROOT, "extensions/smart-filter/assets/smart-filter-dom.js"),
    out: path.join(ROOT, "extensions/smart-filter/assets/smart-filter-dom.min.js"),
    banner: "/* generated from smart-filter-dom.js — do not edit */\n",
  },
  {
    src: path.join(ROOT, "extensions/smart-filter/assets/smart-filter.js"),
    out: path.join(ROOT, "extensions/smart-filter/assets/smart-filter.min.js"),
    banner: "/* generated from smart-filter.js — do not edit */\n",
    limitBytes: SCHEMA_JS_LIMIT_BYTES,
  },
  {
    src: path.join(ROOT, "extensions/smart-filter/assets/smart-filter-grid.js"),
    out: path.join(
      ROOT,
      "extensions/smart-filter/assets/smart-filter-grid.min.js",
    ),
    banner: "/* generated from smart-filter-grid.js — do not edit */\n",
  },
  {
    src: path.join(ROOT, "extensions/smart-filter/assets/smart-filter-pager.js"),
    out: path.join(
      ROOT,
      "extensions/smart-filter/assets/smart-filter-pager.min.js",
    ),
    banner: "/* generated from smart-filter-pager.js — do not edit */\n",
  },
  {
    src: path.join(ROOT, "extensions/smart-filter/assets/smart-filter-theme.js"),
    out: path.join(
      ROOT,
      "extensions/smart-filter/assets/smart-filter-theme.min.js",
    ),
    banner: "/* generated from smart-filter-theme.js — do not edit */\n",
  },
  {
    src: path.join(ROOT, "extensions/smart-filter/assets/smart-filter-fetch.js"),
    out: path.join(
      ROOT,
      "extensions/smart-filter/assets/smart-filter-fetch.min.js",
    ),
    banner: "/* generated from smart-filter-fetch.js — do not edit */\n",
  },
  {
    src: path.join(ROOT, "extensions/smart-filter/assets/smart-filter-boot.js"),
    out: path.join(
      ROOT,
      "extensions/smart-filter/assets/smart-filter-boot.min.js",
    ),
    banner: "/* generated from smart-filter-boot.js — do not edit */\n",
  },
  {
    src: path.join(ROOT, "extensions/smart-filter/assets/smart-filter-perf.js"),
    out: path.join(
      ROOT,
      "extensions/smart-filter/assets/smart-filter-perf.min.js",
    ),
    banner: "/* generated from smart-filter-perf.js — do not edit */\n",
  },
  {
    src: path.join(ROOT, "extensions/smart-filter/assets/instant-search.js"),
    out: path.join(
      ROOT,
      "extensions/smart-filter/assets/instant-search.min.js",
    ),
    banner: "/* generated from instant-search.js — do not edit */\n",
  },
  {
    src: path.join(
      ROOT,
      "extensions/smart-filter/assets/smart-filter-search.js",
    ),
    out: path.join(
      ROOT,
      "extensions/smart-filter/assets/smart-filter-search.min.js",
    ),
    banner: "/* generated from smart-filter-search.js — do not edit */\n",
  },
  {
    src: path.join(ROOT, "extensions/smart-filter/assets/smart-filter.css"),
    out: path.join(ROOT, "extensions/smart-filter/assets/smart-filter.min.css"),
    banner: "/* generated from smart-filter.css — do not edit */\n",
    limitBytes: SCHEMA_CSS_LIMIT_BYTES,
  },
  {
    src: path.join(ROOT, "extensions/smart-filter/assets/smart-filter-check.css"),
    out: path.join(
      ROOT,
      "extensions/smart-filter/assets/smart-filter-check.min.css",
    ),
    banner: "/* generated from smart-filter-check.css — do not edit */\n",
  },
  {
    src: path.join(ROOT, "extensions/smart-filter/assets/smart-filter-ui.css"),
    out: path.join(
      ROOT,
      "extensions/smart-filter/assets/smart-filter-ui.min.css",
    ),
    banner: "/* generated from smart-filter-ui.css — do not edit */\n",
  },
  {
    src: path.join(ROOT, "extensions/smart-filter/assets/instant-search.css"),
    out: path.join(
      ROOT,
      "extensions/smart-filter/assets/instant-search.min.css",
    ),
    banner: "/* generated from instant-search.css — do not edit */\n",
  },
  {
    src: path.join(
      ROOT,
      "extensions/smart-filter/assets/smart-filter-search.css",
    ),
    out: path.join(
      ROOT,
      "extensions/smart-filter/assets/smart-filter-search.min.css",
    ),
    banner: "/* generated from smart-filter-search.css — do not edit */\n",
  },
];

function posixRel(filePath) {
  return path.relative(EXT_DIR, filePath).replaceAll("\\", "/");
}

async function assertSourcesIgnoredFromDeploy() {
  const raw = await readFile(SHOPIFYIGNORE, "utf8");
  const patterns = new Set(
    raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith("#")),
  );
  const missing = [];
  for (const job of JOBS) {
    const srcRel = posixRel(job.src);
    if (!patterns.has(srcRel)) missing.push(srcRel);
    const outRel = posixRel(job.out);
    if (patterns.has(outRel)) {
      throw new Error(
        `.shopifyignore must not exclude deployed ${outRel}`,
      );
    }
  }
  const assetNames = await readdir(path.join(EXT_DIR, "assets"));
  for (const name of assetNames) {
    if (!/\.(js|css)$/i.test(name) || /\.min\.(js|css)$/i.test(name)) continue;
    const rel = `assets/${name}`;
    if (!patterns.has(rel)) missing.push(rel);
  }
  if (missing.length) {
    throw new Error(
      `.shopifyignore must list unminified sources so they do not ship to merchant CDN: ${[...new Set(missing)].join(", ")}`,
    );
  }
}

export async function minifyThemeExtension() {
  await assertSourcesIgnoredFromDeploy();
  for (const job of JOBS) {
    await minifyJob(job);
  }
}

async function minifyJob(job) {
  const source = await readFile(job.src, "utf8");
  const loader = job.src.endsWith(".css") ? "css" : "js";
  const result = await transformWithEsbuild(source, job.src, {
    minify: true,
    loader,
    legalComments: "none",
  });
  const output = job.banner + result.code;
  const bytes = Buffer.byteLength(output);
  const relOut = path.relative(ROOT, job.out);
  if (job.limitBytes != null && bytes > job.limitBytes) {
    throw new Error(
      `${relOut} is ${bytes} B after minify (limit ${job.limitBytes} B). Split the widget before deploying.`,
    );
  }
  await writeFile(job.out, output, "utf8");
  const srcBytes = Buffer.byteLength(source);
  log.success(
    `${path.basename(job.src)} ${srcBytes} B → ${path.basename(job.out)} ${bytes} B`,
  );
}

function debounce(fn, ms) {
  let timer = null;
  return () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn();
    }, ms);
  };
}

async function watchJobs() {
  log.info("Watching theme extension JS/CSS for minify…");
  for (const job of JOBS) {
    const rebuild = debounce(() => {
      void minifyJob(job).catch((error) => {
        log.error(error instanceof Error ? error.message : String(error));
      });
    }, 120);
    watch(path.dirname(job.src), { persistent: true }, (_event, filename) => {
      if (filename === path.basename(job.src)) rebuild();
    });
  }
  await new Promise(() => {});
}

function isMainModule() {
  const entry = process.argv[1];
  if (!entry) return false;
  return (
    path.normalize(path.resolve(entry)).toLowerCase() ===
    path.normalize(fileURLToPath(import.meta.url)).toLowerCase()
  );
}

if (isMainModule()) {
  const watchMode = process.argv.includes("--watch");
  try {
    await minifyThemeExtension();
    if (watchMode) await watchJobs();
  } catch (error) {
    log.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
