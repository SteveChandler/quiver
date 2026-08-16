/**
 * Forecast Storage Service
 * 
 * Handles all database operations for forecast data:
 * - Saving enhanced forecasts to database
 * - Fetching forecast data
 * - Staleness detection
 * - Schema compatibility handling
 * - Batch processing and deduplication
 * 
 * Extracted from lib/services/enhanced-forecast-service.ts as part of P1 refactoring
 * to reduce file size and improve maintainability.
 */

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Beach } from "@/types/database";
import type { EnhancedForecastEntity } from "@/types/forecast";
import { StorageError } from "@/lib/errors/forecast-errors";
// NOTE: the legacy ML-correction merge path was removed alongside the
// OM-primary scalar override (migration
// 20260424182324_remove_om_primary_override_from_bulk.sql). Display height
// comes from the per-component face-Hs transformer at write time. Seaside
// still writes to corrected_forecasts; that table is read by the ML
// pipeline only, not by this service.

/**
 * Configuration for storage operations
 */
interface StorageConfig {
  /** Chunk size for batch upserts (default: 100) */
  chunkSize?: number;
  /** Enable verbose logging */
  verboseLogging?: boolean;
  /** Maximum retry attempts for schema mismatches (default: 5) */
  maxRetries?: number;
}

/**
 * Result of store operation
 */
export interface StoreResult {
  success: boolean;
  data?: any;
  error?: string;
}

/**
 * Forecast Storage Service
 * 
 * Manages persistence of enhanced forecast data with intelligent
 * error handling and schema compatibility.
 */
export class ForecastStorageService {
  private readonly warnedSchemaColumns = new Set<string>();
  private readonly config: Required<StorageConfig>;

  /** Track last cleanup time per beach to throttle cleanup operations */
  private static lastCleanupTime: Map<string, number> = new Map();
  /** Cleanup interval in milliseconds (1 hour) */
  private static readonly CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

  constructor(config: StorageConfig = {}) {
    this.config = {
      chunkSize: config.chunkSize ?? 100,
      verboseLogging: config.verboseLogging ?? this.isVerboseLoggingEnabled(),
      // Bumped from 5 to 16 so schema-strip retries can accommodate the
      // 8 newly added Open-Meteo columns (wave_height_om, wave_period_om,
      // wave_direction_om, swell_height_om, swell_period_om,
      // swell_direction_om, wind_wave_height_om, om_fetched_at) pre-migration.
      // After the migration is applied this budget is never spent.
      maxRetries: config.maxRetries ?? 16,
    };
  }

  private isVerboseLoggingEnabled(): boolean {
    const env = process.env.VERCEL_ENV || process.env.NODE_ENV;
    return process.env.FORECAST_VERBOSE_LOGS === "true" || env !== "production";
  }

  /**
   * Store enhanced forecasts in database with deduplication and chunking
   * 
   * Features:
   * - Automatic deduplication by (beach_id, forecast_at), with fallback to (beach_id, forecast_date, forecast_time)
   * - Batch processing to avoid payload limits
   * - Schema compatibility handling (strips unknown columns)
   * - Retry logic for transient errors
   * 
   * @param beach - Beach entity
   * @param forecasts - Array of enhanced forecast entities
   * @returns Store result with success status
   * 
   * @example
   * ```typescript
   * const storage = new ForecastStorageService();
   * const result = await storage.storeEnhancedForecasts(beach, forecasts);
   * if (!result.success) {
   *   console.error('Storage failed:', result.error);
   * }
   * ```
   */
  async storeEnhancedForecasts(
    beach: Beach,
    forecasts: EnhancedForecastEntity[]
  ): Promise<StoreResult> {
    const supabase = await createSupabaseServiceRoleClient();

    try {
      // Deduplicate forecasts by unique key (beach_id, forecast_at) with legacy fallback
      const uniqueForecasts = this.deduplicateForecasts(forecasts);

      if (this.config.verboseLogging) {
        console.log(
          `📊 Deduplicated ${forecasts.length} forecasts to ${uniqueForecasts.size} unique entries`
        );
      }

      // Prepare rows for database (remove id, add updated_at)
      const toRows = Array.from(uniqueForecasts.values()).map((forecast) => {
        const { id, ...forecastWithoutId } = forecast;
        return { ...forecastWithoutId, updated_at: new Date().toISOString() };
      });

      // Upsert in chunks to avoid exceeding PostgREST payload limits
      let lastData: any = null;
      for (let i = 0; i < toRows.length; i += this.config.chunkSize) {
        let chunk: Array<Record<string, unknown>> = toRows.slice(i, i + this.config.chunkSize);

        // Try upsert with schema compatibility handling
        const result = await this.upsertChunkWithRetry(supabase, chunk);
        if (!result.success) {
          return result;
        }
        lastData = result.data;
      }

      // Clean up old forecast rows (>7 days) to prevent database bloat
      // This also helps prevent the forecasts[0] freshness bug from persisting
      // with very old rows that could have stale updated_at timestamps
      await this.cleanupOldForecasts(supabase, beach.id, 7);

      return { success: true, data: lastData };
    } catch (error) {
      console.error("Error storing enhanced forecasts:", error);
      return {
        success: false,
        error:
          (error as any)?.message ||
          (error as any)?.details ||
          JSON.stringify(error) ||
          "Unknown error",
      };
    }
  }

