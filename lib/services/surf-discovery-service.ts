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
 * Transforms "personalized home forecast" (single beach) into
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
import { getTimezoneFromCoords, getLocalHour, isNightHour } from '@/lib/utils/timezone-utils';
import type { Beach } from '@/types/database';
import type { EnhancedForecastEntity } from '@/types/forecast';
import type {
  SurfDiscoveryRecommendation,
  SurfDiscoveryResponse,
  SurfDiscoveryOptions,
  DetailedScore,
  PersonalizedForecastWindow,
} from '@/types/personalization';

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
const TIME_DECAY_PER_HOUR = 0.5; // Points deducted per hour in future
const MAX_TIME_DECAY_HOURS = 24; // Cap decay at 24 hours (12 points max)

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
 *   console.log(`${rec.beach.name}: ${rec.score} (${rec.matchQuality})`);
 *   console.log(rec.reasons.join(', '));
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
  } = options;

  try {
    console.log(`🔍 Discovering surf spots for user ${userId} (maxResults: ${maxResults})`);

    // 1. Build candidate pool
    const candidates = await buildCandidatePool(userId, {
      includeHome,
      userLocation,
      radiusMiles,
    });

    if (candidates.length === 0) {
      console.warn(`⚠️ No candidate beaches found for user ${userId}`);
      return emptyResponse(maxResults);
    }

    console.log(`✅ Found ${candidates.length} candidate beaches`);

    // Limit candidates to prevent excessive API calls
    const maxCandidates = Math.min(candidates.length, 20);
    const finalCandidates = candidates.slice(0, maxCandidates);

    // 2. Fetch forecasts for all candidates
    const { successful: beachForecasts, failed: failedForecasts } = await batchFetchForecasts(finalCandidates, {
      maxConcurrent,
      timeout,
      overallTimeout,
    });

    const successRate = beachForecasts.length / finalCandidates.length;
    const successPercent = Math.round(successRate * 100);

    console.log(
      `📊 Retrieved forecasts: ${beachForecasts.length}/${finalCandidates.length} beaches (${successPercent}%)`
    );

    // Log failures with staleness context
    if (failedForecasts.length > 0) {
      const staleCount = failedForecasts.filter(f => f.stale).length;
      const missingCount = failedForecasts.length - staleCount;
      console.warn(
        `⚠️ [discoverSurfSpots] Failed forecasts: ${failedForecasts.length} (${staleCount} stale, ${missingCount} missing)`
      );
    }

    if (beachForecasts.length === 0) {
      console.error(`❌ No forecasts retrieved for user ${userId}`);
      return emptyResponse(maxResults);
    }

    // 3. Score each beach with detailed breakdown
    const scored: SurfDiscoveryRecommendation[] = [];

    // Pre-load user preferences and affinity (1 query each)
    const [userPrefs, affinityMap] = await Promise.all([
      getUserSurfPreferences(userId),
      loadBeachAffinity(userId, finalCandidates.map((b) => b.id)),
    ]);

    for (const { beach, forecasts } of beachForecasts) {
      const bestWindow = selectBestWindow(forecasts, beach, userPrefs, horizonHours);
      if (!bestWindow) {
        console.warn(`⚠️ No viable window found for ${beach.name}`);
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
        affinity,
        distanceMiles,
      });

      scored.push({
        beach,
        window: bestWindow,
        forecast: bestWindowForecast,
        score: detailedScore.total,
        matchQuality: detailedScore.matchQuality,
        subscores: detailedScore.subscores,
        summary: generateDiscoverySummary(beach, bestWindow, detailedScore),
        reasons: detailedScore.reasons,
        warnings: detailedScore.warnings,
        distanceMiles,
        drivingTimeMinutes: distanceMiles ? Math.round(distanceMiles * 1.5) : undefined,
        generated_at: new Date().toISOString(),
      });
    }

    // 4. Sort and slice to maxResults
    const ranked = scored.sort((a, b) => b.score - a.score).slice(0, maxResults);

    const duration = Date.now() - startTime;
    console.log(
      `✅ Discovery complete in ${duration}ms: ${ranked.length} recommendations from ${finalCandidates.length} candidates`
    );

    return {
      recommendations: ranked,
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
        staleBeaches: failedForecasts.filter(f => f.stale).length,
        generated_at: new Date().toISOString(),
      },
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`❌ Error after ${duration}ms for user ${userId}:`, error);
    return emptyResponse(maxResults);
  }
}

