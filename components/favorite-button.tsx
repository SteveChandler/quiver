"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Heart, Loader2 } from "lucide-react";
import { getFavoriteBeaches } from "@/actions/beach-actions";
import { useAuth } from "@/context/auth-context";
import { toast } from "@/components/ui/use-toast";
import type { Beach } from "@/types/database";
import { useDataFetcher } from "@/hooks/use-data-fetcher";

interface FavoriteButtonProps {
  beachId: string;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
}

export function FavoriteButton({
  beachId,
  variant = "ghost",
  size = "sm",
}: FavoriteButtonProps) {
  const { user } = useAuth();
  const [isFavorite, setIsFavorite] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  // Use standard data fetching pattern for background read
  const fetchFavorites = useCallback(async () => {
    if (!user) return [] as Beach[];
    const result = await getFavoriteBeaches(user.id);
    if (result.success) {
      return (result.data || []) as Beach[];
    }
    // Quietly degrade on background read; avoid noisy toasts
    console.error("FavoriteButton: failed to fetch favorites:", result.error);
    return [] as Beach[];
  }, [user]);

  const { data: favorites, loading: favLoading } = useDataFetcher(
    fetchFavorites,
    {
      immediate: true,
      initialData: [] as Beach[],
    }
  );

  useEffect(() => {
    setIsFavorite(
      (favorites || []).some((beach: Beach) => beach.id === beachId)
    );
    setLoading(favLoading);
  }, [favorites, favLoading, beachId]);

  const toggleFavorite = async () => {
    if (!user) {
      toast({
        title: "Sign in required",
        description: "Please sign in to favorite beaches.",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    try {
      // Optimistically flip UI for better responsiveness
      const next = !isFavorite;
      setIsFavorite(next);

      // Call API route to avoid RSC re-render failures in production
      const res = await fetch(
        `/api/beaches/${beachId}/favorite/toggle`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
        }
      );

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "Failed to update favorites");
      }

      const body = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        action?: "added" | "removed";
        error?: string;
      };

      if (!body?.success) {
        throw new Error(body?.error || "Failed to update favorites");
      }

      toast({
        title: body.action === "removed" ? "Beach removed" : "Beach added",
        description:
          body.action === "removed"
            ? "Beach removed from favorites."
            : "Beach added to favorites.",
      });
    } catch (error) {
      console.error("Error toggling favorite:", error);
      // Revert optimistic update on error
      setIsFavorite((prev) => !prev);
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to update favorites.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading) {
    return (
      <Button variant={variant} size={size} disabled>
        <Loader2 className="h-4 w-4 animate-spin" />
      </Button>
    );
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={toggleFavorite}
      disabled={isProcessing}
      aria-pressed={isFavorite}
      aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
    >
      {isProcessing ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Heart
          className={`h-4 w-4 ${isFavorite ? "fill-red-500 text-red-500" : ""}`}
        />
      )}
    </Button>
  );
}
