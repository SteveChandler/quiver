import { angleDifference, normalizeAngle } from '../shared';
import type { ScorerInput } from './types';

const SMALL_ONSHORE_SHORT_PERIOD_CEILING = 54;
const SMALL_WAVE_MAX_FT = 3;
const SHORT_PERIOD_MAX_S = 10;
const ONSHORE_WIND_MIN_MPH = 8;
const POOR_WIND_QUALITY_MAX = 35;

export interface WindChopCeiling {
  readonly ceiling: number;
  readonly reason: string;
}

export function windChopCeiling(
  input: ScorerInput,
  subscores: ReadonlyMap<string, number>,
): WindChopCeiling | null {
  const { snapshot, profile } = input;
  const windQuality = subscores.get('windQuality');
  const windDirection = snapshot.wind.directionDeg;
  if (!Number.isFinite(snapshot.waveHeight) || snapshot.waveHeight > SMALL_WAVE_MAX_FT) {
    return null;
  }
  if (!Number.isFinite(snapshot.wavePeriod) || snapshot.wavePeriod >= SHORT_PERIOD_MAX_S) {
    return null;
  }
  if (!Number.isFinite(snapshot.wind.speedMph) || snapshot.wind.speedMph < ONSHORE_WIND_MIN_MPH) {
    return null;
  }
  if (windDirection == null || !Number.isFinite(windDirection)) {
    return null;
  }
  if (windQuality == null || windQuality >= POOR_WIND_QUALITY_MAX) {
    return null;
  }

  const onshoreDeg = normalizeAngle(profile.windThresholds.offshoreDeg + 180);
  const isOnshore =
    angleDifference(windDirection, onshoreDeg) <=
    profile.windThresholds.offshoreToleranceDeg;

  if (!isOnshore) {
    return null;
  }

  return {
    ceiling: SMALL_ONSHORE_SHORT_PERIOD_CEILING,
    reason: `Small short-period onshore surf caps score at ${SMALL_ONSHORE_SHORT_PERIOD_CEILING}`,
  };
}
