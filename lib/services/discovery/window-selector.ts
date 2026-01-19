/**
 * Window Selector Service
 *
 * Selects the best surf window from forecast data using composite scoring.
 * Sunset-aware: caps windows at sunset and skips windows too close to dark.
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
 * @module lib/services/discovery/window-selector
 */

import type { Beach } from '@/types/database';
import type { EnhancedForecastEntity, TideScheduleEntry } from '@/types/forecast';
import type {
  PersonalizedForecastWindow,
  TimeSlot,
} from '@/types/personalization';
import { TIME_SLOT_RANGES } from '@/types/personalization';
import type { getUserSurfPreferences } from '@/lib/services/preference-learning-service';
import { getTimezoneFromCoords } from '@/lib/utils/timezone-utils.server';
import { calculateTideWindow } from '@/lib/utils/tide-interpolation';

// ============================================================================
// Types
// ============================================================================

export interface WindowSelectorOptions {
  forecasts: EnhancedForecastEntity[];
  beach: Beach;
  userPrefs: Awaited<ReturnType<typeof getUserSurfPreferences>> | null;
  horizonHours?: number;
  sunTimesCache?: Map<string, { sunrises: Date[]; sunsets: Date[] }>;
  timeSlot?: TimeSlot;
}

// ============================================================================
// Constants
// ============================================================================

// Time-priority window selection constants
const TIME_DECAY_PER_HOUR = 1.0; // Points deducted per hour in future
const MAX_TIME_DECAY_HOURS = 24; // Cap decay at 24 hours (24 points max)

// Start-soon bonuses for "surf now" prioritization
const SOON_BONUS_2HR = 8; // Bonus for windows starting within 2 hours
const SOON_BONUS_4HR = 4; // Bonus for windows starting within 4 hours
const UNDERWAY_BONUS = 4; // Bonus for windows already in progress

// Sunset-aware window constants
const MIN_SESSION_HOURS = 1.0; // Minimum viable session length
const MIN_SCORE_THRESHOLD = 50; // Score below which conditions are "poor"
const MIN_SCORE_THRESHOLD_MORNING = 35; // Lower threshold for today when it's morning
const MAX_WINDOW_HOURS = 4; // Maximum window even with perfect conditions
const WINDOW_HOURS = 3; // Lookback period for past windows

// Morning priority constants
const MORNING_CUTOFF_HOUR = 12; // Before noon, prefer today's forecasts
const TODAY_BONUS_POINTS = 15; // Bonus for today's forecasts during morning hours
const MORNING_TIME_BONUS = 15; // Extra bonus for morning/afternoon times (before 5pm)
const EVENING_CUTOFF_HOUR = 17; // 5pm - times after this don't get morning time bonus

// ============================================================================
// Helper Functions (internal)
// ============================================================================

/**
 * Parse wave direction string to degrees
 */
function parseWaveDirection(dir: string): number {
  const directions: Record<string, number> = {
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

  const v = directions[dir.toUpperCase()];
  return v ?? 0;
}

/**
 * Prefer degree-based wind direction when present; fall back to parsing cardinal strings.
 */
function getDirectionDegrees(
  windDirectionDeg: number | string | null | undefined,
  windDirectionText: string | null | undefined
): number | null {
  if (windDirectionDeg !== null && windDirectionDeg !== undefined) {
    const asNum =
      typeof windDirectionDeg === 'number' ? windDirectionDeg : Number(windDirectionDeg);
    if (Number.isFinite(asNum)) {
      return ((asNum % 360) + 360) % 360;
    }
  }

  if (!windDirectionText) return null;
  const trimmed = windDirectionText.trim();
  if (!trimmed) return null;

  const asNum = Number(trimmed);
  if (Number.isFinite(asNum)) {
    return ((asNum % 360) + 360) % 360;
  }

  const upper = trimmed.toUpperCase();
  const knownCardinals = new Set([
    'N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'
  ]);
  if (!knownCardinals.has(upper)) return null;
  return parseWaveDirection(upper);
}

/**
 * Get local date string for a timestamp in a given timezone.
 * Returns format: YYYY-MM-DD
 *
 * @param time - The timestamp to convert
 * @param beachTz - IANA timezone string for the beach location
 * @returns Local date string in YYYY-MM-DD format
 */
function getLocalDateStr(time: Date, beachTz: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: beachTz,
    }).format(time);
  } catch {
    return time.toISOString().slice(0, 10); // Fallback to UTC
  }
}

