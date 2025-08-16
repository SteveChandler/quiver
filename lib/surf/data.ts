// Data shaping helpers for surf scoring/windows
import SunCalc from "suncalc";
import { createAPIServerClient } from "@/lib/supabase/api-server-client";
import { HourlyMarine, HourlyTide } from "./scoring";


export interface MarinePoint {
  ts: string;
  wave_direction_deg: number | null;
  wave_period_s: number | null;
  wind_speed_ms: number | null;
  wind_direction_deg: number | null;
}

export interface TidePoint {
  ts: string;
  tide_height_m: number | null;
}

export interface JoinedHour {
  ts: string;
  waveDirectionDeg: number | null;
  wavePeriodS: number | null;
  windSpeedMs: number | null;
  windDirectionDeg: number | null;
  tideHeightM: number | null;
}

// Join nearest tide within ±90 minutes and nearest marine within ±6h to an hourly timeline
export function joinNearest(
  hourIsos: string[],
  marine: MarinePoint[],
  tides: TidePoint[]
): JoinedHour[] {
  const mByTs = [...marine].sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts));
  const tByTs = [...tides].sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts));

  function nearestMarine(ts: number): MarinePoint | undefined {
    let best: MarinePoint | undefined;
    let bestDt = Number.POSITIVE_INFINITY;
    for (const m of mByTs) {
      const dt = Math.abs(Date.parse(m.ts) - ts);
      if (dt < bestDt) {
        best = m; bestDt = dt;
      }
      if (dt > 6 * 3600_000 && Date.parse(m.ts) > ts) break;
    }
    return bestDt <= 6 * 3600_000 ? best : undefined;
  }

  function nearestTide(ts: number): TidePoint | undefined {
    let best: TidePoint | undefined;
    let bestDt = Number.POSITIVE_INFINITY;
    for (const t of tByTs) {
      const dt = Math.abs(Date.parse(t.ts) - ts);
      if (dt < bestDt) {
        best = t; bestDt = dt;
      }
      if (dt > 90 * 60_000 && Date.parse(t.ts) > ts) break;
    }
    return bestDt <= 90 * 60_000 ? best : undefined;
  }

  return hourIsos.map((iso) => {
    const tsn = Date.parse(iso);
    const m = nearestMarine(tsn);
    const t = nearestTide(tsn);
    return {
      ts: iso,
      waveDirectionDeg: m?.wave_direction_deg ?? null,
      wavePeriodS: m?.wave_period_s ?? null,
      windSpeedMs: m?.wind_speed_ms ?? null,
      windDirectionDeg: m?.wind_direction_deg ?? null,
      tideHeightM: t?.tide_height_m ?? null,
    };
  });
}

// --- Data layer stubs using Supabase client (API context) ---

export async function getBeachesNear(
  lat: number,
  lon: number,
  radiusKm: number
): Promise<any[]> {
  const supabase = createAPIServerClient();
  const { data, error } = await supabase.rpc("get_beaches_near", {
    _lat: lat,
    _lon: lon,
    _radius_km: radiusKm,
  });
  if (error) throw error;
  return data || [];
}

function localDayUtcRange(localDate: string, tz = "America/Los_Angeles") {
  // Build [start,end] UTC ISO for a local calendar day
  const d = new Date(localDate + "T00:00:00");
  const start = new Date(
    d.toLocaleString("en-US", { timeZone: tz })
  );
  // Move from local midnight to UTC timestamp preserving wall time intent
  const utcStart = new Date(Date.UTC(start.getFullYear(), start.getMonth(), start.getDate(), 0, 0, 0));
  const utcEnd = new Date(utcStart.getTime() + 24 * 3600_000 - 1);
  return { startIso: utcStart.toISOString(), endIso: utcEnd.toISOString() };
}

export async function getMarineForecast(
  beachId: string,
  localDate: string,
  tz = "America/Los_Angeles"
): Promise<MarinePoint[]> {
  const { startIso, endIso } = localDayUtcRange(localDate, tz);
  const supabase = createAPIServerClient();
  const { data, error } = await supabase
    .from("marine_forecasts")
    .select(
      "ts, wave_direction_deg, wave_period_s, wind_speed_ms, wind_direction_deg"
    )
    .eq("beach_id", beachId)
    .gte("ts", startIso)
    .lte("ts", endIso)
    .order("ts", { ascending: true });
  if (error) throw error;
  return (data || []).map((r: any) => ({
    ts: r.ts,
    wave_direction_deg: r.wave_direction_deg,
    wave_period_s: r.wave_period_s,
    wind_speed_ms: r.wind_speed_ms,
    wind_direction_deg: r.wind_direction_deg,
  }));
}

export async function getTideForecast(
  beachId: string,
  localDate: string,
  tz = "America/Los_Angeles"
): Promise<TidePoint[]> {
  const { startIso, endIso } = localDayUtcRange(localDate, tz);
  const supabase = createAPIServerClient();
  const { data, error } = await supabase
    .from("tide_forecasts")
    .select("ts, tide_height_m")
    .eq("beach_id", beachId)
    .gte("ts", startIso)
    .lte("ts", endIso)
    .order("ts", { ascending: true });
  if (error) throw error;
  return (data || []).map((r: any) => ({ ts: r.ts, tide_height_m: r.tide_height_m }));
}

export async function getSunTimes(
  beachId: string,
  localDate: string,
  lat: number,
  lon: number
): Promise<{ sunrise_utc: string | null; sunset_utc: string | null }> {
  const supabase = createAPIServerClient();
  // First try cache
  const { data: cached } = await supabase
    .from("sun_times")
    .select("sunrise_utc,sunset_utc")
    .eq("beach_id", beachId)
    .eq("date", localDate)
    .maybeSingle();
  if (cached) return cached as any;

  // Compute via SunCalc
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

// Range fetchers using generated columns (ts_utc, hs_m, etc.)
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



