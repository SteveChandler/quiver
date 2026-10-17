import { COUNT_MIN_CONFIDENCE } from "@/lib/sessions/wave-detection/constants";
import type { DetectedWave } from "@/lib/sessions/wave-detection/detect-waves";

export type StoredWave = DetectedWave & { id: string };
export type Correction = { startedAt: string; endedAt: string };

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
};

export function isExcluded(wave: StoredWave, corrections: Correction[]): boolean {
  const start = Date.parse(wave.startedAt);
  const end = Date.parse(wave.endedAt);
  if (end <= start) return false;

  const overlaps = corrections
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

export function buildWavesSummary(
  waves: StoredWave[],
  corrections: Correction[],
  track: { gpsCoverage: number; speedReliable: boolean; userWaveCount: number | null },
  version: string,
): WavesSummary {
  const counted = waves.filter((wave) => wave.confidence >= COUNT_MIN_CONFIDENCE && !isExcluded(wave, corrections));
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
  };
}