  /**
   * Deduplicate forecasts by unique key
   * Prevents "ON CONFLICT DO UPDATE command cannot affect row a second time" errors
   */
  private deduplicateForecasts(
    forecasts: EnhancedForecastEntity[]
  ): Map<string, EnhancedForecastEntity> {
    const uniqueForecasts = new Map<string, EnhancedForecastEntity>();
    
    forecasts.forEach((forecast) => {
      const key = forecast.forecast_at
        ? `${forecast.beach_id}|${forecast.forecast_at}`
        : `${forecast.beach_id}|${forecast.forecast_date}|${forecast.forecast_time}`;
      if (!uniqueForecasts.has(key)) {
        uniqueForecasts.set(key, forecast);
      } else {
        if (this.config.verboseLogging) {
          console.log(`⚠️ Skipping duplicate forecast: ${key}`);
        }
      }
    });

    return uniqueForecasts;
  }

  /**
   * Upsert a chunk with schema compatibility retry logic
   * 
   * Handles PGRST204 errors (missing columns) by stripping unknown columns
   * and retrying the operation.
   */
  private async upsertChunkWithRetry(
    supabase: any,
    chunk: Array<Record<string, unknown>>
  ): Promise<StoreResult> {
    let currentChunk = chunk;
    let lastError: any = null;

    // Allow a few "schema strip" retries in case multiple columns are missing
    for (let attempt = 0; attempt < this.config.maxRetries; attempt += 1) {
      const { data, error } = await supabase
        .from("enhanced_forecasts")
        .upsert(currentChunk, {
          onConflict: "beach_id,forecast_at",
        });

      if (!error) {
        return { success: true, data };
      }

      lastError = error;

      const missingColumn = this.extractMissingColumnName(error);
      const canAttemptStrip = error?.code === "PGRST204" && !!missingColumn;

      if (!canAttemptStrip) {
        console.error("Enhanced forecast upsert error:", {
          message: (error as any).message,
          details: (error as any).details,
          hint: (error as any).hint,
          code: (error as any).code,
        });
        return { success: false, error: error.message };
      }

      if (missingColumn && !this.warnedSchemaColumns.has(missingColumn)) {
        console.warn(
          `⚠️ Enhanced forecast schema mismatch (missing column '${missingColumn}'). Retrying without that column.`
        );
        this.warnedSchemaColumns.add(missingColumn);
      }

      const { rows: strippedRows, didStrip } = this.stripColumnFromRows(
        currentChunk,
        missingColumn
      );

      // If stripping didn't change anything, retrying would loop forever
      if (!didStrip) {
        console.error("Enhanced forecast upsert error:", {
          message: (error as any).message,
          details: (error as any).details,
          hint: (error as any).hint,
          code: (error as any).code,
        });
        return { success: false, error: error.message };
      }

      currentChunk = strippedRows;
    }

    // If we exhausted retries
    console.error("Enhanced forecast upsert error after retries:", {
      message: (lastError as any).message,
      details: (lastError as any).details,
      hint: (lastError as any).hint,
      code: (lastError as any).code,
    });
    return { success: false, error: lastError?.message || "Unknown error after retries" };
  }

