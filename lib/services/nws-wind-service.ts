import { apiClient } from "@/lib/utils/api-retry";
import { ApiError, isNoaaInvalidPointError, isNoaaMarineForecastNotSupportedError } from "@/lib/errors/forecast-errors";

export type NwsHourlyWindPoint = {
  ts: string; // ISO8601 (period startTime)
  wind_speed_ms: number | null;
  wind_direction_deg: number | null;
};

type NwsHourlyForecastPeriod = {
  startTime?: string;
  endTime?: string;
  windSpeed?: string; // e.g. "12 mph", "5 to 10 mph", "15 kt", "Calm"
  windDirection?: string; // e.g. "NW"
};

function clampDegrees(deg: number): number {
  const normalized = ((deg % 360) + 360) % 360;
  return normalized;
}

/**
 * Convert a cardinal/ordinal wind direction (e.g. "NW", "SSE") to degrees.
 * Returns null for unknown/unparseable directions (including "VRB").
 */
export function parseNwsWindDirectionDeg(dir: string | null | undefined): number | null {
  if (!dir) return null;
  const upper = dir.trim().toUpperCase();
  if (!upper) return null;
  if (upper === "VRB" || upper === "VARIABLE") return null;

  // Numeric degrees are occasionally seen in some pipelines.
  const asNum = Number(upper);
  if (Number.isFinite(asNum)) return clampDegrees(asNum);

  const directionMap: Record<string, number> = {
    N: 0,
    NNE: 22.5,
    NE: 45,
    ENE: 67.5,
    E: 90,
    ESE: 112.5,
    SE: 135,
    SSE: 157.5,
    S: 180,
    SSW: 202.5,
    SW: 225,
    WSW: 247.5,
    W: 270,
    WNW: 292.5,
    NW: 315,
    NNW: 337.5,
  };

  return directionMap[upper] ?? null;
}

/**
 * Parse NWS windSpeed strings (mph or kt) to meters/second.
 * Supports ranges like "5 to 10 mph" (returns average).
 * Returns null when unknown/unparseable.
 */
export function parseNwsWindSpeedMs(windSpeed: string | null | undefined): number | null {
  if (!windSpeed) return null;
  const raw = windSpeed.trim();
  if (!raw) return null;
  if (/^calm$/i.test(raw)) return 0;

  // Extract all numbers in the string. NWS uses formats like:
  // - "12 mph"
  // - "5 to 10 mph"
  // - "5 mph"
  // - "15 kt"
  const nums = raw.match(/\d+(?:\.\d+)?/g)?.map((n) => Number(n)).filter((n) => Number.isFinite(n)) ?? [];
  if (!nums.length) return null;

  const unit = raw.toLowerCase().includes("kt")
    ? "kt"
    : raw.toLowerCase().includes("kts")
    ? "kt"
    : raw.toLowerCase().includes("mph")
    ? "mph"
    : null;

  if (!unit) return null;

  const value = nums.length >= 2 ? (nums[0] + nums[1]) / 2 : nums[0];
  if (!Number.isFinite(value)) return null;

  if (unit === "mph") return value * 0.44704;
  return value * 0.514444; // knots to m/s
}

function parseIso(ts: string | null | undefined): number | null {
  if (!ts) return null;
  const ms = new Date(ts).getTime();
  return Number.isFinite(ms) ? ms : null;
}

export class NwsWindService {
  private readonly userAgent = "quiver-surf-app/1.0 (contact@quiver-surf.com)";

  /**
   * Fetch NWS hourly wind periods and return normalized points.
   * Returns [] for expected no-coverage conditions.
   */
  async fetchHourlyWindPoints(params: {
    lat: number;
    lon: number;
    start: Date;
    end: Date;
  }): Promise<NwsHourlyWindPoint[]> {
    const { lat, lon, start, end } = params;

    const startMs = start.getTime();
    const endMs = end.getTime();

    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
      return [];
    }

    const pointsUrl = `https://api.weather.gov/points/${lat},${lon}`;

    try {
      const pointsResp = await apiClient.fetchNOAAData(pointsUrl, {
        headers: { Accept: "application/geo+json" },
      });

      if (!pointsResp.ok) {
        throw new ApiError(pointsUrl, pointsResp.status, await pointsResp.text());
      }

      const pointsData = await pointsResp.json();
      const hourlyUrl: string | null = pointsData?.properties?.forecastHourly ?? null;
      const fallbackUrl: string | null = pointsData?.properties?.forecast ?? null;

      // Some points (e.g. offshore) do not have hourly or any forecast URL.
      if (!hourlyUrl && !fallbackUrl) return [];

      const fetchForecast = async (url: string): Promise<NwsHourlyForecastPeriod[]> => {
        const resp = await apiClient.fetchNOAAData(url, {
          headers: {
            Accept: "application/geo+json",
            "User-Agent": this.userAgent,
          },
        });
        if (!resp.ok) {
          throw new ApiError(url, resp.status, await resp.text());
        }
        const json = await resp.json();
        return (json?.properties?.periods ?? []) as NwsHourlyForecastPeriod[];
      };

      let periods: NwsHourlyForecastPeriod[] = [];

      try {
        if (hourlyUrl) {
          periods = await fetchForecast(hourlyUrl);
        }
      } catch (err) {
        // Expected for some marine/offshore points
        if (!isNoaaMarineForecastNotSupportedError(err)) {
          throw err;
        }
      }

      if (!periods.length && fallbackUrl) {
        periods = await fetchForecast(fallbackUrl);
      }

      if (!Array.isArray(periods) || periods.length === 0) return [];

      const results: NwsHourlyWindPoint[] = [];

      for (const p of periods) {
        const ts = p.startTime ?? null;
        const tsMs = parseIso(ts);
        if (tsMs == null) continue;
        if (tsMs < startMs || tsMs > endMs) continue;

        results.push({
          ts: new Date(tsMs).toISOString(),
          wind_speed_ms: parseNwsWindSpeedMs(p.windSpeed ?? null),
          wind_direction_deg: parseNwsWindDirectionDeg(p.windDirection ?? null),
        });
      }

      // Deduplicate by exact timestamp (keep the first non-null values if duplicates exist)
      const byTs = new Map<string, NwsHourlyWindPoint>();
      for (const r of results) {
        const existing = byTs.get(r.ts);
        if (!existing) {
          byTs.set(r.ts, r);
          continue;
        }
        byTs.set(r.ts, {
          ts: r.ts,
          wind_speed_ms: existing.wind_speed_ms ?? r.wind_speed_ms,
          wind_direction_deg: existing.wind_direction_deg ?? r.wind_direction_deg,
        });
      }

      return Array.from(byTs.values()).sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0));
    } catch (err) {
      // Treat InvalidPoint (outside coverage) as no-wind-coverage.
      if (isNoaaInvalidPointError(err)) return [];
      // Treat known "no hourly coverage" as empty.
      if (isNoaaMarineForecastNotSupportedError(err)) return [];
      throw err;
    }
  }
}









