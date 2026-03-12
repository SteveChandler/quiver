"use server";

import { withAuthenticatedAction } from "@/lib/server-action-utils";
import { creditAuthorWithXP } from "@/lib/gamification";

export async function toggleSessionLike(sessionId: string) {
  return withAuthenticatedAction(async (user, supabase) => {
    // Check if user has already liked this session
    const { data: existingLike, error: checkError } = await supabase
      .from("session_likes")
      .select("id")
      .eq("session_id", sessionId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (checkError) {
      throw checkError;
    }

    if (existingLike) {
      // User has already liked, so unlike
      const { error: deleteError } = await supabase
        .from("session_likes")
        .delete()
        .eq("id", existingLike.id);

      if (deleteError) {
        throw deleteError;
      }

      return {
        liked: false,
        message: "Session unliked",
      };
    } else {
      // User hasn't liked, so like
      const { error: insertError } = await supabase
        .from("session_likes")
        .insert({
          session_id: sessionId,
          user_id: user.id,
        });

      if (insertError) {
        throw insertError;
      }

      // Get the session author to credit them with XP
      const { data: session, error: sessionError } = await supabase
        .from("sessions")
        .select("user_id")
        .eq("id", sessionId)
        .single();

      if (!sessionError && session && session.user_id !== user.id) {
        // Credit the author with XP (async, don't block the response)
        try {
          const xpResult = creditAuthorWithXP(
            session.user_id,
            "session",
            sessionId
          );
          xpResult?.catch?.((err: unknown) =>
            console.error("Failed to credit author XP:", err)
          );
        } catch (err) {
          console.error("Failed to credit author XP:", err);
        }
        // Track liker XP for engaging with community (non-blocking)
      }

      return {
        liked: true,
        message: "Session liked",
      };
    }
  });
}

export async function getSessionLikeStatus(sessionId: string) {
  return withAuthenticatedAction(async (user, supabase) => {
    // Check if user has liked this session
    const { data: userLike, error: likeError } = await supabase
      .from("session_likes")
      .select("id")
      .eq("session_id", sessionId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (likeError) {
      throw likeError;
    }

    // Get total likes count
    const { count: likesCount, error: countError } = await supabase
      .from("session_likes")
      .select("*", { count: "exact", head: true })
      .eq("session_id", sessionId);

    if (countError) {
      throw countError;
    }

    return {
      liked: !!userLike,
      likesCount: likesCount || 0,
    };
  });
}
