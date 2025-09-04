import { NextRequest } from "next/server";
import { createSuccessResponse, handleApiError } from "@/lib/api-utils";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(
  _request: NextRequest,
  context: { params: { id: string } }
) {
  try {
    const { id: sessionId } = context.params;
    const supabase = await createSupabaseServerClient();

    // Determine if the current user liked this session (unauthenticated => false)
    const {
      data: { user },
    } = await supabase.auth.getUser();

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
      .select("*", { count: "exact", head: true })
      .eq("session_id", sessionId);

    if (countError) {
      throw countError;
    }

    return createSuccessResponse({ liked, likesCount: likesCount || 0 });
  } catch (error) {
    return handleApiError(error, "Failed to load like status");
  }
}


