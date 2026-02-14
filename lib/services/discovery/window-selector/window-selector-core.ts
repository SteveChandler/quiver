/**
 * Window Selector Core
 *
 * Main algorithm for selecting the best surf window from forecast data.
 *
 * ALGORITHM:
 * 1. Score all forecasts upfront and filter past times
 * 2. For each valid forecast window start:
 *    - Skip if score below MIN_SCORE_THRESHOLD
 *    - Check Local Hour to filter night sessions (9pm-5am)
 *    - Find NEXT sunset > startTime
 *    - Skip if too close to sunset (< MIN_SESSION_HOURS)
 *    - Extend window end until conditions degrade or MAX_WINDOW_HOURS reached
 *    - Cap window end at sunset
 * 3. Apply time-decay penalty for ranking
 * 4. Select highest adjusted score
 *
 * @module lib/services/discovery/window-selector/window-selector-core
 */

import type { Beach } from '@/types/database';
import type { EnhancedForecastEntity } from '@/types/forecast';
import type {
  PersonalizedForecastWindow,
  TimeSlot,
} from '@/types/personalization';
import type { getUserSurfPreferences } from '@/lib/services/preference-learning-service';
import { getTimezoneFromCoords } from '@/lib/utils/timezone-utils.server';
import { createContextLogger } from '@/lib/logger';

const log = createContextLogger('WindowSelector');

import type { WindowSelectorOptions, CandidateWindow, ScoredForecast } from './types';
import {
  TIME_DECAY_PER_HOUR,
  MAX_TIME_DECAY_HOURS,
  SOON_BONUS_2HR,
  SOON_BONUS_4HR,
  UNDERWAY_BONUS,
  MIN_SESSION_HOURS,
  MIN_SCORE_THRESHOLD,
  MIN_SCORE_THRESHOLD_MORNING,
  MAX_WINDOW_HOURS,
  FORECAST_WINDOW_DURATION_MINUTES,
  PAST_WINDOW_TOLERANCE_MINUTES,
  MORNING_CUTOFF_HOUR,
  TODAY_BONUS_POINTS,
  MORNING_TIME_BONUS,
  EVENING_CUTOFF_HOUR,
} from './constants';
import { getLocalDateStr, getTimeSlotRange, capEndTimeToTimeSlot, getLocalHour } from './time-slot-utils';
import { calculateTideDrivenBoundaries } from './tide-boundary-calculator';
import { findPeakWithinWindow } from './peak-finder';
import { applySubHourRefinement } from './window-refiner';
import { scoreWindowWithEngine } from './window-scorer';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Score all forecasts and filter out past times.
 */
function prepareForecasts(
  forecasts: EnhancedForecastEntity[],
  beach: Beach,
  beachTz: string,
  now: Date,
  todayDateStr: string
): ScoredForecast[] {
  return forecasts
    .map((forecast) => {
      // forecast_at is already a UTC ISO 8601 timestamp — parse directly.
      // No timezone conversion needed (fixes prior double-conversion via fromZonedTime).
      const forecastTime = new Date(forecast.forecast_at);
      const score = scoreWindowWithEngine(forecast, beach);

      // Check if forecast is for today (in beach timezone)
      let isToday = false;
      let localHourStr = '';
      try {
        const forecastDateStr = new Intl.DateTimeFormat("en-CA", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          timeZone: beachTz,
        }).format(forecastTime);
        isToday = forecastDateStr === todayDateStr;
        localHourStr = new Intl.DateTimeFormat("en-US", {
          hour: "numeric",
          minute: "numeric",
          hour12: true,
          timeZone: beachTz,
        }).format(forecastTime);
      } catch {
        // Default to not today if timezone conversion fails
      }

      return { forecast, forecastTime, score, isToday, localHourStr };
    })
    .filter(({ forecastTime }) => {
      // Only show windows that are still in progress or just ended
      const windowDurationMs = FORECAST_WINDOW_DURATION_MINUTES * 60 * 1000;
      const toleranceMs = PAST_WINDOW_TOLERANCE_MINUTES * 60 * 1000;
      const windowEndTime = new Date(forecastTime.getTime() + windowDurationMs);
      const cutoffTime = new Date(now.getTime() - toleranceMs);
      return windowEndTime >= cutoffTime;
    })
    .sort((a, b) => a.forecastTime.getTime() - b.forecastTime.getTime());
}

