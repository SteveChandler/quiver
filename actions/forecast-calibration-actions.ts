"use server";

import { withAuthenticatedAction, withDatabaseOperation, type ServerActionResponse } from "@/lib/server-action-utils";
import type { SessionForecastSnapshot, BeachForecastAccuracy } from "@/types/database";

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
  }, { allowNull: true });
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

