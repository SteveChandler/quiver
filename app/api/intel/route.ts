import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { createSuccessResponse, handleApiError, validateOrError, createAuthError } from "@/lib/api-utils";
import { INTEL_CONFIG } from "@/lib/constants/intel";
import type { IntelPostTag, IntelPostWithUser } from "@/types/database";
import {
  createIntelDedupeHash,
  DEFAULT_INTEL_DEDUPE_WINDOW_MINUTES,
} from "@/lib/utils/intel-dedupe";
import { parseAndValidateJson } from "@/lib/validation/middleware";
import { IntelPostCreateSchema } from "@/lib/validation/schemas";
import { withBotBlockingAndRateLimit } from "@/lib/middleware/rate-limiter";

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

/**
 * GET /api/intel
 * Returns nearby intel posts with user data and confirmation status
 * Query params: lat, lng, radius (miles), tag, limit
 */
async function intelGetHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);

    const latitude = parseFloat(searchParams.get("lat") || "0");
    const longitude = parseFloat(searchParams.get("lng") || "0");
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
    if (!latitude || !longitude) {
      return NextResponse.json(
        { error: "Latitude and longitude are required" },
        { status: 400 }
      );
    }

    // Validate radius
    if (radius > INTEL_CONFIG.MAX_RADIUS_MILES) {
      return NextResponse.json(
        {
          error: `Radius cannot exceed ${INTEL_CONFIG.MAX_RADIUS_MILES} miles`,
        },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClient();

    // Get current user for confirmation status
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const currentUserId = user?.id;

    // Use the database function for geo-query
    const { data: intelPosts, error: intelError } = await supabase.rpc(
      "get_nearby_intel_posts",
      {
        center_lat: latitude,
        center_lng: longitude,
        radius_miles: radius,
        tag_filter: tag === "all" ? null : tag,
        limit_count: limit,
      }
    );

    if (intelError) {
      console.error("Error fetching intel posts:", intelError);
      return handleApiError(intelError, "Failed to fetch intel posts");
    }

    if (!intelPosts || intelPosts.length === 0) {
      return createSuccessResponse({
        posts: [],
        total: 0,
        filters: {
          latitude,
          longitude,
          radius,
          tag: tag || "all",
          limit,
        },
      });
    }

    // Get user details for posts
    const userIds = [...new Set(intelPosts.map((post: any) => post.user_id))];
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url")
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
    const profilesMap = new Map(profiles?.map((p) => [p.id, p]) || []);
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
        },
        user_confirmed: confirmationsSet.has(post.id),
      };
    });

    return createSuccessResponse({
      posts: enrichedPosts,
      total: enrichedPosts.length,
      filters: {
        latitude,
        longitude,
        radius,
        tag: tag || "all",
        limit,
      },
    });
  } catch (error) {
    console.error("Intel API GET error:", error);
    return handleApiError(error, "Failed to fetch intel posts");
  }
}

// Apply bot blocking and rate limiting to public GET endpoint
export const GET = withBotBlockingAndRateLimit(intelGetHandler, "public-default");

/**
 * POST /api/intel
 * Creates a new intel post (requires authentication)
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();

    // Check authentication
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return createAuthError();
    }

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
      const duplicateMatch = recentIntel?.find((existing) => {
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
        return NextResponse.json(
          {
            error:
              "Looks like you've already shared this intel recently. Please update the existing post instead of creating a duplicate.",
          },
          { status: 409 }
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
      return handleApiError(createError, "Failed to create intel post");
    }

    // Get user profile for response
    const { data: profile } = await writeClient
      .from("profiles")
      .select("id, full_name, avatar_url")
      .eq("id", user.id)
      .single();

    const enrichedPost: IntelPostWithUser = {
      ...intelPost,
      user: {
        full_name: profile?.full_name || "Anonymous",
        avatar_url: profile?.avatar_url || null,
      },
      user_confirmed: false,
    };

    return createSuccessResponse(enrichedPost);
  } catch (error) {
    console.error("Intel API POST error:", error);
    return handleApiError(error, "Failed to create intel post");
  }
}
