import type { SwellEventForecastRow } from "./detector";

// GFS-Wave carries swell partitions to day 16. The stored forecast's default model stops near day 10.
const GFS_MODEL = "ncep_gfswave025";
const GFS_FORECAST_DAYS = 16;
// The detector's baseline reaches 48 h back.
const GFS_PAST_DAYS = 2;
// Far enough out that the 0.25° cell is open water: coastal cells are often land-masked and read 0 m.
const OFFSHORE_STEP_DEG = 0.5;
const FEET_PER_METER = 3.281;
const ROW_STEP_HOURS = 3;
const HOURLY = [
  "swell_wave_height",
  "swell_wave_period",
  "swell_wave_peak_period",
  "swell_wave_direction",
  "secondary_swell_wave_height",
  "secondary_swell_wave_period",
  "secondary_swell_wave_direction",
];

type Series = ReadonlyArray<number | null | undefined>;

export interface GfsHourly {
  time?: readonly number[];
  swell_wave_height?: Series;
  swell_wave_period?: Series;
  swell_wave_peak_period?: Series;
  swell_wave_direction?: Series;
  secondary_swell_wave_height?: Series;
  secondary_swell_wave_period?: Series;
  secondary_swell_wave_direction?: Series;
}

const RAD = Math.PI / 180;

/**
 * Half a degree seaward of the region's centre, along the beaches' mean facing (a beach's swell-window
 * centre when it has no facing); null when no beach has either.
 */
export function regionOffshorePoint(
  beaches: ReadonlyArray<{ lat: number; lon: number; aspect_deg: number | null; swell_window_center_deg?: number | null }>,
): { lat: number; lon: number } | null {
  const facings = beaches
    .map((beach) => beach.aspect_deg ?? beach.swell_window_center_deg ?? null)
    .filter((facing): facing is number => facing !== null && Number.isFinite(facing));
  if (facings.length === 0) return null;
  // Bearings average as vectors, so 350° and 10° face north.
  const east = facings.reduce((sum, facing) => sum + Math.sin(facing * RAD), 0);
  const north = facings.reduce((sum, facing) => sum + Math.cos(facing * RAD), 0);
  const facing = Math.atan2(east, north);
  const lat = beaches.reduce((sum, beach) => sum + beach.lat, 0) / beaches.length;
  const lon = beaches.reduce((sum, beach) => sum + beach.lon, 0) / beaches.length;
  return {
    lat: lat + OFFSHORE_STEP_DEG * Math.cos(facing),
    lon: lon + (OFFSHORE_STEP_DEG * Math.sin(facing)) / Math.cos(lat * RAD),
  };
}

function finite(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function partition(heightM: number | null, periodS: number | null, directionDeg: number | null) {
  if (heightM === null || heightM <= 0) return { height: null, period: null, direction: null };
  return {
    height: `${(heightM * FEET_PER_METER).toFixed(1)} ft`,
    period: periodS === null ? null : `${periodS}s`,
    direction: directionDeg === null ? null : String(directionDeg),
  };
}

/**
 * Three-hourly rows in the stored forecast's shape, for the swell detector. Null when the primary
 * swell is zero or missing at every hour: that is a land-masked cell, not a flat ocean.
 */
export function gfsRowsFromHourly(hourly: GfsHourly | undefined): SwellEventForecastRow[] | null {
  const times = hourly?.time ?? [];
  if (!times.some((_, index) => (finite(hourly?.swell_wave_height?.[index]) ?? 0) > 0)) return null;

  return times.flatMap((seconds, index): SwellEventForecastRow[] => {
    const at = new Date(seconds * 1000);
    if (at.getUTCHours() % ROW_STEP_HOURS !== 0) return [];
    const primary = partition(
      finite(hourly?.swell_wave_height?.[index]),
      finite(hourly?.swell_wave_peak_period?.[index]) ?? finite(hourly?.swell_wave_period?.[index]),
      finite(hourly?.swell_wave_direction?.[index]),
    );
    const secondary = partition(
      finite(hourly?.secondary_swell_wave_height?.[index]),
      finite(hourly?.secondary_swell_wave_period?.[index]),
      finite(hourly?.secondary_swell_wave_direction?.[index]),
    );
    return [{
      forecast_at: at.toISOString(),
      swell_1_height: primary.height,
      swell_1_period: primary.period,
      swell_1_direction: primary.direction,
      swell_2_height: secondary.height,
      swell_2_period: secondary.period,
      swell_2_direction: secondary.direction,
      data_source: "OPEN_METEO",
    }];
  });
}

/** GFS-Wave swell partitions at one offshore point, from two days back to day 16; null when unreachable or masked. */
export async function fetchGfsTailRows(point: { lat: number; lon: number }): Promise<SwellEventForecastRow[] | null> {
  const url = new URL("https://marine-api.open-meteo.com/v1/marine");
  url.search = new URLSearchParams({
    latitude: String(Math.round(point.lat * 1000) / 1000),
    longitude: String(Math.round(point.lon * 1000) / 1000),
    hourly: HOURLY.join(","),
    models: GFS_MODEL,
    forecast_days: String(GFS_FORECAST_DAYS),
    past_days: String(GFS_PAST_DAYS),
    timezone: "UTC",
    timeformat: "unixtime",
  }).toString();

  try {
    // GFS-Wave runs every 6 h; one fetch per region per 3 h serves every beach in it.
    const response = await fetch(url, { signal: AbortSignal.timeout(8_000), next: { revalidate: 10_800 } });
    if (!response.ok) {
      console.warn("[gfs-tail] Open-Meteo HTTP failure", { status: response.status, point });
      return null;
    }
    return gfsRowsFromHourly((await response.json())?.hourly);
  } catch (error) {
    console.warn("[gfs-tail] Open-Meteo fetch failed", { point, error: String(error) });
    return null;
  }
}
