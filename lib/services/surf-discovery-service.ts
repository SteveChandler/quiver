/**
 * Surf Discovery Service
 *
 * Discovers and ranks multiple surf spots for users based on:
 * 1. Current conditions (waves, wind, tide)
 * 2. User preferences and comfort ranges
 * 3. Beach-specific metadata (swell windows, wind directions, tide preferences)
 * 4. Familiarity (session history at each beach)
 * 5. Distance (GPS phase - currently stubbed)
 *
 * Transforms "personalized forecast" (single beach) into
 * "where should I surf?" (ranked discovery list).
 *
 * WINDOW SELECTION ALGORITHM:
 * - Evaluates each 3-hour forecast window using composite scoring
 * - Composite = (conditionsScore * 0.7) + (confidenceScore * 0.3)
 * - Conditions score: wave height fit + period energy + wind alignment + tide fit
 * - Tie-breaking: Prefer better conditions, then later timestamp
 * - This prevents defaulting to midnight when all confidence scores are equal
 *
 * Performance: 4 DB queries total, parallel forecast fetching, 12s timeout
 *
 * @module lib/services/surf-discovery-service
 */

import { createSupabaseServiceRoleClient } from '@/lib/supabase/server';
import { getUserSurfPreferences } from './preference-learning-service';
import { buildCandidatePool } from './discovery/candidate-pool-builder';
import { getTimezoneFromCoords } from '@/lib/utils/timezone-utils.server';
import { createContextLogger } from "@/lib/logger";

const log = createContextLogger('SurfDiscovery');
import type { Beach } from '@/types/database';
import type { EnhancedForecastEntity } from '@/types/forecast';
import type {
  SurfDiscoveryRecommendation,
  SurfDiscoveryResponse,
  SurfDiscoveryOptions,
  DetailedScore,
  PersonalizedForecastWindow,
  TimeSlot,
} from '@/types/personalization';
import { TIME_SLOT_RANGES } from '@/types/personalization';
import { withApprovedPhotos } from '@/lib/supabase/query-builders';
import { FALLBACK_IMAGE_BY_NAME } from '@/lib/constants/featured-beaches-config';
import type { RecommendationLabel, MatchQuality } from '@/lib/scoring';
import type { ConditionBadge } from '@/types/personalization';
import {
  createDiscoveryScoringEngine,
  scoreBeachWithEngine,
  type DiscoveryScoringOptions,
} from '@/lib/domains/scoring';

// ============================================================================
// Badge Generation
// ============================================================================

/**
 * Generate condition badges based on thresholds
 * Returns top 2-3 badges sorted by contribution
 */
function generateConditionBadges(
  forecast: EnhancedForecastEntity,
  beach: Beach,
  subscores: { waveHeightFit: number; periodEnergyScore: number; windAlignment: number; tideFit: number }
): ConditionBadge[] {
  const badges: ConditionBadge[] = [];

  const windSpeed = parseFloat(String(forecast.wind_speed ?? '0'));
  const windDirection = forecast.wind_direction_deg ?? null;
  const wavePeriod = parseFloat(forecast.wave_period?.replace('s', '') || '0');
  const offshoreDir = beach.wind_offshore_deg ?? 90;

  // Glass: wind < 5 mph
  if (windSpeed < 5) {
    badges.push({ label: 'Glass', contribution: subscores.windAlignment });
  }
  // Light Offshore: offshore direction AND < 10 mph
  else if (windDirection !== null && windSpeed < 10) {
    const angleDiff = Math.abs(windDirection - offshoreDir) % 360;
    const isOffshore = angleDiff <= 45 || angleDiff >= 315;
    if (isOffshore) {
      badges.push({ label: 'Light Offshore', contribution: subscores.windAlignment });
    }
  }

  // Clean Swell: period >= 12s
  if (wavePeriod >= 12) {
    badges.push({ label: 'Clean Swell', contribution: subscores.periodEnergyScore });
  }

  // Good Tide: if tide score is high (>= 12 out of 15)
  if (subscores.tideFit >= 12) {
    const tideStatus = forecast.tide_status?.toLowerCase() || '';
    if (tideStatus.includes('rising') || tideStatus.includes('incoming')) {
      badges.push({ label: 'Rising Tide', contribution: subscores.tideFit });
    } else if (tideStatus.includes('falling') || tideStatus.includes('outgoing')) {
      badges.push({ label: 'Falling Tide', contribution: subscores.tideFit });
    } else {
      badges.push({ label: 'Good Tide', contribution: subscores.tideFit });
    }
  }

  // Sort by contribution descending, take top 3
  return badges
    .sort((a, b) => b.contribution - a.contribution)
    .slice(0, 3);
}

// ============================================================================
// Sun Time Fetching
// ============================================================================

/**
 * Batch fetch sun times (sunrise and sunset) for multiple beaches.
 * Returns a Map keyed by beachId -> { sunrises: Date[], sunsets: Date[] }
 */
