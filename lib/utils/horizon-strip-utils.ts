/**
 * Utility functions for the 12-Day Horizon Strip component
 *
 * Aggregates forecast data by day and determines condition tiers
 * for the visual day selector strip.
 */

import { format, parseISO, isToday, startOfDay } from 'date-fns';
import { formatInTimeZone, toZonedTime } from 'date-fns-tz';
import type { EnhancedForecastEntity } from '@/types/forecast';
import type { Beach } from '@/types/database';
import {
  scoreConditions,
} from '@/lib/scoring/surf-conditions-scorer';
import {
  toForecastForScoring,
  type BeachWithThresholds,
} from '@/lib/scoring/types';
import { DEFAULT_TIMEZONE } from '@/lib/utils/timezone-utils';
import {
  type ConditionTier,
  CONDITION_TIER_THRESHOLDS,
  getConditionTier,
} from '@/lib/utils/condition-tier-utils';

// Re-export for backwards compatibility
export { type ConditionTier, getConditionTier };

/**
 * Summary of a single day's forecast for the Horizon Strip
 */
export interface DaySummary {
  /** Formatted date display (e.g., "Jan 29") */
  date: string;
  /** Short day name (e.g., "Thu") */
  dayName: string;
  /** Minimum wave height in the best window */
  minHeight: number;
  /** Maximum wave height in the best window */
  maxHeight: number;
  /** Visual tier based on conditions score */
  tier: ConditionTier;
  /** Numeric score 0-100 for sorting/comparison */
  score: number;
  /** Full ISO date string (e.g., "2026-01-29") for selection */
  fullDate: string;
  /** Whether this day is today */
  isToday: boolean;
  /** Best forecast time for this day */
  bestTime: string | null;
  /** Primary swell period for display */
  period: number | null;
}

/**
 * Color configuration for each tier
 */
export const TIER_COLORS: Record<ConditionTier, {
  bg: string;
  border: string;
  text: string;
  badge: string;
}> = {
  great: {
    bg: 'bg-amber-500',
    border: 'border-amber-600',
    text: 'text-white',
    badge: 'bg-amber-400/30',
  },
  good: {
    bg: 'bg-emerald-500',
    border: 'border-emerald-600',
    text: 'text-white',
    badge: 'bg-emerald-400/30',
  },
  fair: {
    bg: 'bg-blue-400',
    border: 'border-blue-500',
    text: 'text-white',
    badge: 'bg-blue-300/30',
  },
  marginal: {
    bg: 'bg-slate-200',
    border: 'border-slate-300',
    text: 'text-slate-600',
    badge: 'bg-slate-100',
  },
};

/** Hex color values for each tier (for use in Recharts/SVG contexts) */
export const TIER_COLOR_HEX: Record<ConditionTier, string> = {
  great: "#f59e0b",
  good: "#10b981",
  fair: "#60a5fa",
  marginal: "#e2e8f0",
};

/**
 * Get a unified className string for a tier card
 */
function getTierCardClassName(tier: ConditionTier, isSelected: boolean): string {
  const colors = TIER_COLORS[tier];
  const baseClasses = `${colors.bg} ${colors.border} ${colors.text}`;
  const selectedClasses = isSelected
    ? 'ring-2 ring-offset-2 ring-blue-500 scale-105 shadow-lg'
    : 'hover:scale-102 hover:shadow-md';
  return `${baseClasses} ${selectedClasses}`;
}

/**
 * Convert knots to mph
 */
function knotsToMph(knots: number | null | undefined): number | null {
  if (knots === null || knots === undefined) return null;
  return knots * 1.15078;
}

/**
 * Convert Beach to BeachWithThresholds for scoring
 */
