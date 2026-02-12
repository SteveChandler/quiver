/**
 * Surf Discovery Orchestrator
 *
 * Orchestrates the surf discovery flow by composing modular services:
 * 1. CandidatePoolBuilder - Builds initial candidate pool using GPS proximity
 * 2. ForecastBatchFetcher - Fetches forecasts for all candidates in parallel
 * 3. WindowSelector - Selects best surf window for each beach
 * 4. ResponseFormatter - Enriches recommendations with photos and summaries
 *
 * This is the main entry point for surf discovery, extracted from surf-discovery-service.ts
 * for better modularity and testability.
 *
 * Performance: 3 DB queries total, parallel forecast fetching, 12s timeout
 *
 * @module lib/services/discovery/surf-discovery-orchestrator
 */

import { createSupabaseServiceRoleClient } from '@/lib/supabase/server';
import { getUserSurfPreferences } from '@/lib/services/preference-learning-service';
import { createContextLogger } from '@/lib/logger';
import { getFavoriteBeachesFromDb } from '@/lib/services/beach-query-service';
import type { Beach } from '@/types/database';
import type { EnhancedForecastEntity } from '@/types/forecast';
import type {
  SurfDiscoveryRecommendation,
  SurfDiscoveryResponse,
  SurfDiscoveryOptions,
  DetailedScore,
} from '@/types/personalization';
import type { ConditionBadge } from '@/types/personalization';
import {
  createDiscoveryScoringEngine,
  scoreBeachWithEngine,
  type DiscoveryScoringOptions,
} from '@/lib/domains/scoring';
import type { SkillLevel } from '@/lib/domains/user-preferences';
import { SET_WAVE_VARIANCE } from '@/lib/utils/wave-height-transformer';
import { formatWaveHeightRangeString } from '@/lib/utils/wave-height-formatter';

// Import from other discovery modules
import { buildCandidatePool } from './candidate-pool-builder';
import { batchFetchForecasts } from './forecast-batch-fetcher';
import { selectBestWindow } from './window-selector';
import {
  enrichWithPhotos,
  generateDiscoverySummary,
  getRecommendationLabel,
  buildDiscoveryMessage,
} from './response-formatter';

const log = createContextLogger('SurfDiscoveryOrchestrator');

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_MAX_RESULTS = 5;
const DEFAULT_MAX_CONCURRENT = 5; // Increased from 3 for discovery
const DEFAULT_TIMEOUT_MS = 5000; // Per-beach timeout
const DEFAULT_OVERALL_TIMEOUT_MS = 12000; // Increased from 8s for more beaches

// ============================================================================
// Badge Generation
// ============================================================================

/**
 * Format wave height as a range string for badge display.
 * Shows average waves (input) to set waves (1.5x input).
 * Returns null for flat conditions (< 0.5ft).
 *
 * @param waveHeight - Average wave height in feet
 * @returns Range string like "3-5ft" or null if flat
 */
export function formatWaveHeightRange(waveHeight: number): string | null {
  if (waveHeight < 0.5) return null;
  return formatWaveHeightRangeString(waveHeight, waveHeight * SET_WAVE_VARIANCE);
}

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
// Helper Functions
// ============================================================================

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

// ============================================================================
// Scoring Engine
// ============================================================================

// Singleton scoring engine instance for performance
let _discoveryScoringEngine: ReturnType<typeof createDiscoveryScoringEngine> | null = null;

function getDiscoveryScoringEngine() {
  if (!_discoveryScoringEngine) {
    _discoveryScoringEngine = createDiscoveryScoringEngine();
  }
  return _discoveryScoringEngine;
}

/**
 * Score beach for discovery with detailed sub-score breakdown.
 * Uses the domain-driven pluggable scoring engine.
 */
