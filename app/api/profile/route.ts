import { NextRequest } from "next/server";
import { createSuccessResponse, handleApiError } from "@/lib/api-utils";
import { fetchProfile } from "@/actions/profile-actions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * GET /api/profile - Get current user's profile (cached with tags)
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
    
    return createSuccessResponse(profileData);
  } catch (error) {
    console.error("Error in GET /api/profile:", error);
    return handleApiError(error);
  }
}