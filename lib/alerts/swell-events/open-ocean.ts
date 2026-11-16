import { angleDifference } from "@/lib/domains/shared/angle-utils";

import { regionOffshorePoint } from "./gfs-tail";

/**
 * The open-ocean swells behind a region's beach detections. Near-beach partitions (CDIP MOP points,
 * coastal model cells) show one swell from the direction it bends to at each beach: on Nov 14, 2026 a
 * 306° NW groundswell (buoy 46219) read W at south San Diego and SW at Oceanside, and the region showed
 * it as three swells. Surfers name a swell by its open-ocean direction, so the region names it from
 * GFS-Wave at a point past the islands. Backtest: docs/forecast/open-ocean-naming-backtest.md.
 */

const GFS_MODEL = "ncep_gfswave025";
const FORECAST_DAYS = 16;
const PAST_DAYS = 2;
// 1.5° along the beaches' facing clears the Channel Islands and the San Diego bight; 0.5° (the GFS
// tail's point) sits inside them and reads the NW swells as W.
export const OPEN_OCEAN_STEP_DEG = 1.5;
const FEET_PER_METER = 3.281;
const HOUR_MS = 3_600_000;
const SAMPLE_STEP_HOURS = 3;
const MIN_PART_HEIGHT_FT = 0.5;
// One partition per sample continues a track when it is this close to the track's last point.
const TRACK_GAP_MS = 6 * HOUR_MS;
const TRACK_TURN_DEG = 30;
const TRACK_PERIOD_S = 2.5;
// A track splits at a trough this much below the peaks on both sides: a new swell behind the last.
const SPLIT_RISE_RATIO = 1.25;
// A swell is in the water at a run's peak when one of its samples is this close to it.
const PRESENCE_MS = SAMPLE_STEP_HOURS * HOUR_MS;
// Coastal model cells read the same swell several seconds shorter than CDIP points do.
const MATCH_PERIOD_S = 8;
// Islands bend a NW swell up to ~100° on its way to a south-facing beach. A wider gap is another swell.
const MATCH_BEND_DEG = 105;
// Near the beach a swell reads at most about this multiple of its open-ocean height, so a small
// partition cannot be the source of a big beach run.
const MATCH_MAX_GROWTH = 1.5;
// A groundswell run cannot come from short-period open-ocean sea: a 12 s north swell at Oahu took
// the name of a 7.7 s east trade swell. GFS mean period runs a few seconds under the 11 s+ peak
// periods of near-beach swell runs, so the floor sits below them.
const MATCH_MIN_PERIOD_S = 8.5;
const MIN_TRACK_SAMPLES = 3;

const HOURLY = [
  "swell_wave_height", "swell_wave_period", "swell_wave_direction",
  "secondary_swell_wave_height", "secondary_swell_wave_period", "secondary_swell_wave_direction",
  "tertiary_swell_wave_height", "tertiary_swell_wave_period", "tertiary_swell_wave_direction",
] as const;
const PARTITIONS = [
  ["swell_wave_height", "swell_wave_period", "swell_wave_direction"],
  ["secondary_swell_wave_height", "secondary_swell_wave_period", "secondary_swell_wave_direction"],
  ["tertiary_swell_wave_height", "tertiary_swell_wave_period", "tertiary_swell_wave_direction"],
] as const;

type Series = ReadonlyArray<number | null | undefined>;
type OpenOceanHourly = { time?: readonly number[] } & Partial<Record<(typeof HOURLY)[number], Series>>;

export interface OpenOceanPart {
  heightFt: number;
  /** Mean period: GFS gives peak period only for the primary partition, and partitions trade places. */
  periodS: number;
  directionDeg: number;
}

export interface OpenOceanSample {
  atMs: number;
  parts: OpenOceanPart[];
}

/** One open-ocean swell: a tracked partition from one trough to the next. */
export interface OpenOceanSwell {
  points: ReadonlyArray<{ atMs: number; part: OpenOceanPart }>;
  peakMs: number;
  peakHeightFt: number;
}

