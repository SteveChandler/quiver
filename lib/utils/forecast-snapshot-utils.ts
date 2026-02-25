/**
 * Forecast Snapshot Utilities
 *
 * Utilities for creating forecast snapshots when sessions are completed.
 * Snapshots capture the forecast conditions at the time of the session
 * alongside the actual conditions reported by the user.
 */

import { createSupabaseServiceRoleClient as createServiceRoleClient } from "@/lib/supabase/server";

interface SessionForSnapshot {
  id: string;
  user_id: string;
  beach_id: string;
  arrival_time: string;
  wave_quality?: number | null;
  water_temp?: number | null;
  crowd_level?: number | null;
  parking_ease?: number | null;
  rating?: number | null;
  notes?: string | null;
  duration_minutes?: number | null;
  wave_height_ft?: number | null;
  wind_speed_mph?: number | null;
  wind_direction?: string | null;
  forecast_accuracy?: string | null;
  tide_height_ft?: number | null;
  tide_status?: string | null;
}

interface EnhancedForecast {
  id: string;
  beach_id: string;
  forecast_at?: string;
  forecast_date: string;
  forecast_time: string;
  wave_height?: string | null;
  wave_period?: string | null;
  wave_direction?: string | null;
  swell_1_height?: string | null;
  swell_1_period?: string | null;
  swell_1_direction?: string | null;
  swell_2_height?: string | null;
  swell_2_period?: string | null;
  swell_2_direction?: string | null;
  wind_wave_height?: string | null;
  wind_wave_period?: string | null;
  wind_wave_direction?: string | null;
  wind_speed?: string | null;
  wind_speed_mph?: number | null;
  wind_direction?: string | null;
  wind_direction_deg?: number | null;
  air_temperature?: string | null;
  water_temp?: string | null;
  tide_height?: string | null;
  tide_status?: string | null;
  weather_condition?: string | null;
  confidence_score?: number | null;
  data_source?: string | null;
  raw_forecast?: Record<string, any> | null;
  created_at?: string;
  updated_at?: string;
}

interface ForecastVsActualDiff {
  wave_height_ft?: { forecast: number; actual: number; diff: number };
  wind_speed_mph?: { forecast: number; actual: number; diff: number };
  wind_direction?: { forecast: string; actual: string };
  tide_height_ft?: { forecast: number; actual: number; diff: number };
  tide_status?: { forecast: string; actual: string };
}

/**
 * Calculates the forecast vs actual diff for fields where both values exist and differ.
 *
 * @param forecast - The forecast data
 * @param session - The session data with actual conditions
 * @returns Diff object containing only fields where forecast and actual differ
 */
function calculateForecastVsActual(
  forecast: EnhancedForecast,
  session: SessionForSnapshot
): ForecastVsActualDiff {
  const diff: ForecastVsActualDiff = {};

  // Wave height comparison (forecast is string, session is number)
  if (forecast.wave_height && session.wave_height_ft != null) {
    const forecastHeight = parseFloat(forecast.wave_height);
    const actualHeight = session.wave_height_ft;
    if (!isNaN(forecastHeight) && forecastHeight !== actualHeight) {
      diff.wave_height_ft = {
        forecast: forecastHeight,
        actual: actualHeight,
        diff: actualHeight - forecastHeight,
      };
    }
  }

  // Wind speed comparison
  if (forecast.wind_speed_mph != null && session.wind_speed_mph != null) {
    const forecastSpeed = forecast.wind_speed_mph;
    const actualSpeed = session.wind_speed_mph;
    if (forecastSpeed !== actualSpeed) {
      diff.wind_speed_mph = {
        forecast: forecastSpeed,
        actual: actualSpeed,
        diff: actualSpeed - forecastSpeed,
      };
    }
  }

  // Wind direction comparison (string)
  if (forecast.wind_direction && session.wind_direction) {
    const forecastDir = forecast.wind_direction;
    const actualDir = session.wind_direction;
    if (forecastDir !== actualDir) {
      diff.wind_direction = {
        forecast: forecastDir,
        actual: actualDir,
      };
    }
  }

  // Tide height comparison (forecast is string, session is number)
  if (forecast.tide_height && session.tide_height_ft != null) {
    const forecastTide = parseFloat(forecast.tide_height);
    const actualTide = session.tide_height_ft;
    if (!isNaN(forecastTide) && forecastTide !== actualTide) {
      diff.tide_height_ft = {
        forecast: forecastTide,
        actual: actualTide,
        diff: actualTide - forecastTide,
      };
    }
  }

  // Tide status comparison (string)
  if (forecast.tide_status && session.tide_status) {
    const forecastStatus = forecast.tide_status;
    const actualStatus = session.tide_status;
    if (forecastStatus !== actualStatus) {
      diff.tide_status = {
        forecast: forecastStatus,
        actual: actualStatus,
      };
    }
  }

  return diff;
}

