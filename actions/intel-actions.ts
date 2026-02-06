"use server";

import { revalidatePath } from "next/cache";
import {
  createSupabaseServerClient,
  createSupabaseServiceRoleClient,
} from "@/lib/supabase/server";
import { getExpiryDate } from "@/lib/constants/intel";
import { creditAuthorWithXP } from "@/lib/gamification-actions";
import type { ActionResult } from "@/lib/action-utils";
import type {
  CreateIntelPostData,
  GetNearbyIntelPostsParams,
} from "@/types/intel";
import type {
  IntelPostTag,
  IntelPostWithUser,
  IntelPost,
} from "@/types/database";
import type { XPTrackingResult } from "@/lib/gamification/types";

// Result types for intel actions
interface IntelPostsData {
  posts: IntelPostWithUser[];
  total: number;
  filters: {
    lat?: number;
    lon?: number;
    radius?: number;
    tag: string;
    limit: number;
  };
}

interface ConfirmationData {
  confirmed: boolean;
  confirmations_count: number;
  confirmation_id: string;
}

interface SupabaseErrorLike {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
}

interface IntelPostRPCResult {
  id: string;
  user_id: string;
  beach_id: string;
  latitude: number;
  longitude: number;
  tag: IntelPostTag;
  title: string;
  description: string;
  photo_url: string;
  is_active: boolean;
  expires_at: string;
  created_at: string;
  updated_at: string;
  confirmations_count: number;
  beach_name: string;
  distance_miles: number;
  user_name: string;
  surf_conditions: import("@/types/database.generated").Json | null;
}

/**
 * Create a new intel post
 */
import type { XPAction } from "@/lib/gamification-actions";
import {
  withAuthenticatedAction,
  type ServerActionResponse,
} from "@/lib/server-action-utils";
import {
  createIntelDedupeHash,
  DEFAULT_INTEL_DEDUPE_WINDOW_MINUTES,
} from "@/lib/utils/intel-dedupe";

type TrackXPFn = (
  action: XPAction,
  relatedEntityId?: string,
  relatedEntityType?: "session" | "board" | "intel_post" | "review" | "invite" | "photo"
) => Promise<XPTrackingResult>;

interface IntelDeps {
  trackXP?: TrackXPFn;
  authWrapper?: typeof withAuthenticatedAction;
}

const GLOBAL_INTEL_FALLBACK = {
  lat: 32.7507, // Ocean Beach, San Diego acts as seeded demo hub
  lon: -117.254,
  radius: 400,
};

const FEET_TO_METERS = 0.3048;
const MPH_TO_METERS_PER_SECOND = 0.44704;

const INTEL_FALLBACK_ERROR_CODES = new Set(["0A000", "42P01", "42501", "42703"]);

const WIND_DIRECTION_DEGREES: Record<string, number> = {
  N: 0,
  NE: 45,
  E: 90,
  SE: 135,
  S: 180,
  SW: 225,
  W: 270,
  NW: 315,
  OFFSHORE: 180,
  ONSHORE: 0,
  CROSS: 90,
};

const toMetricWaveHeight = (value?: number | null) => {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  return Number((value * FEET_TO_METERS).toFixed(3));
};

const toMetricWindSpeed = (value?: number | null) => {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  return Number((value * MPH_TO_METERS_PER_SECOND).toFixed(3));
};

const toMetricWaterTemp = (value?: number | null) => {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  return Number((((value - 32) * 5) / 9).toFixed(3));
};

const toWindDirectionDegreesFallback = (direction?: string | null) => {
  if (!direction) return null;
  const key = direction.toUpperCase();
  return WIND_DIRECTION_DEGREES[key] ?? null;
};

const parseNullableNumber = (value: unknown) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
};