/**
 * Extract tide schedule from forecasts.
 * The tide schedule is stored in raw_forecast of the first forecast of each day.
 */
function extractTideSchedule(forecasts: EnhancedForecastEntity[]): TideScheduleEntry[] | null {
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
 */
function calculateTideDrivenBoundaries(
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

// ============================================================================
// Exported Functions
// ============================================================================

/**
 * Get the hour range for a time slot.
 * Dawn patrol uses dynamic start based on sunrise; others use static ranges.
 *
 * @param timeSlot - The time slot filter
 * @param sunrises - Array of sunrise times (needed for dawn-patrol)
 * @param forecastDate - The forecast date
 * @param beachTz - IANA timezone string
 * @returns Time range with startHour and endHour
 */
export function getTimeSlotRange(
  timeSlot: TimeSlot,
  sunrises: Date[],
  forecastDate: Date,
  beachTz: string
): { startHour: number; endHour: number } {
  if (timeSlot === 'dawn-patrol') {
    return getDawnPatrolRange(sunrises, forecastDate, beachTz);
  }
  return TIME_SLOT_RANGES[timeSlot];
}

/**
 * Get dawn patrol time range based on sunrise.
 * Start is civil twilight (~30 min before sunrise), end is 9am.
 *
 * @param sunrises - Array of sunrise times for the area
 * @param forecastDate - The forecast date to find sunrise for
 * @param beachTz - IANA timezone string for the beach
 * @returns Time range with startHour and endHour in local time
 */
export function getDawnPatrolRange(
  sunrises: Date[],
  forecastDate: Date,
  beachTz: string
): { startHour: number; endHour: number } {
  // Find sunrise for the same local date
  const forecastDateStr = getLocalDateStr(forecastDate, beachTz);
  const sameDaySunrise = sunrises.find(s => getLocalDateStr(s, beachTz) === forecastDateStr);

  if (!sameDaySunrise) {
    // Fallback to conservative 6am if no sunrise data
    return { startHour: 6, endHour: 9 };
  }

  // Civil twilight ~30 minutes before sunrise
  const civilTwilight = new Date(sameDaySunrise.getTime() - 30 * 60 * 1000);

  // Get local hour of civil twilight
  try {
    const twilightHour = parseInt(
      new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        hour12: false,
        timeZone: beachTz,
      }).format(civilTwilight),
      10
    );
    return { startHour: twilightHour, endHour: 9 };
  } catch {
    return { startHour: 6, endHour: 9 };
  }
}

/**
 * Score a single forecast window based on conditions and user preferences.
 *
 * Scoring components:
 * - Wave Height Fit (0-25 points)
 * - Period/Energy Score (0-20 points)
 * - Wind Alignment (0-20 points)
 * - Tide Fit (0-15 points)
 *
 * Maximum score: 80 points (before time bonuses)
 *
 * @param forecast - Forecast entity to score
 * @param beach - Beach metadata for wind/tide preferences
 * @param userPrefs - User surf preferences (optional)
 * @returns Score from 0-80
 */
