import {
  withAuth,
  createSuccessResponse,
  createAuthError,
  methodNotAllowed,
} from "@/lib/middleware/api-wrappers";
import { addFeaturedPhotoToSessions } from "@/actions/session-actions";
import { normalizeAvoidanceByBeach } from "@/lib/services/preference-learning-service";
import type {
  ProfilePageData,
  ProfilePageStats,
  ProfilePagePreferences,
  ProfilePageProfile,
} from "@/types/profile-page";
import type { Board, Beach, SessionWithDetails } from "@/types/database";

const PROFILE_PAGE_LEARNED_PREFERENCES_SELECT = `
  wave_min_ft,
  wave_max_ft,
  wave_period_min_s,
  wave_period_max_s,
  max_wind_mph,
  preferred_wind_directions,
  preferred_tide_statuses,
  confidence,
  sample_size,
  eligible_session_count,
  avoidance_by_beach,
  validated_at,
  manual_override
`;

const PROFILE_PAGE_RECENT_SESSION_SELECT = `
  id,
  user_id,
  beach_id,
  beach_name,
  board_id,
  board_snapshot,
  arrival_time,
  created_at,
  duration_minutes,
  status,
  is_public,
  rating,
  wave_quality,
  crowd_level,
  parking_ease,
  description,
  notes,
  image_url,
  water_temp,
  wave_height_ft,
  wind_speed_mph,
  wind_direction,
  tide_status,
  tide_height_ft,
  tide_rate_ft_per_hr,
  tide_data_source,
  forecast_accuracy,
  goals,
  invitee_ids,
  comments_count,
  likes_count,
  share_count,
  muted,
  rip_current_observed,
  rip_current_risk,
  session_board_fit,
  session_decomposition,
  session_skill_fit,
  skill_ratings,
  source,
  wave_characteristics,
  custom_spot_id,
  beach:beaches(id, name, lat, lon),
  user:profiles(id, full_name, avatar_url)
`;

const PROFILE_PAGE_BOARD_SELECT =
  "id, user_id, name, board_type, dimensions, description, image_url, size, volume, session_count, created_at, updated_at";

/**
 * GET /api/me/profile-page - Aggregated profile page data endpoint
 *
 * Returns all data needed for the profile page in a single request:
 * - profile: User profile with home beach name
 * - stats: Session/board counts, ratings, most visited beach
 * - preferences: Learned preferences from sessions + onboarding preferences
 * - recentSessions: Last 5 sessions
 * - boards: User's board quiver
 * - beaches: All beaches (for SurfProfileSection editing)
 *
 * Performance optimization: Uses Promise.all for parallel DB queries
 */
