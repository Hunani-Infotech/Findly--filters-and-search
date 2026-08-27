/** Expand `#abc` to `#aabbcc`. Returns `fallback` when the value is not a hex color. */
export function expandHexColor(value: string, fallback: string): string {
  const color = value.trim();
  if (/^#[0-9a-f]{6}$/i.test(color)) return color;
  if (/^#[0-9a-f]{3}$/i.test(color)) {
    const r = color[1];
    const g = color[2];
    const b = color[3];
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return fallback;
}
