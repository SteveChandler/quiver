/**
 * Enhanced Forecast Sync Cron Job API
 * Orchestrates CDIP + NOAA data ingestion for all beaches
 * Now includes comprehensive logging and monitoring
 */

import { NextRequest } from "next/server";
import { EnhancedForecastService } from "@/lib/services/enhanced-forecast-service";
import { CDIPService } from "@/lib/services/cdip-service";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import {
  createSuccessResponse,
  createErrorResponse,
  validateCronRequest,
  ForecastUpdateStats,
} from "@/lib/api-response-utils";
import { CDIPRateLimiter, NOAARateLimiter } from "@/lib/utils/rate-limiter";
import { forecastLogger } from "@/lib/monitoring/forecast-logger";

interface Beach {
  id: string;
  name: string;
  lat: number;
  lon: number;
}

interface CronSyncResult {
  totalBeaches: number;
  successful: number;
  failed: number;
  skipped: number;
  cdipStationsUpdated: string[];
  duration: string;
  successRate: string;
  failures: Array<{
    beachId: string;
    beachName: string;
    error: string;
  }>;
}

/**
 * POST - Main cron job endpoint for enhanced forecast sync
 */
export async function POST(request: NextRequest): Promise<Response> {
  const startTime = Date.now();
  const executionId = crypto.randomUUID();
  
  // Log cron job start
  forecastLogger.cronStart(executionId, {
    triggeredBy: request.headers.get('user-agent'),
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV,
  });

  try {
    // Only allow running in production to avoid accidental dev/preview execution
    const env = process.env.VERCEL_ENV || process.env.NODE_ENV;
    if (env !== "production") {
      forecastLogger.cronFailed(executionId, new Error(`Cron disabled for environment: ${env}`));
      return createErrorResponse(
        "Forbidden",
        `Cron disabled for environment: ${env}`,
        403
      );
    }

    // Validate cron origin (Vercel Cron header or Bearer secret)
    if (!validateCronRequest(request)) {
      forecastLogger.cronFailed(executionId, new Error('Invalid cron authentication'));
      return createErrorResponse(
        "Unauthorized",
        "Invalid cron authentication",
        401
      );
    }

    // Check rate limits before proceeding
    if (!CDIPRateLimiter.canMakeRequest()) {
      const resetTime = CDIPRateLimiter.getTimeUntilReset();
      forecastLogger.rateLimitWarning('CDIP', resetTime, { executionId });
      return createErrorResponse(
        "CDIP API rate limit exceeded",
        { resetInMs: resetTime },
        429
      );
    }

    if (!NOAARateLimiter.canMakeRequest()) {
      const resetTime = NOAARateLimiter.getTimeUntilReset();
      forecastLogger.rateLimitWarning('NOAA', resetTime, { executionId });
      return createErrorResponse(
        "NOAA API rate limit exceeded",
        { resetInMs: resetTime },
        429
      );
    }

    // Initialize services
    const enhancedForecastService = new EnhancedForecastService();
    const cdipService = new CDIPService();
    const supabase = createSupabaseServiceRoleClient();

    // Fetch all beaches from database
    const { data: beaches, error: beachError } = await supabase
      .from("beaches")
      .select("id, name, lat, lon");

    if (beachError) {
      const error = new Error(`Failed to fetch beaches: ${beachError.message}`);
      forecastLogger.cronFailed(executionId, error);
      throw error;
    }

    if (!beaches || beaches.length === 0) {
      forecastLogger.cronComplete(executionId, {
        executionId,
        totalBeaches: 0,
        successful: 0,
        failed: 0,
        duration: Date.now() - startTime,
        successRate: 'N/A',
      });
      
      return createSuccessResponse(
        {
          totalBeaches: 0,
          successful: 0,
          failed: 0,
          skipped: 0,
          cdipStationsUpdated: [],
          duration: `${Date.now() - startTime}ms`,
          successRate: '0%',
          failures: [],
        },
        "No beaches found to sync"
      );
    }

    // Fetch CDIP stations for Southern California beaches first
    const socaBeaches = beaches.filter(
      (beach: Beach) =>
        beach.lat >= 32.0 &&
        beach.lat <= 35.0 &&
        beach.lon >= -120.0 &&
        beach.lon <= -117.0
    );

    const cdipStationsUpdated: string[] = [];
    if (socaBeaches.length > 0) {
      try {
        const stations = cdipService.getSouthernCaliforniaStations();
        await cdipService.fetchMultipleStations(stations);
        cdipStationsUpdated.push(...stations);
        CDIPRateLimiter.recordRequest();
        console.log(`[Cron] Updated ${stations.length} CDIP stations`);
      } catch (error) {
        forecastLogger.apiError('CDIP Station Fetch', 
          error instanceof Error ? error : new Error(String(error)),
          { executionId }
        );
        console.warn("Failed to update CDIP stations:", error);
      }
    }

    // Process each beach with enhanced forecast generation
    const results: CronSyncResult = {
      totalBeaches: beaches.length,
      successful: 0,
      failed: 0,
      skipped: 0,
      cdipStationsUpdated,
      duration: "",
      successRate: "0%",
      failures: [],
    };

    // Process beaches in batches to avoid overwhelming APIs and database
    const BATCH_SIZE = 2;
    const batches = [];
    for (let i = 0; i < beaches.length; i += BATCH_SIZE) {
      batches.push(beaches.slice(i, i + BATCH_SIZE));
    }

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];

      // Add delay between batches to prevent database overload
      if (batchIndex > 0) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }

      // Log batch progress
      forecastLogger.batchProgress(
        batchIndex + 1,
        batches.length,
        BATCH_SIZE,
        results.successful + results.failed,
        { executionId }
      );

      const batchPromises = batch.map(async (beach: Beach) => {
        const beachStartTime = Date.now();
        
        try {
          // Generate comprehensive forecast with CDIP integration
          const forecasts =
            await enhancedForecastService.generateComprehensiveForecast(beach);

          // Store forecasts with raw data
          const storeResult =
            await enhancedForecastService.storeEnhancedForecasts(
              beach,
              forecasts
            );

          if (!storeResult.success) {
            throw new Error(storeResult.error || "Failed to store forecasts");
          }

          const beachDuration = Date.now() - beachStartTime;
          results.successful++;

          // Log forecast generation
          forecastLogger.forecastGenerated(
            beach.id,
            beach.name,
            forecasts.length,
            forecasts[0]?.data_source || 'UNKNOWN',
            beachDuration
          );

          // Record API usage for rate limiting
          NOAARateLimiter.recordRequest();

          return { success: true, beachId: beach.id };
        } catch (error) {
          results.failed++;
          const errorMessage =
            error instanceof Error ? error.message : String(error);

          // Check if it's a database timeout
          if (
            errorMessage.includes("statement timeout") ||
            errorMessage.includes("57014")
          ) {
            console.warn(
              `Database timeout for beach ${beach.name} - this is expected during initial sync`
            );
          } else {
            forecastLogger.apiError(
              `Beach Forecast Update: ${beach.name}`,
              error instanceof Error ? error : new Error(errorMessage),
              { beachId: beach.id, executionId }
            );
          }

          results.failures.push({
            beachId: beach.id,
            beachName: beach.name,
            error: errorMessage,
          });

          return { success: false, beachId: beach.id, error };
        }
      });

      // Wait for batch to complete before processing next batch
      await Promise.allSettled(batchPromises);
    }

    const duration = Date.now() - startTime;
    results.duration = `${duration}ms`;
    results.successRate = `${((results.successful / results.totalBeaches) * 100).toFixed(1)}%`;

    // Log cron completion
    forecastLogger.cronComplete(executionId, {
      executionId,
      duration,
      totalBeaches: results.totalBeaches,
      successful: results.successful,
      failed: results.failed,
      successRate: results.successRate,
      cdipStations: cdipStationsUpdated.length,
    });

    return createSuccessResponse(
      results,
      `Enhanced forecast sync completed: ${results.successful}/${results.totalBeaches} beaches updated`
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const duration = Date.now() - startTime;
    
    forecastLogger.cronFailed(
      executionId,
      error instanceof Error ? error : new Error(errorMessage),
      { duration }
    );
    
    return createErrorResponse(
      "Enhanced forecast sync failed",
      {
        error: errorMessage,
        duration: `${duration}ms`,
        executionId,
      },
      500
    );
  }
}

