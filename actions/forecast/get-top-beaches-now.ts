"use server";

/**
 * Server action to fetch the top-ranked beaches by current score.
 *
 * Used by the "Best Right Now" section on the landing page and forecast hub
 * to display a ranked leaderboard of the best beaches at this moment.
 *
 * @module actions/forecast/get-top-beaches-now
 */

import {
  getTopBeachesRightNow,
  type TopBeachEntry,
} from "@/lib/utils/forecast-hub-utils";

export type { TopBeachEntry };

/**
 * Fetch the top beaches by current forecast score.
 *
 * Returns a lightweight array with only the fields needed by the
 * BestRightNow component. Returns an empty array on failure.
 */
export async function getTopBeachesNow(
  limit: number = 5
): Promise<TopBeachEntry[]> {
  try {
    return await getTopBeachesRightNow(limit);
  } catch (error) {
    console.error("Failed to fetch top beaches for Best Right Now:", error);
    return [];
  }
}
