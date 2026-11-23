import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const SKIP_DIRS = new Set(["node_modules", ".git", "build", "dist", "coverage"]);
const DROPPER_NAMES = new Set(["init", "api.js"]);
/** Fake ESLint dropper paths — not real ESLint config filenames. */
const DROPPER_REL_PATHS = new Set([
  ".vscode/eslint",
  ".vscode/eslint.js",
  ".vscode/eslint.cjs",
  ".vscode/eslint.mjs",
]);
const SKIP_CONTENT_EXTS = new Set([
  ".otf",
  ".ttf",
  ".woff",
  ".woff2",
  ".eot",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".ico",
  ".pdf",
  ".zip",
  ".wasm",
  ".map",
  ".mp3",
  ".mp4",
  ".webm",
]);

// Keep these split so this file does not contain the loader strings it rejects.
const MARKERS = [
  ["node init", " &&"].join(""),
  ["node api.js", " &&"].join(""),
  ["global.i = ", "'A10-"].join(""),
  ["__0x", "f6f5f"].join(""),
  ["eval(", "atob("].join(""),
];

function shouldScanContent(filePath, data) {
  const ext = path.extname(filePath).toLowerCase();
  if (SKIP_CONTENT_EXTS.has(ext)) return false;
  // Skip binaries (null byte) — short ASCII IoCs false-positive in fonts/images.
  if (data.includes(0)) return false;
  return true;
}

export async function findSupplyChainThreats(start = root) {
  const hits = [];
  await walk(start, start, hits);
  return hits;
}

async function walk(dir, start, hits) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (error) {
    if (error && (error.code === "ENOENT" || error.code === "EACCES")) return;
    throw error;
  }

  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      await walk(full, start, hits);
      continue;
    }
    if (!entry.isFile()) continue;

    const rel = path.relative(start, full).split(path.sep).join("/");
    if (DROPPER_NAMES.has(entry.name) || DROPPER_REL_PATHS.has(rel)) {
      hits.push({ file: rel, reason: "dropper filename" });
    }

    let data;
    try {
      data = await readFile(full);
    } catch (error) {
      if (error && error.code === "EACCES") continue;
      throw error;
    }

    if (!shouldScanContent(full, data)) continue;
    const text = data.toString("utf8");
    if (MARKERS.some((marker) => text.includes(marker))) {
      hits.push({ file: rel, reason: "loader marker" });
    }
  }
}

async function main() {
  const hits = await findSupplyChainThreats();
  if (hits.length === 0) {
    console.log("Supply-chain check passed");
    return;
  }

  console.error("Supply-chain check failed");
  for (const hit of hits) {
    console.error(`- ${hit.file}: ${hit.reason}`);
  }
  process.exitCode = 1;
}

const entry = process.argv[1];
if (entry && import.meta.url === pathToFileURL(entry).href) {
  await main();
}
