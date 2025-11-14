/**
 * Preference Learning Service
 *
 * Learns user surf preferences from their session history by analyzing
 * forecast conditions from highly-rated sessions (rating >= 3).
 *
 * Algorithm:
 * - Wave ranges: 10th-90th percentile of good sessions
 * - Wind tolerance: 90th percentile
 * - Wind directions: Mode detection with cardinal clustering (15% frequency)
 * - Tide preferences: Mode detection (20% frequency threshold)
 * - Confidence: Sigmoid function based on sample size
 *
 * Requires minimum 5 rated sessions for statistical validity.
 *
 * @see supabase/migrations/20251103000003_user_surf_preferences.sql
 * @see docs/features/PERSONALIZATION_FORECAST_IMPLEMENTATION.md Phase 5
 */

import { createSupabaseServiceRoleClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database.generated';

/**
 * User surf preferences (matches database schema)
 */
export interface UserSurfPreferences {
  wave_min_ft: number | null;
  wave_max_ft: number | null;
  wave_period_min_s: number | null;
  wave_period_max_s: number | null;
  max_wind_mph: number | null;
  preferred_wind_directions: number[] | null;
  preferred_tide_statuses: string[] | null;
  confidence: number;
  sample_size: number;
  validated_at?: string | null;
  manual_override?: boolean | null;
}

/**
 * Session with forecast snapshot (for analysis)
 */
interface SessionWithConditions {
  id: string;
  rating: number | null;
  arrival_time: string;
  forecast_snapshot: {
    wave_height: number | null;
    wave_period: number | null;
    wind_speed: number | null;
    wind_direction: number | null;
    tide_status: string | null;
    [key: string]: any;
  };
}

/**
 * Compute user surf preferences from their session history
 *
 * Analyzes sessions with rating >= 3 (good experiences) to learn:
 * - Preferred wave height and period ranges (10th-90th percentile)
 * - Maximum wind tolerance (90th percentile)
 * - Preferred wind directions (mode detection)
 * - Preferred tide statuses (mode detection)
 *
 * Automatically saves preferences to database via upsert.
 *
 * @param userId - The user ID
 * @returns Computed preferences or null if insufficient data (<5 sessions)
 *
 * @example
 * const preferences = await computeUserPreferences('user-123');
 * if (preferences) {
 *   console.log(`Wave range: ${preferences.wave_min_ft}-${preferences.wave_max_ft} ft`);
 *   console.log(`Confidence: ${preferences.confidence * 100}%`);
 * }
 */
export async function computeUserPreferences(
  userId: string
): Promise<UserSurfPreferences | null> {
  const supabase = createSupabaseServiceRoleClient();

  try {
    // 1. Get sessions with forecast snapshots (rating >= 3, last 50 sessions)
    const { data: snapshots, error } = await supabase
      .from('session_forecast_snapshots')
      .select(`
        id,
        session_id,
        forecast_snapshot,
        actual_conditions
      `)
      .eq('user_id', userId)
      .order('session_date', { ascending: false })
      .limit(50);

    if (error) {
      console.error(`Failed to fetch sessions for user ${userId}:`, error);
      return null;
    }

    if (!snapshots || snapshots.length === 0) {
      console.log(`No sessions found for user ${userId}`);
      return null;
    }

    // 2. Filter to highly-rated sessions (rating >= 3)
    const goodSessions = snapshots.filter((snapshot) => {
      const rating = snapshot.actual_conditions?.rating;
      return rating !== null && rating !== undefined && rating >= 3;
    });

    if (goodSessions.length < 5) {
      console.log(
        `Not enough data for user ${userId}: ${goodSessions.length} good sessions (need 5+)`
      );
      return null;
    }

    // 3. Extract arrays of values
    const waveHeights = goodSessions
      .map((s) => s.forecast_snapshot?.wave_height)
      .filter((v): v is number => v !== null && v !== undefined);

    const wavePeriods = goodSessions
      .map((s) => s.forecast_snapshot?.wave_period)
      .filter((v): v is number => v !== null && v !== undefined);

    const windSpeeds = goodSessions
      .map((s) => s.forecast_snapshot?.wind_speed)
      .filter((v): v is number => v !== null && v !== undefined);

    const windDirections = goodSessions
      .map((s) => s.forecast_snapshot?.wind_direction)
      .filter((v): v is number => v !== null && v !== undefined);

    const tideStatuses = goodSessions
      .map((s) => s.forecast_snapshot?.tide_status)
      .filter((v): v is string => v !== null && v !== undefined && v !== '');

    // 4. Compute statistics
    const preferences: UserSurfPreferences = {
      wave_min_ft: waveHeights.length >= 5 ? percentile(waveHeights, 10) : null,
      wave_max_ft: waveHeights.length >= 5 ? percentile(waveHeights, 90) : null,
      wave_period_min_s: wavePeriods.length >= 5 ? percentile(wavePeriods, 10) : null,
      wave_period_max_s: wavePeriods.length >= 5 ? percentile(wavePeriods, 90) : null,
      max_wind_mph: windSpeeds.length >= 5 ? percentile(windSpeeds, 90) : null,
      preferred_wind_directions:
        windDirections.length >= 5 ? findModeDirections(windDirections, 45) : null,
      preferred_tide_statuses: tideStatuses.length >= 5 ? findModes(tideStatuses, 0.2) : null,
      confidence: calculateConfidence(goodSessions.length),
      sample_size: goodSessions.length,
    };

    // 5. Upsert to database
    const { error: upsertError } = await supabase
      .from('user_surf_preferences')
      .upsert(
        {
          user_id: userId,
          ...preferences,
          last_computed_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_id',
        }
      );

    if (upsertError) {
      console.error(`Failed to save preferences for user ${userId}:`, upsertError);
      throw new Error(`Failed to save preferences: ${upsertError.message}`);
    }

    console.log(`✅ Computed preferences for user ${userId} (${goodSessions.length} sessions)`);

    return preferences;
  } catch (error) {
    console.error(`Error computing preferences for user ${userId}:`, error);
    return null;
  }
}

/**
 * Get user's learned surf preferences from database
 *
 * @param userId - The user ID
 * @returns User preferences or null if not found
 *
 * @example
 * const preferences = await getUserSurfPreferences('user-123');
 * if (preferences && preferences.confidence > 0.7) {
 *   // Use high-confidence preferences for recommendations
 * }
 */
export async function getUserSurfPreferences(
  userId: string
): Promise<UserSurfPreferences | null> {
  const supabase = createSupabaseServiceRoleClient();

  try {
    const { data, error } = await supabase
      .from('user_surf_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      // Not found is expected for new users
      if (error.code === 'PGRST116') {
        return null;
      }
      console.error(`Failed to fetch preferences for user ${userId}:`, error);
      return null;
    }

    if (!data) return null;

    return {
      wave_min_ft: data.wave_min_ft,
      wave_max_ft: data.wave_max_ft,
      wave_period_min_s: data.wave_period_min_s,
      wave_period_max_s: data.wave_period_max_s,
      max_wind_mph: data.max_wind_mph,
      preferred_wind_directions: data.preferred_wind_directions,
      preferred_tide_statuses: data.preferred_tide_statuses,
      confidence: data.confidence,
      sample_size: data.sample_size,
    };
  } catch (error) {
    console.error(`Error fetching preferences for user ${userId}:`, error);
    return null;
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate percentile of an array
 *
 * Uses linear interpolation between closest ranks.
 *
 * @param arr - Array of numbers
 * @param p - Percentile (0-100)
 * @returns The percentile value
 *
 * @example
 * percentile([1, 2, 3, 4, 5], 50) // Returns 3 (median)
 * percentile([1, 2, 3, 4, 5], 90) // Returns 4.6 (90th percentile)
 */
export function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  if (arr.length === 1) return arr[0];

  const sorted = [...arr].sort((a, b) => a - b);
  const index = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index % 1;

  if (lower === upper) return sorted[lower];

  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

/**
 * Find most common wind directions (within tolerance)
 *
 * Normalizes directions to 8 cardinal directions (N, NE, E, SE, S, SW, W, NW)
 * and returns up to 3 mode directions that appear with at least 15% frequency.
 *
 * @param directions - Array of wind directions in degrees (0-360)
 * @param tolerance - Angular tolerance for clustering (default: 45 degrees)
 * @returns Array of up to 3 mode directions (cardinal degrees)
 *
 * @example
 * findModeDirections([5, 10, 355, 180, 185], 45)
 * // Returns [0, 180] - North and South are the modes
 */
export function findModeDirections(directions: number[], tolerance: number = 45): number[] {
  if (directions.length === 0) return [];

  // 8 cardinal directions (N, NE, E, SE, S, SW, W, NW)
  const cardinals = [0, 45, 90, 135, 180, 225, 270, 315];
  const counts = new Map<number, number>();

  for (const dir of directions) {
    // Normalize direction to 0-360
    const normalized = ((dir % 360) + 360) % 360;

    // Find nearest cardinal
    const nearest = cardinals.reduce((prev, curr) => {
      const prevDist = Math.min(
        Math.abs(prev - normalized),
        360 - Math.abs(prev - normalized)
      );
      const currDist = Math.min(
        Math.abs(curr - normalized),
        360 - Math.abs(curr - normalized)
      );
      return currDist < prevDist ? curr : prev;
    });

    counts.set(nearest, (counts.get(nearest) || 0) + 1);
  }

  // Sort by frequency and return top 3 with at least 15% frequency
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .filter(([_, count]) => count / directions.length >= 0.15)
    .map(([dir, _]) => dir);
}

/**
 * Find mode values (values appearing with >minFreq frequency)
 *
 * Returns all values that appear with at least the specified minimum frequency,
 * sorted by frequency (most common first).
 *
 * @param arr - Array of values
 * @param minFreq - Minimum frequency threshold (0-1, default: 0.2 = 20%)
 * @returns Array of mode values
 *
 * @example
 * findModes(['rising', 'rising', 'high', 'low'], 0.2)
 * // Returns ['rising', 'high'] - both appear >= 20% of the time
 */
export function findModes<T>(arr: T[], minFreq: number = 0.2): T[] {
  if (arr.length === 0) return [];

  const counts = new Map<T, number>();

  for (const val of arr) {
    counts.set(val, (counts.get(val) || 0) + 1);
  }

  return Array.from(counts.entries())
    .filter(([_, count]) => count / arr.length >= minFreq)
    .sort((a, b) => b[1] - a[1])
    .map(([val, _]) => val);
}

/**
 * Calculate confidence score based on sample size
 *
 * Uses sigmoid function to prevent overconfidence from small datasets:
 * - 5 sessions → 0.5 confidence (50%)
 * - 10 sessions → 0.73 confidence (73%)
 * - 20+ sessions → 0.95+ confidence (95%+)
 *
 * Formula: 1 / (1 + exp(-k * (n - n0)))
 * Where k ≈ 0.2 (steepness), n0 = 5 (midpoint at 50%)
 *
 * @param n - Number of sessions (sample size)
 * @returns Confidence score (0-1)
 *
 * @example
 * calculateConfidence(5)  // Returns ~0.5
 * calculateConfidence(10) // Returns ~0.73
 * calculateConfidence(20) // Returns ~0.95
 */
export function calculateConfidence(n: number): number {
  if (n <= 0) return 0;

  // Sigmoid: 1 / (1 + exp(-k * (n - n0)))
  // Tuned so that: 5 sessions → 0.5, 10 sessions → 0.73, 20+ sessions → 0.95+
  const k = 0.2; // Steepness factor (derived from target values)
  const n0 = 5; // Midpoint (50% confidence at 5 sessions)
  const confidence = 1 / (1 + Math.exp(-k * (n - n0)));

  // Round to 2 decimal places
  return Math.round(confidence * 100) / 100;
}
