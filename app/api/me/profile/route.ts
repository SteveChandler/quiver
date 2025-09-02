import { NextRequest } from "next/server";
import { createSuccessResponse, handleApiError } from "@/lib/api-utils";
import { fetchProfile as defaultFetchProfile } from "@/actions/profile-actions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * GET /api/me/profile - Get current user's profile (cached with tags)
 * This route provides the canonical API for client-side profile fetching
 * and is tagged with "profile" for cache invalidation
 */
type GetDeps = {
  fetchProfileFn?: typeof defaultFetchProfile;
  getUserFn?: () => Promise<{ user: { id: string } | null; error: any }>;
};

export async function GET(request: NextRequest, deps?: GetDeps) {
  try {
    
    // Get current user (allow DI for tests)
    const getUser = deps?.getUserFn
      ? deps.getUserFn
      : async () => {
          const supabase = createSupabaseServerClient();
          const { data: { user }, error } = await supabase.auth.getUser();
          return { user, error } as any;
        };
    const { user, error: authError } = await getUser();
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }
    
    // Get profile data using tagged fetch for better caching
    const fetchProfile = deps?.fetchProfileFn || defaultFetchProfile;
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
      home_beach_id: profileData.home_beach_id,
      full_name: profileData.full_name,
      // Include other fields needed by the client
      bio: profileData.bio,
      location: profileData.location,
      avatar_url: profileData.avatar_url,
      // Keep default_beach_id for backwards compatibility
      default_beach_id: profileData.home_beach_id,
    };
    
    return createSuccessResponse(response);
  } catch (error) {
    console.error("Error in GET /api/me/profile:", error);
    return handleApiError(error);
  }
}
