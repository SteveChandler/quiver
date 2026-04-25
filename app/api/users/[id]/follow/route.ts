import type { NextRequest } from "next/server";
import {
  withAuth,
  validateUuidParam,
  createSuccessResponse,
  methodNotAllowed,
  type AuthenticatedContext,
} from "@/lib/middleware/api-wrappers";

export const dynamic = "force-dynamic";

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

    // next.config.mjs sets a default `Cache-Control: public, max-age=60,
    // stale-while-revalidate=120` on /api/*, which iOS NSURLCache honors and
    // causes the pill to flicker back to the prior state after a toggle.
    // Force no-store so follow state is never cached.
    const res = createSuccessResponse({
      following,
      followersCount: profile?.followers_count || 0,
      followingCount: profile?.following_count || 0,
    });
    res.headers.set(
      "Cache-Control",
      "private, no-store, no-cache, must-revalidate",
    );
    return res;
  },
  { optional: true, errorMessage: "Failed to load follow status" }
);

export function POST() {
  return methodNotAllowed(["GET"]);
}