const shouldFallbackToConditionReports = (error: SupabaseErrorLike | null): boolean => {
  if (!error) return false;
  const code = typeof error.code === "string" ? error.code : undefined;
  if (code && INTEL_FALLBACK_ERROR_CODES.has(code)) return true;

  const message = [error.message, error.details, error.hint]
    .filter(Boolean)
    .map((part) => String(part).toLowerCase())
    .join(" ");

  return (
    message.includes("condition_reports") ||
    message.includes("cannot insert into view") ||
    message.includes("intel_posts")
  );
};

export async function createIntelPost(
  data: CreateIntelPostData,
  deps?: IntelDeps
): Promise<ActionResult<IntelPostWithUser>> {
  try {
    const authWrapper = deps?.authWrapper ?? withAuthenticatedAction;

    const response = await authWrapper(async (user, supabase) => {
      const {
        lat,
        lon,
        beach_id,
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
      } = data;

      const sanitizedTitle = title?.trim() ?? "";
      const sanitizedDescription = description?.trim() ?? "";

      if (
        typeof lat !== "number" ||
        Number.isNaN(lat) ||
        typeof lon !== "number" ||
        Number.isNaN(lon) ||
        !tag ||
        sanitizedTitle.length === 0 ||
        sanitizedDescription.length === 0
      ) {
        return {
          success: false,
          error:
            "Missing required fields: lat, lon, tag, title, description",
        };
      }

      const expiryDate = getExpiryDate(tag);

      let normalizedBeachId = beach_id?.trim() || null;

      // Prefer explicit beach_id but fall back to nearest beach from geo lookup
      if (!normalizedBeachId) {
        const { data: nearbyBeaches, error: nearestError } = await supabase.rpc(
          "get_nearby_beaches",
          {
            input_lat: lat,
            input_lng: lon,
            limit_count: 1,
          }
        );

        if (nearestError) {
          console.error("Nearest beach lookup failed:", nearestError);
          return {
            success: false,
            error: "Unable to determine nearest beach for intel post",
          };
        }

        normalizedBeachId = nearbyBeaches?.[0]?.id ?? null;
      }

      if (!normalizedBeachId) {
        return {
          success: false,
          error: "Unable to determine a beach for this intel post",
        };
      }

      const dedupeWindowStart = new Date(
        Date.now() - DEFAULT_INTEL_DEDUPE_WINDOW_MINUTES * 60 * 1000
      ).toISOString();

      const dedupeHash = createIntelDedupeHash({
        userId: user.id,
        tag,
        beachId: normalizedBeachId,
        title: sanitizedTitle,
        description: sanitizedDescription,
        latitude: lat,
        longitude: lon,
      });

      const { data: recentIntel, error: recentIntelError } = await supabase
        .from("intel_posts")
        .select("id, title, description, lat, lon, created_at")
        .eq("user_id", user.id)
        .eq("tag", tag)
        .eq("beach_id", normalizedBeachId)
        .gte("created_at", dedupeWindowStart)
        .order("created_at", { ascending: false })
        .limit(5);

      if (recentIntelError) {
        console.error("Failed to check for duplicate intel posts:", {
          error: recentIntelError,
          userId: user.id,
          tag,
          beachId: normalizedBeachId,
        });
      } else {
        const duplicateMatch = recentIntel?.find((existing) => {
          const existingHash = createIntelDedupeHash({
            userId: user.id,
            tag,
            beachId: normalizedBeachId,
            title: existing.title,
            description: existing.description,
            latitude: existing.lat,
            longitude: existing.lon,
          });
          return existingHash === dedupeHash;
        });

        if (duplicateMatch) {
          console.warn("Blocked duplicate intel post submission", {
            userId: user.id,
            tag,
            beachId: normalizedBeachId,
            recentPostId: duplicateMatch.id,
            dedupeWindowMinutes: DEFAULT_INTEL_DEDUPE_WINDOW_MINUTES,
          });

          return {
            success: false,
            error:
              "Looks like you've already shared this intel recently. Try updating the existing post instead of creating a duplicate.",
          };
        }
      }

      // Normalize optional surf condition inputs into JSONB
      const surfConditions: Record<string, string | number | string[] | null> = {};
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

      const { data: intelPost, error: createError } = await supabase
        .from("intel_posts")
        .insert({
          user_id: user.id,
          beach_id: normalizedBeachId,
          latitude: lat,
          longitude: lon,
          tag,
          title: sanitizedTitle,
          description: sanitizedDescription,
          photo_url,
          photo_storage_path,
          expires_at: expiryDate.toISOString(),
          is_active: true,
          dedupe_hash: dedupeHash,
          surf_conditions: Object.keys(surfConditions).length
            ? surfConditions
            : null,
        })
        .select()
        .single();

      let createdIntelPost = intelPost;
      let intelError = createError;

      if (intelError && shouldFallbackToConditionReports(intelError)) {
        console.warn(
          "intel_posts insert failed, attempting condition_reports fallback",
          intelError
        );

        const conditionPayload = {
          beach_id: normalizedBeachId,
          reporter_id: user.id,
          reported_at: new Date().toISOString(),
          kind: "intel" as const,
          latitude: lat,
          longitude: lon,
          tag,
          title: sanitizedTitle,
          description: sanitizedDescription,
          photo_url,
          photo_storage_path,
          wave_height_m: toMetricWaveHeight(wave_height ?? null),
          wind_speed_ms: toMetricWindSpeed(wind_speed ?? null),
          wind_direction_deg: toWindDirectionDegreesFallback(wind_direction),
          water_temp_c: toMetricWaterTemp(water_temp ?? null),
          crowd_level: parseNullableNumber(crowd_level),
          forecast_accuracy: forecast_accuracy ?? null,
        };

        const { data: fallbackReport, error: fallbackError } = await supabase
          .from("condition_reports")
          .insert(conditionPayload)
          .select("id")
          .single();

        if (fallbackError || !fallbackReport?.id) {
          console.error(
            "Condition reports fallback insert failed:",
            fallbackError || intelError
          );
          return { success: false, error: "Failed to create intel post" };
        }

        const { data: fetchedIntel, error: fetchFallbackError } = await supabase
          .from("intel_posts")
          .select("*")
          .eq("id", fallbackReport.id)
          .single();

        if (fetchFallbackError || !fetchedIntel) {
          console.error(
            "Failed to load intel post after fallback insert:",
            fetchFallbackError
          );
          return { success: false, error: "Failed to create intel post" };
        }

        const { error: updateFallbackHashError } = await supabase
          .from("intel_posts")
          .update({ dedupe_hash: dedupeHash })
          .eq("id", fallbackReport.id);

        if (updateFallbackHashError) {
          console.error("Failed to persist dedupe hash after fallback insert:", {
            error: updateFallbackHashError,
            intelId: fallbackReport.id,
          });
        }

        createdIntelPost = fetchedIntel;
        intelError = null;
      }

      if (intelError || !createdIntelPost) {
        console.error("Error creating intel post:", intelError);
        return { success: false, error: "Failed to create intel post" };
      }

      if (!createdIntelPost?.beach_id) {
        console.error(
          "Intel post created without beach_id despite guard",
          createdIntelPost
        );
        return {
          success: false,
          error: "Intel post missing beach association",
        };
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .eq("id", user.id)
        .single();

      const enrichedPost: IntelPostWithUser = {
        ...createdIntelPost,
        user: {
          full_name: profile?.full_name || "Anonymous",
          avatar_url: profile?.avatar_url || null,
        },
        user_has_confirmed: false,
      };

      revalidatePath("/");

      try {
        const track = deps?.trackXP
          ? deps.trackXP
          : (await import("@/lib/gamification-actions")).trackXP;
        await track("post_beach_intel", createdIntelPost.id, "intel_post");
      } catch (xpErr) {
        console.warn("XP tracking failed for intel post:", xpErr);
      }

      return {
        success: true,
        data: enrichedPost,
      } as ActionResult<IntelPostWithUser>;
    });

    if (!response) {
      return {
        success: false,
        error: "Failed to create intel post",
      };
    }

    // Normalise the response to an ActionResult regardless of wrapper shape
    const looksLikeServerActionResult =
      typeof response === "object" &&
      response !== null &&
      "success" in response &&
      ("data" in response || "error" in response);

    if (!looksLikeServerActionResult) {
      return {
        success: false,
        error: "Unexpected response from intel post action",
      };
    }

    const serverResult = response as ActionResult<IntelPostWithUser> | (ServerActionResponse<ActionResult<IntelPostWithUser>>);

    if ("data" in serverResult && serverResult?.data && typeof serverResult.data === "object" && "success" in serverResult.data) {
      return serverResult.data as ActionResult<IntelPostWithUser>;
    }

    return serverResult as ActionResult<IntelPostWithUser>;
  } catch (error) {
    console.error("Error in createIntelPost:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to create intel post",
    };
  }
}

// Removed default export wrapper (unused)

/**
 * Get nearby intel posts (authenticated)
 */
export async function getNearbyIntelPosts(
  params: GetNearbyIntelPostsParams
): Promise<ActionResult<IntelPostsData>> {
  try {
    const supabase = await createSupabaseServiceRoleClient();

    // Try to get authenticated user, but don't fail if missing (treat as public)
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { lat, lon, radius = 5, tag, limit = 50 } = params;

    // Use the database function for geo-query (preferred)
    let intelPosts: IntelPostRPCResult[] | null = null;
    const { data: rpcPosts, error: intelError } = await supabase.rpc(
      "get_nearby_intel_posts",
      {
        center_lat: lat,
        center_lng: lon,
        radius_miles: radius,
        tag_filter: tag === "all" ? null : tag,
        limit_count: limit,
      }
    );

    if (!intelError && rpcPosts) {
      intelPosts = rpcPosts as IntelPostRPCResult[];
    } else {
      // CRITICAL ERROR: RPC function failed - this should not happen
      console.error("[CRITICAL] RPC get_nearby_intel_posts failed - returning empty results", {
        code: intelError?.code,
        message: intelError?.message,
        details: intelError?.details,
        hint: intelError?.hint,
        params: { lat, lon, radius, tag, limit },
        timestamp: new Date().toISOString(),
      });

      // DO NOT fall back to global posts - return empty results instead
      // The RPC function should always work if the database is healthy
      // If it fails, it indicates a serious issue that needs investigation
      return {
        success: true,
        data: {
          posts: [],
          total: 0,
          filters: { lat, lon, radius, tag: tag || "all", limit },
        },
        error: "Unable to fetch nearby intel posts. Please try again later.",
      };
    }

    if (!intelPosts || intelPosts.length === 0) {
      return {
        success: true,
        data: {
          posts: [],
          total: 0,
          filters: { lat, lon, radius, tag: tag || "all", limit },
        },
      };
    }

    // Get user details for posts
    const userIds = [...new Set(intelPosts.map((post: IntelPostRPCResult) => post.user_id))];
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url")
      .in("id", userIds);
    // If profile lookup fails (RLS, etc.), continue with RPC fallback names
    if (profilesError) {
      console.warn("Profiles lookup failed in getNearbyIntelPosts; using RPC fallback usernames", profilesError);
    }

    // Get user confirmations when a user is present
    let confirmations: { intel_post_id: string }[] | null = null;
    if (user) {
      const postIds = intelPosts.map((post: IntelPostRPCResult) => post.id);
      const { data: conf, error: confirmationsError } = await supabase
        .from("intel_post_confirmations")
        .select("intel_post_id")
        .eq("user_id", user.id)
        .in("intel_post_id", postIds);
      if (!confirmationsError) confirmations = conf || [];
    }

    // Combine data
    const profilesMap = new Map(profiles?.map((p) => [p.id, p]) || []);
    const confirmationsSet = new Set(
      (confirmations || []).map((c) => c.intel_post_id)
    );

    const enrichedPosts: IntelPostWithUser[] = intelPosts.map((post: IntelPostRPCResult) => {
      const profile = profilesMap.get(post.user_id);
      return {
        ...post,
        dedupe_hash: null,
        emoji_rating: null,
        photo_storage_path: null,
        report_count: 0,
        user: {
          full_name: profile?.full_name || post.user_name || "Anonymous",
          avatar_url: profile?.avatar_url || null,
        },
        user_has_confirmed: confirmationsSet.has(post.id),
      };
    });

    return {
      success: true,
      data: {
        posts: enrichedPosts,
        total: enrichedPosts.length,
        filters: { lat, lon, radius, tag: tag || "all", limit },
      },
    };
  } catch (error) {
    console.error("Error in getNearbyIntelPosts:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to fetch intel posts",
    };
  }
}

/**
 * Confirm an intel post
 */
export async function confirmIntelPost(
  intelPostId: string
): Promise<ActionResult<ConfirmationData>> {
  try {
    const supabase = await createSupabaseServerClient();

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return {
        success: false,
        error: "Authentication required",
      };
    }

    // Check if intel post exists and is active
    const { data: intelPost, error: postError } = await supabase
      .from("intel_posts")
      .select("id, user_id, is_active, expires_at")
      .eq("id", intelPostId)
      .single();

    if (postError || !intelPost) {
      return {
        success: false,
        error: "Intel post not found",
      };
    }

    if (!intelPost.is_active) {
      return {
        success: false,
        error: "Intel post is no longer active",
      };
    }

    // Check if post has expired
    if (intelPost.expires_at && new Date(intelPost.expires_at) < new Date()) {
      return {
        success: false,
        error: "Intel post has expired",
      };
    }

    // Prevent users from confirming their own posts
    if (intelPost.user_id === user.id) {
      return {
        success: false,
        error: "You cannot confirm your own intel post",
      };
    }

    // Check if user has already confirmed this post
    const { data: existingConfirmation, error: checkError } = await supabase
      .from("intel_post_confirmations")
      .select("id")
      .eq("intel_post_id", intelPostId)
      .eq("user_id", user.id)
      .single();

    if (checkError && checkError.code !== "PGRST116") {
      // PGRST116 = no rows found
      console.error("Error checking existing confirmation:", checkError);
      return {
        success: false,
        error: "Failed to check confirmation status",
      };
    }

    if (existingConfirmation) {
      return {
        success: false,
        error: "You have already confirmed this intel post",
      };
    }

    // Create confirmation
    const { data: confirmation, error: confirmError } = await supabase
      .from("intel_post_confirmations")
      .insert({
        intel_post_id: intelPostId,
        user_id: user.id,
      })
      .select()
      .single();

    if (confirmError) {
      console.error("Error creating confirmation:", confirmError);
      return {
        success: false,
        error: "Failed to confirm intel post",
      };
    }

    // Get updated confirmations count - add a small delay to ensure trigger has executed
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const { data: updatedPost, error: updateError } = await supabase
      .from("intel_posts")
      .select("confirmations_count")
      .eq("id", intelPostId)
      .single();

    if (updateError) {
      console.warn("Could not fetch updated confirmations count:", updateError);
    }

    // Credit the intel author with XP (async, don't block the response)
    if (intelPost.user_id) {
      creditAuthorWithXP(intelPost.user_id, 'intel_post', intelPostId).catch(err => 
        console.error("Failed to credit intel author XP:", err)
      );
    }

    // Revalidate the home page to refresh the intel feed
    revalidatePath("/");

    return {
      success: true,
      data: {
        confirmed: true,
        confirmations_count: updatedPost?.confirmations_count || 1, // Fallback to at least 1 since we just added a confirmation
        confirmation_id: confirmation.id,
      },
    };
  } catch (error) {
    console.error("Error in confirmIntelPost:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to confirm intel post",
    };
  }
}

