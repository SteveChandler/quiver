"use server";

import { unstable_cache } from 'next/cache';
import type { Beach } from '@/types/database';
import type { EnhancedForecastEntity } from '@/types/forecast';
import { computeSurfCall, type SurfCallResult } from '@/lib/utils/surf-call-logic';
import { getTimezoneFromCoords } from '@/lib/utils/timezone-utils.server';
import { DEFAULT_TIMEZONE } from '@/lib/utils/timezone-constants';
import { formatDateInTimezone } from '@/lib/utils/date-formatting';
import { extractForecastDate } from '@/lib/utils/forecast-at-adapter';
import { createSupabaseServerClient, createSupabaseServiceRoleClient } from '@/lib/supabase/server';
import { getBatchSunTimes } from '@/lib/services/discovery';
import { getUserSurfPreferences, type UserSurfPreferences } from '@/lib/services/preference-learning-service';
import { calculatePreferenceAdjustment, checkSkillCeiling } from '@/lib/domains/scoring/discovery-adapter';
import { parseSkillLevel } from '@/lib/domains/user-preferences';
import type { PersonalizedForecastWindow } from '@/types/personalization';

export interface SpotSurfReportResult {
  report: SurfCallResult;
  isTomorrow: boolean;
}

/**
 * Generate a stable cache key segment from user preferences.
 * This ensures consistent serialization for cache key generation.
 */
function getPrefsKey(prefs: UserSurfPreferences | null): string {
  if (!prefs) return 'default';
  // Include wave range and confidence - the key factors affecting surf verdicts
  return `${prefs.wave_min_ft ?? 0}-${prefs.wave_max_ft ?? 99}-${prefs.max_wind_mph ?? 99}-${Math.round((prefs.confidence ?? 0) * 100)}`;
}

/**
 * Get today's (or tomorrow's) surf report for a beach.
 *
 * Cached for 15 minutes via unstable_cache to avoid redundant DB hits
 * on a force-dynamic page. Returns null on any error so the UI gracefully
 * degrades (no card rendered).
 *
 * Cache is keyed per-user so authenticated users get personalized verdicts
 * based on their learned surf preferences.
 */
export async function getSpotSurfReport(beach: Beach): Promise<SpotSurfReportResult | null> {
  if (!beach.id) return null;

  try {
    // Get current user (if logged in)
    // Note: Auth check happens before cache lookup to enable per-user caching.
    // This adds ~50-80ms latency but enables personalized verdicts.
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    // 'anonymous' key allows sharing cache across unauthenticated users
    const userId = user?.id ?? 'anonymous';

    // Fetch user preferences (null for anonymous users)
    // Gracefully degrade to default scoring if preference fetch fails
    let userPrefs: UserSurfPreferences | null = null;
    if (user) {
      try {
        userPrefs = await getUserSurfPreferences(user.id);
      } catch (prefError) {
        console.warn('[getSpotSurfReport] Preference fetch failed, using defaults:', {
          userId: user.id,
          message: prefError instanceof Error ? prefError.message : 'Unknown error',
        });
        // Continue with null prefs - user still gets a report, just not personalized
      }
    }

    // Fetch explicit wave size preference and skill level from profile
    let preferredWaveSize: 'small' | 'medium' | 'large' | null = null;
    let userSkillLevel: ReturnType<typeof parseSkillLevel> = null;
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('preferred_wave_size, experience_level')
        .eq('id', user.id)
        .single();

      if (profile) {
        const waveSize = (profile as Record<string, unknown>)?.preferred_wave_size;
        const waveSizeStr = typeof waveSize === 'string' ? waveSize.toLowerCase() : '';
        preferredWaveSize = (waveSizeStr === 'small' || waveSizeStr === 'medium' || waveSizeStr === 'large')
          ? waveSizeStr : null;
        userSkillLevel = parseSkillLevel((profile as Record<string, unknown>)?.experience_level as string | null | undefined);
      }
    }

    // Generate stable preference key for cache (avoids object serialization issues)
    const prefsKey = getPrefsKey(userPrefs);

    return await getCachedSurfReport(beach.id, beach, userId, prefsKey, userPrefs, preferredWaveSize, userSkillLevel);
  } catch (error) {
    console.error('[getSpotSurfReport] Error:', {
      beachId: beach.id,
      message: error instanceof Error ? error.message : 'Unknown error',
    });
    return null;
  }
}

/**
 * Apply user preference adjustments to a window's score.
 * Returns a new window object with the adjusted score, or the original if no adjustments apply.
 *
 * Priority matches discovery-adapter: skill ceiling checked first — if waves exceed
 * the user's skill level, that penalty is applied and preference adjustment is skipped.
 */
function applyPreferenceAdjustments(
  window: PersonalizedForecastWindow,
  preferredWaveSize: 'small' | 'medium' | 'large' | null,
  userSkillLevel: ReturnType<typeof parseSkillLevel>
): PersonalizedForecastWindow {
  if (!preferredWaveSize && !userSkillLevel) return window;

  const waveHeight = parseFloat(window.waveHeight || '0');

  // Safety first: skill ceiling takes priority (matches discovery-adapter pattern)
  if (userSkillLevel) {
    const skillResult = checkSkillCeiling(waveHeight, userSkillLevel);
    if (skillResult.penalty > 0) {
      const adjustedScore = Math.max(0, (window.score ?? 0) - skillResult.penalty);
      return { ...window, score: adjustedScore };
    }
  }

  // Apply preference adjustment only when within skill range
  if (preferredWaveSize) {
    const prefResult = calculatePreferenceAdjustment(waveHeight, preferredWaveSize);
    if (prefResult.adjustment !== 0) {
      const adjustedScore = Math.max(0, Math.min(100, (window.score ?? 0) + prefResult.adjustment));
      return { ...window, score: adjustedScore };
    }
  }

  return window;
}

