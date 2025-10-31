"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  withAuthenticatedAction,
  withDatabaseOperation,
  type ServerActionResponse,
} from "@/lib/server-action-utils";
import type {
  SessionForecastSnapshot,
  BeachForecastAccuracy,
} from "@/types/database";

/**
 * Get session forecast snapshots for a user
 * Used for personal calibration analysis
 */
export async function getUserSessionSnapshots(
  limit: number = 20,
  offset: number = 0
): Promise<ServerActionResponse<SessionForecastSnapshot[]>> {
  return withAuthenticatedAction(async (user, supabase) => {
    const { data, error } = await supabase
      .from("session_forecast_snapshots")
      .select(
        `
        *,
        session:sessions(
          id,
          beach_name,
          arrival_time,
          rating,
          wave_height,
          wave_quality
        )
      `
      )
      .eq("user_id", user.id)
      .order("session_date", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new Error(`Failed to fetch session snapshots: ${error.message}`);
    }

    return data || [];
  });
}

/**
 * Get session forecast snapshots for a specific beach
 * Used for beach-specific calibration analysis
 */
export async function getBeachSessionSnapshots(
  beachId: string,
  limit: number = 50
): Promise<ServerActionResponse<SessionForecastSnapshot[]>> {
  return withDatabaseOperation(async (supabase) => {
    return supabase
      .from("session_forecast_snapshots")
      .select(
        `
        *,
        session:sessions(
          id,
          beach_name,
          arrival_time,
          rating,
          wave_height,
          wave_quality
        ),
        user:profiles(
          full_name
        )
      `
      )
      .eq("beach_id", beachId)
      .order("session_date", { ascending: false })
      .limit(limit);
  });
}

/**
 * Get forecast accuracy statistics for a beach
 */
export async function getBeachForecastAccuracy(
  beachId: string
): Promise<ServerActionResponse<BeachForecastAccuracy | null>> {
  return withDatabaseOperation(async (supabase) => {
    return supabase
      .from("beach_forecast_accuracy")
      .select("*")
      .eq("beach_id", beachId)
      .single();
  });
}

/**
 * Get forecast accuracy statistics for multiple beaches
 */
export async function getMultipleBeachAccuracy(
  beachIds: string[]
): Promise<ServerActionResponse<BeachForecastAccuracy[]>> {
  return withDatabaseOperation(async (supabase) => {
    return supabase
      .from("beach_forecast_accuracy")
      .select(
        `
        *,
        beach:beaches(
          name,
          location_text:location
        )
      `
      )
      .in("beach_id", beachIds)
      .order("overall_accuracy_score", { ascending: false });
  });
}

/**
 * Create a forecast snapshot manually (for testing or manual entry)
 */
export async function createForecastSnapshot(
  sessionId: string,
  forecastSnapshot: Record<string, any>,
  actualConditions: Record<string, any>
): Promise<ServerActionResponse<SessionForecastSnapshot>> {
  return withAuthenticatedAction(async (user, supabase) => {
    // First, get the session to ensure the user owns it
    const { data: session, error: sessionError } = await supabase
      .from("sessions")
      .select("*")
      .eq("id", sessionId)
      .eq("user_id", user.id)
      .single();

    if (sessionError) {
      throw new Error(`Session not found: ${sessionError.message}`);
    }

    if (!session) {
      throw new Error("Session not found or access denied");
    }

    // Check if snapshot already exists
    const { data: existingSnapshot } = await supabase
      .from("session_forecast_snapshots")
      .select("id")
      .eq("session_id", sessionId)
      .single();

    if (existingSnapshot) {
      throw new Error("Forecast snapshot already exists for this session");
    }

    // Create the forecast snapshot
    const { data, error } = await supabase
      .from("session_forecast_snapshots")
      .insert({
        session_id: sessionId,
        user_id: user.id,
        beach_id: session.beach_id,
        forecast_snapshot: forecastSnapshot,
        actual_conditions: actualConditions,
        forecast_confidence_score: forecastSnapshot.confidence_score || null,
        data_source: forecastSnapshot.data_source || null,
        session_date: new Date(session.arrival_time)
          .toISOString()
          .split("T")[0],
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create forecast snapshot: ${error.message}`);
    }

    return data;
  });
}

/**
 * Update forecast accuracy statistics for a beach (admin function)
 */
export async function updateBeachAccuracy(
  beachId: string
): Promise<ServerActionResponse<{ message: string }>> {
  return withAuthenticatedAction(async (user, supabase) => {
    // This would typically be restricted to admin users
    // For now, we'll allow authenticated users to trigger updates

    const { error } = await supabase.rpc("update_beach_forecast_accuracy", {
      target_beach_id: beachId,
    });

    if (error) {
      throw new Error(`Failed to update beach accuracy: ${error.message}`);
    }

    return { message: "Beach accuracy statistics updated successfully" };
  });
}

/**
 * Update all beach accuracy statistics (admin function)
 */
export async function updateAllBeachAccuracy(): Promise<
  ServerActionResponse<{ message: string }>
> {
  return withAuthenticatedAction(async (user, supabase) => {
    const { error } = await supabase.rpc("update_beach_forecast_accuracy");

    if (error) {
      throw new Error(`Failed to update all beach accuracy: ${error.message}`);
    }

    return { message: "All beach accuracy statistics updated successfully" };
  });
}

/**
 * Get forecast accuracy trends over time for a beach
 */
export async function getForecastAccuracyTrends(
  beachId: string,
  days: number = 30
): Promise<ServerActionResponse<any[]>> {
  return withDatabaseOperation(async (supabase) => {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data, error } = await supabase
      .from("session_forecast_snapshots")
      .select(
        `
        session_date,
        forecast_snapshot,
        actual_conditions,
        forecast_confidence_score
      `
      )
      .eq("beach_id", beachId)
      .gte("session_date", startDate.toISOString().split("T")[0])
      .order("session_date", { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch accuracy trends: ${error.message}`);
    }

    return data || [];
  });
}

