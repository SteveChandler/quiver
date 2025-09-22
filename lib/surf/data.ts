import SunCalc from "suncalc";
import { createAPIServerClient } from "@/lib/supabase/api-server-client";
import type { HourlyMarine, HourlyTide } from "./scoring";

export async function getBeachesNear(
  lat: number,
  lon: number,
  radiusKm: number
): Promise<any[]> {
  const supabase = createAPIServerClient();
  const radiusMeters = Math.round(radiusKm * 1000);

  const { data, error } = await supabase.rpc("get_nearby_beaches", {
    lat,
    lng: lon,
    max_distance_meters: radiusMeters,
    limit_count: 50,
  });

  if (error) {
    console.error(
      "Spatial function failed, falling back to client-side filtering:",
      error
    );

    const { data: fallback, error: fallbackError } = await supabase
      .from("beaches")
      .select("id, name, location, latitude, longitude, is_private")
      .not("latitude", "is", null)
      .not("longitude", "is", null)
      .limit(50);

    if (fallbackError) throw fallbackError;
    return fallback || [];
  }

  return data || [];
}

export async function getSunTimes(
  beachId: string,
  localDate: string,
  lat: number,
  lon: number
): Promise<{ sunrise_utc: string | null; sunset_utc: string | null }> {
  const supabase = createAPIServerClient();

  const { data: cached } = await supabase
    .from("sun_times")
    .select("sunrise_utc,sunset_utc")
    .eq("beach_id", beachId)
    .eq("date", localDate)
    .maybeSingle();

  if (cached) return cached as any;

  const [y, m, d] = localDate.split("-").map((x) => parseInt(x, 10));
  const times = SunCalc.getTimes(new Date(Date.UTC(y, m - 1, d)), lat, lon);
  const row = {
    beach_id: beachId,
    date: localDate,
    sunrise_utc: times.sunrise ? times.sunrise.toISOString() : null,
    sunset_utc: times.sunset ? times.sunset.toISOString() : null,
    source: "computed",
  } as any;

  await supabase.from("sun_times").upsert([row], {
    onConflict: "beach_id,date,source",
  });

  return { sunrise_utc: row.sunrise_utc, sunset_utc: row.sunset_utc };
}

export async function getMarineForecastRange(
  beachId: string,
  startUtc: Date,
  endUtc: Date
): Promise<HourlyMarine[]> {
  const supabase = createAPIServerClient();
  const { data, error } = await supabase
    .from("marine_forecasts")
    .select(
      "ts_utc, hs_m, tp_s, swell_dir_deg, wind_spd_kts, wind_dir_deg"
    )
    .eq("beach_id", beachId)
    .gte("ts_utc", startUtc.toISOString())
    .lte("ts_utc", endUtc.toISOString())
    .order("ts_utc", { ascending: true });

  if (error) throw error;

  return (data || []).map((r: any) => ({
    ts: new Date(r.ts_utc),
    hs_m: Number(r.hs_m ?? 0),
    tp_s: r.tp_s == null ? null : Number(r.tp_s),
    swell_dir_deg: r.swell_dir_deg == null ? null : Number(r.swell_dir_deg),
    wind_spd_kts: r.wind_spd_kts == null ? null : Number(r.wind_spd_kts),
    wind_dir_deg: r.wind_dir_deg == null ? null : Number(r.wind_dir_deg),
  }));
}

export async function getTideForecastRange(
  beachId: string,
  startUtc: Date,
  endUtc: Date
): Promise<HourlyTide[]> {
  const supabase = createAPIServerClient();
  const { data, error } = await supabase
    .from("tide_forecasts")
    .select("ts_utc, tide_ft")
    .eq("beach_id", beachId)
    .gte("ts_utc", startUtc.toISOString())
    .lte("ts_utc", endUtc.toISOString())
    .order("ts_utc", { ascending: true });

  if (error) throw error;

  return (data || []).map((r: any) => ({
    ts: new Date(r.ts_utc),
    tide_ft: Number(r.tide_ft ?? 0),
  }));
}
