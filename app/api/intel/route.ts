import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { INTEL_CONFIG } from "@/lib/constants/intel";
import type { IntelPostTag, IntelPostWithUser } from "@/types/database";
import {
  createIntelDedupeHash,
  DEFAULT_INTEL_DEDUPE_WINDOW_MINUTES,
} from "@/lib/utils/intel-dedupe";
import { parseAndValidateJson } from "@/lib/validation/middleware";
import { IntelPostCreateSchema } from "@/lib/validation/schemas";
import { normalizeCoordinates } from "@/lib/types/coordinates";
import {
  createSuccessResponse,
  createValidationError,
  validateOrError,
  withBotBlockingAndRateLimit,
  withAuth,
  type AuthenticatedContext,
  type OptionalAuthContext,
} from "@/lib/middleware/api-wrappers";

export const dynamic = "force-dynamic";

/**
 * Intel Posts API
 *
 * GET /api/intel - Get nearby intel posts with filtering
 * POST /api/intel - Create a new intel post
 */

interface GetIntelPostsParams {
  lat: number;
  lon: number;
  radius?: number;
  tag?: IntelPostTag | "all";
  limit?: number;
}

interface CreateIntelPostData {
  lat: number;
  lon: number;
  tag: IntelPostTag;
  title: string;
  description: string;
  photo_url?: string;
  photo_storage_path?: string;
  // Surf condition fields
  wave_height?: number | null;
  wind_speed?: number | null;
  wind_direction?: string | null;
  water_temp?: number | null;
  crowd_level?: number | null;
  wave_types?: string[];
  forecast_accuracy?: "accurate" | "somewhat" | "inaccurate" | null;
}

function isMissingPostgisGeographyError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const maybeError = error as { code?: unknown; message?: unknown };
  return (
    maybeError.code === "42704" &&
    typeof maybeError.message === "string" &&
    maybeError.message.includes("public.geography")
  );
}

function isTransientSupabaseUpstreamError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const maybeError = error as { message?: unknown };
  return (
    typeof maybeError.message === "string" &&
    maybeError.message.includes(
      "An invalid response was received from the upstream server"
    )
  );
}

function createEmptyIntelPostsResponse(params: GetIntelPostsParams): NextResponse {
  return createSuccessResponse({
    posts: [],
    total: 0,
    filters: {
      latitude: params.lat,
      longitude: params.lon,
      radius: params.radius ?? INTEL_CONFIG.DEFAULT_RADIUS_MILES,
      tag: params.tag || "all",
      limit: params.limit ?? INTEL_CONFIG.DEFAULT_LIMIT,
    },
  });
}

/**
 * GET /api/intel
 * Returns nearby intel posts with user data and confirmation status
 * Query params: lat/lon (preferred), lat/lng (legacy), radius (miles), tag, limit
 *
 * Authentication: Optional. Anonymous callers still get the posts; the
 * `user_confirmed` flag is only populated for authenticated viewers.
 */
