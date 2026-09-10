/**
 * Magic Hour Finder Service
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
 * @module magic-hour
 */

// Main entry point
export { findMagicHour } from "./magic-hour-finder";

// Types
export type {
  ForecastSlot,
  BeachMetadata,
  MagicHourResult,
  WeightConfig,
} from "./types";

// Direction utilities (CRITICAL: circular math)
export { circularAngleDiff } from "./direction-utils";

// Condition checkers
export {
  isSwellInWindow,
  checkWindOffshore,
  isTideInRange,
} from "./condition-checkers";

// Scoring
export {
  findWeightedPeak,
  calculateTideScore,
  calculateWindScore,
  calculateSwellScore,
} from "./scoring";
