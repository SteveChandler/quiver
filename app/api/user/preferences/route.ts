import { NextResponse } from "next/server";
import { createAPIServerClient } from "@/lib/supabase/server";

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
export async function GET() {
  const supabase = createAPIServerClient();

  // Authenticate user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Query user_surf_preferences table
    const { data: preferences, error: prefsError } = await supabase
      .from("user_surf_preferences")
      .select("*")
      .eq("user_id", user.id)
      .single();

    // PGRST116 = no rows returned, which is fine (user has no preferences yet)
    if (prefsError) {
      if (prefsError.code === "PGRST116") {
        return NextResponse.json({ data: null });
      }

      console.error("Error fetching preferences:", prefsError);
      return NextResponse.json(
        { error: "Failed to fetch preferences" },
        { status: 500 }
      );
    }

    // Return preferences
    return NextResponse.json({ data: preferences });
  } catch (error) {
    console.error("Unexpected error in /api/user/preferences:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
