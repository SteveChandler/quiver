import type { TrackSummary } from "../tracks/summarize-track";
import { angleDiffDeg, bearingDeg, haversineM } from "../tracks/track-geometry";
import type { NormalizedTrack, TrackSample } from "../tracks/types";
import {
  GAP_S, MAX_FIX_JUMP_MPS, OFF_SHOREWARD_FACTOR, RIDE_END_HOLD_S, RIDE_END_MPS,
  RIDE_KEEP_DURATION_S, RIDE_KEEP_PEAK_MPS, RIDE_METRIC_ONSET_FRACTION, RIDE_START_HOLD_S, RIDE_START_MPS,
  SHOREWARD_TOLERANCE_DEG,
} from "./constants";

export const WAVE_DETECTION_VERSION = "wd-1.0.0";

type Point = { lat: number; lon: number };
export type DetectedWave = {
  index: number;
  startedAt: string;
  endedAt: string;
  durationS: number;
  distanceM: number;
  maxSpeedMps: number | null;
  avgSpeedMps: number | null;
  start: Point;
  end: Point;
  headingDeg: number | null;
  confidence: number;
};
export type DetectionBeach = Point & { swellWindowCenterDeg: number | null };
type TimedSample = TrackSample & { time: number };
type Fix = TimedSample & Point;
type CadenceSeries = { times: number[]; sums: number[]; counts: number[] };

function fixSegments(samples: TimedSample[]): Fix[][] {
  const segments: Fix[][] = [];
  let segment: Fix[] = [];
  let previous: Fix | undefined;
  for (const sample of samples) {
    if (sample.lat === null || sample.lon === null) continue;
    const fix: Fix = { ...sample, lat: sample.lat, lon: sample.lon };
    const elapsedS = previous ? (fix.time - previous.time) / 1000 : 0;
    if (previous && elapsedS <= 0) continue;
    if (previous && elapsedS <= GAP_S && haversineM(previous, fix) / elapsedS > MAX_FIX_JUMP_MPS) continue;
    if (previous && elapsedS > GAP_S) {
      if (segment.length) segments.push(segment);
      segment = [];
    }
    previous = fix;
    segment.push(fix);
  }
  if (segment.length) segments.push(segment);
  return segments;
}

function smoothedSpeeds(fixes: Fix[]): number[] {
  const speeds = fixes.map((fix, index) => {
    if (fix.speedMps !== null) return fix.speedMps;
    if (index === 0) return 0;
    return haversineM(fixes[index - 1], fix) / ((fix.time - fixes[index - 1].time) / 1000);
  });
  return speeds.map((speed, index) => [speeds[index - 1] ?? speed, speed, speeds[index + 1] ?? speed]
    .sort((a, b) => a - b)[1]);
}

function cadenceSeries(samples: TimedSample[]): CadenceSeries {
  const series: CadenceSeries = { times: [], sums: [0], counts: [0] };
  for (const sample of samples) {
    const index = series.times.length;
    series.times.push(sample.time);
    series.sums.push(series.sums[index] + (sample.cadence ?? 0));
    series.counts.push(series.counts[index] + (sample.cadence === null ? 0 : 1));
  }
  return series;
}

function timeIndex(times: number[], boundary: number, afterEqual: boolean = false): number {
  let low = 0;
  let high = times.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (times[middle] < boundary || (afterEqual && times[middle] === boundary)) low = middle + 1;
    else high = middle;
  }
  return low;
}

function averageCadence(series: CadenceSeries, start: number, end: number, includeEnd: boolean = false): number | null {
  const first = timeIndex(series.times, start);
  const last = timeIndex(series.times, end, includeEnd);
  const count = series.counts[last] - series.counts[first];
  return count ? (series.sums[last] - series.sums[first]) / count : null;
}

