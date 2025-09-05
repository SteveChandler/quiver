import { NextRequest } from "next/server";
import { createSuccessResponse, handleApiError, createValidationError, methodNotAllowed, isValidUuid } from "@/lib/api-utils";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(
  _request: NextRequest,
  context: { params: { id: string } }
) {
  try {
    const { id: targetUserId } = context.params;
    if (!targetUserId || !isValidUuid(targetUserId)) {
      return createValidationError("Invalid user id format");
    }
    const supabase = await createSupabaseServerClient();

    // Get current user if authenticated
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Fetch counts
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("followers_count, following_count")
      .eq("id", targetUserId)
      .single();

    if (profileError) {
      throw profileError;
    }

    let following = false;
    if (user && user.id !== targetUserId) {
      const { data: userFollow, error: followError } = await supabase
        .from("user_follows")
        .select("id")
        .eq("follower_id", user.id)
        .eq("following_id", targetUserId)
        .maybeSingle();

      if (followError && followError.code !== "PGRST116") {
        throw followError;
      }

      following = !!userFollow;
    }

    return createSuccessResponse({
      following,
      followersCount: profile?.followers_count || 0,
      followingCount: profile?.following_count || 0,
    });
  } catch (error) {
    return handleApiError(error, "Failed to load follow status");
  }
}

export function POST() {
  return methodNotAllowed(["GET"]);
}