/**
 * Filter forecasts by time slot to enforce strict time slot boundaries.
 */
function filterByTimeSlot(
  forecasts: ScoredForecast[],
  timeSlot: TimeSlot | undefined,
  sunrises: Date[],
  beachTz: string
): ScoredForecast[] {
  if (!timeSlot || timeSlot === 'any') {
    return forecasts;
  }

  return forecasts.filter(({ forecastTime }) => {
    try {
      const localHour = parseInt(
        new Intl.DateTimeFormat("en-US", {
          hour: "numeric",
          hour12: false,
          timeZone: beachTz,
        }).format(forecastTime),
        10
      );

      const slotRange = getTimeSlotRange(timeSlot, sunrises, forecastTime, beachTz);
      return localHour >= slotRange.startHour && localHour < slotRange.endHour;
    } catch {
      return false;
    }
  });
}

interface LightCheckOptions {
  startTime: Date;
  sunsets: Date[];
  sunrises: Date[];
  beachTz: string;
  getLocalDateStrForBeach: (d: Date) => string;
}

/**
 * Check if a forecast start time should be skipped due to night/sunset constraints.
 */
function shouldSkipDueToLight({
  startTime,
  sunsets,
  sunrises,
  beachTz,
  getLocalDateStrForBeach,
}: LightCheckOptions): boolean {
  // Night Filter (using Local Hour)
  try {
    const localHour = parseInt(
      new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        hour12: false,
        timeZone: beachTz,
      }).format(startTime),
      10
    );

    const nightCutoff = sunsets.length > 0 ? 21 : 18;
    if (localHour >= nightCutoff || localHour < 6) {
      return true;
    }
  } catch {
    // If tz conversion fails, proceed to sunset check
  }

  // Pre-Sunrise Rejection (allow 30 min before sunrise for civil twilight)
  const forecastDateStr = getLocalDateStrForBeach(startTime);
  const sameDaySunrise = sunrises.find(s => getLocalDateStrForBeach(s) === forecastDateStr);

  if (sameDaySunrise) {
    const civilTwilightMs = 30 * 60 * 1000;
    if (startTime.getTime() < sameDaySunrise.getTime() - civilTwilightMs) {
      return true;
    }
  }

  // Post-Sunset Rejection
  const sameDaySunset = sunsets.find(s => getLocalDateStrForBeach(s) === forecastDateStr);

  if (sameDaySunset && startTime.getTime() > sameDaySunset.getTime()) {
    return true;
  }

  // Defensive fallback when sunset data is stale
  if (!sameDaySunset && sunsets.length > 0) {
    try {
      const localHour = parseInt(
        new Intl.DateTimeFormat("en-US", {
          hour: "numeric",
          hour12: false,
          timeZone: beachTz,
        }).format(startTime),
        10
      );
      if (localHour >= 18) {
        return true;
      }
    } catch {
      return true;
    }
  }

  return false;
}

/**
 * Calculate the adjusted score for ranking windows.
 */
