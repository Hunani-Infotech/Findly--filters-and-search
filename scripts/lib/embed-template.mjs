/**
 * Extract storefront template interpolator from smart-filter.js (no browser).
 * Rules must stay aligned with interpolateTemplate in the widget.
 */

function fail(message) {
  throw new Error(message);
}

export function extractBalancedBlock(src, openBraceIndex) {
  if (src[openBraceIndex] !== "{") {
    fail("extractBalancedBlock: start is not '{'");
  }
  let depth = 0;
  let inSingle = false;
  let inDouble = false;
  let inRegex = false;
  let inLineComment = false;
  let inBlockComment = false;
  for (let i = openBraceIndex; i < src.length; i++) {
    const ch = src[i];
    const next = src[i + 1];
    if (inLineComment) {
      if (ch === "\n") inLineComment = false;
      continue;
    }
    if (inBlockComment) {
      if (ch === "*" && next === "/") {
        inBlockComment = false;
        i += 1;
      }
      continue;
    }
    if (inSingle) {
      if (ch === "\\") {
        i += 1;
        continue;
      }
      if (ch === "'") inSingle = false;
      continue;
    }
    if (inDouble) {
      if (ch === "\\") {
        i += 1;
        continue;
      }
      if (ch === '"') inDouble = false;
      continue;
    }
    if (inRegex) {
      if (ch === "\\") {
        i += 1;
        continue;
      }
      if (ch === "/") inRegex = false;
      continue;
    }
    if (ch === "/" && next === "/") {
      inLineComment = true;
      i += 1;
      continue;
    }
    if (ch === "/" && next === "*") {
      inBlockComment = true;
      i += 1;
      continue;
    }
    if (ch === "'") {
      inSingle = true;
      continue;
    }
    if (ch === '"') {
      inDouble = true;
      continue;
    }
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return src.slice(openBraceIndex, i + 1);
    }
  }
  fail("unclosed brace block");
}

export function extractNamedFunction(src, name) {
  const re = new RegExp(`function\\s+${name}\\s*\\(`);
  const match = re.exec(src);
  if (!match) fail(`missing function ${name}`);
  const brace = src.indexOf("{", match.index);
  if (brace === -1) fail(`function ${name} has no body`);
  return src.slice(match.index, brace) + extractBalancedBlock(src, brace);
}

export function extractPrototypeMethod(src, name) {
  const needle = `Widget.prototype.${name} = function`;
  const idx = src.indexOf(needle);
  if (idx === -1) fail(`missing Widget.prototype.${name}`);
  const brace = src.indexOf("{", idx);
  if (brace === -1) fail(`Widget.prototype.${name} has no body`);
  return src.slice(idx, brace) + extractBalancedBlock(src, brace);
}

export function extractConstArrowOrFn(src, name) {
  const needle = `const ${name} = `;
  const idx = src.indexOf(needle);
  if (idx === -1) fail(`missing const ${name}`);
  const after = src.slice(idx + needle.length).trimStart();
  const abs = src.length - after.length;
  if (after.startsWith("(") || after.startsWith("function")) {
    const brace = src.indexOf("{", abs);
    if (brace === -1) fail(`const ${name} has no body`);
    return src.slice(idx, brace) + extractBalancedBlock(src, brace);
  }
  fail(`const ${name} is not a function`);
}

/** Copied from smart-filter.js — keep in lockstep with assertInterpolatorSourceLocked. */
export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function lookupPath(ctx, path) {
  const parts = String(path || "").split(".");
  let cur = ctx;
  for (let i = 0; i < parts.length; i++) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = cur[parts[i]];
  }
  return cur;
}

export function interpolateTemplate(tpl, ctx) {
  let out = String(tpl || "");
  out = out.replace(
    /\{\{#([\w.]+)\}\}([\s\S]*?)\{\{\/\1\}\}/g,
    function (_, key, inner) {
      let val = lookupPath(ctx, key);
      let truthy =
        val === true ||
        val === "true" ||
        val === 1 ||
        val === "1" ||
        (typeof val === "string" && val && val !== "false");
      if (val && typeof val === "object") truthy = true;
      if (!val && val !== 0) truthy = false;
      if (val === false || val === "false" || val === 0 || val === "0") {
        truthy = false;
      }
      return truthy ? interpolateTemplate(inner, ctx) : "";
    },
  );
  out = out.replace(
    /\{\{\s*([\w.]+)(\s*\|\s*raw)?\s*\}\}/g,
    function (_, key, raw) {
      const val = lookupPath(ctx, key);
      if (val == null || val === false) return "";
      if (val === true) return "true";
      const str = String(val);
      return raw ? str : escapeHtml(str);
    },
  );
  return out;
}

const SECTION_RE_SRC = String.raw`\{\{#([\w.]+)\}\}([\s\S]*?)\{\{\/\1\}\}`;
const VALUE_RE_SRC = String.raw`\{\{\s*([\w.]+)(\s*\|\s*raw)?\s*\}\}`;

export function assertInterpolatorSourceLocked(widgetSrc, failFn) {
  const fail = failFn || ((message) => {
    throw new Error(message);
  });
  if (!widgetSrc.includes("function interpolateTemplate")) {
    fail("smart-filter.js missing interpolateTemplate");
  }
  if (!widgetSrc.includes(SECTION_RE_SRC)) {
    fail("interpolateTemplate section regex drifted from {{#path}}...{{/path}}");
  }
  if (!widgetSrc.includes(VALUE_RE_SRC)) {
    fail("interpolateTemplate value regex drifted from {{path}} / {{path | raw}}");
  }
  for (const fn of ["escapeHtml", "lookupPath"]) {
    if (!widgetSrc.includes(`function ${fn}`)) {
      fail(`smart-filter.js missing ${fn}`);
    }
  }
}