// ============================================================================
// Candidate Pool Builder
// ============================================================================

/**
 * Build candidate pool from home + favorites + GPS nearby
 *
 * Phase 1: Home + favorites only
 * Phase 2: Add GPS nearby beaches within radius
 */
async function buildCandidatePool(
  userId: string,
  options: {
    includeHome?: boolean;
    userLocation?: { lat: number; lon: number };
    radiusMiles?: number;
  }
): Promise<Beach[]> {
  const supabase = createSupabaseServiceRoleClient();
  const candidates: Beach[] = [];

  try {
    if (options.includeHome !== false) {
      // Query 1: Get user profile with home beach
      const { data: profile } = await supabase
        .from('profiles')
        .select(
          `
          id,
          home_beach_id,
          home_beach:beaches!profiles_home_beach_id_fkey (*)
        `
        )
        .eq('id', userId)
        .single();

      if (profile?.home_beach) {
        candidates.push(profile.home_beach as unknown as Beach);
        console.log(`✅ Added home beach: ${(profile.home_beach as any).name}`);
      }

      // Query 2: Get favorites (excluding home to avoid duplicates)
      const { data: favorites } = await supabase
        .from('favorite_beaches')
        .select(
          `
          beach_id,
          rank,
          beach:beaches (*)
        `
        )
        .eq('user_id', userId)
        .order('rank', { ascending: true });

      if (favorites) {
        for (const fav of favorites) {
          const beach = fav.beach as unknown as Beach;
          // Avoid duplicates with home beach
          if (!candidates.find((c) => c.id === beach.id)) {
            candidates.push(beach);
          }
        }
        console.log(`✅ Added ${favorites.length} favorite beaches`);
      }
    }

    // GPS Phase (stubbed for Phase 2)
    if (options.userLocation && options.radiusMiles) {
      console.warn('⚠️ GPS discovery not yet implemented (Phase 2)');
      // TODO Phase 2: Query get_nearby_beaches RPC function
      // const { data: nearby } = await supabase.rpc('get_nearby_beaches', {
      //   user_lat: options.userLocation.lat,
      //   user_lon: options.userLocation.lon,
      //   radius_miles: options.radiusMiles,
      // });
      // if (nearby) {
      //   for (const beach of nearby) {
      //     if (!candidates.find((c) => c.id === beach.id)) {
      //       candidates.push(beach);
      //     }
      //   }
      // }
    }

    return candidates;
  } catch (error) {
    console.error('❌ Error building candidate pool:', error);
    return [];
  }
}

// ============================================================================
// Forecast Fetching
// ============================================================================

/**
 * Batch fetch forecasts from cache with staleness tracking
 *
 * Uses shared getFreshForecastFromCache helper for all beaches.
 * Returns both successful and stale/missing beaches with detailed metadata.
 */