function calculateAdjustedScore(
  startScore: number,
  startTime: Date,
  now: Date,
  isToday: boolean,
  isMorning: boolean,
  beachTz: string
): number {
  const rawHoursAhead = (startTime.getTime() - now.getTime()) / (1000 * 60 * 60);
  const hoursAhead = Math.max(0, rawHoursAhead);

  // Time decay
  const cappedHours = Math.min(hoursAhead, MAX_TIME_DECAY_HOURS);
  const timeDecay = cappedHours * TIME_DECAY_PER_HOUR;

  // Start-soon bonus
  let soonBonus = 0;
  if (hoursAhead <= 2) soonBonus = SOON_BONUS_2HR;
  else if (hoursAhead <= 4) soonBonus = SOON_BONUS_4HR;

  // Underway bonus
  const underwayBonus = rawHoursAhead < 0 ? UNDERWAY_BONUS : 0;

  // Morning priority
  const todayBonus = (isMorning && isToday) ? TODAY_BONUS_POINTS : 0;

  // Morning time bonus
  let morningTimeBonus = 0;
  if (isMorning && isToday) {
    try {
      const forecastLocalHour = parseInt(
        new Intl.DateTimeFormat("en-US", {
          hour: "numeric",
          hour12: false,
          timeZone: beachTz,
        }).format(startTime),
        10
      );
      if (forecastLocalHour < EVENING_CUTOFF_HOUR) {
        morningTimeBonus = MORNING_TIME_BONUS;
      }
    } catch {
      // If timezone conversion fails, no bonus
    }
  }

  return startScore - timeDecay + todayBonus + morningTimeBonus + soonBonus + underwayBonus;
}

/**
 * Calculate window end time based on condition degradation or max hours.
 */
function calculateWindowEnd(
  startIdx: number,
  effectiveStartTime: Date,
  effectiveThreshold: number,
  filteredForecasts: ScoredForecast[],
  getLocalDateStrForBeach: (d: Date) => string
): Date {
  let endTime = new Date(effectiveStartTime.getTime() + MAX_WINDOW_HOURS * 60 * 60 * 1000);

  for (let j = startIdx; j < filteredForecasts.length - 1; j++) {
    const current = filteredForecasts[j];
    const next = filteredForecasts[j + 1];

    // Stop if next forecast is on a different date
    const currentLocalDate = getLocalDateStrForBeach(current.forecastTime);
    const nextLocalDate = getLocalDateStrForBeach(next.forecastTime);
    if (currentLocalDate !== nextLocalDate) break;

    if (current.score >= effectiveThreshold && next.score < effectiveThreshold) {
      // Linear interpolation to find precise degradation time
      const dropAmount = current.score - next.score;
      if (dropAmount <= 0) break;
      const thresholdDiff = current.score - effectiveThreshold;
      const fractionOfHour = dropAmount > 0 ? thresholdDiff / dropAmount : 0;

      const degradationTime = new Date(
        current.forecastTime.getTime() + fractionOfHour * 60 * 60 * 1000
      );

      if (degradationTime < endTime) {
        endTime = degradationTime;
      }
      break;
    }

    // Stop extending if we've gone past max window
    const windowDuration = (next.forecastTime.getTime() - effectiveStartTime.getTime()) / (1000 * 60 * 60);
    if (windowDuration >= MAX_WINDOW_HOURS) {
      endTime = new Date(effectiveStartTime.getTime() + MAX_WINDOW_HOURS * 60 * 60 * 1000);
      break;
    }
  }

  return endTime;
}

/**
 * Apply sunset cap to window end time.
 */
function applySunsetCap(
  endTime: Date,
  effectiveStartTime: Date,
  sunsets: Date[],
  beachTz: string,
  getLocalDateStrForBeach: (d: Date) => string
): Date {
  const forecastDateStr = getLocalDateStrForBeach(effectiveStartTime);
  const sameDaySunset = sunsets.find(s => getLocalDateStrForBeach(s) === forecastDateStr);

  if (sameDaySunset && sameDaySunset < endTime) {
    return sameDaySunset;
  }

  if (!sameDaySunset && sunsets.length > 0) {
    // Defensive fallback: cap at conservative 6pm
    try {
      const localDateParts = new Intl.DateTimeFormat("en-US", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        timeZone: beachTz,
      }).formatToParts(effectiveStartTime);

      const year = localDateParts.find(p => p.type === "year")?.value;
      const month = localDateParts.find(p => p.type === "month")?.value;
      const day = localDateParts.find(p => p.type === "day")?.value;

      if (year && month && day) {
        const conservative6pmStr = `${year}-${month}-${day}T18:00:00`;
        const tempDate = new Date(effectiveStartTime);
        const utcTime = tempDate.toLocaleString("en-US", { timeZone: "UTC" });
        const localTime = tempDate.toLocaleString("en-US", { timeZone: beachTz });
        const utcDate = new Date(utcTime);
        const localDate = new Date(localTime);
        const offsetMs = localDate.getTime() - utcDate.getTime();
        const conservative6pm = new Date(new Date(conservative6pmStr + "Z").getTime() - offsetMs);

        if (conservative6pm < endTime) {
          return conservative6pm;
        }
      }
    } catch {
      const maxEnd = new Date(effectiveStartTime.getTime() + MAX_WINDOW_HOURS * 60 * 60 * 1000);
      if (maxEnd < endTime) {
        return maxEnd;
      }
    }
  }

  return endTime;
}

