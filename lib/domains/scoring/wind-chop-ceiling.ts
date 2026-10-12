import { angleDifference, normalizeAngle } from '../shared';
import { classifyDirection } from './scorers/wind-quality-scorer';
import type { ScorerInput } from './types';

const SMALL_ONSHORE_SHORT_PERIOD_CEILING = 54;
const SMALL_WAVE_MAX_FT = 3;
const SHORT_PERIOD_MAX_S = 10;
const ONSHORE_WIND_MIN_MPH = 8;
const POOR_WIND_QUALITY_MAX = 35;

// Any-height branch: onshore-or-cross wind chops up big groundswell too; the
// composite's swell and tide terms otherwise hold these days in FAIR.
const BLOWN_SWELL_MIN_MPH = 12;
const BLOWN_SWELL_STRONG_MPH = 15;
const BLOWN_SWELL_CEILING = 54; // top of RIDEABLE
const BLOWN_SWELL_STRONG_CEILING = 39; // MEH

interface WindChopCeiling {
  readonly ceiling: number;
  readonly reason: string;
}

export function windChopCeiling(
  input: ScorerInput,
  subscores: ReadonlyMap<string, number>,
  options: { ignoreWindQuality?: boolean } = {},
): WindChopCeiling | null {
  const small = smallShortPeriodCeiling(input, subscores, options);
  const blown = onshoreBlownSwellCeiling(input, subscores);
  if (!small) return blown;
  if (!blown) return small;
  return blown.ceiling < small.ceiling ? blown : small;
}

function smallShortPeriodCeiling(
  input: ScorerInput,
  subscores: ReadonlyMap<string, number>,
  options: { ignoreWindQuality?: boolean },
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
  const windSpeed = snapshot.wind.speedMph;
  if (windSpeed == null || !Number.isFinite(windSpeed) || windSpeed < ONSHORE_WIND_MIN_MPH) {
    return null;
  }
  if (windDirection == null || !Number.isFinite(windDirection)) {
    return null;
  }
  if (
    !options.ignoreWindQuality &&
    (windQuality == null || windQuality >= POOR_WIND_QUALITY_MAX)
  ) {
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

// Always requires a real poor windQuality subscore, even when the caller
// ignores it for the small-wave branch, so it never caps a merely textured day.
function onshoreBlownSwellCeiling(
  input: ScorerInput,
  subscores: ReadonlyMap<string, number>,
): WindChopCeiling | null {
  const { snapshot, profile } = input;
  const windQuality = subscores.get('windQuality');
  if (windQuality == null || !Number.isFinite(windQuality) || windQuality >= POOR_WIND_QUALITY_MAX) {
    return null;
  }
  const windSpeed = snapshot.wind.speedMph;
  if (windSpeed == null || !Number.isFinite(windSpeed) || windSpeed < BLOWN_SWELL_MIN_MPH) {
    return null;
  }
  const windDirection = snapshot.wind.directionDeg;
  if (windDirection == null || !Number.isFinite(windDirection)) {
    return null;
  }
  const direction = classifyDirection(
    windDirection,
    profile.windThresholds.offshoreDeg,
    profile.windThresholds.offshoreToleranceDeg,
  );
  if (direction === 'offshore') {
    return null;
  }

  const strong = windSpeed >= BLOWN_SWELL_STRONG_MPH;
  const ceiling = strong ? BLOWN_SWELL_STRONG_CEILING : BLOWN_SWELL_CEILING;
  const surface = strong ? 'Choppy' : 'Textured';
  const label = direction === 'sideshore' ? 'side-shore' : 'onshore';
  // Floor, not round: 14.6 mph must not print as 15 under the 54 tier.
  return {
    ceiling,
    reason: `${surface} ${label} wind (${Math.floor(windSpeed)} mph) caps score at ${ceiling}`,
  };
}