export async function getBatchSunTimes(
  beachIds: string[],
  dates: string[]
): Promise<Map<string, { sunrises: Date[]; sunsets: Date[] }>> {
  const supabase = createSupabaseServiceRoleClient();

  const uniqueBeachIds = [...new Set(beachIds)];
  const uniqueDates = [...new Set(dates)];

  if (uniqueBeachIds.length === 0 || uniqueDates.length === 0) {
    return new Map();
  }

  const { data, error } = await supabase
    .from('sun_times')
    .select('beach_id, sunrise_utc, sunset_utc')
    .in('beach_id', uniqueBeachIds)
    .in('date', uniqueDates)
    .order('sunrise_utc', { ascending: true });

  if (error) {
    log.error('Error fetching sun times:', error);
    return new Map();
  }

  const sunMap = new Map<string, { sunrises: Date[]; sunsets: Date[] }>();

  data?.forEach((row) => {
    const beachId = row.beach_id;

    if (!sunMap.has(beachId)) {
      sunMap.set(beachId, { sunrises: [], sunsets: [] });
    }

    const entry = sunMap.get(beachId)!;

    if (row.sunrise_utc) {
      entry.sunrises.push(new Date(row.sunrise_utc));
    }
    if (row.sunset_utc) {
      entry.sunsets.push(new Date(row.sunset_utc));
    }
  });

  // Sort arrays
  sunMap.forEach((entry) => {
    entry.sunrises.sort((a, b) => a.getTime() - b.getTime());
    entry.sunsets.sort((a, b) => a.getTime() - b.getTime());
  });

  return sunMap;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_MAX_RESULTS = 5;
const DEFAULT_MAX_CONCURRENT = 5; // Increased from 3 for discovery
const DEFAULT_TIMEOUT_MS = 5000; // Per-beach timeout
const DEFAULT_OVERALL_TIMEOUT_MS = 12000; // Increased from 8s for more beaches
const WINDOW_HOURS = 3;
const FORECAST_WINDOW_HOURS = 48;

// Time-priority window selection constants
const TIME_DECAY_PER_HOUR = 1.0; // Points deducted per hour in future (increased from 0.5)
const MAX_TIME_DECAY_HOURS = 24; // Cap decay at 24 hours (24 points max)

// Start-soon bonuses for "surf now" prioritization
const SOON_BONUS_2HR = 8; // Bonus for windows starting within 2 hours
const SOON_BONUS_4HR = 4; // Bonus for windows starting within 4 hours
const UNDERWAY_BONUS = 4; // Bonus for windows already in progress

// Sunset-aware window constants
const MIN_SESSION_HOURS = 1.0; // Minimum viable session length
const MIN_SCORE_THRESHOLD = 50; // Score below which conditions are "poor"
const MIN_SCORE_THRESHOLD_MORNING = 35; // Lower threshold for today when it's morning
const MAX_WINDOW_HOURS = 4; // Maximum window even with perfect conditions
const MORNING_CUTOFF_HOUR = 12; // Before noon, prefer today's forecasts
const TODAY_BONUS_POINTS = 15; // Bonus for today's forecasts during morning hours
const MORNING_TIME_BONUS = 15; // Extra bonus for morning/afternoon times (before 5pm) during morning hours
const EVENING_CUTOFF_HOUR = 17; // 5pm - times after this don't get morning time bonus

// ============================================================================
// Photo Enrichment
// ============================================================================

/**
 * Enrich recommendations with beach photo URLs
 *
 * Photo resolution order:
 * 1. Approved photo from beach_photos table
 * 2. Named fallback from FALLBACK_IMAGE_BY_NAME
 * 3. null (component will render gradient)
 */
async function enrichWithPhotos(
  recommendations: SurfDiscoveryRecommendation[]
): Promise<SurfDiscoveryRecommendation[]> {
  if (recommendations.length === 0) return recommendations;

  const supabase = createSupabaseServiceRoleClient();
  const beachIds = recommendations.map((r) => r.beach.id);

  // Fetch approved photos for all beaches in one query
  const baseQuery = supabase
    .from('beach_photos')
    .select('beach_id, image_url')
    .in('beach_id', beachIds)
    .order('fetched_at', { ascending: false });

  const { data: photos } = await withApprovedPhotos(baseQuery);

  // Build beach_id -> photo_url map (first photo per beach)
  const photoMap = new Map<string, string>();
  if (photos) {
    for (const photo of photos) {
      if (!photoMap.has(photo.beach_id)) {
        photoMap.set(photo.beach_id, photo.image_url);
      }
    }
  }

  // Enrich each recommendation
  return recommendations.map((rec) => {
    // Try database photo first
    let photoUrl = photoMap.get(rec.beach.id) || null;

    // Fall back to named fallback
    if (!photoUrl) {
      photoUrl = FALLBACK_IMAGE_BY_NAME[rec.beach.name as keyof typeof FALLBACK_IMAGE_BY_NAME] || null;
    }

    return {
      ...rec,
      beach: {
        ...rec.beach,
        photo_url: photoUrl,
      },
    };
  });
}

// ============================================================================
// Main Entry Point
// ============================================================================

/**
 * Discover surf spots for a user
 *
 * Returns ranked list of surf recommendations from home + favorites + (GPS nearby in Phase 2).
 * Each recommendation includes detailed scoring breakdown and match quality.
 *
 * @param userId - User ID
 * @param options - Discovery options
 * @returns Surf discovery response with ranked recommendations
 *
 * @example
 * const discovery = await discoverSurfSpots('user-123', { maxResults: 5 });
 * for (const rec of discovery.recommendations) {
 *   log.debug(`${rec.beach.name}: ${rec.score} (${rec.matchQuality})`);
 *   log.debug(rec.reasons.join(', '));
 * }
 */
export async function discoverSurfSpots(
  userId: string,
  options: SurfDiscoveryOptions = {}
): Promise<SurfDiscoveryResponse> {
  const startTime = Date.now();

  const {
    userLocation,
    radiusMiles = 25,
    horizonHours,
    maxResults = DEFAULT_MAX_RESULTS,
    includeHome = true,
    maxConcurrent = DEFAULT_MAX_CONCURRENT,
    timeout = DEFAULT_TIMEOUT_MS,
    overallTimeout = DEFAULT_OVERALL_TIMEOUT_MS,
    timeSlot,
  } = options;

  try {
    log.debug(`🔍 Discovering surf spots for user ${userId} (maxResults: ${maxResults})`);

    // 1. Build candidate pool
    const { candidates, preferredWaveSize } = await buildCandidatePool(userId, {
      includeHome,
      userLocation,
      radiusMiles,
    });

    if (candidates.length === 0) {
      log.warn(`⚠️ No candidate beaches found for user ${userId}`);
      return emptyResponse(maxResults);
    }

    log.debug(`✅ Found ${candidates.length} candidate beaches`);

    // Limit candidates to prevent excessive API calls
    const maxCandidates = Math.min(candidates.length, 20);
    const finalCandidates = candidates.slice(0, maxCandidates);

    // 2. Fetch forecasts for all candidates
    const { successful: beachForecasts, failed: failedForecasts, staleCount } = await batchFetchForecasts(finalCandidates, {
      maxConcurrent,
      timeout,
      overallTimeout,
    });

    const successRate = beachForecasts.length / finalCandidates.length;
    const successPercent = Math.round(successRate * 100);

    log.debug(
      `📊 Retrieved forecasts: ${beachForecasts.length}/${finalCandidates.length} beaches (${successPercent}%)`
    );

    // Log failures and staleness context
    if (failedForecasts.length > 0 || staleCount > 0) {
      log.warn(
        `⚠️ [discoverSurfSpots] Forecast issues: ${failedForecasts.length} failed, ${staleCount} stale (stale data excluded)`
      );
    }

    if (beachForecasts.length === 0) {
      log.error(`❌ No forecasts retrieved for user ${userId}`);
      return emptyResponse(maxResults);
    }

    // Collect all dates from forecasts and fetch sun times
    const allDates = new Set<string>();
    const allBeachIds = new Set<string>();

    for (const { beach, forecasts } of beachForecasts) {
      allBeachIds.add(beach.id);
      for (const f of forecasts) {
        allDates.add(f.forecast_date);
      }
    }

    // Fetch sunsets (now returns Map<beachId, Date[]>)
    const uniqueDates = Array.from(allDates);
    const sunTimesCache = await getBatchSunTimes(
      Array.from(allBeachIds),
      uniqueDates
    );

    // 3. Score each beach with detailed breakdown
    const scored: SurfDiscoveryRecommendation[] = [];

    // Pre-load user preferences and affinity (1 query each)
    // NOTE: affinityMap is loaded but currently unused (affinityBonus = 0 at line 740).
    // Kept for future reactivation when we want to factor in user familiarity with beaches.
    const [userPrefs, affinityMap] = await Promise.all([
      getUserSurfPreferences(userId),
      loadBeachAffinity(userId, finalCandidates.map((b) => b.id)),
    ]);

    for (const { beach, forecasts } of beachForecasts) {
      const bestWindow = selectBestWindow(forecasts, beach, userPrefs, horizonHours, sunTimesCache, timeSlot);
      if (!bestWindow) {
        // log.warn(`⚠️ No viable window found for ${beach.name}`);
        continue;
      }

      // IMPORTANT: Score the same forecast entry we selected for bestWindow.
      // The window is derived from a specific forecast timestamp, so we match it here
      // to avoid scoring a different time slot (e.g. forecasts[0]).
      const bestWindowForecast =
        forecasts.find((f) => {
          const t = new Date(`${f.forecast_date}T${f.forecast_time}Z`).getTime();
          return t === bestWindow.start.getTime();
        }) || forecasts[0];

      // Calculate distance (stubbed for Phase 2)
      const distanceMiles = userLocation
        ? calculateDistance(userLocation, {
            lat: beach.lat || 0,
            lon: beach.lon || 0,
          })
        : undefined;

      // Get affinity score
      const affinity = affinityMap.get(beach.id);

      // Detailed scoring
      const detailedScore = await scoreBeachForDiscovery({
        beach,
        forecast: bestWindowForecast,
        userPrefs,
        preferredWaveSize,
        affinity,
        distanceMiles,
      });

      scored.push({
        beach,
        window: bestWindow,
        forecast: bestWindowForecast,
        score: detailedScore.total,
        matchQuality: detailedScore.matchQuality,
        recommendationLabel: getRecommendationLabel(detailedScore.total),
        subscores: detailedScore.subscores,
        summary: generateDiscoverySummary(beach, bestWindow, detailedScore),
        message: buildDiscoveryMessage(detailedScore.total, detailedScore.reasons, detailedScore.warnings),
        reasons: detailedScore.reasons,
        warnings: detailedScore.warnings,
        conditionBadges: detailedScore.conditionBadges,
        distanceMiles,
        drivingTimeMinutes: distanceMiles ? Math.round(distanceMiles * 1.5) : undefined,
        generated_at: new Date().toISOString(),
      });
    }

    // 4. Sort and slice to maxResults
    const ranked = scored.sort((a, b) => b.score - a.score).slice(0, maxResults);

    // Enrich with photos
    const enrichedRanked = await enrichWithPhotos(ranked);

    const duration = Date.now() - startTime;
    log.debug(
      `✅ Discovery complete in ${duration}ms: ${enrichedRanked.length} recommendations from ${finalCandidates.length} candidates`
    );

    return {
      recommendations: enrichedRanked,
      searchCriteria: {
        userLocation,
        radiusMiles,
        maxResults,
      },
      metadata: {
        totalBeachesConsidered: finalCandidates.length,
        successfulForecasts: beachForecasts.length,
        partialSuccess: beachForecasts.length < finalCandidates.length,
        failedBeaches: failedForecasts.length,
        staleBeaches: staleCount,
        generated_at: new Date().toISOString(),
      },
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    log.error(`❌ Error after ${duration}ms for user ${userId}:`, error);
    return emptyResponse(maxResults);
  }
}

// ============================================================================
// Forecast Fetching
// ============================================================================

/**
 * Batch fetch forecasts from cache with staleness tracking
 */
async function batchFetchForecasts(
  beaches: Beach[],
  _options: {
    maxConcurrent: number;
    timeout: number;
    overallTimeout: number;
  }
): Promise<{
  successful: Array<{ beach: Beach; forecasts: EnhancedForecastEntity[] }>;
  failed: Array<{ beach: Beach; reason: string; stale: boolean }>;
  staleCount: number;
}> {
  const startTime = Date.now();

  log.debug(`🌊 [batchFetchForecasts] Fetching forecasts for ${beaches.length} beaches from cache (batched)`);

  const { getBatchFreshForecastsFromCache } = await import('@/lib/utils/forecast-service-utils');

  // Create beach ID to Beach lookup map
  const beachMap = new Map<string, Beach>();
  for (const beach of beaches) {
    beachMap.set(beach.id, beach);
  }

  // Fetch all forecasts in 2 queries instead of 2N queries
  const batchResults = await getBatchFreshForecastsFromCache(
    beaches.map(b => b.id),
    FORECAST_WINDOW_HOURS
  );

  const successful: Array<{ beach: Beach; forecasts: EnhancedForecastEntity[] }> = [];
  const failed: Array<{ beach: Beach; reason: string; stale: boolean }> = [];
  let staleCount = 0;

  for (const beach of beaches) {
    const result = batchResults.get(beach.id);

    if (!result) {
      failed.push({
        beach,
        reason: 'No result returned from batch fetch',
        stale: false,
      });
      continue;
    }

    if (result.metadata.missing) {
      failed.push({
        beach,
        reason: result.metadata.reason || 'Missing data',
        stale: false,
      });
      continue;
    }

    if (result.metadata.stale) {
      staleCount++;
      failed.push({
        beach,
        reason: result.metadata.reason || 'Stale data',
        stale: true,
      });
      continue;
    }

    if (result.forecasts.length === 0) {
      failed.push({
        beach,
        reason: 'No forecasts available',
        stale: false,
      });
      continue;
    }

    successful.push({
      beach,
      forecasts: result.forecasts,
    });
  }

  const duration = Date.now() - startTime;
  log.debug(`📊 [batchFetchForecasts] Complete in ${duration}ms:`, {
    total: beaches.length,
    successful: successful.length,
    failed: failed.length,
    staleCount,
    staleBeaches: failed.filter(f => f.stale).map(f => f.beach.name).join(', '),
    failedBeaches: failed.map(f => `${f.beach.name} (${f.reason})`).join(', '),
  });

  return { successful, failed, staleCount };
}

// ============================================================================
// Detailed Scoring
// ============================================================================

/**
 * Score beach for discovery with detailed sub-score breakdown.
 * Uses the domain-driven pluggable scoring engine.
 */
// Singleton scoring engine instance for performance
let _discoveryScoringEngine: ReturnType<typeof createDiscoveryScoringEngine> | null = null;

function getDiscoveryScoringEngine() {
  if (!_discoveryScoringEngine) {
    _discoveryScoringEngine = createDiscoveryScoringEngine();
  }
  return _discoveryScoringEngine;
}

export async function scoreBeachForDiscovery(args: {
  beach: Beach;
  forecast: EnhancedForecastEntity;
  userPrefs: Awaited<ReturnType<typeof getUserSurfPreferences>> | null;
  preferredWaveSize: string | null;
  affinity?: { affinity_score: number; session_count: number };
  distanceMiles?: number;
}): Promise<DetailedScore> {
  const { beach, forecast, userPrefs, preferredWaveSize, affinity, distanceMiles } =
    args;

  // Use the new domain-driven scoring engine
  const engine = getDiscoveryScoringEngine();

  // Affinity bonus disabled - let conditions drive rankings instead of session history.
  // When enabled, affinity would boost beaches based on user familiarity, but we want
  // discovery recommendations to prioritize current surf conditions over past behavior.
  // The affinityMap is still loaded (line 364-367) but intentionally unused here.
  const affinityBonus = 0;

  // Calculate distance penalty (0 to -20 points)
  let distancePenalty = 0;
  if (distanceMiles !== undefined) {
    if (distanceMiles <= 5) {
      distancePenalty = 0;
    } else if (distanceMiles <= 15) {
      distancePenalty = -5;
    } else if (distanceMiles <= 30) {
      distancePenalty = -10;
    } else {
      distancePenalty = -20;
    }
  }

  // Map preferredWaveSize to engine option
  const normalizedWaveSize = (preferredWaveSize || '').toLowerCase();
  const preferredWaveSizeOption: DiscoveryScoringOptions['preferredWaveSize'] =
    normalizedWaveSize === 'small' ? 'small' :
    normalizedWaveSize === 'medium' ? 'medium' :
    normalizedWaveSize === 'large' ? 'large' :
    'any';

  // Score using new engine
  const detailedScore = scoreBeachWithEngine(engine, beach, forecast, {
    affinityBonus,
    distancePenalty,
    preferredWaveSize: preferredWaveSizeOption,
  });

  // Add distance warning if far
  if (distanceMiles !== undefined && distanceMiles > 30) {
    detailedScore.warnings.push(`${Math.round(distanceMiles)} miles away - long drive`);
  }

  // Add skill level warning if needed
  if (beach.skill_level === 'advanced' || beach.skill_level === 'expert') {
    if (!detailedScore.warnings.some((w) => w.includes('Advanced'))) {
      detailedScore.warnings.push('Advanced spot - check conditions carefully');
    }
  }

  // Generate condition badges (keep existing badge generation)
  const conditionBadges = generateConditionBadges(forecast, beach, detailedScore.subscores);

  return {
    ...detailedScore,
    conditionBadges,
    reasons: detailedScore.reasons.slice(0, 5),
  };
}

// ============================================================================
// Best Window Selection
// ============================================================================

/**
 * Score a single forecast window for time-slot selection
 */
function scoreForecastWindow(
  forecast: EnhancedForecastEntity,
  beach: Beach,
  userPrefs: Awaited<ReturnType<typeof getUserSurfPreferences>> | null
): number {
  let score = 0;

  const waveHeight = parseFloat(forecast.wave_height || '0');
  const wavePeriod = parseFloat(forecast.wave_period?.replace('s', '') || '0');
  const windSpeed = parseFloat(forecast.wind_speed || '0');
  const windDir = getDirectionDegrees(forecast.wind_direction_deg, forecast.wind_direction);
  const tideHeight = parseFloat(forecast.tide_height || '0');

  // 1. Wave Height Fit (0-25 points)
  if (userPrefs) {
    const userMin = userPrefs.wave_min_ft || 2;
    const userMax = userPrefs.wave_max_ft || 8;

    if (waveHeight >= userMin && waveHeight <= userMax) {
      score += 25;
    } else if (waveHeight >= userMin * 0.8 && waveHeight <= userMax * 1.2) {
      score += 15;
    } else {
      score += 5;
    }
  } else {
    if (waveHeight >= 2 && waveHeight <= 6) {
      score += 20;
    } else {
      score += 10;
    }
  }

  // 2. Period/Energy Score (0-20 points)
  if (userPrefs) {
    const userMinPeriod = userPrefs.wave_period_min_s || 8;
    const userMaxPeriod = userPrefs.wave_period_max_s || 18;

    if (wavePeriod >= userMinPeriod && wavePeriod <= userMaxPeriod) {
      score += 20;
    } else if (wavePeriod >= 10) {
      score += 15;
    } else {
      score += 5;
    }
  } else {
    if (wavePeriod >= 12) {
      score += 20;
    } else if (wavePeriod >= 9) {
      score += 15;
    } else {
      score += 5;
    }
  }

  // 3. Wind Alignment (0-20 points)
  if (beach.wind_offshore_deg !== null && beach.wind_offshore_tol_deg !== null) {
    const offshoreDir = beach.wind_offshore_deg;
    const tolerance = beach.wind_offshore_tol_deg || 30;

    if (windDir === null) {
      if (windSpeed <= 10) {
        score += 15;
      } else if (windSpeed <= 15) {
        score += 8;
      }
    } else {
      const angleDiff = Math.min(
        Math.abs(windDir - offshoreDir),
        360 - Math.abs(windDir - offshoreDir)
      );

      if (angleDiff <= tolerance && windSpeed <= 15) {
        score += 20;
      } else if (angleDiff <= tolerance * 2) {
        score += 10;
      }
    }
  } else {
    if (windSpeed <= 10) {
      score += 15;
    } else if (windSpeed <= 15) {
      score += 8;
    }
  }

  // 4. Tide Fit (0-15 points)
  if (beach.preferred_tide_ft_min !== null && beach.preferred_tide_ft_max !== null) {
    const idealMin = beach.preferred_tide_ft_min;
    const idealMax = beach.preferred_tide_ft_max;

    if (tideHeight >= idealMin && tideHeight <= idealMax) {
      score += 15;
    } else if (
      tideHeight >= idealMin * 0.8 &&
      tideHeight <= idealMax * 1.2
    ) {
      score += 8;
    } else {
      score += 3;
    }
  } else {
    score += 8;
  }

  return score;
}

/**
 * Select best surf window from forecast using composite scoring with time-priority.
 * Now sunset-aware: caps windows at sunset and skips windows too close to dark.
 *
 * ALGORITHM:
 * 1. Score all forecasts upfront and filter past times
 * 2. For each valid forecast window start:
 *    - Skip if score below MIN_SCORE_THRESHOLD
 *    - Check Local Hour to filter night sessions (9pm-5am)
 *    - Find NEXT sunset > startTime
 *    - Skip if too close to sunset (< MIN_SESSION_HOURS)
 *    - Extend window end until conditions degrade or MAX_WINDOW_HOURS reached
 *    - Cap window end at sunset
 * 3. Apply time-decay penalty for ranking
 * 4. Select highest adjusted score
 *
 * @param forecasts - Array of forecast entities for the beach
 * @param beach - Beach metadata for wind/tide preferences
 * @param userPrefs - User surf preferences (optional, for wave size/period matching)
 * @param horizonHours - Optional max hours ahead to consider
 * @param sunTimesCache - Optional Map of beach_id -> { sunrises: Date[], sunsets: Date[] }
 * @returns Best window or null if none viable
 */
export function selectBestWindow(
  forecasts: EnhancedForecastEntity[],
  beach: Beach,
  userPrefs: Awaited<ReturnType<typeof getUserSurfPreferences>> | null,
  horizonHours?: number,
  sunTimesCache?: Map<string, { sunrises: Date[]; sunsets: Date[] }>,
  timeSlot?: TimeSlot
): PersonalizedForecastWindow | null {
  if (forecasts.length === 0) return null;

  const now = new Date();
  const beachTz = getTimezoneFromCoords(beach.lat || 0, beach.lon || 0);

  // Helper: get local date string for a timestamp in beach timezone
  const getLocalDateStr = (time: Date): string => {
    try {
      return new Intl.DateTimeFormat("en-CA", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        timeZone: beachTz,
      }).format(time);
    } catch {
      return time.toISOString().slice(0, 10); // Fallback to UTC
    }
  };

  // Helper: cap end time to time slot boundary (e.g., dawn-patrol ends at 9am)
  // Note: Implementation is exported as capEndTimeToTimeSlot for testing
  const capEndTimeToSlot = (
    effectiveStartTime: Date,
    endTime: Date,
    timeSlot: TimeSlot | undefined,
    beachTz: string
  ): Date => capEndTimeToTimeSlot(effectiveStartTime, endTime, timeSlot, beachTz);

  // Check if it's "morning" (before noon) in beach timezone - prefer today's forecasts
  let isMorning = false;
  let todayDateStr = '';
  try {
    const localHourNow = parseInt(
      new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        hour12: false,
        timeZone: beachTz,
      }).format(now),
      10
    );
    isMorning = localHourNow < MORNING_CUTOFF_HOUR;

    // Get today's date string in beach timezone for comparison
    todayDateStr = new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: beachTz,
    }).format(now);
  } catch {
    // If timezone conversion fails, default to not morning priority
  }

  // Score all forecasts upfront and filter past times
  const scoredForecasts = forecasts
    .map((forecast) => {
      const forecastTime = new Date(`${forecast.forecast_date}T${forecast.forecast_time}Z`);
      const score = scoreForecastWindow(forecast, beach, userPrefs);

      // Check if forecast is for today (in beach timezone)
      let isToday = false;
      let localHourStr = '';
      try {
        const forecastDateStr = new Intl.DateTimeFormat("en-CA", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          timeZone: beachTz,
        }).format(forecastTime);
        isToday = forecastDateStr === todayDateStr;
        localHourStr = new Intl.DateTimeFormat("en-US", {
          hour: "numeric",
          minute: "numeric",
          hour12: true,
          timeZone: beachTz,
        }).format(forecastTime);
      } catch {
        // Default to not today if timezone conversion fails
      }

      return { forecast, forecastTime, score, isToday, localHourStr };
    })
    .filter(({ forecastTime }) => {
      // Allow windows that started within lookback period (3 hours)
      const lookbackMs = WINDOW_HOURS * 60 * 60 * 1000;
      const minEligible = new Date(now.getTime() - lookbackMs);
      return forecastTime >= minEligible;
    })
    .sort((a, b) => a.forecastTime.getTime() - b.forecastTime.getTime());

  if (scoredForecasts.length === 0) return null;

  // Apply time slot filter
  let filteredForecasts = scoredForecasts;

  if (timeSlot && timeSlot !== 'any') {
    const { startHour, endHour } = TIME_SLOT_RANGES[timeSlot];

    filteredForecasts = scoredForecasts.filter(({ forecastTime }) => {
      try {
        const localHour = parseInt(
          new Intl.DateTimeFormat("en-US", {
            hour: "numeric",
            hour12: false,
            timeZone: beachTz,
          }).format(forecastTime),
          10
        );
        return localHour >= startHour && localHour < endHour;
      } catch {
        return true; // If timezone conversion fails, include it
      }
    });
  }

  if (filteredForecasts.length === 0) return null;

  let bestWindow: {
    forecast: EnhancedForecastEntity;
    start: Date;
    end: Date;
    score: number;
  } | null = null;
  let bestAdjustedScore = -1;

  // Get sun times for this beach (sunsets for window capping)
  const sunTimes = sunTimesCache?.get(beach.id);
  const sunsets = sunTimes?.sunsets || [];

  // Find today's sunset for post-sunset rejection
  // Windows starting after sunset should be rejected (it's dark)
  const todaySunset = sunsets.find(s => {
    const sunsetLocalDate = getLocalDateStr(s);
    return sunsetLocalDate === todayDateStr;
  });

  for (let i = 0; i < filteredForecasts.length; i++) {
    const { forecast, forecastTime: startTime, score: startScore, isToday } = filteredForecasts[i];

    // Morning priority: use lower threshold for today's forecasts before noon
    const effectiveThreshold = (isMorning && isToday)
      ? MIN_SCORE_THRESHOLD_MORNING
      : MIN_SCORE_THRESHOLD;

    // Skip low-scoring start times
    if (startScore < effectiveThreshold) {
      continue;
    }

    // 1. Night Filter (using Local Hour)
    // Avoid recommending sessions starting in pitch dark (e.g. 9pm - 4am)
    // This protects us when sunset data is missing or "next sunset" is 20 hours away.
    try {
        const localHour = parseInt(
          new Intl.DateTimeFormat("en-US", {
            hour: "numeric",
            hour12: false,
            timeZone: beachTz,
          }).format(startTime),
          10
        );
        // Skip if 9pm (21) or later, or before 6am (covers winter sunrise ~6:45am)
        if (localHour >= 21 || localHour < 6) {
          continue;
        }
    } catch (e) {
        // If tz conversion fails, assume safe to proceed (fallback to sunset check)
    }

    // 1.5. Post-Sunset Rejection
    // If we know today's sunset and this window starts after it, skip entirely
    // This prevents the bug where post-sunset windows validate against tomorrow's sunset
    if (todaySunset && startTime.getTime() > todaySunset.getTime()) {
      continue;
    }

    // 2. Next Sunset Lookup
    // Find the first sunset that occurs AFTER this start time
    const nextSunset = sunsets.find(s => s.getTime() > startTime.getTime());
    let sunset = nextSunset; 

    // If we have a sunset, enforce strict daylight constraints
    if (sunset) {
        const hoursUntilSunset = (sunset.getTime() - startTime.getTime()) / (1000 * 60 * 60);

        if (hoursUntilSunset < MIN_SESSION_HOURS) {
          continue;
        }

    } else {
        // No future sunset found in cache.
        // Rely on Night Filter (passed) to allow session.
        // We assume broad daylight if no sunset is found (e.g. slight data gap or high latitude summer)
        // or effectively rely on night filter to kill bad times.
    }

    // Check horizon constraint
    // Clamp to zero so past-start windows don't get bonus from negative decay
    const rawHoursAhead = (startTime.getTime() - now.getTime()) / (1000 * 60 * 60);
    const hoursAhead = Math.max(0, rawHoursAhead);
    if (horizonHours && hoursAhead > horizonHours) continue;

    // Night filter (6am-9pm local hour check) handles pre-sunrise times
    const effectiveStartTime = startTime;

    // Default end time: MAX_WINDOW_HOURS from start
    let endTime = new Date(effectiveStartTime.getTime() + MAX_WINDOW_HOURS * 60 * 60 * 1000);

    // Look ahead to find when conditions degrade
    for (let j = i; j < filteredForecasts.length - 1; j++) {
      const current = filteredForecasts[j];
      const next = filteredForecasts[j + 1];

      // Stop if next forecast is on a different date (use local dates instead of UTC date strings)
      const currentLocalDate = getLocalDateStr(current.forecastTime);
      const nextLocalDate = getLocalDateStr(next.forecastTime);
      if (currentLocalDate !== nextLocalDate) break;

      // Use same threshold that qualified the window (morning threshold if applicable)
      if (current.score >= effectiveThreshold && next.score < effectiveThreshold) {
        // Linear interpolation to find precise degradation time
        const dropAmount = current.score - next.score;
        if (dropAmount <= 0) break; // Guard against edge case
        const thresholdDiff = current.score - effectiveThreshold;
        const fractionOfHour = dropAmount > 0 ? thresholdDiff / dropAmount : 0;

        const degradationTime = new Date(
          current.forecastTime.getTime() + fractionOfHour * 60 * 60 * 1000
        );

        if (degradationTime < endTime) {
          endTime = degradationTime;
        }
        break;
      }

      // Stop extending if we've gone past max window
      const windowDuration = (next.forecastTime.getTime() - effectiveStartTime.getTime()) / (1000 * 60 * 60);
      if (windowDuration >= MAX_WINDOW_HOURS) {
        endTime = new Date(effectiveStartTime.getTime() + MAX_WINDOW_HOURS * 60 * 60 * 1000);
        break;
      }
    }

    // Cap at sunset (exact clipping)
    if (sunset && sunset < endTime) {
      endTime = sunset;
    }

    // Cap at time slot end (e.g., dawn-patrol ends at 9am)
    endTime = capEndTimeToSlot(effectiveStartTime, endTime, timeSlot, beachTz);

    // Validate minimum session length (using effective start time)
    const durationHours = (endTime.getTime() - effectiveStartTime.getTime()) / (1000 * 60 * 60);
    if (durationHours < MIN_SESSION_HOURS) continue;

    // Apply time decay for ranking
    const cappedHours = Math.min(hoursAhead, MAX_TIME_DECAY_HOURS);
    const timeDecay = cappedHours * TIME_DECAY_PER_HOUR;

    // Start-soon bonus (smooth step based on proximity)
    let soonBonus = 0;
    if (hoursAhead <= 2) soonBonus = SOON_BONUS_2HR;
    else if (hoursAhead <= 4) soonBonus = SOON_BONUS_4HR;

    // Underway bonus for windows already in progress
    const isUnderway = rawHoursAhead < 0;
    const underwayBonus = isUnderway ? UNDERWAY_BONUS : 0;

    // Morning priority: add bonus to today's forecasts before noon
    const todayBonus = (isMorning && isToday) ? TODAY_BONUS_POINTS : 0;

    // Get local hour of forecast start time to determine morning time bonus
    let morningTimeBonus = 0;
    if (isMorning && isToday) {
      try {
        const forecastLocalHour = parseInt(
          new Intl.DateTimeFormat("en-US", {
            hour: "numeric",
            hour12: false,
            timeZone: beachTz,
          }).format(startTime),
          10
        );
        // Give bonus to times before 5pm (prioritize morning/afternoon over evening)
        if (forecastLocalHour < EVENING_CUTOFF_HOUR) {
          morningTimeBonus = MORNING_TIME_BONUS;
        }
      } catch {
        // If timezone conversion fails, no bonus
      }
    }

    const adjustedScore = startScore - timeDecay + todayBonus + morningTimeBonus + soonBonus + underwayBonus;

    if (adjustedScore > bestAdjustedScore) {
      bestAdjustedScore = adjustedScore;
      bestWindow = { forecast, start: effectiveStartTime, end: endTime, score: startScore };
    }
  }

  // Fallback: if no forecasts passed threshold, use the best available anyway
  if (!bestWindow && filteredForecasts.length > 0) {
    // Filter out night hours and post-sunset times before selecting fallback
    const daylightForecasts = filteredForecasts.filter(({ forecastTime }) => {
      // Post-sunset rejection (same as main loop)
      if (todaySunset && forecastTime.getTime() > todaySunset.getTime()) {
        return false;
      }
      try {
        const localHour = parseInt(
          new Intl.DateTimeFormat("en-US", {
            hour: "numeric",
            hour12: false,
            timeZone: beachTz,
          }).format(forecastTime),
          10
        );
        return localHour >= 6 && localHour < 21;
      } catch {
        return true; // If tz conversion fails, allow it
      }
    });

    if (daylightForecasts.length === 0) {
      return null; // No daylight forecasts available
    }

    // Morning priority: prefer today's forecasts before noon, with extra bonus for morning times
    // Also apply soon/underway bonuses for consistency with main logic
    const getAdjustedScore = (f: typeof daylightForecasts[0]) => {
      const rawHoursAhead = (f.forecastTime.getTime() - now.getTime()) / (1000 * 60 * 60);
      const hoursAhead = Math.max(0, rawHoursAhead);

      // Soon bonus
      let soonBonus = 0;
      if (hoursAhead <= 2) soonBonus = SOON_BONUS_2HR;
      else if (hoursAhead <= 4) soonBonus = SOON_BONUS_4HR;

      // Underway bonus
      const underwayBonus = rawHoursAhead < 0 ? UNDERWAY_BONUS : 0;

      // Today bonus (existing logic)
      let bonus = 0;
      if (isMorning && f.isToday) {
        bonus += TODAY_BONUS_POINTS;
        try {
          const localHour = parseInt(
            new Intl.DateTimeFormat("en-US", {
              hour: "numeric",
              hour12: false,
              timeZone: beachTz,
            }).format(f.forecastTime),
            10
          );
          if (localHour < EVENING_CUTOFF_HOUR) {
            bonus += MORNING_TIME_BONUS;
          }
        } catch {
          // If timezone conversion fails, no extra bonus
        }
      }

      return f.score + bonus + soonBonus + underwayBonus;
    };

    const best = daylightForecasts.reduce((prev, curr) => {
      return getAdjustedScore(curr) > getAdjustedScore(prev) ? curr : prev;
    });

    // Check horizon constraint for fallback
    const hoursAhead = (best.forecastTime.getTime() - now.getTime()) / (1000 * 60 * 60);
    if (!horizonHours || hoursAhead <= horizonHours) {
      // Night filter already applied above - no civil twilight clamping needed
      const effectiveStartTime = best.forecastTime;

      // Logic for fallback end time (next sunset or default)
      const nextSunset = sunsets.find(s => s.getTime() > effectiveStartTime.getTime());

      let endTime = new Date(effectiveStartTime.getTime() + MAX_WINDOW_HOURS * 60 * 60 * 1000);
      if (nextSunset && nextSunset < endTime) {
        endTime = nextSunset;
      }

      // Cap at time slot end for fallback window too
      endTime = capEndTimeToSlot(effectiveStartTime, endTime, timeSlot, beachTz);

      const durationHours = (endTime.getTime() - effectiveStartTime.getTime()) / (1000 * 60 * 60);

      if (durationHours >= MIN_SESSION_HOURS) {
        bestWindow = {
          forecast: best.forecast,
          start: effectiveStartTime,
          end: endTime,
          score: best.score,
        };
      }
    }

  }

    if (!bestWindow) {
        return null;
    }

  // Build the PersonalizedForecastWindow
  return {
    start: bestWindow.start,
    end: bestWindow.end,
    tide: bestWindow.forecast.tide_status || 'Unknown',
    wind: `${bestWindow.forecast.wind_speed} ${bestWindow.forecast.wind_direction}`,
    waveHeight: bestWindow.forecast.wave_height || 'Unknown',
    wavePeriod: bestWindow.forecast.wave_period || 'Unknown',
    dataSource: bestWindow.forecast.data_source || 'FALLBACK',
    confidence: bestWindow.forecast.confidence_score || 50,
    timezone: beachTz,
  };
}

