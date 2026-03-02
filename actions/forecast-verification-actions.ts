"use server";

import { makeAuthenticatedAction } from "@/lib/server-action-utils";

// Types
export interface ForecastVoteInput {
  forecastId: string;
  beachId: string;
  wasAccurate: boolean;
  actualConditions?: {
    wave_height?: number;
    wave_period?: number;
    wind_speed?: number;
    wind_direction?: string;
    conditions?: string;
  };
  notes?: string;
  photoUrl?: string;
}

export interface ForecastVote {
  id: string;
  user_id: string;
  forecast_id: string;
  beach_id: string;
  was_accurate: boolean;
  actual_conditions?: any;
  notes?: string;
  photo_url?: string;
  created_at: string;
  updated_at: string;
}

export interface BeachAccuracyStats {
  beach_id: string;
  total_votes: number;
  accurate_votes: number;
  inaccurate_votes: number;
  accuracy_percentage: number;
  recent_votes: ForecastVote[];
}

/**
 * Submit or update a forecast accuracy vote
 * Users can vote once per forecast, subsequent calls update their vote
 */
export const voteForecastAccuracy = makeAuthenticatedAction(
  async (user, supabase, input: ForecastVoteInput) => {
    // Validate input
    if (!input.forecastId || !input.beachId) {
      throw new Error("Forecast ID and Beach ID are required");
    }
    if (typeof input.wasAccurate !== "boolean") {
      throw new Error("wasAccurate must be a boolean value");
    }

    // Check if user has already voted on this forecast
    const { data: existingVote, error: fetchError } = await supabase
      .from("forecast_accuracy_votes")
      .select("*")
      .eq("user_id", user.id)
      .eq("forecast_id", input.forecastId)
      .maybeSingle();

    if (fetchError) {
      throw new Error(`Failed to check existing vote: ${fetchError.message}`);
    }

    const voteData = {
      user_id: user.id,
      forecast_id: input.forecastId,
      beach_id: input.beachId,
      was_accurate: input.wasAccurate,
      actual_conditions: input.actualConditions || null,
      notes: input.notes || null,
      photo_url: input.photoUrl || null,
    };

    if (existingVote) {
      // Update existing vote
      const { data, error } = await supabase
        .from("forecast_accuracy_votes")
        .update(voteData)
        .eq("id", existingVote.id)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to update vote: ${error.message}`);
      }

      return { vote: data, isUpdate: true };
    } else {
      // Create new vote
      const { data, error } = await supabase
        .from("forecast_accuracy_votes")
        .insert(voteData)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create vote: ${error.message}`);
      }

      return { vote: data, isUpdate: false };
    }
  }
);

/**
 * Get accuracy statistics for a beach
 * Returns vote counts and accuracy percentage
 */
export const getBeachAccuracyStats = makeAuthenticatedAction(
  async (user, supabase, beachId: string, daysBack: number = 30) => {
    if (!beachId) {
      throw new Error("Beach ID is required");
    }

    if (!Number.isFinite(daysBack)) {
      throw new Error("daysBack must be a finite number");
    }

    if (daysBack < 1 || daysBack > 365) {
      throw new Error("daysBack must be between 1 and 365");
    }

    // Calculate date threshold
    const dateThreshold = new Date();
    dateThreshold.setDate(dateThreshold.getDate() - daysBack);

    // Get votes for this beach within the time window
    const { data: votes, error } = await supabase
      .from("forecast_accuracy_votes")
      .select("*")
      .eq("beach_id", beachId)
      .gte("created_at", dateThreshold.toISOString())
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch votes: ${error.message}`);
    }

    // Calculate statistics
    const totalVotes = votes?.length || 0;
    const accurateVotes =
      votes?.filter((v: { was_accurate: boolean }) => v.was_accurate).length || 0;
    const inaccurateVotes = totalVotes - accurateVotes;
    const accuracyPercentage =
      totalVotes > 0 ? (accurateVotes / totalVotes) * 100 : 0;

    return {
      beach_id: beachId,
      total_votes: totalVotes,
      accurate_votes: accurateVotes,
      inaccurate_votes: inaccurateVotes,
      accuracy_percentage: Math.round(accuracyPercentage * 10) / 10, // Round to 1 decimal
      recent_votes: votes?.slice(0, 10) || [], // Return 10 most recent votes
    } as BeachAccuracyStats;
  }
);

/**
 * Get accuracy statistics for a specific forecast
 * Returns vote counts for that forecast
 */
export const getForecastAccuracyStats = makeAuthenticatedAction(
  async (user, supabase, forecastId: string) => {
    if (!forecastId) {
      throw new Error("Forecast ID is required");
    }

    // Get all votes for this forecast
    const { data: votes, error } = await supabase
      .from("forecast_accuracy_votes")
      .select("*")
      .eq("forecast_id", forecastId)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch votes: ${error.message}`);
    }

    // Calculate statistics
    const totalVotes = votes?.length || 0;
    const accurateVotes =
      votes?.filter((v: { was_accurate: boolean }) => v.was_accurate).length || 0;
    const inaccurateVotes = totalVotes - accurateVotes;
    const accuracyPercentage =
      totalVotes > 0 ? (accurateVotes / totalVotes) * 100 : 0;

    return {
      forecast_id: forecastId,
      total_votes: totalVotes,
      accurate_votes: accurateVotes,
      inaccurate_votes: inaccurateVotes,
      accuracy_percentage: Math.round(accuracyPercentage * 10) / 10,
      votes: votes || [],
    };
  }
);

