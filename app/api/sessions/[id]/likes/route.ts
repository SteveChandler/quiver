import type { NextRequest } from "next/server";
import { withAuth, validateUuidParam, createSuccessResponse, methodNotAllowed, type AuthenticatedContext } from "@/lib/middleware/api-wrappers";

export const GET = withAuth(
  async (_request: NextRequest, { user, supabase, params }: AuthenticatedContext) => {
    const uuidResult = validateUuidParam(params.id, "session");
    if ("error" in uuidResult) return uuidResult.error;

    const sessionId = uuidResult.value;

    // Determine if the current user liked this session (user is null if optional auth)
    let liked = false;
    if (user) {
      const { data: userLike, error: likeError } = await supabase
        .from("session_likes")
        .select("id")
        .eq("session_id", sessionId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (likeError && likeError.code !== "PGRST116") {
        throw likeError;
      }
      liked = !!userLike;
    }

    // Get total likes count
    const { count: likesCount, error: countError } = await supabase
      .from("session_likes")
      .select("id", { count: "exact", head: true })
      .eq("session_id", sessionId);

    if (countError) {
      throw countError;
    }

    return createSuccessResponse({ liked, likesCount: likesCount || 0 });
  },
  { optional: true, errorMessage: "Failed to load like status" }
);

export function POST() {
  return methodNotAllowed(["GET"]);
}

