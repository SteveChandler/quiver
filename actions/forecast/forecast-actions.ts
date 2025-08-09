"use server";

import { withDatabaseOperation } from "@/lib/server-action-utils";

export type ForecastWindow = {
  marine: Array<{
    ts: string;
    wave_height_m: number | null;
    wave_period_s: number | null;
    wave_direction_deg: number | null;
    wind_speed_ms: number | null;
    wind_direction_deg: number | null;
    source: string;
    is_observed: boolean;
  }>;
  tides: Array<{
    ts: string;
    tide_height_m: number | null;
    tide_phase: string | null;
    source: string;
  }>;
  sun: Array<{
    date: string;
    sunrise_utc: string | null;
    sunset_utc: string | null;
    source: string;
  }>;
};

export async function getForecastWindow(
  beachId: string,
  startIso: string,
  endIso: string
) {
  return withDatabaseOperation<ForecastWindow>(async (supabase) => {
    const [marine, tides, sun] = await Promise.all([
      supabase
        .from("marine_forecasts")
        .select(
          "ts,wave_height_m,wave_period_s,wave_direction_deg,wind_speed_ms,wind_direction_deg,source,is_observed"
        )
        .eq("beach_id", beachId)
        .gte("ts", startIso)
        .lte("ts", endIso)
        .order("ts", { ascending: true }),
      supabase
        .from("tide_forecasts")
        .select("ts,tide_height_m,tide_phase,source")
        .eq("beach_id", beachId)
        .gte("ts", startIso)
        .lte("ts", endIso)
        .order("ts", { ascending: true }),
      supabase
        .from("sun_times")
        .select("date,sunrise_utc,sunset_utc,source")
        .eq("beach_id", beachId)
        .gte("date", startIso.split("T")[0])
        .lte("date", endIso.split("T")[0])
        .order("date", { ascending: true }),
    ]);

    return {
      marine: marine.data || [],
      tides: tides.data || [],
      sun: sun.data || [],
    };
  });
}
