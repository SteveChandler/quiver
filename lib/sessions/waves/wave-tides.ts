import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchCachedHourlyTidePredictions } from "@/lib/services/noaa-tide-service";
import { interpolateTideHeight } from "@/lib/utils/tide-interpolation";
import type { StoredWave } from "./waves-summary";

const HOUR_MS = 60 * 60 * 1000;
const FEET_PER_METER = 3.28084;

export async function tideFtAtWaves(
  supabase: SupabaseClient,
  beachId: string,
  waves: StoredWave[],
): Promise<Map<string, number | null>> {
  if (waves.length === 0) return new Map();

  const start = Math.min(...waves.map((wave) => Date.parse(wave.startedAt)));
  const end = Math.max(...waves.map((wave) => Date.parse(wave.endedAt)));
  const { predictions } = await fetchCachedHourlyTidePredictions(
    supabase, beachId, new Date(start - HOUR_MS).toISOString(), new Date(end + HOUR_MS).toISOString(),
  );
  if (predictions.length === 0) return new Map(waves.map((wave) => [wave.id, null]));

  const points = predictions.map((prediction) => ({ time: prediction.ts, height: prediction.tide_height_m }));
  const times = predictions.map((prediction) => Date.parse(prediction.ts));
  const first = Math.min(...times);
  const last = Math.max(...times);

  return new Map(waves.map((wave) => {
    const time = Date.parse(wave.startedAt);
    if (time < first || time > last) return [wave.id, null];
    const meters = interpolateTideHeight(points, time);
    return [wave.id, meters === null ? null : Math.round(meters * FEET_PER_METER * 10) / 10];
  }));
}