/**
 * Get forecast accuracy summary for user's dashboard
 */
export async function getUserForecastAccuracySummary(): Promise<
  ServerActionResponse<{
    totalSessions: number;
    avgAccuracy: number;
    topBeaches: Array<{
      beachName: string;
      accuracy: number;
      sessionCount: number;
    }>;
  }>
> {
  return withAuthenticatedAction(async (user, supabase) => {
    // Get user's session snapshots with beach info
    const { data: snapshots, error } = await supabase
      .from("session_forecast_snapshots")
      .select(
        `
        *,
        session:sessions(beach_name)
      `
      )
      .eq("user_id", user.id);

    if (error) {
      throw new Error(
        `Failed to fetch user accuracy summary: ${error.message}`
      );
    }

    if (!snapshots || snapshots.length === 0) {
      return {
        totalSessions: 0,
        avgAccuracy: 0,
        topBeaches: [],
      };
    }

    // Calculate accuracy metrics
    const accuracyScores = snapshots.map((snapshot) => {
      const forecastHeight = parseFloat(
        snapshot.forecast_snapshot?.wave_height || "0"
      );
      const actualHeight = parseFloat(
        snapshot.actual_conditions?.wave_height || "0"
      );
      const heightDelta = Math.abs(forecastHeight - actualHeight);

      // Simple accuracy score: 100% - (height difference * 20%)
      // Max penalty of 100% for very large differences
      return Math.max(0, 100 - heightDelta * 20);
    });

    const avgAccuracy =
      accuracyScores.reduce((sum, score) => sum + score, 0) /
      accuracyScores.length;

    // Group by beach and calculate beach-specific accuracy
    const beachStats = snapshots.reduce((acc, snapshot) => {
      const beachName = snapshot.session?.beach_name || "Unknown Beach";
      if (!acc[beachName]) {
        acc[beachName] = { sessions: [], accuracy: 0 };
      }
      acc[beachName].sessions.push(snapshot);
      return acc;
    }, {} as Record<string, { sessions: any[]; accuracy: number }>);

    const topBeaches = Object.entries(beachStats)
      .map(([beachName, stats]) => {
        const beachAccuracyScores = stats.sessions.map((snapshot) => {
          const forecastHeight = parseFloat(
            snapshot.forecast_snapshot?.wave_height || "0"
          );
          const actualHeight = parseFloat(
            snapshot.actual_conditions?.wave_height || "0"
          );
          const heightDelta = Math.abs(forecastHeight - actualHeight);
          return Math.max(0, 100 - heightDelta * 20);
        });

        const accuracy =
          beachAccuracyScores.reduce((sum, score) => sum + score, 0) /
          beachAccuracyScores.length;

        return {
          beachName,
          accuracy: Math.round(accuracy),
          sessionCount: stats.sessions.length,
        };
      })
      .sort((a, b) => b.accuracy - a.accuracy)
      .slice(0, 5);

    return {
      totalSessions: snapshots.length,
      avgAccuracy: Math.round(avgAccuracy),
      topBeaches,
    };
  });
}

/**
 * Function aliases for backward compatibility with hooks
 */
export const getBeachAccuracy = getBeachForecastAccuracy;
export const getSessionForecastSnapshots = getBeachSessionSnapshots;
