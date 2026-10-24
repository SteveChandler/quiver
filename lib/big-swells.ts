import { haversineKm } from "@/lib/climatology/geo";
import type { NdbcRecord } from "@/lib/climatology/parse-ndbc";

/** One big swell measured at an NDBC buoy: significant wave height (Hs) and peak period (DPD). */
interface BigSwell {
  at: string;
  hsM: number;
  periodS: number | null;
  dirDeg: number | null;
  /** "Hurricane Sandy" when a named tropical cyclone (NHC HURDAT2) was near the buoy; otherwise absent. */
  name?: string;
}

/** A named Atlantic or Pacific tropical cyclone from NHC's HURDAT2 best-track file. */
export interface TropicalCyclone {
  name: string;
  fixes: { timeUtcMs: number; lat: number; lon: number }[];
}

export interface BigSwellBuoy {
  id: string;
  name: string;
  lat: number;
  lon: number;
  since: string;
  through: string;
  /** 99th percentile of hourly peak Hs: the floor for a "big swell" at this buoy. */
  bigHsM: number;
  /** Median buoy/model Hs over recent hours; null when unmeasured. Far from 1 means the model can't stand in for this buoy. */
  modelRatio: number | null;
  /** Tallest first. */
  biggest: BigSwell[];
  /** Every big swell in the 5 years before the newest reading (at least 5), newest first. */
  recent: BigSwell[];
}

const PEAK_SEPARATION_MS = 72 * 3_600_000;
const SPIKE_WINDOW_MS = 3 * 3_600_000;
const BIGGEST_KEPT = 10;
const RECENT_KEPT = 5;
const RECENT_YEARS_MS = 5 * 365.25 * 24 * 3_600_000;
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

  // One value per hour, so 10-minute years don't outweigh hourly ones.
  const hourly = new Map<number, number>();
  for (const record of sorted) {
    const hour = Math.floor(record.timeUtcMs / 3_600_000);
    hourly.set(hour, Math.max(hourly.get(hour) ?? 0, record.waveHeightM ?? 0));
  }
  const heights = [...hourly.values()].sort((a, b) => a - b);
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

  // Every storm of the last 5 years, so "biggest since" can be proven anywhere inside them.
  const newest = sorted[sorted.length - 1].timeUtcMs;
  const recent = [...peaks]
    .sort((a, b) => b.timeUtcMs - a.timeUtcMs)
    .filter((peak, index) => index < RECENT_KEPT || peak.timeUtcMs >= newest - RECENT_YEARS_MS);
  return {
    bigHsM,
    biggest: peaks.slice(0, BIGGEST_KEPT).map(toEvent),
    recent: recent.map(toEvent),
  };
}

/** Whether the wave model reads close enough to this buoy for a forecast-vs-history comparison. */
export function modelTracksBuoy(buoy: BigSwellBuoy): boolean {
  return buoy.modelRatio !== null && buoy.modelRatio >= 0.8 && buoy.modelRatio <= 1.25;
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
  now: number = Date.now(),
): {
  isBig: boolean;
  rank: number | null;
  closest: BigSwell | null;
  biggestSince: BigSwell | null;
  beats: BigSwell[];
} {
  const isBig = hsM >= buoy.bigHsM;
  const rank = buoy.biggest.filter((event) => event.hsM > hsM).length + 1;
  const pool = [...buoy.biggest, ...buoy.recent];
  const closest =
    isBig && pool.length > 0
      ? pool.reduce((a, b) => (Math.abs(b.hsM - hsM) < Math.abs(a.hsM - hsM) ? b : a))
      : null;
  const since = isBig ? biggestSince(hsM, buoy) : null;
  return {
    isBig,
    rank: rank <= buoy.biggest.length ? rank : null,
    closest,
    biggestSince: since,
    beats: isBig ? stormsBeaten(hsM, pool, since, now) : [],
  };
}

const BEATS_SHOWN = 3;
const RECENT_WINDOW_MS = 5 * 365.25 * 24 * 3_600_000;

/**
 * The biggest stored storms this swell is at least as big as, from the last 5 years. Older storms
 * only come in when nothing in those 5 years was bigger, so a merely big swell isn't compared with
 * the 1990s.
 */
