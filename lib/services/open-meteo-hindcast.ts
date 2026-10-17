import type { SessionConditionsRow } from "@/lib/sessions/session-conditions";
import { METERS_TO_FEET } from "@/lib/utils/unit-conversions";

export type HindcastHour = {
  at: string;
  waveHeightM: number | null;
  swellHeightM: number | null;
  swellPeriodS: number | null;
  swellDirectionDeg: number | null;
  windSpeedMph: number | null;
  windDirectionDeg: number | null;
};

type Hourly = {
  time?: string[];
  wave_height?: Array<number | null>;
  swell_wave_height?: Array<number | null>;
  swell_wave_period?: Array<number | null>;
  swell_wave_direction?: Array<number | null>;
  wind_speed_10m?: Array<number | null>;
  wind_direction_10m?: Array<number | null>;
};

function finiteAt(values: Array<number | null> | undefined, index: number): number | null {
  const value = values?.[index];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function utcHour(time: string): string | null {
  const date = new Date(/(?:Z|[+-]\d\d:\d\d)$/.test(time) ? time : `${time}Z`);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

export async function fetchOpenMeteoHindcastDay(
  lat: number,
  lon: number,
  dateUtc: string,
  fetchImpl: typeof fetch = fetch,
): Promise<HindcastHour[] | null> {
  const common = { latitude: String(lat), longitude: String(lon), start_date: dateUtc, end_date: dateUtc, timezone: "UTC" };
  const marine = new URL("https://marine-api.open-meteo.com/v1/marine");
  marine.search = new URLSearchParams({ ...common, hourly: "wave_height,swell_wave_height,swell_wave_period,swell_wave_direction" }).toString();
  const wind = new URL("https://historical-forecast-api.open-meteo.com/v1/forecast");
  wind.search = new URLSearchParams({ ...common, hourly: "wind_speed_10m,wind_direction_10m", wind_speed_unit: "mph" }).toString();

  try {
    const [marineResponse, windResponse] = await Promise.all([
      fetchImpl(marine.toString(), { signal: AbortSignal.timeout(10_000) }),
      fetchImpl(wind.toString(), { signal: AbortSignal.timeout(10_000) }),
    ]);
    if (!marineResponse.ok || !windResponse.ok) return null;
    const [marineJson, windJson] = await Promise.all([marineResponse.json(), windResponse.json()]);
    const marineHourly: Hourly | undefined = marineJson?.hourly;
    const windHourly: Hourly | undefined = windJson?.hourly;
    if (!Array.isArray(marineHourly?.time) && !Array.isArray(windHourly?.time)) return null;

    const hours = new Map<string, HindcastHour>();
    for (const [index, time] of (marineHourly?.time ?? []).entries()) {
      const at = utcHour(time);
      if (!at) continue;
      hours.set(at, {
        at,
        waveHeightM: finiteAt(marineHourly?.wave_height, index),
        swellHeightM: finiteAt(marineHourly?.swell_wave_height, index),
        swellPeriodS: finiteAt(marineHourly?.swell_wave_period, index),
        swellDirectionDeg: finiteAt(marineHourly?.swell_wave_direction, index),
        windSpeedMph: null,
        windDirectionDeg: null,
      });
    }
    for (const [index, time] of (windHourly?.time ?? []).entries()) {
      const at = utcHour(time);
      if (!at) continue;
      const existing = hours.get(at) ?? {
        at, waveHeightM: null, swellHeightM: null, swellPeriodS: null, swellDirectionDeg: null,
        windSpeedMph: null, windDirectionDeg: null,
      };
      existing.windSpeedMph = finiteAt(windHourly?.wind_speed_10m, index);
      existing.windDirectionDeg = finiteAt(windHourly?.wind_direction_10m, index);
      hours.set(at, existing);
    }
    return hours.size ? [...hours.values()].sort((a, b) => a.at.localeCompare(b.at)) : null;
  } catch {
    return null;
  }
}

export function hindcastToConditionsRow(hour: HindcastHour): SessionConditionsRow {
  const swellHeightFt = hour.swellHeightM === null ? null : hour.swellHeightM * METERS_TO_FEET;
  return {
    forecast_at: hour.at,
    data_source: "OPEN_METEO",
    wave_height: hour.waveHeightM === null ? null : String(hour.waveHeightM * METERS_TO_FEET),
    swell_1_height: swellHeightFt === null ? null : String(swellHeightFt),
    swell_1_period: hour.swellPeriodS === null ? null : String(hour.swellPeriodS),
    swell_1_direction: hour.swellDirectionDeg === null ? null : String(hour.swellDirectionDeg),
    swell_height_om: hour.swellHeightM,
    swell_period_om: hour.swellPeriodS,
    swell_direction_om: hour.swellDirectionDeg,
    wind_speed: hour.windSpeedMph === null ? null : String(hour.windSpeedMph),
    wind_direction_deg: hour.windDirectionDeg,
  };
}
