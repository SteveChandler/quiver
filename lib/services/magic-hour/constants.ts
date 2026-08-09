/**
 * Magic Hour Service Constants
 *
 * Constants for direction parsing, scoring weights, and thresholds.
 *
 * @module magic-hour/constants
 */

import type { WeightConfig } from "./types";

export { DEFAULT_TIMEZONE } from "@/lib/utils/timezone-constants";

/**
 * Direction map for parsing cardinal/intercardinal directions to degrees.
 * Used by parseWindDirection to convert strings like "NNE" to 22.5 degrees.
 */
export const DIRECTION_MAP: Record<string, number> = {
  N: 0,
  NNE: 22.5,
  NE: 45,
  ENE: 67.5,
  E: 90,
  ESE: 112.5,
  SE: 135,
  SSE: 157.5,
  S: 180,
  SSW: 202.5,
  SW: 225,
  WSW: 247.5,
  W: 270,
  WNW: 292.5,
  NW: 315,
  NNW: 337.5,
};

/**
 * Default weight configuration for multi-metric scoring.
 *
 * Weights:
 * - Tide: 40% - Most important for wave quality
 * - Wind: 35% - Second most important, affects surface conditions
 * - Swell: 25% - Direction matching for optimal wave arrival
 */
export const DEFAULT_WEIGHTS: WeightConfig = {
  tide: 0.4,
  wind: 0.35,
  swell: 0.25,
};

/**
 * Minimum tide change threshold for interpolation.
 * When tide change is less than this, we're in slack tide and
 * should use midpoint instead of interpolation to avoid division by zero.
 */
export const SLACK_TIDE_THRESHOLD_FT = 0.01;

/**
 * Half-window size in milliseconds for building optimal window.
 * Default is 30 minutes before and after peak time.
 */
export const WINDOW_HALF_SIZE_MS = 30 * 60 * 1000;

/**
 * Daylight hours for filtering (6 AM to 8 PM).
 * Peak surf times should only be during reasonable daylight hours.
 */
export const DAYLIGHT_START_HOUR = 6;
export const DAYLIGHT_END_HOUR = 20;

/**
 * Default time window for Magic Hour search (48 hours in milliseconds).
 */
export const DEFAULT_SEARCH_WINDOW_MS = 48 * 60 * 60 * 1000;
