import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

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
