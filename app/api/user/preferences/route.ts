import {
  withAuth,
  createSuccessResponse,
  createErrorResponse,
} from "@/lib/middleware/api-wrappers";

export const dynamic = "force-dynamic";

/**
 * GET /api/user/preferences
 *
 * Retrieves the authenticated user's learned surf preferences from the database.
 *
 * Returns:
 *   - wave_min_ft: Minimum wave height preference
 *   - wave_max_ft: Maximum wave height preference
 *   - confidence: Confidence score of the learned preferences
 *   - sample_size: Number of sessions used to learn preferences
 *   - (or null if no preferences exist yet)
 */
export const GET = withAuth(async (_request, { user, supabase }) => {
  // Query user_surf_preferences table
  const { data: preferences, error: prefsError } = await supabase
    .from("user_surf_preferences")
    .select(
      `
      wave_min_ft,
      wave_max_ft,
      wave_period_min_s,
      wave_period_max_s,
      max_wind_mph,
      preferred_wind_directions,
      preferred_tide_statuses,
      confidence,
      sample_size,
      eligible_session_count,
      avoidance_by_beach,
      validated_at,
      manual_override
    `
    )
    .eq("user_id", user.id)
    .maybeSingle();

  if (prefsError) {
    console.error("Error fetching preferences:", prefsError);
    return createErrorResponse("Failed to fetch preferences", undefined, 500);
  }

  // Return preferences
  return createSuccessResponse(preferences);
}, { errorMessage: "Internal server error" });
