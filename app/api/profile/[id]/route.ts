import { NextRequest } from "next/server";
import { createAPIServerClient } from "@/lib/supabase/api-server-client";
import { createSuccessResponse, handleApiError } from "@/lib/api-utils";

export const dynamic = 'force-dynamic';

/**
 * Get user profile by ID
 * GET /api/profile/[id]
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: userId } = params;

    if (!userId) {
      return createSuccessResponse(
        { error: "User ID is required" },
        400
      );
    }

    const supabase = createAPIServerClient();

    // Get current user for authentication (optional for public profiles)
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    // Get user profile
    const { data: profile, error } = await supabase
      .from("profiles")
      .select(`
        id,
        full_name,
        favorite_spot,
        followers_count,
        following_count,
        created_at
      `)
      .eq("id", userId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        // No rows returned - user not found
        return createSuccessResponse(
          { error: "User not found" },
          404
        );
      }
      throw error;
    }

    // Add session stats (only public sessions for privacy)
    const { data: sessions, error: sessionsError } = await supabase
      .from("sessions")
      .select("id, rating, status")
      .eq("user_id", userId)
      .eq("is_public", true);

    let sessionStats = {
      session_count: 0,
      average_rating: null,
    };

    if (!sessionsError && sessions) {
      const completedSessions = sessions.filter(s => s.status === "completed");
      sessionStats.session_count = completedSessions.length;
      
      if (completedSessions.length > 0) {
        const totalRating = completedSessions.reduce((sum, s) => sum + (s.rating || 0), 0);
        sessionStats.average_rating = Math.round((totalRating / completedSessions.length) * 10) / 10;
      }
    }

    // Check if current user is following this user (if authenticated)
    let isFollowingUser = false;
    if (user && user.id !== userId) {
      const { data: followData } = await supabase
        .from("user_follows")
        .select("id")
        .eq("follower_id", user.id)
        .eq("following_id", userId)
        .single();
      
      isFollowingUser = !!followData;
    }

    const profileWithStats = {
      ...profile,
      ...sessionStats,
      isFollowing: isFollowingUser,
      isOwnProfile: user?.id === userId,
    };

    return createSuccessResponse(profileWithStats);

  } catch (error) {
    console.error("Error fetching user profile:", error);
    return handleApiError(error);
  }
}
