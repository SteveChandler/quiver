"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { data as gateway } from "@/lib/data/client";
import { useAuth } from "@/context/auth-context";
import { track } from "@/lib/analytics";

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
  initialFollowingCount = 0,
  onFollowersCountChange?: (newCount: number) => void
): UseUserFollowReturn {
  const { user } = useAuth();
  const currentUserId = user?.id;
  const [following, setFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(initialFollowersCount);
  const [followingCount, setFollowingCount] = useState(initialFollowingCount);
  const [isLoading, setIsLoading] = useState(true);
  const [isToggling, setIsToggling] = useState(false);

  // Stabilize initial counts to prevent refetching when parent re-renders with new values
  const initialFollowersRef = useRef(initialFollowersCount);
  const initialFollowingRef = useRef(initialFollowingCount);

  // Keep callback stable across renders without retriggering effects
  const followersCountChangeRef = useRef<
    ((newCount: number) => void) | undefined
  >(onFollowersCountChange);
  useEffect(() => {
    followersCountChangeRef.current = onFollowersCountChange;
  }, [onFollowersCountChange]);

  useEffect(() => {
    // Don't proceed if userId is empty or is the current user
    if (!userId || userId === currentUserId) {
      setFollowing(false);
      setFollowersCount(initialFollowersRef.current);
      setFollowingCount(initialFollowingRef.current);
      setIsLoading(false);
      return;
    }

    const supabase = createClient();

    // Fetch initial follow status and counts via gateway
    const fetchFollowStatus = async () => {
      try {
        setIsLoading(true);
        const res = await gateway.users.follow.getStatusAndCounts(userId);
        const newFollowersCount = res.followersCount || 0;
        setFollowersCount(newFollowersCount);
        setFollowingCount(res.followingCount || 0);
        setFollowing(res.following);

        // Notify parent component of initial follower count
        try {
          followersCountChangeRef.current?.(newFollowersCount);
        } catch (error) {
          console.error("Error in onFollowersCountChange callback:", error);
        }
      } catch (error) {
        console.error("Error fetching follow status:", error);
        setFollowing(false);
        setFollowersCount(initialFollowersRef.current);
        setFollowingCount(initialFollowingRef.current);
      } finally {
        setIsLoading(false);
      }
    };

    // Ensure initial counts are set for this userId before fetch
    setFollowersCount(initialFollowersRef.current);
    setFollowingCount(initialFollowingRef.current);

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
        (payload: any) => {
          setFollowersCount((prev) => {
            const newCount = prev + 1;
            // Notify parent component of follower count change
            try {
              followersCountChangeRef.current?.(newCount);
            } catch (error) {
              console.error("Error in onFollowersCountChange callback:", error);
            }
            return newCount;
          });
          // If this is the current user's follow, update their following status
          if (currentUserId && payload.new.follower_id === currentUserId) {
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
        (payload: any) => {
          setFollowersCount((prev) => {
            const newCount = Math.max(0, prev - 1);
            // Notify parent component of follower count change
            try {
              followersCountChangeRef.current?.(newCount);
            } catch (error) {
              console.error("Error in onFollowersCountChange callback:", error);
            }
            return newCount;
          });
          // If this is the current user's follow being removed, update their following status
          if (currentUserId && payload.old.follower_id === currentUserId) {
            setFollowing(false);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // Note: initialFollowersRef and initialFollowingRef are stable refs,
    // so we don't need them in deps. This prevents refetching when parent
    // re-renders with different initial values.
  }, [currentUserId, userId]);

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
      const result = await gateway.users.follow.toggle(userId);

      if (!result.success) {
        console.error("Failed to toggle follow:", result.error);
        return;
      }

      const isFollowAction =
        typeof result.data?.following === "boolean"
          ? result.data.following
          : Boolean(result.data && "followId" in result.data);

      if (isFollowAction) {
        setFollowing(true);
        setFollowersCount((prev) => {
          const newCount = prev + 1;
          // Notify parent component of optimistic follower count change
          if (onFollowersCountChange) {
            try {
              onFollowersCountChange(newCount);
            } catch (error) {
              console.error("Error in onFollowersCountChange callback:", error);
            }
          }
          return newCount;
        });
      } else {
        setFollowing(false);
        setFollowersCount((prev) => {
          const newCount = Math.max(0, prev - 1);
          // Notify parent component of optimistic follower count change
          if (onFollowersCountChange) {
            try {
              onFollowersCountChange(newCount);
            } catch (error) {
              console.error("Error in onFollowersCountChange callback:", error);
            }
          }
          return newCount;
        });
      }

      // Track social follow event
      const action = isFollowAction ? 'follow' : 'unfollow';
      track(`user_${action}`, { target_user_id: userId });
      fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventType: "social_follow",
          metadata: { target_user_id: userId, action },
        }),
        keepalive: true,
      }).catch(() => {});
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
