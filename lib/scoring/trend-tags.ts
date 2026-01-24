import type { EnhancedForecastEntity } from '@/types/forecast';

/** Valid trend tag labels */
export type TrendTag =
  | 'Winds Dropping'
  | 'Winds Building'
  | 'Winds Cleaning Up'
  | 'Tide Filling In'
  | 'Tide Draining'
  | 'Clean Swell';

/** Maximum number of trend tags returned */
const MAX_TAGS = 3;

/** Minimum wind speed change (mph) to trigger wind speed tags */
const WIND_SPEED_THRESHOLD = 5;

/** Maximum wind speed change (mph) for "stable" wind (direction tag eligibility) */
const WIND_STABLE_THRESHOLD = 3;

/** Minimum angular improvement toward offshore (degrees) for "Winds Cleaning Up" */
const WIND_DIRECTION_IMPROVEMENT_THRESHOLD = 30;

/** Minimum tide height change (ft) to trigger tide tags */
const TIDE_CHANGE_THRESHOLD = 1.0;

/** Minimum average wave period (seconds) for "Clean Swell" */
const CLEAN_SWELL_PERIOD_MIN = 10;

/** Maximum variance in wave period for "Clean Swell" */
const CLEAN_SWELL_VARIANCE_MAX = 4;

/**
 * Computes the smallest angular difference between two angles in degrees.
 * Handles the 0/360 degree boundary correctly.
 * Returns a value in [0, 180].
 */
function angularDifference(a: number, b: number): number {
  let diff = Math.abs(a - b) % 360;
  if (diff > 180) {
    diff = 360 - diff;
  }
  return diff;
}

/**
 * Computes the population variance of an array of numbers.
 */
function variance(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const squaredDiffs = values.map((v) => (v - mean) ** 2);
  return squaredDiffs.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * Analyzes forecast progression within a surf window and outputs
 * dynamic "trend tags" describing HOW conditions are changing.
 *
 * Tags tell users WHY the window is good by showing condition TRENDS,
 * not static snapshots. They appear on the forecast card beneath
 * the window time range.
 *
 * @param forecasts - Array of forecasts within the surf window, ordered chronologically
 * @param beach - Optional beach data for offshore wind direction comparison
 * @returns Array of up to 3 trend tag strings
 */
export function computeTrendTags(
  forecasts: EnhancedForecastEntity[],
  beach?: { wind_offshore_deg?: number | null }
): TrendTag[] {
  if (forecasts.length < 2) {
    return [];
  }

  const tags: string[] = [];

  // --- Wind Speed Tags ---
  const windTag = computeWindSpeedTag(forecasts);
  const windDirectionTag = computeWindDirectionTag(forecasts, beach);

  // "Winds Dropping"/"Winds Building" and "Winds Cleaning Up" are mutually exclusive
  // Speed change takes priority over direction change
  if (windTag) {
    tags.push(windTag);
  } else if (windDirectionTag) {
    tags.push(windDirectionTag);
  }

  // --- Tide Tags ---
  const tideTag = computeTideTag(forecasts);
  if (tideTag) {
    tags.push(tideTag);
  }

  // --- Swell Tag ---
  const swellTag = computeSwellTag(forecasts);
  if (swellTag) {
    tags.push(swellTag);
  }

  return tags.slice(0, MAX_TAGS);
}

/**
 * Checks wind speed change from first to last forecast.
 * Returns "Winds Dropping" if decrease >= 5 mph,
 * "Winds Building" if increase >= 5 mph, or null.
 */
function computeWindSpeedTag(
  forecasts: EnhancedForecastEntity[]
): TrendTag | null {
  const first = forecasts[0];
  const last = forecasts[forecasts.length - 1];

  const firstSpeed = parseFloat(first.wind_speed ?? '');
  const lastSpeed = parseFloat(last.wind_speed ?? '');

  if (isNaN(firstSpeed) || isNaN(lastSpeed)) {
    return null;
  }

  const change = lastSpeed - firstSpeed;

  if (change <= -WIND_SPEED_THRESHOLD) {
    return 'Winds Dropping';
  }
  if (change >= WIND_SPEED_THRESHOLD) {
    return 'Winds Building';
  }

  return null;
}

/**
 * Checks if wind direction rotates toward offshore while speed remains stable.
 * Returns "Winds Cleaning Up" if:
 * - Wind speed change is < 3 mph (stable)
 * - Direction improves >= 30 degrees toward offshore
 * - Beach offshore direction is provided
 */
function computeWindDirectionTag(
  forecasts: EnhancedForecastEntity[],
  beach?: { wind_offshore_deg?: number | null }
): TrendTag | null {
  if (!beach?.wind_offshore_deg && beach?.wind_offshore_deg !== 0) {
    return null;
  }

  const offshoreDeg = beach.wind_offshore_deg;
  const first = forecasts[0];
  const last = forecasts[forecasts.length - 1];

  // Check wind speed stability
  const firstSpeed = parseFloat(first.wind_speed ?? '');
  const lastSpeed = parseFloat(last.wind_speed ?? '');

  if (!isNaN(firstSpeed) && !isNaN(lastSpeed)) {
    const speedChange = Math.abs(lastSpeed - firstSpeed);
    if (speedChange >= WIND_STABLE_THRESHOLD) {
      return null;
    }
  }

  // Check direction improvement toward offshore
  const firstDir = first.wind_direction_deg;
  const lastDir = last.wind_direction_deg;

  if (firstDir == null || lastDir == null) {
    return null;
  }

  const firstOffshoreDistance = angularDifference(firstDir, offshoreDeg);
  const lastOffshoreDistance = angularDifference(lastDir, offshoreDeg);

  const improvement = firstOffshoreDistance - lastOffshoreDistance;

  if (improvement >= WIND_DIRECTION_IMPROVEMENT_THRESHOLD) {
    return 'Winds Cleaning Up';
  }

  return null;
}

/**
 * Checks tide height change from first to last forecast.
 * Returns "Tide Filling In" if increase >= 1.0 ft,
 * "Tide Draining" if decrease >= 1.0 ft, or null.
 */
function computeTideTag(forecasts: EnhancedForecastEntity[]): TrendTag | null {
  const first = forecasts[0];
  const last = forecasts[forecasts.length - 1];

  const firstHeight = parseFloat(first.tide_height ?? '');
  const lastHeight = parseFloat(last.tide_height ?? '');

  if (isNaN(firstHeight) || isNaN(lastHeight)) {
    return null;
  }

  const change = lastHeight - firstHeight;

  if (change >= TIDE_CHANGE_THRESHOLD) {
    return 'Tide Filling In';
  }
  if (change <= -TIDE_CHANGE_THRESHOLD) {
    return 'Tide Draining';
  }

  return null;
}

/**
 * Checks if wave period is consistently high across all forecasts.
 * Returns "Clean Swell" if average period >= 10s and variance < 4, or null.
 */
function computeSwellTag(forecasts: EnhancedForecastEntity[]): TrendTag | null {
  const periods: number[] = [];

  for (const f of forecasts) {
    const period = parseFloat(f.wave_period ?? '');
    if (isNaN(period)) {
      return null; // If any forecast has no period data, can't assess consistency
    }
    periods.push(period);
  }

  if (periods.length === 0) {
    return null;
  }

  const avg = periods.reduce((sum, p) => sum + p, 0) / periods.length;
  const periodVariance = variance(periods);

  if (avg >= CLEAN_SWELL_PERIOD_MIN && periodVariance < CLEAN_SWELL_VARIANCE_MAX) {
    return 'Clean Swell';
  }

  return null;
}
