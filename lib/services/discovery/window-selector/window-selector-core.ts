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
import type { BoardClass, RideabilityBand } from '@/lib/domains/rideability';
import type { SkillLevel } from '@/lib/domains/user-preferences/skill-level';
import { resolveBeachTimezone } from '@/lib/utils/timezone-utils';
import { createContextLogger } from '@/lib/logger';
import { resolveForecastTime, localDateTimeToUTC } from '@/lib/utils/forecast-time-resolver';

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
import {
  getLocalDateStr,
  getLocalDateFormatter,
  getLocalHourFormatter,
  getLocalTimeLabelFormatter,
  getTimeSlotRange,
  capEndTimeToTimeSlot,
  getLocalHour,
} from './time-slot-utils';
import { calculateTideDrivenBoundaries } from './tide-boundary-calculator';
import { findPeakWithinWindow } from './peak-finder';
import { applySubHourRefinement } from './window-refiner';
import { scoreWindowConditionScore, scoreWindowForSelection } from './window-scorer';

// ============================================================================
// Helper Functions
// ============================================================================
// resolveForecastTime and localDateTimeToUTC imported from lib/utils/forecast-time-resolver.ts

/**
 * Score all forecasts and filter out past times.
 */
function prepareForecasts(
  forecasts: EnhancedForecastEntity[],
  beach: Beach,
  beachTz: string,
  now: Date,
  todayDateStr: string,
  rideabilityBand: RideabilityBand | null,
  boardClasses: readonly BoardClass[],
  userSkillLevel?: SkillLevel | string | null
): ScoredForecast[] {
  return forecasts
    .map((forecast) => {
      // Interpret forecast_date + forecast_time as LOCAL time in the beach timezone.
      // This avoids UTC boundary bugs where forecast_time stores local hours.
      const forecastTime = resolveForecastTime(forecast, beachTz);
      const selectionScore = scoreWindowForSelection(
        forecast,
        beach,
        rideabilityBand,
        userSkillLevel,
        boardClasses,
      );
      const score = rideabilityBand || boardClasses.length > 0
        ? scoreWindowConditionScore(
            forecast,
            beach,
            userSkillLevel,
            rideabilityBand,
            boardClasses,
          )
        : selectionScore;

      // Check if forecast is for today (in beach timezone)
      let isToday = false;
      let localHourStr = '';
      try {
        const forecastDateStr = getLocalDateFormatter(beachTz).format(forecastTime);
        isToday = forecastDateStr === todayDateStr;
        localHourStr = getLocalTimeLabelFormatter(beachTz).format(forecastTime);
      } catch {
        // Default to not today if timezone conversion fails
      }

      return {
        forecast,
        forecastTime,
        score,
        selectionScore,
        isToday,
        localHourStr,
      };
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
        getLocalHourFormatter(beachTz).format(forecastTime),
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
      getLocalHourFormatter(beachTz).format(startTime),
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
        getLocalHourFormatter(beachTz).format(startTime),
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
        getLocalHourFormatter(beachTz).format(startTime),
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

    const currentSelectionScore = getSelectionScore(current);
    const nextSelectionScore = getSelectionScore(next);

    if (currentSelectionScore >= effectiveThreshold && nextSelectionScore < effectiveThreshold) {
      // Linear interpolation to find precise degradation time
      const dropAmount = currentSelectionScore - nextSelectionScore;
      if (dropAmount <= 0) break;
      const thresholdDiff = currentSelectionScore - effectiveThreshold;
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
  beach: Beach,
  beachTz: string,
  now: Date
): PersonalizedForecastWindow {
  const peakCandidates = filteredForecasts.map((scoredForecast) => ({
    forecastTime: scoredForecast.forecastTime,
    score:
      getSelectionScore(scoredForecast) +
      getPeakTimeTideAdjustment(scoredForecast.forecast, beach),
  }));

  // Pass `now` through so findPeakWithinWindow can clamp past peaks to the
  // current time — a still-open window must never report a best time that
  // has already elapsed. See peak-finder.ts for the full rationale.
  const peakTime = findPeakWithinWindow(
    bestWindow.start,
    bestWindow.end,
    peakCandidates,
    now
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
    sourceForecast: bestWindow.forecast,
  };
}

interface NormalizedWindowSelectorOptions {
  forecasts: EnhancedForecastEntity[];
  beach: Beach;
  userPrefs: Awaited<ReturnType<typeof getUserSurfPreferences>> | null;
  horizonHours: number | undefined;
  sunTimesCache: Map<string, { sunrises: Date[]; sunsets: Date[] }> | undefined;
  timeSlot: TimeSlot | undefined;
  now: Date;
  maxWindows: number;
  rideabilityBand: RideabilityBand | null;
  boardClasses: readonly BoardClass[];
  userSkillLevel: SkillLevel | string | null;
}

interface RankedCandidateWindow extends CandidateWindow {
  adjustedScore: number;
}

const DEFAULT_MAX_WINDOWS = 3;

function getSelectionScore(
  scored: Pick<ScoredForecast | CandidateWindow, 'score' | 'selectionScore'>
): number {
  return scored.selectionScore ?? scored.score;
}

function normalizeWindowSelectorOptions(
  optionsOrForecasts: WindowSelectorOptions | EnhancedForecastEntity[],
  beach?: Beach,
  userPrefs?: Awaited<ReturnType<typeof getUserSurfPreferences>> | null,
  horizonHours?: number,
  sunTimesCache?: Map<string, { sunrises: Date[]; sunsets: Date[] }>,
  timeSlot?: TimeSlot,
  now?: Date,
  maxWindows?: number
): NormalizedWindowSelectorOptions {
  if (Array.isArray(optionsOrForecasts)) {
    return {
      forecasts: optionsOrForecasts,
      beach: beach!,
      userPrefs: userPrefs ?? null,
      horizonHours,
      sunTimesCache,
      timeSlot,
      now: now ?? new Date(),
      maxWindows: maxWindows ?? DEFAULT_MAX_WINDOWS,
      rideabilityBand: null,
      boardClasses: [],
      userSkillLevel: null,
    };
  }

  return {
    forecasts: optionsOrForecasts.forecasts,
    beach: optionsOrForecasts.beach,
    userPrefs: optionsOrForecasts.userPrefs,
    horizonHours: optionsOrForecasts.horizonHours,
    sunTimesCache: optionsOrForecasts.sunTimesCache,
    timeSlot: optionsOrForecasts.timeSlot,
    now: optionsOrForecasts.now ?? new Date(),
    maxWindows: optionsOrForecasts.maxWindows ?? DEFAULT_MAX_WINDOWS,
    rideabilityBand: optionsOrForecasts.rideabilityBand ?? null,
    boardClasses: optionsOrForecasts.boardClasses ?? [],
    userSkillLevel: optionsOrForecasts.userSkillLevel ?? null,
  };
}

function compareRankedWindows(
  a: RankedCandidateWindow,
  b: RankedCandidateWindow
): number {
  const adjustedScoreDelta = b.adjustedScore - a.adjustedScore;
  if (adjustedScoreDelta !== 0) return adjustedScoreDelta;

  const scoreDelta = b.score - a.score;
  if (scoreDelta !== 0) return scoreDelta;

  const startDelta = a.start.getTime() - b.start.getTime();
  if (startDelta !== 0) return startDelta;

  return a.forecast.id.localeCompare(b.forecast.id);
}

function windowsOverlap(
  a: PersonalizedForecastWindow,
  b: PersonalizedForecastWindow
): boolean {
  return a.start.getTime() < b.end.getTime() && b.start.getTime() < a.end.getTime();
}

function getPeakTimeTideAdjustment(
  forecast: EnhancedForecastEntity,
  beach: Beach
): number {
  const status = (forecast.tide_status ?? '').toLowerCase();
  const tideHeight = parseFloat(forecast.tide_height ?? '0');
  const preferredDirection = parsePreferredTideDirection(
    beach.preferred_tide_direction
  );

  let adjustment = 0;

  const isRising = status.includes('rising') || status.includes('incoming');
  const isFalling = status.includes('falling') || status.includes('outgoing');
  const isSlackHigh = status.includes('high');
  const isSlackLow = status.includes('low');

  // Peak-time selection should avoid labeling the exact tide turn as "best"
  // when the broader window is still surfable. Keep the penalty modest so we
  // bias the label, not the entire window choice.
  if (isSlackHigh) adjustment -= 14;
  else if (isSlackLow) adjustment -= 7;

  if (preferredDirection === 'rising') {
    if (isRising) adjustment += 7;
    else if (isFalling || isSlackHigh || isSlackLow) adjustment -= 8;
  } else if (preferredDirection === 'falling') {
    if (isFalling) adjustment += 5;
    else if (isRising || isSlackHigh || isSlackLow) adjustment -= 6;
  } else if (preferredDirection === 'slack') {
    if (isSlackHigh || isSlackLow) adjustment += 4;
    else if (isRising || isFalling) adjustment -= 4;
  }

  if (!Number.isNaN(tideHeight)) {
    const minTide = beach.preferred_tide_ft_min;
    const maxTide = beach.preferred_tide_ft_max;

    if (maxTide != null && tideHeight > maxTide) {
      adjustment -= Math.min(8, Math.round((tideHeight - maxTide) * 4));
    }

    if (minTide != null && tideHeight < minTide) {
      adjustment -= Math.min(4, Math.round((minTide - tideHeight) * 2));
    }
  }

  return adjustment;
}

function parsePreferredTideDirection(
  direction: string | null | undefined
): 'rising' | 'falling' | 'either' | 'slack' {
  const normalized = direction?.toLowerCase().trim();
  if (
    normalized === 'rising' ||
    normalized === 'falling' ||
    normalized === 'either' ||
    normalized === 'slack'
  ) {
    return normalized;
  }

  if (normalized === 'any') {
    return 'either';
  }

  return 'either';
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
  if (Array.isArray(optionsOrForecasts)) {
    return selectBestWindows(
      optionsOrForecasts,
      beach!,
      userPrefs ?? null,
      horizonHours,
      sunTimesCache,
      timeSlot
    )[0] ?? null;
  }

  return selectBestWindows(optionsOrForecasts)[0] ?? null;
}

/**
 * Select ranked, non-overlapping surf windows from forecast data.
 *
 * @param options - Window selection options including forecasts, beach, user prefs
 * @returns Ranked windows or an empty array if none are viable
 */
export function selectBestWindows(
  options: WindowSelectorOptions
): PersonalizedForecastWindow[];

/**
 * Select ranked, non-overlapping surf windows from forecast data.
 * (Legacy-style overload with positional parameters)
 */
export function selectBestWindows(
  forecasts: EnhancedForecastEntity[],
  beach: Beach,
  userPrefs: Awaited<ReturnType<typeof getUserSurfPreferences>> | null,
  horizonHours?: number,
  sunTimesCache?: Map<string, { sunrises: Date[]; sunsets: Date[] }>,
  timeSlot?: TimeSlot,
  now?: Date,
  maxWindows?: number
): PersonalizedForecastWindow[];

export function selectBestWindows(
  optionsOrForecasts: WindowSelectorOptions | EnhancedForecastEntity[],
  beach?: Beach,
  userPrefs?: Awaited<ReturnType<typeof getUserSurfPreferences>> | null,
  horizonHours?: number,
  sunTimesCache?: Map<string, { sunrises: Date[]; sunsets: Date[] }>,
  timeSlot?: TimeSlot,
  now?: Date,
  maxWindows?: number
): PersonalizedForecastWindow[] {
  const {
    forecasts,
    beach: actualBeach,
    horizonHours: actualHorizonHours,
    sunTimesCache: actualSunTimesCache,
    timeSlot: actualTimeSlot,
    now: actualNow,
    maxWindows: actualMaxWindows,
    rideabilityBand: actualRideabilityBand,
    boardClasses: actualBoardClasses,
    userSkillLevel: actualUserSkillLevel,
  } = normalizeWindowSelectorOptions(
    optionsOrForecasts,
    beach,
    userPrefs,
    horizonHours,
    sunTimesCache,
    timeSlot,
    now,
    maxWindows
  );

  const windowLimit = Math.max(0, Math.floor(actualMaxWindows));
  if (windowLimit === 0) {
    return [];
  }

  if (forecasts.length === 0) {
    log.debug(`[selectBestWindows] ${actualBeach.name}: No forecasts provided`);
    return [];
  }

  const beachTz = resolveBeachTimezone(actualBeach.timezone);

  // Helper: get local date string for beach timezone
  const getLocalDateStrForBeach = (time: Date): string => getLocalDateStr(time, beachTz);

  // Check if it's "morning" (before noon) in beach timezone
  let isMorning = false;
  let todayDateStr = '';
  try {
    const localHourNow = parseInt(
      getLocalHourFormatter(beachTz).format(actualNow),
      10
    );
    isMorning = localHourNow < MORNING_CUTOFF_HOUR;
    todayDateStr = getLocalDateFormatter(beachTz).format(actualNow);
  } catch {
    // If timezone conversion fails, default to not morning priority
  }

  // Score and prepare forecasts
  const scoredForecasts = prepareForecasts(
    forecasts,
    actualBeach,
    beachTz,
    actualNow,
    todayDateStr,
    actualRideabilityBand,
    actualBoardClasses,
    actualUserSkillLevel
  );
  if (scoredForecasts.length === 0) {
    log.debug(`[selectBestWindows] ${actualBeach.name}: No scored forecasts after filtering past times`);
    return [];
  }

  // Get sun times
  const sunTimes = actualSunTimesCache?.get(actualBeach.id);
  const sunsets = sunTimes?.sunsets || [];
  const sunrises = sunTimes?.sunrises || [];

  // Filter by time slot
  const filteredForecasts = filterByTimeSlot(scoredForecasts, actualTimeSlot, sunrises, beachTz);
  if (filteredForecasts.length === 0) {
    log.debug(`[selectBestWindows] ${actualBeach.name}: No forecasts after time slot filter (slot=${actualTimeSlot || 'any'})`);
    return [];
  }

  log.debug(`[selectBestWindows] ${actualBeach.name}: ${filteredForecasts.length} forecasts to evaluate, isMorning=${isMorning}`);

  const candidateWindows: RankedCandidateWindow[] = [];

  for (let i = 0; i < filteredForecasts.length; i++) {
    const {
      forecast,
      forecastTime: startTime,
      score: startScore,
      isToday,
    } = filteredForecasts[i];
    const startSelectionScore = getSelectionScore(filteredForecasts[i]);

    // Determine threshold
    const shouldApplyThreshold = !actualTimeSlot || actualTimeSlot === 'any';
    const effectiveThreshold = shouldApplyThreshold
      ? (isMorning && isToday) ? MIN_SCORE_THRESHOLD_MORNING : MIN_SCORE_THRESHOLD
      : 0;

    if (startSelectionScore < effectiveThreshold) {
      log.debug(`[selectBestWindow] ${actualBeach.name}: Forecast ${i} selectionScore=${startSelectionScore} < threshold=${effectiveThreshold}, skipping`);
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
    const rawHoursAhead = (startTime.getTime() - actualNow.getTime()) / (1000 * 60 * 60);
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
            getLocalHourFormatter(beachTz).format(tideBoundaries.start),
            10
          );
          const slotRange = getTimeSlotRange(actualTimeSlot, sunrises, startTime, beachTz);

          if (tideStartHour < slotRange.startHour || tideStartHour >= slotRange.endHour) {
            const forecastStartHour = parseInt(
              getLocalHourFormatter(beachTz).format(startTime),
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

      // Reject tide boundaries that leave the source forecast's calendar day.
      // The original overnight-span check caught start/end straddling midnight,
      // but a window living entirely on the NEXT day (e.g. direction-based
      // fallback in tide-interpolation.ts walks forward to tomorrow's low when
      // today has no qualifying rise) passes that check and produces a
      // start/forecast day mismatch downstream — the UI then renders today's
      // forecast numbers under a "Tomorrow's…" label.
      if (useTideBoundaries && !skipThisForecast) {
        const forecastDateStr = getLocalDateStrForBeach(startTime);
        const tideStartDate = getLocalDateStrForBeach(tideBoundaries.start);
        const tideEndDate = getLocalDateStrForBeach(tideBoundaries.end);
        if (tideStartDate !== forecastDateStr || tideStartDate !== tideEndDate) {
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

      // Re-validate tide-adjusted start time against night filter
      if (shouldSkipDueToLight({ startTime: effectiveStartTime, sunsets, sunrises, beachTz, getLocalDateStrForBeach })) {
        log.debug(`[selectBestWindow] ${actualBeach.name}: Tide-adjusted start ${effectiveStartTime.toISOString()} falls in night hours, skipping`);
        continue;
      }
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
    const adjustedScore = calculateAdjustedScore(
      startSelectionScore,
      startTime,
      actualNow,
      isToday,
      isMorning,
      beachTz
    );

    candidateWindows.push({
      forecast,
      start: effectiveStartTime,
      end: endTime,
      score: startScore,
      selectionScore: startSelectionScore,
      usedTideBoundaries: useTideBoundaries,
      adjustedScore,
    });
  }

  // Log main loop result
  if (candidateWindows.length > 0) {
    log.debug(`[selectBestWindows] ${actualBeach.name}: Main loop found ${candidateWindows.length} candidate windows`);
  } else {
    log.debug(`[selectBestWindows] ${actualBeach.name}: Main loop found no valid window, trying fallback...`);
  }

  // Fallback: if no forecasts passed threshold, use the best available anyway
  if (candidateWindows.length === 0 && filteredForecasts.length > 0) {
    const fallbackWindow = selectFallbackWindow(
      filteredForecasts,
      sunsets,
      sunrises,
      actualTimeSlot,
      actualHorizonHours,
      actualNow,
      beachTz,
      isMorning,
      getLocalDateStrForBeach,
      actualBeach.name // Pass beach name for logging
    );
    if (fallbackWindow) {
      candidateWindows.push({
        ...fallbackWindow,
        adjustedScore: getSelectionScore(fallbackWindow),
      });
    }
  }

  if (candidateWindows.length === 0) {
    log.debug(`[selectBestWindows] ${actualBeach.name}: Both main loop and fallback returned null - NO WINDOW SELECTED`);
    return [];
  }

  const refinedWindows = candidateWindows
    .sort(compareRankedWindows)
    .map((candidateWindow) => {
      const refinedTimes = applySubHourRefinement(
        candidateWindow,
        filteredForecasts.map((scoredForecast) => ({
          ...scoredForecast,
          score: getSelectionScore(scoredForecast),
        })),
        forecasts,
        sunsets,
        sunrises,
        actualBeach,
        beachTz
      );

      return {
        ...candidateWindow,
        start: refinedTimes.start,
        end: refinedTimes.end,
      };
    })
    .filter((candidateWindow) => {
      if (shouldSkipDueToLight({ startTime: candidateWindow.start, sunsets, sunrises, beachTz, getLocalDateStrForBeach })) {
        log.debug(`[selectBestWindows] ${actualBeach.name}: Refined start falls in night hours, skipping`);
        return false;
      }
      return true;
    })
    .map((candidateWindow) =>
      buildResult(candidateWindow, filteredForecasts, actualBeach, beachTz, actualNow)
    );

  const nonOverlappingWindows: PersonalizedForecastWindow[] = [];
  for (const candidateWindow of refinedWindows) {
    if (nonOverlappingWindows.some((selectedWindow) => windowsOverlap(selectedWindow, candidateWindow))) {
      continue;
    }
    nonOverlappingWindows.push(candidateWindow);
    if (nonOverlappingWindows.length >= windowLimit) break;
  }

  return nonOverlappingWindows;
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
          getLocalHourFormatter(beachTz).format(forecastTime),
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
        getLocalHourFormatter(beachTz).format(forecastTime),
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
          getLocalHourFormatter(beachTz).format(f.forecastTime),
          10
        );
        if (localHour < EVENING_CUTOFF_HOUR) {
          bonus += MORNING_TIME_BONUS;
        }
      } catch {
        // No bonus on error
      }
    }

    return getSelectionScore(f) + bonus + soonBonus + underwayBonus;
  };

  // Constrain to the horizon BEFORE picking a winner. Selecting the globally
  // best slot and then rejecting it for being out of horizon throws away
  // perfectly good in-horizon slots, leaving the beach with no window at all.
  const inHorizonForecasts = horizonHours
    ? daylightForecasts.filter(
        (f) =>
          (f.forecastTime.getTime() - now.getTime()) / (1000 * 60 * 60) <=
          horizonHours
      )
    : daylightForecasts;

  if (inHorizonForecasts.length === 0) {
    log.debug(`${logPrefix}: No daylight forecasts within horizon of ${horizonHours}h (${daylightForecasts.length} daylight forecasts beyond it)`);
    return null;
  }

  const best = inHorizonForecasts.reduce((prev, curr) =>
    getAdjustedScore(curr) > getAdjustedScore(prev) ? curr : prev
  );

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

  log.debug(`${logPrefix}: Fallback selected window with score=${best.score}, selectionScore=${getSelectionScore(best)}, duration=${durationHours.toFixed(1)}h`);

  return {
    forecast: best.forecast,
    start: effectiveStartTime,
    end: endTime,
    score: best.score,
    selectionScore: getSelectionScore(best),
    usedTideBoundaries: false,
  };
}