function stormsBeaten(hsM: number, pool: BigSwell[], since: BigSwell | null, now: number): BigSwell[] {
  const cutoff = now - RECENT_WINDOW_MS;
  const epic = !since || Date.parse(since.at) < cutoff;
  // `biggest` and `recent` can share a storm.
  const unique = [...new Map(pool.map((event) => [event.at, event])).values()];
  return unique
    .filter((event) => event.hsM <= hsM && (epic || Date.parse(event.at) >= cutoff))
    .sort((a, b) => b.hsM - a.hsM)
    .slice(0, BEATS_SHOWN);
}

/**
 * The newest stored swell at least this big, when the stored lists prove nothing newer was:
 * `recent` holds the newest big swells without gaps, and `biggest` holds every swell at or above
 * its smallest member.
 */
function biggestSince(hsM: number, buoy: BigSwellBuoy): BigSwell | null {
  const newest = (events: BigSwell[]): BigSwell | null =>
    events.filter((event) => event.hsM >= hsM).sort((a, b) => b.at.localeCompare(a.at))[0] ?? null;
  const fromRecent = newest(buoy.recent);
  if (fromRecent) return fromRecent;
  const smallestBiggest = Math.min(...buoy.biggest.map((event) => event.hsM));
  return buoy.biggest.length > 0 && hsM >= smallestBiggest ? newest(buoy.biggest) : null;
}

/** Reads NHC HURDAT2 text: named storms that reached tropical-storm or hurricane strength. */
export function parseHurdat2(text: string): TropicalCyclone[] {
  const storms: TropicalCyclone[] = [];
  let current: (TropicalCyclone & { hurricane: boolean; tropical: boolean }) | null = null;
  const finish = (): void => {
    if (current && current.tropical && current.name !== "UNNAMED") {
      const name = current.name.charAt(0) + current.name.slice(1).toLowerCase();
      storms.push({ name: `${current.hurricane ? "Hurricane" : "Tropical Storm"} ${name}`, fixes: current.fixes });
    }
  };
  for (const line of text.split(/\r?\n/)) {
    const cols = line.split(",").map((col) => col.trim());
    if (/^[A-Z]{2}\d{6}$/.test(cols[0] ?? "")) {
      finish();
      current = { name: cols[1], fixes: [], hurricane: false, tropical: false };
      continue;
    }
    if (!current || !/^\d{8}$/.test(cols[0] ?? "")) continue;
    const [date, time, , status, latText, lonText] = cols;
    const lat = Number.parseFloat(latText) * (latText.endsWith("S") ? -1 : 1);
    const lon = Number.parseFloat(lonText) * (lonText.endsWith("W") ? -1 : 1);
    const timeUtcMs = Date.UTC(+date.slice(0, 4), +date.slice(4, 6) - 1, +date.slice(6, 8), +time.slice(0, 2), +time.slice(2, 4));
    current.fixes.push({ timeUtcMs, lat, lon });
    if (status === "HU") current.hurricane = true;
    if (status === "HU" || status === "TS") current.tropical = true;
  }
  finish();
  return storms;
}

const STORM_RADIUS_KM = 800;
const STORM_LEAD_MS = 72 * 3_600_000;
const STORM_LAG_MS = 12 * 3_600_000;

/** The named cyclone that passed closest to the buoy in the 3 days before a swell peaked, within 800 km. */
export function stormNameFor(
  at: string,
  buoy: { lat: number; lon: number },
  storms: TropicalCyclone[],
): string | undefined {
  const peak = Date.parse(at);
  let best: { name: string; km: number } | undefined;
  for (const storm of storms) {
    const first = storm.fixes[0]?.timeUtcMs ?? Infinity;
    const last = storm.fixes[storm.fixes.length - 1]?.timeUtcMs ?? -Infinity;
    if (first > peak + STORM_LAG_MS || last < peak - STORM_LEAD_MS) continue;
    for (const fix of storm.fixes) {
      if (fix.timeUtcMs < peak - STORM_LEAD_MS || fix.timeUtcMs > peak + STORM_LAG_MS) continue;
      const km = haversineKm(buoy, fix);
      if (km <= STORM_RADIUS_KM && (!best || km < best.km)) best = { name: storm.name, km };
    }
  }
  return best?.name;
}
