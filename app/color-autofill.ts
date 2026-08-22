/** Deterministic color-name → hex map for Auto-fill. Not semantic/AI ranking. */

const NAMED: Record<string, string> = {
  black: "#111111",
  white: "#ffffff",
  red: "#e11d48",
  blue: "#2563eb",
  green: "#16a34a",
  yellow: "#eab308",
  orange: "#f97316",
  purple: "#7c3aed",
  pink: "#ec4899",
  brown: "#92400e",
  gray: "#6b7280",
  grey: "#6b7280",
  beige: "#e8d5b7",
  navy: "#1e3a8a",
  teal: "#0d9488",
  gold: "#d4a017",
  silver: "#c0c0c0",
  cream: "#f5f0e6",
  ivory: "#fffff0",
  maroon: "#7f1d1d",
  olive: "#6b8e23",
  coral: "#ff7f50",
  mint: "#98fb98",
  lavender: "#b57edc",
  charcoal: "#36454f",
  dawn: "#f5cba0",
  electric: "#00bfff",
  ice: "#e0f7fa",
  powder: "#b0e0e6",
  sunset: "#ff4500",
  midnight: "#191970",
  "midnight blue": "#191970",
  "light blue": "#add8e6",
  "dark blue": "#00008b",
  sky: "#87ceeb",
  forest: "#228b22",
  sand: "#c2b280",
  wine: "#722f37",
  blush: "#de5d83",
};

function normalize(value: string) {
  return value.trim().toLowerCase().replace(/[_-]+/g, " ");
}

export function hexFromColorName(value: string): string {
  const raw = String(value || "").trim();
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(raw)) return raw.toLowerCase();
  const key = normalize(raw);
  if (NAMED[key]) return NAMED[key];
  const compact = key.replace(/\s+/g, "");
  if (NAMED[compact]) return NAMED[compact];
  const tokens = key.split(/\s+/);
  for (const token of tokens) {
    if (NAMED[token]) return NAMED[token];
  }
  return "";
}

export function isSwatchFilled(row: {
  kind: string;
  color1: string;
  color2: string;
  imageUrl: string;
}) {
  if (row.kind === "image") return Boolean(row.imageUrl.trim());
  if (row.kind === "dual") {
    return Boolean(row.color1.trim() && row.color2.trim());
  }
  return Boolean(row.color1.trim());
}
