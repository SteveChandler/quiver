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
import { getProfileExperienceLevel } from "@/lib/profile/skill-level";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { TopBeachEntry } from "@/lib/utils/forecast-hub-utils";

async function getVerifiedProfileExperience(): Promise<unknown> {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    return await getProfileExperienceLevel(supabase, user.id);
  } catch {
    return null;
  }
}

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
    const profileExperience = await getVerifiedProfileExperience();
    return await getTopBeachesRightNow(
      limit,
      userCoords,
      profileExperience,
    );
  } catch (error) {
    console.error("Failed to fetch top beaches for Best Right Now:", error);
    trackFallback({ domain: 'homepage', field: 'top_beaches', fallbackValue: '[]' });
    return [];
  }
}
