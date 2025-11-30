"use server";

/**
 * Review Management Server Actions
 *
 * Admin operations for managing beach reviews with soft delete functionality.
 * All operations require admin privileges and include audit logging.
 */

import { withAdminActionAndUser } from "@/lib/server-action-utils/admin";
import { recordAdminEvent } from "@/lib/logging/admin-audit";
import type { ReviewFilterOptions, ReviewStats } from "@/lib/validation/admin/review-schema";
import type { AdminUser } from "@/lib/auth/admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/** Context provided to admin actions */
type AdminContext = {
  user: AdminUser;
  supabaseAdmin: SupabaseClient<Database>;
};

/**
 * Enhanced review type with user/beach details for admin display
 */
export interface AdminReviewListItem {
  id: string;
  beach_id: string;
  beach_name: string;
  user_id: string;
  user_email?: string;
  user_name?: string;
  title: string;
  content: string;
  overall_rating: number;
  wave_quality_rating: number;
  crowd_density_rating: number;
  parking_rating: number;
  accessibility_rating: number;
  helpful_count: number;
  visit_date: string | null;
  created_at: string | null;
  updated_at: string | null;
  deleted_at: string | null;
}

/**
 * Detailed review type for investigation view (includes all joins)
 */
export interface AdminReviewDetails {
  id: string;
  beach_id: string;
  user_id: string;
  title: string;
  content: string;
  overall_rating: number;
  wave_quality_rating: number;
  crowd_density_rating: number;
  parking_rating: number;
  accessibility_rating: number;
  helpful_count: number;
  visit_date: string | null;
  created_at: string | null;
  updated_at: string | null;
  deleted_at: string | null;
  // Joined profile data
  profiles: {
    id: string;
    email: string | null;
    name: string | null;
    avatar_url: string | null;
  } | null;
  // Joined beach data
  beaches: {
    id: string;
    name: string;
    region: string | null;
    country: string | null;
  } | null;
}

/**
 * List all reviews with optional filters and joins
 */
