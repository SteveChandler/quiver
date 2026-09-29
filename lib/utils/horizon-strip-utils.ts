/**
 * Utility functions for the 12-Day Horizon Strip component
 *
 * Aggregates forecast data by day and determines condition tiers
 * for the visual day selector strip.
 */

import { format, parseISO } from 'date-fns';
import type { EnhancedForecastEntity } from '@/types/forecast';
import type { Beach } from '@/types/database';
import {
  type UserScoringPreferences,
} from '@/lib/scoring/types';
import {
  pickBestNativeForecastSlot,
  type NativeScoredForecast,
} from '@/lib/scoring/native-condition-score';
import type { SkillLevel } from '@/lib/domains/user-preferences/skill-level';
import {
  DEFAULT_TIMEZONE,
  getLocalDateString,
} from '@/lib/utils/timezone-utils';
import { extractForecastDate } from '@/lib/utils/forecast-at-adapter';
import {
  type ConditionTier,
  getConditionTier,
} from '@/lib/utils/condition-tier-utils';
import { resolveTodayHeadline } from '@/lib/services/forecast/today-headline';

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
  /** Whether scores are personalized based on user preferences */
  isPersonalized?: boolean;
  /** Canonical label for today/default headline surfaces */
  headlineLabel?: string;
  /** Forecast row timestamp behind the canonical headline */
  headlineForecastAt?: string;
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
  epic: {
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
  rideable: {
    bg: 'bg-[#2D357D]',
    border: 'border-[#354090]',
    text: 'text-slate-300',
    badge: 'bg-slate-400/20',
  },
  meh: {
    bg: 'bg-slate-600',
    border: 'border-slate-700',
    text: 'text-slate-300',
    badge: 'bg-slate-400/20',
  },
};

/** Hex color values for each tier (for use in Recharts/SVG contexts) */
export const TIER_COLOR_HEX: Record<ConditionTier, string> = {
  epic: "#f59e0b",
  good: "#10b981",
  fair: "#60a5fa",
  rideable: "#7F96AD",
  meh: "#64748B",
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
 * Group forecasts by date
 */
function groupForecastsByDate(
  forecasts: EnhancedForecastEntity[],
  timezone: string
): Map<string, EnhancedForecastEntity[]> {
  const grouped = new Map<string, EnhancedForecastEntity[]>();

  for (const forecast of forecasts) {
    const date = forecast.forecast_at
      ? extractForecastDate(forecast.forecast_at, timezone)
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
 * Find the best forecast for a day based on condition score.
 *
 * NOTE: `userPreferences.preferredWaveSize` is no longer honored at this
 * call site — the legacy `scoreWaveHeightFitPersonalized` branch was never
 * exercised by the only callers (`beach-detail.tsx` and the forecast tab),
 * which both pass empty options. The signature is preserved for callers
 * that still pass it; the value is recorded on the DaySummary
 * (`isPersonalized` flag) but does not influence scoring. See PR 5 of
 * the scoring consolidation plan.
 */
function findBestForecast(
  dayForecasts: EnhancedForecastEntity[],
  skillLevel?: SkillLevel | string | null,
  beachTz?: string,
  _userPreferences?: UserScoringPreferences
): NativeScoredForecast | null {
  if (dayForecasts.length === 0) return null;

  return pickBestNativeForecastSlot(dayForecasts, skillLevel, { beachTz });
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
    // dateStr is already a beach-local calendar date, not an instant.
    const parsed = parseISO(dateStr);
    const isTodayFlag = dateStr === getLocalDateString(new Date(), timezone);

    return {
      date: format(parsed, 'MMM d'),
      dayName: isTodayFlag ? 'Today' : format(parsed, 'EEE'),
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
    userPreferences?: UserScoringPreferences;
    skillLevel?: SkillLevel | string | null;
    sunTimesCache?: Map<string, { sunrises: Date[]; sunsets: Date[] }>;
  } = {}
): DaySummary[] {
  const { maxDays = 12, timezone = beach.timezone || DEFAULT_TIMEZONE } = options;
  const userPreferences = options.userPreferences;

  if (!forecasts || forecasts.length === 0) {
    return [];
  }

  // Group forecasts by date
  const forecastsByDate = groupForecastsByDate(forecasts, timezone);

  // Sort dates chronologically
  const sortedDates = Array.from(forecastsByDate.keys()).sort();

  // Filter to only include today and future dates
  const todayStr = getLocalDateString(new Date(), timezone);
  const futureDates = sortedDates.filter((date) => date >= todayStr);

  // Take only maxDays
  const datesToProcess = futureDates.slice(0, maxDays);

  // Build summaries
  const summaries: DaySummary[] = [];

  for (const dateStr of datesToProcess) {
    const dayForecasts = forecastsByDate.get(dateStr) || [];

    // Find best forecast for scoring
    const bestResult = findBestForecast(dayForecasts, options.skillLevel, timezone, userPreferences);

    if (!bestResult) continue;

    const { forecast: bestForecast, score } = bestResult;

    // Format date
    const { date, dayName, isTodayFlag } = formatDateForDisplay(dateStr, timezone);
    const todayHeadline = isTodayFlag
      ? resolveTodayHeadline({
          forecasts: dayForecasts,
          beach,
          userPrefs: null,
          horizonHours: 24,
          sunTimesCache: options.sunTimesCache,
          userSkillLevel: options.skillLevel,
        })
      : null;

    // Get wave height range. Today uses the canonical surf-call headline;
    // days 2-12 intentionally remain outlook ranges.
    const outlookRange = getWaveHeightRange(dayForecasts, bestForecast);
    const minHeight = todayHeadline?.display.minFt ?? outlookRange.min;
    const maxHeight = todayHeadline?.display.maxFt ?? outlookRange.max;
    const headlineForecast =
      todayHeadline?.window.sourceForecast ?? null;

    // Parse period from best forecast
    const periodStr =
      headlineForecast?.wave_period?.replace('s', '') ??
      bestForecast.wave_period?.replace('s', '') ??
      '';
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
      bestTime: headlineForecast?.forecast_time || bestForecast.forecast_time || null,
      period,
      isPersonalized: !!userPreferences?.preferredWaveSize,
      headlineLabel: todayHeadline?.display.label,
      headlineForecastAt: todayHeadline?.display.forecastAt,
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
export { formatWaveRange } from '@/lib/utils/wave-formatters';

/**
 * Get tier label for accessibility
 */
export function getTierLabel(tier: ConditionTier): string {
  switch (tier) {
    case 'epic':
      return 'EPIC conditions';
    case 'good':
      return 'GOOD conditions';
    case 'fair':
      return 'FAIR conditions';
    case 'rideable':
      return 'RIDEABLE conditions';
    case 'meh':
      return 'MEH conditions';
  }
}
