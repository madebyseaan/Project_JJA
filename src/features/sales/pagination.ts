/**
 * Fetch every page from a range-based query. PostgREST limits a response to
 * the project's max rows setting (often 1,000), so callers must not assume a
 * single select returns the whole table.
 */
export async function collectPages<T>(
  fetchPage: (from: number, to: number) => Promise<T[]>,
  pageSize = 1000,
): Promise<T[]> {
  const rows: T[] = [];

  for (let from = 0; ; from += pageSize) {
    const batch = await fetchPage(from, from + pageSize - 1);
    rows.push(...batch);

    if (batch.length < pageSize) {
      return rows;
    }
  }
}