/**
 * Build the final PersonalizedForecastWindow result.
 */
function buildResult(
  bestWindow: CandidateWindow,
  filteredForecasts: ScoredForecast[],
  beachTz: string
): PersonalizedForecastWindow {
  const peakTime = findPeakWithinWindow(
    bestWindow.start,
    bestWindow.end,
    filteredForecasts
  );

  return {
    start: bestWindow.start,
    end: bestWindow.end,
    tide: bestWindow.forecast.tide_status || 'Unknown',
    wind: `${bestWindow.forecast.wind_speed} ${bestWindow.forecast.wind_direction}`,
    waveHeight: bestWindow.forecast.wave_height || 'Unknown',
    wavePeriod: bestWindow.forecast.wave_period || 'Unknown',
    dataSource: bestWindow.forecast.data_source || 'FALLBACK',
    confidence: bestWindow.forecast.confidence_score || 50,
    timezone: beachTz,
    usedTideBoundaries: bestWindow.usedTideBoundaries,
    score: bestWindow.score,
    peakTime,
  };
}

// ============================================================================
// Main Export
// ============================================================================

/**
 * Select best surf window from forecast using composite scoring with time-priority.
 * Sunset-aware: caps windows at sunset and skips windows too close to dark.
 *
 * @param options - Window selection options including forecasts, beach, user prefs
 * @returns Best window or null if none viable
 */
export function selectBestWindow(
  options: WindowSelectorOptions
): PersonalizedForecastWindow | null;

/**
 * Select best surf window from forecast using composite scoring with time-priority.
 * (Legacy overload with positional parameters)
 *
 * @param forecasts - Array of forecast entities for the beach
 * @param beach - Beach metadata for wind/tide preferences
 * @param userPrefs - User surf preferences (optional)
 * @param horizonHours - Optional max hours ahead to consider
 * @param sunTimesCache - Optional Map of beach_id -> { sunrises, sunsets }
 * @param timeSlot - Optional time slot filter
 * @returns Best window or null if none viable
 */
export function selectBestWindow(
  forecasts: EnhancedForecastEntity[],
  beach: Beach,
  userPrefs: Awaited<ReturnType<typeof getUserSurfPreferences>> | null,
  horizonHours?: number,
  sunTimesCache?: Map<string, { sunrises: Date[]; sunsets: Date[] }>,
  timeSlot?: TimeSlot
): PersonalizedForecastWindow | null;

