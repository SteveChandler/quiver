import { fetchWithTimeout } from "@/lib/utils/fetch-utils";

export type OpenMeteoMarinePoint = {
  time: string[]; // ISO strings
  wave_height: number[]; // meters
  wave_direction: number[]; // deg
  wave_period: number[]; // seconds
  wind_speed_10m: number[]; // m/s
  wind_direction_10m: number[]; // deg
};

export type OpenMeteoTidePoint = {
  time: string[];
  tide_height: number[]; // meters
};

export type OpenMeteoSunTimes = {
  sunrise: string[]; // ISO
  sunset: string[]; // ISO
};

export async function fetchOpenMeteoMarine(
  latitude: number,
  longitude: number,
  timezone: string = "UTC"
) {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    hourly:
      [
        "wave_height",
        "wave_direction",
        "wave_period",
        "wind_speed_10m",
        "wind_direction_10m",
      ].join(","),
    timezone,
  });

  const url = `https://marine-api.open-meteo.com/v1/marine?${params.toString()}`;
  const res = await fetchWithTimeout(url, { timeoutMs: 12000 });
  if (!res.ok) throw new Error(`Open-Meteo marine failed: ${res.status}`);
  return res.json();
}

export async function fetchOpenMeteoTides(
  latitude: number,
  longitude: number,
  timezone: string = "UTC"
) {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    hourly: "tide_height",
    timezone,
  });
  const url = `https://marine-api.open-meteo.com/v1/tide?${params.toString()}`;
  const res = await fetchWithTimeout(url, { timeoutMs: 12000 });
  if (!res.ok) throw new Error(`Open-Meteo tide failed: ${res.status}`);
  return res.json();
}

export async function fetchOpenMeteoSun(
  latitude: number,
  longitude: number,
  timezone: string = "UTC"
) {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    daily: ["sunrise", "sunset"].join(","),
    timezone,
  });
  const url = `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
  const res = await fetchWithTimeout(url, { timeoutMs: 12000 });
  if (!res.ok) throw new Error(`Open-Meteo sun failed: ${res.status}`);
  return res.json();
}

export function mapMarineResponse(json: any) {
  const hourly = json?.hourly || {};
  const time: string[] = hourly.time || [];
  return time.map((t: string, idx: number) => ({
    ts: new Date(t).toISOString(),
    wave_height_m: hourly.wave_height?.[idx] ?? null,
    wave_period_s: hourly.wave_period?.[idx] ?? null,
    wave_direction_deg: hourly.wave_direction?.[idx] ?? null,
    wind_speed_ms: hourly.wind_speed_10m?.[idx] ?? null,
    wind_direction_deg: hourly.wind_direction_10m?.[idx] ?? null,
    source: "open-meteo" as const,
    is_observed: false,
  }));
}

export function mapTideResponse(json: any) {
  const hourly = json?.hourly || {};
  const time: string[] = hourly.time || [];
  return time.map((t: string, idx: number) => ({
    ts: new Date(t).toISOString(),
    tide_height_m: hourly.tide_height?.[idx] ?? null,
    source: "open-meteo" as const,
  }));
}

export function mapSunResponse(json: any) {
  const daily = json?.daily || {};
  const sunrise: string[] = daily.sunrise || [];
  const sunset: string[] = daily.sunset || [];
  return sunrise.map((r: string, idx: number) => ({
    date: r.split("T")[0],
    sunrise_utc: new Date(r).toISOString(),
    sunset_utc: new Date(sunset?.[idx] ?? r).toISOString(),
    source: "open-meteo" as const,
  }));
}


