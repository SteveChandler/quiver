"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
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

/**
 * Create a new intel post
 */
import type { XPAction } from "@/lib/gamification-actions";
import { withAuthenticatedAction } from "@/lib/server-action-utils";

type TrackXPFn = (
  action: XPAction,
  relatedEntityId?: string,
  relatedEntityType?: "session" | "board" | "intel_post" | "review" | "invite" | "photo"
) => Promise<any>;

interface IntelDeps {
  trackXP?: TrackXPFn;
}

export async function createIntelPost(
  data: CreateIntelPostData,
  deps?: IntelDeps
): Promise<ActionResult> {
  try {
    return await withAuthenticatedAction(async (user) => {
      const supabase = await createSupabaseServerClient();

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
      } = data;

      if (
        !latitude ||
        !longitude ||
        !tag ||
        !title?.trim() ||
        !description?.trim()
      ) {
        return {
          success: false,
          error:
            "Missing required fields: latitude, longitude, tag, title, description",
        };
      }

      const expiryDate = getExpiryDate(tag);

      const { data: intelPost, error: createError } = await supabase
        .from("intel_posts")
        .insert({
          user_id: user.id,
          latitude,
          longitude,
          tag,
          title: title.trim(),
          description: description.trim(),
          photo_url,
          photo_storage_path,
          expires_at: expiryDate.toISOString(),
          wave_height,
          wind_speed,
          wind_direction,
          water_temp,
          crowd_level,
          wave_types,
          forecast_accuracy,
        })
        .select()
        .single();

      if (createError) {
        console.error("Error creating intel post:", createError);
        return { success: false, error: "Failed to create intel post" };
      }

      const { data: profile } = await supabase
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
        user_has_confirmed: false,
      };

      revalidatePath("/");

      try {
        const track = deps?.trackXP
          ? deps.trackXP
          : (await import("@/lib/gamification-actions")).trackXP;
        await track("post_beach_intel", intelPost.id, "intel_post");
      } catch (xpErr) {
        console.warn("XP tracking failed for intel post:", xpErr);
      }

      return {
        success: true,
        data: enrichedPost,
      } as ActionResult;
    });
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
): Promise<ActionResult> {
  try {
    const supabase = await createSupabaseServiceRoleClient();

    // Try to get authenticated user, but don't fail if missing (treat as public)
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { latitude, longitude, radius = 5, tag, limit = 50 } = params;

    // Use the database function for geo-query (preferred)
    let intelPosts: any[] | null = null;
    const { data: rpcPosts, error: intelError } = await supabase.rpc(
      "get_nearby_intel_posts",
      {
        center_lat: latitude,
        center_lng: longitude,
        radius_miles: radius,
        tag_filter: tag === "all" ? null : tag,
        limit_count: limit,
      }
    );

    if (!intelError && rpcPosts) {
      intelPosts = rpcPosts as any[];
    } else {
      // Graceful fallback: fetch recent active posts and filter by distance in app
      console.warn("RPC get_nearby_intel_posts failed; falling back to direct select", {
        code: (intelError as any)?.code,
        message: (intelError as any)?.message,
      });

      const { data: fallback, error: fallbackError } = await supabase
        .from("intel_posts")
        .select(
          `id, user_id, beach_id, latitude, longitude, tag, title, description, photo_url, confirmations_count, is_active, surf_conditions, expires_at, created_at, updated_at`
        )
        .eq("is_active", true)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(Math.max(limit, 50));

      if (fallbackError) {
        console.error("Fallback intel_posts select failed:", fallbackError);
        return {
          success: true,
          data: { posts: [], total: 0, filters: { latitude, longitude, radius, tag: tag || "all", limit } },
        };
      }

      // Simple distance filter (Haversine) to approximate radius locally
      const toRad = (n: number) => (n * Math.PI) / 180;
      const haversineMiles = (lat1: number, lon1: number, lat2: number, lon2: number) => {
        const R = 3958.7613; // miles
        const dLat = toRad(lat2 - lat1);
        const dLon = toRad(lon2 - lon1);
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
      };

      intelPosts = (fallback || []).filter((p: any) => {
        if (!latitude || !longitude || !p?.latitude || !p?.longitude) return true;
        try {
          const dist = haversineMiles(Number(latitude), Number(longitude), Number(p.latitude), Number(p.longitude));
          return dist <= (radius || 25);
        } catch {
          return true;
        }
      }).slice(0, limit);
    }

    if (!intelPosts || intelPosts.length === 0) {
      return {
        success: true,
        data: {
          posts: [],
          total: 0,
          filters: { latitude, longitude, radius, tag: tag || "all", limit },
        },
      };
    }

    // Get user details for posts
    const userIds = [...new Set(intelPosts.map((post: any) => post.user_id))];
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url")
      .in("id", userIds);
    // If profile lookup fails (RLS, etc.), continue with RPC fallback names
    if (profilesError) {
      console.warn("Profiles lookup failed in getNearbyIntelPosts; using RPC fallback usernames", profilesError);
    }

    // Get user confirmations when a user is present
    let confirmations: any[] | null = null;
    if (user) {
      const postIds = intelPosts.map((post: any) => post.id);
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

    const enrichedPosts: IntelPostWithUser[] = intelPosts.map((post: any) => {
      const profile = profilesMap.get(post.user_id);
      return {
        ...post,
        user: {
          full_name: profile?.full_name || (post as any).user_name || "Anonymous",
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
        filters: { latitude, longitude, radius, tag: tag || "all", limit },
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
): Promise<ActionResult> {
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
): Promise<ActionResult> {
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
): Promise<ActionResult> {
  try {
    const supabase = await createSupabaseServerClient();

    const { latitude, longitude, radius = 5, tag, limit = 50 } = params;

    // Use the database function for geo-query (preferred)
    let intelPosts: any[] | null = null;
    const { data: rpcPosts, error: intelError } = await supabase.rpc(
      "get_nearby_intel_posts",
      {
        center_lat: latitude,
        center_lng: longitude,
        radius_miles: radius,
        tag_filter: tag === "all" ? null : tag,
        limit_count: limit,
      }
    );

    if (!intelError && rpcPosts) {
      intelPosts = rpcPosts as any[];
    } else {
      // Graceful fallback: fetch recent active posts and filter by distance in app
      console.warn("RPC get_nearby_intel_posts failed (public); falling back to direct select", {
        code: (intelError as any)?.code,
        message: (intelError as any)?.message,
      });

      const { data: fallback, error: fallbackError } = await supabase
        .from("intel_posts")
        .select(
          `id, user_id, beach_id, latitude, longitude, tag, title, description, photo_url, confirmations_count, is_active, surf_conditions, expires_at, created_at, updated_at`
        )
        .eq("is_active", true)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(Math.max(limit, 50));

      if (fallbackError) {
        console.error("Public fallback intel_posts select failed:", fallbackError);
        return {
          success: true,
          data: { posts: [], total: 0, filters: { latitude, longitude, radius, tag: tag || "all", limit } },
        };
      }

      const toRad = (n: number) => (n * Math.PI) / 180;
      const haversineMiles = (lat1: number, lon1: number, lat2: number, lon2: number) => {
        const R = 3958.7613;
        const dLat = toRad(lat2 - lat1);
        const dLon = toRad(lon2 - lon1);
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
      };

      intelPosts = (fallback || []).filter((p: any) => {
        if (!latitude || !longitude || !p?.latitude || !p?.longitude) return true;
        try {
          const dist = haversineMiles(Number(latitude), Number(longitude), Number(p.latitude), Number(p.longitude));
          return dist <= (radius || 25);
        } catch {
          return true;
        }
      }).slice(0, limit);
    }

    if (!intelPosts || intelPosts.length === 0) {
      return {
        success: true,
        data: {
          posts: [],
          total: 0,
          filters: { latitude, longitude, radius, tag: tag || "all", limit },
        },
      };
    }

    // Get user details for posts
    const userIds = [...new Set(intelPosts.map((post: any) => post.user_id))];
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url")
      .in("id", userIds);
    if (profilesError) {
      console.warn("Profiles lookup failed in getPublicIntelPosts; using RPC fallback usernames", profilesError);
    }

    // Combine data (no user confirmations for public access)
    const profilesMap = new Map(profiles?.map((p) => [p.id, p]) || []);

    const enrichedPosts: IntelPostWithUser[] = intelPosts.map((post: any) => {
      const profile = profilesMap.get(post.user_id);
      return {
        ...post,
        user: {
          full_name: profile?.full_name || (post as any).user_name || "Anonymous",
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
        filters: { latitude, longitude, radius, tag: tag || "all", limit },
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
): Promise<ActionResult> {
  try {
    const supabase = await createSupabaseServerClient();

    // Get authenticated user (optional for this function)
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { tag, limit = 50 } = params;

    let query = supabase
      .from("intel_posts")
      .select(
        `
        id,
        user_id,
        latitude,
        longitude,
        tag,
        title,
        description,
        photo_url,
        photo_storage_path,
        confirmations_count,
        is_active,
        expires_at,
        created_at,
        updated_at
      `
      )
      .eq("is_active", true)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(limit);

    // Apply tag filter if specified
    if (tag && tag !== "all") {
      query = query.eq("tag", tag);
    }

    const { data: intelPosts, error: intelError } = await query;

    if (intelError) {
      console.error("Error fetching all intel posts:", intelError);
      return {
        success: false,
        error: "Failed to fetch intel posts",
      };
    }

    if (!intelPosts || intelPosts.length === 0) {
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
    const { data: profiles, error: profilesError } = await supabase
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
    let userConfirmations: any[] = [];
    if (user) {
      const postIds = intelPosts.map((post) => post.id);
      const { data: confirmations, error: confirmationsError } = await supabase
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
