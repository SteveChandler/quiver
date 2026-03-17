/**
 * Wave Frequency Domain Constants
 *
 * Configuration values for the rideable wave frequency calculator.
 * Tuned from empirical surf observation data.
 */

/** Break type factor: fraction of total waves that are rideable */
export const BREAK_TYPE_FACTORS: Record<string, number> = {
  beach: 0.15,
  point: 0.08,
  reef: 0.1,
  river: 0.08,
};
export const DEFAULT_BREAK_TYPE_FACTOR = 0.12;

/** Minimum wave height (ft) considered rideable per break type */
export const RIDEABLE_THRESHOLDS: Record<string, number> = {
  beach: 2.0,
  point: 2.5,
  reef: 2.5,
  river: 2.5,
};
export const DEFAULT_RIDEABLE_THRESHOLD = 2.0;

/** Clamp bounds */
export const MAX_RIDEABLE_WAVES_PER_HOUR = 60;
export const MIN_SET_INTERVAL_S = 60;
export const MAX_SET_INTERVAL_S = 600;
export const MIN_WAVES_PER_SET = 2;
export const MAX_WAVES_PER_SET = 7;

/** Below this period (seconds), apply wind swell degradation penalty */
export const WIND_SWELL_PERIOD_THRESHOLD = 8;

/** Minimum period difference (seconds) to use multi-swell formula */
export const MIN_PERIOD_DIFFERENCE = 1.0;

/** Default swell access factor when beach has no directional data */
export const DEFAULT_SWELL_ACCESS_FACTOR = 0.7;

/** Wind penalty floor (worst case for strong onshore) */
export const WIND_PENALTY_FLOOR = 0.3;

/** Wind speed divisor for penalty calculation */
export const WIND_PENALTY_DIVISOR = 30;