/**
 * Remove confirmation from an intel post
 */
export async function removeIntelPostConfirmation(
  intelPostId: string
): Promise<ActionResult<ConfirmationData>> {
  try {
    const supabase = await createSupabaseServerClient();

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return {
        success: false,
        error: "Authentication required",
      };
    }

    // Check if intel post exists
    const { data: intelPost, error: postError } = await supabase
      .from("intel_posts")
      .select("id")
      .eq("id", intelPostId)
      .single();

    if (postError || !intelPost) {
      return {
        success: false,
        error: "Intel post not found",
      };
    }

    // Find and delete the user's confirmation
    const { data: deletedConfirmation, error: deleteError } = await supabase
      .from("intel_post_confirmations")
      .delete()
      .eq("intel_post_id", intelPostId)
      .eq("user_id", user.id)
      .select()
      .single();

    if (deleteError) {
      if (deleteError.code === "PGRST116") {
        // No rows found
        return {
          success: false,
          error: "You have not confirmed this intel post",
        };
      }
      console.error("Error deleting confirmation:", deleteError);
      return {
        success: false,
        error: "Failed to remove confirmation",
      };
    }

    // Get updated confirmations count - add a small delay to ensure trigger has executed
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const { data: updatedPost, error: updateError } = await supabase
      .from("intel_posts")
      .select("confirmations_count")
      .eq("id", intelPostId)
      .single();

    if (updateError) {
      console.warn("Could not fetch updated confirmations count:", updateError);
    }

    // Revalidate the home page to refresh the intel feed
    revalidatePath("/");

    return {
      success: true,
      data: {
        confirmed: false,
        confirmations_count: updatedPost?.confirmations_count || 0,
        confirmation_id: deletedConfirmation.id,
      },
    };
  } catch (error) {
    console.error("Error in removeIntelPostConfirmation:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to remove intel post confirmation",
    };
  }
}

