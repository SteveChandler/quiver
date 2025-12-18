/**
 * Similarity Insights Service
 *
 * Computes personalized insights by comparing forecast conditions to user's
 * past high-rated sessions. Uses bucket-based similarity scoring to match
 * current conditions with historical session data.
 *
 * ALGORITHM:
 * 1. Fetch user's rated sessions (rating >= 3) from last 12 months with forecast snapshots
 * 2. Compute bucket-based similarity scores using weighted factors:
 *    - Wave height: 35%
 *    - Wave period: 25%
 *    - Wind speed: 20%
 *    - Wind direction: 10%
 *    - Tide: 10%
 * 3. Select top 5 most similar sessions (>=60% similarity threshold)
 * 4. Calculate average match percent
 * 5. Generate label: Perfect (>=80), Great (60-79), Good (40-59), Low (<40)
 * 6. Generate reason bullets including cross-spot explanation when appropriate
 * 7. Compute board tip if majority board exists
 *
 * @module lib/services/similarity-insights-service
 */

import { createSupabaseServiceRoleClient } from '@/lib/supabase/server';
import type {
  PersonalizedInsights,
  SimilarSessionInsight,
  SimilarityInsightsInput,
  BoardSnapshot,
} from '@/types/personalization';

// ============================================================================
// Constants
// ============================================================================

const RATING_THRESHOLD = 3; // Minimum session rating to consider
const LOOKBACK_MONTHS = 12; // How far back to search for sessions
const TOP_K_SESSIONS = 5; // Number of similar sessions to return
const MIN_SESSIONS_FOR_INSIGHTS = 3; // Minimum rated sessions needed
const SIMILARITY_THRESHOLD = 0.6; // 60% - minimum similarity to include
const CROSS_SPOT_THRESHOLD = 0.5; // 50% - threshold for cross-spot explanation

// Similarity weights (must sum to 1.0)
const WEIGHTS = {
  waveHeight: 0.35,
  wavePeriod: 0.25,
  windSpeed: 0.20,
  windDirection: 0.10,
  tide: 0.10,
};

// Wave height buckets (in feet)
const WAVE_HEIGHT_BUCKETS = [
  { min: 0, max: 2, label: '0-2 ft' },
  { min: 2, max: 4, label: '2-4 ft' },
  { min: 4, max: 6, label: '4-6 ft' },
  { min: 6, max: 8, label: '6-8 ft' },
  { min: 8, max: Infinity, label: '8+ ft' },
];

// Wave period buckets (in seconds)
const WAVE_PERIOD_BUCKETS = [
  { min: 0, max: 8, label: '0-8s' },
  { min: 8, max: 12, label: '8-12s' },
  { min: 12, max: 16, label: '12-16s' },
  { min: 16, max: Infinity, label: '16+ s' },
];

// Wind speed buckets (in mph)
const WIND_SPEED_BUCKETS = [
  { min: 0, max: 5, label: '0-5 mph' },
  { min: 5, max: 10, label: '5-10 mph' },
  { min: 10, max: 15, label: '10-15 mph' },
  { min: 15, max: Infinity, label: '15+ mph' },
];

// Wind direction buckets (8 cardinal directions, 45° each)
const WIND_DIRECTION_BUCKETS = [
  { min: 337.5, max: 22.5, label: 'N' },
  { min: 22.5, max: 67.5, label: 'NE' },
  { min: 67.5, max: 112.5, label: 'E' },
  { min: 112.5, max: 157.5, label: 'SE' },
  { min: 157.5, max: 202.5, label: 'S' },
  { min: 202.5, max: 247.5, label: 'SW' },
  { min: 247.5, max: 292.5, label: 'W' },
  { min: 292.5, max: 337.5, label: 'NW' },
];

// ============================================================================
// Main Entry Point
// ============================================================================

/**
 * Compute personalized insights for a forecast
 *
 * Compares forecast conditions to user's historical high-rated sessions
 * and returns personalized insights with similar sessions and recommendations.
 *
 * @param userId - User ID
 * @param input - Forecast conditions to match against
 * @returns PersonalizedInsights with match quality and recommendations
 *
 * @example
 * const insights = await computeSimilarityInsights('user-123', {
 *   beachId: 'beach-456',
 *   beachName: 'Ocean Beach',
 *   waveHeight: 4.5,
 *   wavePeriod: 12,
 *   windSpeed: 8,
 *   windDirection: 270,
 * });
 */