async function batchFetchForecasts(
  beaches: Beach[],
  options: {
    maxConcurrent: number;
    timeout: number;
    overallTimeout: number;
  }
): Promise<{
  successful: Array<{ beach: Beach; forecasts: EnhancedForecastEntity[] }>;
  failed: Array<{ beach: Beach; reason: string; stale: boolean }>;
}> {
  const startTime = Date.now();

  console.log(`🌊 [batchFetchForecasts] Fetching forecasts for ${beaches.length} beaches from cache`);

  const { getFreshForecastFromCache } = await import('@/lib/utils/forecast-service-utils');

  const results = await Promise.all(
    beaches.map(async (beach) => {
      try {
        const result = await getFreshForecastFromCache(beach.id, FORECAST_WINDOW_HOURS);

        if (result.metadata.missing) {
          return {
            beach,
            forecasts: null,
            failed: true,
            reason: result.metadata.reason || 'Missing data',
            stale: false,
          };
        }

        if (result.metadata.stale) {
          // Return stale data with warning
          return {
            beach,
            forecasts: result.forecasts,
            failed: false,
            reason: result.metadata.reason || 'Stale data',
            stale: true,
          };
        }

        return {
          beach,
          forecasts: result.forecasts,
          failed: false,
          reason: null,
          stale: false,
        };
      } catch (error) {
        console.error(`❌ [batchFetchForecasts] Error for ${beach.name}:`, error);
        return {
          beach,
          forecasts: null,
          failed: true,
          reason: error instanceof Error ? error.message : 'Unknown error',
          stale: false,
        };
      }
    })
  );

  const successful: Array<{ beach: Beach; forecasts: EnhancedForecastEntity[] }> = [];
  const failed: Array<{ beach: Beach; reason: string; stale: boolean }> = [];

  for (const result of results) {
    if (result.failed || !result.forecasts || result.forecasts.length === 0) {
      failed.push({
        beach: result.beach,
        reason: result.reason || 'No forecasts available',
        stale: result.stale,
      });
    } else {
      successful.push({
        beach: result.beach,
        forecasts: result.forecasts,
      });
    }
  }

  const duration = Date.now() - startTime;
  console.log(`📊 [batchFetchForecasts] Complete in ${duration}ms:`, {
    total: beaches.length,
    successful: successful.length,
    failed: failed.length,
    staleBeaches: results.filter(r => r.stale).map(r => r.beach.name).join(', '),
    failedBeaches: failed.map(f => `${f.beach.name} (${f.reason})`).join(', '),
  });

  return { successful, failed };
}

// ============================================================================
// Detailed Scoring
// ============================================================================

/**
 * Score beach for discovery with detailed sub-score breakdown
 */
