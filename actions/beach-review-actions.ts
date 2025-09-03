"use server";

import { createSupabaseServerClient as createClient } from "@/lib/supabase/server";
import type { BeachReview, BeachReviewWithUser } from "@/types/database";
import { revalidatePath } from "next/cache";
import { withErrorHandling, handleSupabaseError } from "@/lib/action-utils";
import {
  calculateReviewStats,
  calculateBeachAverageRatings,
  calculateMultipleBeachStats,
  type ReviewStats,
} from "@/lib/review-stats-utils";
// Optional XP tracking - imported dynamically to avoid circular dependency
async function trackXPOptional(action: string, entityId?: string, entityType?: string) {
  try {
    const { trackXP } = await import("@/lib/gamification-actions");
    await trackXP(action as any, entityId, entityType as any);
  } catch (error) {
    console.warn("XP tracking failed:", error);
  }
}

export async function getBeachReviews(beachId: string) {
  return withErrorHandling(async () => {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("beach_reviews")
      .select(
        `
        *,
        user:profiles!user_id(full_name)
      `
      )
      .eq("beach_id", beachId)
      .order("created_at", { ascending: false });

    if (error) {
      handleSupabaseError(error, "getBeachReviews");
    }

    return data as BeachReviewWithUser[];
  }, "fetch reviews");
}

export async function getUserReviewForBeach(beachId: string, userId: string) {
  return withErrorHandling(async () => {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("beach_reviews")
      .select(
        `
        *,
        user:profiles!user_id(full_name)
      `
      )
      .eq("beach_id", beachId)
      .eq("user_id", userId)
      .single();

    if (error && error.code !== "PGRST116") {
      // PGRST116 = no rows returned
      handleSupabaseError(error, "getUserReviewForBeach");
    }

    return data as BeachReviewWithUser | null;
  }, "fetch user review");
}

export async function createBeachReview(reviewData: {
  beach_id: string;
  user_id: string;
  overall_rating: number;
  wave_quality_rating: number;
  crowd_density_rating: number;
  parking_rating: number;
  accessibility_rating: number;
  title: string;
  content: string;
  visit_date?: string;
}) {
  return withErrorHandling(async () => {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("beach_reviews")
      .insert(reviewData)
      .select(
        `
        *,
        user:profiles!user_id(full_name)
      `
      )
      .single();

    if (error) {
      handleSupabaseError(error, "createBeachReview");
    }

    // Track XP for posting beach intel/review
    try {
      await trackXPOptional("review_intel", data.id, "review");
      
      // Additional XP if crowd/parking info provided
      if (reviewData.crowd_density_rating || reviewData.parking_rating) {
        await trackXPOptional("submit_crowd_parking", data.id, "review");
      }
    } catch (xpError) {
      console.error("Failed to track XP for beach review:", xpError);
      // Don't fail the review creation if XP tracking fails
    }

    // Update beach average ratings
    await updateBeachAverageRatings(reviewData.beach_id);

    // Revalidate relevant pages
    revalidatePath(`/beach/${reviewData.beach_id}`);
    revalidatePath("/map");

    return data as BeachReviewWithUser;
  }, "create review");
}

export async function updateBeachReview(
  reviewId: string,
  updateData: Partial<{
    overall_rating: number;
    wave_quality_rating: number;
    crowd_density_rating: number;
    parking_rating: number;
    accessibility_rating: number;
    title: string;
    content: string;
    visit_date?: string;
  }>
) {
  return withErrorHandling(async () => {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("beach_reviews")
      .update(updateData)
      .eq("id", reviewId)
      .select(
        `
        *,
        user:profiles!user_id(full_name)
      `
      )
      .single();

    if (error) {
      handleSupabaseError(error, "updateBeachReview");
    }

    // Update beach average ratings
    if (data) {
      await updateBeachAverageRatings(data.beach_id);

      // Revalidate relevant pages
      revalidatePath(`/beach/${data.beach_id}`);
      revalidatePath("/map");
    }

    return data as BeachReviewWithUser;
  }, "update review");
}

export async function deleteBeachReview(reviewId: string) {
  return withErrorHandling(async () => {
    const supabase = await createClient();

    // First get the beach_id before deleting
    const { data: reviewData, error: fetchError } = await supabase
      .from("beach_reviews")
      .select("beach_id")
      .eq("id", reviewId)
      .single();

    if (fetchError || !reviewData) {
      throw new Error("Review not found");
    }

    const { error } = await supabase
      .from("beach_reviews")
      .delete()
      .eq("id", reviewId);

    if (error) {
      handleSupabaseError(error, "deleteBeachReview");
    }

    // Update beach average ratings
    await updateBeachAverageRatings(reviewData.beach_id);

    // Revalidate relevant pages
    revalidatePath(`/beach/${reviewData.beach_id}`);
    revalidatePath("/map");

    return true;
  }, "delete review");
}

export async function getBeachReviewStats(beachId: string) {
  return withErrorHandling(async () => {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("beach_reviews")
      .select(
        "overall_rating, wave_quality_rating, crowd_density_rating, parking_rating, accessibility_rating"
      )
      .eq("beach_id", beachId);

    if (error) {
      handleSupabaseError(error, "getBeachReviewStats");
    }

    return calculateReviewStats(data || []);
  }, "fetch review stats");
}

export async function getMultipleBeachReviewStats(beachIds: string[]) {
  return withErrorHandling(async () => {
    if (beachIds.length === 0) {
      return {};
    }

    const supabase = await createClient();

    const { data, error } = await supabase
      .from("beach_reviews")
      .select(
        "beach_id, overall_rating, wave_quality_rating, crowd_density_rating, parking_rating, accessibility_rating"
      )
      .in("beach_id", beachIds);

    if (error) {
      handleSupabaseError(error, "getMultipleBeachReviewStats");
    }

    return calculateMultipleBeachStats(data || [], beachIds);
  }, "fetch multiple beach review stats");
}

// Helper function to update beach average ratings
async function updateBeachAverageRatings(beachId: string) {
  try {
    const supabase = await createClient();

    const { data: reviews, error } = await supabase
      .from("beach_reviews")
      .select(
        "wave_quality_rating, crowd_density_rating, parking_rating, accessibility_rating"
      )
      .eq("beach_id", beachId);

    if (error || !reviews || reviews.length === 0) {
      return;
    }

    const averages = calculateBeachAverageRatings(reviews);

    await supabase.from("beaches").update(averages).eq("id", beachId);
  } catch (error) {
    console.error("Error updating beach average ratings:", error);
  }
}
