const WIDGET_SCOPE = ".smart-filter";
const CUSTOM_CSS_MAX = 20000;
const PRODUCT_LIST_LIQUID_MAX = 20000;

const NESTED_AT = /^(media|supports|layer|container)$/i;
const KEYFRAMES_AT = /^(-(webkit|moz|o)-)?keyframes$/i;
const LEAK_LEADING =
  /^(?:html|body|header|:root|#shopify-section[\w-]*)(?=[\s.#:[>+~*,]|$)/i;

export function sanitizeCustomCss(value: unknown): string {
  try {
    if (typeof value !== "string") return "";
    let css = value.trim().slice(0, CUSTOM_CSS_MAX);
    css = css.replace(/<[^>]*>/g, "");
    css = stripAtImportRules(css);
    css = css.replace(/javascript\s*:/gi, "");
    css = css.replace(/expression\s*\(/gi, "");
    css = css.replace(/behavior\s*:/gi, "");
    css = css.replace(/-moz-binding/gi, "");
    css = stripUnsafeUrls(css);
    return css;
  } catch {
    return "";
  }
}

export function scopeCustomCss(css: string, scope: string = WIDGET_SCOPE): string {
  try {
    if (!css || !css.trim()) return "";
    return scopeBlock(css, scope).trim();
  } catch {
    return "";
  }
}

export function sanitizeProductListLiquid(value: unknown): string {
  try {
    if (typeof value !== "string") return "";
    let liquid = value.slice(0, PRODUCT_LIST_LIQUID_MAX);
    liquid = liquid.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
    liquid = liquid.replace(/<script\b[^>]*>/gi, "");
    liquid = liquid.replace(
      /\{%-?\s*javascript\s*-?%\}[\s\S]*?\{%-?\s*endjavascript\s*-?%\}/gi,
      "",
    );
    liquid = liquid.replace(
      /\{%-?\s*js\s*-?%\}[\s\S]*?\{%-?\s*endjs\s*-?%\}/gi,
      "",
    );
    liquid = liquid.replace(/\{%-?\s*(?:end)?javascript\s*-?%\}/gi, "");
    liquid = liquid.replace(/\{%-?\s*js\s*-?%\}/gi, "");
    liquid = liquid.replace(/\{%-?\s*endjs\s*-?%\}/gi, "");
    liquid = liquid.replace(/\{\{\s*content_for_header\s*\}\}/gi, "");
    return liquid;
  } catch {
    return "";
  }
}

function stripAtImportRules(css: string): string {
  let out = "";
  let i = 0;
  while (i < css.length) {
    if (css.startsWith("/*", i)) {
      const end = skipComment(css, i);
      out += css.slice(i, end);
      i = end;
      continue;
    }
    if (css[i] === "'" || css[i] === '"') {
      const end = skipString(css, i);
      out += css.slice(i, end);
      i = end;
      continue;
    }
    if (css[i] === "@" && /^@import\b/i.test(css.slice(i))) {
      i += "@import".length;
      while (i < css.length) {
        if (css[i] === "'" || css[i] === '"') {
          i = skipString(css, i);
          continue;
        }
        if (css.startsWith("/*", i)) {
          i = skipComment(css, i);
          continue;
        }
        if (css[i] === "{") {
          i = skipBalanced(css, i);
          break;
        }
        if (css[i] === ";") {
          i += 1;
          break;
        }
        i += 1;
      }
      continue;
    }
    out += css[i];
    i += 1;
  }
  return out;
}

function stripUnsafeUrls(css: string): string {
  let out = "";
  let i = 0;
  while (i < css.length) {
    if (css.startsWith("/*", i)) {
      const end = skipComment(css, i);
      out += css.slice(i, end);
      i = end;
      continue;
    }
    if (css[i] === "'" || css[i] === '"') {
      const end = skipString(css, i);
      out += css.slice(i, end);
      i = end;
      continue;
    }
    if (/^url\s*\(/i.test(css.slice(i))) {
      const match = css.slice(i).match(/^url\s*\(\s*/i);
      const start = i;
      i += match![0].length;
      let inner = "";
      if (css[i] === "'" || css[i] === '"') {
        const q = css[i];
        const strEnd = skipString(css, i);
        inner = css.slice(i + 1, strEnd - (css[strEnd - 1] === q ? 1 : 0));
        i = strEnd;
      } else {
        while (i < css.length && css[i] !== ")") {
          inner += css[i];
          i += 1;
        }
      }
      while (i < css.length && css[i] !== ")") i += 1;
      if (css[i] === ")") i += 1;
      const url = inner.trim();
      if (/^https:/i.test(url) || /^data:image/i.test(url)) {
        out += css.slice(start, i);
      }
      continue;
    }
    out += css[i];
    i += 1;
  }
  return out;
}

function scopeBlock(css: string, scope: string): string {
  const pieces: string[] = [];
  let i = 0;
  const n = css.length;

  while (i < n) {
    i = skipWsAndComments(css, i);
    if (i >= n) break;

    if (css[i] === "@") {
      const start = i;
      i += 1;
      while (i < n && /[\w-]/.test(css[i]!)) i += 1;
      const atName = css.slice(start + 1, i);
      i = skipWsAndComments(css, i);
      const preludeStart = i;
      while (i < n && css[i] !== "{" && css[i] !== ";") {
        if (css[i] === "'" || css[i] === '"') {
          i = skipString(css, i);
          continue;
        }
        if (css.startsWith("/*", i)) {
          i = skipComment(css, i);
          continue;
        }
        i += 1;
      }
      const prelude = css.slice(preludeStart, i).trim();
      if (i < n && css[i] === ";") {
        pieces.push(`@${atName}${prelude ? ` ${prelude}` : ""};`);
        i += 1;
        continue;
      }
      if (i >= n || css[i] !== "{") {
        break;
      }
      const bodyStart = i + 1;
      i = skipBalanced(css, i);
      const body = css.slice(bodyStart, i - 1);
      pieces.push(scopeAtRule(atName, prelude, body, scope));
      continue;
    }

    const selStart = i;
    while (i < n && css[i] !== "{") {
      if (css[i] === "'" || css[i] === '"') {
        i = skipString(css, i);
        continue;
      }
      if (css.startsWith("/*", i)) {
        i = skipComment(css, i);
        continue;
      }
      i += 1;
    }
    const prelude = css.slice(selStart, i).trim();
    if (i >= n || css[i] !== "{") {
      const { decls } = peelDeclarations(prelude);
      if (decls) pieces.push(`${scope} { ${decls} }`);
      break;
    }
    const bodyStart = i + 1;
    i = skipBalanced(css, i);
    const body = css.slice(bodyStart, i - 1).trim();
    const { decls, rest } = peelDeclarations(prelude);
    if (decls) pieces.push(`${scope} { ${decls} }`);
    const selector = rest.trim();
    if (!selector) {
      if (body) pieces.push(`${scope} { ${trimSemi(body)} }`);
      continue;
    }
    pieces.push(`${prefixSelectorList(selector, scope)} { ${body} }`);
  }

  return pieces.join("\n");
}

function scopeAtRule(
  atName: string,
  prelude: string,
  body: string,
  scope: string,
): string {
  const head = `@${atName}${prelude ? ` ${prelude}` : ""}`;
  if (NESTED_AT.test(atName)) {
    const inner = scopeBlock(body, scope);
    return `${head} {\n${inner}\n}`;
  }
  if (KEYFRAMES_AT.test(atName)) {
    return `${head} { ${body.trim()} }`;
  }
  return `${head} { ${body.trim()} }`;
}

function prefixSelectorList(list: string, scope: string): string {
  return splitSelectors(list)
    .map((sel) => prefixSelector(sel, scope))
    .join(", ");
}

function prefixSelector(raw: string, scope: string): string {
  const sel = raw.trim();
  if (!sel) return scope;
  if (sel.startsWith(scope)) return sel;

  const leak = sel.match(LEAK_LEADING);
  if (leak) {
    return `${scope}${sel.slice(leak[0].length)}`;
  }

  return `${scope} ${sel}`;
}

function splitSelectors(list: string): string[] {
  const parts: string[] = [];
  let buf = "";
  let depth = 0;
  for (let i = 0; i < list.length; i++) {
    const c = list[i]!;
    if (c === "'" || c === '"') {
      const end = skipString(list, i);
      buf += list.slice(i, end);
      i = end - 1;
      continue;
    }
    if (c === "(" || c === "[") depth += 1;
    else if ((c === ")" || c === "]") && depth > 0) depth -= 1;
    else if (c === "," && depth === 0) {
      if (buf.trim()) parts.push(buf);
      buf = "";
      continue;
    }
    buf += c;
  }
  if (buf.trim()) parts.push(buf);
  return parts.length ? parts : [list];
}

function peelDeclarations(prelude: string): { decls: string; rest: string } {
  let rest = prelude.trim();
  const found: string[] = [];
  while (rest) {
    const custom = rest.match(/^--[\w-]+\s*:[^;{}]*;?\s*/);
    if (custom) {
      found.push(trimSemi(custom[0]));
      rest = rest.slice(custom[0].length).trim();
      continue;
    }
    const prop = rest.match(/^[\w-]+\s*:\s*[^;{}]+;\s*/);
    if (prop && /^[\w-]+\s*:/.test(prop[0])) {
      found.push(trimSemi(prop[0]));
      rest = rest.slice(prop[0].length).trim();
      continue;
    }
    break;
  }
  return { decls: found.join("; "), rest };
}

function trimSemi(text: string): string {
  return text.trim().replace(/;+\s*$/, "");
}

function skipWsAndComments(css: string, i: number): number {
  while (i < css.length) {
    const c = css[i]!;
    if (c === " " || c === "\n" || c === "\r" || c === "\t" || c === "\f") {
      i += 1;
      continue;
    }
    if (css.startsWith("/*", i)) {
      i = skipComment(css, i);
      continue;
    }
    break;
  }
  return i;
}

function skipString(css: string, i: number): number {
  const q = css[i];
  i += 1;
  while (i < css.length) {
    if (css[i] === "\\") {
      i += 2;
      continue;
    }
    if (css[i] === q) return i + 1;
    i += 1;
  }
  return i;
}

function skipComment(css: string, i: number): number {
  const end = css.indexOf("*/", i + 2);
  return end === -1 ? css.length : end + 2;
}

function skipBalanced(css: string, i: number): number {
  let depth = 0;
  while (i < css.length) {
    const c = css[i]!;
    if (c === "'" || c === '"') {
      i = skipString(css, i);
      continue;
    }
    if (css.startsWith("/*", i)) {
      i = skipComment(css, i);
      continue;
    }
    if (c === "{") depth += 1;
    else if (c === "}") {
      depth -= 1;
      i += 1;
      if (depth <= 0) return i;
      continue;
    }
    i += 1;
  }
  return i;
}