// Removed deleteIntelPost (unused)

/**
 * Get intel posts for unauthenticated users (public read-only access)
 */
export async function getPublicIntelPosts(
  params: GetNearbyIntelPostsParams
): Promise<ActionResult<IntelPostsData>> {
  try {
    const supabase = await createSupabaseServerClient();

    const { lat, lon, radius = 5, tag, limit = 50 } = params;

    // Use the database function for geo-query (preferred)
    let intelPosts: IntelPostRPCResult[] | null = null;
    const { data: rpcPosts, error: intelError } = await supabase.rpc(
      "get_nearby_intel_posts",
      {
        center_lat: lat,
        center_lng: lon,
        radius_miles: radius,
        tag_filter: tag === "all" ? null : tag,
        limit_count: limit,
      }
    );

    if (!intelError && rpcPosts) {
      intelPosts = rpcPosts as IntelPostRPCResult[];
    } else {
      // CRITICAL ERROR: RPC function failed for public access - this should not happen
      console.error("[CRITICAL] RPC get_nearby_intel_posts failed (public) - returning empty results", {
        code: intelError?.code,
        message: intelError?.message,
        details: intelError?.details,
        hint: intelError?.hint,
        params: { lat, lon, radius, tag, limit },
        timestamp: new Date().toISOString(),
      });

      // DO NOT fall back to global posts - return empty results instead
      // The RPC function should always work if the database is healthy
      // If it fails, it indicates a serious issue that needs investigation
      return {
        success: true,
        data: {
          posts: [],
          total: 0,
          filters: { lat, lon, radius, tag: tag || "all", limit },
        },
        error: "Unable to fetch nearby intel posts. Please try again later.",
      };
    }

    if (!intelPosts || intelPosts.length === 0) {
      return {
        success: true,
        data: {
          posts: [],
          total: 0,
          filters: { lat, lon, radius, tag: tag || "all", limit },
        },
      };
    }

    // Get user details for posts
    const userIds = [...new Set(intelPosts.map((post: IntelPostRPCResult) => post.user_id))];
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url")
      .in("id", userIds);
    if (profilesError) {
      console.warn("Profiles lookup failed in getPublicIntelPosts; using RPC fallback usernames", profilesError);
    }

    // Combine data (no user confirmations for public access)
    const profilesMap = new Map(profiles?.map((p) => [p.id, p]) || []);

    const enrichedPosts: IntelPostWithUser[] = intelPosts.map((post: IntelPostRPCResult) => {
      const profile = profilesMap.get(post.user_id);
      return {
        ...post,
        dedupe_hash: null,
        emoji_rating: null,
        photo_storage_path: null,
        report_count: 0,
        user: {
          full_name: profile?.full_name || post.user_name || "Anonymous",
          avatar_url: profile?.avatar_url || null,
        },
        user_has_confirmed: false, // Public users can't confirm posts
      };
    });

    return {
      success: true,
      data: {
        posts: enrichedPosts,
        total: enrichedPosts.length,
        filters: { lat, lon, radius, tag: tag || "all", limit },
      },
    };
  } catch (error) {
    console.error("Error in getPublicIntelPosts:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to fetch intel posts",
    };
  }
}