async function scoreBeachForDiscovery(args: {
  beach: Beach;
  forecast: EnhancedForecastEntity;
  userPrefs: Awaited<ReturnType<typeof getUserSurfPreferences>> | null;
  affinity?: { affinity_score: number; session_count: number };
  distanceMiles?: number;
}): Promise<DetailedScore> {
  const { beach, forecast, userPrefs, affinity, distanceMiles } = args;

  const subscores = {
    waveHeightFit: 0,
    periodEnergyScore: 0,
    windAlignment: 0,
    tideFit: 0,
    affinityBonus: 0,
    distancePenalty: 0,
  };

  const reasons: string[] = [];
  const warnings: string[] = [];

  // Parse forecast values
  const waveHeight = parseFloat(forecast.wave_height || '0');
  const wavePeriod = parseFloat(forecast.wave_period?.replace('s', '') || '0');
  const windSpeed = parseFloat(forecast.wind_speed || '0');
  const windDir = getDirectionDegrees(forecast.wind_direction_deg, forecast.wind_direction);
  const tideHeight = parseFloat(forecast.tide_height || '0');
  const tideStatus = forecast.tide_status?.toLowerCase() || '';

  // 1. Wave Height Fit (0-25 points)
  if (userPrefs) {
    const userMin = userPrefs.wave_min_ft || 2;
    const userMax = userPrefs.wave_max_ft || 8;

    if (waveHeight >= userMin && waveHeight <= userMax) {
      subscores.waveHeightFit = 25;
      reasons.push(
        `Waves ${forecast.wave_height} match your comfort range (${userMin}-${userMax} ft)`
      );
    } else if (waveHeight >= userMin * 0.8 && waveHeight <= userMax * 1.2) {
      subscores.waveHeightFit = 15;
      reasons.push(`Waves ${forecast.wave_height} are close to your preferred range`);
    } else {
      subscores.waveHeightFit = 5;
      if (waveHeight < userMin) {
        warnings.push(`Waves ${forecast.wave_height} may be smaller than you prefer`);
      } else {
        warnings.push(`Waves ${forecast.wave_height} may be larger than your comfort zone`);
      }
    }
  } else {
    // No user prefs - use reasonable defaults
    if (waveHeight >= 2 && waveHeight <= 6) {
      subscores.waveHeightFit = 20;
      reasons.push(`Waves ${forecast.wave_height} are in a fun, surfable range`);
    } else {
      subscores.waveHeightFit = 10;
    }
  }

  // 2. Period/Energy Score (0-20 points)
  if (userPrefs) {
    const userMinPeriod = userPrefs.wave_period_min_s || 8;
    const userMaxPeriod = userPrefs.wave_period_max_s || 18;

    if (wavePeriod >= userMinPeriod && wavePeriod <= userMaxPeriod) {
      subscores.periodEnergyScore = 20;
      reasons.push(`${forecast.wave_period} period matches your preferred swell energy`);
    } else if (wavePeriod >= 10) {
      subscores.periodEnergyScore = 15;
      reasons.push(`Good swell period: ${forecast.wave_period}`);
    } else {
      subscores.periodEnergyScore = 5;
      warnings.push(`Short period ${forecast.wave_period} may produce choppy conditions`);
    }
  } else {
    // No user prefs - use quality thresholds
    if (wavePeriod >= 12) {
      subscores.periodEnergyScore = 20;
      reasons.push(`Excellent swell period: ${forecast.wave_period}`);
    } else if (wavePeriod >= 9) {
      subscores.periodEnergyScore = 15;
      reasons.push(`Good swell period: ${forecast.wave_period}`);
    } else {
      subscores.periodEnergyScore = 5;
    }
  }

  // 3. Wind Alignment (0-20 points)
  if (beach.wind_offshore_deg !== null && beach.wind_offshore_tol_deg !== null) {
    const offshoreDir = beach.wind_offshore_deg;
    const tolerance = beach.wind_offshore_tol_deg || 30;

    if (windDir === null) {
      // Missing wind direction even though the beach has metadata.
      // Fall back to a general wind assessment based on speed only.
      if (windSpeed <= 10) {
        subscores.windAlignment = 15;
        reasons.push(`Light wind ${forecast.wind_speed} - favorable conditions`);
      } else if (windSpeed <= 15) {
        subscores.windAlignment = 8;
      } else {
        subscores.windAlignment = 0;
        warnings.push(`Strong wind ${forecast.wind_speed} may affect conditions`);
      }
    } else {
    const angleDiff = Math.min(
      Math.abs(windDir - offshoreDir),
      360 - Math.abs(windDir - offshoreDir)
    );

    if (angleDiff <= tolerance && windSpeed <= 15) {
      subscores.windAlignment = 20;
      reasons.push(
        `Offshore ${forecast.wind_speed} ${forecast.wind_direction} wind - clean conditions`
      );
    } else if (angleDiff <= tolerance * 2) {
      subscores.windAlignment = 10;
      reasons.push(`Cross-shore wind - acceptable conditions`);
    } else {
      subscores.windAlignment = 0;
      warnings.push(`Onshore wind may create choppy conditions`);
    }
    }
  } else {
    // No beach wind data - use general assessment
    if (windSpeed <= 10) {
      subscores.windAlignment = 15;
      reasons.push(`Light wind ${forecast.wind_speed} - favorable conditions`);
    } else if (windSpeed <= 15) {
      subscores.windAlignment = 8;
    } else {
      subscores.windAlignment = 0;
      warnings.push(`Strong wind ${forecast.wind_speed} may affect conditions`);
    }
  }

  // 4. Tide Fit (0-15 points)
  if (beach.preferred_tide_ft_min !== null && beach.preferred_tide_ft_max !== null) {
    const idealMin = beach.preferred_tide_ft_min;
    const idealMax = beach.preferred_tide_ft_max;

    if (tideHeight >= idealMin && tideHeight <= idealMax) {
      subscores.tideFit = 15;
      reasons.push(`Tide ${forecast.tide_height} is ideal for this beach`);
    } else if (
      tideHeight >= idealMin * 0.8 &&
      tideHeight <= idealMax * 1.2
    ) {
      subscores.tideFit = 8;
      reasons.push(`Tide ${forecast.tide_height} is workable`);
    } else {
      subscores.tideFit = 3;
      warnings.push(`Tide ${forecast.tide_height} may be outside optimal range`);
    }
  } else {
    // No tide data - give partial credit
    subscores.tideFit = 8;
  }

  // 5. Affinity Bonus (0-15 points)
  if (affinity && affinity.affinity_score > 10) {
    subscores.affinityBonus = Math.min(affinity.affinity_score * 0.15, 15);
    const sessionCount = Math.round(affinity.affinity_score / 10);
    reasons.push(`You've surfed here ${sessionCount}+ times - familiar spot`);
  }

  // 6. Distance Penalty (0 to -20 points) - Phase 2
  if (distanceMiles !== undefined) {
    if (distanceMiles <= 5) {
      subscores.distancePenalty = 0;
    } else if (distanceMiles <= 15) {
      subscores.distancePenalty = -5;
    } else if (distanceMiles <= 30) {
      subscores.distancePenalty = -10;
    } else {
      subscores.distancePenalty = -20;
      warnings.push(`${Math.round(distanceMiles)} miles away - long drive`);
    }
  }

  // Calculate total (normalized)
  //
  // Goal: Make 100 achievable even when some beach metadata is missing.
  // We normalize the "conditions" subtotal to a 0-100 scale based on which scoring
  // dimensions are available for this beach, then apply affinity (optional bonus)
  // and distance (optional penalty).
  const windMax =
    beach.wind_offshore_deg !== null && beach.wind_offshore_tol_deg !== null
      ? 20
      : 15; // speed-only fallback scoring max
  const tideMax =
    beach.preferred_tide_ft_min !== null && beach.preferred_tide_ft_max !== null
      ? 15
      : 8; // neutral credit when no beach tide metadata

  const conditionsEarned =
    subscores.waveHeightFit +
    subscores.periodEnergyScore +
    subscores.windAlignment +
    subscores.tideFit;
  const conditionsMax = 25 + 20 + windMax + tideMax;

  const normalizedConditions =
    conditionsMax > 0 ? (conditionsEarned / conditionsMax) * 100 : 0;

  const total = Math.max(
    0,
    Math.min(
      100,
      normalizedConditions + subscores.affinityBonus + subscores.distancePenalty
    )
  );

  // Determine match quality
  let matchQuality: 'perfect' | 'excellent' | 'good' | 'fair';
  if (total >= 85) matchQuality = 'perfect';
  else if (total >= 70) matchQuality = 'excellent';
  else if (total >= 55) matchQuality = 'good';
  else matchQuality = 'fair';

  // Add skill level warning if needed
  if (beach.skill_level === 'advanced' || beach.skill_level === 'expert') {
    if (!warnings.some((w) => w.includes('Advanced'))) {
      warnings.push('Advanced spot - check conditions carefully');
    }
  }

  return {
    total,
    subscores,
    matchQuality,
    reasons: reasons.slice(0, 5), // Top 5 reasons
    warnings,
  };
}

