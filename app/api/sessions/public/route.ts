import { NextRequest, NextResponse } from "next/server";
import {
  createPaginatedResponse,
  CacheDuration,
  parsePaginationParams,
  createPaginationMeta,
  withAuth,
  withRateLimit,
  type OptionalAuthContext,
} from "@/lib/middleware/api-wrappers";

// Mark this route as dynamic to prevent static generation
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/sessions/public
 *
 * Fetches public completed surf sessions for display on the public sessions feed.
 * This endpoint is accessible without authentication but supports optional auth
 * for per-user like status.
 *
 * Query Parameters:
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 10, max: 50)
 * - lat: Latitude for location-scoped feed (-90 to 90)
 * - lon: Longitude for location-scoped feed (-180 to 180)
 * - radius_miles: Radius in miles (default: 30, max: 100)
 * - beach_id: Filter by specific beach
 * - date_from: Filter sessions from this date (ISO string)
 * - date_to: Filter sessions until this date (ISO string)
 * - feed_type: "global" (default) | "friends" — friends restricts to sessions
 *              from users the caller follows (requires auth; returns empty if
 *              unauthenticated or not following anyone)
 * - quality: "informative" (default) | "strong" | "all". Informative rows
 *            have useful context/media; strong rows are positive, useful rows.
 *
 * Returns:
 * - Paginated list of public sessions with beach info, ratings, and author details
 */
