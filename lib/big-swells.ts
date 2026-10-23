import { haversineKm } from "@/lib/climatology/geo";
import type { NdbcRecord } from "@/lib/climatology/parse-ndbc";

/** One big swell measured at an NDBC buoy: significant wave height (Hs) and peak period (DPD). */
interface BigSwell {
  at: string;
  hsM: number;
  periodS: number | null;
  dirDeg: number | null;
}

export interface BigSwellBuoy {
  id: string;
  name: string;
  lat: number;
  lon: number;
  since: string;
  through: string;
  /** 99th percentile of every Hs reading: the floor for a "big swell" at this buoy. */
  bigHsM: number;
  /** Tallest first. */
  biggest: BigSwell[];
  /** Newest first. */
  recent: BigSwell[];
}

const PEAK_SEPARATION_MS = 72 * 3_600_000;
const SPIKE_WINDOW_MS = 3 * 3_600_000;
const BIGGEST_KEPT = 10;
const RECENT_KEPT = 5;
const MAX_BUOY_DISTANCE_KM = 100;

function toEvent(record: NdbcRecord): BigSwell {
  return {
    at: new Date(record.timeUtcMs).toISOString(),
    hsM: record.waveHeightM ?? 0,
    periodS: record.dominantPeriodS,
    dirDeg: record.meanWaveDirDeg,
  };
}

/** A lone tall reading is a sensor glitch; a real swell keeps neighbours near its peak. */
function isSustained(sorted: NdbcRecord[], index: number): boolean {
  const peak = sorted[index];
  const floor = (peak.waveHeightM ?? 0) * 0.7;
  let neighbours = 0;
  for (const step of [-1, 1]) {
    for (let i = index + step; i >= 0 && i < sorted.length; i += step) {
      if (Math.abs(sorted[i].timeUtcMs - peak.timeUtcMs) > SPIKE_WINDOW_MS) break;
      if ((sorted[i].waveHeightM ?? 0) >= floor) neighbours += 1;
    }
  }
  return neighbours >= 2;
}

/** Declustered Hs peaks above the buoy's 99th percentile, at least 72 h apart. */
export function pickBigSwells(records: NdbcRecord[]): {
  bigHsM: number;
  biggest: BigSwell[];
  recent: BigSwell[];
} {
  const sorted = records
    .filter((record) => record.waveHeightM !== null)
    .sort((a, b) => a.timeUtcMs - b.timeUtcMs);
  if (sorted.length === 0) return { bigHsM: 0, biggest: [], recent: [] };

  const heights = sorted.map((record) => record.waveHeightM ?? 0).sort((a, b) => a - b);
  const bigHsM = heights[Math.floor(heights.length * 0.99)];

  const candidates = sorted
    .map((record, index) => ({ record, index }))
    .filter(({ record }) => (record.waveHeightM ?? 0) >= bigHsM)
    .sort((a, b) => (b.record.waveHeightM ?? 0) - (a.record.waveHeightM ?? 0));

  const peaks: NdbcRecord[] = [];
  for (const { record, index } of candidates) {
    if (peaks.some((peak) => Math.abs(peak.timeUtcMs - record.timeUtcMs) < PEAK_SEPARATION_MS)) continue;
    if (!isSustained(sorted, index)) continue;
    peaks.push(record);
  }

  const recent = [...peaks].sort((a, b) => b.timeUtcMs - a.timeUtcMs).slice(0, RECENT_KEPT);
  return {
    bigHsM,
    biggest: peaks.slice(0, BIGGEST_KEPT).map(toEvent),
    recent: recent.map(toEvent),
  };
}

export function nearestBigSwellBuoy(
  buoys: BigSwellBuoy[],
  beach: { lat: number; lon: number },
): { buoy: BigSwellBuoy; distanceKm: number } | null {
  // ponytail: distance only; add the swell-window overlap test from get_beach_observation_station if a sheltered buoy wins.
  let best: { buoy: BigSwellBuoy; distanceKm: number } | null = null;
  for (const buoy of buoys) {
    const distanceKm = haversineKm(beach, buoy);
    if (distanceKm > MAX_BUOY_DISTANCE_KM) continue;
    if (!best || distanceKm < best.distanceKm) best = { buoy, distanceKm };
  }
  return best;
}

/** Where a forecast Hs would sit among the buoy's measured big swells (same quantity, same point). */
export function compareToBigSwells(
  hsM: number,
  buoy: BigSwellBuoy,
): { isBig: boolean; rank: number | null; closest: BigSwell | null } {
  const isBig = hsM >= buoy.bigHsM;
  const rank = buoy.biggest.filter((event) => event.hsM > hsM).length + 1;
  const pool = [...buoy.biggest, ...buoy.recent];
  const closest =
    isBig && pool.length > 0
      ? pool.reduce((a, b) => (Math.abs(b.hsM - hsM) < Math.abs(a.hsM - hsM) ? b : a))
      : null;
  return { isBig, rank: rank <= buoy.biggest.length ? rank : null, closest };
}
