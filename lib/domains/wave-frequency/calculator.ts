/**
 * Rideable Waves Per Hour Calculator
 *
 * Estimates how many rideable waves a surfer can expect per hour
 * at a given spot, based on swell, wind, and break characteristics.
 *
 * Algorithm steps:
 *   0. Period guard — no period means no waves
 *   1. Height gate — below threshold is flat
 *   2. Base frequency — single swell or multi-swell beat frequency
 *   3. Break type factor — what fraction of waves are rideable
 *   4. Short period penalty — wind swell degrades quality
 *   5. Swell access — directional exposure of the break
 *   6. Wind penalty — onshore wind chops up the lineup
 *   7. Clamp and return
 */

import type { WaveFrequencyInput, WaveFrequencyResult } from './types';
import {
  BREAK_TYPE_FACTORS,
  DEFAULT_BREAK_TYPE_FACTOR,
  RIDEABLE_THRESHOLDS,
  DEFAULT_RIDEABLE_THRESHOLD,
  MAX_RIDEABLE_WAVES_PER_HOUR,
  MIN_SET_INTERVAL_S,
  MAX_SET_INTERVAL_S,
  MIN_WAVES_PER_SET,
  MAX_WAVES_PER_SET,
  WIND_SWELL_PERIOD_THRESHOLD,
  MIN_PERIOD_DIFFERENCE,
  DEFAULT_SWELL_ACCESS_FACTOR,
  WIND_PENALTY_FLOOR,
  WIND_PENALTY_DIVISOR,
} from './constants';

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Calculates the estimated number of rideable waves per hour.
 *
 * Pure function — no side effects, deterministic output for the same input.
 *
 * @param input - Forecast, wind, and break characteristics
 * @returns Rideable wave count, confidence level, and intermediate factors
 *
 * @example
 * const result = calculateRideableWaves({
 *   dominantPeriodS: 12,
 *   swell1PeriodS: 14,
 *   swell2PeriodS: 9,
 *   swell1DirectionDeg: 270,
 *   waveHeightFt: 4,
 *   windSpeedKts: 5,
 *   windDirectionDeg: 90,
 *   breakType: 'beach',
 *   aspectDeg: 270,
 *   swellAccessFactors: null,
 * });
 * // result.rideableWavesPerHour → number between 0-60
 */
export function calculateRideableWaves(
  input: WaveFrequencyInput,
): WaveFrequencyResult {
  const {
    dominantPeriodS,
    swell1PeriodS,
    swell2PeriodS,
    swell1DirectionDeg,
    waveHeightFt,
    windSpeedKts,
    windDirectionDeg,
    breakType,
    aspectDeg,
    swellAccessFactors,
  } = input;

  const zeroResult = (
    confidence: 'high' | 'medium' | 'low' = 'medium',
  ): WaveFrequencyResult => ({
    rideableWavesPerHour: 0,
    confidence,
    factors: {
      baseFrequency: 0,
      breakTypeFactor: 0,
      shortPeriodPenalty: 0,
      swellAccessFactor: 0,
      windPenalty: 0,
    },
  });

  // Step 0: Period guard — cannot estimate without a dominant period
  if (!dominantPeriodS || dominantPeriodS <= 0) return zeroResult();

  // Step 1: Height gate — below the rideable threshold for this break type
  const breakTypeKey = breakType?.toLowerCase() ?? '';
  const threshold =
    RIDEABLE_THRESHOLDS[breakTypeKey] ?? DEFAULT_RIDEABLE_THRESHOLD;
  if (!waveHeightFt || waveHeightFt < threshold) return zeroResult();

  // Step 2: Base wave frequency
  let baseFrequency: number;

  if (
    swell1PeriodS != null &&
    swell1PeriodS > 0 &&
    swell2PeriodS != null &&
    swell2PeriodS > 0 &&
    Math.abs(swell1PeriodS - swell2PeriodS) >= MIN_PERIOD_DIFFERENCE
  ) {
    // Multi-swell: beat frequency formula
    // Set interval = (T1 * T2) / |T1 - T2|, clamped to sane bounds
    const t1 = swell1PeriodS;
    const t2 = swell2PeriodS;
    const setInterval = clamp(
      (t1 * t2) / Math.abs(t1 - t2),
      MIN_SET_INTERVAL_S,
      MAX_SET_INTERVAL_S,
    );
    const wavesPerSet = clamp(
      Math.round(Math.max(t1, t2) / Math.min(t1, t2)),
      MIN_WAVES_PER_SET,
      MAX_WAVES_PER_SET,
    );
    baseFrequency = (3600 / setInterval) * wavesPerSet;
  } else {
    // Single swell: one wave per period
    baseFrequency = 3600 / dominantPeriodS;
  }

  // Step 3: Break type factor — what fraction of incoming waves are rideable
  const breakTypeFactor =
    BREAK_TYPE_FACTORS[breakTypeKey] ?? DEFAULT_BREAK_TYPE_FACTOR;

  // Step 4: Short period penalty — wind swell produces less organized waves
  const shortPeriodPenalty =
    dominantPeriodS < WIND_SWELL_PERIOD_THRESHOLD
      ? dominantPeriodS / WIND_SWELL_PERIOD_THRESHOLD
      : 1.0;

  // Step 5: Swell direction access — how exposed is this break to the swell
  let swellAccessFactor = DEFAULT_SWELL_ACCESS_FACTOR;
  if (
    swell1DirectionDeg != null &&
    swellAccessFactors != null &&
    swellAccessFactors.length === 72
  ) {
    const bin = Math.round(swell1DirectionDeg / 5) % 72;
    const factor = swellAccessFactors[bin];
    if (factor != null && factor >= 0) {
      swellAccessFactor = factor;
    }
  }

  // Step 6: Wind penalty — onshore wind degrades wave quality
  let windPenalty = 1.0;
  if (windDirectionDeg != null && aspectDeg != null && windSpeedKts > 0) {
    // Positive cosine = onshore component (wind blowing toward shore)
    const onshoreComponent = Math.cos(
      toRadians(windDirectionDeg - aspectDeg),
    );
    if (onshoreComponent > 0) {
      windPenalty = Math.max(
        WIND_PENALTY_FLOOR,
        1 - (windSpeedKts * onshoreComponent) / WIND_PENALTY_DIVISOR,
      );
    }
  }

  // Step 7: Final calculation — multiply all factors and clamp
  const raw =
    baseFrequency *
    breakTypeFactor *
    shortPeriodPenalty *
    swellAccessFactor *
    windPenalty;
  const rideableWavesPerHour = clamp(
    Math.round(raw),
    0,
    MAX_RIDEABLE_WAVES_PER_HOUR,
  );

  return {
    rideableWavesPerHour,
    confidence: 'medium', // Confidence will be set by the caller with forecast metadata
    factors: {
      baseFrequency,
      breakTypeFactor,
      shortPeriodPenalty,
      swellAccessFactor,
      windPenalty,
    },
  };
}
