"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getExpiryDate } from "@/lib/constants/intel";
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
export async function createIntelPost(
  data: CreateIntelPostData
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

    // Validate required fields
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

    // Calculate expiry date based on tag
    const expiryDate = getExpiryDate(tag);

    // Create intel post
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
        // Surf condition fields
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
      return {
        success: false,
        error: "Failed to create intel post",
      };
    }

    // Get user profile for response
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
      user_confirmed: false,
    };

    // Revalidate the home page to refresh the intel feed
    revalidatePath("/");

    return {
      success: true,
      data: enrichedPost,
    };
  } catch (error) {
    console.error("Error in createIntelPost:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to create intel post",
    };
  }
}

/**
 * Get nearby intel posts (authenticated)
 */
export async function getNearbyIntelPosts(
  params: GetNearbyIntelPostsParams
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

    const { latitude, longitude, radius = 5, tag, limit = 50 } = params;

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
      console.error("Error fetching profiles:", profilesError);
      return {
        success: false,
        error: "Failed to fetch user profiles",
      };
    }

    // Get user confirmations
    const postIds = intelPosts.map((post: any) => post.id);
    const { data: confirmations, error: confirmationsError } = await supabase
      .from("intel_post_confirmations")
      .select("intel_post_id")
      .eq("user_id", user.id)
      .in("intel_post_id", postIds);

    // Combine data
    const profilesMap = new Map(profiles?.map((p) => [p.id, p]) || []);
    const confirmationsSet = new Set(
      confirmations?.map((c) => c.intel_post_id) || []
    );

    const enrichedPosts: IntelPostWithUser[] = intelPosts.map((post: any) => {
      const profile = profilesMap.get(post.user_id);
      return {
        ...post,
        user: {
          full_name: profile?.full_name || "Anonymous",
          avatar_url: profile?.avatar_url || null,
        },
        user_confirmed: confirmationsSet.has(post.id),
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

    // Get updated confirmations count
    const { data: updatedPost, error: updateError } = await supabase
      .from("intel_posts")
      .select("confirmations_count")
      .eq("id", intelPostId)
      .single();

    // Revalidate the home page to refresh the intel feed
    revalidatePath("/");

    return {
      success: true,
      data: {
        confirmed: true,
        confirmations_count: updatedPost?.confirmations_count || 0,
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

    // Get updated confirmations count
    const { data: updatedPost, error: updateError } = await supabase
      .from("intel_posts")
      .select("confirmations_count")
      .eq("id", intelPostId)
      .single();

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

/**
 * Delete an intel post (only by the owner)
 */
export async function deleteIntelPost(
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

    // Check if intel post exists and user is the owner
    const { data: intelPost, error: postError } = await supabase
      .from("intel_posts")
      .select("id, user_id")
      .eq("id", intelPostId)
      .single();

    if (postError || !intelPost) {
      return {
        success: false,
        error: "Intel post not found",
      };
    }

    if (intelPost.user_id !== user.id) {
      return {
        success: false,
        error: "You can only delete your own intel posts",
      };
    }

    // Soft delete by marking as inactive
    const { error: deleteError } = await supabase
      .from("intel_posts")
      .update({ is_active: false })
      .eq("id", intelPostId)
      .eq("user_id", user.id);

    if (deleteError) {
      console.error("Error deleting intel post:", deleteError);
      return {
        success: false,
        error: "Failed to delete intel post",
      };
    }

    // Revalidate the home page to refresh the intel feed
    revalidatePath("/");

    return {
      success: true,
      data: { deleted: true },
    };
  } catch (error) {
    console.error("Error in deleteIntelPost:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to delete intel post",
    };
  }
}

/**
 * Get intel posts for unauthenticated users (public read-only access)
 */
export async function getPublicIntelPosts(
  params: GetNearbyIntelPostsParams
): Promise<ActionResult> {
  try {
    const supabase = await createSupabaseServerClient();

    const { latitude, longitude, radius = 5, tag, limit = 50 } = params;

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
      console.error("Error fetching profiles:", profilesError);
      return {
        success: false,
        error: "Failed to fetch user profiles",
      };
    }

    // Combine data (no user confirmations for public access)
    const profilesMap = new Map(profiles?.map((p) => [p.id, p]) || []);

    const enrichedPosts: IntelPostWithUser[] = intelPosts.map((post: any) => {
      const profile = profilesMap.get(post.user_id);
      return {
        ...post,
        user: {
          full_name: profile?.full_name || "Anonymous",
          avatar_url: profile?.avatar_url || null,
        },
        user_confirmed: false, // Public users can't confirm posts
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
        user_confirmed: user ? confirmationsSet.has(post.id) : false,
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
