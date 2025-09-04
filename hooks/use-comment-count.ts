"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { data as gateway } from "@/lib/data/client";

export function useCommentCount(sessionId: string) {
  const [commentCount, setCommentCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Don't proceed if sessionId is empty
    if (!sessionId) {
      setCommentCount(0);
      setIsLoading(false);
      return;
    }

    const supabase = createClient();

    // Fetch initial comment count via gateway
    const fetchCommentCount = async () => {
      try {
        setIsLoading(true);
        const comments = await gateway.sessions.comments.listTopLevel(sessionId);
        setCommentCount(Array.isArray(comments) ? comments.length : 0);
      } catch (error) {
        console.error("Error fetching comment count:", error);
        setCommentCount(0);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCommentCount();

    // Subscribe to comment changes
    const channel = supabase
      .channel(`comment_count_${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "comments",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          setCommentCount((prev) => prev + 1);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "comments",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          setCommentCount((prev) => Math.max(0, prev - 1));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId]);

  return { commentCount, isLoading };
}
