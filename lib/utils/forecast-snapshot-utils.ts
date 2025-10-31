/**
 * Forecast Snapshot Utilities
 *
 * Utilities for creating forecast snapshots when sessions are completed.
 * Snapshots capture the forecast conditions at the time of the session
 * alongside the actual conditions reported by the user.
 */

import { createClient, createSupabaseServiceRoleClient as createServiceRoleClient } from "@/lib/supabase/server";

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
}

interface EnhancedForecast {
  id: string;
  beach_id: string;
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

    // Get session details if userId not provided
    let sessionUserId = userId;
    let session: SessionForSnapshot | null = null;

    if (!sessionUserId) {
      const { data: sessionData, error: sessionError } = await supabase
        .from('sessions')
        .select('id, user_id, beach_id, arrival_time, wave_quality, water_temp, crowd_level, parking_ease, rating, notes, duration_minutes')
        .eq('id', sessionId)
        .single();

      if (sessionError) {
        console.error('[Snapshot] Failed to fetch session:', sessionError);
        return { success: false, error: 'Failed to fetch session' };
      }

      session = sessionData;
      sessionUserId = sessionData.user_id;
    }

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
    const { data: forecasts, error: forecastError } = await supabase
      .from('enhanced_forecasts')
      .select('*')
      .eq('beach_id', beachId)
      .eq('forecast_date', arrivalDateStr)
      .order('forecast_time', { ascending: true });

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
      const forecastTime = forecast.forecast_time || '00:00';
      const [forecastHour, forecastMin] = forecastTime.split(':').map(Number);
      const [arrivalHour, arrivalMin] = arrivalTimeStr.split(':').map(Number);

      const forecastMinutes = forecastHour * 60 + forecastMin;
      const arrivalMinutes = arrivalHour * 60 + arrivalMin;
      const timeDiff = Math.abs(forecastMinutes - arrivalMinutes);

      if (timeDiff < minTimeDiff) {
        minTimeDiff = timeDiff;
        closestForecast = forecast;
      }
    }

    if (!closestForecast) {
      return { success: false, error: 'Could not find closest forecast' };
    }

    // Get session data for actual conditions if not already fetched
    if (!session) {
      const { data: sessionData, error: sessionError } = await supabase
        .from('sessions')
        .select('id, user_id, beach_id, arrival_time, wave_quality, water_temp, crowd_level, parking_ease, rating, notes, duration_minutes')
        .eq('id', sessionId)
        .single();

      if (sessionError) {
        console.error('[Snapshot] Failed to fetch session for conditions:', sessionError);
        return { success: false, error: 'Failed to fetch session' };
      }

      session = sessionData;
    }

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
    };

    // Insert snapshot
    const { data: snapshot, error: insertError } = await supabase
      .from('session_forecast_snapshots')
      .insert({
        session_id: sessionId,
        user_id: sessionUserId!,
        beach_id: beachId,
        forecast_snapshot: forecastSnapshot,
        actual_conditions: actualConditions,
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
export async function batchCreateForecastSnapshots(
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
