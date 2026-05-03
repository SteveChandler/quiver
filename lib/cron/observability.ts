import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

type CronRunsTable = {
  from: (table: "cron_runs") => {
    insert: (row: Record<string, unknown>) => {
      select: (cols: string) => { single: () => Promise<{ data: { id: string } | null }> };
    };
    update: (row: Record<string, unknown>) => { eq: (col: string, val: string) => Promise<unknown> };
  };
};

/**
 * Response-level wrapper: takes an existing route handler and returns one that
 * logs every invocation to `cron_runs`. Works on routes that already do their
 * own auth + JSON shaping — wrap the export, don't touch the body.
 *
 * Usage:
 *   async function _GET(request: Request) { ... existing body ... }
 *   export const GET = withObservedCron("/api/cron/foo", _GET);
 *
 * On success: stores `status='ok'` (if Response.ok) or `status='error'`,
 * `duration_ms`, and the parsed JSON body as `summary` (best-effort, capped
 * at 8 KB to avoid pathological payloads). On thrown error: stores
 * `status='error'` and `error_message`. Observability never blocks the
 * handler — failures to write to cron_runs are swallowed.
 */
export function withObservedCron<H extends (request: Request) => Promise<Response>>(
  route: string,
  handler: H
): H {
  const wrapped = (async (request: Request) => {
    const start = Date.now();
    let runId: string | null = null;
    try {
      const supabase = await createSupabaseServiceRoleClient();
      const db = supabase as unknown as CronRunsTable;
      const { data } = await db
        .from("cron_runs")
        .insert({ route, status: "started" })
        .select("id")
        .single();
      runId = data?.id ?? null;
    } catch {
      // never block the handler
    }

    try {
      const response = await handler(request);

      if (runId) {
        let summary: unknown = null;
        try {
          const cloned = response.clone();
          const text = await cloned.text();
          if (text && text.length <= 8192) {
            summary = JSON.parse(text);
          }
        } catch {
          summary = null;
        }
        try {
          const supabase = await createSupabaseServiceRoleClient();
          const db = supabase as unknown as CronRunsTable;
          await db
            .from("cron_runs")
            .update({
              status: response.ok ? "ok" : "error",
              finished_at: new Date().toISOString(),
              duration_ms: Date.now() - start,
              summary: summary as object | null,
            })
            .eq("id", runId);
        } catch {
          // swallow
        }
      }
      return response;
    } catch (err) {
      if (runId) {
        try {
          const supabase = await createSupabaseServiceRoleClient();
          const db = supabase as unknown as CronRunsTable;
          await db
            .from("cron_runs")
            .update({
              status: "error",
              finished_at: new Date().toISOString(),
              duration_ms: Date.now() - start,
              error_message: err instanceof Error ? err.message : String(err),
            })
            .eq("id", runId);
        } catch {
          // swallow
        }
      }
      throw err;
    }
  }) as H;
  return wrapped;
}

export async function withCronObservability<T>(
  route: string,
  handler: () => Promise<T>
): Promise<T> {
  const supabase = await createSupabaseServiceRoleClient();
  const start = Date.now();

  // cron_runs is not yet in the generated types — cast to any until db:types is regenerated.
  const db = supabase as unknown as {
    from: (table: "cron_runs") => {
      insert: (row: Record<string, unknown>) => {
        select: (cols: string) => { single: () => Promise<{ data: { id: string } | null }> };
      };
      update: (row: Record<string, unknown>) => { eq: (col: string, val: string) => Promise<unknown> };
    };
  };

  let runId: string | null = null;
  try {
    const { data } = await db
      .from("cron_runs")
      .insert({ route, status: "started" })
      .select("id")
      .single();
    runId = data?.id ?? null;
  } catch {
    // Observability must never block the handler.
  }

  try {
    const result = await handler();
    if (runId) {
      await db
        .from("cron_runs")
        .update({
          status: "ok",
          finished_at: new Date().toISOString(),
          duration_ms: Date.now() - start,
          summary: result as object,
        })
        .eq("id", runId);
    }
    return result;
  } catch (err) {
    if (runId) {
      await db
        .from("cron_runs")
        .update({
          status: "error",
          finished_at: new Date().toISOString(),
          duration_ms: Date.now() - start,
          error_message: err instanceof Error ? err.message : String(err),
        })
        .eq("id", runId);
    }
    throw err;
  }
}
