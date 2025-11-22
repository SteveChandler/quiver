/**
 * Personalized Home Forecast Service
 *
 * Generates personalized surf recommendations for the home screen by:
 * 1. Building candidate pool from user's home beach and favorites
 * 2. Fetching forecasts using CACHE-ONLY strategy:
 *    - Read from enhanced_forecasts table (~50ms)
 *    - Return cached data even if stale (with warnings in metadata)
 *    - Never generates fresh forecasts (background jobs handle refresh)
 * 3. Scoring beaches using personalized-scoring-service
 * 4. Selecting best time window and generating human-readable summaries
 *
 * Performance:
 * - Consistent ~500ms total (3 DB queries for candidates + cache reads)
 * - No timeouts from API regeneration attempts
 * - Parallel forecast fetching with concurrency control
 *
 * @module lib/services/personalized-home-forecast-service
 */

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { 
  scoreBeachesForUser as scoreBeachesBatch,
  type PersonalizedScore 
} from "./personalized-scoring-service";
import type { Beach } from "@/types/database";
import type { EnhancedForecastEntity } from "@/types/forecast";
import type {
  PersonalizedForecastRecommendation,
  PersonalizedForecastWindow,
  PersonalizedForecastOptions,
  BeachForecastCandidate,
} from "@/types/personalization";

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_MAX_CONCURRENT = 3;
const DEFAULT_TIMEOUT_MS = 5000; // Per-beach timeout
const DEFAULT_OVERALL_TIMEOUT_MS = 8000; // Overall batch timeout
const WINDOW_HOURS = 3;
const FORECAST_WINDOW_HOURS = 48;

// ============================================================================
// Main Entry Point
// ============================================================================

/**
 * Get personalized home forecast recommendation
 * 
 * Returns the best surf opportunity from user's home beach and favorites,
 * with personalized scoring based on preferences and beach affinity.
 * 
 * @param userId - User ID
 * @param options - Optional configuration
 * @returns Personalized recommendation or null if none available
 * 
 * @example
 * const recommendation = await getPersonalizedHomeForecast('user-123');
 * if (recommendation) {
 *   console.log(recommendation.summary);
 *   console.log(recommendation.reasons);
 * }
 */
export async function getPersonalizedHomeForecast(
  userId: string,
  options: PersonalizedForecastOptions = {}
): Promise<PersonalizedForecastRecommendation | null> {
  const startTime = Date.now();

  try {
    console.log(`🏠 Generating personalized home forecast for user ${userId}`);

    // 1. Build candidate pool (home beach + favorites)
    const candidates = await buildCandidatePool(userId, options);

    if (candidates.length === 0) {
      console.warn(`⚠️ No candidate beaches found for user ${userId}`);
      return null;
    }

    console.log(`✅ Found ${candidates.length} candidate beaches`);

    // 2. Fetch forecasts for all candidates with timeout bounds
    const maxConcurrent = options.maxConcurrent || DEFAULT_MAX_CONCURRENT;
    const perBeachTimeout = options.timeout || DEFAULT_TIMEOUT_MS;
    const overallTimeout = options.overallTimeout || DEFAULT_OVERALL_TIMEOUT_MS;

    const beachForecasts = await batchFetchForecasts(candidates, {
      maxConcurrent,
      timeout: perBeachTimeout,
      overallTimeout,
    });

    const successRate = beachForecasts.length / candidates.length;
    const successPercent = Math.round(successRate * 100);

    console.log(`📊 Retrieved forecasts: ${beachForecasts.length}/${candidates.length} beaches (${successPercent}%)`);

    if (beachForecasts.length === 0) {
      console.error(`❌ No forecasts retrieved for user ${userId} - all ${candidates.length} beaches failed`);
      return null;
    }

    // Log warning if partial success
    if (beachForecasts.length < candidates.length) {
      const failed = candidates.length - beachForecasts.length;
      const failedBeaches = candidates
        .filter(c => !beachForecasts.find(bf => bf.beach.id === c.id))
        .map(c => c.name)
        .join(', ');
      console.warn(`⚠️ Partial success: ${failed}/${candidates.length} beaches failed (${failedBeaches}), continuing with available data`);
    }

    // 3. Select best window for each beach
    const beachCandidates: BeachForecastCandidate[] = [];

    for (const { beach, forecasts } of beachForecasts) {
      const bestWindow = selectBestWindow(forecasts);
      if (bestWindow) {
        const baseScore = calculateBaseScore(bestWindow, forecasts[0]);
        beachCandidates.push({
          beach,
          forecasts,
          bestWindow,
          baseScore,
        });
      } else {
        console.warn(`⚠️ No viable window found for ${beach.name}`);
      }
    }

    if (beachCandidates.length === 0) {
      console.error(`❌ No viable forecast windows found for user ${userId} (${beachForecasts.length} beaches had data)`);
      return null;
    }

    console.log(`✅ Found ${beachCandidates.length} beaches with viable windows`);

    // 4. Score beaches with personalization
    const scoredBeaches = await scoreBeachesForUser(userId, beachCandidates);

    // 5. Select best beach
    const best = scoredBeaches.reduce((prev, curr) =>
      curr.personalizedScore.score > prev.personalizedScore.score ? curr : prev
    );

    // 6. Build recommendation
    const recommendation: PersonalizedForecastRecommendation = {
      beach: best.beach,
      window: best.bestWindow!,
      forecast: best.forecasts[0],
      score: best.personalizedScore.score,
      personalized: best.personalizedScore.personalized,
      breakdown: best.personalizedScore.breakdown,
      summary: generateSummary(best),
      reasons: generateReasons(best),
      generated_at: new Date().toISOString(),
      total_beaches_count: candidates.length,
      available_beaches_count: beachForecasts.length,
      partial_success: beachForecasts.length < candidates.length,
    };

    const duration = Date.now() - startTime;
    console.log(
      `✅ Generated recommendation in ${duration}ms: ${recommendation.beach.name} (score: ${recommendation.score.toFixed(1)}, from ${beachCandidates.length} candidates)`
    );

    return recommendation;
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`❌ Error after ${duration}ms for user ${userId}:`, error);
    return null;
  }
}

