"use server";

import { withAuthenticatedAction } from "@/lib/server-action-utils";

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
