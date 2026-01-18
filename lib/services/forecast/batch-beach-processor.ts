/**
 * Batch Beach Processor
 *
 * Shared utilities for batch processing of beach forecast updates.
 * Extracted from EnhancedForecastService to reduce duplication between
 * updateAllEnhancedForecasts and updateCdipEnhancedForecasts.
 */

import type { Beach } from "@/types/database";

/**
 * Result of processing a single beach
 */
export interface BeachProcessResult {
  beach: string;
  success: boolean;
  error?: string;
}

/**
 * Summary of a batch processing run
 */
export interface BatchProcessSummary {
  total: number;
  attempted: number;
  successful: number;
  failed: number;
  duration: string;
  stoppedEarly: boolean;
  stopReason?: string;
  remainingMs?: number;
}

/**
 * Result of a complete batch processing run
 */
export interface BatchProcessResult {
  success: boolean;
  results: BeachProcessResult[];
  summary?: BatchProcessSummary;
  error?: string;
}

/**
 * Configuration for batch processing
 */
export interface BatchProcessConfig {
  batchSize: number;
  batchDelayMs: number;
  maxBeachesPerRun: number;
  freshnessWindowHours: number;
}

/**
 * Load batch processing configuration from environment variables
 */
export function loadBatchConfig(overrides?: Partial<BatchProcessConfig>): BatchProcessConfig {
  return {
    batchSize: Number(process.env.FORECAST_BATCH_SIZE ?? 3),
    batchDelayMs: Number(process.env.FORECAST_BATCH_DELAY_MS ?? 1000),
    maxBeachesPerRun: Number(process.env.FORECAST_MAX_BEACHES_PER_RUN ?? 45),
    freshnessWindowHours: Number(process.env.FORECAST_FRESHNESS_WINDOW_HOURS ?? 12),
    ...overrides,
  };
}

/**
 * Load CDIP-specific batch processing configuration
 */
export function loadCdipBatchConfig(): BatchProcessConfig {
  return {
    batchSize: Number(process.env.FORECAST_BATCH_SIZE ?? 3),
    batchDelayMs: Number(process.env.FORECAST_BATCH_DELAY_MS ?? 1000),
    maxBeachesPerRun: Number(
      process.env.FORECAST_CDIP_MAX_BEACHES_PER_RUN ??
        process.env.FORECAST_MAX_BEACHES_PER_RUN ??
        25
    ),
    freshnessWindowHours: Number(process.env.FORECAST_CDIP_FRESHNESS_WINDOW_HOURS ?? 2),
  };
}

/**
 * Utility class for tracking deadline-aware execution
 */
export class DeadlineTracker {
  private readonly deadlineMs?: number;
  private readonly hasDeadline: boolean;

  constructor(deadlineMs?: number) {
    this.deadlineMs = deadlineMs;
    this.hasDeadline = typeof deadlineMs === "number" && Number.isFinite(deadlineMs);
  }

  /**
   * Get remaining time in milliseconds
   */
  msRemaining(): number {
    return this.hasDeadline
      ? (this.deadlineMs as number) - Date.now()
      : Number.POSITIVE_INFINITY;
  }

  /**
   * Check if we should stop processing
   */
  shouldStop(): boolean {
    return this.hasDeadline && this.msRemaining() <= 0;
  }

  /**
   * Check if there's enough time for another batch delay
   */
  hasTimeForDelay(delayMs: number): boolean {
    return !this.hasDeadline || this.msRemaining() > delayMs;
  }

  /**
   * Whether a deadline is configured
   */
  isDeadlineConfigured(): boolean {
    return this.hasDeadline;
  }
}

/**
 * Options for processing beaches in batches
 */
export interface ProcessBeachesOptions {
  beaches: Beach[];
  config: BatchProcessConfig;
  deadlineTracker: DeadlineTracker;
  processBeach: (beach: Beach) => Promise<BeachProcessResult>;
  prefetchCallback?: (beaches: Beach[]) => Promise<void>;
  logPrefix?: string;
}

/**
 * Process beaches in batches with deadline awareness
 *
 * This is the core batch processing loop extracted from the service methods.
 * It handles:
 * - Splitting beaches into batches
 * - Processing with deadline checks
 * - Result collection and counting
 * - Progress logging
 * - Delay management between batches
 */