/**
 * Get user's verification streak
 * Returns count of consecutive days with at least one verification
 */
export const getUserVerificationStreak = makeAuthenticatedAction(
  async (user, supabase) => {
    // Get all user votes ordered by date
    const { data: votes, error } = await supabase
      .from("forecast_accuracy_votes")
      .select("created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch user votes: ${error.message}`);
    }

    if (!votes || votes.length === 0) {
      return {
        current_streak: 0,
        longest_streak: 0,
        total_verifications: 0,
      };
    }

    // Calculate streaks
    const voteDates: string[] = (votes as { created_at: string }[]).map((v) =>
      new Date(v.created_at).toDateString()
    );
    const uniqueDates: string[] = [...new Set(voteDates)];

    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 1;

    const today = new Date().toDateString();
    const yesterday = new Date(
      Date.now() - 24 * 60 * 60 * 1000
    ).toDateString();

    // Check if streak is active (voted today or yesterday)
    if (uniqueDates[0] === today || uniqueDates[0] === yesterday) {
      currentStreak = 1;

      // Count consecutive days
      for (let i = 1; i < uniqueDates.length; i++) {
        const prevDate = new Date(uniqueDates[i - 1]);
        const currDate = new Date(uniqueDates[i]);
        const dayDiff =
          (prevDate.getTime() - currDate.getTime()) /
          (1000 * 60 * 60 * 24);

        if (dayDiff <= 1) {
          currentStreak++;
          tempStreak++;
        } else {
          break;
        }
      }
    }

    // Calculate longest streak
    tempStreak = 1;
    for (let i = 1; i < uniqueDates.length; i++) {
      const prevDate = new Date(uniqueDates[i - 1]);
      const currDate = new Date(uniqueDates[i]);
      const dayDiff =
        (prevDate.getTime() - currDate.getTime()) / (1000 * 60 * 60 * 24);

      if (dayDiff <= 1) {
        tempStreak++;
        longestStreak = Math.max(longestStreak, tempStreak);
      } else {
        tempStreak = 1;
      }
    }
    longestStreak = Math.max(longestStreak, tempStreak);

    return {
      current_streak: currentStreak,
      longest_streak: longestStreak,
      total_verifications: votes.length,
    };
  }
);

/**
 * Get user's vote for a specific forecast (if exists)
 */
export const getUserForecastVote = makeAuthenticatedAction(
  async (user, supabase, forecastId: string) => {
    if (!forecastId) {
      throw new Error("Forecast ID is required");
    }

    const { data: vote, error } = await supabase
      .from("forecast_accuracy_votes")
      .select("*")
      .eq("user_id", user.id)
      .eq("forecast_id", forecastId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to fetch user vote: ${error.message}`);
    }

    return vote;
  }
);

/**
 * Delete user's vote for a forecast
 */
export const deleteForecastVote = makeAuthenticatedAction(
  async (user, supabase, forecastId: string) => {
    if (!forecastId) {
      throw new Error("Forecast ID is required");
    }

    const { error } = await supabase
      .from("forecast_accuracy_votes")
      .delete()
      .eq("user_id", user.id)
      .eq("forecast_id", forecastId);

    if (error) {
      throw new Error(`Failed to delete vote: ${error.message}`);
    }

    return { success: true };
  }
);