// ============================================================================
// Exported Test Helpers
// ============================================================================

/**
 * Test helper: Cap end time to time slot boundary
 * Exported for unit testing the time slot capping logic
 *
 * @param effectiveStartTime - The window start time
 * @param endTime - The uncapped window end time
 * @param timeSlot - The time slot to cap to (dawn-patrol, morning, afternoon, any)
 * @param beachTz - IANA timezone string for the beach location
 * @returns The capped end time, or original end time if no capping needed
 */
export function capEndTimeToTimeSlot(
  effectiveStartTime: Date,
  endTime: Date,
  timeSlot: TimeSlot | undefined,
  beachTz: string
): Date {
  if (!timeSlot || timeSlot === 'any') {
    return endTime;
  }

  const { endHour } = TIME_SLOT_RANGES[timeSlot];
  try {
    // Get the local hour of the start time in beach timezone
    const startLocalHour = parseInt(
      new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        hour12: false,
        timeZone: beachTz,
      }).format(effectiveStartTime),
      10
    );

    // Calculate hours until time slot ends
    const hoursUntilSlotEnd = endHour - startLocalHour;

    if (hoursUntilSlotEnd > 0) {
      const timeSlotEnd = new Date(
        effectiveStartTime.getTime() + hoursUntilSlotEnd * 60 * 60 * 1000
      );

      if (timeSlotEnd < endTime) {
        return timeSlotEnd;
      }
    }
  } catch {
    // If timezone conversion fails, don't cap
  }

  return endTime;
}

