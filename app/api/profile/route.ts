import { NextRequest } from "next/server";
import { createSuccessResponse, handleApiError } from "@/lib/api-utils";
import { getProfileDTOById } from "@/lib/profile/fetchers";
import type { ProfileDTO } from "@/types/profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * GET /api/profile - Get current user's profile with home beach name
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
    
    // Get standardized profile DTO via view
    const dto = await getProfileDTOById(user.id, supabase);
    
    if (!dto) {
      return new Response(
        JSON.stringify({ error: "Profile not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }
    
    return createSuccessResponse(dto as ProfileDTO);
  } catch (error) {
    console.error("Error in GET /api/profile:", error);
    return handleApiError(error);
  }
}