"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { BeachRecommendationService } from "@/lib/services/beach-recommendation-service";
import type { BeachRecommendation } from "@/types/beach-recommendations";

/**
 * Server action to get best beach recommendations near user's location
 *
 * This is now a thin wrapper around the BeachRecommendationService,
 * handling only authentication and delegating all business logic to the service layer.
 *
 * @param coords - Optional GPS coordinates { lat, lon }
 * @returns Service result with beach recommendations and metadata
 */
export async function getBestBeachesNearHome(
  coords?: { lat: number; lon: number } | null
) {
  try {
    const supabase = await createSupabaseServerClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return { success: true, data: [] as BeachRecommendation[], metadata: undefined };
    }

    // Delegate all business logic to the service
    const service = new BeachRecommendationService();
    return await service.getBestBeaches(user.id, coords);
  } catch (error) {
    console.error("[getBestBeachesNearHome] ❌ Unexpected error:", error);
    return { success: false, error: String(error), data: [] as BeachRecommendation[], metadata: undefined };
  }
}
