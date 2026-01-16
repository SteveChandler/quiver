"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { withServerAction, ServerActionResponse } from "@/lib/server-action-utils";

export interface CityMetadata {
  cityName: string;
  state: string;
  stateName: string;
  totalBeaches: number;
  beginnerCount: number;
  intermediateCount: number;
  advancedCount: number;
  beaches: Array<{
    name: string;
    slug: string;
    skillLevel: string | null;
  }>;
  centerLat: number;
  centerLon: number;
}

const STATE_NAMES: Record<string, string> = {
  CA: "California",
  HI: "Hawaii",
  OR: "Oregon",
  WA: "Washington",
  FL: "Florida",
  NC: "North Carolina",
  SC: "South Carolina",
  NJ: "New Jersey",
  NY: "New York",
  TX: "Texas",
  MA: "Massachusetts",
  ME: "Maine",
  RI: "Rhode Island",
  NH: "New Hampshire",
  GA: "Georgia",
  PR: "Puerto Rico",
};

/**
 * Categorize a skill level string into beginner, intermediate, or advanced.
 * - Beginner: includes "beginner" or "longboard" in the string
 * - Advanced: includes "advanced" or "expert" in the string
 * - Intermediate: everything else (including null)
 */
function categorizeSkillLevel(
  skillLevel: string | null
): "beginner" | "intermediate" | "advanced" {
  if (!skillLevel) return "intermediate";
  const lower = skillLevel.toLowerCase();
  if (lower.includes("beginner") || lower.includes("longboard")) return "beginner";
  if (lower.includes("advanced") || lower.includes("expert")) return "advanced";
  return "intermediate";
}

/**
 * Get metadata for a city including beach counts and names.
 * Returns null if city doesn't exist or has fewer than 3 beaches.
 *
 * @param cityName - The city name (e.g., "Santa Cruz")
 * @param state - The state code (e.g., "CA")
 */
export async function getCityMetadata(
  cityName: string,
  state: string
): Promise<ServerActionResponse<CityMetadata | null>> {
  return withServerAction(async () => {
    const supabase = await createSupabaseServerClient();
    const normalizedState = state.toUpperCase();

    const { data: beaches, error } = await supabase
      .from("beaches")
      .select("id, name, slug, skill_level, center_lat, center_lng")
      .ilike("city", cityName)
      .eq("state", normalizedState)
      .or("is_private.is.null,is_private.eq.false")
      .order("name");

    if (error) {
      throw new Error(error.message || "Failed to fetch city beaches");
    }

    // Return null if city doesn't exist or has fewer than 3 beaches
    if (!beaches || beaches.length < 3) {
      return null;
    }

    // Calculate skill level counts
    let beginnerCount = 0;
    let intermediateCount = 0;
    let advancedCount = 0;

    for (const beach of beaches) {
      const category = categorizeSkillLevel(beach.skill_level);
      if (category === "beginner") beginnerCount++;
      else if (category === "intermediate") intermediateCount++;
      else advancedCount++;
    }

    // Calculate center coordinates (average of all beaches with valid coordinates)
    const validCoords = beaches.filter(
      (b) => b.center_lat != null && b.center_lng != null
    );
    const centerLat =
      validCoords.length > 0
        ? validCoords.reduce((sum, b) => sum + b.center_lat, 0) / validCoords.length
        : 0;
    const centerLon =
      validCoords.length > 0
        ? validCoords.reduce((sum, b) => sum + b.center_lng, 0) / validCoords.length
        : 0;

    return {
      cityName,
      state: normalizedState,
      stateName: STATE_NAMES[normalizedState] || normalizedState,
      totalBeaches: beaches.length,
      beginnerCount,
      intermediateCount,
      advancedCount,
      beaches: beaches.map((b) => ({
        name: b.name,
        slug: b.slug,
        skillLevel: b.skill_level,
      })),
      centerLat,
      centerLon,
    };
  });
}
