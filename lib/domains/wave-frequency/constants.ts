import type { BreakType, BreakTypeConfig } from "./types";

export const BREAK_TYPE_CONFIGS: Record<BreakType, BreakTypeConfig> = {
  beach: { factor: 0.15, thresholdFt: 2.0 },
  point: { factor: 0.08, thresholdFt: 2.5 },
  reef: { factor: 0.1, thresholdFt: 2.5 },
  river: { factor: 0.08, thresholdFt: 2.5 },
  other: { factor: 0.12, thresholdFt: 2.0 },
};

export const FREQUENCY_CLAMPS = {
  MIN_SET_INTERVAL_S: 60,
  MAX_SET_INTERVAL_S: 600,
  MIN_WAVES_PER_SET: 2,
  MAX_WAVES_PER_SET: 7,
  MAX_FINAL_FREQUENCY: 60,
};

export const THRESHOLDS = {
  SHORT_PERIOD_DEGRADATION_S: 8,
  SWELL_DIFF_THRESHOLD_S: 1.0,
  WIND_ONSHORE_MAX_KTS: 30,
  WIND_MIN_PENALTY: 0.3,
  MIN_VALID_PERIOD_S: 1.0,
  MULTI_SWELL_MIN_HEIGHT_FT: 1.5,
  MULTI_SWELL_MIN_HEIGHT_RATIO: 0.25,
  MULTI_SWELL_BREAK_FACTOR_REDUCTION: 0.4,
};
