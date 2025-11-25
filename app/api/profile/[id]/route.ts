import { NextRequest, NextResponse } from "next/server";
import { createAPIServerClient } from "@/lib/supabase/api-server-client";
import { createSuccessResponse, handleApiError } from "@/lib/api-utils";
import { getProfileDTOById, getProfileWithHomeBeachById } from "@/lib/profile/fetchers";
import { withBotBlockingAndRateLimit } from "@/lib/middleware/rate-limiter";
import type { ProfileDTO } from "@/types/profile";

export const dynamic = 'force-dynamic';

/**
 * Core handler for fetching user profile by ID
 */
async function fetchProfileById(userId: string): Promise<NextResponse> {
  try {
    if (!userId) {
      return createSuccessResponse(
        { error: "User ID is required" },
        400
      );
    }

    const supabase = createAPIServerClient();

    // Get current user for authentication (optional for public profiles)
    const { data: { user } } = await supabase.auth.getUser();

    // Get user profile DTO via view; fallback to joined query if the view is missing in dev/test
    let base: ProfileDTO | null = null;
    try {
      base = await getProfileDTOById(userId, supabase);
    } catch (e) {
      // Fallback path for environments without the materialized view
      const { profile, homeBeachName } = await getProfileWithHomeBeachById(userId, supabase);
      base = {
        id: profile.id,
        full_name: profile.full_name ?? null,
        home_beach_id: profile.home_beach_id ?? null,
        homeBeachName: homeBeachName,
        home_beach: profile.home_beach ?? null,
      } as ProfileDTO;
    }

    // Fetch additional profile details and counters expected by clients/tests
    const { data: details } = await supabase
      .from("profiles")
      .select(
        `
        followers_count,
        following_count,
        created_at,
        avatar_url,
        email,
        bio,
        location,
        experience_level,
        instagram,
        home_beach:beaches!profiles_home_beach_id_fkey(id, name)
      `
      )
      .eq("id", userId)
      .single();

    // Add session stats (only public sessions for privacy)
    const { data: sessions, error: sessionsError } = await supabase
      .from("sessions")
      .select("id, rating, status")
      .eq("user_id", userId)
      .eq("is_public", true);

    let sessionStats: { session_count: number; average_rating: number | null } = {
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
      followers_count: details?.followers_count ?? 0,
      following_count: details?.following_count ?? 0,
      created_at: details?.created_at ?? null,
      // Optional details for richer UI rendering
      avatar_url: details?.avatar_url ?? null,
      email: details?.email ?? null,
      bio: details?.bio ?? null,
      location: details?.location ?? null,
      experience_level: details?.experience_level ?? null,
      instagram: details?.instagram ?? null,
      home_beach: details?.home_beach ?? null,
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

/**
 * Get user profile by ID
 * GET /api/profile/[id]
 *
 * Bot blocking and rate limiting applied to prevent abuse
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;

  // Wrap the handler with bot blocking and rate limiting
  const wrappedHandler = withBotBlockingAndRateLimit(
    async () => fetchProfileById(id),
    "public-default"
  );

  return wrappedHandler(request);
}