export function selectBestWindow(
  optionsOrForecasts: WindowSelectorOptions | EnhancedForecastEntity[],
  beach?: Beach,
  userPrefs?: Awaited<ReturnType<typeof getUserSurfPreferences>> | null,
  horizonHours?: number,
  sunTimesCache?: Map<string, { sunrises: Date[]; sunsets: Date[] }>,
  timeSlot?: TimeSlot
): PersonalizedForecastWindow | null {
  // Handle options object vs positional parameters
  let forecasts: EnhancedForecastEntity[];
  let actualBeach: Beach;
  let actualHorizonHours: number | undefined;
  let actualSunTimesCache: Map<string, { sunrises: Date[]; sunsets: Date[] }> | undefined;
  let actualTimeSlot: TimeSlot | undefined;

  if (Array.isArray(optionsOrForecasts)) {
    forecasts = optionsOrForecasts;
    actualBeach = beach!;
    actualHorizonHours = horizonHours;
    actualSunTimesCache = sunTimesCache;
    actualTimeSlot = timeSlot;
  } else {
    forecasts = optionsOrForecasts.forecasts;
    actualBeach = optionsOrForecasts.beach;
    actualHorizonHours = optionsOrForecasts.horizonHours;
    actualSunTimesCache = optionsOrForecasts.sunTimesCache;
    actualTimeSlot = optionsOrForecasts.timeSlot;
  }

  if (forecasts.length === 0) {
    log.debug(`[selectBestWindow] ${actualBeach.name}: No forecasts provided`);
    return null;
  }

  const now = new Date();
  const beachTz = getTimezoneFromCoords(actualBeach.lat || 0, actualBeach.lon || 0);

  // Helper: get local date string for beach timezone
  const getLocalDateStrForBeach = (time: Date): string => getLocalDateStr(time, beachTz);

  // Check if it's "morning" (before noon) in beach timezone
  let isMorning = false;
  let todayDateStr = '';
  try {
    const localHourNow = parseInt(
      new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        hour12: false,
        timeZone: beachTz,
      }).format(now),
      10
    );
    isMorning = localHourNow < MORNING_CUTOFF_HOUR;
    todayDateStr = new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: beachTz,
    }).format(now);
  } catch {
    // If timezone conversion fails, default to not morning priority
  }

  // Score and prepare forecasts
  const scoredForecasts = prepareForecasts(forecasts, actualBeach, beachTz, now, todayDateStr);
  if (scoredForecasts.length === 0) {
    log.debug(`[selectBestWindow] ${actualBeach.name}: No scored forecasts after filtering past times`);
    return null;
  }

  // Get sun times
  const sunTimes = actualSunTimesCache?.get(actualBeach.id);
  const sunsets = sunTimes?.sunsets || [];
  const sunrises = sunTimes?.sunrises || [];

  // Filter by time slot
  const filteredForecasts = filterByTimeSlot(scoredForecasts, actualTimeSlot, sunrises, beachTz);
  if (filteredForecasts.length === 0) {
    log.debug(`[selectBestWindow] ${actualBeach.name}: No forecasts after time slot filter (slot=${actualTimeSlot || 'any'})`);
    return null;
  }

  log.debug(`[selectBestWindow] ${actualBeach.name}: ${filteredForecasts.length} forecasts to evaluate, isMorning=${isMorning}`);

  let bestWindow: CandidateWindow | null = null;
  let bestAdjustedScore = -1;

  for (let i = 0; i < filteredForecasts.length; i++) {
    const { forecast, forecastTime: startTime, score: startScore, isToday } = filteredForecasts[i];

    // Determine threshold
    const shouldApplyThreshold = !actualTimeSlot || actualTimeSlot === 'any';
    const effectiveThreshold = shouldApplyThreshold
      ? (isMorning && isToday) ? MIN_SCORE_THRESHOLD_MORNING : MIN_SCORE_THRESHOLD
      : 0;

    if (startScore < effectiveThreshold) {
      log.debug(`[selectBestWindow] ${actualBeach.name}: Forecast ${i} score=${startScore} < threshold=${effectiveThreshold}, skipping`);
      continue;
    }

    // Light/sunset checks
    if (shouldSkipDueToLight({ startTime, sunsets, sunrises, beachTz, getLocalDateStrForBeach })) {
      log.debug(`[selectBestWindow] ${actualBeach.name}: Forecast ${i} skipped due to light/sunset constraints`);
      continue;
    }

    // Sunset proximity check
    const forecastDateStr = getLocalDateStrForBeach(startTime);
    const sameDaySunset = sunsets.find(s => getLocalDateStrForBeach(s) === forecastDateStr);

    if (sameDaySunset) {
      const hoursUntilSunset = (sameDaySunset.getTime() - startTime.getTime()) / (1000 * 60 * 60);
      if (hoursUntilSunset < MIN_SESSION_HOURS) {
        log.debug(`[selectBestWindow] ${actualBeach.name}: Forecast ${i} too close to sunset (${hoursUntilSunset.toFixed(1)}h < ${MIN_SESSION_HOURS}h)`);
        continue;
      }
    } else {
      log.debug(`[selectBestWindow] ${actualBeach.name}: No same-day sunset found for ${forecastDateStr}, sunsets available: ${sunsets.map(s => getLocalDateStrForBeach(s)).join(', ')}`);
    }

    // Horizon constraint
    const rawHoursAhead = (startTime.getTime() - now.getTime()) / (1000 * 60 * 60);
    const hoursAhead = Math.max(0, rawHoursAhead);
    if (actualHorizonHours && hoursAhead > actualHorizonHours) continue;

    let effectiveStartTime = startTime;

    // Try tide-driven boundaries
    const tideBoundaries = calculateTideDrivenBoundaries(forecasts, actualBeach, startTime);
    let useTideBoundaries = !!tideBoundaries;
    let skipThisForecast = false;

    if (tideBoundaries) {
      // Validate tide boundaries against time slot
      if (actualTimeSlot && actualTimeSlot !== 'any') {
        try {
          const tideStartHour = parseInt(
            new Intl.DateTimeFormat("en-US", {
              hour: "numeric",
              hour12: false,
              timeZone: beachTz,
            }).format(tideBoundaries.start),
            10
          );
          const slotRange = getTimeSlotRange(actualTimeSlot, sunrises, startTime, beachTz);

          if (tideStartHour < slotRange.startHour || tideStartHour >= slotRange.endHour) {
            const forecastStartHour = parseInt(
              new Intl.DateTimeFormat("en-US", {
                hour: "numeric",
                hour12: false,
                timeZone: beachTz,
              }).format(startTime),
              10
            );

            if (forecastStartHour >= slotRange.startHour && forecastStartHour < slotRange.endHour) {
              useTideBoundaries = false;
            } else {
              skipThisForecast = true;
            }
          }
        } catch {
          useTideBoundaries = false;
        }
      }

      // Check overnight span
      if (useTideBoundaries && !skipThisForecast) {
        const tideStartDate = getLocalDateStrForBeach(tideBoundaries.start);
        const tideEndDate = getLocalDateStrForBeach(tideBoundaries.end);
        if (tideStartDate !== tideEndDate) {
          useTideBoundaries = false;
        }
      }
    }

    if (skipThisForecast) {
      continue;
    }

    let endTime: Date;

    if (tideBoundaries && useTideBoundaries) {
      effectiveStartTime = tideBoundaries.start;
      endTime = tideBoundaries.end;
    } else {
      endTime = calculateWindowEnd(i, effectiveStartTime, effectiveThreshold, filteredForecasts, getLocalDateStrForBeach);
    }

    // Apply sunset cap
    endTime = applySunsetCap(endTime, effectiveStartTime, sunsets, beachTz, getLocalDateStrForBeach);

    // Cap at time slot end (only for non-tide-driven)
    if (!tideBoundaries || !useTideBoundaries) {
      endTime = capEndTimeToTimeSlot(effectiveStartTime, endTime, actualTimeSlot, beachTz);
    }

    // Validate minimum session length
    const durationHours = (endTime.getTime() - effectiveStartTime.getTime()) / (1000 * 60 * 60);
    if (durationHours < MIN_SESSION_HOURS) {
      log.debug(`[selectBestWindow] ${actualBeach.name}: Forecast ${i} session too short (${durationHours.toFixed(1)}h < ${MIN_SESSION_HOURS}h)`);
      continue;
    }

    // Calculate adjusted score
    const adjustedScore = calculateAdjustedScore(startScore, startTime, now, isToday, isMorning, beachTz);

    if (adjustedScore > bestAdjustedScore) {
      bestAdjustedScore = adjustedScore;
      bestWindow = {
        forecast,
        start: effectiveStartTime,
        end: endTime,
        score: startScore,
        usedTideBoundaries: useTideBoundaries,
      };
    }
  }

  // Log main loop result
  if (bestWindow) {
    log.debug(`[selectBestWindow] ${actualBeach.name}: Main loop found window with score=${bestWindow.score}`);
  } else {
    log.debug(`[selectBestWindow] ${actualBeach.name}: Main loop found no valid window, trying fallback...`);
  }

  // Fallback: if no forecasts passed threshold, use the best available anyway
  if (!bestWindow && filteredForecasts.length > 0) {
    bestWindow = selectFallbackWindow(
      filteredForecasts,
      sunsets,
      sunrises,
      actualTimeSlot,
      actualHorizonHours,
      now,
      beachTz,
      isMorning,
      getLocalDateStrForBeach,
      actualBeach.name // Pass beach name for logging
    );
  }

  if (!bestWindow) {
    log.debug(`[selectBestWindow] ${actualBeach.name}: Both main loop and fallback returned null - NO WINDOW SELECTED`);
    return null;
  }

  // Apply sub-hour refinement
  const refinedTimes = applySubHourRefinement(
    bestWindow,
    filteredForecasts,
    forecasts,
    sunsets,
    sunrises,
    actualBeach,
    beachTz
  );
  bestWindow = {
    ...bestWindow,
    start: refinedTimes.start,
    end: refinedTimes.end,
  };

  return buildResult(bestWindow, filteredForecasts, beachTz);
}