/**
 * GET - Health check endpoint
 */
export async function GET(request: NextRequest): Promise<Response> {
  try {
    const env = process.env.VERCEL_ENV || process.env.NODE_ENV;
    if (env !== "production") {
      return createErrorResponse(
        "Forbidden",
        `Health check disabled for environment: ${env}`,
        403
      );
    }

    if (!validateCronRequest(request)) {
      return createErrorResponse(
        "Unauthorized",
        "Invalid cron authentication",
        401
      );
    }

    // Check system health
    const cdipRateLimit = CDIPRateLimiter.canMakeRequest();
    const noaaRateLimit = NOAARateLimiter.canMakeRequest();
    const supabase = createSupabaseServiceRoleClient();

    // Quick database connectivity check
    const { error: dbError } = await supabase
      .from("beaches")
      .select("count", { count: "exact", head: true });

    const healthStatus = {
      status: "healthy",
      timestamp: new Date().toISOString(),
      services: {
        database: !dbError,
        cdipRateLimit,
        noaaRateLimit,
      },
      rateLimits: {
        cdip: {
          canMakeRequest: cdipRateLimit,
          resetInMs: CDIPRateLimiter.getTimeUntilReset(),
        },
        noaa: {
          canMakeRequest: noaaRateLimit,
          resetInMs: NOAARateLimiter.getTimeUntilReset(),
        },
      },
    };

    if (dbError) {
      healthStatus.status = "degraded";
    }

    return createSuccessResponse(
      healthStatus,
      "Enhanced forecast sync service health check"
    );
  } catch (error) {
    return createErrorResponse(
      "Health check failed",
      {
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      },
      500
    );
  }
}