export async function computeSimilarityInsights(
  userId: string,
  input: SimilarityInsightsInput
): Promise<PersonalizedInsights> {
  try {
    // Computing similarity insights for user

    // 1. Fetch user's rated sessions with forecast snapshots
    const sessions = await fetchRatedSessions(userId);

    // Sessions fetched - proceed with scoring

    // 2. Check if we have enough data
    if (sessions.length < MIN_SESSIONS_FOR_INSIGHTS) {
      return {
        matchPercent: 0,
        label: 'Insufficient Data',
        reasonBullets: [
          'Log more surf sessions to see personalized insights',
          'Rate your sessions to help us understand your preferences',
        ],
        similarSessions: [],
        boardTip: null,
        sessionCount: sessions.length,
        state: 'onboarding',
      };
    }

    // 3. Filter sessions with forecast snapshots
    const sessionsWithSnapshots = sessions.filter((s) => s.forecast_snapshot !== null);

    if (sessionsWithSnapshots.length === 0) {
      return {
        matchPercent: 0,
        label: 'Insufficient Data',
        reasonBullets: [
          'No historical condition data available yet',
          'New sessions will automatically track conditions',
        ],
        similarSessions: [],
        boardTip: null,
        sessionCount: sessions.length,
        state: 'degraded',
      };
    }

    // 4. Compute similarity scores for each session
    const scoredSessions = sessionsWithSnapshots.map((session) => {
      const similarity = computeSimilarityScore(input, session);
      return { session, similarity };
    });

    // 5. Filter by threshold and sort by similarity
    const filteredSessions = scoredSessions
      .filter((s) => s.similarity >= SIMILARITY_THRESHOLD)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, TOP_K_SESSIONS);

    if (filteredSessions.length === 0) {
      return {
        matchPercent: 0,
        label: 'Low',
        reasonBullets: [
          'These conditions are different from your past high-rated sessions',
          'Could be a good opportunity to try something new!',
        ],
        similarSessions: [],
        boardTip: null,
        sessionCount: sessions.length,
        state: 'ready',
      };
    }

    // 6. Calculate average match percent
    const avgSimilarity =
      filteredSessions.reduce((sum, s) => sum + s.similarity, 0) / filteredSessions.length;
    const matchPercent = Math.round(avgSimilarity * 100);

    // 7. Generate label
    const label = getMatchLabel(matchPercent);

    // 8. Convert to SimilarSessionInsight format
    const similarSessions: SimilarSessionInsight[] = filteredSessions.map(({ session, similarity }) => ({
      id: session.id,
      beachName: session.beach_name || 'Unknown Beach',
      beachId: session.beach_id || '',
      sessionDate: session.arrival_time || '',
      rating: session.rating || 0,
      waveHeight: session.forecast_snapshot?.wave_height ?? null,
      wavePeriod: session.forecast_snapshot?.wave_period ?? null,
      windSpeed: session.forecast_snapshot?.wind_speed ?? null,
      boardName: session.board_snapshot?.name ?? null,
      boardType: session.board_snapshot?.board_type ?? null,
      similarityScore: Math.round(similarity * 100),
    }));

    // 9. Generate reason bullets
    const reasonBullets = generateReasonBullets(input, similarSessions, sessions.length);

    // 10. Compute board tip
    const boardTip = computeBoardTip(similarSessions);

    // Insights computed successfully

    return {
      matchPercent,
      label,
      reasonBullets,
      similarSessions,
      boardTip,
      sessionCount: sessions.length,
      state: 'ready',
    };
  } catch (error) {
    console.error('[SimilarityInsights] Error:', error);
    return {
      matchPercent: 0,
      label: 'Insufficient Data',
      reasonBullets: ['Unable to compute insights at this time'],
      similarSessions: [],
      boardTip: null,
      sessionCount: 0,
      state: 'degraded',
    };
  }
}

// ============================================================================
// Data Fetching
// ============================================================================

interface SessionWithSnapshot {
  id: string;
  beach_id: string | null;
  beach_name: string | null;
  arrival_time: string | null;
  rating: number | null;
  forecast_snapshot: {
    wave_height?: number;
    wave_period?: number;
    wind_speed?: number;
    wind_direction?: number;
    tide_height?: number;
    tide_status?: string;
  } | null;
  board_snapshot: BoardSnapshot | null;
}

/**
 * Fetch user's rated sessions from last 12 months
 *
 * NOTE: Uses service role client to bypass RLS. This is intentional because:
 * 1. The userId is pre-validated in the API layer (authenticated user)
 * 2. We only query the user's own data (filtered by userId)
 * 3. This pattern aligns with lib/services/ARCHITECTURE.md guidelines
 */
