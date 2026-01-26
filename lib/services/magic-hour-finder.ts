/**
 * Magic Hour Finder Service
 *
 * @deprecated Import from '@/lib/services/magic-hour' instead.
 * This file re-exports from the modular implementation for backwards compatibility.
 *
 * Interpolates between 3-hour forecast blocks to find the exact optimal surf window
 * ("Magic Hour") based on multi-metric weighted scoring (tide, wind, swell).
 *
 * This service enables sophisticated surf condition analysis by:
 * - Using circular direction math for accurate wind/swell analysis at 0 deg/360 deg boundary
 * - Linear interpolation to find exact peak conditions between forecast slots
 * - Multi-metric weighted scoring (tide 40%, wind 35%, swell 25%)
 * - Guard against division by zero during slack tide periods
 *
 * @module lib/services/magic-hour-finder
 */

// Re-export everything from the modular implementation
export {
  // Main entry point
  findMagicHour,
  convertToSlots,
  parseWindDirection,
  nullResult,

  // Types
  type ForecastSlot,
  type BeachMetadata,
  type EnhancedForecastEntity,
  type MagicHourResult,
  type OptimalWindow,
  type WeightConfig,
  type WindQualityResult,

  // Direction utilities (CRITICAL: circular math)
  circularAngleDiff,
  normalizeAngle,
  interpolateAngle,

  // Condition checkers
  isSwellInWindow,
  checkWindOffshore,
  isTideInRange,

  // Interpolation
  calculateOptimalWindow,
  buildWindowResult,
  formatTime,

  // Scoring
  findWeightedPeak,
  calculateTideScore,
  calculateWindScore,
  calculateSwellScore,

  // Constants
  DIRECTION_MAP,
  DEFAULT_WEIGHTS,
  SLACK_TIDE_THRESHOLD_FT,
  WINDOW_HALF_SIZE_MS,
  DAYLIGHT_START_HOUR,
  DAYLIGHT_END_HOUR,
  DEFAULT_SEARCH_WINDOW_MS,
  DEFAULT_TIMEZONE,
} from "./magic-hour";
