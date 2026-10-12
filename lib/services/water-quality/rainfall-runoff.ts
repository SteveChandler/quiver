import { COUNTY_FEED_COVERAGE_BOUNDS } from "@/lib/services/county-beach-advisories/types";

// Validation and station choices: docs/water-quality/2026-10-12-rainfall-source-validation.md
export const RAIN_RUNOFF_THRESHOLD_IN = 0.2;
const RAIN_WINDOW_HOURS = 72;
/** The job runs every 3 h; this tolerates one missed run before the notice lapses. */
export const RAIN_READING_MAX_AGE_MS = 7 * 60 * 60 * 1000;
const MIN_STATION_HOURS = RAIN_WINDOW_HOURS - 6;
const MAX_CLUSTER_DISTANCE_KM = 40;
const HOUR_MS = 60 * 60 * 1000;

interface RainCluster {
  id: string;
  label: string;
  lat: number;
  lon: number;
  /** The cluster uses the wetter station: a precautionary notice errs toward warning. */
  stations: readonly string[];
}

export const RAIN_CLUSTERS: readonly RainCluster[] = [
  { id: "santa_barbara", label: "Santa Barbara", lat: 34.41, lon: -119.75, stations: ["KSBA"] },
  { id: "ventura_oxnard", label: "Ventura and Oxnard", lat: 34.22, lon: -119.22, stations: ["KOXR", "KCMA"] },
  { id: "malibu_santa_monica", label: "Malibu and Santa Monica", lat: 34.03, lon: -118.68, stations: ["KSMO", "KLAX"] },
  { id: "south_bay_long_beach", label: "the South Bay and Long Beach", lat: 33.82, lon: -118.33, stations: ["KLAX", "KLGB"] },
  { id: "huntington_newport", label: "Huntington and Newport", lat: 33.64, lon: -117.97, stations: ["KLGB", "KSNA"] },
  { id: "laguna_san_clemente", label: "Laguna to San Clemente", lat: 33.48, lon: -117.7, stations: ["KSNA", "KNFG"] },
];

export const RAIN_STATIONS: readonly string[] = [...new Set(RAIN_CLUSTERS.flatMap((c) => c.stations))];

export interface AwcMetar {
  icaoId: string;
  metarType: string;
  reportTime: string;
  /** Inches in the past hour; null when the report has no precipitation group. */
  precip: number | null;
  rawOb: string;
}

export interface StationRainfall {
  total_in: number;
  hours: number;
}

export interface RainfallReading {
  cluster_id: string;
  window_end: string;
  total_in: number;
  station_totals: Record<string, number>;
}

export interface RainRunoffMetadata {
  total_in: number;
  window_end: string;
  stations: string[];
}

function km(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const rad = Math.PI / 180;
  const a = Math.sin(((lat2 - lat1) * rad) / 2) ** 2
    + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(((lon2 - lon1) * rad) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(a));
}

const round2 = (value: number): number => Math.round(value * 100) / 100;

/** Beaches the County of San Diego feed covers get the County's notices, not ours. */
export function rainClusterFor(lat: number | null | undefined, lon: number | null | undefined): RainCluster | null {
  if (lat == null || lon == null) return null;
  const b = COUNTY_FEED_COVERAGE_BOUNDS;
  if (lat >= b.minLat && lat <= b.maxLat && lon >= b.minLon && lon <= b.maxLon) return null;
  let best: RainCluster | null = null;
  let bestKm = MAX_CLUSTER_DISTANCE_KM;
  for (const cluster of RAIN_CLUSTERS) {
    const d = km(lat, lon, cluster.lat, cluster.lon);
    if (d <= bestKm) { best = cluster; bestKm = d; }
  }
  return best;
}

/** Routine reports only: a SPECI repeats the running total since the last routine report. */
export function stationRainfall(metars: readonly AwcMetar[], windowEnd: Date): StationRainfall {
  const end = windowEnd.getTime();
  const byHour = new Map<number, number>();
  for (const metar of metars) {
    if (metar.metarType !== "METAR") continue;
    const t = Date.parse(metar.reportTime);
    if (!Number.isFinite(t) || t > end || t <= end - RAIN_WINDOW_HOURS * HOUR_MS) continue;
    if (/\bPNO\b/.test(metar.rawOb)) continue;
    // AWC encodes a trace as 0.005 in; a run of trace hours would add up to a phantom notice.
    const precip = metar.precip ?? 0;
    byHour.set(Math.floor((end - t) / HOUR_MS), precip >= 0.01 ? precip : 0);
  }
  let total = 0;
  for (const value of byHour.values()) total += value;
  return { total_in: round2(total), hours: byHour.size };
}

export function clusterRainfall(stations: Readonly<Record<string, StationRainfall>>): number | null {
  const usable = Object.values(stations).filter((s) => s.hours >= MIN_STATION_HOURS);
  return usable.length ? Math.max(...usable.map((s) => s.total_in)) : null;
}

function rainRunoffReason(totalIn: number): string {
  return `Runoff after rain: ${totalIn.toFixed(2)} in fell nearby in the last 72 hours. `
    + "Bacteria levels typically rise near storm drains, creeks and river mouths after rain. "
    + "Avoid those areas and check again in 72 hours.";
}

interface NoticeRow {
  status: string;
  status_reason?: string | null;
  county_advisory_status?: string;
}

/**
 * Precautionary only: adds an advisory, never clears one, never says "good",
 * and never speaks where a County status exists.
 */
export function applyRainfallNotice<T extends NoticeRow>(
  row: T,
  reading: RainfallReading | null | undefined,
  now: Date = new Date(),
): T & { rain_runoff?: RainRunoffMetadata } {
  if (!reading || row.county_advisory_status) return row;
  if (row.status === "advisory" || row.status === "closure") return row;
  if (!(reading.total_in >= RAIN_RUNOFF_THRESHOLD_IN)) return row;
  const age = now.getTime() - Date.parse(reading.window_end);
  if (!Number.isFinite(age) || age > RAIN_READING_MAX_AGE_MS) return row;
  return {
    ...row,
    status: "advisory",
    status_reason: rainRunoffReason(reading.total_in),
    rain_runoff: { total_in: reading.total_in, window_end: reading.window_end, stations: Object.keys(reading.station_totals) },
  };
}
