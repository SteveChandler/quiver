import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.generated";

const TRACK_SUMMARY_COLUMNS = [
  "gps_coverage",
  "speed_reliable",
  "user_wave_count",
  "paddle_distance_m",
  "hr_avg",
  "hr_max",
  "recorded_by",
  "source_device",
  "water_temp_c",
  "water_temp_start_c",
  "water_temp_end_c",
  "calories",
] as const;

const NEW_TRACK_SUMMARY_COLUMNS = new Set([
  "water_temp_c", "water_temp_start_c", "water_temp_end_c", "calories",
]);
const LEGACY_TRACK_SUMMARY_COLUMNS = TRACK_SUMMARY_COLUMNS.filter(column => !NEW_TRACK_SUMMARY_COLUMNS.has(column));

type SessionTrackForWaves = {
  gps_coverage: number;
  speed_reliable: boolean;
  user_wave_count: number | null;
  paddle_distance_m: number | null;
  hr_avg: number | null;
  hr_max: number | null;
  recorded_by: string | null;
  source_device: string | null;
  water_temp_c?: number | null;
  water_temp_start_c?: number | null;
  water_temp_end_c?: number | null;
  calories?: number | null;
  track_geojson?: unknown;
  speed_series?: unknown;
};

type TrackReadResult = {
  data: SessionTrackForWaves | null;
  error: { code?: string; message: string } | null;
};

function isMissingOptionalTrackColumn(error: TrackReadResult["error"]): boolean {
  if (error?.code !== "42703" && error?.code !== "PGRST204") return false;
  return [...NEW_TRACK_SUMMARY_COLUMNS].some(column => error.message.includes(column));
}

export async function readSessionTrackForWaves(
  supabase: SupabaseClient<Database>,
  sessionId: string,
  userId: string,
  options: { includeTrackData?: boolean } = {},
): Promise<TrackReadResult> {
  const extraColumns = options.includeTrackData ? ["track_geojson", "speed_series"] : [];
  const columns = [...TRACK_SUMMARY_COLUMNS, ...extraColumns].join(", ");
  const legacyColumns = [...LEGACY_TRACK_SUMMARY_COLUMNS, ...extraColumns].join(", ");
  const read = (selection: string) => supabase.from("session_tracks")
    .select(selection).eq("session_id", sessionId).eq("user_id", userId).maybeSingle();

  const result = await read(columns);
  if (!isMissingOptionalTrackColumn(result.error)) {
    return result as TrackReadResult;
  }

  return await read(legacyColumns) as TrackReadResult;
}
