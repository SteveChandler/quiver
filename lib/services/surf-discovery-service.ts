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
import {
  buildCandidatePool,
  batchFetchForecasts,
  selectBestWindow,
  capEndTimeToTimeSlot,
  scoreForecastWindow,
} from './discovery';
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
const FORECAST_WINDOW_HOURS = 48;

// Note: Window selection constants (TIME_DECAY_PER_HOUR, MIN_SCORE_THRESHOLD, etc.)
// are now in lib/services/discovery/window-selector.ts

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

// Note: scoreForecastWindow, selectBestWindow, capEndTimeToTimeSlot have been
// moved to lib/services/discovery/window-selector.ts

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

// Note: parseWaveDirection and getDirectionDegrees have been moved to
// lib/services/discovery/window-selector.ts

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
