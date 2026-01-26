/**
 * Window Refiner
 *
 * Functions for applying sub-hour boundary refinement to windows.
 *
 * @module lib/services/discovery/window-selector/window-refiner
 */

import type { Beach } from '@/types/database';
import type { EnhancedForecastEntity } from '@/types/forecast';
import { refineWindowBounds } from '@/lib/surf/scoring';
import { interpolateTideHeight } from '@/lib/utils/tide-interpolation';
import { extractTideSchedule } from './tide-boundary-calculator';
import { MIN_SCORE_THRESHOLD } from './constants';
import type { CandidateWindow } from './types';

/**
 * Apply sub-hour refinement to a window that used hourly boundaries.
 * Only applicable when tide-driven boundaries were NOT used.
 *
 * @param window - The candidate window to potentially refine
 * @param filteredForecasts - Array of scored forecasts with forecastTime
 * @param forecasts - All forecast entities (for tide data extraction)
 * @param sunsets - Array of sunset times for daylight checking
 * @param sunrises - Array of sunrise times for daylight checking
 * @param beach - Beach entity with tide preferences
 * @param beachTz - IANA timezone for the beach
 * @returns Window with potentially refined start/end times
 */
export function applySubHourRefinement(
  window: CandidateWindow,
  filteredForecasts: Array<{ forecastTime: Date; score: number }>,
  forecasts: EnhancedForecastEntity[],
  sunsets: Date[],
  sunrises: Date[],
  beach: Beach,
  beachTz: string
): { start: Date; end: Date } {
  // Only apply to non-tide-driven windows
  if (window.usedTideBoundaries) {
    return { start: window.start, end: window.end };
  }

  const windowStart = window.start;
  const windowEnd = window.end;

  // Helper to get local date string for beach timezone
  const getLocalDateStrForBeach = (d: Date): string => {
    try {
      return d.toLocaleDateString('en-CA', { timeZone: beachTz });
    } catch {
      return d.toISOString().slice(0, 10);
    }
  };

  // Floor to hour boundaries for index lookup (window times may be non-hourly)
  const startHourBoundary = new Date(windowStart);
  startHourBoundary.setUTCMinutes(0, 0, 0);
  const startIdx = filteredForecasts.findIndex(
    (f) => f.forecastTime.getTime() === startHourBoundary.getTime()
  );

  const endHourBoundary = new Date(windowEnd);
  endHourBoundary.setUTCMinutes(0, 0, 0);
  const endIdx = filteredForecasts.findIndex(
    (f) => f.forecastTime.getTime() === endHourBoundary.getTime()
  );

  // Build hourly scores array for index lookups
  const hourlyScores = filteredForecasts.map((f) => f.score);

  // Can only do score-based refinement if we have the 4 scores needed for interpolation
  const canRefine =
    startIdx !== -1 &&
    endIdx !== -1 &&
    startIdx + 1 < hourlyScores.length &&
    endIdx > 0;

  // Step 1: Apply score/tide/light refinement if possible
  let refinedStart = windowStart;
  let refinedEnd = windowEnd;

  if (canRefine) {
    // Build tide data points for interpolation
    const tidePoints =
      extractTideSchedule(forecasts)?.map((t) => ({
        time: t.time * 1000,
        height: t.height,
      })) ?? [];

    // Create light checker for sunrise/sunset constraints
    const isLightOk = (t: Date): boolean => {
      const tDateStr = getLocalDateStrForBeach(t);
      const tSunset = sunsets.find((s) => getLocalDateStrForBeach(s) === tDateStr);
      const tSunrise = sunrises.find((s) => getLocalDateStrForBeach(s) === tDateStr);
      if (tSunrise && t < tSunrise) return false;
      if (tSunset && t > tSunset) return false;
      return true;
    };

    // Apply refinement
    const refined = refineWindowBounds({
      hourlyStart: windowStart,
      hourlyEnd: windowEnd,
      scoreAtStart: hourlyScores[startIdx],
      scoreAtNextHour: hourlyScores[startIdx + 1],
      scoreAtPrevHour: hourlyScores[endIdx - 1],
      scoreAtEnd: hourlyScores[endIdx],
      threshold: MIN_SCORE_THRESHOLD,
      getTideHeightAtTime: (t) =>
        tidePoints.length > 0 ? interpolateTideHeight(tidePoints, t) : null,
      tideMin: beach.preferred_tide_ft_min ?? null,
      tideMax: beach.preferred_tide_ft_max ?? null,
      isLightOk,
    });

    refinedStart = refined.start;
    refinedEnd = refined.end;

    // Log telemetry in development
    if (process.env.NODE_ENV === 'development' && refined.usedInterpolation) {
      console.debug('[window-refine]', {
        beach: beach.name,
        rawStartDelta: refined.rawStartDeltaMin,
        rawEndDelta: refined.rawEndDeltaMin,
        finalStartDelta: refined.finalStartDeltaMin,
        finalEndDelta: refined.finalEndDeltaMin,
        clampedStart: refined.clampedStart,
        clampedEnd: refined.clampedEnd,
      });
    }
  }

  // Return the full refined window (no peak-centering)
  // The peakTime is computed separately in selectBestWindow and passed to the UI
  // so users can see "Best at X" for long windows while still seeing the full duration
  return { start: refinedStart, end: refinedEnd };
}
