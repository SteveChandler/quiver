import { COUNT_MIN_CONFIDENCE } from "@/lib/sessions/wave-detection/constants";
import type { DetectedWave } from "@/lib/sessions/wave-detection/detect-waves";

export type StoredWave = DetectedWave & { id: string };
export type Correction = { startedAt: string; endedAt: string; action?: "exclude" | "include" };

export type WavesSummary = {
  waveCount: number;
  detectedWaveCount: number;
  userWaveCount: number | null;
  longestRideS: number | null;
  longestRideM: number | null;
  topSpeedMps: number | null;
  gpsCoverage: number;
  lowCoverage: boolean;
  speedReliable: boolean;
  detectionVersion: string;
  paddleDistanceM?: number | null;
  heartRateAvg?: number | null;
  heartRateMax?: number | null;
  calories: number | null;
  waterTempStartC: number | null;
  waterTempEndC: number | null;
  waterTempC: number | null;
  setIntervalMin?: number | null;
  recordedWith?: string | null;
};

export function trackSummaryExtras(
  source: string | null,
  track: { paddle_distance_m: number | null; hr_avg: number | null; hr_max: number | null;
    recorded_by: string | null; source_device: string | null;
    calories?: number | null; water_temp_c?: number | null;
    water_temp_start_c?: number | null; water_temp_end_c?: number | null },
): Pick<WavesSummary, "paddleDistanceM" | "heartRateAvg" | "heartRateMax" | "recordedWith"
  | "calories" | "waterTempC" | "waterTempStartC" | "waterTempEndC"> {
  return {
    paddleDistanceM: track.paddle_distance_m,
    heartRateAvg: track.hr_avg,
    heartRateMax: track.hr_max,
    calories: track.calories ?? null,
    waterTempC: track.water_temp_c ?? null,
    waterTempStartC: track.water_temp_start_c ?? null,
    waterTempEndC: track.water_temp_end_c ?? null,
    recordedWith: source === "garmin_watch"
      ? `Quiver for Garmin · ${track.source_device ?? "Garmin watch"}` : track.recorded_by,
  };
}

function isCorrected(wave: StoredWave, corrections: Correction[], action: "exclude" | "include"): boolean {
  const start = Date.parse(wave.startedAt);
  const end = Date.parse(wave.endedAt);
  if (end <= start) return false;

  const overlaps = corrections.filter(correction => (correction.action ?? "exclude") === action)
    .map((correction) => ({
      start: Math.max(start, Date.parse(correction.startedAt)),
      end: Math.min(end, Date.parse(correction.endedAt)),
    }))
    .filter((overlap) => overlap.end > overlap.start)
    .sort((a, b) => a.start - b.start);

  let coveredMs = 0;
  let coveredUntil = start;
  for (const overlap of overlaps) {
    coveredMs += Math.max(0, overlap.end - Math.max(overlap.start, coveredUntil));
    coveredUntil = Math.max(coveredUntil, overlap.end);
  }
  return coveredMs * 2 >= end - start;
}

export function isExcluded(wave: StoredWave, corrections: Correction[]): boolean {
  return isCorrected(wave, corrections, "exclude");
}

export function isIncluded(wave: StoredWave, corrections: Correction[]): boolean {
  return isCorrected(wave, corrections, "include");
}

export function isCounted(wave: StoredWave, corrections: Correction[]): boolean {
  if (isExcluded(wave, corrections)) return false;
  return isIncluded(wave, corrections) || wave.confidence >= COUNT_MIN_CONFIDENCE;
}

export function setIntervalMin(waves: (StoredWave & { counted?: boolean; excluded?: boolean })[], corrections: Correction[]): number | null {
  const starts = waves
    .filter(wave => wave.counted !== false && wave.excluded !== true && isCounted(wave, corrections))
    .map(wave => Date.parse(wave.startedAt))
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  const sets: number[] = [];
  let previous: number | null = null;
  for (const start of starts) {
    // Chaining treats rides every 60–80 seconds as continuous action, rather than misleading two-minute sets.
    if (previous === null || start - previous > 90_000) sets.push(start);
    previous = start;
  }
  if (sets.length < 3) return null;
  const gaps = sets.slice(1).map((start, index) => start - sets[index]).sort((a, b) => a - b);
  const middle = Math.floor(gaps.length / 2);
  const median = gaps.length % 2 ? gaps[middle] : (gaps[middle - 1] + gaps[middle]) / 2;
  return Math.round(median / 60_000);
}

export function buildWavesSummary(
  waves: StoredWave[],
  corrections: Correction[],
  track: { gpsCoverage: number; speedReliable: boolean; userWaveCount: number | null;
    paddleDistanceM?: number | null; heartRateAvg?: number | null; heartRateMax?: number | null;
    recordedWith?: string | null; calories?: number | null; waterTempC?: number | null;
    waterTempStartC?: number | null; waterTempEndC?: number | null },
  version: string,
): WavesSummary {
  const counted = waves.filter(wave => isCounted(wave, corrections));
  const detectedWaveCount = counted.length;
  const speeds = counted.flatMap((wave) => wave.maxSpeedMps === null ? [] : [wave.maxSpeedMps]);

  return {
    waveCount: track.userWaveCount ?? detectedWaveCount,
    detectedWaveCount,
    userWaveCount: track.userWaveCount,
    longestRideS: counted.length ? Math.max(...counted.map((wave) => wave.durationS)) : null,
    longestRideM: counted.length ? Math.max(...counted.map((wave) => wave.distanceM)) : null,
    topSpeedMps: track.speedReliable && speeds.length ? Math.max(...speeds) : null,
    gpsCoverage: track.gpsCoverage,
    lowCoverage: track.gpsCoverage < 0.5,
    speedReliable: track.speedReliable,
    detectionVersion: version,
    paddleDistanceM: track.paddleDistanceM ?? null,
    heartRateAvg: track.heartRateAvg ?? null,
    heartRateMax: track.heartRateMax ?? null,
    calories: track.calories ?? null,
    waterTempC: track.waterTempC ?? null,
    waterTempStartC: track.waterTempStartC ?? null,
    waterTempEndC: track.waterTempEndC ?? null,
    setIntervalMin: setIntervalMin(waves, corrections),
    recordedWith: track.recordedWith ?? null,
  };
}