// ============================================================================
// Best Window Selection
// ============================================================================

/**
 * Score a single forecast window for time-slot selection
 *
 * Evaluates conditions quality for a specific 3-hour forecast window
 * using the same scoring logic as `scoreBeachForDiscovery`, but focused
 * only on time-varying factors (waves, wind, tide).
 *
 * Excludes:
 * - Beach affinity (not time-specific)
 * - Distance penalty (not time-specific)
 *
 * @param forecast - Single forecast entity to score
 * @param beach - Beach metadata for context
 * @param userPrefs - User surf preferences (optional)
 * @returns Conditions score (0-80 points: wave height 25 + period 20 + wind 20 + tide 15)
 */
function scoreForecastWindow(
  forecast: EnhancedForecastEntity,
  beach: Beach,
  userPrefs: Awaited<ReturnType<typeof getUserSurfPreferences>> | null
): number {
  let score = 0;

  // Parse forecast values
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
    // No user prefs - use reasonable defaults
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
    // No user prefs - use quality thresholds
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
      // Missing direction: fall back to speed-only assessment.
      if (windSpeed <= 10) {
        score += 15;
      } else if (windSpeed <= 15) {
        score += 8;
      }
      // else 0
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
      // else 0 points for onshore wind
    }
  } else {
    // No beach wind data - use general assessment
    if (windSpeed <= 10) {
      score += 15;
    } else if (windSpeed <= 15) {
      score += 8;
    }
    // else 0 points for strong wind
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
    // No tide data - give partial credit
    score += 8;
  }

  return score;
}

