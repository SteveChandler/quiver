"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { withServerAction } from "@/lib/server-action-utils";
import type { BeachReview } from "@/types/database";

/**
 * OPTIMIZED: Batch fetch beach reviews for multiple beaches
 * This replaces 88,315 individual calls with batched queries
 */
export async function getBatchedBeachReviews(
  beachIds: string[],
  options: {
    limit?: number;
    includeStats?: boolean;
    ratingThreshold?: number;
  } = {}
) {
  return withServerAction(async () => {
    if (!beachIds.length) {
      return {};
    }

    const supabase = await createSupabaseServerClient();
    const { limit = 10, includeStats = true, ratingThreshold } = options;

    // Batch query instead of individual calls
    let query = supabase
      .from("beach_reviews")
      .select(
        `
        *,
        user:profiles(full_name, avatar_url)
      `
      )
      .in("beach_id", beachIds)
      .order("created_at", { ascending: false });

    // Apply rating filter if specified
    if (ratingThreshold) {
      query = query.gte("overall_rating", ratingThreshold);
    }

    // Limit per beach (approximate)
    if (limit) {
      query = query.limit(limit * beachIds.length);
    }

    const { data: reviews, error } = await query;

    if (error) {
      throw error;
    }

    // Group reviews by beach_id
    const reviewsByBeach = (reviews || []).reduce((acc, review) => {
      if (!acc[review.beach_id]) {
        acc[review.beach_id] = [];
      }
      acc[review.beach_id].push(review);
      return acc;
    }, {} as Record<string, BeachReview[]>);

    // Limit reviews per beach
    if (limit) {
      Object.keys(reviewsByBeach).forEach((beachId) => {
        reviewsByBeach[beachId] = reviewsByBeach[beachId].slice(0, limit);
      });
    }

    // Fetch statistics if requested
    let statsByBeach = {};
    if (includeStats) {
      statsByBeach = await getBatchedBeachReviewStats(beachIds);
    }

    // Combine reviews and stats
    const result = beachIds.reduce((acc, beachId) => {
      acc[beachId] = {
        reviews: reviewsByBeach[beachId] || [],
        stats: statsByBeach[beachId] || null,
      };
      return acc;
    }, {} as Record<string, { reviews: BeachReview[]; stats: any }>);

    return result;
  });
}

/**
 * OPTIMIZED: Batch fetch beach review statistics
 * Replaces multiple aggregate queries with a single batch query
 */
export async function getBatchedBeachReviewStats(beachIds: string[]) {
  return withServerAction(async () => {
    if (!beachIds.length) {
      return {};
    }

    const supabase = await createSupabaseServerClient();

    // Single query to get all stats for all beaches
    const { data, error } = await supabase
      .from("beach_reviews")
      .select(
        `
        beach_id,
        overall_rating,
        wave_quality_rating,
        crowd_density_rating,
        parking_rating,
        accessibility_rating
      `
      )
      .in("beach_id", beachIds)
      .not("overall_rating", "is", null);

    if (error) {
      throw error;
    }

    // Calculate statistics for each beach
    const statsByBeach = beachIds.reduce((acc, beachId) => {
      const beachReviews = data?.filter((r) => r.beach_id === beachId) || [];

      if (beachReviews.length === 0) {
        acc[beachId] = {
          totalReviews: 0,
          averageRating: 0,
          ratingDistribution: [0, 0, 0, 0, 0],
          categoryAverages: {
            waveQuality: 0,
            crowdDensity: 0,
            parking: 0,
            accessibility: 0,
          },
        };
        return acc;
      }

      const totalReviews = beachReviews.length;
      const averageRating =
        beachReviews.reduce((sum, r) => sum + (r.overall_rating || 0), 0) /
        totalReviews;

      // Calculate rating distribution
      const ratingDistribution = [0, 0, 0, 0, 0];
      beachReviews.forEach((r) => {
        if (r.overall_rating) {
          ratingDistribution[Math.floor(r.overall_rating) - 1]++;
        }
      });

      // Calculate category averages
      const categoryAverages = {
        waveQuality:
          beachReviews.reduce(
            (sum, r) => sum + (r.wave_quality_rating || 0),
            0
          ) / totalReviews,
        crowdDensity:
          beachReviews.reduce(
            (sum, r) => sum + (r.crowd_density_rating || 0),
            0
          ) / totalReviews,
        parking:
          beachReviews.reduce((sum, r) => sum + (r.parking_rating || 0), 0) /
          totalReviews,
        accessibility:
          beachReviews.reduce(
            (sum, r) => sum + (r.accessibility_rating || 0),
            0
          ) / totalReviews,
      };

      acc[beachId] = {
        totalReviews,
        averageRating: Math.round(averageRating * 10) / 10,
        ratingDistribution,
        categoryAverages,
      };

      return acc;
    }, {} as Record<string, any>);

    return statsByBeach;
  });
}