const intelGetHandler = withAuth(
  async (
    request: NextRequest,
    { user, supabase }: OptionalAuthContext
  ): Promise<NextResponse> => {
    const { searchParams } = new URL(request.url);

    const coords = normalizeCoordinates(
      {
        lat: searchParams.get("lat"),
        lon: searchParams.get("lon"),
        lng: searchParams.get("lng"),
        latitude: searchParams.get("latitude"),
        longitude: searchParams.get("longitude"),
      },
      { context: "GET /api/intel" }
    );
    const radius = parseFloat(
      searchParams.get("radius") || INTEL_CONFIG.DEFAULT_RADIUS_MILES.toString()
    );
    const tag = searchParams.get("tag") as IntelPostTag | "all" | null;
    const limit = Math.min(
      parseInt(
        searchParams.get("limit") || INTEL_CONFIG.DEFAULT_LIMIT.toString()
      ),
      INTEL_CONFIG.MAX_LIMIT
    );

    // Validate required parameters
    if (!coords) {
      return createValidationError("Latitude and longitude are required", {
        required: ["lat", "lon"],
        accepted_legacy: ["lng", "latitude", "longitude"],
      });
    }

    // Validate radius
    if (radius > INTEL_CONFIG.MAX_RADIUS_MILES) {
      return createValidationError(
        `Radius cannot exceed ${INTEL_CONFIG.MAX_RADIUS_MILES} miles`,
        {
          providedRadiusMiles: radius,
          maxRadiusMiles: INTEL_CONFIG.MAX_RADIUS_MILES,
        }
      );
    }

    const currentUserId = user?.id;

    // Use the database function for geo-query
    const { data: intelPosts, error: intelError } = await supabase.rpc(
      "get_nearby_intel_posts",
      {
        center_lat: coords.lat,
        center_lng: coords.lon,
        radius_miles: radius,
        tag_filter: (tag === "all" || tag == null) ? undefined : tag,
        limit_count: limit,
      }
    );

    if (intelError) {
      if (
        isMissingPostgisGeographyError(intelError) ||
        isTransientSupabaseUpstreamError(intelError)
      ) {
        console.warn(
          "Intel geospatial lookup unavailable; returning empty posts",
          intelError
        );
        return createEmptyIntelPostsResponse({
          lat: coords.lat,
          lon: coords.lon,
          radius,
          tag: tag || "all",
          limit,
        });
      }

      console.error("Error fetching intel posts:", intelError);
      throw intelError;
    }

    if (!intelPosts || intelPosts.length === 0) {
      return createEmptyIntelPostsResponse({
        lat: coords.lat,
        lon: coords.lon,
        radius,
        tag: tag || "all",
        limit,
      });
    }

    // Get user details for posts
    const userIds = [...new Set(intelPosts.map((post: any) => post.user_id))];
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      // is_system_account is required by the feed to label automated posts as system
      // cards rather than rendering them with a personal avatar. Without it the flag
      // is undefined at runtime and every system card silently renders as a person.
      .select("id, full_name, avatar_url, is_system_account")
      .in("id", userIds);

    // If profile lookup fails (RLS or other), continue with fallback names from RPC
    if (profilesError) {
      console.warn("Profiles lookup failed; continuing with fallback usernames from RPC", profilesError);
    }

    // Get user confirmations if authenticated
    let userConfirmations: any[] = [];
    if (currentUserId) {
      const postIds = intelPosts.map((post: any) => post.id);
      const { data: confirmations, error: confirmationsError } = await supabase
        .from("intel_post_confirmations")
        .select("intel_post_id")
        .eq("user_id", currentUserId)
        .in("intel_post_id", postIds);

      if (!confirmationsError && confirmations) {
        userConfirmations = confirmations;
      }
    }

    // Combine data
    const profilesMap = new Map<
      string,
      { id: string; full_name: string | null; avatar_url: string | null; is_system_account: boolean | null }
    >(
      profiles?.map(
        (p: {
          id: string;
          full_name: string | null;
          avatar_url: string | null;
          is_system_account: boolean | null;
        }) => [p.id, p]
      ) || []
    );
    const confirmationsSet = new Set(
      userConfirmations.map((c) => c.intel_post_id)
    );

    const enrichedPosts: IntelPostWithUser[] = intelPosts.map((post: any) => {
      const profile = profilesMap.get(post.user_id);
      return {
        ...post,
        user: {
          id: post.user_id,
          full_name: profile?.full_name || (post as any).user_name || "Anonymous",
          avatar_url: profile?.avatar_url || null,
          is_system_account: profile?.is_system_account ?? null,
        },
        user_confirmed: confirmationsSet.has(post.id),
      };
    });

    return createSuccessResponse({
      posts: enrichedPosts,
      total: enrichedPosts.length,
      filters: {
        latitude: coords.lat,
        longitude: coords.lon,
        radius,
        tag: tag || "all",
        limit,
      },
    });
  },
  { optional: true, errorMessage: "Failed to fetch intel posts" }
);

// Compose: bot blocking + rate limit → optional-auth handler.
export const GET = withBotBlockingAndRateLimit(
  intelGetHandler,
  "public-default"
);

/**
 * POST /api/intel
 * Creates a new intel post (requires authentication)
 */