export const GET = withAuth(async (_request, { user, supabase }) => {
  const userId = user.id;

  // Execute all queries in parallel for optimal performance
  const [
    profileResult,
    sessionCountResult,
    boardCountResult,
    qualityResult,
    mostVisitedResult,
    learnedPrefsResult,
    recentSessionsResult,
    boardsResult,
    beachesResult,
  ] = await Promise.all([
    // 1. Full profile with home beach join (all fields needed for profile page UI)
    supabase
      .from("profiles")
      .select(
        `
        id,
        full_name,
        avatar_url,
        bio,
        location,
        instagram,
        home_beach_id,
        experience_level,
        surf_styles,
        notif_reminders,
        notif_forecast_alerts,
        allow_implicit_tracking,
        home_beach:beaches!profiles_home_beach_id_fkey ( id, name )
      `
      )
      .eq("id", userId)
      .single(),

    // 2. Session count
    supabase
      .from("sessions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId),

    // 3. Board count
    supabase
      .from("boards")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId),

    // 4. Average wave quality (for rating)
    supabase
      .from("sessions")
      .select("wave_quality")
      .eq("user_id", userId),

    // 5. Most visited beach (RPC) - log errors but don't fail request
    (async () => {
      try {
        return await (supabase.rpc as any)("get_most_visited_beach", { user_id: userId });
      } catch (err) {
        console.warn("get_most_visited_beach RPC failed:", err);
        return { data: null, error: null };
      }
    })(),

    // 6. Learned preferences
    supabase
      .from("user_surf_preferences")
      .select(PROFILE_PAGE_LEARNED_PREFERENCES_SELECT)
      .eq("user_id", userId)
      .single(),

    // 7. Recent sessions (last 5)
    supabase
      .from("sessions")
      .select(PROFILE_PAGE_RECENT_SESSION_SELECT)
      .eq("user_id", userId)
      .order("arrival_time", { ascending: false })
      .limit(5),

    // 8. User's boards
    supabase
      .from("boards")
      .select(PROFILE_PAGE_BOARD_SELECT)
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),

    // 9. All beaches (for editing preferences)
    supabase
      .from("beaches")
      .select("id, name, city, state, lat, lon, slug")
      .or("is_private.is.null,is_private.eq.false")
      .order("name")
      .limit(500),
  ]);

  if (profileResult.error || !profileResult.data) {
    console.error("Profile fetch failed:", profileResult.error);
    return createAuthError();
  }

  const profileData = profileResult.data;
  const homeBeachName =
    profileData.home_beach && typeof profileData.home_beach === "object"
      ? (profileData.home_beach as { name?: string }).name ?? null
      : null;

  // Compute average rating
  let averageRating = 0;
  const qualityData = qualityResult.data || [];
  if (qualityData.length > 0) {
    const sum = qualityData.reduce(
      (acc: number, s: { wave_quality: number | null }) =>
        acc + (s.wave_quality || 0),
      0
    );
    averageRating = Math.round((sum / qualityData.length) * 10) / 10;
  }

  // Extract most visited beach
  let mostVisitedBeach: string | null = null;
  let mostVisitedBeachCount = 0;
  if (
    mostVisitedResult.data &&
    Array.isArray(mostVisitedResult.data) &&
    mostVisitedResult.data.length > 0
  ) {
    mostVisitedBeach = mostVisitedResult.data[0].beach_name;
    mostVisitedBeachCount = mostVisitedResult.data[0].visit_count;
  }

  // Build stats object
  const stats: ProfilePageStats = {
    sessionCount: sessionCountResult.count || 0,
    boardCount: boardCountResult.count || 0,
    averageRating,
    homeBeachId: profileData.home_beach_id || null,
    homeBeachName,
    mostVisitedBeach,
    mostVisitedBeachCount,
  };

  // Build preferences object
  // Handle errors: PGRST116 = not found (OK), other errors = log and treat as null
  const learned = learnedPrefsResult.error
    ? (learnedPrefsResult.error.code !== "PGRST116" &&
        console.warn("Learned prefs fetch failed:", learnedPrefsResult.error),
      null)
    : learnedPrefsResult.data
      ? {
          ...learnedPrefsResult.data,
          avoidance_by_beach: normalizeAvoidanceByBeach(
            learnedPrefsResult.data.avoidance_by_beach,
          ),
        }
      : null;

  const onboarding = {
    experience_level: profileData.experience_level ?? undefined,
    surf_styles: profileData.surf_styles ?? undefined,
  };

  const preferences: ProfilePagePreferences = {
    learned,
    onboarding,
  };

  // Build profile response
  const profile: ProfilePageProfile = {
    id: profileData.id,
    full_name: profileData.full_name ?? null,
    avatar_url: profileData.avatar_url ?? null,
    bio: profileData.bio ?? null,
    location: profileData.location ?? null,
    instagram: profileData.instagram ?? null,
    home_beach_id: profileData.home_beach_id ?? null,
    experience_level: profileData.experience_level ?? null,
    surf_styles: profileData.surf_styles ?? null,
    homeBeachName,
    // Notification settings for ProfilePreferences
    notif_reminders: profileData.notif_reminders ?? null,
    notif_forecast_alerts: profileData.notif_forecast_alerts ?? null,
    allow_implicit_tracking: profileData.allow_implicit_tracking ?? null,
  };

  // Enrich sessions with featured photos.
  // Double cast required: Supabase infers relation fields from the query alias
  // (e.g. `beach`, `user`) while SessionWithDetails declares canonical names
  // (`beaches`, `profiles`) plus back-compat aliases. The structures are
  // compatible at runtime but TypeScript cannot verify the overlap, so we cast
  // through `unknown`.
  const sessionsRaw = recentSessionsResult.data || [];
  const recentSessions = (await addFeaturedPhotoToSessions(
    supabase,
    sessionsRaw
  )) as unknown as SessionWithDetails[];

  // Build response
  const responseData: ProfilePageData = {
    profile,
    stats,
    preferences,
    recentSessions,
    boards: (boardsResult.data || []) as Board[],
    beaches: (beachesResult.data || []) as Beach[],
  };

  return createSuccessResponse(responseData);
}, { errorMessage: "Failed to load profile page data" });

export function POST() {
  return methodNotAllowed(["GET"]);
}

export function PUT() {
  return methodNotAllowed(["GET"]);
}

export function PATCH() {
  return methodNotAllowed(["GET"]);
}

export function DELETE() {
  return methodNotAllowed(["GET"]);
}
