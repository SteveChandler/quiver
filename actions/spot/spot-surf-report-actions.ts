"use server";

import { unstable_cache } from 'next/cache';
import type { Beach } from '@/types/database';
import type { EnhancedForecastEntity } from '@/types/forecast';
import { computeSurfCall, type SurfCallResult } from '@/lib/utils/surf-call-logic';
import { getTimezoneFromCoords } from '@/lib/utils/timezone-utils.server';
import { DEFAULT_TIMEZONE } from '@/lib/utils/timezone-constants';
import { formatDateInTimezone } from '@/lib/utils/date-formatting';

/**
 * Get today's surf report for a beach.
 *
 * Cached for 15 minutes via unstable_cache to avoid redundant DB hits
 * on a force-dynamic page. Returns null on any error so the UI gracefully
 * degrades (no card rendered).
 */
export async function getSpotSurfReport(beach: Beach): Promise<SurfCallResult | null> {
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
  async (beachId: string, beach: Beach): Promise<SurfCallResult | null> => {
    // 1. Determine beach timezone
    const beachTz = beach.lat != null && beach.lon != null
      ? getTimezoneFromCoords(beach.lat, beach.lon)
      : DEFAULT_TIMEZONE;

    // 2. Determine "today" in beach timezone
    const todayStr = formatDateInTimezone(new Date(), beachTz);

    // 3. Fetch forecasts (today + tomorrow for window selection)
    const { getEnhancedBeachForecasts } = await import('@/actions/forecast-actions');
    const forecastResult = await getEnhancedBeachForecasts(beachId, 2);
    if (!forecastResult.success || !forecastResult.data) {
      return computeSurfCall(null, [], beach);
    }

    // 4. Filter forecasts to today in beach timezone
    const todayForecasts = (forecastResult.data as EnhancedForecastEntity[]).filter((f) => {
      return f.forecast_date === todayStr;
    });

    if (todayForecasts.length === 0) {
      return computeSurfCall(null, [], beach);
    }

    // 5. Select best window
    const { selectBestWindow } = await import('@/lib/services/discovery/window-selector');
    const window = selectBestWindow({
      forecasts: todayForecasts,
      beach,
      userPrefs: null,
      horizonHours: 24,
    });

    // 6. Compute surf call
    return computeSurfCall(window, todayForecasts, beach);
  },
  ['spot-surf-report'],
  { revalidate: 900 } // 15-minute cache
);