function candidate(
  fixes: Fix[], speeds: number[], cadence: CadenceSeries, summary: TrackSummary, shoreward: number,
): Omit<DetectedWave, "index"> | null {
  const last = fixes[fixes.length - 1];
  if (fixes[0].time < Date.parse(summary.inWaterStart)
    || last.time > Date.parse(summary.inWaterEnd)) return null;

  const peak = speeds.reduce((maximum, speed) => Math.max(maximum, speed), 0);
  const onset = Math.max(RIDE_START_MPS, RIDE_METRIC_ONSET_FRACTION * peak);
  const firstIndex = speeds.findIndex((speed) => speed >= onset);
  if (firstIndex < 0) return null;
  const first = fixes[firstIndex];
  const durationS = (last.time - first.time) / 1000;
  if (durationS <= 0) return null;
  // Swim-mode smoothing can flatten peaks, so sustained rides also qualify.
  if (peak < RIDE_KEEP_PEAK_MPS && durationS < RIDE_KEEP_DURATION_S) return null;
  let distanceM = 0;
  let speedIntegral = 0;
  for (let index = firstIndex + 1; index < fixes.length; index += 1) {
    distanceM += haversineM(fixes[index - 1], fixes[index]);
    speedIntegral += speeds[index] * (fixes[index].time - fixes[index - 1].time) / 1000;
  }
  if (distanceM === 0) return null;

  const start = { lat: first.lat, lon: first.lon };
  const end = { lat: last.lat, lon: last.lon };
  const headingDeg = haversineM(start, end) > 0 ? bearingDeg(start, end) : null;
  let confidence = 0.7;
  if (peak >= RIDE_KEEP_PEAK_MPS && durationS >= RIDE_KEEP_DURATION_S) confidence += 0.2;
  const before = averageCadence(cadence, first.time - 10_000, first.time);
  const during = averageCadence(cadence, first.time, last.time, true);
  if (before !== null && before > 10 && during !== null && during <= 5) confidence += 0.1;
  if (headingDeg === null || angleDiffDeg(headingDeg, shoreward) > SHOREWARD_TOLERANCE_DEG) {
    confidence *= OFF_SHOREWARD_FACTOR;
  }
  return {
    startedAt: first.t, endedAt: last.t, durationS, distanceM,
    maxSpeedMps: summary.speedReliable ? peak : null,
    avgSpeedMps: summary.speedReliable ? speedIntegral / durationS : null,
    start, end, headingDeg, confidence: Math.round(Math.max(0, Math.min(1, confidence)) * 1000) / 1000,
  };
}

export function detectWaves(track: NormalizedTrack, summary: TrackSummary, beach: DetectionBeach): DetectedWave[] {
  if (!summary.centroid) return [];
  const shoreward = beach.swellWindowCenterDeg === null
    ? bearingDeg(summary.centroid, beach)
    : (beach.swellWindowCenterDeg + 180) % 360;
  const samples = track.samples.map((sample) => ({ ...sample, time: Date.parse(sample.t) }))
    .sort((a, b) => a.time - b.time);
  const cadence = cadenceSeries(samples);
  const waves: DetectedWave[] = [];
  for (const fixes of fixSegments(samples)) {
    const speeds = smoothedSpeeds(fixes);
    let start: number | null = null;
    let active = false;
    let lowStart: number | null = null;
    const finish = (end: number): void => {
      if (active && start !== null) {
        const wave = candidate(fixes.slice(start, end + 1), speeds.slice(start, end + 1), cadence, summary, shoreward);
        if (wave) waves.push({ index: waves.length, ...wave });
      }
      start = null;
      active = false;
      lowStart = null;
    };

    for (let index = 0; index < fixes.length; index += 1) {
      if (!active) {
        if (speeds[index] < RIDE_START_MPS) {
          start = null;
          continue;
        }
        start ??= index;
        active = (fixes[index].time - fixes[start].time) / 1000 >= RIDE_START_HOLD_S;
        continue;
      }
      if (speeds[index] > RIDE_END_MPS) {
        lowStart = null;
        continue;
      }
      lowStart ??= index;
      if ((fixes[index].time - fixes[lowStart].time) / 1000 >= RIDE_END_HOLD_S) finish(lowStart - 1);
    }
    finish(lowStart === null ? fixes.length - 1 : lowStart - 1);
  }
  return waves;
}
