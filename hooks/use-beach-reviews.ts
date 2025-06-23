"use client";

import { useCallback, useState, useEffect } from "react";
import { useCachedApi } from "@/hooks/use-cached-api";
import {
  getBeachReviews,
  getUserReviewForBeach,
  getBeachReviewStats,
  createBeachReview,
  updateBeachReview,
  deleteBeachReview,
  getMultipleBeachReviewStats,
} from "@/actions/beach-review-actions";
import { RequestCache } from "@/lib/utils/request-cache";
import type { BeachReviewWithUser } from "@/types/database";

interface UseBeachReviewsOptions {
  userId?: string;
  immediate?: boolean;
}

interface ReviewStats {
  total_reviews: number;
  average_overall: number;
  average_wave_quality: number;
  average_crowd_density: number;
  average_parking: number;
  average_accessibility: number;
}

export function useBeachReviews(
  beachId: string,
  options: UseBeachReviewsOptions = {}
) {
  const { userId, immediate = true } = options;
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Fetch all reviews for the beach
  const fetchReviews = useCallback(async () => {
    const result = await getBeachReviews(beachId);
    if (result.success && result.data) {
      return result.data;
    }
    throw new Error(result.error || "Failed to fetch reviews");
  }, [beachId]);

  // Fetch user's review if authenticated
  const fetchUserReview = useCallback(async () => {
    if (!userId) return null;
    const result = await getUserReviewForBeach(beachId, userId);
    if (result.success) {
      return result.data;
    }
    throw new Error(result.error || "Failed to fetch user review");
  }, [beachId, userId]);

  // Fetch review statistics
  const fetchStats = useCallback(async () => {
    const result = await getBeachReviewStats(beachId);
    if (result.success && result.data) {
      return result.data;
    }
    throw new Error(result.error || "Failed to fetch review stats");
  }, [beachId]);

  // Use cached API calls
  const reviewsKey = RequestCache.createKey("reviews", beachId, refreshTrigger);
  const userReviewKey = RequestCache.createKey(
    "user-review",
    beachId,
    userId,
    refreshTrigger
  );
  const statsKey = RequestCache.createKey(
    "review-stats",
    beachId,
    refreshTrigger
  );

  const {
    data: reviews,
    loading: reviewsLoading,
    error: reviewsError,
    refetch: refetchReviews,
    invalidateCache: invalidateReviewsCache,
  } = useCachedApi<BeachReviewWithUser[]>(fetchReviews, reviewsKey, {
    immediate,
  });

  const {
    data: userReview,
    loading: userReviewLoading,
    error: userReviewError,
    refetch: refetchUserReview,
    invalidateCache: invalidateUserReviewCache,
  } = useCachedApi<BeachReviewWithUser | null>(fetchUserReview, userReviewKey, {
    immediate: immediate && Boolean(userId),
  });

  const {
    data: stats,
    loading: statsLoading,
    error: statsError,
    refetch: refetchStats,
    invalidateCache: invalidateStatsCache,
  } = useCachedApi<ReviewStats>(fetchStats, statsKey, { immediate });

  // Review operations
  const [operationLoading, setOperationLoading] = useState(false);
  const [operationError, setOperationError] = useState<string | null>(null);

  const createReview = useCallback(
    async (reviewData: Parameters<typeof createBeachReview>[0]) => {
      if (!userId) {
        throw new Error("User must be authenticated to create review");
      }

      setOperationLoading(true);
      setOperationError(null);

      try {
        const result = await createBeachReview(reviewData);
        if (result.success) {
          // Invalidate all caches and refresh
          invalidateReviewsCache();
          invalidateUserReviewCache();
          invalidateStatsCache();
          setRefreshTrigger((prev) => prev + 1);
          return result.data;
        } else {
          throw new Error(result.error || "Failed to create review");
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Failed to create review";
        setOperationError(errorMessage);
        throw error;
      } finally {
        setOperationLoading(false);
      }
    },
    [
      userId,
      invalidateReviewsCache,
      invalidateUserReviewCache,
      invalidateStatsCache,
    ]
  );

  const updateReview = useCallback(
    async (
      reviewId: string,
      updateData: Parameters<typeof updateBeachReview>[1]
    ) => {
      if (!userId) {
        throw new Error("User must be authenticated to update review");
      }

      setOperationLoading(true);
      setOperationError(null);

      try {
        const result = await updateBeachReview(reviewId, updateData);
        if (result.success) {
          // Invalidate all caches and refresh
          invalidateReviewsCache();
          invalidateUserReviewCache();
          invalidateStatsCache();
          setRefreshTrigger((prev) => prev + 1);
          return result.data;
        } else {
          throw new Error(result.error || "Failed to update review");
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Failed to update review";
        setOperationError(errorMessage);
        throw error;
      } finally {
        setOperationLoading(false);
      }
    },
    [
      userId,
      invalidateReviewsCache,
      invalidateUserReviewCache,
      invalidateStatsCache,
    ]
  );

  const removeReview = useCallback(
    async (reviewId: string) => {
      if (!userId) {
        throw new Error("User must be authenticated to delete review");
      }

      setOperationLoading(true);
      setOperationError(null);

      try {
        const result = await deleteBeachReview(reviewId);
        if (result.success) {
          // Invalidate all caches and refresh
          invalidateReviewsCache();
          invalidateUserReviewCache();
          invalidateStatsCache();
          setRefreshTrigger((prev) => prev + 1);
          return true;
        } else {
          throw new Error(result.error || "Failed to delete review");
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Failed to delete review";
        setOperationError(errorMessage);
        throw error;
      } finally {
        setOperationLoading(false);
      }
    },
    [
      userId,
      invalidateReviewsCache,
      invalidateUserReviewCache,
      invalidateStatsCache,
    ]
  );

  const refresh = useCallback(() => {
    setRefreshTrigger((prev) => prev + 1);
  }, []);

  return {
    // Data
    reviews: reviews || [],
    userReview,
    stats,

    // Loading states
    loading: reviewsLoading || userReviewLoading || statsLoading,
    reviewsLoading,
    userReviewLoading,
    statsLoading,
    operationLoading,

    // Error states
    error: reviewsError || userReviewError || statsError || operationError,
    reviewsError,
    userReviewError,
    statsError,
    operationError,

    // Operations
    createReview,
    updateReview,
    removeReview,
    refresh,

    // Manual refetch functions
    refetchReviews,
    refetchUserReview,
    refetchStats,

    // Computed values
    hasReviews: Boolean(reviews && reviews.length > 0),
    hasUserReview: Boolean(userReview),
    canWriteReview: Boolean(userId && !userReview),
  };
}

// New hook for fetching review stats for multiple beaches
export function useMultipleBeachReviews(beachIds: string[]) {
  const [reviewStats, setReviewStats] = useState<Record<string, ReviewStats>>(
    {}
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMultipleStats = useCallback(async () => {
    if (beachIds.length === 0) {
      setReviewStats({});
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await getMultipleBeachReviewStats(beachIds);

      if (result.success) {
        setReviewStats(result.data);
      } else {
        setError(result.error || "Failed to fetch review stats");
      }
    } catch (err) {
      setError("An unexpected error occurred");
      console.error("Error in useMultipleBeachReviews:", err);
    } finally {
      setLoading(false);
    }
  }, [beachIds]);

  const refresh = useCallback(() => {
    fetchMultipleStats();
  }, [fetchMultipleStats]);

  useEffect(() => {
    fetchMultipleStats();
  }, [fetchMultipleStats]);

  return {
    reviewStats,
    loading,
    error,
    refresh,
  };
}