// ============================================================================
// Candidate Pool Builder
// ============================================================================

/**
 * Build candidate pool from user's home beach and favorites
 * 
 * Queries: 1 for profile + home beach, 1 for favorites with beaches
 * Returns beaches ordered by: home beach first, then favorites by rank
 * 
 * @param userId - User ID
 * @param options - Optional configuration
 * @returns Array of candidate beaches
 */
async function buildCandidatePool(
  userId: string,
  options: PersonalizedForecastOptions
): Promise<Beach[]> {
  const supabase = createSupabaseServiceRoleClient();
  const candidates: Beach[] = [];

  try {
    console.log(`🔍 [buildCandidatePool] Querying profile for user ${userId}`);

    // Query 1: Get user profile with home beach
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select(`
        home_beach_id,
        home_beach:beaches!profiles_home_beach_id_fkey(
          id, name, slug, city, state, lat, lon,
          break_type, crowd_level
        )
      `)
      .eq("id", userId)
      .single();

    console.log(`📊 [buildCandidatePool] Profile query result:`, {
      hasProfile: !!profile,
      profileError: profileError?.message,
      homeBeachId: profile?.home_beach_id,
      homeBeachName: profile?.home_beach?.name,
    });

    // Add home beach if available (prefer explicit option)
    const homeBeachId = options.homeBeachId || profile?.home_beach_id;
    if (homeBeachId) {
      if (profile?.home_beach) {
        candidates.push(profile.home_beach as any);
        console.log(`✅ Added home beach: ${profile.home_beach.name}`);
      } else if (options.homeBeachId) {
        // Fetch beach by override ID
        const { data: homeBeach } = await supabase
          .from("beaches")
          .select("id, name, slug, city, state, lat, lon, break_type, crowd_level")
          .eq("id", options.homeBeachId)
          .single();

        if (homeBeach) {
          candidates.push(homeBeach as any);
          console.log(`✅ Added override home beach: ${homeBeach.name}`);
        }
      }
    }

    console.log(`🔍 [buildCandidatePool] Querying favorites for user ${userId}`);

    // Query 2: Get favorites with beaches, ordered by rank
    const { data: favorites, error: favError } = await supabase
      .from("favorite_beaches")
      .select(`
        rank,
        beach:beaches(
          id, name, slug, city, state, lat, lon,
          break_type, crowd_level
        )
      `)
      .eq("user_id", userId)
      .order("rank", { ascending: true });

    console.log(`📊 [buildCandidatePool] Favorites query result:`, {
      favoritesCount: favorites?.length || 0,
      favoritesError: favError?.message,
      favoriteNames: favorites?.map(f => f.beach?.name).filter(Boolean),
    });

    // Add favorites (skip duplicates)
    if (favorites) {
      const addedIds = new Set(candidates.map(b => b.id));

      for (const fav of favorites) {
        if (fav.beach && !addedIds.has(fav.beach.id)) {
          candidates.push(fav.beach as any);
          addedIds.add(fav.beach.id);
          console.log(`✅ Added favorite: ${fav.beach.name} (rank: ${fav.rank})`);
        }
      }
    }

    console.log(`✅ [buildCandidatePool] Final candidates:`, {
      count: candidates.length,
      beaches: candidates.map(c => `${c.name} (${c.id})`).join(', '),
    });

    return candidates;
  } catch (error) {
    console.error(`❌ [buildCandidatePool] Error for user ${userId}:`, error);
    return [];
  }
}

