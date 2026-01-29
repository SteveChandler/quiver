import { NextRequest, NextResponse } from "next/server";
import { createAPIServerClient } from "@/lib/supabase/api-server-client";
import { createSuccessResponse, handleApiError } from "@/lib/api-utils";
import { getProfileDTOById, getProfileWithHomeBeachById } from "@/lib/profile/fetchers";
import { withBotBlockingAndRateLimit } from "@/lib/middleware/api-wrappers";
import { PROFILE_FULL_SELECT } from "@/lib/profile/constants";
import type { ProfileDTO } from "@/types/profile";

/**
 * Type for profile details query result.
 * Matches the fields selected via PROFILE_FULL_SELECT.
 */
interface ProfileDetails {
  followers_count: number | null;
  following_count: number | null;
  created_at: string | null;
  avatar_url: string | null;
  email: string | null;
  bio: string | null;
  location: string | null;
  experience_level: string | null;
  instagram: string | null;
  onboarding_completed_at: string | null;
  surf_styles: string[] | null;
  preferred_wave_size: string | null;
  preferred_break_type: string | null;
  crowd_preference: string | null;
  notif_push_enabled: boolean | null;
  notif_forecast_alerts: boolean | null;
  notif_email_enabled: boolean | null;
  notif_inapp_enabled: boolean | null;
  notif_session_invites: boolean | null;
  notif_likes: boolean | null;
  notif_follows: boolean | null;
  notif_reminders: boolean | null;
  notif_xp_updates: boolean | null;
  home_beach: { id: string; name: string } | null;
}

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

    const supabase = await createAPIServerClient();

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
      .select(PROFILE_FULL_SELECT)
      .eq("id", userId)
      .single<ProfileDetails>();

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
      // Surf preferences
      surf_styles: details?.surf_styles ?? null,
      preferred_wave_size: details?.preferred_wave_size ?? null,
      preferred_break_type: details?.preferred_break_type ?? null,
      crowd_preference: details?.crowd_preference ?? null,
      // Notification preferences
      notif_push_enabled: details?.notif_push_enabled ?? true,
      notif_forecast_alerts: details?.notif_forecast_alerts ?? true,
      notif_email_enabled: details?.notif_email_enabled ?? true,
      notif_inapp_enabled: details?.notif_inapp_enabled ?? true,
      notif_session_invites: details?.notif_session_invites ?? true,
      notif_likes: details?.notif_likes ?? true,
      notif_follows: details?.notif_follows ?? true,
      notif_reminders: details?.notif_reminders ?? true,
      notif_xp_updates: details?.notif_xp_updates ?? true,
      // Onboarding tracking
      onboarding_completed_at: details?.onboarding_completed_at ?? null,
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
