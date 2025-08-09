"use server";

import { withAuthenticatedAction } from "@/lib/server-action-utils";
import { createAPIServerClient } from "@/lib/supabase/api-server-client";
import {
  CheckIn,
  CheckInWithUser,
  ForecastAccuracyStats,
} from "@/types/database";

/**
 * Submit a new surf condition check-in
 */
export const submitCheckIn = withAuthenticatedAction(
  async (
    userId: string,
    beachId: string,
    data: {
      wave_height?: number | null;
      wind_speed?: number | null;
      wind_direction?: string | null;
      water_temp?: number | null;
      crowd_level?: number | null;
      vibe?: string | null;
      forecast_accuracy_rating: "accurate" | "somewhat" | "inaccurate";
    }
  ) => {
    const supabase = createAPIServerClient();

    // Validate required data
    if (!beachId) {
      throw new Error("Beach ID is required");
    }

    if (!data.forecast_accuracy_rating) {
      throw new Error("Forecast accuracy rating is required");
    }

    // Validate beach exists
    const { data: beach, error: beachError } = await supabase
      .from("beaches")
      .select("id")
      .eq("id", beachId)
      .single();

    if (beachError || !beach) {
      throw new Error("Beach not found");
    }

    // Insert check-in
    const { data: checkIn, error } = await supabase
      .from("check_ins")
      .insert({
        user_id: userId,
        beach_id: beachId,
        checked_in_at: new Date().toISOString(),
        wave_height: data.wave_height,
        wind_speed: data.wind_speed,
        wind_direction: data.wind_direction,
        water_temp: data.water_temp,
        crowd_level: data.crowd_level,
        vibe: data.vibe,
        forecast_accuracy_rating: data.forecast_accuracy_rating,
      })
      .select()
      .single();

    if (error) {
      console.error("Error submitting check-in:", error);
      throw new Error("Failed to submit check-in");
    }

    return checkIn;
  }
);

/**
 * Get recent check-ins for a beach
 */
export async function getRecentCheckIns(
  beachId: string,
  hoursBack: number = 24,
  limitCount: number = 10
): Promise<CheckInWithUser[]> {
  const supabase = createAPIServerClient();

  // Use the database function for optimized query
  const { data, error } = await supabase.rpc("get_recent_check_ins", {
    beach_uuid: beachId,
    hours_back: hoursBack,
    limit_count: limitCount,
  });

  if (error) {
    console.error("Error fetching recent check-ins:", error);
    throw new Error("Failed to fetch recent check-ins");
  }

  return data || [];
}

/**
 * Get forecast accuracy statistics for a beach
 */
export async function getForecastAccuracyStats(
  beachId: string,
  daysBack: number = 7
): Promise<ForecastAccuracyStats> {
  const supabase = createAPIServerClient();

  // Use the database function for optimized query
  const { data, error } = await supabase.rpc("get_forecast_accuracy_stats", {
    beach_uuid: beachId,
    days_back: daysBack,
  });

  if (error) {
    console.error("Error fetching forecast accuracy stats:", error);
    throw new Error("Failed to fetch forecast accuracy stats");
  }

  // Return first result or default empty stats
  const stats = data?.[0];
  return {
    total_reports: stats?.total_reports || 0,
    accurate_count: stats?.accurate_count || 0,
    somewhat_count: stats?.somewhat_count || 0,
    inaccurate_count: stats?.inaccurate_count || 0,
    accuracy_percentage: stats?.accuracy_percentage || 0,
  };
}

/**
 * Update an existing check-in (user can only update their own)
 */
export const updateCheckIn = withAuthenticatedAction(
  async (
    userId: string,
    checkInId: string,
    data: Partial<{
      wave_height: number | null;
      wind_speed: number | null;
      wind_direction: string | null;
      water_temp: number | null;
      crowd_level: number | null;
      vibe: string | null;
      forecast_accuracy_rating: "accurate" | "somewhat" | "inaccurate";
    }>
  ) => {
    const supabase = createAPIServerClient();

    // Update check-in (RLS ensures user can only update their own)
    const { data: checkIn, error } = await supabase
      .from("check_ins")
      .update(data)
      .eq("id", checkInId)
      .eq("user_id", userId) // Extra safety check
      .select()
      .single();

    if (error) {
      console.error("Error updating check-in:", error);
      throw new Error("Failed to update check-in");
    }

    if (!checkIn) {
      throw new Error("Check-in not found or access denied");
    }

    return checkIn;
  }
);

/**
 * Delete a check-in (user can only delete their own)
 */
export const deleteCheckIn = withAuthenticatedAction(
  async (userId: string, checkInId: string) => {
    const supabase = createAPIServerClient();

    // Delete check-in (RLS ensures user can only delete their own)
    const { error } = await supabase
      .from("check_ins")
      .delete()
      .eq("id", checkInId)
      .eq("user_id", userId); // Extra safety check

    if (error) {
      console.error("Error deleting check-in:", error);
      throw new Error("Failed to delete check-in");
    }

    return { success: true };
  }
);

/**
 * Get check-ins by user (for profile/history view)
 */
export async function getUserCheckIns(
  userId: string,
  limit: number = 20,
  offset: number = 0
): Promise<CheckIn[]> {
  const supabase = createAPIServerClient();

  const { data, error } = await supabase
    .from("check_ins")
    .select(
      `
      *,
      beaches:beach_id (
        name,
        location_text:location
      )
    `
    )
    .eq("user_id", userId)
    .order("checked_in_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error("Error fetching user check-ins:", error);
    throw new Error("Failed to fetch user check-ins");
  }

  return data || [];
}

/**
 * Get all check-ins for a beach with pagination
 */
export async function getBeachCheckIns(
  beachId: string,
  limit: number = 20,
  offset: number = 0
): Promise<CheckInWithUser[]> {
  const supabase = createAPIServerClient();

  const { data, error } = await supabase
    .from("check_ins")
    .select(
      `
      *,
      profiles:user_id (
        username,
        profile_picture_url
      )
    `
    )
    .eq("beach_id", beachId)
    .order("checked_in_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error("Error fetching beach check-ins:", error);
    throw new Error("Failed to fetch beach check-ins");
  }

  // Transform data to match CheckInWithUser type
  return (data || []).map((item) => ({
    ...item,
    user: {
      username: item.profiles?.username || null,
      profile_picture_url: item.profiles?.profile_picture_url || null,
    },
  }));
}