export const POST = withAuth(
  async (request: NextRequest, { user, supabase }: AuthenticatedContext) => {
    // Validate Content-Type and parse JSON
    const parseResult = await parseAndValidateJson(request);
    if ('error' in parseResult) {
      return parseResult.error;
    }

    // Validate against schema
    const validationResult = validateOrError(IntelPostCreateSchema, parseResult.data);
    if ('error' in validationResult) {
      return validationResult.error;
    }

    const {
      latitude,
      longitude,
      tag,
      title,
      description,
      emoji_rating,
      photo_url,
      photo_storage_path,
      wave_height,
      wind_speed,
      wind_direction,
      water_temp,
      crowd_level,
      wave_types,
      forecast_accuracy,
    } = validationResult.data;

    // Data is already trimmed and validated by schema
    const sanitizedTitle = title;
    const sanitizedDescription = description;

    // Calculate expiry date based on tag
    const expiryDate = new Date();
    const fastExpiryTags: IntelPostTag[] = ["conditions", "crowd"];
    const expiryDays = fastExpiryTags.includes(tag) ? 1 : 7;
    expiryDate.setDate(expiryDate.getDate() + expiryDays);

    // Normalize surf condition fields into JSONB
    const surfConditions: Record<string, any> = {};
    if (wave_height !== undefined && wave_height !== null)
      surfConditions.wave_height = wave_height;
    if (wind_speed !== undefined && wind_speed !== null)
      surfConditions.wind_speed = wind_speed;
    if (wind_direction !== undefined && wind_direction !== null)
      surfConditions.wind_direction = wind_direction;
    if (water_temp !== undefined && water_temp !== null)
      surfConditions.water_temp = water_temp;
    if (crowd_level !== undefined && crowd_level !== null)
      surfConditions.crowd_level = crowd_level;
    if (wave_types && Array.isArray(wave_types) && wave_types.length > 0)
      surfConditions.wave_types = wave_types;
    if (forecast_accuracy !== undefined && forecast_accuracy !== null)
      surfConditions.forecast_accuracy = forecast_accuracy;

    // Determine write client: allow dev E2E mutations for mock users via service role
    let writeClient = supabase;
    try {
      if (
        process.env.NODE_ENV !== "production" &&
        (process.env.ALLOW_E2E_MUTATIONS_DEV === "1" ||
          (process.env.ALLOW_E2E_MUTATIONS_DEV || "").toLowerCase() === "true")
      ) {
        const { data: me } = await supabase
          .from("profiles")
          .select("is_mock")
          .eq("id", user.id)
          .single();
        if (me?.is_mock === true) {
          writeClient = createSupabaseServiceRoleClient();
        }
      }
    } catch {}

    const dedupeHash = createIntelDedupeHash({
      userId: user.id,
      tag,
      beachId: null,
      title: sanitizedTitle,
      description: sanitizedDescription,
      latitude,
      longitude,
    });

    const dedupeWindowStart = new Date(
      Date.now() - DEFAULT_INTEL_DEDUPE_WINDOW_MINUTES * 60 * 1000
    ).toISOString();

    const { data: recentIntel, error: dedupeError } = await writeClient
      .from("intel_posts")
      .select(
        "id, title, description, latitude, longitude, beach_id, created_at"
      )
      .eq("user_id", user.id)
      .eq("tag", tag)
      .gte("created_at", dedupeWindowStart)
      .order("created_at", { ascending: false })
      .limit(5);

    if (dedupeError) {
      console.error("Failed to check for duplicate intel posts:", dedupeError);
    } else {
      const duplicateMatch = recentIntel?.find((existing: any) => {
        const existingHash = createIntelDedupeHash({
          userId: user.id,
          tag,
          beachId: existing.beach_id ?? null,
          title: existing.title,
          description: existing.description,
          latitude: existing.latitude,
          longitude: existing.longitude,
        });
        return existingHash === dedupeHash;
      });

      if (duplicateMatch) {
        return createValidationError(
          "Looks like you've already shared this intel recently. Please update the existing post instead of creating a duplicate.",
          { dedupe_window_minutes: DEFAULT_INTEL_DEDUPE_WINDOW_MINUTES },
          409
        );
      }
    }

    // Create intel post
    const { data: intelPost, error: createError } = await writeClient
      .from("intel_posts")
      .insert({
        user_id: user.id,
        latitude,
        longitude,
        tag,
        title: sanitizedTitle,
        description: sanitizedDescription,
        emoji_rating,
        photo_url,
        photo_storage_path,
        expires_at: expiryDate.toISOString(),
        dedupe_hash: dedupeHash,
        surf_conditions: Object.keys(surfConditions).length
          ? surfConditions
          : null,
      })
      .select()
      .single();

    if (createError) {
      console.error("Error creating intel post:", createError);
      throw createError;
    }

    // Get user profile for response
    const { data: profile } = await writeClient
      .from("profiles")
      .select("id, full_name, avatar_url")
      .eq("id", user.id)
      .single();

    const enrichedPost: IntelPostWithUser = {
      ...intelPost,
      vibe: null,
      wave_size_range: null,
      user: {
        full_name: profile?.full_name || "Anonymous",
        avatar_url: profile?.avatar_url || null,
      },
      user_has_confirmed: false,
    };

    return createSuccessResponse(enrichedPost);
  },
  { errorMessage: "Failed to create intel post" }
);