async function fetchRatedSessions(userId: string): Promise<SessionWithSnapshot[]> {
  const supabase = createSupabaseServiceRoleClient();

  const lookbackDate = new Date();
  lookbackDate.setMonth(lookbackDate.getMonth() - LOOKBACK_MONTHS);

  try {
    const { data, error } = await supabase
      .from('sessions')
      .select('id, beach_id, beach_name, arrival_time, rating, forecast_snapshot, board_snapshot')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .gte('rating', RATING_THRESHOLD)
      .gte('arrival_time', lookbackDate.toISOString())
      .order('arrival_time', { ascending: false });

    if (error) {
      console.error('Error fetching rated sessions:', error);
      return [];
    }

    return (data || []) as SessionWithSnapshot[];
  } catch (error) {
    console.error('Error in fetchRatedSessions:', error);
    return [];
  }
}

// ============================================================================
// Similarity Scoring
// ============================================================================

/**
 * Compute similarity score between forecast and historical session
 *
 * Uses bucket-based matching with weighted factors:
 * - Wave height: 35%
 * - Wave period: 25%
 * - Wind speed: 20%
 * - Wind direction: 10%
 * - Tide: 10%
 *
 * @returns Similarity score between 0 and 1
 */
function computeSimilarityScore(
  forecast: SimilarityInsightsInput,
  session: SessionWithSnapshot
): number {
  const snapshot = session.forecast_snapshot;
  if (!snapshot) return 0;

  let totalScore = 0;
  let totalWeight = 0;

  // 1. Wave height similarity (35%)
  if (snapshot.wave_height !== undefined && snapshot.wave_height !== null) {
    const heightSimilarity = bucketMatch(
      forecast.waveHeight,
      snapshot.wave_height,
      WAVE_HEIGHT_BUCKETS
    );
    totalScore += heightSimilarity * WEIGHTS.waveHeight;
    totalWeight += WEIGHTS.waveHeight;
  }

  // 2. Wave period similarity (25%)
  if (snapshot.wave_period !== undefined && snapshot.wave_period !== null) {
    const periodSimilarity = bucketMatch(
      forecast.wavePeriod,
      snapshot.wave_period,
      WAVE_PERIOD_BUCKETS
    );
    totalScore += periodSimilarity * WEIGHTS.wavePeriod;
    totalWeight += WEIGHTS.wavePeriod;
  }

  // 3. Wind speed similarity (20%)
  if (snapshot.wind_speed !== undefined && snapshot.wind_speed !== null) {
    const windSpeedSimilarity = bucketMatch(
      forecast.windSpeed,
      snapshot.wind_speed,
      WIND_SPEED_BUCKETS
    );
    totalScore += windSpeedSimilarity * WEIGHTS.windSpeed;
    totalWeight += WEIGHTS.windSpeed;
  }

  // 4. Wind direction similarity (10%) - only if both present
  if (
    forecast.windDirection !== undefined &&
    snapshot.wind_direction !== undefined &&
    snapshot.wind_direction !== null
  ) {
    const windDirSimilarity = windDirectionMatch(forecast.windDirection, snapshot.wind_direction);
    totalScore += windDirSimilarity * WEIGHTS.windDirection;
    totalWeight += WEIGHTS.windDirection;
  }

  // 5. Tide similarity (10%) - only if both present
  if (
    forecast.tideHeight !== undefined &&
    snapshot.tide_height !== undefined &&
    snapshot.tide_height !== null
  ) {
    // Simple range-based similarity: within 2ft = 100%, within 4ft = 50%, else 0%
    const tideDiff = Math.abs(forecast.tideHeight - snapshot.tide_height);
    const tideSimilarity = tideDiff <= 2 ? 1.0 : tideDiff <= 4 ? 0.5 : 0.0;
    totalScore += tideSimilarity * WEIGHTS.tide;
    totalWeight += WEIGHTS.tide;
  }

  // Normalize by total weight (in case some factors were missing)
  return totalWeight > 0 ? totalScore / totalWeight : 0;
}

/**
 * Check if two values fall in the same bucket
 */