function toBeachWithThresholds(beach: Beach): BeachWithThresholds {
  // Convert onshore wind threshold from knots to mph
  // Beach type uses wind_onshore_bad_kt (knots), scoring uses mph
  const maxWindOnshoreMph = knotsToMph(beach.wind_onshore_bad_kt);

  return {
    id: beach.id,
    name: beach.name,
    lat: beach.lat,
    lon: beach.lon,
    wind_offshore_deg: beach.wind_offshore_deg,
    wind_offshore_tol_deg: beach.wind_offshore_tol_deg,
    preferred_tide_ft_min: beach.preferred_tide_ft_min,
    preferred_tide_ft_max: beach.preferred_tide_ft_max,
    max_wind_onshore_mph: maxWindOnshoreMph,
    // max_wind_any_mph: not available on Beach type, will use default in scorer
    max_wind_any_mph: null,
  };
}

/**
 * Group forecasts by date
 */
function groupForecastsByDate(
  forecasts: EnhancedForecastEntity[]
): Map<string, EnhancedForecastEntity[]> {
  const grouped = new Map<string, EnhancedForecastEntity[]>();

  for (const forecast of forecasts) {
    // Prefer forecast_at (extract date part), fallback to forecast_date
    const date = forecast.forecast_at
      ? forecast.forecast_at.split('T')[0]
      : forecast.forecast_date;
    if (!date) continue;

    if (!grouped.has(date)) {
      grouped.set(date, []);
    }
    grouped.get(date)!.push(forecast);
  }

  return grouped;
}

/**
 * Find the best forecast for a day based on condition score
 */
function findBestForecast(
  dayForecasts: EnhancedForecastEntity[],
  beach: BeachWithThresholds,
  beachTz?: string
): { forecast: EnhancedForecastEntity; score: number } | null {
  if (dayForecasts.length === 0) return null;

  let bestForecast = dayForecasts[0];
  let bestScore = 0;

  for (const forecast of dayForecasts) {
    const forecastForScoring = toForecastForScoring(forecast, beachTz);
    const result = scoreConditions(forecastForScoring, beach);

    if (result.total > bestScore) {
      bestScore = result.total;
      bestForecast = forecast;
    }
  }

  return { forecast: bestForecast, score: bestScore };
}

/**
 * Calculate wave height range for a day's forecasts
 * Uses forecasts within ±3 hours of the best time
 */
function getWaveHeightRange(
  dayForecasts: EnhancedForecastEntity[],
  bestForecast: EnhancedForecastEntity
): { min: number; max: number } {
  // Parse best forecast time - prefer forecast_at, fallback to forecast_time
  const bestHour = bestForecast.forecast_at
    ? new Date(bestForecast.forecast_at).getUTCHours()
    : parseInt(bestForecast.forecast_time?.split(':')[0] || '12', 10);

  // Filter forecasts within ±3 hours of best time
  const windowForecasts = dayForecasts.filter((f) => {
    // Prefer forecast_at for hour extraction, fallback to forecast_time
    const hour = f.forecast_at
      ? new Date(f.forecast_at).getUTCHours()
      : parseInt(f.forecast_time?.split(':')[0] || '12', 10);
    return Math.abs(hour - bestHour) <= 3;
  });

  // If no forecasts in window, use all
  const forecastsToUse = windowForecasts.length > 0 ? windowForecasts : dayForecasts;

  // Extract wave heights
  const heights = forecastsToUse
    .map((f) => parseFloat(f.wave_height || '0'))
    .filter((h) => h > 0 && Number.isFinite(h));

  if (heights.length === 0) {
    return { min: 0, max: 0 };
  }

  return {
    min: Math.min(...heights),
    max: Math.max(...heights),
  };
}

/**
 * Format date for display in the Horizon Strip
 */
function formatDateForDisplay(
  dateStr: string,
  timezone: string
): { date: string; dayName: string; isTodayFlag: boolean } {
  try {
    const parsed = parseISO(dateStr);
    const zonedDate = toZonedTime(parsed, timezone);

    // Check if it's today in the beach's timezone
    const now = toZonedTime(new Date(), timezone);
    const isTodayFlag = startOfDay(zonedDate).getTime() === startOfDay(now).getTime();

    return {
      date: formatInTimeZone(parsed, timezone, 'MMM d'),
      dayName: isTodayFlag ? 'Today' : formatInTimeZone(parsed, timezone, 'EEE'),
      isTodayFlag,
    };
  } catch {
    // Fallback for invalid dates
    return {
      date: dateStr,
      dayName: '—',
      isTodayFlag: false,
    };
  }
}