/** The open-ocean swell behind a run, as it reads at the run's peak. */
export interface OpenOceanMatch extends OpenOceanPart {
  swell: OpenOceanSwell;
}

/** The near-beach run a region event comes from, as matching reads it. */
export interface BeachRunShape {
  directionDeg: number;
  periodS: number;
  peakAt: string;
  /** The run's near-beach partition height at its peak. */
  heightFt: number;
}

function finite(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Points along the region beaches' mean facing, far enough out to be past the islands. */
export function regionOpenOceanPoint(
  beaches: ReadonlyArray<{ lat: number; lon: number; aspect_deg: number | null; swell_window_center_deg?: number | null }>,
): { lat: number; lon: number } | null {
  return regionOffshorePoint(beaches, OPEN_OCEAN_STEP_DEG);
}

/** Three-hourly samples of every partition; null when no partition ever has height (a land-masked cell). */
export function samplesFromHourly(hourly: OpenOceanHourly | undefined): OpenOceanSample[] | null {
  const times = hourly?.time ?? [];
  const samples = times.flatMap((seconds, index): OpenOceanSample[] => {
    const atMs = seconds * 1000;
    if (new Date(atMs).getUTCHours() % SAMPLE_STEP_HOURS !== 0) return [];
    const parts = PARTITIONS.flatMap(([heightKey, periodKey, directionKey]): OpenOceanPart[] => {
      const heightM = finite(hourly?.[heightKey]?.[index]);
      const periodS = finite(hourly?.[periodKey]?.[index]);
      const directionDeg = finite(hourly?.[directionKey]?.[index]);
      if (heightM === null || periodS === null || directionDeg === null || periodS <= 0) return [];
      const heightFt = heightM * FEET_PER_METER;
      return heightFt >= MIN_PART_HEIGHT_FT ? [{ heightFt, periodS, directionDeg }] : [];
    });
    return [{ atMs, parts }];
  });
  return samples.some((sample) => sample.parts.length > 0) ? samples : null;
}

/** GFS-Wave partitions at the open-ocean point, two days back to day 16; null when unreachable or masked. */
export async function fetchOpenOceanSamples(point: { lat: number; lon: number }): Promise<OpenOceanSample[] | null> {
  const url = new URL("https://marine-api.open-meteo.com/v1/marine");
  url.search = new URLSearchParams({
    latitude: String(Math.round(point.lat * 1000) / 1000),
    longitude: String(Math.round(point.lon * 1000) / 1000),
    hourly: HOURLY.join(","),
    models: GFS_MODEL,
    forecast_days: String(FORECAST_DAYS),
    past_days: String(PAST_DAYS),
    timezone: "UTC",
    timeformat: "unixtime",
  }).toString();
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(8_000), next: { revalidate: 10_800 } });
    if (!response.ok) {
      console.warn("[open-ocean] Open-Meteo HTTP failure", { status: response.status, point });
      return null;
    }
    return samplesFromHourly((await response.json())?.hourly);
  } catch (error) {
    console.warn("[open-ocean] Open-Meteo fetch failed", { point, error: String(error) });
    return null;
  }
}

type TrackPoint = { atMs: number; part: OpenOceanPart };

/** Each partition joins the closest track still open in direction and period; one partition per track per sample. */
function buildTracks(samples: readonly OpenOceanSample[]): TrackPoint[][] {
  const tracks: TrackPoint[][] = [];
  for (const sample of [...samples].sort((left, right) => left.atMs - right.atMs)) {
    const taken = new Set<TrackPoint[]>();
    for (const part of [...sample.parts].sort((left, right) => right.heightFt - left.heightFt)) {
      let best: TrackPoint[] | null = null;
      let bestScore = Number.POSITIVE_INFINITY;
      for (const track of tracks) {
        if (taken.has(track)) continue;
        const last = track[track.length - 1];
        if (sample.atMs - last.atMs > TRACK_GAP_MS) continue;
        const turn = angleDifference(last.part.directionDeg, part.directionDeg);
        const drift = Math.abs(last.part.periodS - part.periodS);
        if (turn > TRACK_TURN_DEG || drift > TRACK_PERIOD_S) continue;
        const score = turn / TRACK_TURN_DEG + drift / TRACK_PERIOD_S;
        if (score < bestScore) {
          best = track;
          bestScore = score;
        }
      }
      const track = best ?? [];
      if (!best) tracks.push(track);
      track.push({ atMs: sample.atMs, part });
      taken.add(track);
    }
  }
  return tracks;
}

