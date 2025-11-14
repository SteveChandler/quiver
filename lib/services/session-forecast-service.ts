/**
 * Session Forecast Service
 *
 * Query functions for retrieving and analyzing session forecast snapshots.
 * Snapshots are automatically created by database trigger when sessions are completed.
 *
 * @see supabase/migrations/20250822190000_forecast_calibration_tables.sql
 * @see supabase/migrations/20251028000001_improve_snapshot_function.sql
 */

import { createSupabaseServiceRoleClient } from '@/lib/supabase/server';

/**
 * Structure of the forecast_snapshot JSONB field
 */
export interface ForecastSnapshotData {
  wave_height: number | null;
  wave_period: number | null;
  wave_direction: number | null;
  wind_speed: number | null;
  wind_direction: number | null;
  tide_status: string | null;
  tide_height: number | null;
  confidence_score: number | null;
  data_source: string;
  forecast_time: string;
  forecast_date: string;
  forecast_hour: number;
  // Additional fields from enhanced_forecasts
  swell_1_height?: number | null;
  swell_1_period?: number | null;
  swell_1_direction?: number | null;
  swell_2_height?: number | null;
  swell_2_period?: number | null;
  swell_2_direction?: number | null;
  wind_wave_height?: number | null;
  wind_wave_period?: number | null;
  [key: string]: any; // Allow other forecast fields
}

/**
 * Structure of the actual_conditions JSONB field
 */
export interface ActualConditionsData {
  wave_quality: string | null;
  water_temp: number | null;
  crowd_level: string | null;
  parking_ease: string | null;
  rating: number | null;
  notes: string | null;
  duration_minutes: number | null;
  arrival_time: string;
}

/**
 * Complete session forecast snapshot
 */
export interface SessionForecastSnapshot {
  id: string;
  session_id: string;
  user_id: string;
  beach_id: string;
  forecast_snapshot: ForecastSnapshotData;
  actual_conditions: ActualConditionsData;
  forecast_confidence_score: number | null;
  data_source: string | null;
  session_date: string;
  created_at: string;
  updated_at: string;
}

/**
 * Filters for querying user's forecast history
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
 * Aggregated analysis of user's preferred conditions
 */
