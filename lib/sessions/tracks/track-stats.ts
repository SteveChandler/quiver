import { MAX_FIX_JUMP_MPS } from "../wave-detection/constants";
import { haversineM } from "./track-geometry";
import type { TrackSummary } from "./summarize-track";
import type { NormalizedTrack } from "./types";

export function paddleDistanceM(
  track: NormalizedTrack,
  summary: TrackSummary,
  rideWindows: { start: string; end: string }[],
): number {
  const start = Date.parse(summary.inWaterStart);
  const end = Date.parse(summary.inWaterEnd);
  const windows = rideWindows.map(window => ({ start: Date.parse(window.start), end: Date.parse(window.end) }));
  const fixes = track.samples.flatMap(sample => {
    const time = Date.parse(sample.t);
    if (sample.lat === null || sample.lon === null || time < start || time > end) return [];
    return [{ time, lat: sample.lat, lon: sample.lon }];
  }).sort((a, b) => a.time - b.time);

  let distance = 0;
  for (let index = 1; index < fixes.length; index += 1) {
    const previous = fixes[index - 1];
    const current = fixes[index];
    const elapsed = current.time - previous.time;
    if (elapsed <= 0 || elapsed > 30_000) continue;
    // Keep ride boundaries in the sequence so a GPS gap cannot bridge across a ride.
    if (windows.some(window => previous.time < window.end && current.time > window.start)) continue;
    const segmentDistance = haversineM(previous, current);
    if (segmentDistance / (elapsed / 1000) > MAX_FIX_JUMP_MPS) continue;
    distance += segmentDistance;
  }
  return distance;
}

export function heartRateStats(
  track: NormalizedTrack,
  summary: TrackSummary,
): { avg: number; max: number } | null {
  const start = Date.parse(summary.inWaterStart);
  const end = Date.parse(summary.inWaterEnd);
  let sum = 0;
  let count = 0;
  let max = 0;
  for (const sample of track.samples) {
    const time = Date.parse(sample.t);
    if (sample.hr === null || sample.hr <= 0 || time < start || time > end) continue;
    sum += sample.hr;
    count += 1;
    max = Math.max(max, sample.hr);
  }
  return count ? { avg: Math.round(sum / count), max } : null;
}
