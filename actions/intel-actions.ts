"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { withAuthenticatedAction } from "@/lib/server-action-utils";
import { getExpiryDate } from "@/lib/constants/intel";
import type {
  IntelPostTag,
  IntelPostWithUser,
  IntelPost,
} from "@/types/database";

export interface ActionResult {
  success: boolean;
  data?: any;
  error?: string;
}

export interface CreateIntelPostData {
  latitude: number;
  longitude: number;
  tag: IntelPostTag;
  title: string;
  description: string;
  photo_url?: string;
  photo_storage_path?: string;
}

export interface GetNearbyIntelPostsParams {
  latitude: number;
  longitude: number;
  radius?: number;
  tag?: IntelPostTag | "all";
  limit?: number;
}

/**
 * Create a new intel post
 */
export const createIntelPost = withAuthenticatedAction(
  async (userId: string, data: CreateIntelPostData): Promise<ActionResult> => {
    try {
      const supabase = await createSupabaseServerClient();

      const {
        latitude,
        longitude,
        tag,
        title,
        description,
        photo_url,
        photo_storage_path,
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
          user_id: userId,
          latitude,
          longitude,
          tag,
          title: title.trim(),
          description: description.trim(),
          photo_url,
          photo_storage_path,
          expires_at: expiryDate.toISOString(),
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
        .eq("id", userId)
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
          error instanceof Error
            ? error.message
            : "Failed to create intel post",
      };
    }
  }
);

/**
 * Get nearby intel posts
 */
export const getNearbyIntelPosts = withAuthenticatedAction(
  async (
    userId: string,
    params: GetNearbyIntelPostsParams
  ): Promise<ActionResult> => {
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

      // Get user confirmations
      const postIds = intelPosts.map((post: any) => post.id);
      const { data: confirmations, error: confirmationsError } = await supabase
        .from("intel_post_confirmations")
        .select("intel_post_id")
        .eq("user_id", userId)
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
          error instanceof Error
            ? error.message
            : "Failed to fetch intel posts",
      };
    }
  }
);

/**
 * Confirm an intel post
 */
export const confirmIntelPost = withAuthenticatedAction(
  async (userId: string, intelPostId: string): Promise<ActionResult> => {
    try {
      const supabase = await createSupabaseServerClient();

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
      if (intelPost.user_id === userId) {
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
        .eq("user_id", userId)
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
          user_id: userId,
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
          error instanceof Error
            ? error.message
            : "Failed to confirm intel post",
      };
    }
  }
);

/**
 * Remove confirmation from an intel post
 */
export const removeIntelPostConfirmation = withAuthenticatedAction(
  async (userId: string, intelPostId: string): Promise<ActionResult> => {
    try {
      const supabase = await createSupabaseServerClient();

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
        .eq("user_id", userId)
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
);

/**
 * Delete an intel post (only by the owner)
 */
export const deleteIntelPost = withAuthenticatedAction(
  async (userId: string, intelPostId: string): Promise<ActionResult> => {
    try {
      const supabase = await createSupabaseServerClient();

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

      if (intelPost.user_id !== userId) {
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
        .eq("user_id", userId);

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
          error instanceof Error
            ? error.message
            : "Failed to delete intel post",
      };
    }
  }
);

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
      console.error("Error fetching public intel posts:", intelError);
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
        user_confirmed: false, // No confirmation status for unauthenticated users
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
