/** Fields the storefront uses before it hides theme cards. */
export function indexCoverageFields(
  rows: Array<{ productGid?: string | null; handle?: string | null }>,
): { indexed_count: number; index_complete: false } {
  const ids = new Set<string>();
  for (const row of rows) {
    const id = row.productGid || row.handle || "";
    if (id) ids.add(id);
  }
  return { indexed_count: ids.size, index_complete: false };
}
