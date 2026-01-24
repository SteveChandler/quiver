"use server";

import { unstable_cache } from 'next/cache';
import type { Beach } from '@/types/database';
import type { EnhancedForecastEntity } from '@/types/forecast';
import { computeSurfCall, type SurfCallResult } from '@/lib/utils/surf-call-logic';
import { getTimezoneFromCoords } from '@/lib/utils/timezone-utils.server';
import { DEFAULT_TIMEZONE } from '@/lib/utils/timezone-constants';
import { formatDateInTimezone } from '@/lib/utils/date-formatting';
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server';

export interface SpotSurfReportResult {
  report: SurfCallResult;
  isTomorrow: boolean;
}

/**
 * Get today's (or tomorrow's) surf report for a beach.
 *
 * Cached for 15 minutes via unstable_cache to avoid redundant DB hits
 * on a force-dynamic page. Returns null on any error so the UI gracefully
 * degrades (no card rendered).
 */
export async function getSpotSurfReport(beach: Beach): Promise<SpotSurfReportResult | null> {
  if (!beach.id) return null;

  try {
    return await getCachedSurfReport(beach.id, beach);
  } catch (error) {
    console.error('[getSpotSurfReport] Error:', {
      beachId: beach.id,
      message: error instanceof Error ? error.message : 'Unknown error',
    });
    return null;
  }
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
 */
const getCachedSurfReport = unstable_cache(
  async (beachId: string, beach: Beach): Promise<SpotSurfReportResult | null> => {
    // 1. Determine beach timezone
    const beachTz = beach.lat != null && beach.lon != null
      ? getTimezoneFromCoords(beach.lat, beach.lon)
      : DEFAULT_TIMEZONE;

    // 2. Determine "today" and "tomorrow" in beach timezone
    const now = new Date();
    const todayStr = formatDateInTimezone(now, beachTz);
    const tomorrow = new Date(now.getTime() + 86_400_000);
    const tomorrowStr = formatDateInTimezone(tomorrow, beachTz);

    // 3. Query enhanced_forecasts directly with timezone-aware dates
    const supabase = await createSupabaseServiceRoleClient();
    const { data, error } = await supabase
      .from('enhanced_forecasts')
      .select('*')
      .eq('beach_id', beachId)
      .gte('forecast_date', todayStr)
      .lte('forecast_date', tomorrowStr)
      .order('forecast_date', { ascending: true })
      .order('forecast_time', { ascending: true })
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
    const todayForecasts = forecasts.filter(f => f.forecast_date === todayStr);
    const tomorrowForecasts = forecasts.filter(f => f.forecast_date === tomorrowStr);

    const { selectBestWindow } = await import('@/lib/services/discovery/window-selector');

    // Try today's forecasts first
    if (todayForecasts.length > 0) {
      const window = selectBestWindow({
        forecasts: todayForecasts,
        beach,
        userPrefs: null,
        horizonHours: 24,
      });

      if (window) {
        return { report: computeSurfCall(window, todayForecasts, beach), isTomorrow: false };
      }
    }

    // Fall back to tomorrow if today has no viable window (or no data)
    if (tomorrowForecasts.length > 0) {
      const window = selectBestWindow({
        forecasts: tomorrowForecasts,
        beach,
        userPrefs: null,
        horizonHours: 48,
      });

      return { report: computeSurfCall(window, tomorrowForecasts, beach), isTomorrow: true };
    }

    // No forecast data for either day
    return { report: computeSurfCall(null, [], beach), isTomorrow: false };
  },
  ['spot-surf-report'],
  { revalidate: 900 } // 15-minute cache
);