/**
 * Cached surf report computation.
 *
 * Cache duration: 900s (15 minutes). Rationale:
 * - Forecast data (NOAA/NDBC) refreshes every 1–6 hours; 15 min is well
 *   within the freshness window while cutting DB load by ~95% on popular spots.
 * - The parent page is force-dynamic (cookie access), so without this cache
 *   every page load would re-fetch forecasts + run window selection.
 * - "Updated" timestamp shown in the UI reflects computation time, not page
 *   serve time, so users see how recent the call actually is.
 * - 15 min is short enough that a surf report won't feel stale before/during
 *   a session, but long enough to survive traffic spikes on popular spots.
 *
 * Cache is keyed by (beachId, userId, prefsKey) so each user gets personalized
 * results based on their surf preferences. The prefsKey is a stable string
 * derived from preference values to ensure consistent cache key generation.
 */
const getCachedSurfReport = unstable_cache(
  async (
    beachId: string,
    beach: Beach,
    userId: string,
    prefsKey: string,
    userPrefs: UserSurfPreferences | null,
    preferredWaveSize: 'small' | 'medium' | 'large' | null,
    userSkillLevel: ReturnType<typeof parseSkillLevel>
  ): Promise<SpotSurfReportResult | null> => {
    // 1. Determine beach timezone
    const beachTz = beach.lat != null && beach.lon != null
      ? getTimezoneFromCoords(beach.lat, beach.lon)
      : DEFAULT_TIMEZONE;

    // 2. Determine "today" and "tomorrow" in beach timezone
    const now = new Date();
    const todayStr = formatDateInTimezone(now, beachTz);
    const tomorrow = new Date(now.getTime() + 86_400_000);
    const tomorrowStr = formatDateInTimezone(tomorrow, beachTz);

    // 2.5. Fetch sun times for sunset capping
    const sunTimesCache = await getBatchSunTimes([beachId], [todayStr, tomorrowStr]);

    // 3. Query enhanced_forecasts directly with timezone-aware dates
    const dayAfterTomorrow = new Date(new Date(tomorrowStr + 'T00:00:00Z').getTime() + 86400000).toISOString().split('T')[0];
    const supabase = await createSupabaseServiceRoleClient();
    const { data, error } = await supabase
      .from('enhanced_forecasts')
      .select('*')
      .eq('beach_id', beachId)
      .gte('forecast_at', `${todayStr}T00:00:00Z`)
      .lt('forecast_at', `${dayAfterTomorrow}T00:00:00Z`)
      .order('forecast_at', { ascending: true })
      .limit(48);

    if (error) {
      console.error('[getCachedSurfReport] Database error:', {
        beachId,
        message: error.message,
        code: error.code,
      });
      return { report: computeSurfCall(null, [], beach), isTomorrow: false };
    }

    if (!data || data.length === 0) {
      return { report: computeSurfCall(null, [], beach), isTomorrow: false };
    }

    const forecasts = data as EnhancedForecastEntity[];

    // 4. Filter to today first; fall back to tomorrow if no viable window today
    const todayForecasts = forecasts.filter(f => extractForecastDate(f.forecast_at, beachTz) === todayStr);
    const tomorrowForecasts = forecasts.filter(f => extractForecastDate(f.forecast_at, beachTz) === tomorrowStr);

    const { selectBestWindow } = await import('@/lib/services/discovery/window-selector');

    // Try today's forecasts first
    if (todayForecasts.length > 0) {
      const window = selectBestWindow({
        forecasts: todayForecasts,
        beach,
        userPrefs,
        horizonHours: 24,
        sunTimesCache,
      });

      if (window) {
        delete window.sourceForecast;
        const adjustedWindow = applyPreferenceAdjustments(window, preferredWaveSize, userSkillLevel);
        return { report: computeSurfCall(adjustedWindow, todayForecasts, beach), isTomorrow: false };
      }
    }

    // Fall back to tomorrow if today has no viable window (or no data)
    if (tomorrowForecasts.length > 0) {
      const window = selectBestWindow({
        forecasts: tomorrowForecasts,
        beach,
        userPrefs,
        horizonHours: 48,
        sunTimesCache,
      });

      if (window) {
        delete window.sourceForecast;
        const adjustedWindow = applyPreferenceAdjustments(window, preferredWaveSize, userSkillLevel);
        return { report: computeSurfCall(adjustedWindow, tomorrowForecasts, beach), isTomorrow: true };
      }
      return { report: computeSurfCall(null, tomorrowForecasts, beach), isTomorrow: true };
    }

    // No forecast data for either day
    return { report: computeSurfCall(null, [], beach), isTomorrow: false };
  },
  ['spot-surf-report'],
  { revalidate: 900 } // 15-minute cache
);
