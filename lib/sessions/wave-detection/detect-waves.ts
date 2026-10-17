import type { TrackSummary } from "../tracks/summarize-track";
import { angleDiffDeg, bearingDeg, haversineM } from "../tracks/track-geometry";
import type { NormalizedTrack, TrackSample } from "../tracks/types";
import {
  GAP_S, MAX_FIX_JUMP_MPS, OFF_SHOREWARD_FACTOR, RIDE_END_HOLD_S, RIDE_END_MPS,
  RIDE_KEEP_DURATION_S, RIDE_KEEP_PEAK_MPS, RIDE_START_HOLD_S, RIDE_START_MPS,
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
type Fix = TrackSample & Point & { time: number };

function fixSegments(samples: TrackSample[]): Fix[][] {
  const segments: Fix[][] = [];
  let segment: Fix[] = [];
  let previous: Fix | undefined;
  for (const sample of samples) {
    if (sample.lat === null || sample.lon === null) continue;
    const fix: Fix = { ...sample, lat: sample.lat, lon: sample.lon, time: Date.parse(sample.t) };
    const elapsedS = previous ? (fix.time - previous.time) / 1000 : 0;
    if (previous && elapsedS <= 0) continue;
    const jump = previous && haversineM(previous, fix) / elapsedS > MAX_FIX_JUMP_MPS;
    if (previous && (elapsedS > GAP_S || jump)) {
      if (segment.length) segments.push(segment);
      segment = [];
    }
    previous = fix;
    // A bad fix cannot seed a ride; the following fix must also pass the jump check.
    if (!jump) segment.push(fix);
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

function averageCadence(samples: TrackSample[]): number | null {
  const values = samples.flatMap((sample) => sample.cadence === null ? [] : [sample.cadence]);
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function candidate(
  fixes: Fix[], speeds: number[], samples: TrackSample[], summary: TrackSummary, shoreward: number,
): Omit<DetectedWave, "index"> | null {
  const first = fixes[0];
  const last = fixes[fixes.length - 1];
  const durationS = (last.time - first.time) / 1000;
  if (durationS <= 0 || first.time < Date.parse(summary.inWaterStart)
    || last.time > Date.parse(summary.inWaterEnd)) return null;

  const peak = speeds.reduce((maximum, speed) => Math.max(maximum, speed), 0);
  // Swim-mode smoothing can flatten peaks, so sustained rides also qualify.
  if (peak < RIDE_KEEP_PEAK_MPS && durationS < RIDE_KEEP_DURATION_S) return null;
  let distanceM = 0;
  let speedIntegral = 0;
  for (let index = 1; index < fixes.length; index += 1) {
    distanceM += haversineM(fixes[index - 1], fixes[index]);
    speedIntegral += speeds[index] * (fixes[index].time - fixes[index - 1].time) / 1000;
  }
  if (distanceM === 0) return null;

  const start = { lat: first.lat, lon: first.lon };
  const end = { lat: last.lat, lon: last.lon };
  const headingDeg = haversineM(start, end) > 0 ? bearingDeg(start, end) : null;
  let confidence = 0.7;
  if (peak >= RIDE_KEEP_PEAK_MPS && durationS >= RIDE_KEEP_DURATION_S) confidence += 0.2;
  const before = averageCadence(samples.filter((sample) => {
    const time = Date.parse(sample.t);
    return time >= first.time - 10_000 && time < first.time;
  }));
  const during = averageCadence(samples.filter((sample) => {
    const time = Date.parse(sample.t);
    return time >= first.time && time <= last.time;
  }));
  if (before !== null && before > 10 && during !== null && during <= 5) confidence += 0.1;
  if (headingDeg === null || angleDiffDeg(headingDeg, shoreward) > SHOREWARD_TOLERANCE_DEG) {
    confidence *= OFF_SHOREWARD_FACTOR;
  }
  return {
    startedAt: first.t, endedAt: last.t, durationS, distanceM,
    maxSpeedMps: summary.speedReliable ? peak : null,
    avgSpeedMps: summary.speedReliable ? speedIntegral / durationS : null,
    start, end, headingDeg, confidence: Math.max(0, Math.min(1, confidence)),
  };
}

export function detectWaves(track: NormalizedTrack, summary: TrackSummary, beach: DetectionBeach): DetectedWave[] {
  const shoreward = beach.swellWindowCenterDeg === null
    ? bearingDeg(summary.centroid, beach)
    : (beach.swellWindowCenterDeg + 180) % 360;
  const samples = [...track.samples].sort((a, b) => Date.parse(a.t) - Date.parse(b.t));
  const waves: DetectedWave[] = [];
  for (const fixes of fixSegments(samples)) {
    const speeds = smoothedSpeeds(fixes);
    let start: number | null = null;
    let active = false;
    let lowStart: number | null = null;
    const finish = (end: number): void => {
      if (active && start !== null) {
        const wave = candidate(fixes.slice(start, end + 1), speeds.slice(start, end + 1), samples, summary, shoreward);
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