/**
 * Aggregate forecasts into day summaries for the Horizon Strip
 *
 * @param forecasts - Array of forecast entities (typically 12 days × 8 per day)
 * @param beach - Beach data including wind/tide preferences
 * @param options - Optional configuration
 * @returns Array of DaySummary objects, one per day
 */
export function aggregateDayForecasts(
  forecasts: EnhancedForecastEntity[],
  beach: Beach,
  options: {
    maxDays?: number;
    timezone?: string;
  } = {}
): DaySummary[] {
  const { maxDays = 12, timezone = beach.timezone || DEFAULT_TIMEZONE } = options;

  if (!forecasts || forecasts.length === 0) {
    return [];
  }

  // Convert beach to scoring format
  const beachWithThresholds = toBeachWithThresholds(beach);

  // Group forecasts by date
  const forecastsByDate = groupForecastsByDate(forecasts);

  // Sort dates chronologically
  const sortedDates = Array.from(forecastsByDate.keys()).sort();

  // Filter to only include today and future dates
  const now = toZonedTime(new Date(), timezone);
  const todayStr = format(startOfDay(now), 'yyyy-MM-dd');
  const futureDates = sortedDates.filter((date) => date >= todayStr);

  // Take only maxDays
  const datesToProcess = futureDates.slice(0, maxDays);

  // Build summaries
  const summaries: DaySummary[] = [];

  for (const dateStr of datesToProcess) {
    const dayForecasts = forecastsByDate.get(dateStr) || [];

    // Find best forecast for scoring
    const bestResult = findBestForecast(dayForecasts, beachWithThresholds, timezone);

    if (!bestResult) continue;

    const { forecast: bestForecast, score } = bestResult;

    // Get wave height range
    const { min: minHeight, max: maxHeight } = getWaveHeightRange(dayForecasts, bestForecast);

    // Format date
    const { date, dayName, isTodayFlag } = formatDateForDisplay(dateStr, timezone);

    // Parse period from best forecast
    const periodStr = bestForecast.wave_period?.replace('s', '') || '';
    const period = parseFloat(periodStr) || null;

    summaries.push({
      date,
      dayName,
      minHeight,
      maxHeight,
      tier: getConditionTier(score),
      score,
      fullDate: dateStr,
      isToday: isTodayFlag,
      bestTime: bestForecast.forecast_time || null,
      period,
    });
  }

  // Trim trailing days where ALL forecasts have null/empty wave_height.
  // This catches truly-null tail data while allowing FALLBACK-sourced days
  // with generated values to render (e.g., gap-filled slots).
  while (summaries.length > 0) {
    const lastDate = summaries[summaries.length - 1].fullDate;
    const lastDayForecasts = forecastsByDate.get(lastDate) || [];
    const allNullWaves = lastDayForecasts.length > 0 &&
      lastDayForecasts.every((f) => {
        const wh = f.wave_height;
        return wh === null || wh === undefined || wh === '';
      });
    if (allNullWaves) {
      summaries.pop();
    } else {
      break;
    }
  }

  return summaries;
}

/**
 * Format wave height range for display
 */
export function formatWaveRange(minHeight: number, maxHeight: number): string {
  if (minHeight <= 0 && maxHeight <= 0) {
    return 'Flat';
  }

  const minInt = Math.max(0, Math.floor(minHeight));
  const maxInt = Math.ceil(maxHeight);

  if (minInt === maxInt) {
    return `${minInt}ft`;
  }

  return `${minInt}-${maxInt}ft`;
}

/**
 * Get tier label for accessibility
 */
export function getTierLabel(tier: ConditionTier): string {
  switch (tier) {
    case 'great':
      return 'Great conditions';
    case 'good':
      return 'Good conditions';
    case 'fair':
      return 'Fair conditions';
    case 'marginal':
      return 'Marginal conditions';
  }
}
