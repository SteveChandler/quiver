"use server";

/**
 * Server action to fetch the top-ranked beaches by current score.
 *
 * Used by the "Best Right Now" section on the landing page and forecast hub
 * to display a ranked leaderboard of the best beaches at this moment.
 *
 * @module actions/forecast/get-top-beaches-now
 */

import { getTopBeachesRightNow } from "@/lib/utils/forecast-hub-utils";
import { trackFallback } from "@/lib/monitoring/fallback-tracker";
import type { TopBeachEntry } from "@/lib/utils/forecast-hub-utils";

/**
 * Fetch the top beaches by current forecast score.
 *
 * When userLat/userLon are provided, filters to the user's closest region.
 * Returns a lightweight array with only the fields needed by the
 * BestRightNow component. Returns an empty array on failure.
 */
export async function getTopBeachesNow(
  limit: number = 5,
  userLat?: number,
  userLon?: number
): Promise<TopBeachEntry[]> {
  try {
    const userCoords =
      userLat !== undefined && userLon !== undefined
        ? { lat: userLat, lon: userLon }
        : null;
    return await getTopBeachesRightNow(limit, userCoords);
  } catch (error) {
    console.error("Failed to fetch top beaches for Best Right Now:", error);
    trackFallback({ domain: 'homepage', field: 'top_beaches', fallbackValue: '[]', severity: 'high' });
    return [];
  }
}
