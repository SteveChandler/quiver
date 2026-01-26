/**
 * Tide Boundary Calculator
 *
 * Functions for extracting tide schedules and calculating tide-driven window boundaries.
 *
 * @module lib/services/discovery/window-selector/tide-boundary-calculator
 */

import type { Beach } from '@/types/database';
import type { EnhancedForecastEntity, TideScheduleEntry } from '@/types/forecast';
import { calculateTideWindow } from '@/lib/utils/tide-interpolation';

/**
 * Extract tide schedule from forecasts.
 * The tide schedule is stored in raw_forecast of the first forecast of each day.
 *
 * @param forecasts - Array of forecast entities
 * @returns Tide schedule entries or null if not found
 */
export function extractTideSchedule(forecasts: EnhancedForecastEntity[]): TideScheduleEntry[] | null {
  for (const forecast of forecasts) {
    const rawForecast = forecast.raw_forecast as { tide_schedule?: TideScheduleEntry[] } | null;
    if (rawForecast?.tide_schedule && rawForecast.tide_schedule.length >= 2) {
      return rawForecast.tide_schedule;
    }
  }
  return null;
}

/**
 * Calculate tide-driven window boundaries if beach has tide thresholds.
 * Returns null to indicate fallback to hourly boundaries should be used.
 *
 * @param forecasts - Array of forecast entities (for tide schedule extraction)
 * @param beach - Beach entity with tide preferences
 * @param startTime - Window start time
 * @returns Window boundaries { start, end } or null if tide-driven boundaries not applicable
 */
export function calculateTideDrivenBoundaries(
  forecasts: EnhancedForecastEntity[],
  beach: Beach,
  startTime: Date
): { start: Date; end: Date } | null {
  // Check if beach has tide thresholds
  if (
    beach.preferred_tide_ft_min === null ||
    beach.preferred_tide_ft_min === undefined ||
    beach.preferred_tide_ft_max === null ||
    beach.preferred_tide_ft_max === undefined
  ) {
    return null;
  }

  // Extract tide schedule from forecasts
  const tideSchedule = extractTideSchedule(forecasts);
  if (!tideSchedule) {
    return null;
  }

  // Map direction preference
  const directionMap: Record<string, 'rising' | 'falling' | 'slack' | 'either'> = {
    rising: 'rising',
    falling: 'falling',
    slack: 'slack',
    either: 'either',
  };
  const preferredDirection = directionMap[beach.preferred_tide_direction || 'either'] || 'either';

  // Calculate tide window
  const tideWindow = calculateTideWindow({
    tideSchedule,
    minHeight: beach.preferred_tide_ft_min,
    maxHeight: beach.preferred_tide_ft_max,
    preferredDirection,
    afterTime: startTime,
  });

  return tideWindow;
}