/** A track splits where it troughs between two peaks that each stand SPLIT_RISE_RATIO above the trough. */
function splitAtTroughs(track: readonly TrackPoint[]): TrackPoint[][] {
  const height = (index: number): number => track[index].part.heightFt;
  const segments: TrackPoint[][] = [];
  let start = 0;
  // The highest point of this segment so far, and the lowest point after it.
  let peak = 0;
  let trough = 0;
  for (let index = 1; index < track.length; index += 1) {
    if (trough === peak) {
      if (height(index) >= height(peak)) peak = index;
      trough = index;
      continue;
    }
    if (height(index) < height(trough)) {
      trough = index;
    } else if (height(index) >= SPLIT_RISE_RATIO * height(trough) && height(peak) >= SPLIT_RISE_RATIO * height(trough)) {
      segments.push(track.slice(start, trough + 1));
      start = trough;
      peak = index;
      trough = index;
    } else if (height(index) > height(peak)) {
      peak = index;
      trough = index;
    }
  }
  segments.push(track.slice(start));
  return segments;
}

function swellOf(segment: readonly TrackPoint[]): OpenOceanSwell {
  const peak = segment.reduce((best, point) => (point.part.heightFt > best.part.heightFt ? point : best));
  return { points: segment, peakMs: peak.atMs, peakHeightFt: peak.part.heightFt };
}

/** Every distinct swell at the open-ocean point: partitions tracked over time, split at troughs. */
export function openOceanSwells(samples: readonly OpenOceanSample[]): OpenOceanSwell[] {
  return buildTracks(samples)
    .filter((track) => track.length >= MIN_TRACK_SAMPLES)
    .flatMap(splitAtTroughs)
    .filter((segment) => segment.length >= MIN_TRACK_SAMPLES)
    .map(swellOf);
}

/**
 * The open-ocean swell a beach run comes from, read at the run's peak: one in the water then, within
 * the period and bend limits, and big enough to make the run. Of several, the closest in direction
 * wins, so a real south swell beside a NW one keeps its own, while the small steady south swell under
 * a big NW one cannot claim a 4 ft bent copy of the NW. Null when none fits.
 */
export function matchOpenOceanSwell(run: BeachRunShape, swells: readonly OpenOceanSwell[]): OpenOceanMatch | null {
  const peakMs = Date.parse(run.peakAt);
  const fits = swells.flatMap((swell): OpenOceanMatch[] => {
    let nearest: TrackPoint | null = null;
    for (const point of swell.points) {
      const gap = Math.abs(point.atMs - peakMs);
      if (gap <= PRESENCE_MS && (!nearest || gap < Math.abs(nearest.atMs - peakMs))) nearest = point;
    }
    if (!nearest) return [];
    const { part } = nearest;
    const fits = part.periodS >= MATCH_MIN_PERIOD_S
      && Math.abs(part.periodS - run.periodS) <= MATCH_PERIOD_S
      && angleDifference(part.directionDeg, run.directionDeg) <= MATCH_BEND_DEG
      && part.heightFt * MATCH_MAX_GROWTH >= run.heightFt;
    return fits ? [{ ...part, swell }] : [];
  });
  fits.sort((left, right) => angleDifference(left.directionDeg, run.directionDeg) - angleDifference(right.directionDeg, run.directionDeg)
    || right.heightFt - left.heightFt);
  return fits[0] ?? null;
}
