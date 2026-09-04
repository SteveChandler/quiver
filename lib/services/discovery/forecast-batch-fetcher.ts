/**
 * Forecast Batch Fetcher
 *
 * Batch fetches forecasts from cache for multiple beaches with staleness tracking.
 * Uses optimized 2-query batch fetching (instead of 2N queries) via getBatchFreshForecastsFromCache.
 *
 * @module lib/services/discovery/forecast-batch-fetcher
 */

import { createContextLogger } from '@/lib/logger';
import type { Beach } from '@/types/database';
import type { EnhancedForecastEntity } from '@/types/forecast';

const log = createContextLogger('ForecastBatchFetcher');

/**
 * Default forecast window in hours
 */
export const DEFAULT_FORECAST_WINDOW_HOURS = 48;

/**
 * Options for batch forecast fetching
 */
export interface ForecastBatchOptions {
  /** Maximum concurrent requests (unused - batch fetch is single operation) */
  maxConcurrent?: number;
  /** Timeout per request in ms (unused - batch fetch handles internally) */
  timeout?: number;
  /** Overall timeout in ms (unused - batch fetch handles internally) */
  overallTimeout?: number;
  /** Forecast window in hours (default 48) */
  forecastWindowHours?: number;
  /** When true, return stale forecast rows instead of excluding them (default false) */
  allowStale?: boolean;
  /** Enforce source-aware freshness for every returned forecast row. */
  requirePerRowFreshness?: boolean;
}

/**
 * Result of batch forecast fetching
 */
export interface ForecastBatchResult {
  /** Beaches with successful fresh forecasts */
  successful: Array<{ beach: Beach; forecasts: EnhancedForecastEntity[] }>;
  /** Beaches that failed to get forecasts (with reason and stale flag) */
  failed: Array<{ beach: Beach; reason: string; stale: boolean }>;
  /** Count of stale forecasts (subset of failed) */
  staleCount: number;
}

/**
 * Batch fetch forecasts from cache with staleness tracking
 *
 * Uses the optimized getBatchFreshForecastsFromCache which executes only 2 queries
 * for any number of beaches (instead of 2N queries for individual fetches).
 *
 * Results are categorized as:
 * - successful: Fresh forecasts with valid data
 * - failed (stale=true): Data exists but is stale
 * - failed (stale=false): Missing data or errors
 *
 * @param beaches - Array of beaches to fetch forecasts for
 * @param options - Optional configuration (forecastWindowHours)
 * @returns Categorized results with successful, failed, and stale count
 *
 * @example
 * ```typescript
 * const beaches = [beach1, beach2, beach3];
 * const result = await batchFetchForecasts(beaches);
 *
 * console.log(`${result.successful.length} beaches with fresh forecasts`);
 * console.log(`${result.staleCount} beaches with stale data`);
 * console.log(`${result.failed.length - result.staleCount} beaches missing data`);
 * ```
 */
export async function batchFetchForecasts(
  beaches: Beach[],
  options?: ForecastBatchOptions
): Promise<ForecastBatchResult> {
  const startTime = Date.now();
  const forecastWindowHours = options?.forecastWindowHours ?? DEFAULT_FORECAST_WINDOW_HOURS;

  log.debug(
    `[batchFetchForecasts] Fetching forecasts for ${beaches.length} beaches from cache (batched)`
  );

  // Dynamic import to avoid circular dependencies
  const { getBatchFreshForecastsFromCache } = await import('@/lib/utils/forecast-service-utils');

  // Create beach ID to Beach lookup map
  const beachMap = new Map<string, Beach>();
  for (const beach of beaches) {
    beachMap.set(beach.id, beach);
  }

  // Fetch all forecasts in 2 queries instead of 2N queries
  const batchResults = options?.requirePerRowFreshness
    ? await getBatchFreshForecastsFromCache(
      beaches.map((b) => b.id),
      forecastWindowHours,
      options?.allowStale ?? false,
      true,
    )
    : await getBatchFreshForecastsFromCache(
      beaches.map((b) => b.id),
      forecastWindowHours,
      options?.allowStale ?? false,
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
      // When allowStale, stale beaches with data are treated as successful
      if (options?.allowStale && result.forecasts.length > 0) {
        successful.push({
          beach,
          forecasts: result.forecasts,
        });
        continue;
      }
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
  log.debug(`[batchFetchForecasts] Complete in ${duration}ms:`, {
    total: beaches.length,
    successful: successful.length,
    failed: failed.length,
    staleCount,
    staleBeaches: failed
      .filter((f) => f.stale)
      .map((f) => f.beach.name)
      .join(', '),
    failedBeaches: failed.map((f) => `${f.beach.name} (${f.reason})`).join(', '),
  });

  return { successful, failed, staleCount };
}