function bucketMatch(
  value1: number,
  value2: number,
  buckets: Array<{ min: number; max: number; label: string }>
): number {
  const bucket1 = buckets.find((b) => value1 >= b.min && value1 < b.max);
  const bucket2 = buckets.find((b) => value2 >= b.min && value2 < b.max);

  if (bucket1 && bucket2 && bucket1.label === bucket2.label) {
    return 1.0; // Perfect match - same bucket
  }

  // If either value falls outside all bucket ranges, no match
  if (!bucket1 || !bucket2) {
    return 0.0;
  }

  // Adjacent bucket match gets 50% credit
  const bucket1Index = buckets.indexOf(bucket1);
  const bucket2Index = buckets.indexOf(bucket2);

  if (Math.abs(bucket1Index - bucket2Index) === 1) {
    return 0.5;
  }

  return 0.0;
}

/**
 * Compute wind direction similarity
 *
 * Uses circular distance (handles 0°/360° wraparound)
 */
function windDirectionMatch(dir1: number, dir2: number): number {
  // Normalize to 0-360
  const norm1 = ((dir1 % 360) + 360) % 360;
  const norm2 = ((dir2 % 360) + 360) % 360;

  // Calculate circular distance
  const diff = Math.abs(norm1 - norm2);
  const circularDiff = Math.min(diff, 360 - diff);

  // Within 45° (same cardinal direction) = 100%
  // Within 90° (adjacent direction) = 50%
  // Beyond 90° = 0%
  if (circularDiff <= 45) return 1.0;
  if (circularDiff <= 90) return 0.5;
  return 0.0;
}

// ============================================================================
// Insight Generation
// ============================================================================

/**
 * Get match quality label from percentage
 */
function getMatchLabel(matchPercent: number): PersonalizedInsights['label'] {
  if (matchPercent >= 80) return 'Perfect';
  if (matchPercent >= 60) return 'Great';
  if (matchPercent >= 40) return 'Good';
  return 'Low';
}

/**
 * Generate reason bullets explaining the match
 */
function generateReasonBullets(
  input: SimilarityInsightsInput,
  similarSessions: SimilarSessionInsight[],
  totalSessionCount: number
): string[] {
  const reasons: string[] = [];

  if (similarSessions.length === 0) {
    return ['No similar sessions found in your history'];
  }

  // 1. Overall match summary
  const avgRating = (
    similarSessions.reduce((sum, s) => sum + s.rating, 0) / similarSessions.length
  ).toFixed(1);
  reasons.push(
    `You've surfed similar conditions ${similarSessions.length} times with an average rating of ${avgRating}/5`
  );

  // 2. Cross-spot explanation (only if >50% of similar sessions are from different beaches)
  const currentBeachSessions = similarSessions.filter((s) => s.beachId === input.beachId).length;
  const crossSpotPercent = 1 - currentBeachSessions / similarSessions.length;

  if (crossSpotPercent > CROSS_SPOT_THRESHOLD) {
    const otherBeaches = [...new Set(similarSessions.map((s) => s.beachName))].filter(
      (name) => name !== input.beachName
    );
    if (otherBeaches.length > 0) {
      const beachList = otherBeaches.slice(0, 2).join(' and ');
      reasons.push(`Similar conditions at ${beachList} worked well for you`);
    }
  }

  // 3. Wave conditions pattern
  const avgWaveHeight =
    similarSessions.reduce((sum, s) => sum + (s.waveHeight || 0), 0) / similarSessions.length;
  if (avgWaveHeight > 0) {
    const heightBucket = WAVE_HEIGHT_BUCKETS.find(
      (b) => input.waveHeight >= b.min && input.waveHeight < b.max
    );
    if (heightBucket) {
      reasons.push(`You've had great sessions in ${heightBucket.label} waves`);
    }
  }

  // 4. Confidence booster
  reasons.push('These conditions match your surfing sweet spot');

  return reasons;
}

/**
 * Compute board recommendation based on similar sessions
 *
 * Returns board tip if >=60% of similar sessions used the same board type
 */
function computeBoardTip(similarSessions: SimilarSessionInsight[]): string | null {
  if (similarSessions.length === 0) return null;

  // Count board types
  const boardTypeCounts = new Map<string, number>();
  const boardNames = new Map<string, string>();

  for (const session of similarSessions) {
    if (session.boardType && session.boardName) {
      const count = boardTypeCounts.get(session.boardType) || 0;
      boardTypeCounts.set(session.boardType, count + 1);
      boardNames.set(session.boardType, session.boardName);
    }
  }

  // Find majority board type (>=60%)
  const majorityThreshold = similarSessions.length * 0.6;

  for (const [boardType, count] of boardTypeCounts.entries()) {
    if (count >= majorityThreshold) {
      const boardName = boardNames.get(boardType);
      return `You've used your ${boardName || boardType} for ${Math.round((count / similarSessions.length) * 100)}% of similar sessions`;
    }
  }

  return null;
}