async function publicSessionsHandler(
  request: NextRequest,
  { user, supabase }: OptionalAuthContext,
): Promise<NextResponse> {
  // Per-user `likedByMe` + friend-feed filtering make the response
  // non-cacheable for authenticated callers — a shared cache (CDN, NSURLCache)
  // would leak user A's like state to user B. Strip the blanket SHORT cache
  // to private/no-store when the request is authenticated.
  const finalize = async (res: NextResponse): Promise<NextResponse> => {
    if (user) {
      res.headers.set(
        "Cache-Control",
        "private, no-store, no-cache, must-revalidate",
      );
    }
    return res;
  };

  const { searchParams } = new URL(request.url);
  const { page, limit } = parsePaginationParams(searchParams, 10, 50);
  const offset = (page - 1) * limit;

  // Parse and validate location params
  const latParam = searchParams.get("lat");
  const lonParam = searchParams.get("lon");
  const radiusParam = searchParams.get("radius_miles");
  const lat = latParam ? parseFloat(latParam) : null;
  const lon = lonParam ? parseFloat(lonParam) : null;
  const rawRadius = radiusParam ? parseFloat(radiusParam) : 30;
  const radiusMiles = Math.min(Math.max(rawRadius, 1), 100);

  if (lat != null && (isNaN(lat) || lat < -90 || lat > 90)) {
    return NextResponse.json({ error: "lat must be between -90 and 90" }, { status: 400 });
  }
  if (lon != null && (isNaN(lon) || lon < -180 || lon > 180)) {
    return NextResponse.json({ error: "lon must be between -180 and 180" }, { status: 400 });
  }

  // Parse filter params
  const beachId = searchParams.get("beach_id");
  const dateFrom = searchParams.get("date_from");
  const dateTo = searchParams.get("date_to");
  const feedType = searchParams.get("feed_type");
  const quality = (searchParams.get("quality") ?? "informative").toLowerCase();

  if (!["informative", "strong", "all"].includes(quality)) {
    return NextResponse.json(
      { error: "quality must be one of informative, strong, or all" },
      { status: 400 },
    );
  }

  // `user` is resolved by withAuth({ optional: true }) — non-null when the
  // caller provided a valid Bearer token (native) or cookie session (web).

  // Block filter: exclude sessions authored by users the caller has blocked.
  // RLS on user_blocks scopes results to blocker_id = auth.uid(). Fail CLOSED
  // (throw) instead of falling through to no-filter — silently exposing blocked
  // content because of a transient query error would defeat the moderation
  // contract Play Store relies on.
  let blockedAuthorIds: string[] = [];
  if (user) {
    const { data: blocks, error: blocksError } = await supabase
      .from("user_blocks")
      .select("blocked_id")
      .eq("blocker_id", user.id);
    if (blocksError) throw blocksError;
    blockedAuthorIds = (blocks ?? []).map((b) => b.blocked_id as string);
  }

  // Friends feed: restrict to sessions from users the caller follows. Returns
  // empty when unauthenticated or when the caller follows nobody.
  let friendIds: string[] | null = null;
  if (feedType === "friends") {
    if (!user) {
      const meta = createPaginationMeta(page, limit, 0);
      return finalize(await createPaginatedResponse([], meta, CacheDuration.SHORT));
    }
    const { data: follows } = await supabase
      .from("user_follows")
      .select("following_id")
      .eq("follower_id", user.id);
    friendIds = (follows ?? []).map((f) => f.following_id as string);
    if (friendIds.length === 0) {
      const meta = createPaginationMeta(page, limit, 0);
      return finalize(await createPaginatedResponse([], meta, CacheDuration.SHORT));
    }
  }

  // If location provided, get beach IDs within radius first
  let nearbyBeachIds: string[] | null = null;
  if (lat != null && lon != null && !isNaN(lat) && !isNaN(lon)) {
    const latRange = radiusMiles / 69;
    const lonRange = radiusMiles / (69 * Math.cos((lat * Math.PI) / 180));

    const { data: nearbyBeaches, error: nearbyError } = await supabase
      .from("beaches")
      .select("id")
      .gte("lat", lat - latRange)
      .lte("lat", lat + latRange)
      .gte("lon", lon - lonRange)
      .lte("lon", lon + lonRange);

    if (nearbyError) throw nearbyError;

    nearbyBeachIds = nearbyBeaches?.map((b) => b.id) ?? [];
    if (nearbyBeachIds.length === 0) {
      const meta = createPaginationMeta(page, limit, 0);
      return finalize(await createPaginatedResponse([], meta, CacheDuration.SHORT));
    }
  }

  const applyFeedFilters = (query: any): any => {
    let filteredQuery = query;

    if (nearbyBeachIds) {
      filteredQuery = filteredQuery.in("beach_id", nearbyBeachIds);
    }
    if (beachId) {
      filteredQuery = filteredQuery.eq("beach_id", beachId);
    }
    if (dateFrom) {
      filteredQuery = filteredQuery.gte("arrival_time", dateFrom);
    }
    if (dateTo) {
      filteredQuery = filteredQuery.lt("arrival_time", dateTo);
    }
    if (friendIds) {
      filteredQuery = filteredQuery.in("user_id", friendIds);
    }
    if (blockedAuthorIds.length > 0) {
      filteredQuery = filteredQuery.not(
        "user_id",
        "in",
        `(${blockedAuthorIds.join(",")})`,
      );
    }
    if (quality === "informative") {
      filteredQuery = filteredQuery.eq("informative", true);
    }
    if (quality === "strong") {
      filteredQuery = filteredQuery.eq("strong", true);
    }

    return filteredQuery;
  };

  let countQuery = (supabase as any)
    .from("public_session_feed_eligibility")
    .select("session_id", { count: "exact", head: true });
  countQuery = applyFeedFilters(countQuery);

  const { count } = await countQuery;

  let eligibilityQuery = (supabase as any)
    .from("public_session_feed_eligibility")
    .select(
      `
        session_id,
        user_id,
        beach_id,
        arrival_time,
        created_at,
        has_context,
        has_media,
        thin,
        warning,
        informative,
        strong
      `,
    );
  eligibilityQuery = applyFeedFilters(eligibilityQuery);

  const { data: eligibilityRows, error: eligibilityError } = await eligibilityQuery
    .order("created_at", { ascending: false })
    .order("session_id", { ascending: false })
    .range(offset, offset + limit - 1);

  if (eligibilityError) {
    console.error("Error fetching public session eligibility:", eligibilityError);
    throw eligibilityError;
  }

  const eligibilityBySessionId = new Map(
    ((eligibilityRows as any[]) ?? []).map((row) => [row.session_id, row]),
  );
  const sessionIds = Array.from(eligibilityBySessionId.keys());

  if (sessionIds.length === 0) {
    const meta = createPaginationMeta(page, limit, count || 0);
    return finalize(await createPaginatedResponse([], meta, CacheDuration.SHORT));
  }

  const { data: sessions, error } = await (supabase as any)
    .from("sessions")
    .select(
      `
        id,
        user_id,
        beach_name,
        beach_id,
        arrival_time,
        wave_quality,
        wave_height_ft,
        wave_characteristics,
        tide_height_ft,
        tide_status,
        tide_rate_ft_per_hr,
        rip_current_observed,
        rip_current_risk,
        notes,
        description,
        image_url,
        likes_count,
        created_at,
        duration_minutes,
        crowd_level,
        water_temp,
        rating,
        beaches!sessions_beach_id_fkey (
          name
        ),
        profiles!sessions_user_id_profiles_fkey (
          id,
          full_name,
          avatar_url
        ),
        session_media!session_media_session_id_fkey (
          id,
          public_url,
          media_type,
          caption,
          deleted_at
        )
      `
    )
    .in("id", sessionIds)
    .eq("status", "completed")
    .eq("is_public", true)
    .is("deleted_at", null);

  if (error) {
    console.error("Error fetching public sessions:", error);
    throw error;
  }

  // Batch-fetch like status for the authenticated user
  let likedSessionIds = new Set<string>();
  const orderedSessions =
    sessions?.slice().sort((a: any, b: any) => {
      return sessionIds.indexOf(a.id) - sessionIds.indexOf(b.id);
    }) ?? [];

  if (user && orderedSessions.length) {
    const { data: likes } = await supabase
      .from("session_likes")
      .select("session_id")
      .eq("user_id", user.id)
      .in("session_id", sessionIds);

    if (likes) {
      likedSessionIds = new Set(likes.map((l) => l.session_id));
    }
  }

  // Transform the data for frontend consumption
  const publicSessions =
    orderedSessions.map((session: any) => {
      const eligibility = eligibilityBySessionId.get(session.id) as any;

      return {
        id: session.id,
        userId: session.user_id,
        beachName: session.beach_name || (session.beaches as any)?.name || null,
        beachId: session.beach_id,
        arrivalTime: session.arrival_time,
        waveQuality: session.wave_quality,
        waveHeight: session.wave_height_ft,
        waveCharacteristics: session.wave_characteristics ?? null,
        tideHeightFt: session.tide_height_ft ?? null,
        tideStatus: session.tide_status ?? null,
        tideRateFtPerHr: session.tide_rate_ft_per_hr ?? null,
        ripCurrentObserved: session.rip_current_observed ?? null,
        ripCurrentRisk: session.rip_current_risk ?? null,
        notes: session.notes,
        description: session.description,
        title: session.description || session.notes || null,
        imageUrl: session.image_url,
        likesCount: session.likes_count || 0,
        likedByMe: likedSessionIds.has(session.id),
        createdAt: session.created_at,
        durationMinutes: session.duration_minutes,
        crowdLevel: session.crowd_level,
        waterTemp: session.water_temp,
        rating: session.rating ?? null,
        displayName: (session.profiles as any)?.full_name || "Surfer",
        avatarUrl: (session.profiles as any)?.avatar_url || null,
        author: {
          id: (session.profiles as any)?.id || null,
        },
        quality: {
          hasContext: Boolean(eligibility?.has_context),
          hasMedia: Boolean(eligibility?.has_media),
          thin: Boolean(eligibility?.thin),
          warning: Boolean(eligibility?.warning),
          informative: Boolean(eligibility?.informative),
          strong: Boolean(eligibility?.strong),
        },
        media: ((session.session_media as any[]) || [])
          .filter((m) => !m.deleted_at)
          .map((m) => ({
            id: m.id,
            url: m.public_url,
            type: m.media_type,
            caption: m.caption,
          })),
      };
    }) || [];

  const meta = createPaginationMeta(page, limit, count || 0);

  // Cache for 2 minutes (public content, updated frequently) for anonymous
  // callers; overridden to `private, no-store` by `finalize` when the request
  // is authenticated so per-user `likedByMe` data isn't shared.
  return finalize(
    await createPaginatedResponse(publicSessions, meta, CacheDuration.SHORT),
  );
}

// Apply rate limiting + optional auth. withAuth({ optional: true }) resolves
// the caller from Bearer token (native) or cookie session (web), or leaves
// user=null for unauth access — matching the public nature of this feed.
// No bot blocking — consumed by mobile apps.
export const GET = withRateLimit(
  withAuth(publicSessionsHandler, {
    optional: true,
    errorMessage: "Failed to fetch public sessions",
  }),
  "public-default"
);