export function scoreForecastWindow(
  forecast: EnhancedForecastEntity,
  beach: Beach,
  userPrefs: Awaited<ReturnType<typeof getUserSurfPreferences>> | null
): number {
  let score = 0;

  const waveHeight = parseFloat(forecast.wave_height || '0');
  const wavePeriod = parseFloat(forecast.wave_period?.replace('s', '') || '0');
  const windSpeed = parseFloat(forecast.wind_speed || '0');
  const windDir = getDirectionDegrees(forecast.wind_direction_deg, forecast.wind_direction);
  const tideHeight = parseFloat(forecast.tide_height || '0');

  // 1. Wave Height Fit (0-25 points)
  if (userPrefs) {
    const userMin = userPrefs.wave_min_ft || 2;
    const userMax = userPrefs.wave_max_ft || 8;

    if (waveHeight >= userMin && waveHeight <= userMax) {
      score += 25;
    } else if (waveHeight >= userMin * 0.8 && waveHeight <= userMax * 1.2) {
      score += 15;
    } else {
      score += 5;
    }
  } else {
    if (waveHeight >= 2 && waveHeight <= 6) {
      score += 20;
    } else {
      score += 10;
    }
  }

  // 2. Period/Energy Score (0-20 points)
  if (userPrefs) {
    const userMinPeriod = userPrefs.wave_period_min_s || 8;
    const userMaxPeriod = userPrefs.wave_period_max_s || 18;

    if (wavePeriod >= userMinPeriod && wavePeriod <= userMaxPeriod) {
      score += 20;
    } else if (wavePeriod >= 10) {
      score += 15;
    } else {
      score += 5;
    }
  } else {
    if (wavePeriod >= 12) {
      score += 20;
    } else if (wavePeriod >= 9) {
      score += 15;
    } else {
      score += 5;
    }
  }

  // 3. Wind Alignment (0-20 points)
  if (beach.wind_offshore_deg !== null && beach.wind_offshore_tol_deg !== null) {
    const offshoreDir = beach.wind_offshore_deg;
    const tolerance = beach.wind_offshore_tol_deg || 30;

    if (windDir === null) {
      if (windSpeed <= 10) {
        score += 15;
      } else if (windSpeed <= 15) {
        score += 8;
      }
    } else {
      const angleDiff = Math.min(
        Math.abs(windDir - offshoreDir),
        360 - Math.abs(windDir - offshoreDir)
      );

      if (angleDiff <= tolerance && windSpeed <= 15) {
        score += 20;
      } else if (angleDiff <= tolerance * 2) {
        score += 10;
      }
    }
  } else {
    if (windSpeed <= 10) {
      score += 15;
    } else if (windSpeed <= 15) {
      score += 8;
    }
  }

  // 4. Tide Fit (0-15 points)
  if (beach.preferred_tide_ft_min !== null && beach.preferred_tide_ft_max !== null) {
    const idealMin = beach.preferred_tide_ft_min;
    const idealMax = beach.preferred_tide_ft_max;

    if (tideHeight >= idealMin && tideHeight <= idealMax) {
      score += 15;
    } else if (
      tideHeight >= idealMin * 0.8 &&
      tideHeight <= idealMax * 1.2
    ) {
      score += 8;
    } else {
      score += 3;
    }
  } else {
    score += 8;
  }

  return score;
}

/**
 * Cap end time to time slot boundary
 *
 * Ensures window doesn't extend past the selected time slot.
 * For example, dawn-patrol ends at 9am, morning ends at 12pm.
 *
 * @param effectiveStartTime - The window start time
 * @param endTime - The uncapped window end time
 * @param timeSlot - The time slot to cap to (dawn-patrol, morning, afternoon, any)
 * @param beachTz - IANA timezone string for the beach location
 * @returns The capped end time, or original end time if no capping needed
 */
