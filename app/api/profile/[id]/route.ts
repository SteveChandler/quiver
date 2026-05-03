import { NextRequest, NextResponse } from "next/server";
import { createSuccessResponse, handleApiError } from "@/lib/api-utils";
import { getProfileDTOById, getProfileWithHomeBeachById } from "@/lib/profile/fetchers";
import {
  withAuth,
  withBotBlockingAndRateLimit,
} from "@/lib/middleware/api-wrappers";
import type { OptionalAuthContext } from "@/lib/middleware/api-wrappers/types";
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
  notif_push_enabled: boolean | null;
  notif_forecast_alerts: boolean | null;
  notif_email_enabled: boolean | null;
  notif_inapp_enabled: boolean | null;
  notif_likes: boolean | null;
  notif_follows: boolean | null;
  notif_reminders: boolean | null;
  notif_xp_updates: boolean | null;
  home_beach: { id: string; name: string } | null;
}

export const dynamic = 'force-dynamic';

/**
 * Get user profile by ID
 * GET /api/profile/[id]
 *
 * Authentication is OPTIONAL — profiles are public. `isFollowing` and
 * `isOwnProfile` are populated only when a user is authenticated (cookie
 * or Bearer). Bot blocking + rate limiting wrap the outside.
 */
const profileHandler = withAuth(
  async (
    _request: NextRequest,
    { user, supabase, params }: OptionalAuthContext
  ): Promise<NextResponse> => {
    try {
      const userId = params.id;
      if (!userId) {
        return createSuccessResponse({ error: "User ID is required" }, 400);
      }

      // Block filter: if the authenticated caller has blocked this profile
      // owner, surface 404 so blocked users are functionally invisible. Skips
      // the check when caller is unauthenticated (no blocklist context).
      // Self-views are exempt — you can't block yourself.
      if (user && user.id !== userId) {
        const { data: block, error: blockErr } = await supabase
          .from("user_blocks")
          .select("blocked_id")
          .eq("blocker_id", user.id)
          .eq("blocked_id", userId)
          .maybeSingle();
        if (blockErr) throw blockErr;
        if (block) {
          return NextResponse.json(
            { success: false, error: "Profile not found", timestamp: new Date().toISOString() },
            { status: 404 },
          );
        }
      }

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
        const completedSessions = sessions.filter(
          (s: { status: string | null }) => s.status === "completed"
        );
        sessionStats.session_count = completedSessions.length;

        if (completedSessions.length > 0) {
          const totalRating = completedSessions.reduce(
            (sum: number, s: { rating: number | null }) => sum + (s.rating || 0),
            0,
          );
          sessionStats.average_rating =
            Math.round((totalRating / completedSessions.length) * 10) / 10;
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
        // Notification preferences
        notif_push_enabled: details?.notif_push_enabled ?? true,
        notif_forecast_alerts: details?.notif_forecast_alerts ?? true,
        notif_email_enabled: details?.notif_email_enabled ?? true,
        notif_inapp_enabled: details?.notif_inapp_enabled ?? true,
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
  },
  { optional: true, errorMessage: "Failed to load profile" }
);

// Compose: bot blocking + rate limit → optional-auth handler.
export const GET = withBotBlockingAndRateLimit(profileHandler, "public-default");
