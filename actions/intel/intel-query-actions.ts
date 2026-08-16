"use server";

import {
  createSupabaseServerClient,
  createSupabaseServiceRoleClient,
} from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/action-utils";
import type {
  GetNearbyIntelPostsParams,
} from "@/types/intel";
import type {
  IntelPostTag,
  IntelPostWithUser,
} from "@/types/database";
import type { IntelPostsData, IntelPostRPCResult } from "./intel-types";
import { GLOBAL_INTEL_FALLBACK } from "./intel-types";

interface ConditionReportRow {
  id: string;
  session_id: string | null;
  wave_size_range: string | null;
  vibe: string | null;
}

/**
 * Get nearby intel posts (authenticated)
 */
export async function getNearbyIntelPosts(
  params: GetNearbyIntelPostsParams
): Promise<ActionResult<IntelPostsData>> {
  try {
    const supabase = await createSupabaseServiceRoleClient();

    // Use the session-aware client to resolve the authenticated user.
    // The service-role client bypasses RLS and has no session context, so
    // calling getUser() on it would always return null.
    const serverClient = await createSupabaseServerClient();
    const {
      data: { user },
    } = await serverClient.auth.getUser();

    const { lat, lon, radius = 5, tag, limit = 50 } = params;

    // Use the database function for geo-query (preferred)
    let intelPosts: IntelPostRPCResult[] | null = null;
    const { data: rpcPosts, error: intelError } = await supabase.rpc(
      "get_nearby_intel_posts",
      {
        center_lat: lat,
        center_lng: lon,
        radius_miles: radius,
        tag_filter: tag === "all" ? undefined : tag,
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

    const conditionPostIds = intelPosts
      .filter((post) => post.tag === "conditions")
      .map((post) => post.id);
    const conditionLookup = conditionPostIds.length
      ? await (supabase.from("intel_posts") as any)
          .select("id, session_id, wave_size_range, vibe")
          .in("id", conditionPostIds)
      : { data: [] as ConditionReportRow[], error: null };
    const conditionRows = (conditionLookup.data ?? []) as ConditionReportRow[];
    const conditionRowsError = conditionLookup.error;
    if (conditionRowsError) {
      console.warn("Conditions linkage lookup failed in getNearbyIntelPosts", conditionRowsError);
    }
    const conditionMap = new Map((conditionRows ?? []).map((row) => [row.id, row]));
    const sessionIds = (conditionRows ?? [])
      .map((row) => row.session_id)
      .filter((id): id is string => Boolean(id));
    const { data: approvedVideos, error: approvedVideosError } = sessionIds.length
      ? await supabase
          .from("session_media")
          .select("id, session_id")
          .in("session_id", sessionIds)
          .eq("media_type", "video")
          .eq("moderation_status", "approved")
          .is("deleted_at", null)
      : { data: [], error: null };
    if (approvedVideosError) {
      console.warn("Approved report video lookup failed in getNearbyIntelPosts", approvedVideosError);
    }
    const approvedVideoMap = new Map(
      (approvedVideos ?? []).map((video) => [video.session_id, video.id]),
    );

    const enrichedPosts: IntelPostWithUser[] = intelPosts.map((post: IntelPostRPCResult) => {
      const profile = profilesMap.get(post.user_id);
      const condition = conditionMap.get(post.id);
      return {
        ...post,
        dedupe_hash: null,
        emoji_rating: null,
        photo_storage_path: null,
        report_count: 0,
        vibe: condition?.vibe ?? post.vibe ?? null,
        wave_size_range: condition?.wave_size_range ?? post.wave_size_range ?? null,
        session_id: condition?.session_id ?? null,
        video_media_id: condition?.session_id ? approvedVideoMap.get(condition.session_id) ?? null : null,
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
        tag_filter: tag === "all" ? undefined : tag,
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

    const conditionPostIds = intelPosts
      .filter((post) => post.tag === "conditions")
      .map((post) => post.id);
    const conditionLookup = conditionPostIds.length
      ? await (supabase.from("intel_posts") as any)
          .select("id, session_id, wave_size_range, vibe")
          .in("id", conditionPostIds)
      : { data: [] as ConditionReportRow[], error: null };
    const conditionRows = (conditionLookup.data ?? []) as ConditionReportRow[];
    const conditionRowsError = conditionLookup.error;
    if (conditionRowsError) {
      console.warn("Conditions linkage lookup failed in getPublicIntelPosts", conditionRowsError);
    }
    const conditionMap = new Map((conditionRows ?? []).map((row) => [row.id, row]));
    const sessionIds = (conditionRows ?? [])
      .map((row) => row.session_id)
      .filter((id): id is string => Boolean(id));
    const { data: approvedVideos, error: approvedVideosError } = sessionIds.length
      ? await supabase
          .from("session_media")
          .select("id, session_id")
          .in("session_id", sessionIds)
          .eq("media_type", "video")
          .eq("moderation_status", "approved")
          .is("deleted_at", null)
      : { data: [], error: null };
    if (approvedVideosError) {
      console.warn("Approved report video lookup failed in getPublicIntelPosts", approvedVideosError);
    }
    const approvedVideoMap = new Map(
      (approvedVideos ?? []).map((video) => [video.session_id, video.id]),
    );

    const enrichedPosts: IntelPostWithUser[] = intelPosts.map((post: IntelPostRPCResult) => {
      const profile = profilesMap.get(post.user_id);
      const condition = conditionMap.get(post.id);
      return {
        ...post,
        dedupe_hash: null,
        emoji_rating: null,
        photo_storage_path: null,
        report_count: 0,
        vibe: condition?.vibe ?? post.vibe ?? null,
        wave_size_range: condition?.wave_size_range ?? post.wave_size_range ?? null,
        session_id: condition?.session_id ?? null,
        video_media_id: condition?.session_id ? approvedVideoMap.get(condition.session_id) ?? null : null,
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
