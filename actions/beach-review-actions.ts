"use server";

import { createSupabaseServerClient as createClient } from "@/lib/supabase/server";
import type { BeachReview, BeachReviewWithUser } from "@/types/database";
import { revalidatePath } from "next/cache";

export async function getBeachReviews(beachId: string) {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("beach_reviews")
      .select(
        `
        *,
        user:profiles!user_id(full_name, avatar_url, email)
      `
      )
      .eq("beach_id", beachId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching beach reviews:", error);
      return { success: false, error: error.message };
    }

    return { success: true, data: data as BeachReviewWithUser[] };
  } catch (error) {
    console.error("Error in getBeachReviews:", error);
    return { success: false, error: "Failed to fetch reviews" };
  }
}

export async function getUserReviewForBeach(beachId: string, userId: string) {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("beach_reviews")
      .select(
        `
        *,
        user:profiles!user_id(full_name, avatar_url, email)
      `
      )
      .eq("beach_id", beachId)
      .eq("user_id", userId)
      .single();

    if (error && error.code !== "PGRST116") {
      // PGRST116 = no rows returned
      console.error("Error fetching user review:", error);
      return { success: false, error: error.message };
    }

    return { success: true, data: data as BeachReviewWithUser | null };
  } catch (error) {
    console.error("Error in getUserReviewForBeach:", error);
    return { success: false, error: "Failed to fetch user review" };
  }
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
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("beach_reviews")
      .insert(reviewData)
      .select(
        `
        *,
        user:profiles!user_id(full_name, avatar_url, email)
      `
      )
      .single();

    if (error) {
      console.error("Error creating beach review:", error);
      return { success: false, error: error.message };
    }

    // Update beach average ratings
    await updateBeachAverageRatings(reviewData.beach_id);

    // Revalidate relevant pages
    revalidatePath(`/beach/${reviewData.beach_id}`);
    revalidatePath("/map");

    return { success: true, data: data as BeachReviewWithUser };
  } catch (error) {
    console.error("Error in createBeachReview:", error);
    return { success: false, error: "Failed to create review" };
  }
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
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("beach_reviews")
      .update(updateData)
      .eq("id", reviewId)
      .select(
        `
        *,
        user:profiles!user_id(full_name, avatar_url, email)
      `
      )
      .single();

    if (error) {
      console.error("Error updating beach review:", error);
      return { success: false, error: error.message };
    }

    // Update beach average ratings
    if (data) {
      await updateBeachAverageRatings(data.beach_id);

      // Revalidate relevant pages
      revalidatePath(`/beach/${data.beach_id}`);
      revalidatePath("/map");
    }

    return { success: true, data: data as BeachReviewWithUser };
  } catch (error) {
    console.error("Error in updateBeachReview:", error);
    return { success: false, error: "Failed to update review" };
  }
}

export async function deleteBeachReview(reviewId: string) {
  try {
    const supabase = await createClient();

    // First get the beach_id before deleting
    const { data: reviewData, error: fetchError } = await supabase
      .from("beach_reviews")
      .select("beach_id")
      .eq("id", reviewId)
      .single();

    if (fetchError || !reviewData) {
      return { success: false, error: "Review not found" };
    }

    const { error } = await supabase
      .from("beach_reviews")
      .delete()
      .eq("id", reviewId);

    if (error) {
      console.error("Error deleting beach review:", error);
      return { success: false, error: error.message };
    }

    // Update beach average ratings
    await updateBeachAverageRatings(reviewData.beach_id);

    // Revalidate relevant pages
    revalidatePath(`/beach/${reviewData.beach_id}`);
    revalidatePath("/map");

    return { success: true };
  } catch (error) {
    console.error("Error in deleteBeachReview:", error);
    return { success: false, error: "Failed to delete review" };
  }
}

export async function getBeachReviewStats(beachId: string) {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("beach_reviews")
      .select(
        "overall_rating, wave_quality_rating, crowd_density_rating, parking_rating, accessibility_rating"
      )
      .eq("beach_id", beachId);

    if (error) {
      console.error("Error fetching beach review stats:", error);
      return { success: false, error: error.message };
    }

    if (!data || data.length === 0) {
      return {
        success: true,
        data: {
          total_reviews: 0,
          average_overall: 0,
          average_wave_quality: 0,
          average_crowd_density: 0,
          average_parking: 0,
          average_accessibility: 0,
        },
      };
    }

    const stats = {
      total_reviews: data.length,
      average_overall:
        data.reduce((sum, r) => sum + r.overall_rating, 0) / data.length,
      average_wave_quality:
        data.reduce((sum, r) => sum + r.wave_quality_rating, 0) / data.length,
      average_crowd_density:
        data.reduce((sum, r) => sum + r.crowd_density_rating, 0) / data.length,
      average_parking:
        data.reduce((sum, r) => sum + r.parking_rating, 0) / data.length,
      average_accessibility:
        data.reduce((sum, r) => sum + r.accessibility_rating, 0) / data.length,
    };

    return { success: true, data: stats };
  } catch (error) {
    console.error("Error in getBeachReviewStats:", error);
    return { success: false, error: "Failed to fetch review stats" };
  }
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

    const averages = {
      wave_quality_rating:
        reviews.reduce((sum, r) => sum + r.wave_quality_rating, 0) /
        reviews.length,
      crowd_density_rating:
        reviews.reduce((sum, r) => sum + r.crowd_density_rating, 0) /
        reviews.length,
      parking_rating:
        reviews.reduce((sum, r) => sum + r.parking_rating, 0) / reviews.length,
      accessibility_rating:
        reviews.reduce((sum, r) => sum + r.accessibility_rating, 0) /
        reviews.length,
    };

    await supabase.from("beaches").update(averages).eq("id", beachId);
  } catch (error) {
    console.error("Error updating beach average ratings:", error);
  }
}