export const listReviews = withAdminActionAndUser(
  async (options: Partial<ReviewFilterOptions>, { supabaseAdmin }: AdminContext) => {
    const {
      includeDeleted = false,
      search = "",
      beachId,
      userId,
      minRating,
      maxRating,
      minWaveQuality,
      maxWaveQuality,
    } = options || {};

    let query = supabaseAdmin
      .from("beach_reviews")
      .select(
        `
        *,
        profiles!beach_reviews_user_id_fkey (
          email,
          name
        ),
        beaches!beach_reviews_beach_id_fkey (
          name
        )
      `
      )
      .order("created_at", { ascending: false });

    // Filter out deleted reviews by default
    if (!includeDeleted) {
      query = query.is("deleted_at", null);
    }

    // Apply filters
    if (beachId) {
      query = query.eq("beach_id", beachId);
    }

    if (userId) {
      query = query.eq("user_id", userId);
    }

    if (minRating) {
      query = query.gte("overall_rating", minRating);
    }

    if (maxRating) {
      query = query.lte("overall_rating", maxRating);
    }

    if (minWaveQuality) {
      query = query.gte("wave_quality_rating", minWaveQuality);
    }

    if (maxWaveQuality) {
      query = query.lte("wave_quality_rating", maxWaveQuality);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch reviews: ${error.message}`);
    }

    // Transform data to include user/beach details and apply search filter
    const reviews: AdminReviewListItem[] = (data || []).map((review: any) => {
      const profile = review.profiles;
      const beach = review.beaches;
      return {
        ...review,
        user_email: profile?.email,
        user_name: profile?.name,
        beach_name: beach?.name,
      };
    });

    // Apply search filter (post-query due to joins)
    if (search) {
      const searchLower = search.toLowerCase();
      return reviews.filter(
        (review) =>
          review.user_email?.toLowerCase().includes(searchLower) ||
          review.user_name?.toLowerCase().includes(searchLower) ||
          review.beach_name?.toLowerCase().includes(searchLower) ||
          review.title.toLowerCase().includes(searchLower) ||
          review.content.toLowerCase().includes(searchLower)
      );
    }

    return reviews;
  }
);

/**
 * Get review statistics for admin dashboard
 */
export const getReviewStats = withAdminActionAndUser(
  async (_: Record<string, never>, { supabaseAdmin }: AdminContext) => {
    // Get all reviews for aggregation
    const { data, error } = await supabaseAdmin
      .from("beach_reviews")
      .select(
        "overall_rating, wave_quality_rating, crowd_density_rating, parking_rating, accessibility_rating, helpful_count, deleted_at"
      );

    if (error) {
      throw new Error(`Failed to fetch review stats: ${error.message}`);
    }

    // Type for review stat calculation
    type ReviewStatRow = {
      overall_rating: number;
      wave_quality_rating: number;
      crowd_density_rating: number;
      parking_rating: number;
      accessibility_rating: number;
      helpful_count: number;
      deleted_at: string | null;
    };

    const reviews: ReviewStatRow[] = data || [];
    const activeReviews = reviews.filter((r: ReviewStatRow) => !r.deleted_at);

    // Calculate statistics
    const stats: ReviewStats = {
      total: activeReviews.length,
      deleted: reviews.filter((r: ReviewStatRow) => r.deleted_at).length,
      avgOverallRating:
        activeReviews.length > 0
          ? activeReviews.reduce((sum: number, r: ReviewStatRow) => sum + r.overall_rating, 0) / activeReviews.length
          : null,
      avgWaveQuality:
        activeReviews.length > 0
          ? activeReviews.reduce((sum: number, r: ReviewStatRow) => sum + r.wave_quality_rating, 0) / activeReviews.length
          : null,
      avgCrowdDensity:
        activeReviews.length > 0
          ? activeReviews.reduce((sum: number, r: ReviewStatRow) => sum + r.crowd_density_rating, 0) / activeReviews.length
          : null,
      avgParking:
        activeReviews.length > 0
          ? activeReviews.reduce((sum: number, r: ReviewStatRow) => sum + r.parking_rating, 0) / activeReviews.length
          : null,
      avgAccessibility:
        activeReviews.length > 0
          ? activeReviews.reduce((sum: number, r: ReviewStatRow) => sum + r.accessibility_rating, 0) / activeReviews.length
          : null,
      totalHelpfulVotes: activeReviews.reduce((sum: number, r: ReviewStatRow) => sum + r.helpful_count, 0),
    };

    return stats;
  }
);

/**
 * Get single review for detailed view
 */
export const getReview = withAdminActionAndUser(
  async (reviewId: string, { supabaseAdmin }: AdminContext) => {
    const { data, error } = await supabaseAdmin
      .from("beach_reviews")
      .select(
        `
        *,
        profiles!beach_reviews_user_id_fkey (
          id,
          email,
          name,
          avatar_url
        ),
        beaches!beach_reviews_beach_id_fkey (
          id,
          name,
          region,
          country
        )
      `
      )
      .eq("id", reviewId)
      .single();

    if (error) {
      throw new Error(`Failed to fetch review: ${error.message}`);
    }

    return data;
  }
);

/**
 * Soft delete a review (admin moderation)
 */
export const softDeleteReview = withAdminActionAndUser(
  async (reviewId: string, { supabaseAdmin, user }: AdminContext) => {
    // Fetch review details for audit logging
    const { data: review, error: fetchError } = await supabaseAdmin
      .from("beach_reviews")
      .select("user_id, title, overall_rating, beaches!beach_reviews_beach_id_fkey(name)")
      .eq("id", reviewId)
      .single();

    if (fetchError) {
      throw new Error(`Failed to fetch review: ${fetchError.message}`);
    }

    // Soft delete the review
    const { error } = await supabaseAdmin
      .from("beach_reviews")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", reviewId);

    if (error) {
      throw new Error(`Failed to delete review: ${error.message}`);
    }

    // Log the action
    await recordAdminEvent(user.id, "review", "delete", {
      entityId: reviewId,
      description: `Soft deleted review for ${review.beaches?.name || "unknown beach"}`,
      payloadSummary: {
        user_id: review.user_id,
        beach: review.beaches?.name,
        title: review.title,
        rating: review.overall_rating,
      },
    });

    return { success: true };
  }
);

/**
 * Restore a soft-deleted review
 */
export const restoreReview = withAdminActionAndUser(
  async (reviewId: string, { supabaseAdmin, user }: AdminContext) => {
    // Fetch review details for audit logging
    const { data: review, error: fetchError } = await supabaseAdmin
      .from("beach_reviews")
      .select("user_id, title, overall_rating, deleted_at, beaches!beach_reviews_beach_id_fkey(name)")
      .eq("id", reviewId)
      .single();

    if (fetchError) {
      throw new Error(`Failed to fetch review: ${fetchError.message}`);
    }

    if (!review.deleted_at) {
      throw new Error("Review is not deleted");
    }

    // Restore the review
    const { error } = await supabaseAdmin
      .from("beach_reviews")
      .update({ deleted_at: null })
      .eq("id", reviewId);

    if (error) {
      throw new Error(`Failed to restore review: ${error.message}`);
    }

    // Log the action
    await recordAdminEvent(user.id, "review", "restore", {
      entityId: reviewId,
      description: `Restored review for ${review.beaches?.name || "unknown beach"}`,
      payloadSummary: {
        user_id: review.user_id,
        beach: review.beaches?.name,
        title: review.title,
        rating: review.overall_rating,
        was_deleted_at: review.deleted_at,
      },
    });

    return { success: true };
  }
);
