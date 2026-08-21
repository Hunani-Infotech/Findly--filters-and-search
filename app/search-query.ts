/** Default English stop words stripped from shopper queries (E4). */
export const DEFAULT_STOP_WORDS = [
  "a",
  "an",
  "the",
  "and",
  "or",
  "of",
  "to",
  "in",
  "on",
  "for",
  "with",
  "at",
  "by",
  "from",
  "is",
  "it",
] as const;

const STOP_WORD_MAX = 80;
const STOP_WORD_PATTERN = /^[a-z0-9']{1,24}$/;

/**
 * Typo distance rules (E4):
 * - token length < 4: exact only (0)
 * - length 4 or 5: Levenshtein <= 1  ("shrt" vs "shirt" = 1 → match)
 * - length >= 6: Levenshtein <= 2
 */
export function maxTypoDistance(tokenLength: number): number {
  if (tokenLength < 4) return 0;
  if (tokenLength <= 5) return 1;
  return 2;
}

export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > 2) return 99;
  const rows = a.length + 1;
  const cols = b.length + 1;
  const dp: number[] = new Array(rows * cols);
  for (let i = 0; i < rows; i++) dp[i * cols] = i;
  for (let j = 0; j < cols; j++) dp[j] = j;
  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i * cols + j] = Math.min(
        dp[(i - 1) * cols + j] + 1,
        dp[i * cols + j - 1] + 1,
        dp[(i - 1) * cols + j - 1] + cost,
      );
    }
  }
  return dp[a.length * cols + b.length];
}

export function normalizeStopWords(value: unknown): string[] {
  if (value == null) return [...DEFAULT_STOP_WORDS];
  const parts =
    typeof value === "string"
      ? value.split(/[\n,]+/)
      : Array.isArray(value)
        ? value
        : null;
  if (parts == null) return [...DEFAULT_STOP_WORDS];
  const seen = new Set<string>();
  const next: string[] = [];
  for (const part of parts) {
    if (typeof part !== "string") continue;
    const word = part.trim().toLowerCase();
    if (!STOP_WORD_PATTERN.test(word) || seen.has(word)) continue;
    seen.add(word);
    next.push(word);
    if (next.length >= STOP_WORD_MAX) break;
  }
  return next;
}

export function tokenizeSearchQuery(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[^a-z0-9']+/)
    .filter(Boolean);
}

export function applyStopWords(
  tokens: string[],
  stopWords: readonly string[],
): string[] {
  const stop = new Set(stopWords.map((word) => word.toLowerCase()));
  const kept = tokens.filter((token) => !stop.has(token.toLowerCase()));
  return kept.length === 0 ? tokens : kept;
}

export function prepareSearchTokens(
  query: string,
  stopWords?: readonly string[],
): string[] {
  return applyStopWords(
    tokenizeSearchQuery(query),
    stopWords ?? DEFAULT_STOP_WORDS,
  );
}

export function tokenMatchesHaystack(
  haystack: string,
  token: string,
  fuzzy: boolean,
): boolean {
  const hay = haystack.toLowerCase();
  const tok = token.toLowerCase();
  if (!tok) return false;
  if (hay.includes(tok)) return true;
  if (!fuzzy) return false;
  const max = maxTypoDistance(tok.length);
  if (max <= 0) return false;
  const words = hay.split(/[^a-z0-9']+/).filter(Boolean);
  return words.some((word) => editDistance(word, tok) <= max);
}

export type SearchMatchMode = "and" | "or";

export function tokensMatchHaystack(
  haystack: string,
  tokens: string[],
  fuzzy: boolean,
  mode: SearchMatchMode = "and",
): boolean {
  if (tokens.length === 0) return false;
  if (mode === "or") {
    return tokens.some((token) =>
      tokenMatchesHaystack(haystack, token, fuzzy),
    );
  }
  return tokens.every((token) => tokenMatchesHaystack(haystack, token, fuzzy));
}

export function searchableTextFromProduct(row: {
  title: string;
  vendor: string;
  productType: string;
  tags: string[];
  skus?: string[];
}): string {
  return [
    row.title,
    row.vendor,
    row.productType,
    ...row.tags,
    ...(row.skus ?? []),
  ]
    .filter((part) => part != null && String(part))
    .join(" ");
}
