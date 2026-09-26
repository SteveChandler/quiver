/**
 * Reads every page of a range-paged PostgREST query.
 *
 * A server row cap below `pageSize` makes a short page ambiguous: it may be
 * the end or just the cap. The first page reveals the effective cap, so after
 * it a shorter page ends the read without an extra request. A short first page
 * cannot be told apart from the end, so that case costs one more (empty) read.
 */
export async function readAllPages<T>(
  fetchPage: (offset: number, limit: number) => Promise<T[]>,
  pageSize = 1000,
): Promise<T[]> {
  const rows: T[] = [];
  let cap: number | null = null;
  for (;;) {
    const page = await fetchPage(rows.length, pageSize);
    if (page.length === 0) return rows;
    rows.push(...page);
    if (cap === null) {
      cap = page.length;
      continue;
    }
    if (page.length < cap) return rows;
  }
}
