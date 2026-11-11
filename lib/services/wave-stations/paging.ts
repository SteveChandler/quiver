/** PostgREST caps a response at 1000 rows; read every page. Shared by the read service and the sync. */

const PAGE_SIZE = 1000;

interface PageResult<T> {
  data: T[] | null;
  error: { message: string; code?: string } | null;
}

/** An Error that keeps the PostgREST/Postgres code ("PGRST205", "42P01") so callers can tell failures apart. */
export function errorWithCode(message: string, source: { code?: unknown }): Error & { code?: string } {
  const error: Error & { code?: string } = new Error(message);
  if (typeof source.code === "string" && source.code) error.code = source.code;
  return error;
}

export async function selectAllPages<T>(
  page: (from: number, to: number) => PromiseLike<PageResult<T>>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) throw errorWithCode(error.message, error);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
}
