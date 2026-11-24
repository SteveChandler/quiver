// __tests__/helpers/table-client.ts  (shared fixture; the helpers directory is not a Jest suite)
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.generated";

type TableResult = { data: unknown; error: { message: string } | null };

/**
 * A thenable Supabase stub keyed by table. A table with a queue takes the next
 * queued result on each await (an empty queue reads as no rows); any other
 * table reads its fixed `rows`.
 */
export function createTableClient(spec?: {
  rows?: Record<string, unknown[]>;
  queue?: Record<string, TableResult[]>;
}): {
  client: SupabaseClient<Database>;
  from: jest.Mock;
  tablesRead: string[];
  inCalls: unknown[][];
  rangeCalls: Array<[number, number]>;
  inCallsFor(table: string): unknown[][];
} {
  const queues = new Map(
    Object.entries(spec?.queue ?? {}).map(([table, results]) => [table, [...results]])
  );
  const tablesRead: string[] = [];
  const inCalls: unknown[][] = [];
  const inCallsByTable = new Map<string, unknown[][]>();
  const rangeCalls: Array<[number, number]> = [];

  function nextResult(table: string): TableResult {
    const queue = queues.get(table);
    if (!queue) return { data: spec?.rows?.[table] ?? [], error: null };
    return queue.shift() ?? { data: [], error: null };
  }

  const from = jest.fn((table: string) => {
    tablesRead.push(table);
    const query = {
      select: () => query,
      eq: () => query,
      is: () => query,
      or: () => query,
      order: () => query,
      gte: () => query,
      lt: () => query,
      limit: () => query,
      in: (_column: string, values: readonly unknown[]) => {
        inCalls.push([...values]);
        const forTable = inCallsByTable.get(table) ?? [];
        forTable.push([...values]);
        inCallsByTable.set(table, forTable);
        return query;
      },
      range: (fromIndex: number, toIndex: number) => {
        rangeCalls.push([fromIndex, toIndex]);
        return query;
      },
      maybeSingle: () => {
        const result = nextResult(table);
        const first = Array.isArray(result.data) ? result.data[0] ?? null : null;
        return Promise.resolve({ ...result, data: first });
      },
      then: (
        resolve: (value: TableResult) => unknown,
        reject?: (reason: unknown) => unknown
      ) => Promise.resolve(nextResult(table)).then(resolve, reject),
    };
    return query;
  });

  return {
    client: { from } as unknown as SupabaseClient<Database>,
    from,
    tablesRead,
    inCalls,
    rangeCalls,
    inCallsFor: (table: string) => inCallsByTable.get(table) ?? [],
  };
}
