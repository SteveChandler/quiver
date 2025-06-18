"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function toggleUserFollow(userId: string) {
  const supabase = await createSupabaseServerClient();

  try {
    // Get the current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return {
        success: false,
        error: "Authentication required",
      };
    }

    // Prevent self-following
    if (user.id === userId) {
      return {
        success: false,
        error: "Cannot follow yourself",
      };
    }

    // Check if user is already following this person
    const { data: existingFollow, error: checkError } = await supabase
      .from("user_follows")
      .select("id")
      .eq("follower_id", user.id)
      .eq("following_id", userId)
      .maybeSingle();

    if (checkError) {
      throw checkError;
    }

    if (existingFollow) {
      // User is already following, so unfollow
      const { error: deleteError } = await supabase
        .from("user_follows")
        .delete()
        .eq("id", existingFollow.id);

      if (deleteError) {
        throw deleteError;
      }

      return {
        success: true,
        following: false,
        message: "Unfollowed user",
      };
    } else {
      // User is not following, so follow
      const { error: insertError } = await supabase
        .from("user_follows")
        .insert({
          follower_id: user.id,
          following_id: userId,
        });

      if (insertError) {
        throw insertError;
      }

      return {
        success: true,
        following: true,
        message: "Following user",
      };
    }
  } catch (error) {
    console.error("Error toggling user follow:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function getUserFollowStatus(userId: string) {
  const supabase = await createSupabaseServerClient();

  try {
    // Get the current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return {
        success: true,
        following: false,
        followersCount: 0,
        followingCount: 0,
      };
    }

    // Check if current user is following this person
    const { data: userFollow, error: followError } = await supabase
      .from("user_follows")
      .select("id")
      .eq("follower_id", user.id)
      .eq("following_id", userId)
      .maybeSingle();

    if (followError) {
      throw followError;
    }

    // Get the user's profile with counts
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("followers_count, following_count")
      .eq("id", userId)
      .single();

    if (profileError) {
      throw profileError;
    }

    return {
      success: true,
      following: !!userFollow,
      followersCount: profile.followers_count || 0,
      followingCount: profile.following_count || 0,
    };
  } catch (error) {
    console.error("Error getting user follow status:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function getUserFollowers(userId: string, limit = 50) {
  const supabase = await createSupabaseServerClient();

  try {
    const { data, error } = await supabase
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
      .eq("following_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      throw error;
    }

    return {
      success: true,
      data: data || [],
    };
  } catch (error) {
    console.error("Error getting user followers:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function getUserFollowing(userId: string, limit = 50) {
  const supabase = await createSupabaseServerClient();

  try {
    const { data, error } = await supabase
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
      .eq("follower_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      throw error;
    }

    return {
      success: true,
      data: data || [],
    };
  } catch (error) {
    console.error("Error getting user following:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
