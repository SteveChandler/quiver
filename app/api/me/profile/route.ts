import { NextRequest } from "next/server";
import { createSuccessResponse, handleApiError } from "@/lib/api-utils";
import { fetchProfile } from "@/actions/profile-actions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * GET /api/me/profile - Get current user's profile (cached with tags)
 * This route provides the canonical API for client-side profile fetching
 * and is tagged with "profile" for cache invalidation
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }
    
    // Get profile data using tagged fetch for better caching
    const profileData = await fetchProfile(user.id);
    
    if (!profileData) {
      return new Response(
        JSON.stringify({ error: "Profile not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }
    
    // Return profile with specific fields for home beach functionality
    const response = {
      id: profileData.id,
      home_beach_id: profileData.default_beach_id,
      full_name: profileData.full_name,
      // Include other fields needed by the client
      bio: profileData.bio,
      location: profileData.location,
      avatar_url: profileData.avatar_url,
      default_beach_id: profileData.default_beach_id,
    };
    
    return createSuccessResponse(response, {
      "Cache-Control": "private, max-age=300", // 5 minute cache
    });
  } catch (error) {
    console.error("Error in GET /api/me/profile:", error);
    return handleApiError(error);
  }
}