/**
 * Get all intel posts without location filtering (for fallback/demo mode)
 */
export async function getAllIntelPosts(
  params: {
    tag?: IntelPostTag | "all";
    limit?: number;
  } = {}
): Promise<ActionResult<IntelPostsData>> {
  try {
    const [serviceClient, supabase] = await Promise.all([
      createSupabaseServiceRoleClient(),
      createSupabaseServerClient(),
    ]);

    // Get authenticated user (optional; used to hydrate confirmation state)
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { tag, limit = 50 } = params;

    let postsQuery = serviceClient
      .from("intel_posts")
      .select("*")
      .eq("is_active", true)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (tag && tag !== "all") {
      postsQuery = postsQuery.eq("tag", tag);
    }

    const { data: intelPosts, error: intelError } = await postsQuery;

    if (intelError) {
      console.error("Error fetching all intel posts:", intelError);
      return {
        success: false,
        error: "Failed to fetch intel posts",
      };
    }

    if (!intelPosts || intelPosts.length === 0) {
      const fallback = await getNearbyIntelPosts({
        lat: GLOBAL_INTEL_FALLBACK.lat,
        lon: GLOBAL_INTEL_FALLBACK.lon,
        radius: GLOBAL_INTEL_FALLBACK.radius,
        tag,
        limit,
      });

      if (fallback.success && fallback.data?.posts?.length) {
        return {
          success: true,
          data: {
            posts: fallback.data.posts,
            total: fallback.data.posts.length,
            filters: { tag: tag || "all", limit },
          },
        };
      }

      return {
        success: true,
        data: {
          posts: [],
          total: 0,
          filters: { tag: tag || "all", limit },
        },
      };
    }

    // Get user details for posts
    const userIds = [...new Set(intelPosts.map((post) => post.user_id))];
    const { data: profiles, error: profilesError } = await serviceClient
      .from("profiles")
      .select("id, full_name, avatar_url")
      .in("id", userIds);

    if (profilesError) {
      console.error("Error fetching profiles:", profilesError);
      return {
        success: false,
        error: "Failed to fetch user profiles",
      };
    }

    // Get user confirmations if authenticated
    let userConfirmations: { intel_post_id: string }[] = [];
    if (user) {
      const postIds = intelPosts.map((post) => post.id);
      const { data: confirmations, error: confirmationsError } =
        await serviceClient
          .from("intel_post_confirmations")
          .select("intel_post_id")
          .eq("user_id", user.id)
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

    const enrichedPosts: IntelPostWithUser[] = intelPosts.map((post) => {
      const profile = profilesMap.get(post.user_id);
      return {
        ...post,
        user: {
          full_name: profile?.full_name || "Anonymous",
          avatar_url: profile?.avatar_url || null,
        },
        user_has_confirmed: user ? confirmationsSet.has(post.id) : false,
      };
    });

    return {
      success: true,
      data: {
        posts: enrichedPosts,
        total: enrichedPosts.length,
        filters: { tag: tag || "all", limit },
      },
    };
  } catch (error) {
    console.error("Error in getAllIntelPosts:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to fetch intel posts",
    };
  }
}