  /**
   * Extract missing column name from Supabase error
   */
  private extractMissingColumnName(err: any): string | null {
    const msg = typeof err?.message === "string" ? err.message : "";
    const match = msg.match(/Could not find the '([^']+)' column/);
    return match?.[1] ?? null;
  }

  /**
   * Strip a column from all rows in an array
   */
  private stripColumnFromRows(
    rows: Array<Record<string, unknown>>,
    columnName: string
  ): { rows: Array<Record<string, unknown>>; didStrip: boolean } {
    let didStrip = false;
    const nextRows = rows.map((row) => {
      if (!Object.prototype.hasOwnProperty.call(row, columnName)) {
        return row;
      }
      didStrip = true;
      const copy: Record<string, unknown> = { ...row };
      delete copy[columnName];
      return copy;
    });
    return { rows: nextRows, didStrip };
  }

  /**
   * Clean up old forecast rows for a beach
   *
   * Deletes forecast rows older than the retention period to prevent
   * database bloat and ensure freshness indicators use recent data.
   *
   * Throttled: Only runs once per hour per beach to avoid write amplification.
   *
   * @param supabase - Supabase client
   * @param beachId - Beach ID to clean up
   * @param retentionDays - Days to retain (default: 7)
   */
  private async cleanupOldForecasts(
    supabase: SupabaseClient,
    beachId: string,
    retentionDays: number = 7
  ): Promise<void> {
    // Throttle: Skip if cleanup ran recently for this beach
    const lastCleanup = ForecastStorageService.lastCleanupTime.get(beachId) || 0;
    if (Date.now() - lastCleanup < ForecastStorageService.CLEANUP_INTERVAL_MS) {
      return; // Skip cleanup, ran recently
    }

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
      const cutoffDateStr = cutoffDate.toISOString().split("T")[0];

      const { error, count } = await supabase
        .from("enhanced_forecasts")
        .delete({ count: "exact" })
        .eq("beach_id", beachId)
        .lt("forecast_at", cutoffDate.toISOString());

      if (error) {
        // Log but don't fail the main operation
        console.warn(`⚠️ Failed to cleanup old forecasts for beach ${beachId}:`, error.message);
      } else {
        // Mark cleanup as done regardless of whether rows were deleted
        ForecastStorageService.lastCleanupTime.set(beachId, Date.now());
        if (count && count > 0 && this.config.verboseLogging) {
          console.log(`🗑️ Cleaned up ${count} old forecast rows for beach ${beachId} (older than ${retentionDays} days)`);
        }
      }
    } catch (error) {
      // Log but don't fail the main operation
      console.warn(`⚠️ Error during forecast cleanup for beach ${beachId}:`, error);
    }
  }

  /**
   * Fetch beaches that need forecast updates
   *
   * Returns beaches with stale or missing forecast data based on
   * the provided freshness window.
   *
   * @param freshnessWindowHours - Hours threshold for staleness
   * @param maxBeaches - Maximum beaches to return
   * @returns Array of beaches needing updates
   */
  async fetchStaleBeaches(
    freshnessWindowHours: number = 12,
    maxBeaches: number = 45
  ): Promise<Beach[]> {
    const supabase = await createSupabaseServiceRoleClient();
    
    try {
      const staleThresholdMs = Date.now() - freshnessWindowHours * 60 * 60 * 1000;

      // Get all beaches
      const { data: allBeaches, error: beachError } = await supabase
        .from("beaches")
        .select("*");

      if (beachError) {
        throw beachError;
      }

      if (!allBeaches || allBeaches.length === 0) {
        console.log("📭 No beaches found to update");
        return [];
      }

      // Get latest forecast timestamp per beach
      const todayUtc = new Date().toISOString().split("T")[0];
      const { data: latestRows, error: latestError } = await supabase
        .from("enhanced_forecasts")
        .select("beach_id, updated_at")
        .gte("forecast_at", `${todayUtc}T00:00:00Z`)
        .order("updated_at", { ascending: false });

      if (latestError) {
        throw latestError;
      }

      // Build map of beach_id → latest updated_at
      const latestMap = new Map<string, Date>();
      if (latestRows && latestRows.length > 0) {
        latestRows.forEach((row) => {
          const beachId = row.beach_id as string;
          const updatedAt = new Date(row.updated_at);
          if (!latestMap.has(beachId) || updatedAt > latestMap.get(beachId)!) {
            latestMap.set(beachId, updatedAt);
          }
        });
      }

      // Filter beaches to those with stale or missing data
      const staleBeaches = allBeaches.filter((beach) => {
        const latest = latestMap.get(beach.id);
        if (!latest) return true; // No data, needs update
        return latest.getTime() < staleThresholdMs; // Stale data
      });

      // Limit to max beaches
      return staleBeaches.slice(0, maxBeaches);
    } catch (error) {
      console.error("Error fetching stale beaches:", error);
      throw new StorageError(
        "FETCH_STALE_BEACHES",
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

}