export async function processBeachesInBatches(
  options: ProcessBeachesOptions
): Promise<BatchProcessResult> {
  const {
    beaches,
    config,
    deadlineTracker,
    processBeach,
    prefetchCallback,
    logPrefix = "",
  } = options;

  const startTime = Date.now();

  // Check if we should stop before starting
  if (deadlineTracker.shouldStop()) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.warn(`${logPrefix}Time budget exhausted before processing started; stopping early`, {
      selected: beaches.length,
      attempted: 0,
      remainingMs: deadlineTracker.msRemaining(),
    });
    return {
      success: true,
      results: [],
      summary: {
        total: beaches.length,
        attempted: 0,
        successful: 0,
        failed: 0,
        duration: `${duration}s`,
        stoppedEarly: true,
        stopReason: "time_budget",
        remainingMs: deadlineTracker.msRemaining(),
      },
    };
  }

  // Run prefetch callback if provided (e.g., tide station prefetch)
  if (prefetchCallback) {
    await prefetchCallback(beaches);
  }

  // Split beaches into batches
  const batches: Beach[][] = [];
  for (let i = 0; i < beaches.length; i += config.batchSize) {
    batches.push(beaches.slice(i, i + config.batchSize));
  }

  const allResults: BeachProcessResult[] = [];
  let successCount = 0;
  let failCount = 0;

  // Process each batch sequentially
  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    if (deadlineTracker.shouldStop()) {
      console.warn(`${logPrefix}Stopping early due to time budget (before starting next batch)`, {
        batchIndex,
        totalBatches: batches.length,
        attempted: allResults.length,
        successful: successCount,
        failed: failCount,
        remainingMs: deadlineTracker.msRemaining(),
      });
      break;
    }

    const batch = batches[batchIndex];
    const batchNum = batchIndex + 1;
    const totalBatches = batches.length;

    console.log(`${logPrefix}Processing batch ${batchNum}/${totalBatches} (${batch.length} beaches)`);

    // Process beaches within batch in parallel
    const batchResults = await Promise.allSettled(batch.map(processBeach));

    // Collect results
    for (const result of batchResults) {
      if (result.status === "fulfilled") {
        allResults.push(result.value);
        if (result.value.success) {
          successCount++;
        } else {
          failCount++;
        }
      } else {
        allResults.push({
          beach: "unknown",
          success: false,
          error: "Promise rejected",
        });
        failCount++;
      }
    }

    console.log(
      `${logPrefix}Batch ${batchNum} complete: ${successCount} success, ${failCount} failed so far`
    );

    // Add delay between batches (except after last batch)
    if (batchIndex < batches.length - 1) {
      if (!deadlineTracker.hasTimeForDelay(config.batchDelayMs)) {
        console.warn(`${logPrefix}Skipping batch delay and stopping early due to time budget`, {
          batchIndex,
          attempted: allResults.length,
          remainingMs: deadlineTracker.msRemaining(),
        });
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, config.batchDelayMs));
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  const attempted = allResults.length;
  const stoppedEarly = attempted < beaches.length && deadlineTracker.isDeadlineConfigured();

  return {
    success: true,
    results: allResults,
    summary: {
      total: beaches.length,
      attempted,
      successful: successCount,
      failed: failCount,
      duration: `${duration}s`,
      stoppedEarly,
      stopReason: stoppedEarly ? "time_budget" : undefined,
      remainingMs: deadlineTracker.isDeadlineConfigured()
        ? deadlineTracker.msRemaining()
        : undefined,
    },
  };
}

/**
 * Create a beach processor function for use with processBeachesInBatches
 */
export function createBeachProcessor(
  generateForecast: (beach: Beach) => Promise<any[]>,
  storeForecast: (beach: Beach, forecasts: any[]) => Promise<{ success: boolean; error?: string }>
): (beach: Beach) => Promise<BeachProcessResult> {
  return async (beach: Beach): Promise<BeachProcessResult> => {
    try {
      const forecasts = await generateForecast(beach);
      const result = await storeForecast(beach, forecasts);
      if (result.success) {
        console.log(`${beach.name}: ${forecasts.length} forecasts stored`);
      } else {
        console.warn(`${beach.name}: store failed - ${result.error}`);
      }
      return {
        beach: beach.name,
        success: result.success,
        error: result.error,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`${beach.name}: ${errorMsg}`);
      return { beach: beach.name, success: false, error: errorMsg };
    }
  };
}
