import type { SupabaseClient, PostgrestError } from "@supabase/supabase-js";
import type { Database, GetBestTimesRow } from "@/types/database";

/**
 * Fetch top-scoring 2-hour windows for a beach within the next `hours` via RPC.
 */
export async function fetchBestTimes(
  supabase: SupabaseClient<Database>,
  beachId: string,
  hours = 48,
  limit = 6
): Promise<{ data: GetBestTimesRow[] | null; error: PostgrestError | null }> {
  const start = new Date().toISOString();
  const end = new Date(Date.now() + hours * 3600 * 1000).toISOString();
  const { data, error } = await supabase.rpc("get_best_times", {
    p_beach: beachId,
    p_start: start,
    p_end: end,
    p_limit: limit,
  });
  return { data: (data as GetBestTimesRow[] | null) ?? null, error };
}

/**
 * Fetch windows via API (edge cached) which prefers materialized view.
 */
export async function fetchBestTimesApi(
  beachId: string,
  hours = 48,
  limit = 6
): Promise<{ windows: Array<{ start_ts: string; end_ts: string; grade: string; score: number }> }> {
  const params = new URLSearchParams({ beachId, hours: String(hours), limit: String(limit) });
  const res = await fetch(`/api/recommendations/best-times?${params}`, { cache: "no-store" });
  const json = await res.json();
  return json.data || { windows: [] };
}
