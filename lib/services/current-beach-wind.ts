import type { SupabaseServerClient } from "@/types/supabase";

export interface CurrentBeachWind {
  observedAt: string;
  windSpeedMph: number;
  windDirection: string | null;
  windDirectionDeg: number | null;
  windGustMph: number | null;
  source: string;
}

interface CurrentBeachWindRow {
  observed_at: string;
  wind_speed_mph: number;
  wind_direction: string | null;
  wind_direction_deg: number | null;
  wind_gust_mph: number | null;
  source: string;
}

export async function fetchCurrentBeachWind(
  supabase: SupabaseServerClient,
  beachId: string
): Promise<CurrentBeachWind | null> {
  const { data, error } = await supabase.rpc(
    "get_current_beach_wind" as never,
    { p_beach_id: beachId } as never
  );

  if (error) {
    console.error("Current beach wind fetch error:", error);
    return null;
  }

  const rows = data as unknown as CurrentBeachWindRow[] | null;
  const row = rows?.[0];
  if (!row) return null;

  const observedAtMs = Date.parse(row.observed_at);
  const windSpeedMph = Number(row.wind_speed_mph);
  if (
    !Number.isFinite(observedAtMs) ||
    !Number.isFinite(windSpeedMph) ||
    windSpeedMph < 0
  ) {
    return null;
  }

  const windDirectionDeg =
    row.wind_direction_deg == null ? null : Number(row.wind_direction_deg);
  const windGustMph =
    row.wind_gust_mph == null ? null : Number(row.wind_gust_mph);

  return {
    observedAt: row.observed_at,
    windSpeedMph,
    windDirection: row.wind_direction,
    windDirectionDeg:
      windDirectionDeg != null && Number.isFinite(windDirectionDeg)
        ? windDirectionDeg
        : null,
    windGustMph:
      windGustMph != null && Number.isFinite(windGustMph)
        ? windGustMph
        : null,
    source: row.source,
  };
}
