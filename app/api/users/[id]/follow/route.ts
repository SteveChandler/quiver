import type { NextRequest } from "next/server";
import {
  withAuth,
  validateUuidParam,
  createSuccessResponse,
  methodNotAllowed,
  type AuthenticatedContext,
} from "@/lib/middleware/api-wrappers";

/**
 * GET /api/users/[id]/follow - Get follow status for a user
 * Uses optional auth - works for both authenticated and unauthenticated users
 */
export const GET = withAuth(
  async (_request: NextRequest, { user, supabase, params }: AuthenticatedContext) => {
    // Validate UUID
    const uuidResult = validateUuidParam(params.id, "user");
    if ("error" in uuidResult) return uuidResult.error;
    const targetUserId = uuidResult.value;

    // Fetch counts
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("followers_count, following_count")
      .eq("id", targetUserId)
      .single();

    if (profileError) throw profileError;

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
  },
  { optional: true, errorMessage: "Failed to load follow status" }
);

export function POST() {
  return methodNotAllowed(["GET"]);
}