/**
 * Select best 3-hour window from forecast using composite scoring with time-priority
 *
 * ALGORITHM:
 * 1. For each forecast entry, calculate:
 *    - windowScore: Evaluate conditions (waves, wind, tide) using scoreForecastWindow
 *    - confidenceScore: Normalize confidence_score to 0-100 scale
 * 2. Combine with weighted average: composite = (windowScore * 0.7) + (confidenceScore * 0.3)
 * 3. Apply time-decay penalty: adjustedScore = composite - (hoursAhead * TIME_DECAY_PER_HOUR)
 * 4. Select highest adjusted score
 * 5. Tie-breaking: If adjusted scores tie, prefer higher composite, then windowScore, then later time
 *
 * This prioritizes near-term forecasts while still respecting conditions quality.
 * Time decay: 0.5 pts/hour (capped at 24 hours = 12 points max penalty).
 *
 * @param forecasts - Array of forecast entities for the beach
 * @param beach - Beach metadata for wind/tide preferences
 * @param userPrefs - User surf preferences (optional, for wave size/period matching)
 * @returns Best window or null if none viable
 */
function selectBestWindow(
  forecasts: EnhancedForecastEntity[],
  beach: Beach,
  userPrefs: Awaited<ReturnType<typeof getUserSurfPreferences>> | null,
  horizonHours?: number
): PersonalizedForecastWindow | null {
  if (forecasts.length === 0) return null;

  const now = new Date();

  // Get beach's local timezone from coordinates for accurate night filtering
  const beachTz = getTimezoneFromCoords(beach.lat || 0, beach.lon || 0);

  // Track best window with detailed scoring
  let bestAdjustedScore = -1;
  let bestComposite = -1;
  let bestWindowScore = -1;
  let bestForecast: EnhancedForecastEntity | null = null;

  for (const forecast of forecasts) {
    // Parse forecast time as UTC since that's how it's stored
    const forecastTime = new Date(`${forecast.forecast_date}T${forecast.forecast_time}Z`);
    if (forecastTime < now) {
      continue;
    }

    // Skip nighttime hours (9pm - 6am) in the beach's local timezone
    // This ensures we show realistic surf times regardless of server timezone
    const localHour = getLocalHour(forecastTime, beachTz);
    if (isNightHour(localHour)) {
      continue;
    }

    // 1. Calculate conditions score for this time slot (0-80 points)
    const windowScore = scoreForecastWindow(forecast, beach, userPrefs);

    // 2. Normalize confidence score to 0-100 scale
    const confidenceScore = forecast.confidence_score || 50;

    // 3. Composite score: 70% conditions quality + 30% confidence
    const composite = windowScore * 0.7 + confidenceScore * 0.3;

    // 4. Apply time-decay penalty
    const hoursAhead = (forecastTime.getTime() - now.getTime()) / (1000 * 60 * 60);

    // Optional hard horizon for "next 24 hours" UX: ignore windows beyond the horizon.
    if (
      typeof horizonHours === "number" &&
      Number.isFinite(horizonHours) &&
      hoursAhead > horizonHours
    ) {
      continue;
    }

    const cappedHours = Math.min(hoursAhead, MAX_TIME_DECAY_HOURS);
    const timeDecay = cappedHours * TIME_DECAY_PER_HOUR;
    const adjustedScore = composite - timeDecay;

    // 5. Select best, with updated tie-breaking logic
    const isBetter =
      adjustedScore > bestAdjustedScore ||
      (adjustedScore === bestAdjustedScore && composite > bestComposite) ||
      (adjustedScore === bestAdjustedScore &&
        composite === bestComposite &&
        windowScore > bestWindowScore) ||
      (adjustedScore === bestAdjustedScore &&
        composite === bestComposite &&
        windowScore === bestWindowScore &&
        bestForecast &&
        forecastTime > new Date(`${bestForecast.forecast_date}T${bestForecast.forecast_time}`));

    if (isBetter) {
      bestAdjustedScore = adjustedScore;
      bestComposite = composite;
      bestWindowScore = windowScore;
      bestForecast = forecast;
    }
  }

  if (!bestForecast) return null;

  // Build window from best forecast
  // Parse as UTC since forecast times are stored in UTC
  const windowStart = new Date(`${bestForecast.forecast_date}T${bestForecast.forecast_time}Z`);

  return {
    start: windowStart,
    end: new Date(windowStart.getTime() + WINDOW_HOURS * 60 * 60 * 1000),
    tide: bestForecast.tide_status || 'Unknown',
    wind: `${bestForecast.wind_speed} ${bestForecast.wind_direction}`,
    waveHeight: bestForecast.wave_height || 'Unknown',
    wavePeriod: bestForecast.wave_period || 'Unknown',
    confidence: bestForecast.confidence_score || 50,
  };
}

