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
import { getTimezoneFromCoords } from '@/lib/utils/timezone-utils.server';
import type { Beach } from '@/types/database';
import type { EnhancedForecastEntity } from '@/types/forecast';
import type {
  SurfDiscoveryRecommendation,
  SurfDiscoveryResponse,
  SurfDiscoveryOptions,
  DetailedScore,
  PersonalizedForecastWindow,
} from '@/types/personalization';
import { withApprovedPhotos } from '@/lib/supabase/query-builders';
import { FALLBACK_IMAGE_BY_NAME } from '@/lib/constants/featured-beaches-config';
import type { RecommendationLabel, MatchQuality } from '@/lib/scoring';
import type { ConditionBadge } from '@/types/personalization';

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
    console.error('Error fetching sun times:', error);
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
    const { candidates, preferredWaveSize } = await buildCandidatePool(userId, {
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
    const { successful: beachForecasts, failed: failedForecasts, staleCount } = await batchFetchForecasts(finalCandidates, {
      maxConcurrent,
      timeout,
      overallTimeout,
    });

    const successRate = beachForecasts.length / finalCandidates.length;
    const successPercent = Math.round(successRate * 100);

    console.log(
      `📊 Retrieved forecasts: ${beachForecasts.length}/${finalCandidates.length} beaches (${successPercent}%)`
    );

    // Log failures and staleness context
    if (failedForecasts.length > 0 || staleCount > 0) {
      console.warn(
        `⚠️ [discoverSurfSpots] Forecast issues: ${failedForecasts.length} failed, ${staleCount} stale (stale data excluded)`
      );
    }

    if (beachForecasts.length === 0) {
      console.error(`❌ No forecasts retrieved for user ${userId}`);
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
    const [userPrefs, affinityMap] = await Promise.all([
      getUserSurfPreferences(userId),
      loadBeachAffinity(userId, finalCandidates.map((b) => b.id)),
    ]);

    for (const { beach, forecasts } of beachForecasts) {
      const bestWindow = selectBestWindow(forecasts, beach, userPrefs, horizonHours, sunTimesCache);
      if (!bestWindow) {
        // console.warn(`⚠️ No viable window found for ${beach.name}`);
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
    console.log(
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
): Promise<{ candidates: Beach[]; preferredWaveSize: string | null }> {
  const supabase = createSupabaseServiceRoleClient();
  const candidates: Beach[] = [];
  let preferredWaveSize: string | null = null;

  try {
    if (options.includeHome !== false) {
      // Query 1: Get user profile with home beach
      const { data: profile } = await supabase
        .from('profiles')
        .select(
          `
          id,
          home_beach_id,
          preferred_wave_size,
          home_beach:beaches!profiles_home_beach_id_fkey (*)
        `
        )
        .eq('id', userId)
        .single();

      if (profile?.home_beach) {
        candidates.push(profile.home_beach as unknown as Beach);
        console.log(`✅ Added home beach: ${(profile.home_beach as any).name}`);
      }

      preferredWaveSize =
        (profile as unknown as { preferred_wave_size?: string | null })
          ?.preferred_wave_size ?? null;

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

    // GPS Phase: Add nearby beaches via PostGIS RPC (explicit location only).
    if (options.userLocation) {
      type NearbyBeachRow = {
        id: string;
        is_private: boolean | null;
        distance_meters: number | null;
      };

      const radiusMiles = Number.isFinite(options.radiusMiles)
        ? (options.radiusMiles as number)
        : 25;

      const cappedMiles = Math.min(Math.max(radiusMiles, 0), 100);
      const max_distance_meters = Math.round(cappedMiles * 1609.34);
      const limit_count = 40;

      const { data: nearbyRaw, error: nearbyError } = await supabase.rpc(
        'get_nearby_beaches',
        {
          input_lat: options.userLocation.lat,
          input_lng: options.userLocation.lon,
          max_distance_meters,
          limit_count,
        }
      );

      if (nearbyError) {
        console.warn('⚠️ [buildCandidatePool] Nearby RPC failed:', nearbyError);
      } else {
        const nearby = (nearbyRaw || []) as NearbyBeachRow[];
        const existingIds = new Set(candidates.map((b) => b.id));
        const orderedIds = nearby
          .filter((r) => !r.is_private)
          .map((r) => r.id)
          .filter((id) => !existingIds.has(id));

        if (orderedIds.length > 0) {
          const { data: beachRows, error: beachError } = await supabase
            .from('beaches')
            .select('*')
            .in('id', orderedIds)
            .eq('is_private', false)
            .limit(limit_count);

          if (beachError) {
            console.warn('⚠️ [buildCandidatePool] Nearby beach fetch failed:', beachError);
          } else if (beachRows && beachRows.length > 0) {
            const byId = new Map<string, Beach>(
              (beachRows as unknown as Beach[]).map((b) => [b.id, b])
            );
            const orderedBeaches = orderedIds
              .map((id) => byId.get(id))
              .filter((b): b is Beach => !!b);

            for (const beach of orderedBeaches) {
              if (!existingIds.has(beach.id)) {
                candidates.push(beach);
                existingIds.add(beach.id);
              }
            }
            console.log(`✅ Added ${orderedBeaches.length} nearby beaches (GPS)`);
          }
        }
      }
    }

    return { candidates, preferredWaveSize };
  } catch (error) {
    console.error('❌ Error building candidate pool:', error);
    return { candidates: [], preferredWaveSize: null };
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

  console.log(`🌊 [batchFetchForecasts] Fetching forecasts for ${beaches.length} beaches from cache (batched)`);

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
  console.log(`📊 [batchFetchForecasts] Complete in ${duration}ms:`, {
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
 * Score beach for discovery with detailed sub-score breakdown
 */
/**
 * Score beach for discovery with detailed sub-score breakdown
 */
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

  const preferredWaveRange = (() => {
    const pref = (preferredWaveSize || "").toLowerCase();
    if (!pref || pref === "any") return null;
    if (pref === "small") return { min: 1, max: 3, label: "1-3 ft" };
    if (pref === "medium") return { min: 3, max: 6, label: "3-6 ft" };
    if (pref === "large") return { min: 6, max: Number.POSITIVE_INFINITY, label: "6+ ft" };
    return null;
  })();

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
  const confidence = forecast.confidence_score ?? 50; // Default to 50 if missing
  
  // Parse numeric swell direction (some sources might return 'SSW', others degrees)
  // Assuming swell_1_direction might be string degrees "200" or cardinal "SSW".
  // Note: getDirectionDegrees handles both number and string inputs for wind, we reuse it or similar logic.
  // Ideally swell_1_direction is degrees in string format for CDIP.
  const swellDir = forecast.swell_1_direction 
    ? parseFloat(forecast.swell_1_direction) 
    : null; // If NaN it will fail check below, which is fine (no penalty if unknown, or safe fallback?)

  // 0. Swell Direction Check (Critical Filter)
  if (
    beach.swell_window_min_deg !== undefined &&
    beach.swell_window_min_deg !== null &&
    beach.swell_window_max_deg !== undefined &&
    beach.swell_window_max_deg !== null &&
    !isNaN(swellDir as number) &&
    swellDir !== null
  ) {
    const min = beach.swell_window_min_deg;
    const max = beach.swell_window_max_deg;
    
    // Handle wrap-around (e.g. min 300, max 40 covers NW to NE)
    const isWrapAround = min > max;
    const isIdeallyAligned = isWrapAround
      ? swellDir >= min || swellDir <= max
      : swellDir >= min && swellDir <= max;

    if (!isIdeallyAligned) {
      // Significant Penalty for wrong swell direction
      // We don't want to zero it out completely (maybe it wraps slightly), but -50 ensures it won't be a "Best Bet"
      // unless everything else is absolutely perfect, and even then it's low.
      // Actually, if it's the wrong direction, waves might be 0ft effectively.
      // Let's degrade the Wave Height score specifically or apply a massive penalty.
      
      // We'll apply a flat penalty to the conditions score effectively.
      warnings.push(`Swell direction ${Math.round(swellDir)}° is non-optimal for this break (${min}°-${max}°)`);
      
      // We can modify subscores directly or add a specific penalty
      // Let's add a "Swell Penalty" to the final calc or reduce waveHeightFit
      // Reducing waveHeightFit to 0 is a good start.
      subscores.waveHeightFit = 0; 
      // And maybe an extra penalty on total
      reasons.push(`Swell angle ${Math.round(swellDir)}° is blocked or poor`);
    } else {
        reasons.push(`Swell direction ${Math.round(swellDir)}° is optimal`);
    }
  }

  // 1. Wave Height Fit (0-25 points)
  if (preferredWaveRange) {
    const { min, max, label } = preferredWaveRange;
    const closeMin = min * 0.8;
    const closeMax = Number.isFinite(max) ? max * 1.2 : Number.POSITIVE_INFINITY;

    if (waveHeight >= min && waveHeight <= max) {
      subscores.waveHeightFit = 25;
      reasons.push(`Waves ${forecast.wave_height} match your preferred size (${label})`);
    } else if (waveHeight >= closeMin && waveHeight <= closeMax) {
      subscores.waveHeightFit = 15;
      reasons.push(`Waves ${forecast.wave_height} are close to your preferred size (${label})`);
      if (waveHeight < min) warnings.push(`Below your preferred size (${label})`);
      else warnings.push(`Above your preferred size (${label})`);
    } else {
      subscores.waveHeightFit = 5;
      if (waveHeight < min) warnings.push(`Below your preferred size (${label})`);
      else warnings.push(`Above your preferred size (${label})`);
    }
  } else if (userPrefs) {
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
    subscores.tideFit = 8;
  }

  // 4b. Tide Direction Penalty
  const beachTideDir = beach.preferred_tide_direction;
  if (beachTideDir && beachTideDir !== 'either' && tideStatus) {
    const forecastTideDir = tideStatus.includes('rising') ? 'rising'
      : tideStatus.includes('falling') ? 'falling'
      : tideStatus.includes('slack') || tideStatus.includes('high') || tideStatus.includes('low') ? 'slack'
      : null;

    if (forecastTideDir && beachTideDir !== forecastTideDir) {
      const dirPenalty = forecastTideDir === 'slack' ? 6 : 12;
      subscores.tideFit = Math.max(0, subscores.tideFit - dirPenalty);
      warnings.push(`Tide is ${forecastTideDir}, beach works best on ${beachTideDir} tide`);
    }
  }

  // 5. Affinity Bonus (0-15 points)
  if (affinity && affinity.affinity_score > 10) {
    subscores.affinityBonus = Math.min(affinity.affinity_score * 0.15, 15);
    const sessionCount = Math.round(affinity.affinity_score / 10);
    reasons.push(`You've surfed here ${sessionCount}+ times - familiar spot`);
  }

  // 6. Distance Penalty (0 to -20 points)
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
  const windMax =
    beach.wind_offshore_deg !== null && beach.wind_offshore_tol_deg !== null
      ? 20
      : 15;
  const tideMax =
    beach.preferred_tide_ft_min !== null && beach.preferred_tide_ft_max !== null
      ? 15
      : 8;

  const conditionsEarned =
    subscores.waveHeightFit +
    subscores.periodEnergyScore +
    subscores.windAlignment +
    subscores.tideFit;
  const conditionsMax = 25 + 20 + windMax + tideMax;

  const normalizedConditions =
    conditionsMax > 0 ? (conditionsEarned / conditionsMax) * 100 : 0;

  // Composite Score Calculation:
  // Weight conditions heavily (70%) but factor in confidence (30%)
  // This effectively dampens the score for long-range, uncertain forecasts.
  //
  // Example:
  // Perfect Conditions (100) + 50% Confidence -> 70 + 15 = 85 (8.5/10)
  // Perfect Conditions (100) + 90% Confidence -> 70 + 27 = 97 (9.7/10)
  const compositeScore = (normalizedConditions * 0.7) + (confidence * 0.3);

  let total = Math.max(
    0,
    Math.min(
      100,
      compositeScore + subscores.affinityBonus + subscores.distancePenalty
    )
  );

  // If waves are outside the user's explicit preferred size, apply a graduated penalty.
  if (preferredWaveRange) {
    const { min, max } = preferredWaveRange;
    const outsideRange = waveHeight < min
      ? min - waveHeight
      : waveHeight > max
        ? waveHeight - max
        : 0;

    if (outsideRange > 0) {
      const penalty = Math.min(36, Math.floor(outsideRange / 0.5) * 12);
      total = Math.max(0, total - penalty);
      total = Math.min(total, 75);
    }
  }

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

  // Generate condition badges
  const conditionBadges = generateConditionBadges(forecast, beach, {
    waveHeightFit: subscores.waveHeightFit,
    periodEnergyScore: subscores.periodEnergyScore,
    windAlignment: subscores.windAlignment,
    tideFit: subscores.tideFit,
  });

  return {
    total,
    subscores,
    matchQuality,
    reasons: reasons.slice(0, 5),
    warnings,
    conditionBadges,
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
  sunTimesCache?: Map<string, { sunrises: Date[]; sunsets: Date[] }>
): PersonalizedForecastWindow | null {
  if (forecasts.length === 0) return null;

  const now = new Date();
  const beachTz = getTimezoneFromCoords(beach.lat || 0, beach.lon || 0);

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

  // DEBUG: Log morning priority state and first 10 forecasts
  console.log(`🔍 [selectBestWindow] ${beach.name}: isMorning=${isMorning}, todayDateStr=${todayDateStr}`);
  scoredForecasts.slice(0, 10).forEach(({ localHourStr, score, isToday }) => {
    console.log(`   ${localHourStr}: score=${score}, isToday=${isToday}`);
  });

  if (scoredForecasts.length === 0) return null;

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

  for (let i = 0; i < scoredForecasts.length; i++) {
    const { forecast, forecastTime: startTime, score: startScore, isToday } = scoredForecasts[i];

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
    for (let j = i; j < scoredForecasts.length - 1; j++) {
      const current = scoredForecasts[j];
      const next = scoredForecasts[j + 1];

      // Stop if next forecast is on a different date
      if (current.forecast.forecast_date !== next.forecast.forecast_date) break;

      // Check if conditions drop below threshold
      if (current.score >= MIN_SCORE_THRESHOLD && next.score < MIN_SCORE_THRESHOLD) {
        // Linear interpolation to find precise degradation time
        const dropAmount = current.score - next.score;
        const thresholdDiff = current.score - MIN_SCORE_THRESHOLD;
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

    // Validate minimum session length (using effective start time)
    const durationHours = (endTime.getTime() - effectiveStartTime.getTime()) / (1000 * 60 * 60);
    if (durationHours < MIN_SESSION_HOURS) continue;

    // Apply time decay for ranking
    const cappedHours = Math.min(hoursAhead, MAX_TIME_DECAY_HOURS);
    const timeDecay = cappedHours * TIME_DECAY_PER_HOUR;

    // Morning priority: add bonus to today's forecasts before noon
    // Also add extra bonus for morning/afternoon times (before 5pm) during morning hours
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

    const adjustedScore = startScore - timeDecay + todayBonus + morningTimeBonus;

    if (adjustedScore > bestAdjustedScore) {
      bestAdjustedScore = adjustedScore;
      bestWindow = { forecast, start: effectiveStartTime, end: endTime, score: startScore };
    }
  }

  // Fallback: if no forecasts passed threshold, use the best available anyway
  if (!bestWindow && scoredForecasts.length > 0) {
    // Filter out night hours before selecting fallback (same logic as main loop)
    const daylightForecasts = scoredForecasts.filter(({ forecastTime }) => {
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
    const getAdjustedScore = (f: typeof daylightForecasts[0]) => {
      let bonus = 0;
      if (isMorning && f.isToday) {
        bonus += TODAY_BONUS_POINTS;
        // Extra bonus for morning/afternoon times (before 5pm)
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
      return f.score + bonus;
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
        console.log(`🔍 [selectBestWindow] ${beach.name}: NO WINDOW FOUND`);
        return null;
    }

  // DEBUG: Log final selection
  console.log(`🔍 [selectBestWindow] ${beach.name}: SELECTED start=${bestWindow.start.toISOString()} end=${bestWindow.end.toISOString()}`);

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
