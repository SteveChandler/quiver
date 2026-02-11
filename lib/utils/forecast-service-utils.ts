import { EnhancedForecastService } from "@/lib/services/enhanced-forecast-service";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { getStalenessThreshold } from "@/lib/config/forecast-staleness";
import type { EnhancedForecastEntity } from "@/types/forecast";
// Removed unused type import to satisfy TS6133

/**
 * Split an array into chunks of a given size
 */
function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Get singleton instance of EnhancedForecastService
 */
function getEnhancedForecastService(): EnhancedForecastService {
  return new EnhancedForecastService();
}

/**
 * Check if forecast data is stale based on source-specific thresholds
 *
 * Different data sources update at different frequencies:
 * - CDIP (buoy data): Updates hourly → marked stale after 1.5 hours
 * - NOAA WaveWatch: Updates every 6 hours → marked stale after 6 hours
 * - FALLBACK data: Less critical → marked stale after 12 hours
 *
 * @param updatedAt - Timestamp when the forecast was last updated
 * @param dataSource - The forecast data source (e.g., "CDIP", "NOAA_NWS")
 * @returns true if the data is stale based on source-specific threshold
 *
 * @example
 * ```typescript
 * const isStale = isDataStale("2024-01-15T10:00:00Z", "CDIP");
 * // Returns true if more than 1.5 hours have passed
 * ```
 */
export function isDataStale(
  updatedAt: string | Date,
  dataSource?: string | null
): boolean {
  const threshold = getStalenessThreshold(dataSource);
  const updatedTime = new Date(updatedAt).getTime();
  const hoursSinceUpdate = (Date.now() - updatedTime) / (1000 * 60 * 60);

  return hoursSinceUpdate > threshold;
}

/**
 * Get detailed staleness information for logging/debugging
 *
 * @param updatedAt - Timestamp when the forecast was last updated
 * @param dataSource - The forecast data source
 * @returns Object with staleness details including hours, threshold, and reason
 */
export function getStalenessDetails(
  updatedAt: string | Date,
  dataSource?: string | null
): {
  hoursSinceUpdate: number;
  threshold: number;
  isStale: boolean;
  reason: string;
} {
  const threshold = getStalenessThreshold(dataSource);
  const updatedTime = new Date(updatedAt).getTime();
  const hoursSinceUpdate = (Date.now() - updatedTime) / (1000 * 60 * 60);
  const isStale = hoursSinceUpdate > threshold;

  return {
    hoursSinceUpdate,
    threshold,
    isStale,
    reason: isStale
      ? 'Exceeded source-specific threshold'
      : 'Within freshness window'
  };
}

/**
 * Fetch forecast from cache with staleness awareness
 *
 * CACHE-ONLY: Never calls external APIs or generates fresh forecasts.
 * Never returns stale forecast rows. If cached data is stale, returns an empty
 * forecast array with staleness metadata so callers can fail/degrade safely.
 *
 * This is the single source of truth for cache-backed forecast access.
 * Background jobs (cron, manual updateAllBeachForecasts) are responsible
 * for keeping enhanced_forecasts table fresh.
 *
 * @param beachId - Beach ID
 * @param windowHours - Forecast window in hours (default 48)
 * @returns Object with forecasts array and metadata
 */
