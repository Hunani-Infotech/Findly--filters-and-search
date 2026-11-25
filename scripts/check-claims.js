#!/usr/bin/env node
/**
 * Shopify App Store rule 4.3.4 claim scanner.
 * Exits 1 when a scanned file contains a banned pattern that is not allowlisted.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SKIP_DIR = new Set(["node_modules", "dist", "build", ".git", "coverage"]);
const TEXT_EXT = new Set([
  ".tsx",
  ".ts",
  ".jsx",
  ".js",
  ".liquid",
  ".json",
  ".md",
  ".toml",
  ".html",
  ".txt",
]);

const PUBLIC_ROOTS = [
  "app/routes/_index",
  "app/routes/privacy.tsx",
  "app/routes/terms.tsx",
  "app/routes/faq.tsx",
  "app/data/public-faq.ts",
  "app/components/public-shell.tsx",
  "app/components/public-faq.tsx",
  "extensions/smart-filter/locales",
  "docs/partner-listing.md",
  "listing",
];

const UI_ROOTS = [
  "app/routes",
  "app/components",
  "app/constants/plans.ts",
  "app/utils/app-settings.ts",
  "app/utils/translation-catalog.ts",
  "app/data/public-faq.ts",
  "shopify.app.toml",
  "extensions/smart-filter/locales",
  "extensions/smart-filter/blocks",
  "docs/partner-listing.md",
  "docs/mvp-guide.md",
  "listing",
  "README.md",
];

const HIGH = [
  ["built-for-shopify", /built\s+for\s+shopify/i],
  ["bfs", /\bBFS\b/],
  ["gdpr-ready", /gdpr[-\s]?ready/i],
  ["gdpr-compliant", /gdpr[-\s]?compliant/i],
  ["approved-by-shopify", /approved\s+by\s+shopify/i],
  ["certified", /\bcertified\b/i],
  ["boost-sales", /boost\s+sales/i],
  ["increase-conversions", /increase\s+conversions/i],
  ["higher-aov", /higher\s+aov/i],
  ["more-sales", /\bmore\s+sales\b/i],
  ["drive-growth", /drive\s+growth/i],
  ["x-faster", /\d+\s*x\s+faster/i],
  ["10x", /\b10x\b/i],
  ["number-one", /#1\b/],
  ["lightning", /\blightning(?:[-\s]?fast)?\b/i],
  ["flawless", /\bflawless\b/i],
  ["guarantee", /\bguarant(?:eed|ee)\b/i],
  ["unlimited", /\bunlimited\b/i],
  ["one-hundred-percent", /(?<!["'])\b100\s*%/],
  ["ai-powered", /\bAI[-\s]?powered\b/],
  ["fastest", /\bfastest\b/i],
  ["powerful", /\bpowerful\b/i],
  ["stay-fast", /stay\s+fast/i],
  ["products-faster", /\bproducts?\s+faster\b/i],
  ["find-faster", /\bfind\s+\w+\s+faster\b/i],
  ["autofill-ai", /auto-fill with AI/i],
  ["ai-word", /\bAI\b/],
  ["all-features", /\ball features\b/i],
  ["full-catalog", /\bfull catalog\b/i],
  ["instant-search", /instant\s+search/i],
  ["instant-suggestions", /instant\s+suggestions/i],
  ["search-block", /search\s+block/i],
  ["product-search-block", /product\s+search\s+block/i],
  ["ajax", /\bajax\b/i],
  ["re-init", /re-init/i],
];

const PUBLIC_ONLY = [
  ["built-for", /\bbuilt\s+for\b/i],
  ["only", /\bonly\b/i],
  ["never", /\bnever\b/i],
  ["always", /\balways\b/i],
  ["best", /\bbest\b/i],
  ["first", /\bfirst\b/i],
  ["instant", /\binstant\b/i],
  ["highest", /\bhighest\b/i],
  ["percent", /\b\d+(?:\.\d+)?\s*%/],
];

function norm(rel) {
  return rel.split(path.sep).join("/");
}

function collect(rel, acc) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) return;
  const st = fs.statSync(abs);
  if (st.isFile()) {
    acc.add(norm(rel));
    return;
  }
  const stack = [abs];
  while (stack.length) {
    const dir = stack.pop();
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      if (SKIP_DIR.has(ent.name)) continue;
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        stack.push(full);
        continue;
      }
      const ext = path.extname(ent.name);
      if (!TEXT_EXT.has(ext)) continue;
      if (ent.name.endsWith(".min.js") || ent.name.endsWith(".min.css")) continue;
      acc.add(norm(path.relative(root, full)));
    }
  }
}

function loadAllowlist() {
  const file = path.join(root, "scripts", "check-claims.allowlist.json");
  const raw = JSON.parse(fs.readFileSync(file, "utf8"));
  return Array.isArray(raw.entries) ? raw.entries : [];
}

function allowed(entries, file, patternId, line) {
  return entries.some((entry) => {
    if (entry.path !== file || entry.patternId !== patternId) return false;
    if (!entry.contains) return false;
    return line.includes(entry.contains);
  });
}

function scanFile(file, patterns, entries, hits) {
  const text = fs.readFileSync(path.join(root, file), "utf8");
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const [id, re] of patterns) {
      re.lastIndex = 0;
      if (!re.test(line)) continue;
      if (allowed(entries, file, id, line)) continue;
      hits.push({ file, line: i + 1, patternId: id, text: line.trim() });
    }
  }
}

const publicFiles = new Set();
const uiFiles = new Set();
for (const rel of PUBLIC_ROOTS) collect(rel, publicFiles);
for (const rel of UI_ROOTS) collect(rel, uiFiles);

const entries = loadAllowlist();
const hits = [];
const seen = new Set();
for (const file of uiFiles) {
  scanFile(file, HIGH, entries, hits);
  seen.add(file);
}
for (const file of publicFiles) {
  const extra = seen.has(file) ? PUBLIC_ONLY : HIGH.concat(PUBLIC_ONLY);
  scanFile(file, extra, entries, hits);
}

if (hits.length === 0) {
  console.log(
    `check:claims passed (${publicFiles.size} public files, ${uiFiles.size} UI files).`,
  );
  process.exit(0);
}

console.error(`check:claims found ${hits.length} violation(s):`);
for (const hit of hits) {
  console.error(`${hit.file}:${hit.line} [${hit.patternId}] ${hit.text}`);
}
process.exit(1);