export function capEndTimeToTimeSlot(
  effectiveStartTime: Date,
  endTime: Date,
  timeSlot: TimeSlot | undefined,
  beachTz: string
): Date {
  if (!timeSlot || timeSlot === 'any') {
    return endTime;
  }

  const { endHour } = TIME_SLOT_RANGES[timeSlot];
  try {
    // Get the local hour of the start time in beach timezone
    const startLocalHour = parseInt(
      new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        hour12: false,
        timeZone: beachTz,
      }).format(effectiveStartTime),
      10
    );

    // Calculate hours until time slot ends
    const hoursUntilSlotEnd = endHour - startLocalHour;

    if (hoursUntilSlotEnd > 0) {
      const timeSlotEnd = new Date(
        effectiveStartTime.getTime() + hoursUntilSlotEnd * 60 * 60 * 1000
      );

      if (timeSlotEnd < endTime) {
        return timeSlotEnd;
      }
    }
  } catch {
    // If timezone conversion fails, don't cap
  }

  return endTime;
}

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
  let actualUserPrefs: Awaited<ReturnType<typeof getUserSurfPreferences>> | null;
  let actualHorizonHours: number | undefined;
  let actualSunTimesCache: Map<string, { sunrises: Date[]; sunsets: Date[] }> | undefined;
  let actualTimeSlot: TimeSlot | undefined;

  if (Array.isArray(optionsOrForecasts)) {
    // Legacy positional parameters
    forecasts = optionsOrForecasts;
    actualBeach = beach!;
    actualUserPrefs = userPrefs ?? null;
    actualHorizonHours = horizonHours;
    actualSunTimesCache = sunTimesCache;
    actualTimeSlot = timeSlot;
  } else {
    // Options object
    forecasts = optionsOrForecasts.forecasts;
    actualBeach = optionsOrForecasts.beach;
    actualUserPrefs = optionsOrForecasts.userPrefs;
    actualHorizonHours = optionsOrForecasts.horizonHours;
    actualSunTimesCache = optionsOrForecasts.sunTimesCache;
    actualTimeSlot = optionsOrForecasts.timeSlot;
  }

  if (forecasts.length === 0) return null;

  const now = new Date();
  const beachTz = getTimezoneFromCoords(actualBeach.lat || 0, actualBeach.lon || 0);

  // Helper: get local date string for a timestamp in beach timezone (uses module-level function)
  const getLocalDateStrForBeach = (time: Date): string => getLocalDateStr(time, beachTz);

  // Helper: cap end time to time slot boundary (e.g., dawn-patrol ends at 9am)
  const capEndTimeToSlot = (
    effectiveStartTime: Date,
    endTime: Date,
    slot: TimeSlot | undefined,
    tz: string
  ): Date => capEndTimeToTimeSlot(effectiveStartTime, endTime, slot, tz);

  // Check if it's "morning" (before noon) in beach timezone - prefer today's forecasts
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

    // Get today's date string in beach timezone for comparison
    todayDateStr = new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: beachTz,
    }).format(now);
  } catch {
    // If timezone conversion fails, default to not morning priority
  }

  // Score all forecasts upfront and filter past times
  const scoredForecasts = forecasts
    .map((forecast) => {
      const forecastTime = new Date(`${forecast.forecast_date}T${forecast.forecast_time}Z`);
      const score = scoreForecastWindow(forecast, actualBeach, actualUserPrefs);

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
      // Allow windows that started within lookback period (3 hours)
      const lookbackMs = WINDOW_HOURS * 60 * 60 * 1000;
      const minEligible = new Date(now.getTime() - lookbackMs);
      return forecastTime >= minEligible;
    })
    .sort((a, b) => a.forecastTime.getTime() - b.forecastTime.getTime());

  if (scoredForecasts.length === 0) return null;

  // No early time slot filtering - we filter AFTER calculating tide boundaries
  const filteredForecasts = scoredForecasts;

  if (filteredForecasts.length === 0) return null;

  let bestWindow: {
    forecast: EnhancedForecastEntity;
    start: Date;
    end: Date;
    score: number;
  } | null = null;
  let bestAdjustedScore = -1;

  // Get sun times for this beach (sunsets for window capping)
  const sunTimes = actualSunTimesCache?.get(actualBeach.id);
  const sunsets = sunTimes?.sunsets || [];

  for (let i = 0; i < filteredForecasts.length; i++) {
    const { forecast, forecastTime: startTime, score: startScore, isToday } = filteredForecasts[i];

    // Morning priority: use lower threshold for today's forecasts before noon
    const effectiveThreshold = (isMorning && isToday)
      ? MIN_SCORE_THRESHOLD_MORNING
      : MIN_SCORE_THRESHOLD;

    // Skip low-scoring start times
    if (startScore < effectiveThreshold) {
      continue;
    }

    // 1. Night Filter (using Local Hour)
    // Avoid recommending sessions starting in pitch dark
    // When sunset data is missing, use conservative 6pm cutoff (winter sunset ~5pm)
    // When sunset data is available, allow up to 9pm (sunset check will handle it)
    try {
      const localHour = parseInt(
        new Intl.DateTimeFormat("en-US", {
          hour: "numeric",
          hour12: false,
          timeZone: beachTz,
        }).format(startTime),
        10
      );

      // Conservative cutoff when no sunset data (6pm covers winter sunset ~5pm + buffer)
      // More permissive when sunset data exists (sunset check will handle it)
      const nightCutoff = sunsets.length > 0 ? 21 : 18; // 9pm vs 6pm

      // Skip if past cutoff or before 6am (covers winter sunrise ~6:45am)
      if (localHour >= nightCutoff || localHour < 6) {
        continue;
      }
    } catch {
      // If tz conversion fails, assume safe to proceed (fallback to sunset check)
    }

    // 1.5. Post-Sunset Rejection
    // Find the sunset for the SAME DAY as this forecast and reject if start is after it
    // This prevents overnight windows like "7pm-5am" in winter when sunset is at 5pm
    const forecastDateStr = getLocalDateStrForBeach(startTime);
    const sameDaySunset = sunsets.find(s => getLocalDateStrForBeach(s) === forecastDateStr);

    if (sameDaySunset && startTime.getTime() > sameDaySunset.getTime()) {
      continue;
    }

    // 1.6. Defensive fallback when sunset data is stale
    // If we have sunset data for OTHER dates but not THIS date, the data is likely stale.
    // Fall back to conservative 6pm cutoff to prevent post-sunset recommendations.
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
        // Use conservative 6pm cutoff when sunset data is stale
        if (localHour >= 18) {
          continue;
        }
      } catch {
        // If tz conversion fails, skip to be safe
        continue;
      }
    }

    // 2. Next Sunset Lookup
    // Find the sunset for the SAME DAY as the forecast (not just next chronological sunset)
    // This ensures we cap the window at today's sunset, not tomorrow's
    const sunset = sameDaySunset;

    // If we have a sunset, enforce strict daylight constraints
    if (sunset) {
      const hoursUntilSunset = (sunset.getTime() - startTime.getTime()) / (1000 * 60 * 60);

      if (hoursUntilSunset < MIN_SESSION_HOURS) {
        continue;
      }
    } else if (sunsets.length === 0) {
      // No sunset data at all in cache.
      // Rely on Night Filter (passed above) to allow session.
      // We assume broad daylight if no sunset is found (e.g. high latitude summer)
    }
    // Note: If sunsets.length > 0 but sameDaySunset is null, the defensive fallback above handles it

    // Check horizon constraint
    // Clamp to zero so past-start windows don't get bonus from negative decay
    const rawHoursAhead = (startTime.getTime() - now.getTime()) / (1000 * 60 * 60);
    const hoursAhead = Math.max(0, rawHoursAhead);
    if (actualHorizonHours && hoursAhead > actualHorizonHours) continue;

    // Night filter (6am-9pm local hour check) handles pre-sunrise times
    let effectiveStartTime = startTime;

    // Try to use tide-driven boundaries
    const tideBoundaries = calculateTideDrivenBoundaries(forecasts, actualBeach, startTime);

    // Validate tide-driven boundaries before using them
    let useTideBoundaries = !!tideBoundaries;
    let skipThisForecast = false;

    if (tideBoundaries) {
      // 1. Check if tide window start is within the time slot (if specified)
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
          // Get dynamic range (dawn-patrol uses sunrise-based start)
          const sunrises = sunTimes?.sunrises || [];
          const slotRange = getTimeSlotRange(actualTimeSlot, sunrises, startTime, beachTz);

          if (tideStartHour < slotRange.startHour || tideStartHour >= slotRange.endHour) {
            // Tide window doesn't start within slot
            // Check if the FORECAST start time is within the slot
            const forecastStartHour = parseInt(
              new Intl.DateTimeFormat("en-US", {
                hour: "numeric",
                hour12: false,
                timeZone: beachTz,
              }).format(startTime),
              10
            );

            if (forecastStartHour >= slotRange.startHour && forecastStartHour < slotRange.endHour) {
              // Forecast is within slot but tide window isn't - fall back to hourly
              useTideBoundaries = false;
            } else {
              // Forecast is outside slot - skip this forecast entirely
              skipThisForecast = true;
            }
          }
        } catch {
          useTideBoundaries = false;
        }
      }

      // 2. Check if window spans overnight (different local dates)
      if (useTideBoundaries && !skipThisForecast) {
        const tideStartDate = getLocalDateStrForBeach(tideBoundaries.start);
        const tideEndDate = getLocalDateStrForBeach(tideBoundaries.end);
        if (tideStartDate !== tideEndDate) {
          useTideBoundaries = false;
        }
      }
    }

    // Skip this forecast if tide window doesn't qualify for time slot
    if (skipThisForecast) {
      continue;
    }

    let endTime: Date;

    if (tideBoundaries && useTideBoundaries) {
      // Use tide-driven boundaries for window start and end
      effectiveStartTime = tideBoundaries.start;
      endTime = tideBoundaries.end;
    } else {
      // Fallback: default end time MAX_WINDOW_HOURS from start
      endTime = new Date(effectiveStartTime.getTime() + MAX_WINDOW_HOURS * 60 * 60 * 1000);

      // Look ahead to find when conditions degrade
      for (let j = i; j < filteredForecasts.length - 1; j++) {
        const current = filteredForecasts[j];
        const next = filteredForecasts[j + 1];

        // Stop if next forecast is on a different date (use local dates instead of UTC date strings)
        const currentLocalDate = getLocalDateStrForBeach(current.forecastTime);
        const nextLocalDate = getLocalDateStrForBeach(next.forecastTime);
        if (currentLocalDate !== nextLocalDate) break;

        // Use same threshold that qualified the window (morning threshold if applicable)
        if (current.score >= effectiveThreshold && next.score < effectiveThreshold) {
          // Linear interpolation to find precise degradation time
          const dropAmount = current.score - next.score;
          if (dropAmount <= 0) break; // Guard against edge case
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
    }

    // Cap at sunset (exact clipping) - applies to both tide-driven and fallback
    if (sunset && sunset < endTime) {
      endTime = sunset;
    } else if (!sunset && sunsets.length > 0) {
      // Defensive fallback: sunset data is stale (exists for other dates but not this one)
      // Cap at conservative 6pm (18:00) in beach's local timezone
      // This mirrors the defensive start-time fallback at lines 619-640
      try {
        // Get the local date components for the forecast start
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
          // Create 6pm in the beach's timezone by parsing as local time
          const conservative6pmStr = `${year}-${month}-${day}T18:00:00`;
          // Get the UTC offset for this timezone at this date
          const tempDate = new Date(effectiveStartTime);
          const utcTime = tempDate.toLocaleString("en-US", { timeZone: "UTC" });
          const localTime = tempDate.toLocaleString("en-US", { timeZone: beachTz });
          const utcDate = new Date(utcTime);
          const localDate = new Date(localTime);
          const offsetMs = localDate.getTime() - utcDate.getTime();

          // Parse 6pm as if it were UTC, then adjust for timezone
          const conservative6pm = new Date(new Date(conservative6pmStr + "Z").getTime() - offsetMs);

          if (conservative6pm < endTime) {
            endTime = conservative6pm;
          }
        }
      } catch {
        // If timezone conversion fails, cap at 4 hours from start as safety fallback
        const maxEnd = new Date(effectiveStartTime.getTime() + MAX_WINDOW_HOURS * 60 * 60 * 1000);
        if (maxEnd < endTime) {
          endTime = maxEnd;
        }
      }
    }

    // Cap at time slot end - only for fallback (hourly) windows, not tide-driven
    if (!tideBoundaries || !useTideBoundaries) {
      endTime = capEndTimeToSlot(effectiveStartTime, endTime, actualTimeSlot, beachTz);
    }

    // Validate minimum session length (using effective start time)
    const durationHours = (endTime.getTime() - effectiveStartTime.getTime()) / (1000 * 60 * 60);
    if (durationHours < MIN_SESSION_HOURS) continue;

    // Apply time decay for ranking
    const cappedHours = Math.min(hoursAhead, MAX_TIME_DECAY_HOURS);
    const timeDecay = cappedHours * TIME_DECAY_PER_HOUR;

    // Start-soon bonus (smooth step based on proximity)
    let soonBonus = 0;
    if (hoursAhead <= 2) soonBonus = SOON_BONUS_2HR;
    else if (hoursAhead <= 4) soonBonus = SOON_BONUS_4HR;

    // Underway bonus for windows already in progress
    const isUnderway = rawHoursAhead < 0;
    const underwayBonus = isUnderway ? UNDERWAY_BONUS : 0;

    // Morning priority: add bonus to today's forecasts before noon
    const todayBonus = (isMorning && isToday) ? TODAY_BONUS_POINTS : 0;

    // Get local hour of forecast start time to determine morning time bonus
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
        // Give bonus to times before 5pm (prioritize morning/afternoon over evening)
        if (forecastLocalHour < EVENING_CUTOFF_HOUR) {
          morningTimeBonus = MORNING_TIME_BONUS;
        }
      } catch {
        // If timezone conversion fails, no bonus
      }
    }

    const adjustedScore = startScore - timeDecay + todayBonus + morningTimeBonus + soonBonus + underwayBonus;

    if (adjustedScore > bestAdjustedScore) {
      bestAdjustedScore = adjustedScore;
      bestWindow = { forecast, start: effectiveStartTime, end: endTime, score: startScore };
    }
  }

  // Fallback: if no forecasts passed threshold, use the best available anyway
  if (!bestWindow && filteredForecasts.length > 0) {
    // Filter out night hours and post-sunset times before selecting fallback
    // Also filter by time slot if specified (strict enforcement)
    const daylightForecasts = filteredForecasts.filter(({ forecastTime }) => {
      // Time slot filter - strict enforcement
      // When a time slot is specified, only return forecasts within that slot
      if (actualTimeSlot && actualTimeSlot !== 'any') {
        try {
          const localHour = parseInt(
            new Intl.DateTimeFormat("en-US", {
              hour: "numeric",
              hour12: false,
              timeZone: beachTz,
            }).format(forecastTime),
            10
          );
          const sunrises = sunTimes?.sunrises || [];
          const slotRange = getTimeSlotRange(actualTimeSlot, sunrises, forecastTime, beachTz);
          if (localHour < slotRange.startHour || localHour >= slotRange.endHour) {
            return false;
          }
        } catch {
          return false;
        }
      }
      // Post-sunset rejection - check against SAME DAY's sunset (not just today's)
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

        // Determine cutoff based on sunset data availability for THIS date
        // If sunset exists for this date, use 9pm cutoff (sunset cap handles it)
        // If no sunset for this date (stale data), use conservative 6pm cutoff
        // If no sunset data at all, use conservative 6pm cutoff
        const hasValidSunsetForDate = !!sameDaySunset;
        const nightCutoff = hasValidSunsetForDate ? 21 : 18;

        return localHour >= 6 && localHour < nightCutoff;
      } catch {
        return false; // If tz conversion fails, exclude to be safe
      }
    });

    if (daylightForecasts.length === 0) {
      return null; // No daylight forecasts available
    }

    // Morning priority: prefer today's forecasts before noon, with extra bonus for morning times
    // Also apply soon/underway bonuses for consistency with main logic
    const getAdjustedScore = (f: typeof daylightForecasts[0]) => {
      const rawHoursAhead = (f.forecastTime.getTime() - now.getTime()) / (1000 * 60 * 60);
      const hoursAhead = Math.max(0, rawHoursAhead);

      // Soon bonus
      let soonBonus = 0;
      if (hoursAhead <= 2) soonBonus = SOON_BONUS_2HR;
      else if (hoursAhead <= 4) soonBonus = SOON_BONUS_4HR;

      // Underway bonus
      const underwayBonus = rawHoursAhead < 0 ? UNDERWAY_BONUS : 0;

      // Today bonus (existing logic)
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
          // If timezone conversion fails, no extra bonus
        }
      }

      return f.score + bonus + soonBonus + underwayBonus;
    };

    const best = daylightForecasts.reduce((prev, curr) => {
      return getAdjustedScore(curr) > getAdjustedScore(prev) ? curr : prev;
    });

    // Check horizon constraint for fallback
    const hoursAhead = (best.forecastTime.getTime() - now.getTime()) / (1000 * 60 * 60);
    if (!actualHorizonHours || hoursAhead <= actualHorizonHours) {
      // Night filter already applied above - no civil twilight clamping needed
      const effectiveStartTime = best.forecastTime;

      // Logic for fallback end time (same-day sunset or default)
      const fallbackDateStr = getLocalDateStrForBeach(effectiveStartTime);
      const fallbackSunset = sunsets.find(s => getLocalDateStrForBeach(s) === fallbackDateStr);

      let endTime = new Date(effectiveStartTime.getTime() + MAX_WINDOW_HOURS * 60 * 60 * 1000);
      if (fallbackSunset && fallbackSunset < endTime) {
        endTime = fallbackSunset;
      } else if (!fallbackSunset && sunsets.length > 0) {
        // Defensive fallback: sunset data is stale (exists for other dates but not this one)
        // Cap at conservative 6pm (18:00) in beach's local timezone
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
          // If timezone conversion fails, keep the MAX_WINDOW_HOURS cap
        }
      }

      // Cap at time slot end for fallback window too
      endTime = capEndTimeToSlot(effectiveStartTime, endTime, actualTimeSlot, beachTz);

      const durationHours = (endTime.getTime() - effectiveStartTime.getTime()) / (1000 * 60 * 60);

      if (durationHours >= MIN_SESSION_HOURS) {
        bestWindow = {
          forecast: best.forecast,
          start: effectiveStartTime,
          end: endTime,
          score: best.score,
        };
      }
    }
  }

  if (!bestWindow) {
    return null;
  }

  // Build the PersonalizedForecastWindow
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
  };
}
