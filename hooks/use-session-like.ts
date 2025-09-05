"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { data as gateway } from "@/lib/data/client";
import { useAuth } from "@/context/auth-context";

interface UseSessionLikeReturn {
  liked: boolean;
  likesCount: number;
  isLoading: boolean;
  toggleLike: () => Promise<void>;
  isToggling: boolean;
}

export function useSessionLike(
  sessionId: string,
  initialLikesCount = 0
): UseSessionLikeReturn {
  const { user } = useAuth();
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(initialLikesCount);
  const [isLoading, setIsLoading] = useState(true);
  const [isToggling, setIsToggling] = useState(false);

  useEffect(() => {
    // Don't proceed if sessionId is empty
    if (!sessionId) {
      setLiked(false);
      setLikesCount(initialLikesCount);
      setIsLoading(false);
      return;
    }

    const supabase = createClient();

    // Fetch initial like status and count via gateway
    const fetchLikeStatus = async () => {
      try {
        setIsLoading(true);
        const status = await gateway.sessions.likes.getStatus(sessionId);
        setLikesCount(status.likesCount);
        setLiked(status.liked);
      } catch (error) {
        console.error("Error fetching like status:", error);
        setLiked(false);
        setLikesCount(initialLikesCount);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLikeStatus();

    // Subscribe to like changes
    const channel = supabase
      .channel(`session_likes_${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "session_likes",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          setLikesCount((prev) => prev + 1);
          // If this is the current user's like, update their liked status
          if (user && payload.new.user_id === user.id) {
            setLiked(true);
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "session_likes",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          setLikesCount((prev) => Math.max(0, prev - 1));
          // If this is the current user's like being removed, update their liked status
          if (user && payload.old.user_id === user.id) {
            setLiked(false);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId, user, initialLikesCount]);

  const toggleLike = async () => {
    if (!user) {
      console.warn("User must be authenticated to like sessions");
      return;
    }

    if (isToggling) {
      return; // Prevent multiple simultaneous toggles
    }

    setIsToggling(true);

    try {
      const result = await gateway.sessions.likes.toggle(sessionId);

      if (!result.success) {
        console.error("Failed to toggle like:", result.error);
        return;
      }

      // Optimistically update the UI
      // The real-time subscription will also update these values,
      // but optimistic updates provide better UX
      if (result.liked) {
        setLiked(true);
        setLikesCount((prev) => prev + 1);
      } else {
        setLiked(false);
        setLikesCount((prev) => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error("Error toggling like:", error);
    } finally {
      setIsToggling(false);
    }
  };

  return {
    liked,
    likesCount,
    isLoading,
    toggleLike,
    isToggling,
  };
}