export interface PreferredConditionsAnalysis {
  userId: string;
  totalSessions: number;
  highlyRatedSessions: number; // rating >= 4
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
 * Get a single session's forecast snapshot
 *
 * @param sessionId - The session ID
 * @returns The forecast snapshot or null if not found
 */
export async function getSessionForecastSnapshot(
  sessionId: string
): Promise<SessionForecastSnapshot | null> {
  const supabase = createSupabaseServiceRoleClient();

  const { data, error } = await supabase
    .from('session_forecast_snapshots')
    .select('*')
    .eq('session_id', sessionId)
    .single();

  if (error) {
    console.error('Failed to fetch session forecast snapshot:', error);
    return null;
  }

  return data as SessionForecastSnapshot;
}

/**
 * Get a user's historical forecast snapshots with optional filters
 *
 * @param userId - The user ID
 * @param filters - Optional filters for date range, beach, data source, etc.
 * @returns Array of forecast snapshots
 */
export async function getUserForecastHistory(
  userId: string,
  filters?: ForecastHistoryFilters
): Promise<SessionForecastSnapshot[]> {
  const supabase = createSupabaseServiceRoleClient();

  let query = supabase
    .from('session_forecast_snapshots')
    .select('*')
    .eq('user_id', userId)
    .order('session_date', { ascending: false });

  // Apply date range filter
  if (filters?.startDate) {
    query = query.gte('session_date', filters.startDate.toISOString().split('T')[0]);
  }
  if (filters?.endDate) {
    query = query.lte('session_date', filters.endDate.toISOString().split('T')[0]);
  }

  // Apply beach filter
  if (filters?.beachId) {
    query = query.eq('beach_id', filters.beachId);
  }

  // Apply data source filter
  if (filters?.dataSource) {
    query = query.eq('data_source', filters.dataSource);
  }

  // Apply confidence filter
  if (filters?.minConfidence !== undefined) {
    query = query.gte('forecast_confidence_score', filters.minConfidence);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Failed to fetch user forecast history:', error);
    return [];
  }

  let snapshots = data as SessionForecastSnapshot[];

  // Apply rating filter (requires JSONB query, so do it client-side)
  if (filters?.minRating !== undefined) {
    snapshots = snapshots.filter((snapshot) => {
      const rating = snapshot.actual_conditions.rating;
      return rating !== null && rating >= filters.minRating!;
    });
  }

  return snapshots;
}

/**
 * Analyze a user's preferred conditions based on their highly-rated sessions
 *
 * This function aggregates forecast data from sessions rated 4+ to identify
 * the conditions the user enjoys most.
 *
 * @param userId - The user ID
 * @param minRating - Minimum rating to consider (default: 4)
 * @returns Analysis of preferred conditions
 */
export async function analyzePreferredConditions(
  userId: string,
  minRating: number = 4
): Promise<PreferredConditionsAnalysis | null> {
  const supabase = createSupabaseServiceRoleClient();

  // Get all snapshots for the user
  const { data: snapshots, error } = await supabase
    .from('session_forecast_snapshots')
    .select('*')
    .eq('user_id', userId);

  if (error) {
    console.error('Failed to fetch snapshots for analysis:', error);
    return null;
  }

  const typedSnapshots = snapshots as SessionForecastSnapshot[];

  // Filter to highly-rated sessions
  const highlyRatedSnapshots = typedSnapshots.filter(
    (s) => s.actual_conditions.rating !== null && s.actual_conditions.rating >= minRating
  );

  if (highlyRatedSnapshots.length === 0) {
    return {
      userId,
      totalSessions: typedSnapshots.length,
      highlyRatedSessions: 0,
      averageConditions: {
        waveHeight: null,
        wavePeriod: null,
        windSpeed: null,
        tideStatus: {},
      },
      preferredDataSource: null,
      averageConfidence: null,
      beachFrequency: [],
    };
  }

  // Calculate average conditions from highly-rated sessions
  const waveHeights = highlyRatedSnapshots
    .map((s) => s.forecast_snapshot.wave_height)
    .filter((h): h is number => h !== null);

  const wavePeriods = highlyRatedSnapshots
    .map((s) => s.forecast_snapshot.wave_period)
    .filter((p): p is number => p !== null);

  const windSpeeds = highlyRatedSnapshots
    .map((s) => s.forecast_snapshot.wind_speed)
    .filter((w): w is number => w !== null);

  // Aggregate tide status
  const tideStatusCounts: Record<string, number> = {};
  highlyRatedSnapshots.forEach((s) => {
    const tide = s.forecast_snapshot.tide_status;
    if (tide) {
      tideStatusCounts[tide] = (tideStatusCounts[tide] || 0) + 1;
    }
  });

  // Find most common data source
  const dataSourceCounts: Record<string, number> = {};
  highlyRatedSnapshots.forEach((s) => {
    const source = s.data_source;
    if (source) {
      dataSourceCounts[source] = (dataSourceCounts[source] || 0) + 1;
    }
  });
  const preferredDataSource = Object.entries(dataSourceCounts).sort(
    ([, a], [, b]) => b - a
  )[0]?.[0] || null;

  // Calculate average confidence
  const confidenceScores = highlyRatedSnapshots
    .map((s) => s.forecast_confidence_score)
    .filter((c): c is number => c !== null);

  const averageConfidence =
    confidenceScores.length > 0
      ? confidenceScores.reduce((sum, c) => sum + c, 0) / confidenceScores.length
      : null;

  // Aggregate beach frequency
  const beachCounts: Record<string, { count: number; ratings: number[] }> = {};
  highlyRatedSnapshots.forEach((s) => {
    if (!beachCounts[s.beach_id]) {
      beachCounts[s.beach_id] = { count: 0, ratings: [] };
    }
    beachCounts[s.beach_id].count++;
    if (s.actual_conditions.rating !== null) {
      beachCounts[s.beach_id].ratings.push(s.actual_conditions.rating);
    }
  });

  const beachFrequency = Object.entries(beachCounts)
    .map(([beachId, { count, ratings }]) => ({
      beachId,
      sessionCount: count,
      averageRating:
        ratings.length > 0 ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length : 0,
    }))
    .sort((a, b) => b.sessionCount - a.sessionCount)
    .slice(0, 10); // Top 10 beaches

  return {
    userId,
    totalSessions: typedSnapshots.length,
    highlyRatedSessions: highlyRatedSnapshots.length,
    averageConditions: {
      waveHeight: waveHeights.length > 0
        ? waveHeights.reduce((sum, h) => sum + h, 0) / waveHeights.length
        : null,
      wavePeriod: wavePeriods.length > 0
        ? wavePeriods.reduce((sum, p) => sum + p, 0) / wavePeriods.length
        : null,
      windSpeed: windSpeeds.length > 0
        ? windSpeeds.reduce((sum, w) => sum + w, 0) / windSpeeds.length
        : null,
      tideStatus: tideStatusCounts,
    },
    preferredDataSource,
    averageConfidence,
    beachFrequency,
  };
}

/**
 * Get snapshot count by data source for a user
 *
 * Useful for understanding which forecast sources are most common
 * in a user's session history.
 *
 * @param userId - The user ID
 * @returns Object mapping data source to count
 */
export async function getDataSourceDistribution(
  userId: string
): Promise<Record<string, number>> {
  const supabase = createSupabaseServiceRoleClient();

  const { data: snapshots, error } = await supabase
    .from('session_forecast_snapshots')
    .select('data_source')
    .eq('user_id', userId);

  if (error) {
    console.error('Failed to fetch data source distribution:', error);
    return {};
  }

  const distribution: Record<string, number> = {};
  snapshots.forEach((s) => {
    const source = s.data_source || 'UNKNOWN';
    distribution[source] = (distribution[source] || 0) + 1;
  });

  return distribution;
}

/**
 * Get monthly session count with snapshots for a user
 *
 * Useful for tracking user engagement and data collection coverage.
 *
 * @param userId - The user ID
 * @param months - Number of months to look back (default: 12)
 * @returns Array of {month, count} objects
 */
export async function getMonthlyCoverage(
  userId: string,
  months: number = 12
): Promise<Array<{ month: string; count: number }>> {
  const supabase = createSupabaseServiceRoleClient();

  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months);

  const { data: snapshots, error } = await supabase
    .from('session_forecast_snapshots')
    .select('session_date')
    .eq('user_id', userId)
    .gte('session_date', startDate.toISOString().split('T')[0])
    .order('session_date', { ascending: false });

  if (error || !snapshots) {
    console.error('Failed to fetch monthly coverage:', error);
    return [];
  }

  // Group by month
  const monthlyCounts: Record<string, number> = {};
  snapshots.forEach((s) => {
    const month = s.session_date.substring(0, 7); // YYYY-MM
    monthlyCounts[month] = (monthlyCounts[month] || 0) + 1;
  });

  return Object.entries(monthlyCounts)
    .map(([month, count]) => ({ month, count }))
    .sort((a, b) => b.month.localeCompare(a.month));
}
