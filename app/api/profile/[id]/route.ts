import { NextRequest } from "next/server";
import { createAPIServerClient } from "@/lib/supabase/api-server-client";
import { createSuccessResponse, handleApiError } from "@/lib/api-utils";
import { getProfileDTOById } from "@/lib/profile/fetchers";
import type { ProfileDTO } from "@/types/profile";

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
    
    // Get user profile DTO via view
    const base = await getProfileDTOById(userId, supabase);

    // Fetch additional profile counters expected by clients/tests
    const { data: counts } = await supabase
      .from("profiles")
      .select("followers_count, following_count, created_at")
      .eq("id", userId)
      .single();

    // profile fetched above; if not found, fetcher would throw and be handled below

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
      ...(base as ProfileDTO),
      followers_count: counts?.followers_count ?? 0,
      following_count: counts?.following_count ?? 0,
      created_at: counts?.created_at ?? null,
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
