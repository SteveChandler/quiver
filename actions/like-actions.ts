"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { creditAuthorWithXP } from "@/lib/gamification";

export async function toggleSessionLike(sessionId: string) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: "Authentication required" };
    }

    // Check if user has already liked this session
    const { data: existingLike, error: checkError } = await supabase
      .from("session_likes")
      .select("id")
      .eq("session_id", sessionId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (checkError) {
      return { success: false, error: checkError.message };
    }

    if (existingLike) {
      // User has already liked, so unlike
      const { error: deleteError } = await supabase
        .from("session_likes")
        .delete()
        .eq("id", existingLike.id);

      if (deleteError) {
        return { success: false, error: deleteError.message };
      }

      return {
        success: true,
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
        return { success: false, error: insertError.message };
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
        success: true,
        liked: true,
        message: "Session liked",
      };
    }
  } catch (error) {
    console.error("Error toggling session like:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

export async function getSessionLikeStatus(sessionId: string) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Graceful degradation for unauthenticated users
    if (!user) {
      const { count: likesCount, error: countError } = await supabase
        .from("session_likes")
        .select("*", { count: "exact", head: true })
        .eq("session_id", sessionId);

      return {
        success: true,
        liked: false,
        likesCount: countError ? 0 : likesCount || 0,
      };
    }

    // Check if user has liked this session
    const { data: userLike, error: likeError } = await supabase
      .from("session_likes")
      .select("id")
      .eq("session_id", sessionId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (likeError) {
      return { success: false, error: likeError.message };
    }

    // Get total likes count
    const { count: likesCount, error: countError } = await supabase
      .from("session_likes")
      .select("*", { count: "exact", head: true })
      .eq("session_id", sessionId);

    if (countError) {
      return { success: false, error: countError.message };
    }

    return {
      success: true,
      liked: !!userLike,
      likesCount: likesCount || 0,
    };
  } catch (error) {
    console.error("Error getting session like status:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}