/**
 * Select a fallback window when no forecasts pass the threshold.
 */
function selectFallbackWindow(
  filteredForecasts: ScoredForecast[],
  sunsets: Date[],
  sunrises: Date[],
  timeSlot: TimeSlot | undefined,
  horizonHours: number | undefined,
  now: Date,
  beachTz: string,
  isMorning: boolean,
  getLocalDateStrForBeach: (d: Date) => string,
  beachName?: string // For debug logging
): CandidateWindow | null {
  const logPrefix = beachName ? `[selectFallbackWindow] ${beachName}` : '[selectFallbackWindow]';
  // Filter out night hours and post-sunset times
  const daylightForecasts = filteredForecasts.filter(({ forecastTime }) => {
    // Time slot filter
    if (timeSlot && timeSlot !== 'any') {
      try {
        const localHour = parseInt(
          new Intl.DateTimeFormat("en-US", {
            hour: "numeric",
            hour12: false,
            timeZone: beachTz,
          }).format(forecastTime),
          10
        );
        const slotRange = getTimeSlotRange(timeSlot, sunrises, forecastTime, beachTz);
        if (localHour < slotRange.startHour || localHour >= slotRange.endHour) {
          return false;
        }
      } catch {
        return false;
      }
    }

    // Post-sunset rejection
    const forecastDateStr = getLocalDateStrForBeach(forecastTime);
    const sameDaySunset = sunsets.find(s => getLocalDateStrForBeach(s) === forecastDateStr);
    if (sameDaySunset && forecastTime.getTime() > sameDaySunset.getTime()) {
      return false;
    }

    try {
      const localHour = parseInt(
        new Intl.DateTimeFormat("en-US", {
          hour: "numeric",
          hour12: false,
          timeZone: beachTz,
        }).format(forecastTime),
        10
      );

      const hasValidSunsetForDate = !!sameDaySunset;
      const nightCutoff = hasValidSunsetForDate ? 21 : 18;

      return localHour >= 6 && localHour < nightCutoff;
    } catch {
      return false;
    }
  });

  if (daylightForecasts.length === 0) {
    log.debug(`${logPrefix}: No daylight forecasts available after filtering ${filteredForecasts.length} input forecasts`);
    return null;
  }

  log.debug(`${logPrefix}: ${daylightForecasts.length} daylight forecasts available for fallback selection`);

  // Calculate adjusted score for fallback selection
  const getAdjustedScore = (f: ScoredForecast) => {
    const rawHoursAhead = (f.forecastTime.getTime() - now.getTime()) / (1000 * 60 * 60);
    const hoursAhead = Math.max(0, rawHoursAhead);

    let soonBonus = 0;
    if (hoursAhead <= 2) soonBonus = SOON_BONUS_2HR;
    else if (hoursAhead <= 4) soonBonus = SOON_BONUS_4HR;

    const underwayBonus = rawHoursAhead < 0 ? UNDERWAY_BONUS : 0;

    let bonus = 0;
    if (isMorning && f.isToday) {
      bonus += TODAY_BONUS_POINTS;
      try {
        const localHour = parseInt(
          new Intl.DateTimeFormat("en-US", {
            hour: "numeric",
            hour12: false,
            timeZone: beachTz,
          }).format(f.forecastTime),
          10
        );
        if (localHour < EVENING_CUTOFF_HOUR) {
          bonus += MORNING_TIME_BONUS;
        }
      } catch {
        // No bonus on error
      }
    }

    return f.score + bonus + soonBonus + underwayBonus;
  };

  const best = daylightForecasts.reduce((prev, curr) =>
    getAdjustedScore(curr) > getAdjustedScore(prev) ? curr : prev
  );

  // Check horizon constraint
  const hoursAhead = (best.forecastTime.getTime() - now.getTime()) / (1000 * 60 * 60);
  if (horizonHours && hoursAhead > horizonHours) {
    log.debug(`${logPrefix}: Best fallback forecast is ${hoursAhead.toFixed(1)}h ahead, exceeds horizon of ${horizonHours}h`);
    return null;
  }

  const effectiveStartTime = best.forecastTime;
  const fallbackDateStr = getLocalDateStrForBeach(effectiveStartTime);
  const fallbackSunset = sunsets.find(s => getLocalDateStrForBeach(s) === fallbackDateStr);

  let endTime = new Date(effectiveStartTime.getTime() + MAX_WINDOW_HOURS * 60 * 60 * 1000);

  if (fallbackSunset && fallbackSunset < endTime) {
    endTime = fallbackSunset;
  } else if (!fallbackSunset && sunsets.length > 0) {
    try {
      const localDateParts = new Intl.DateTimeFormat("en-US", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        timeZone: beachTz,
      }).formatToParts(effectiveStartTime);

      const year = localDateParts.find(p => p.type === "year")?.value;
      const month = localDateParts.find(p => p.type === "month")?.value;
      const day = localDateParts.find(p => p.type === "day")?.value;

      if (year && month && day) {
        const conservative6pmStr = `${year}-${month}-${day}T18:00:00`;
        const tempDate = new Date(effectiveStartTime);
        const utcTime = tempDate.toLocaleString("en-US", { timeZone: "UTC" });
        const localTime = tempDate.toLocaleString("en-US", { timeZone: beachTz });
        const utcDate = new Date(utcTime);
        const localDate = new Date(localTime);
        const offsetMs = localDate.getTime() - utcDate.getTime();
        const conservative6pm = new Date(new Date(conservative6pmStr + "Z").getTime() - offsetMs);

        if (conservative6pm < endTime) {
          endTime = conservative6pm;
        }
      }
    } catch {
      // Keep MAX_WINDOW_HOURS cap
    }
  }

  // Cap at time slot end
  endTime = capEndTimeToTimeSlot(effectiveStartTime, endTime, timeSlot, beachTz);

  const durationHours = (endTime.getTime() - effectiveStartTime.getTime()) / (1000 * 60 * 60);
  if (durationHours < MIN_SESSION_HOURS) {
    log.debug(`${logPrefix}: Fallback session too short (${durationHours.toFixed(1)}h < ${MIN_SESSION_HOURS}h), start=${effectiveStartTime.toISOString()}, end=${endTime.toISOString()}`);
    return null;
  }

  log.debug(`${logPrefix}: Fallback selected window with score=${best.score}, duration=${durationHours.toFixed(1)}h`);

  return {
    forecast: best.forecast,
    start: effectiveStartTime,
    end: endTime,
    score: best.score,
    usedTideBoundaries: false,
  };
}
