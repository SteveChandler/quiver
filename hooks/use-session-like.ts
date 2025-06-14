"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toggleSessionLike } from "@/actions/like-actions";
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

    // Fetch initial like status and count
    const fetchLikeStatus = async () => {
      try {
        setIsLoading(true);

        // Get likes count
        const { count: totalLikes, error: countError } = await supabase
          .from("session_likes")
          .select("*", { count: "exact", head: true })
          .eq("session_id", sessionId);

        if (countError) {
          console.error(
            "Error fetching likes count for session",
            sessionId,
            ":",
            countError
          );
          throw countError;
        }

        setLikesCount(totalLikes || 0);

        // Get user's like status if authenticated
        if (user) {
          const { data: userLike, error: likeError } = await supabase
            .from("session_likes")
            .select("id")
            .eq("session_id", sessionId)
            .eq("user_id", user.id)
            .maybeSingle();

          if (likeError && likeError.code !== "PGRST116") {
            // PGRST116 is "no rows returned"
            console.error("Error fetching user like status:", likeError);
            throw likeError;
          }

          setLiked(!!userLike);
        } else {
          setLiked(false);
        }
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
      const result = await toggleSessionLike(sessionId);

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
