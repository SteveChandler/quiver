"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toggleUserFollow } from "@/actions/social-actions";
import { useAuth } from "@/context/auth-context";

interface UseUserFollowReturn {
  following: boolean;
  followersCount: number;
  followingCount: number;
  isLoading: boolean;
  toggleFollow: () => Promise<void>;
  isToggling: boolean;
}

export function useUserFollow(
  userId: string,
  initialFollowersCount = 0,
  initialFollowingCount = 0
): UseUserFollowReturn {
  const { user } = useAuth();
  const [following, setFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(initialFollowersCount);
  const [followingCount, setFollowingCount] = useState(initialFollowingCount);
  const [isLoading, setIsLoading] = useState(true);
  const [isToggling, setIsToggling] = useState(false);

  useEffect(() => {
    // Don't proceed if userId is empty or is the current user
    if (!userId || userId === user?.id) {
      setFollowing(false);
      setFollowersCount(initialFollowersCount);
      setFollowingCount(initialFollowingCount);
      setIsLoading(false);
      return;
    }

    const supabase = createClient();

    // Fetch initial follow status and counts
    const fetchFollowStatus = async () => {
      try {
        setIsLoading(true);

        // Get profile counts
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("followers_count, following_count")
          .eq("id", userId)
          .single();

        if (profileError) {
          console.error(
            "Error fetching profile counts for user",
            userId,
            ":",
            profileError
          );
        } else {
          setFollowersCount(profile.followers_count || 0);
          setFollowingCount(profile.following_count || 0);
        }

        // Get user's follow status if authenticated
        if (user) {
          const { data: userFollow, error: followError } = await supabase
            .from("user_follows")
            .select("id")
            .eq("follower_id", user.id)
            .eq("following_id", userId)
            .maybeSingle();

          if (followError && followError.code !== "PGRST116") {
            // PGRST116 is "no rows returned"
            console.error("Error fetching user follow status:", followError);
            throw followError;
          }

          setFollowing(!!userFollow);
        } else {
          setFollowing(false);
        }
      } catch (error) {
        console.error("Error fetching follow status:", error);
        setFollowing(false);
        setFollowersCount(initialFollowersCount);
        setFollowingCount(initialFollowingCount);
      } finally {
        setIsLoading(false);
      }
    };

    fetchFollowStatus();

    // Subscribe to follow changes for this user
    const channel = supabase
      .channel(`user_follows_${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "user_follows",
          filter: `following_id=eq.${userId}`,
        },
        (payload) => {
          setFollowersCount((prev) => prev + 1);
          // If this is the current user's follow, update their following status
          if (user && payload.new.follower_id === user.id) {
            setFollowing(true);
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "user_follows",
          filter: `following_id=eq.${userId}`,
        },
        (payload) => {
          setFollowersCount((prev) => Math.max(0, prev - 1));
          // If this is the current user's follow being removed, update their following status
          if (user && payload.old.follower_id === user.id) {
            setFollowing(false);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, user, initialFollowersCount, initialFollowingCount]);

  const toggleFollow = async () => {
    if (!user) {
      console.warn("User must be authenticated to follow others");
      return;
    }

    if (isToggling || userId === user.id) {
      return; // Prevent multiple simultaneous toggles or self-following
    }

    setIsToggling(true);

    try {
      const result = await toggleUserFollow(userId);

      if (!result.success) {
        console.error("Failed to toggle follow:", result.error);
        return;
      }

      // Optimistically update the UI
      // The real-time subscription will also update these values,
      // but optimistic updates provide better UX
      if (result.following) {
        setFollowing(true);
        setFollowersCount((prev) => prev + 1);
      } else {
        setFollowing(false);
        setFollowersCount((prev) => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error("Error toggling follow:", error);
    } finally {
      setIsToggling(false);
    }
  };

  return {
    following,
    followersCount,
    followingCount,
    isLoading,
    toggleFollow,
    isToggling,
  };
}
