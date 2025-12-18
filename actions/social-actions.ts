"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { withAuthenticatedAction } from "@/lib/server-action-utils";
import { revalidatePath } from "next/cache";
import type { Profile } from "@/types/database";

/**
 * Follow a user
 */
export async function followUser(followingId: string) {
  return withAuthenticatedAction(async (user, supabase) => {
    // Prevent self-follow
    if (user.id === followingId) {
      throw new Error("Cannot follow yourself");
    }

    // Check if already following
    const { data: existingFollow } = await supabase
      .from("user_follows")
      .select("id")
      .eq("follower_id", user.id)
      .eq("following_id", followingId)
      .single();

    if (existingFollow) {
      throw new Error("Already following this user");
    }

    // Check if the target user exists
    const { data: targetUser, error: userError } = await supabase
      .from("profiles")
      .select("id, full_name")
      .eq("id", followingId)
      .single();

    if (userError || !targetUser) {
      throw new Error("User not found");
    }

    // Create the follow relationship
    const { data: follow, error } = await supabase
      .from("user_follows")
      .insert({
        follower_id: user.id,
        following_id: followingId,
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    // Revalidate relevant pages
    revalidatePath("/profile");
    revalidatePath(`/profile/${followingId}`);

    return {
      success: true,
      data: {
        followId: follow.id,
        message: `Now following ${targetUser.full_name}`,
      },
    };
  });
}

/**
 * Unfollow a user
 */
export async function unfollowUser(followingId: string) {
  return withAuthenticatedAction(async (user, supabase) => {
    // Find and delete the follow relationship
    const { data: follow, error: selectError } = await supabase
      .from("user_follows")
      .select("id")
      .eq("follower_id", user.id)
      .eq("following_id", followingId)
      .single();

    if (selectError || !follow) {
      throw new Error("Follow relationship not found");
    }

    const { error: deleteError } = await supabase
      .from("user_follows")
      .delete()
      .eq("id", follow.id);

    if (deleteError) {
      throw deleteError;
    }

    // Get target user name for success message
    const { data: targetUser } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", followingId)
      .single();

    // Revalidate relevant pages
    revalidatePath("/profile");
    revalidatePath(`/profile/${followingId}`);

    return {
      success: true,
      data: {
        message: `Unfollowed ${targetUser?.full_name || "user"}`,
      },
    };
  });
}

/**
 * Get users that the current user is following
 */
export async function getUserFollowing(userId?: string, limit: number = 50) {
  return withAuthenticatedAction(async (user, supabase) => {
    const targetUserId = userId || user.id;

    const { data: following, error } = await supabase
      .from("user_follows")
      .select(
        `
        id,
        created_at,
        following:profiles!user_follows_following_id_fkey(
          id,
          full_name,
          avatar_url,
          email
        )
      `
      )
      .eq("follower_id", targetUserId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      throw error;
    }

    const followingList = (following || [])
      .map((f: any) => f.following)
      .filter(Boolean);

    return followingList;
  });
}

/**
 * Get users that are following the current user
 */
export async function getUserFollowers(userId?: string, limit: number = 50) {
  return withAuthenticatedAction(async (user, supabase) => {
    const targetUserId = userId || user.id;

    const { data: followers, error } = await supabase
      .from("user_follows")
      .select(
        `
        id,
        created_at,
        follower:profiles!user_follows_follower_id_fkey(
          id,
          full_name,
          avatar_url,
          email
        )
      `
      )
      .eq("following_id", targetUserId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      throw error;
    }

    const followersList = (followers || [])
      .map((f: any) => f.follower)
      .filter(Boolean);

    return followersList;
  });
}

/**
 * Check if current user is following another user
 */
export async function isFollowing(followingId: string) {
  return withAuthenticatedAction(async (user, supabase) => {
    const { data: follow, error } = await supabase
      .from("user_follows")
      .select("id")
      .eq("follower_id", user.id)
      .eq("following_id", followingId)
      .single();

    if (error && error.code !== "PGRST116") {
      // PGRST116 = no rows returned (not following)
      throw error;
    }

    return {
      success: true,
      data: !!follow,
    };
  });
}

/**
 * Toggle follow status for a user (follow if not following, unfollow if following)
 */
export async function toggleUserFollow(userId: string) {
  return withAuthenticatedAction(async (user, supabase) => {
    // Check if already following
    const { data: existingFollow } = await supabase
      .from("user_follows")
      .select("id")
      .eq("follower_id", user.id)
      .eq("following_id", userId)
      .single();

    if (existingFollow) {
      // Already following - unfollow
      return unfollowUser(userId);
    } else {
      // Not following - follow
      return followUser(userId);
    }
  });
}

/**
 * Get suggested users to follow (mutual friends, popular users, etc.)
 */
export async function getSuggestedUsers(limit: number = 10) {
  return withAuthenticatedAction(async (user, supabase) => {
    // Get users the current user is NOT already following
    const { data: alreadyFollowing } = await supabase
      .from("user_follows")
      .select("following_id")
      .eq("follower_id", user.id);

    const followingIds = (alreadyFollowing || []).map((f) => f.following_id);
    followingIds.push(user.id); // Exclude self

    // Find users with the most followers who aren't already followed
    const { data: suggested, error } = await supabase
      .from("profiles")
      .select("id, full_name, followers_count")
      .not("id", "in", `(${followingIds.join(",")})`)
      .gt("followers_count", 0)
      .order("followers_count", { ascending: false })
      .limit(limit);

    if (error) {
      throw error;
    }

    return {
      success: true,
      data: suggested || [],
    };
  });
}
