import { haversineM } from "./track-geometry";
import type { NormalizedTrack, TrackSample } from "./types";
import { TrackFileError } from "./types";

type Fix = TrackSample & { lat: number; lon: number };
type Window = { start: string; end: string };

export type TrackSummary = {
  inWaterStart: string;
  inWaterEnd: string;
  centroid: { lat: number; lon: number };
  gpsCoverage: number;
  maxGapS: number;
  sampleCount: number;
  waterTempC: number | null;
  speedReliable: boolean;
  trackGeojson: { type: "LineString"; coordinates: [number, number][] };
  speedSeries: { t: string; mps: number }[];
};

function isFix(sample: TrackSample): sample is Fix {
  return sample.lat !== null && sample.lon !== null;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function bucketStart(time: number): number {
  return Math.floor(time / 5000) * 5000;
}

function speedSeries(fixes: Fix[]): { t: string; mps: number }[] {
  const buckets = new Map<number, { recorded: number[]; derived: number[] }>();
  for (let index = 0; index < fixes.length; index += 1) {
    const fix = fixes[index];
    const time = Date.parse(fix.t);
    const bucket = bucketStart(time);
    const speeds = buckets.get(bucket) ?? { recorded: [], derived: [] };
    buckets.set(bucket, speeds);
    if (fix.speedMps !== null) {
      speeds.recorded.push(fix.speedMps);
    }
    if (index === 0) continue;
    const previous = fixes[index - 1];
    const elapsedS = (time - Date.parse(previous.t)) / 1000;
    if (elapsedS > 0) speeds.derived.push(haversineM(previous, fix) / elapsedS);
  }
  return [...buckets.entries()].flatMap(([time, speeds]) => {
    const values = speeds.recorded.length ? speeds.recorded : speeds.derived;
    return values.length ? [{ t: new Date(time).toISOString(), mps: median(values) }] : [];
  });
}

export function summarizeTrack(track: NormalizedTrack, keepWindows: Window[] = []): TrackSummary {
  const fixes = track.samples.filter(isFix).sort((a, b) => Date.parse(a.t) - Date.parse(b.t));
  if (fixes.length === 0) throw new TrackFileError("no_gps", "This file has no GPS track");

  const first = fixes[0];
  const last = fixes[fixes.length - 1];
  const waterFixes = fixes.filter((fix) => haversineM(fix, first) > 40 && haversineM(fix, last) > 40);
  const start = waterFixes[0] ?? first;
  const end = waterFixes[waterFixes.length - 1] ?? last;
  const startMs = Date.parse(start.t);
  const endMs = Date.parse(end.t);
  const spanFixes = fixes.filter((fix) => {
    const time = Date.parse(fix.t);
    return time >= startMs && time <= endMs;
  });

  const interiorFixes = spanFixes.filter((fix) => {
    const time = Date.parse(fix.t);
    return time >= startMs + 180_000 && time <= endMs - 180_000;
  });
  const centroidFixes = interiorFixes.length ? interiorFixes : spanFixes;
  const midpoint = startMs + (endMs - startMs) / 2;
  const temperatures = spanFixes
    .filter((fix) => Date.parse(fix.t) >= midpoint && fix.tempC !== null)
    .map((fix) => fix.tempC as number);

  // Full-track fix-to-fix gaps include dropouts outside the in-water span (OB: 110 s vs 77 s).
  let maxGapS = 0;
  for (let index = 1; index < fixes.length; index += 1) {
    maxGapS = Math.max(maxGapS, (Date.parse(fixes[index].t) - Date.parse(fixes[index - 1].t)) / 1000);
  }

  const coveredSeconds = new Set(spanFixes.map((fix) => Math.floor(Date.parse(fix.t) / 1000)));
  const totalSeconds = Math.floor(endMs / 1000) - Math.floor(startMs / 1000) + 1;
  const windowTimes = keepWindows.map((window) => ({ start: Date.parse(window.start), end: Date.parse(window.end) }));
  const displayFixes = new Map<number, Fix>();
  const coordinates: [number, number][] = [];
  for (const fix of spanFixes) {
    const time = Date.parse(fix.t);
    const bucket = bucketStart(time);
    const inWindow = windowTimes.some((window) => time >= window.start && time <= window.end);
    if (!displayFixes.has(bucket) || inWindow) {
      displayFixes.set(bucket, fix);
      coordinates.push([fix.lon, fix.lat]);
    }
  }

  return {
    inWaterStart: start.t,
    inWaterEnd: end.t,
    centroid: {
      lat: median(centroidFixes.map((fix) => fix.lat)),
      lon: median(centroidFixes.map((fix) => fix.lon)),
    },
    gpsCoverage: coveredSeconds.size / totalSeconds,
    maxGapS: Math.ceil(maxGapS),
    sampleCount: track.samples.length,
    waterTempC: temperatures.length ? median(temperatures) : null,
    speedReliable: !(track.meta.sport === "swimming" && track.meta.subSport === "open_water"),
    trackGeojson: { type: "LineString", coordinates },
    speedSeries: speedSeries(spanFixes),
  };
}