/**
 * Creates a forecast snapshot for a completed session.
 *
 * This function:
 * 1. Finds the closest forecast to the session arrival_time
 * 2. Captures actual conditions from the session
 * 3. Inserts a snapshot record linking them together
 *
 * @param sessionId - The session ID
 * @param beachId - The beach ID
 * @param arrivalTime - The session arrival time (ISO string or Date)
 * @param userId - The user ID (optional, will be fetched from session if not provided)
 * @returns The created snapshot or null if no forecast data available
 */
export async function createForecastSnapshotForSession(
  sessionId: string,
  beachId: string,
  arrivalTime: string | Date,
  userId?: string
): Promise<{ success: boolean; error?: string; snapshot?: any }> {
  try {
    // Use service role client to bypass RLS policies
    const supabase = await createServiceRoleClient();

    // Convert arrival time to Date object
    const arrivalDate = typeof arrivalTime === 'string'
      ? new Date(arrivalTime)
      : arrivalTime;

    const arrivalDateStr = arrivalDate.toISOString().split('T')[0];
    const arrivalTimeStr = arrivalDate.toISOString().split('T')[1].substring(0, 5); // HH:MM

    // Always fetch session to verify ownership and get data
    const { data: sessionData, error: sessionError } = await supabase
      .from('sessions')
      .select('id, user_id, beach_id, arrival_time, wave_quality, water_temp, crowd_level, parking_ease, rating, notes, duration_minutes, wave_height_ft, wind_speed_mph, wind_direction, forecast_accuracy, tide_height_ft, tide_status')
      .eq('id', sessionId)
      .single();

    if (sessionError) {
      console.error('[Snapshot] Failed to fetch session:', sessionError);
      return { success: false, error: 'Failed to fetch session' };
    }

    const session: SessionForSnapshot = sessionData;

    // Security: Validate that provided userId matches the session's user_id
    // This prevents inserting snapshots for sessions owned by other users
    if (userId && userId !== session.user_id) {
      console.error('[Snapshot] userId mismatch:', { provided: userId, actual: session.user_id });
      return { success: false, error: 'User ID does not match session owner' };
    }

    const sessionUserId = session.user_id;

    // Check if snapshot already exists
    const { data: existingSnapshot } = await supabase
      .from('session_forecast_snapshots')
      .select('id')
      .eq('session_id', sessionId)
      .maybeSingle();

    if (existingSnapshot) {
      // Snapshot already exists, skip creation
      return { success: true, snapshot: existingSnapshot };
    }

    // Find the closest forecast to the arrival time
    // Calculate next day for range query
    const nextDay = new Date(arrivalDate);
    nextDay.setDate(nextDay.getDate() + 1);
    const nextDayStr = nextDay.toISOString().split('T')[0];

    const { data: forecasts, error: forecastError } = await supabase
      .from('enhanced_forecasts')
      .select('*')
      .eq('beach_id', beachId)
      .gte('forecast_at', `${arrivalDateStr}T00:00:00Z`)
      .lt('forecast_at', `${nextDayStr}T00:00:00Z`)
      .order('forecast_at', { ascending: true });

    if (forecastError) {
      console.error('[Snapshot] Failed to fetch forecasts:', forecastError);
      return { success: false, error: 'Failed to fetch forecasts' };
    }

    if (!forecasts || forecasts.length === 0) {
      // No forecast data available for this beach/date
      if (process.env.NODE_ENV === 'development') {
        console.log(`[Snapshot] No forecast data available for beach ${beachId} on ${arrivalDateStr}`);
      }
      return { success: false, error: 'No forecast data available' };
    }

    // Find closest forecast by time
    let closestForecast: EnhancedForecast | null = null;
    let minTimeDiff = Infinity;

    for (const forecast of forecasts) {
      // Prefer forecast_at if available, fall back to legacy fields
      const forecastTimestamp = forecast.forecast_at
        ? new Date(forecast.forecast_at).getTime()
        : new Date(`${forecast.forecast_date}T${forecast.forecast_time}Z`).getTime();

      const arrivalTimestamp = arrivalDate.getTime();
      const timeDiff = Math.abs(forecastTimestamp - arrivalTimestamp);

      if (timeDiff < minTimeDiff) {
        minTimeDiff = timeDiff;
        closestForecast = forecast as unknown as EnhancedForecast;
      }
    }

    if (!closestForecast) {
      return { success: false, error: 'Could not find closest forecast' };
    }

    // Session was already fetched above for ownership validation

    // Build forecast snapshot (full forecast record as JSON)
    const forecastSnapshot = closestForecast;

    // Build actual conditions from session data
    const actualConditions = {
      wave_quality: session?.wave_quality,
      water_temp: session?.water_temp,
      crowd_level: session?.crowd_level,
      parking_ease: session?.parking_ease,
      rating: session?.rating,
      notes: session?.notes,
      duration_minutes: session?.duration_minutes,
      arrival_time: session?.arrival_time,
      wave_height_ft: session?.wave_height_ft,
      wind_speed_mph: session?.wind_speed_mph,
      wind_direction: session?.wind_direction,
      forecast_accuracy: session?.forecast_accuracy,
      tide_height_ft: session?.tide_height_ft,
      tide_status: session?.tide_status,
    };

    // Calculate forecast vs actual diff
    const forecastVsActual = calculateForecastVsActual(closestForecast, session);

    // Insert snapshot
    const { data: snapshot, error: insertError } = await supabase
      .from('session_forecast_snapshots')
      .insert({
        session_id: sessionId,
        user_id: sessionUserId!,
        beach_id: beachId,
        forecast_snapshot: forecastSnapshot as any,
        actual_conditions: actualConditions as any,
        forecast_vs_actual: forecastVsActual as any,
        forecast_confidence_score: closestForecast.confidence_score || null,
        data_source: closestForecast.data_source || null,
        session_date: arrivalDateStr,
      })
      .select()
      .single();

    if (insertError) {
      // Check if it's a duplicate key error (snapshot already exists)
      if (insertError.code === '23505') {
        // Unique constraint violation - snapshot already exists
        return { success: true, error: 'Snapshot already exists' };
      }

      console.error('[Snapshot] Failed to insert snapshot:', insertError);
      return { success: false, error: insertError.message };
    }

    if (process.env.NODE_ENV === 'development') {
      console.log(`[Snapshot] Created for session ${sessionId}, forecast time diff: ${minTimeDiff} minutes`);
    }

    return { success: true, snapshot };
  } catch (error) {
    console.error('[Snapshot] Unexpected error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Batch create forecast snapshots for multiple sessions.
 * Useful for backfilling or bulk operations.
 *
 * @param sessions - Array of session objects with id, beach_id, arrival_time, user_id
 * @returns Array of results for each session
 */
async function batchCreateForecastSnapshots(
  sessions: Array<{
    id: string;
    beach_id: string;
    arrival_time: string;
    user_id: string;
  }>
): Promise<Array<{ sessionId: string; success: boolean; error?: string }>> {
  const results = [];

  for (const session of sessions) {
    const result = await createForecastSnapshotForSession(
      session.id,
      session.beach_id,
      session.arrival_time,
      session.user_id
    );

    results.push({
      sessionId: session.id,
      success: result.success,
      error: result.error,
    });
  }

  return results;
}