// ============================================================================
// Forecast Fetcher
// ============================================================================

interface BeachWithForecasts {
  beach: Beach;
  forecasts: EnhancedForecastEntity[];
}

/**
 * Fetch forecast for a single beach from cache only
 *
 * CACHE-ONLY: Never generates fresh forecasts via API.
 * Returns cached data even if stale, with clear metadata.
 *
 * @param beach - Beach to fetch forecast for
 * @param timeoutMs - Ignored (kept for signature compatibility)
 * @returns Forecast array with metadata or null
 */
async function fetchForecastForBeach(
  beach: Beach,
  timeoutMs: number // Ignored but kept for compatibility
): Promise<{
  forecasts: EnhancedForecastEntity[] | null;
  stale: boolean;
  reason: string | null;
}> {
  try {
    const { getFreshForecastFromCache } = await import(
      "@/lib/utils/forecast-service-utils"
    );

    const result = await getFreshForecastFromCache(beach.id, FORECAST_WINDOW_HOURS);

    if (result.metadata.missing) {
      console.warn(
        `⚠️ [fetchForecast] No cached data for ${beach.name}: ${result.metadata.reason}`
      );
      return {
        forecasts: null,
        stale: false,
        reason: result.metadata.reason,
      };
    }

    if (result.metadata.stale) {
      console.warn(
        `⚠️ [fetchForecast] Using stale data for ${beach.name}: ${result.metadata.reason}`
      );
      return {
        forecasts: result.forecasts,
        stale: true,
        reason: result.metadata.reason,
      };
    }

    console.log(
      `✅ [fetchForecast] Fresh cached data for ${beach.name} (${result.forecasts.length} forecasts)`
    );

    return {
      forecasts: result.forecasts,
      stale: false,
      reason: null,
    };
  } catch (error) {
    console.error(`⚠️ Failed to fetch forecast for ${beach.name}:`, error);
    return {
      forecasts: null,
      stale: false,
      reason: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Batch fetch forecasts with concurrency control
 *
 * Now purely cache-backed - no on-demand regeneration.
 * Returns beaches with forecasts (fresh or stale) and tracks failures.
 *
 * @param beaches - Beaches to fetch forecasts for
 * @param options - Fetch options
 * @returns Array of beaches with forecasts
 */
async function batchFetchForecasts(
  beaches: Beach[],
  options: {
    maxConcurrent: number;
    timeout: number;
    overallTimeout?: number;
  }
): Promise<BeachWithForecasts[]> {
  const startTime = Date.now();
  const overallTimeoutMs = options.overallTimeout || DEFAULT_OVERALL_TIMEOUT_MS;

  console.log(`🌊 [batchFetchForecasts] Starting batch fetch for ${beaches.length} beaches (cache-only mode)`);

  const queue = [...beaches];
  const results: BeachWithForecasts[] = [];
  const failed: Array<{ beach: string; reason: string; stale: boolean }> = [];
  const inFlight = new Set<Promise<void>>();

  try {
    while (queue.length > 0 || inFlight.size > 0) {
      // Check overall timeout
      const elapsed = Date.now() - startTime;
      if (elapsed > overallTimeoutMs * 0.9) {
        console.warn(`⏱️ [batchFetchForecasts] Approaching overall timeout (${elapsed}ms/${overallTimeoutMs}ms), stopping new fetches`);
        break;
      }

      // Start new fetches up to max concurrency
      while (inFlight.size < options.maxConcurrent && queue.length > 0) {
        const beach = queue.shift()!;

        console.log(`🌊 [fetchForecast] Fetching forecast for ${beach.name} from cache`);

        const promise = fetchForecastForBeach(beach, options.timeout)
          .then(result => {
            if (result.forecasts && result.forecasts.length > 0) {
              results.push({ beach, forecasts: result.forecasts });
              if (result.stale) {
                console.warn(`⚠️ [fetchForecast] Using stale data for ${beach.name}: ${result.reason}`);
                failed.push({ beach: beach.name, reason: result.reason || 'Stale data', stale: true });
              } else {
                console.log(`✅ [fetchForecast] Got ${result.forecasts.length} forecasts for ${beach.name}`);
              }
            } else {
              failed.push({ beach: beach.name, reason: result.reason || 'No data', stale: false });
              console.warn(`⚠️ [fetchForecast] No forecast data for ${beach.name}: ${result.reason}`);
            }
          })
          .catch(error => {
            failed.push({ beach: beach.name, reason: error?.message ?? String(error), stale: false });
            console.error(`❌ [fetchForecast] Failed to fetch forecast for ${beach.name}:`, {
              error: error?.message ?? String(error),
              beachId: beach.id,
            });
          })
          .finally(() => inFlight.delete(promise));

        inFlight.add(promise);
      }

      // Wait for at least one to complete
      if (inFlight.size > 0) {
        await Promise.race(inFlight);
      }
    }

    // Wait for remaining in-flight requests with timeout
    if (inFlight.size > 0) {
      const remaining = overallTimeoutMs - (Date.now() - startTime);
      const waitTime = Math.max(100, remaining);
      console.log(`⏳ [batchFetchForecasts] Waiting up to ${waitTime}ms for ${inFlight.size} remaining fetches`);

      await Promise.race([
        Promise.allSettled(inFlight),
        new Promise(resolve => setTimeout(resolve, waitTime)),
      ]);
    }
  } catch (error) {
    console.error(`❌ [batchFetchForecasts] Batch fetch error:`, error);
  }

  const duration = Date.now() - startTime;
  const successful = results.length;
  const failedCount = beaches.length - successful;
  const staleCount = failed.filter(f => f.stale).length;

  console.log(`📊 [batchFetchForecasts] Batch complete in ${duration}ms:`, {
    total: beaches.length,
    succeeded: successful,
    failed: failedCount,
    staleBeaches: staleCount,
    successfulBeaches: results.map(r => r.beach.name).join(', '),
    failedBeaches: failed.map(f => `${f.beach} (${f.reason})`).join(', '),
  });

  return results;
}

// ============================================================================
// Window Selector
// ============================================================================

/**
 * Select best 3-hour window from forecast array
 * 
 * Filters to next 48 hours, then scores each window based on:
 * - Wave quality (height + period)
 * - Wind conditions (speed + direction)
 * - Tide status
 * 
 * @param forecasts - Array of forecast time points
 * @returns Best window or null if none viable
 */
function selectBestWindow(
  forecasts: EnhancedForecastEntity[]
): PersonalizedForecastWindow | null {
  const now = new Date();
  const cutoff = new Date(now.getTime() + FORECAST_WINDOW_HOURS * 60 * 60 * 1000);
  
  // Filter to next 48 hours
  const upcoming = forecasts.filter(f => {
    const forecastTime = new Date(`${f.forecast_date}T${f.forecast_time}`);
    return forecastTime >= now && forecastTime <= cutoff;
  });
  
  if (upcoming.length === 0) {
    return null;
  }
  
  // Score each forecast
  let bestScore = -1;
  let bestForecast: EnhancedForecastEntity | null = null;
  
  for (const forecast of upcoming) {
    const score = calculateWindowScore(forecast);
    
    if (score > bestScore) {
      bestScore = score;
      bestForecast = forecast;
    }
  }
  
  if (!bestForecast) {
    return null;
  }
  
  // Build window from best forecast
  const start = new Date(`${bestForecast.forecast_date}T${bestForecast.forecast_time}`);
  const end = new Date(start.getTime() + WINDOW_HOURS * 60 * 60 * 1000);
  
  return {
    start,
    end,
    tide: bestForecast.tide_status || "Unknown",
    wind: `${bestForecast.wind_speed || "10 mph"} ${bestForecast.wind_direction || "SW"}`,
    waveHeight: bestForecast.wave_height || "2-3 ft",
    wavePeriod: bestForecast.wave_period || "10s",
    confidence: bestForecast.confidence_score || 70,
  };
}

/**
 * Calculate score for a single forecast window
 * 
 * Simple base scoring: wave quality + wind penalty + tide bonus
 * Range: 0-100
 * 
 * @param forecast - Forecast to score
 * @returns Score (0-100)
 */
function calculateWindowScore(forecast: EnhancedForecastEntity): number {
  let score = 50; // Base score
  
  // Wave height quality (0-30 points)
  const waveHeight = parseFloat(forecast.wave_height || "0");
  if (waveHeight >= 2 && waveHeight <= 6) {
    score += 30; // Ideal range
  } else if (waveHeight > 1 && waveHeight < 8) {
    score += 20; // Acceptable
  } else if (waveHeight >= 1) {
    score += 10; // Marginal
  }
  
  // Wave period quality (0-20 points)
  const period = parseFloat(forecast.wave_period?.replace("s", "") || "0");
  if (period >= 12) {
    score += 20; // Long period swell
  } else if (period >= 10) {
    score += 15; // Good period
  } else if (period >= 8) {
    score += 10; // Acceptable
  }
  
  // Wind penalty (0 to -20 points)
  const windSpeed = parseFloat(forecast.wind_speed || "0");
  if (windSpeed > 20) {
    score -= 20; // Too windy
  } else if (windSpeed > 15) {
    score -= 10; // Windy
  } else if (windSpeed < 5) {
    score += 5; // Glass conditions
  }
  
  // Tide bonus (0-10 points) - prefer rising/high
  const tideStatus = forecast.tide_status?.toLowerCase() || "";
  if (tideStatus.includes("rising") || tideStatus.includes("high")) {
    score += 10;
  } else if (tideStatus.includes("slack")) {
    score += 5;
  }
  
  return Math.max(0, Math.min(100, score));
}

/**
 * Calculate base score for best window
 * Used as input to personalized scoring
 * 
 * @param window - Best window
 * @param forecast - Forecast for window
 * @returns Base score (0-100)
 */
function calculateBaseScore(
  window: PersonalizedForecastWindow,
  forecast: EnhancedForecastEntity
): number {
  return calculateWindowScore(forecast);
}

// ============================================================================
// Scoring Wrapper
// ============================================================================

interface ScoredBeachCandidate extends BeachForecastCandidate {
  personalizedScore: PersonalizedScore;
}

/**
 * Score beaches for user with personalization
 * 
 * Pre-loads affinity map in single query, then calls batch scoring service.
 * Returns beaches with personalized scores.
 * 
 * @param userId - User ID
 * @param candidates - Beach candidates with windows and base scores
 * @returns Scored candidates
 */
async function scoreBeachesForUser(
  userId: string,
  candidates: BeachForecastCandidate[]
): Promise<ScoredBeachCandidate[]> {
  const supabase = createSupabaseServiceRoleClient();
  
  try {
    // Query 3: Pre-load affinity map for all beaches
    const beachIds = candidates.map(c => c.beach.id);
    const { data: affinityData } = await supabase
      .from("user_beach_affinity")
      .select("beach_id, affinity_score, session_count")
      .eq("user_id", userId)
      .in("beach_id", beachIds);
    
    // Build affinity map
    const affinityMap = new Map<string, { affinity_score: number; session_count: number }>();
    if (affinityData) {
      for (const affinity of affinityData) {
        affinityMap.set(affinity.beach_id, {
          affinity_score: affinity.affinity_score,
          session_count: affinity.session_count,
        });
      }
    }
    
    // Prepare data for batch scoring
    const beachesForScoring = candidates.map(c => ({
      beachId: c.beach.id,
      forecast: c.forecasts[0], // Use first forecast as representative
      baseScore: c.baseScore,
    }));
    
    // Call batch scoring service
    const scores = await scoreBeachesBatch(userId, beachesForScoring, affinityMap);
    
    // Merge scores back into candidates
    const scoredCandidates: ScoredBeachCandidate[] = candidates.map(candidate => {
      const personalizedScore = scores.get(candidate.beach.id) || {
        score: candidate.baseScore,
        personalized: false,
        breakdown: {
          base: candidate.baseScore,
          onboardingPrefs: 0,
          learnedPrefs: 0,
          affinity: 0,
        },
      };
      
      return {
        ...candidate,
        personalizedScore,
      };
    });
    
    return scoredCandidates;
  } catch (error) {
    console.error(`❌ Error scoring beaches for user ${userId}:`, error);
    
    // Graceful degradation: return candidates with base scores
    return candidates.map(candidate => ({
      ...candidate,
      personalizedScore: {
        score: candidate.baseScore,
        personalized: false,
        breakdown: {
          base: candidate.baseScore,
          onboardingPrefs: 0,
          learnedPrefs: 0,
          affinity: 0,
        },
      },
    }));
  }
}

// ============================================================================
// Summary Generators
// ============================================================================

/**
 * Generate human-readable summary
 * 
 * Format: "Best conditions at {beach} {day} {time}: {wave} waves, {wind} wind"
 * Mobile-friendly (< 100 chars)
 * 
 * @param candidate - Scored beach candidate
 * @returns Summary string
 */
function generateSummary(candidate: ScoredBeachCandidate): string {
  const beach = candidate.beach.name;
  const window = candidate.bestWindow!;
  
  // Format day
  const now = new Date();
  const start = window.start;
  const isToday = start.toDateString() === now.toDateString();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow = start.toDateString() === tomorrow.toDateString();
  
  let dayStr = "";
  if (isToday) {
    dayStr = "today";
  } else if (isTomorrow) {
    dayStr = "tomorrow";
  } else {
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    dayStr = days[start.getDay()];
  }
  
  // Format time
  const hour = start.getHours();
  let timeStr = "";
  if (hour < 12) {
    timeStr = "morning";
  } else if (hour < 17) {
    timeStr = "afternoon";
  } else {
    timeStr = "evening";
  }
  
  return `Best conditions at ${beach} ${dayStr} ${timeStr}: ${window.waveHeight} waves, ${window.wind.split(" ")[0]} wind`;
}

/**
 * Generate reasons for recommendation
 * 
 * Highlights 2-4 personalization factors that influenced the recommendation.
 * Ordered by impact: affinity > learned prefs > onboarding prefs
 * 
 * @param candidate - Scored beach candidate
 * @returns Array of reason strings
 */
function generateReasons(candidate: ScoredBeachCandidate): string[] {
  const reasons: string[] = [];
  const breakdown = candidate.personalizedScore.breakdown;
  const beach = candidate.beach.name;
  
  // Beach affinity
  if (breakdown.affinity > 5) {
    const count = Math.round(breakdown.affinity / 0.15 / 10); // Reverse engineer session count
    reasons.push(`You've surfed ${beach} frequently (${count > 5 ? "many" : count} sessions)`);
  }
  
  // Learned preferences
  if (breakdown.learnedPrefs > 10) {
    reasons.push("Conditions match your preferred wave and wind patterns");
  } else if (breakdown.learnedPrefs > 5) {
    reasons.push("Conditions align with your surf history");
  }
  
  // Onboarding preferences
  if (breakdown.onboardingPrefs > 10) {
    reasons.push("Matches your preferred wave size and break type");
  } else if (breakdown.onboardingPrefs > 5) {
    reasons.push("Good match for your surf style");
  }
  
  // Default reason if no personalization
  if (reasons.length === 0) {
    reasons.push("Optimal wave and wind conditions forecasted");
  }
  
  // Add confidence note if high
  const confidence = candidate.bestWindow!.confidence;
  if (confidence >= 80) {
    reasons.push(`High forecast confidence (${confidence}%)`);
  }
  
  return reasons.slice(0, 4); // Max 4 reasons
}

