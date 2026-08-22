/**
 * Minify Theme App Extension JS assets.
 * Schema "javascript" files must stay under Shopify's 100 KB AssetSizeAppBlockJavaScript cap;
 * companion files loaded via Liquid asset_url (e.g. smart-filter-grid.min.js) are not capped here.
 *
 * Usage:
 *   node ./scripts/minify-theme-extension.mjs
 *   node ./scripts/minify-theme-extension.mjs --watch
 */
import { watch } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { transformWithEsbuild } from "vite";
import { log } from "./terminal-log.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCHEMA_JS_LIMIT_BYTES = 100000;

const JOBS = [
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
];

export async function minifyThemeExtension() {
  for (const job of JOBS) {
    await minifyJob(job);
  }
}

async function minifyJob(job) {
  const source = await readFile(job.src, "utf8");
  const result = await transformWithEsbuild(source, job.src, {
    minify: true,
    loader: "js",
    legalComments: "none",
  });
  const output = job.banner + result.code;
  const bytes = Buffer.byteLength(output);
  const relOut = path.relative(ROOT, job.out);
  if (job.limitBytes != null && bytes >= job.limitBytes) {
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
  log.info("Watching theme extension JS for minify…");
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