export async function scoreBeachForDiscovery(args: {
  beach: Beach;
  forecast: EnhancedForecastEntity;
  userPrefs: Awaited<ReturnType<typeof getUserSurfPreferences>> | null;
  preferredWaveSize: string | null;
  /** Pre-parsed and validated skill level from candidate pool builder */
  userSkillLevel: SkillLevel | null;
  distanceMiles?: number;
}): Promise<DetailedScore> {
  const { beach, forecast, userPrefs, preferredWaveSize, userSkillLevel, distanceMiles } =
    args;

  // Use the new domain-driven scoring engine
  const engine = getDiscoveryScoringEngine();

  // Affinity scoring disabled in discovery; active in personalized-scoring-service.ts
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

  // userSkillLevel is now pre-parsed as SkillLevel | null from candidate pool builder
  // No mapping needed - pass directly to scoring engine
  const detailedScore = scoreBeachWithEngine(engine, beach, forecast, {
    affinityBonus,
    distancePenalty,
    preferredWaveSize: preferredWaveSizeOption,
    userSkillLevel,
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

  // Generate wave height badge from forecast
  const waveHeight = parseFloat(String(forecast.wave_height ?? '0'));
  const waveHeightBadge = formatWaveHeightRange(waveHeight);

  return {
    ...detailedScore,
    conditionBadges,
    waveHeightBadge: waveHeightBadge ?? undefined,
    reasons: detailedScore.reasons.slice(0, 5),
  };
}

// ============================================================================
// Main Entry Point
// ============================================================================

/**
 * Discover surf spots for a user
 *
 * Orchestrates the full discovery flow:
 * 1. Build candidate pool using GPS proximity (requires userLocation)
 * 2. Batch fetch forecasts for all candidates
 * 3. Select best window for each beach
 * 4. Score and rank recommendations
 * 5. Enrich with photos and format response
 *
 * Returns ranked list of surf recommendations based on GPS proximity and condition scoring.
 * Each recommendation includes detailed scoring breakdown and match quality.
 * Favorites are marked with isFavorite flag but do not receive preferential ordering.
 *
 * @param userId - User ID
 * @param options - Discovery options (userLocation required for results)
 * @returns Surf discovery response with ranked recommendations
 *
 * @example
 * const discovery = await discoverSurfSpots('user-123', {
 *   userLocation: { lat: 32.7157, lon: -117.1611 },
 *   maxResults: 5
 * });
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
    maxConcurrent = DEFAULT_MAX_CONCURRENT,
    timeout = DEFAULT_TIMEOUT_MS,
    overallTimeout = DEFAULT_OVERALL_TIMEOUT_MS,
    timeSlot,
  } = options;

  try {
    // GPS location is required for discovery
    if (!userLocation) {
      log.warn(`Discovery called without userLocation for user ${userId}`);
      return emptyResponse(maxResults);
    }

    log.debug(`Discovering surf spots for user ${userId} (maxResults: ${maxResults})`);

    // 1. Build candidate pool (GPS-based, sorted by distance)
    const { candidates, preferredWaveSize, userSkillLevel } = await buildCandidatePool(userId, {
      userLocation,
      radiusMiles,
    });

    if (candidates.length === 0) {
      log.warn(`No candidate beaches found for user ${userId}`);
      return emptyResponse(maxResults);
    }

    log.debug(`Found ${candidates.length} candidate beaches`);

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
      `Retrieved forecasts: ${beachForecasts.length}/${finalCandidates.length} beaches (${successPercent}%)`
    );

    // Log failures and staleness context
    if (failedForecasts.length > 0 || staleCount > 0) {
      log.warn(
        `Forecast issues: ${failedForecasts.length} failed, ${staleCount} stale (stale data excluded)`
      );
    }

    if (beachForecasts.length === 0) {
      log.error(`No forecasts retrieved for user ${userId}`);
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

    // CRITICAL: Always include today and next 2 days in UTC format
    // This fixes a bug where forecast_date values might not include today's date
    // when viewing in a timezone ahead of UTC (e.g., Hawaii beaches viewed in the afternoon).
    // The sun_times table stores dates in UTC, so we need to ensure we query for:
    // - Yesterday (in case of timezone edge cases)
    // - Today
    // - Tomorrow
    // - Day after tomorrow
    const now = new Date();
    for (let dayOffset = -1; dayOffset <= 2; dayOffset++) {
      const d = new Date(now);
      d.setUTCDate(now.getUTCDate() + dayOffset);
      allDates.add(d.toISOString().split('T')[0]);
    }

    // Fetch sunsets (now returns Map<beachId, Date[]>)
    const uniqueDates = Array.from(allDates);
    const sunTimesCache = await getBatchSunTimes(
      Array.from(allBeachIds),
      uniqueDates
    );

    // 3. Score each beach with detailed breakdown
    const scored: SurfDiscoveryRecommendation[] = [];

    // Pre-load user preferences
    const userPrefs = await getUserSurfPreferences(userId);

    const beachesWithNoWindow: string[] = [];
    for (const { beach, forecasts } of beachForecasts) {
      const bestWindow = selectBestWindow(forecasts, beach, userPrefs, horizonHours, sunTimesCache, timeSlot);
      if (!bestWindow) {
        beachesWithNoWindow.push(beach.name);
        log.debug(`[discoverSurfSpots] ${beach.name}: selectBestWindow returned null (forecasts=${forecasts.length})`);
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

      // Detailed scoring
      const detailedScore = await scoreBeachForDiscovery({
        beach,
        forecast: bestWindowForecast,
        userPrefs,
        preferredWaveSize,
        userSkillLevel,
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
        waveHeightBadge: detailedScore.waveHeightBadge,
        distanceMiles,
        drivingTimeMinutes: distanceMiles ? Math.round(distanceMiles * 1.5) : undefined,
        generated_at: new Date().toISOString(),
      });
    }

    // Log beaches that had no window selected
    if (beachesWithNoWindow.length > 0) {
      log.warn(`[discoverSurfSpots] ${beachesWithNoWindow.length} beaches had no viable window: ${beachesWithNoWindow.join(', ')}`);
    }

    // Log all beach scores before ranking (for debugging)
    const allScoresSorted = [...scored].sort((a, b) => b.score - a.score);
    log.debug(`[discoverSurfSpots] All ${scored.length} scored beaches (before top-N filter):`);
    allScoresSorted.forEach((rec, idx) => {
      const { waveHeightFit, periodEnergyScore, windAlignment, tideFit, distancePenalty } = rec.subscores;
      log.debug(`  ${idx + 1}. ${rec.beach.name}: score=${rec.score} (wave=${waveHeightFit}, period=${periodEnergyScore}, wind=${windAlignment}, tide=${tideFit}, dist=${distancePenalty})`);
    });

    // 4. Fetch and merge favorites
    let favoriteBeachIds = new Set<string>();
    try {
      const favoriteBeachesResponse = await getFavoriteBeachesFromDb(userId);
      if (favoriteBeachesResponse.success && favoriteBeachesResponse.data) {
        favoriteBeachIds = new Set(favoriteBeachesResponse.data.map((b: Beach) => b.id));
        log.debug(`Found ${favoriteBeachIds.size} favorite beaches for user ${userId}`);
      } else {
        log.warn(`Failed to fetch favorites: ${favoriteBeachesResponse.error || 'Unknown error'}`);
      }
    } catch (error) {
      log.error('Error fetching favorite beaches, continuing with regular recommendations:', error);
    }

    // Mark favorites with badge flag, but do NOT prioritize in ranking
    // All beaches are ranked purely by score - favorites just get a heart badge
    const allRecs: SurfDiscoveryRecommendation[] = [];

    for (const rec of scored) {
      // Null safety: skip malformed recommendations
      if (!rec?.beach?.id || typeof rec.score !== 'number') {
        log.warn('Skipping malformed recommendation in favorites loop', { rec });
        continue;
      }

      allRecs.push({
        ...rec,
        isFavorite: favoriteBeachIds.has(rec.beach.id),
      });
    }

    // Sort ALL recommendations by score descending (pure score ranking)
    allRecs.sort((a, b) => b.score - a.score);

    // Take top results
    const merged = allRecs.slice(0, maxResults);

    const favoriteCount = merged.filter(r => r.isFavorite).length;
    log.debug(
      `Merged recommendations: ${favoriteCount} favorites in top ${merged.length} (pure score ranking)`
    );

    // 5. Enrich with photos
    const enrichedRanked = await enrichWithPhotos(merged);

    const duration = Date.now() - startTime;
    log.debug(
      `Discovery complete in ${duration}ms: ${enrichedRanked.length} recommendations from ${finalCandidates.length} candidates`
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
    log.error(`Error after ${duration}ms for user ${userId}:`, error);
    return emptyResponse(maxResults);
  }
}