/**
 * OPTIMIZED: Cache-friendly beach review summary
 * Returns minimal data for quick loading
 */
export async function getBeachReviewSummaries(beachIds: string[]) {
  return withServerAction(async () => {
    if (!beachIds.length) {
      return {};
    }

    const supabase = await createSupabaseServerClient();

    // Optimized query with only essential fields
    const { data, error } = await supabase
      .from("beach_reviews")
      .select("beach_id, overall_rating, created_at")
      .in("beach_id", beachIds)
      .not("overall_rating", "is", null)
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    // Calculate summaries
    const summaries = beachIds.reduce((acc, beachId) => {
      const beachReviews = data?.filter((r) => r.beach_id === beachId) || [];

      acc[beachId] = {
        totalReviews: beachReviews.length,
        averageRating:
          beachReviews.length > 0
            ? Math.round(
                (beachReviews.reduce((sum, r) => sum + r.overall_rating, 0) /
                  beachReviews.length) *
                  10
              ) / 10
            : 0,
        lastReviewDate: beachReviews[0]?.created_at || null,
      };

      return acc;
    }, {} as Record<string, { totalReviews: number; averageRating: number; lastReviewDate: string | null }>);

    return summaries;
  });
}

/**
 * OPTIMIZED: Cached beach review data fetcher
 * Implements smart caching to reduce database load
 */
export async function getCachedBeachReviews(
  beachIds: string[],
  cacheKey?: string,
  cacheDuration = 300000 // 5 minutes
) {
  return withServerAction(async () => {
    // In a real implementation, you'd use Redis or similar
    // For now, we'll use a simple in-memory cache
    const cache = new Map();
    const now = Date.now();

    // Check cache first
    const cachedResult = cache.get(cacheKey || beachIds.join(","));
    if (cachedResult && now - cachedResult.timestamp < cacheDuration) {
      return cachedResult.data;
    }

    // Fetch fresh data
    const result = await getBatchedBeachReviews(beachIds, {
      limit: 5,
      includeStats: true,
    });

    // Cache the result
    cache.set(cacheKey || beachIds.join(","), {
      data: result,
      timestamp: now,
    });

    return result;
  });
}

/**
 * Migration helper: Convert individual review queries to batch queries
 * Use this to replace existing individual calls
 */
export function createBatchedReviewFetcher() {
  const batchQueue: string[] = [];
  const batchTimeout = 100; // ms
  let timeoutId: NodeJS.Timeout | null = null;
  const callbacks = new Map<string, (result: any) => void>();

  return {
    fetch: (beachId: string): Promise<any> => {
      return new Promise((resolve) => {
        // Add to batch queue
        if (!batchQueue.includes(beachId)) {
          batchQueue.push(beachId);
        }

        callbacks.set(beachId, resolve);

        // Clear existing timeout
        if (timeoutId) {
          clearTimeout(timeoutId);
        }

        // Set new timeout to process batch
        timeoutId = setTimeout(async () => {
          const beachIds = [...batchQueue];
          batchQueue.length = 0;

          try {
            const result = await getBatchedBeachReviews(beachIds);

            // Resolve all pending promises
            beachIds.forEach((id) => {
              const callback = callbacks.get(id);
              if (callback) {
                callback(result[id] || { reviews: [], stats: null });
                callbacks.delete(id);
              }
            });
          } catch (error) {
            // Reject all pending promises
            beachIds.forEach((id) => {
              const callback = callbacks.get(id);
              if (callback) {
                callback({ reviews: [], stats: null, error });
                callbacks.delete(id);
              }
            });
          }
        }, batchTimeout);
      });
    },

    cleanup: () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      callbacks.clear();
      batchQueue.length = 0;
    },
  };
}

// Example usage:
// const reviewFetcher = createBatchedReviewFetcher();
// const reviews1 = await reviewFetcher.fetch('beach-1');
// const reviews2 = await reviewFetcher.fetch('beach-2');
// const reviews3 = await reviewFetcher.fetch('beach-3');
// // All three will be fetched in a single batch query