// ============================================================================
// Summary Generation
// ============================================================================

/**
 * Generate human-readable summary for discovery recommendation.
 */
function generateDiscoverySummary(
  beach: Beach,
  window: PersonalizedForecastWindow,
  score: DetailedScore
): string {
  const matchDesc =
    score.matchQuality === 'perfect'
      ? 'Perfect match'
      : score.matchQuality === 'excellent'
        ? 'Excellent match'
        : score.matchQuality === 'good'
          ? 'Good match'
          : 'Fair conditions';

  const preferredSizeWarning = score.warnings.find(
    (w) =>
      w.startsWith('Below your preferred size') ||
      w.startsWith('Above your preferred size')
  );

  const warningSuffix = preferredSizeWarning ? ` ${preferredSizeWarning}.` : '';

  return `${matchDesc} at ${beach.name} - ${window.waveHeight} with ${window.wind}.${warningSuffix}`;
}

/**
 * Get recommendation label from score value
 * Score-based: >=70 = Worth it, 40-69 = Maybe, <40 = Skip
 */
function getRecommendationLabel(score: number): RecommendationLabel {
  if (score >= 70) return 'Worth it';
  if (score >= 40) return 'Maybe';
  return 'Skip';
}

/**
 * Build natural language message from score, reasons, and warnings
 * Format: "Worth it — Good wave size, Offshore wind. Watch: Tide is high"
 */
