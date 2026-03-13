/**
 * Open-Meteo Weather API wind service.
 *
 * Fetches hourly 10m wind speed, direction, and gusts from the Open-Meteo
 * Weather API (NOT the Marine API we already use for waves).
 *
 * Free tier: 10,000 requests/day. We use ~273 req/hour = ~6,552/day.
 *
 * @see https://open-meteo.com/en/docs
 */

import { createContextLogger } from '@/lib/logger';

const log = createContextLogger('OpenMeteoWind');

const BASE_URL = 'https://api.open-meteo.com/v1/forecast';

export interface OpenMeteoWindPoint {
  ts: string;             // ISO8601 UTC
  wind_speed_mph: number | null;
  wind_direction_deg: number | null;
  wind_gust_mph: number | null;
}

interface OpenMeteoHourlyResponse {
  hourly?: {
    time?: string[];
    wind_speed_10m?: (number | null)[];
    wind_direction_10m?: (number | null)[];
    wind_gusts_10m?: (number | null)[];
  };
}

/**
 * Build the Open-Meteo Weather API URL for hourly wind data.
 * Requests 48 hours of forecast data.
 */
export function buildOpenMeteoWindUrl(lat: number, lon: number): string {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    hourly: 'wind_speed_10m,wind_direction_10m,wind_gusts_10m',
    wind_speed_unit: 'mph',
    forecast_days: '2',
    timezone: 'UTC',
  });
  return `${BASE_URL}?${params.toString()}`;
}

/**
 * Parse the Open-Meteo hourly response into typed wind points.
 * Wind speed is already in mph (requested via wind_speed_unit=mph).
 */
export function parseOpenMeteoWindResponse(
  data: OpenMeteoHourlyResponse
): OpenMeteoWindPoint[] {
  const hourly = data?.hourly;
  if (!hourly?.time?.length) return [];

  const times = hourly.time;
  const speeds = hourly.wind_speed_10m || [];
  const directions = hourly.wind_direction_10m || [];
  const gusts = hourly.wind_gusts_10m || [];

  return times.map((t, i) => ({
    ts: new Date(t + 'Z').toISOString(),
    wind_speed_mph: speeds[i] != null ? Math.round(speeds[i]!) : null,
    wind_direction_deg: directions[i] != null ? Math.round(directions[i]!) : null,
    wind_gust_mph: gusts[i] != null ? Math.round(gusts[i]!) : null,
  }));
}

/**
 * Fetch hourly wind for a single beach location.
 * Returns up to 48 hours of wind data.
 */
export async function fetchHourlyWind(
  lat: number,
  lon: number
): Promise<OpenMeteoWindPoint[]> {
  const url = buildOpenMeteoWindUrl(lat, lon);

  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'QuiverSurf/1.0 (wind-cron)' },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      log.warn(`Open-Meteo wind API returned ${response.status} for ${lat},${lon}`);
      return [];
    }

    const data: OpenMeteoHourlyResponse = await response.json();
    return parseOpenMeteoWindResponse(data);
  } catch (err) {
    log.warn(`Open-Meteo wind fetch failed for ${lat},${lon}:`, err);
    return [];
  }
}