export async function getFreshForecastFromCache(
  beachId: string,
  windowHours: number = 48
): Promise<{
  forecasts: EnhancedForecastEntity[];
  metadata: {
    cached: boolean;
    stale: boolean;
    missing: boolean;
    reason: string | null;
    stalenessDetails?: ReturnType<typeof getStalenessDetails>;
  };
}> {
  const startTime = Date.now();

  try {
    /**
     * IMPORTANT:
     * `fetchBeachForecasts()` returns rows ordered by forecast_date/forecast_time ASC,
     * which is not a reliable proxy for the *latest write* time. Using `forecasts[0]`
     * here can incorrectly flag fresh beaches as stale (it’s often the oldest row).
     *
     * Instead, use `v_enhanced_forecast_latest` (1 row/beach) as the source of truth
     * for staleness checks.
     */
    const supabase = await createSupabaseServiceRoleClient();
    const latestResult = await supabase
      .from("v_enhanced_forecast_latest")
      .select("updated_at, data_source")
      .eq("beach_id", beachId)
      .maybeSingle();

    if (latestResult.error) {
      throw new Error(latestResult.error.message);
    }

    if (!latestResult.data || !(latestResult.data as any).updated_at) {
      console.warn(`⚠️ [getFreshForecastFromCache] No cached data for beach ${beachId}`);
      return {
        forecasts: [],
        metadata: {
          cached: false,
          stale: false,
          missing: true,
          reason: "No forecast data in cache - waiting for background job",
        },
      };
    }

    const latest = latestResult.data as { updated_at: string; data_source: string | null };
    const dataSource = latest.data_source || "FALLBACK";
    const stalenessDetails = getStalenessDetails(latest.updated_at, dataSource);

    const duration = Date.now() - startTime;

    if (stalenessDetails.isStale) {
      console.warn(
        `⚠️ [getFreshForecastFromCache] Cached data for beach ${beachId} is STALE (${stalenessDetails.hoursSinceUpdate.toFixed(1)}h old, threshold: ${stalenessDetails.threshold}h) - NOT returning stale rows (${duration}ms)`
      );
      return {
        forecasts: [],
        metadata: {
          cached: true,
          stale: true,
          missing: false,
          reason: `Data is ${stalenessDetails.hoursSinceUpdate.toFixed(1)}h old (threshold: ${stalenessDetails.threshold}h) - refusing to serve stale cache (waiting for background refresh)`,
          stalenessDetails,
        },
      };
    }

    // Fresh: now load the actual cached forecast rows for the requested window.
    const daysToFetch = Math.ceil(windowHours / 24);
    const result = await fetchBeachForecasts(beachId, daysToFetch);

    if (!result.forecasts || result.forecasts.length === 0) {
      console.warn(`⚠️ [getFreshForecastFromCache] Latest metadata exists but no forecast rows returned for beach ${beachId}`);
      return {
        forecasts: [],
        metadata: {
          cached: false,
          stale: false,
          missing: true,
          reason: "No forecast rows returned - waiting for background job",
        },
      };
    }

    console.log(
      `✅ [getFreshForecastFromCache] Fresh cached data for beach ${beachId} (${stalenessDetails.hoursSinceUpdate.toFixed(1)}h old, threshold: ${stalenessDetails.threshold}h, ${result.forecasts.length} forecasts, ${duration}ms)`
    );

    return {
      forecasts: result.forecasts,
      metadata: {
        cached: true,
        stale: false,
        missing: false,
        reason: null,
        stalenessDetails,
      },
    };
  } catch (error) {
    console.error(`❌ [getFreshForecastFromCache] Error fetching cache for beach ${beachId}:`, error);
    return {
      forecasts: [],
      metadata: {
        cached: false,
        stale: false,
        missing: true,
        reason: `Database error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      },
    };
  }
}

/**
 * Result type for batch forecast cache operations
 */
export interface BatchForecastCacheResult {
  beachId: string;
  forecasts: EnhancedForecastEntity[];
  metadata: {
    cached: boolean;
    stale: boolean;
    missing: boolean;
    reason: string | null;
    stalenessDetails?: ReturnType<typeof getStalenessDetails>;
  };
}

/**
 * Batch fetch forecasts from cache for multiple beaches
 *
 * PERFORMANCE OPTIMIZATION: Reduces N+1 query pattern from 2N queries to just 2 queries total.
 * For 20 beaches, this reduces from 40 queries (~1000ms) to 2 queries (~150ms).
 *
 * CACHE-ONLY: Never calls external APIs or generates fresh forecasts.
 * Never returns stale forecast rows. Beaches with stale/missing data are excluded.
 *
 * @param beachIds - Array of beach IDs to fetch forecasts for
 * @param windowHours - Forecast window in hours (default 48)
 * @returns Map of beach ID to forecast result with metadata
 */
export async function getBatchFreshForecastsFromCache(
  beachIds: string[],
  windowHours: number = 48
): Promise<Map<string, BatchForecastCacheResult>> {
  const startTime = Date.now();
  const results = new Map<string, BatchForecastCacheResult>();

  if (beachIds.length === 0) {
    return results;
  }

  try {
    const supabase = await createSupabaseServiceRoleClient();

    // Query 1: Get staleness metadata for all beaches in one query
    const { data: latestData, error: latestError } = await supabase
      .from("v_enhanced_forecast_latest")
      .select("beach_id, updated_at, data_source")
      .in("beach_id", beachIds);

    if (latestError) {
      console.error("❌ [getBatchFreshForecastsFromCache] Error fetching latest metadata:", latestError);
      // Return empty results for all beaches
      for (const beachId of beachIds) {
        results.set(beachId, {
          beachId,
          forecasts: [],
          metadata: {
            cached: false,
            stale: false,
            missing: true,
            reason: `Database error: ${latestError.message}`,
          },
        });
      }
      return results;
    }

    // Build lookup map for latest metadata
    const latestMap = new Map<string, { updated_at: string; data_source: string | null }>();
    for (const row of latestData || []) {
      latestMap.set(row.beach_id, {
        updated_at: row.updated_at,
        data_source: row.data_source,
      });
    }

    // Identify fresh vs stale/missing beaches
    const freshBeachIds: string[] = [];
    const stalenessMap = new Map<string, ReturnType<typeof getStalenessDetails>>();

    for (const beachId of beachIds) {
      const latest = latestMap.get(beachId);

      if (!latest || !latest.updated_at) {
        // Missing data
        results.set(beachId, {
          beachId,
          forecasts: [],
          metadata: {
            cached: false,
            stale: false,
            missing: true,
            reason: "No forecast data in cache - waiting for background job",
          },
        });
        continue;
      }

      const dataSource = latest.data_source || "FALLBACK";
      const stalenessDetails = getStalenessDetails(latest.updated_at, dataSource);
      stalenessMap.set(beachId, stalenessDetails);

      if (stalenessDetails.isStale) {
        // Stale data - don't serve
        results.set(beachId, {
          beachId,
          forecasts: [],
          metadata: {
            cached: true,
            stale: true,
            missing: false,
            reason: `Data is ${stalenessDetails.hoursSinceUpdate.toFixed(1)}h old (threshold: ${stalenessDetails.threshold}h) - refusing to serve stale cache`,
            stalenessDetails,
          },
        });
      } else {
        // Fresh - include in batch query
        freshBeachIds.push(beachId);
      }
    }

    // If no fresh beaches, return early
    if (freshBeachIds.length === 0) {
      const duration = Date.now() - startTime;
      console.log(`📊 [getBatchFreshForecastsFromCache] Complete in ${duration}ms: 0 fresh out of ${beachIds.length} beaches`);
      return results;
    }

    // Query 2: Fetch all forecast rows for fresh beaches in one query
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const daysToFetch = Math.ceil(windowHours / 24);
    const futureDate = new Date(Date.now() + daysToFetch * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    // Chunk beaches to avoid Supabase PostgREST 1000-row default limit.
    // 10 beaches/chunk × ~64 rows/beach = ~640 rows, safely under 1000.
    const CHUNK_SIZE = 10;
    const chunks = chunkArray(freshBeachIds, CHUNK_SIZE);

    const chunkResults = await Promise.all(
      chunks.map((chunk) =>
        supabase
          .from("enhanced_forecasts")
          .select("*")
          .in("beach_id", chunk)
          .gte("forecast_date", yesterday)
          .lte("forecast_date", futureDate)
          .order("beach_id")
          .order("forecast_date", { ascending: true })
          .order("forecast_time", { ascending: true })
      )
    );

    // Merge results and check for errors / truncation
    let forecasts: EnhancedForecastEntity[] = [];
    let forecastError: any = null;
    for (const result of chunkResults) {
      if (result.error) {
        forecastError = result.error;
        break;
      }
      if (result.data) {
        if (result.data.length === 1000) {
          console.warn(
            "⚠️ [getBatchFreshForecastsFromCache] Chunk returned exactly 1000 rows — possible PostgREST truncation"
          );
        }
        forecasts = forecasts.concat(result.data as EnhancedForecastEntity[]);
      }
    }

    if (forecastError) {
      console.error("❌ [getBatchFreshForecastsFromCache] Error fetching forecasts:", forecastError);
      // Mark all fresh beaches as missing due to error
      for (const beachId of freshBeachIds) {
        results.set(beachId, {
          beachId,
          forecasts: [],
          metadata: {
            cached: false,
            stale: false,
            missing: true,
            reason: `Database error: ${forecastError.message}`,
          },
        });
      }
      return results;
    }

    // Group forecasts by beach_id
    const forecastsByBeach = new Map<string, EnhancedForecastEntity[]>();
    for (const forecast of forecasts || []) {
      const beachId = forecast.beach_id;
      if (!forecastsByBeach.has(beachId)) {
        forecastsByBeach.set(beachId, []);
      }
      forecastsByBeach.get(beachId)!.push(forecast as EnhancedForecastEntity);
    }

    // Build results for fresh beaches
    for (const beachId of freshBeachIds) {
      const beachForecasts = forecastsByBeach.get(beachId) || [];
      const stalenessDetails = stalenessMap.get(beachId);

      if (beachForecasts.length === 0) {
        results.set(beachId, {
          beachId,
          forecasts: [],
          metadata: {
            cached: false,
            stale: false,
            missing: true,
            reason: "No forecast rows returned - waiting for background job",
          },
        });
      } else {
        results.set(beachId, {
          beachId,
          forecasts: beachForecasts,
          metadata: {
            cached: true,
            stale: false,
            missing: false,
            reason: null,
            stalenessDetails,
          },
        });
      }
    }

    const duration = Date.now() - startTime;
    const freshCount = Array.from(results.values()).filter(r => r.forecasts.length > 0).length;
    const staleCount = Array.from(results.values()).filter(r => r.metadata.stale).length;
    const missingCount = Array.from(results.values()).filter(r => r.metadata.missing).length;

    console.log(
      `✅ [getBatchFreshForecastsFromCache] Complete in ${duration}ms: ${freshCount} fresh, ${staleCount} stale, ${missingCount} missing out of ${beachIds.length} beaches (${chunks.length + 1} queries)`
    );

    return results;
  } catch (error) {
    console.error("❌ [getBatchFreshForecastsFromCache] Unexpected error:", error);
    // Return empty results for all beaches
    for (const beachId of beachIds) {
      results.set(beachId, {
        beachId,
        forecasts: [],
        metadata: {
          cached: false,
          stale: false,
          missing: true,
          reason: `Unexpected error: ${error instanceof Error ? error.message : "Unknown error"}`,
        },
      });
    }
    return results;
  }
}

/**
 * Update forecasts for a specific beach
 */
export async function updateBeachForecast(beachId: string) {
  const supabase = await createSupabaseServiceRoleClient();

  // Get the beach details
  const { data: beach, error: beachError } = await supabase
    .from("beaches")
    .select("*")
    .eq("id", beachId)
    .single();

  if (beachError || !beach) {
    throw new Error("Beach not found");
  }

  const service = getEnhancedForecastService();

  // Generate comprehensive forecast
  const forecasts = await service.generateComprehensiveForecast(beach);

  // Store enhanced forecasts
  const result = await service.storeEnhancedForecasts(beach, forecasts);

  if (!result.success) {
    throw new Error(result.error);
  }

  return {
    beach: beach.name,
    forecastsGenerated: forecasts.length,
    message: "Enhanced forecasts updated successfully",
  };
}

/**
 * Update forecasts for all beaches
 */
export async function updateAllBeachForecasts() {
  const service = getEnhancedForecastService();
  const result = await service.updateAllEnhancedForecasts();

  if (!result.success) {
    throw new Error(result.error);
  }

  return result;
}

/**
 * Fetch enhanced forecasts for a beach with standardized error handling
 */
export async function fetchBeachForecasts(beachId: string, days = 12) {
  const supabase = await createSupabaseServiceRoleClient();

  // Include yesterday's data for tide chart lookback window (6 hours ago)
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  
  const { data: forecasts, error } = await supabase
    .from("enhanced_forecasts")
    .select("*")
    .eq("beach_id", beachId)
    .gte("forecast_date", yesterday)
    .lte(
      "forecast_date",
      new Date(Date.now() + days * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0]
    )
    .order("forecast_date", { ascending: true })
    .order("forecast_time", { ascending: true });

  if (error) {
    throw new Error("Failed to fetch enhanced forecasts");
  }

  // Group forecasts by date
  const forecastsByDate = forecasts.reduce((acc: any, forecast: any) => {
    const date = forecast.forecast_date;
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(forecast);
    return acc;
  }, {});

  return {
    forecasts,
    forecastsByDate,
    totalForecasts: forecasts.length,
  };
}