function buildDiscoveryMessage(
  score: number,
  reasons: string[],
  warnings: string[]
): string {
  const label = getRecommendationLabel(score);

  if (label === 'Skip') {
    const skipReason = warnings[0] || 'Conditions not favorable';
    return `Skip — ${skipReason}`;
  }

  // Pick top 2 reasons for concise message
  const topReasons = reasons.slice(0, 2).join(', ');
  let message = `${label} — ${topReasons || 'Conditions look surfable'}`;

  // Add first warning if present
  if (warnings.length > 0) {
    message += `. Watch: ${warnings[0]}`;
  }

  return message;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Load beach affinity scores for multiple beaches
 */
async function loadBeachAffinity(
  userId: string,
  beachIds: string[]
): Promise<Map<string, { affinity_score: number; session_count: number }>> {
  const supabase = createSupabaseServiceRoleClient();
  const map = new Map<string, { affinity_score: number; session_count: number }>();

  try {
    const { data } = await supabase
      .from('user_beach_affinity')
      .select('beach_id, affinity_score, session_count')
      .eq('user_id', userId)
      .in('beach_id', beachIds);

    if (data) {
      for (const row of data) {
        map.set(row.beach_id, {
          affinity_score: row.affinity_score,
          session_count: row.session_count,
        });
      }
    }
  } catch (error) {
    log.error('Error loading beach affinity:', error);
  }

  return map;
}

/**
 * Parse wave direction string to degrees
 */
function parseWaveDirection(dir: string): number {
  const directions: Record<string, number> = {
    N: 0,
    NNE: 22.5,
    NE: 45,
    ENE: 67.5,
    E: 90,
    ESE: 112.5,
    SE: 135,
    SSE: 157.5,
    S: 180,
    SSW: 202.5,
    SW: 225,
    WSW: 247.5,
    W: 270,
    WNW: 292.5,
    NW: 315,
    NNW: 337.5,
  };

  const v = directions[dir.toUpperCase()];
  return v ?? 0;
}

/**
 * Prefer degree-based wind direction when present; fall back to parsing cardinal strings.
 */
function getDirectionDegrees(
  windDirectionDeg: number | string | null | undefined,
  windDirectionText: string | null | undefined
): number | null {
  if (windDirectionDeg !== null && windDirectionDeg !== undefined) {
    const asNum =
      typeof windDirectionDeg === 'number' ? windDirectionDeg : Number(windDirectionDeg);
    if (Number.isFinite(asNum)) {
      return ((asNum % 360) + 360) % 360;
    }
  }

  if (!windDirectionText) return null;
  const trimmed = windDirectionText.trim();
  if (!trimmed) return null;

  const asNum = Number(trimmed);
  if (Number.isFinite(asNum)) {
    return ((asNum % 360) + 360) % 360;
  }

  const upper = trimmed.toUpperCase();
  const knownCardinals = new Set([
    'N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'
  ]);
  if (!knownCardinals.has(upper)) return null;
  return parseWaveDirection(upper);
}

/**
 * Calculate distance between two coordinates (Haversine formula)
 */
function calculateDistance(
  from: { lat: number; lon: number },
  to: { lat: number; lon: number }
): number {
  const R = 3959; // Earth radius in miles
  const dLat = ((to.lat - from.lat) * Math.PI) / 180;
  const dLon = ((to.lon - from.lon) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((from.lat * Math.PI) / 180) *
      Math.cos((to.lat * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Empty response for error cases
 */
function emptyResponse(maxResults: number): SurfDiscoveryResponse {
  return {
    recommendations: [],
    searchCriteria: {
      maxResults,
    },
    metadata: {
      totalBeachesConsidered: 0,
      successfulForecasts: 0,
      partialSuccess: false,
      failedBeaches: 0,
      staleBeaches: 0,
      generated_at: new Date().toISOString(),
    },
  };
}
