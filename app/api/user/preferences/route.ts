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
    .select("*")
    .eq("user_id", user.id)
    .single();

  // PGRST116 = no rows returned, which is fine (user has no preferences yet)
  if (prefsError) {
    if (prefsError.code === "PGRST116") {
      return createSuccessResponse(null);
    }

    console.error("Error fetching preferences:", prefsError);
    return createErrorResponse("Failed to fetch preferences", undefined, 500);
  }

  // Return preferences
  return createSuccessResponse(preferences);
}, { errorMessage: "Internal server error" });