// ============================================================================
// Summary Generation
// ============================================================================

/**
 * Generate human-readable summary for discovery recommendation
 */
function generateDiscoverySummary(
  beach: Beach,
  window: PersonalizedForecastWindow,
  score: DetailedScore
): string {
  // NOTE: Avoid date-fns here to keep this service robust in all runtimes.
  // `Intl.DateTimeFormat` is available in Node/Edge and won't fail due to ESM/CJS interop.
  const timeStr = (() => {
    try {
      return new Intl.DateTimeFormat('en-US', {
        weekday: 'short',
        hour: 'numeric',
        minute: '2-digit',
      }).format(window.start);
    } catch {
      return window.start.toISOString();
    }
  })();

  const matchDesc =
    score.matchQuality === 'perfect'
      ? 'Perfect match'
      : score.matchQuality === 'excellent'
        ? 'Excellent match'
        : score.matchQuality === 'good'
          ? 'Good match'
          : 'Fair conditions';

  return `${matchDesc} at ${beach.name} - ${window.waveHeight} with ${window.wind}. Best at ${timeStr}.`;
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
    console.error('Error loading beach affinity:', error);
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
 * Returns null when direction is missing/unparseable.
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

  // If text is actually numeric degrees, parse it.
  const asNum = Number(trimmed);
  if (Number.isFinite(asNum)) {
    return ((asNum % 360) + 360) % 360;
  }

  // Cardinal fallback (N/SW/etc). Note: parseWaveDirection returns 0 for both "N" and unknown,
  // so handle unknown by checking membership first.
  const upper = trimmed.toUpperCase();
  const knownCardinals = new Set([
    'N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'
  ]);
  if (!knownCardinals.has(upper)) return null;
  return parseWaveDirection(upper);
}

/**
 * Calculate distance between two coordinates (Haversine formula)
 * Phase 2: GPS distance calculation
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
