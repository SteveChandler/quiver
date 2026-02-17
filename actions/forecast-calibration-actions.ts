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
 * Filters for querying the authenticated user's forecast history.
 *
 * Note: JSONB filters (e.g. rating inside actual_conditions) are applied client-side
 * to keep queries simple and portable.
 */
export interface ForecastHistoryFilters {
  startDate?: Date;
  endDate?: Date;
  beachId?: string;
  dataSource?: string;
  minRating?: number;
  minConfidence?: number;
}

/**
 * Aggregated analysis of the authenticated user's preferred conditions.
 * Derived from sessions with rating >= minRating.
 */
export interface PreferredConditionsAnalysis {
  userId: string;
  totalSessions: number;
  highlyRatedSessions: number; // rating >= minRating
  averageConditions: {
    waveHeight: number | null;
    wavePeriod: number | null;
    windSpeed: number | null;
    tideStatus: Record<string, number>; // tide_status -> count
  };
  preferredDataSource: string | null;
  averageConfidence: number | null;
  beachFrequency: Array<{
    beachId: string;
    sessionCount: number;
    averageRating: number;
  }>;
}

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
          wave_height_ft,
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
          wave_height_ft,
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
      .maybeSingle();
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

    // Check if snapshot already exists (log flow may create an automatic snapshot)
    const { data: existingSnapshot, error: existingSnapshotError } = await supabase
      .from("session_forecast_snapshots")
      .select("id")
      .eq("session_id", sessionId)
      .maybeSingle();

    if (existingSnapshotError) {
      throw new Error(
        `Failed to check existing forecast snapshot: ${existingSnapshotError.message}`
      );
    }

    const sessionDate = new Date(session.arrival_time)
      .toISOString()
      .split("T")[0];

    const safeActual = actualConditions || {};
    const safeForecast = forecastSnapshot || {};
    const hasForecastFields = Object.keys(safeForecast).length > 0;

    // If a snapshot already exists, update it instead of failing.
    if (existingSnapshot?.id) {
      // IMPORTANT:
      // - The DB trigger may have already populated `forecast_snapshot`.
      // - When the user submits feedback, we should never wipe forecast fields if we
      //   couldn't load a forecast in the client (e.g. network error).
      const updatePayload = {
        actual_conditions: safeActual,
        session_date: sessionDate,
        ...(hasForecastFields
          ? {
              forecast_snapshot: safeForecast,
              forecast_confidence_score: safeForecast?.confidence_score ?? null,
              data_source: safeForecast?.data_source ?? null,
            }
          : {}),
      };

      const { data: updated, error: updateError } = await supabase
        .from("session_forecast_snapshots")
        .update(updatePayload)
        .eq("id", existingSnapshot.id)
        .eq("user_id", user.id)
        .select()
        .single();

      if (updateError) {
        throw new Error(
          `Failed to update forecast snapshot: ${updateError.message}`
        );
      }

      return updated as SessionForecastSnapshot;
    }

    // Create the forecast snapshot
    const { data, error } = await supabase
      .from("session_forecast_snapshots")
      .insert({
        session_id: sessionId,
        user_id: user.id,
        beach_id: session.beach_id,
        forecast_snapshot: safeForecast,
        actual_conditions: safeActual,
        forecast_confidence_score: safeForecast?.confidence_score ?? null,
        data_source: safeForecast?.data_source ?? null,
        session_date: sessionDate,
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
 * Get the authenticated user's historical forecast snapshots with optional filters.
 */
export async function getUserForecastHistory(
  filters?: ForecastHistoryFilters
): Promise<ServerActionResponse<SessionForecastSnapshot[]>> {
  return withAuthenticatedAction(async (user, supabase) => {
    let query = supabase
      .from("session_forecast_snapshots")
      .select("*")
      .eq("user_id", user.id)
      .order("session_date", { ascending: false });

    if (filters?.startDate) {
      query = query.gte(
        "session_date",
        filters.startDate.toISOString().split("T")[0]
      );
    }
    if (filters?.endDate) {
      query = query.lte(
        "session_date",
        filters.endDate.toISOString().split("T")[0]
      );
    }
    if (filters?.beachId) {
      query = query.eq("beach_id", filters.beachId);
    }
    if (filters?.dataSource) {
      query = query.eq("data_source", filters.dataSource);
    }
    if (filters?.minConfidence !== undefined) {
      query = query.gte("forecast_confidence_score", filters.minConfidence);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(`Failed to fetch user forecast history: ${error.message}`);
    }

    let snapshots = (data || []) as SessionForecastSnapshot[];

    // Rating is stored in JSONB, apply filter client-side
    if (filters?.minRating !== undefined) {
      snapshots = snapshots.filter((snapshot) => {
        const rating = (snapshot as any)?.actual_conditions?.rating;
        return rating !== null && rating !== undefined && rating >= filters.minRating!;
      });
    }

    return snapshots;
  });
}

/**
 * Analyze a user's preferred conditions based on their highly-rated sessions.
 */
export async function analyzePreferredConditions(
  minRating: number = 4
): Promise<ServerActionResponse<PreferredConditionsAnalysis>> {
  return withAuthenticatedAction(async (user, supabase) => {
    const { data: snapshots, error } = await supabase
      .from("session_forecast_snapshots")
      .select("*")
      .eq("user_id", user.id);

    if (error) {
      throw new Error(`Failed to fetch snapshots for analysis: ${error.message}`);
    }

    const typedSnapshots = (snapshots || []) as SessionForecastSnapshot[];
    const highlyRatedSnapshots = typedSnapshots.filter((s) => {
      const rating = (s as any)?.actual_conditions?.rating;
      return rating !== null && rating !== undefined && rating >= minRating;
    });

    const tideStatusCounts: Record<string, number> = {};
    const dataSourceCounts: Record<string, number> = {};
    const beachCounts: Record<string, { count: number; ratings: number[] }> = {};

    const waveHeights: number[] = [];
    const wavePeriods: number[] = [];
    const windSpeeds: number[] = [];
    const confidenceScores: number[] = [];

    for (const s of highlyRatedSnapshots) {
      const fs = (s as any)?.forecast_snapshot || {};
      const waveHeight = fs.wave_height;
      const wavePeriod = fs.wave_period;
      const windSpeed = fs.wind_speed;
      const tideStatus = fs.tide_status;

      if (typeof waveHeight === "number") waveHeights.push(waveHeight);
      if (typeof wavePeriod === "number") wavePeriods.push(wavePeriod);
      if (typeof windSpeed === "number") windSpeeds.push(windSpeed);

      if (tideStatus) {
        tideStatusCounts[String(tideStatus)] =
          (tideStatusCounts[String(tideStatus)] || 0) + 1;
      }

      const source = (s as any)?.data_source;
      if (source) {
        dataSourceCounts[String(source)] = (dataSourceCounts[String(source)] || 0) + 1;
      }

      const conf = (s as any)?.forecast_confidence_score;
      if (typeof conf === "number") {
        confidenceScores.push(conf);
      }

      const beachId = (s as any)?.beach_id;
      if (beachId) {
        if (!beachCounts[beachId]) {
          beachCounts[beachId] = { count: 0, ratings: [] };
        }
        beachCounts[beachId].count++;
        const r = (s as any)?.actual_conditions?.rating;
        if (typeof r === "number") {
          beachCounts[beachId].ratings.push(r);
        }
      }
    }

    const avg = (arr: number[]) =>
      arr.length > 0 ? arr.reduce((sum, n) => sum + n, 0) / arr.length : null;

    const preferredDataSource =
      Object.entries(dataSourceCounts).sort(([, a], [, b]) => b - a)[0]?.[0] ??
      null;

    const beachFrequency = Object.entries(beachCounts)
      .map(([beachId, { count, ratings }]) => ({
        beachId,
        sessionCount: count,
        averageRating:
          ratings.length > 0
            ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length
            : 0,
      }))
      .sort((a, b) => b.sessionCount - a.sessionCount)
      .slice(0, 10);

    return {
      userId: user.id,
      totalSessions: typedSnapshots.length,
      highlyRatedSessions: highlyRatedSnapshots.length,
      averageConditions: {
        waveHeight: avg(waveHeights),
        wavePeriod: avg(wavePeriods),
        windSpeed: avg(windSpeeds),
        tideStatus: tideStatusCounts,
      },
      preferredDataSource,
      averageConfidence: avg(confidenceScores),
      beachFrequency,
    };
  });
}

/**
 * Get snapshot count by data source for the authenticated user.
 */
export async function getDataSourceDistribution(): Promise<
  ServerActionResponse<Record<string, number>>
> {
  return withAuthenticatedAction(async (user, supabase) => {
    const { data: snapshots, error } = await supabase
      .from("session_forecast_snapshots")
      .select("data_source")
      .eq("user_id", user.id);

    if (error) {
      throw new Error(`Failed to fetch data source distribution: ${error.message}`);
    }

    const distribution: Record<string, number> = {};
    (snapshots || []).forEach((s: any) => {
      const source = s?.data_source || "UNKNOWN";
      distribution[source] = (distribution[source] || 0) + 1;
    });

    return distribution;
  });
}

/**
 * Get monthly session count with snapshots for the authenticated user.
 */
export async function getMonthlyCoverage(
  months: number = 12
): Promise<ServerActionResponse<Array<{ month: string; count: number }>>> {
  return withAuthenticatedAction(async (user, supabase) => {
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    const { data: snapshots, error } = await supabase
      .from("session_forecast_snapshots")
      .select("session_date")
      .eq("user_id", user.id)
      .gte("session_date", startDate.toISOString().split("T")[0])
      .order("session_date", { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch monthly coverage: ${error.message}`);
    }

    const monthlyCounts: Record<string, number> = {};
    (snapshots || []).forEach((s: any) => {
      const d = String(s?.session_date || "");
      if (d.length >= 7) {
        const month = d.substring(0, 7); // YYYY-MM
        monthlyCounts[month] = (monthlyCounts[month] || 0) + 1;
      }
    });

    return Object.entries(monthlyCounts)
      .map(([month, count]) => ({ month, count }))
      .sort((a, b) => b.month.localeCompare(a.month));
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

    return supabase
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

    // Type for beach stats accumulator
    type BeachStatsEntry = {
      sessions: Array<{
        forecast_snapshot?: { wave_height?: string };
        actual_conditions?: { wave_height?: string };
      }>;
      accuracy: number;
    };

    // Group by beach and calculate beach-specific accuracy
    const beachStats = snapshots.reduce<Record<string, BeachStatsEntry>>((acc, snapshot) => {
      const beachName = snapshot.session?.beach_name || "Unknown Beach";
      if (!acc[beachName]) {
        acc[beachName] = { sessions: [], accuracy: 0 };
      }
      acc[beachName].sessions.push(snapshot);
      return acc;
    }, {});

    const topBeaches = Object.entries(beachStats)
      .map(([beachName, stats]: [string, BeachStatsEntry]) => {
        const beachAccuracyScores = stats.sessions.map((snapshot: {
          forecast_snapshot?: { wave_height?: string };
          actual_conditions?: { wave_height?: string };
        }) => {
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
          beachAccuracyScores.reduce((sum: number, score: number) => sum + score, 0) /
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

